/**
 * Key Exchange utilities for AnoChat
 * Handles QR code generation, parsing, and validation for secure key exchange
 * Phase 4: Signal Protocol Integration
 */

import { v4 as uuidv4 } from "uuid";
import {
  PreKeyBundle,
  IdentityKey,
  CryptoError,
} from "./types";
import {
  uint8ArrayToBase64,
  base64ToUint8Array,
  generateFingerprint
} from "./crypto";
import { generatePreKeyBundle } from "./signal-protocol";

/**
 * Key exchange invitation structure
 */
export interface KeyExchangeInvite {
  version: string;
  inviteId: string;
  senderFingerprint: string;
  preKeyBundle: PreKeyBundle;
  timestamp: number;
  roomId?: string;
}

/**
 * Key exchange response structure
 */
export interface KeyExchangeResponse {
  version: string;
  inviteId: string;
  responderFingerprint: string;
  preKeyBundle: PreKeyBundle;
  timestamp: number;
}

/**
 * Serialized key exchange data for QR codes
 */
export interface SerializedKeyExchange {
  v: string; // version
  i: string; // inviteId
  f: string; // fingerprint
  ik: string; // identity key (base64)
  spk: {
    id: number;
    pk: string; // public key (base64)
    sig: string; // signature (base64)
  };
  pk?: {
    id: number;
    pk: string; // public key (base64)
  };
  ts: number; // timestamp
  r?: string; // room ID
}

const KEY_EXCHANGE_VERSION = "1.0";
const QR_CODE_PREFIX = "anochat://keyexchange/";

/**
 * Create a key exchange invitation
 */
export async function createKeyExchangeInvite(
  identity: IdentityKey,
  roomId?: string
): Promise<KeyExchangeInvite> {
  try {
    const preKeyBundle = await generatePreKeyBundle(identity);
    
    return {
      version: KEY_EXCHANGE_VERSION,
      inviteId: uuidv4(),
      senderFingerprint: identity.fingerprint,
      preKeyBundle,
      timestamp: Date.now(),
      roomId
    };
  } catch (error) {
    throw new CryptoError(`Failed to create key exchange invite: ${error}`);
  }
}

/**
 * Create a key exchange response to an invitation
 */
export async function createKeyExchangeResponse(
  identity: IdentityKey,
  inviteId: string
): Promise<KeyExchangeResponse> {
  try {
    const preKeyBundle = await generatePreKeyBundle(identity);
    
    return {
      version: KEY_EXCHANGE_VERSION,
      inviteId,
      responderFingerprint: identity.fingerprint,
      preKeyBundle,
      timestamp: Date.now()
    };
  } catch (error) {
    throw new CryptoError(`Failed to create key exchange response: ${error}`);
  }
}

/**
 * Serialize key exchange data for QR code (compact format)
 * Uses a more compact representation for QR code size limits
 */
export function serializeKeyExchange(invite: KeyExchangeInvite): SerializedKeyExchange {
  // For QR codes, we'll only include essential data to stay within size limits
  const serialized: SerializedKeyExchange = {
    v: "1", // Shortened version
    i: invite.inviteId.replace(/-/g, ''), // Remove hyphens from UUID
    f: invite.senderFingerprint.slice(0, 16), // Use shorter fingerprint (first 16 chars)
    ik: uint8ArrayToBase64(invite.preKeyBundle.identityKey),
    spk: {
      id: invite.preKeyBundle.signedPreKey.keyId,
      pk: uint8ArrayToBase64(invite.preKeyBundle.signedPreKey.publicKey),
      sig: uint8ArrayToBase64(invite.preKeyBundle.signedPreKey.signature)
    },
    ts: Math.floor(invite.timestamp / 1000) // Use seconds instead of milliseconds
  };

  // Only include preKey if it exists and we have room in QR code
  if (invite.preKeyBundle.preKey) {
    serialized.pk = {
      id: invite.preKeyBundle.preKey.keyId,
      pk: uint8ArrayToBase64(invite.preKeyBundle.preKey.publicKey)
    };
  }

  // Only include room ID if specified
  if (invite.roomId) {
    serialized.r = invite.roomId;
  }

  return serialized;
}

/**
 * Deserialize key exchange data from QR code
 */
export function deserializeKeyExchange(serialized: SerializedKeyExchange): KeyExchangeInvite {
  try {
    const preKeyBundle: PreKeyBundle = {
      identityKey: base64ToUint8Array(serialized.ik),
      signedPreKey: {
        keyId: serialized.spk.id,
        publicKey: base64ToUint8Array(serialized.spk.pk),
        signature: base64ToUint8Array(serialized.spk.sig)
      }
    };

    if (serialized.pk) {
      preKeyBundle.preKey = {
        keyId: serialized.pk.id,
        publicKey: base64ToUint8Array(serialized.pk.pk)
      };
    }

    // Reconstruct full IDs from compact format
    const fullInviteId = serialized.i.length === 32 ? 
      `${serialized.i.slice(0,8)}-${serialized.i.slice(8,12)}-${serialized.i.slice(12,16)}-${serialized.i.slice(16,20)}-${serialized.i.slice(20)}` :
      serialized.i;

    // Use the room ID directly without any reconstruction
    const fullRoomId = serialized.r;

    return {
      version: serialized.v === "1" ? KEY_EXCHANGE_VERSION : serialized.v,
      inviteId: fullInviteId,
      senderFingerprint: serialized.f,
      preKeyBundle,
      timestamp: serialized.ts < 1000000000000 ? serialized.ts * 1000 : serialized.ts, // Convert back to milliseconds if needed
      roomId: fullRoomId
    };
  } catch (error) {
    throw new CryptoError(`Failed to deserialize key exchange data: ${error}`);
  }
}

/**
 * Generate simplified contact QR code data (contains only basic identity info)
 */
export async function generateContactQR(identity: IdentityKey): Promise<string> {
  try {
    // Create a minimal contact data structure
    const contactData = {
      type: "contact",
      fingerprint: identity.fingerprint.slice(0, 16), // Shorter fingerprint
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    const data = "anochat://contact/" + btoa(JSON.stringify(contactData));
    
    // Return the raw data string for the QRCode component to encode
    return data;
  } catch (error) {
    throw new CryptoError(`Failed to generate contact QR code: ${error}`);
  }
}

/**
 * Generate QR code data for key exchange invitation (fallback to contact QR if too large)
 */
export async function generateKeyExchangeQR(
  invite: KeyExchangeInvite
): Promise<string> {
  try {
    // First try the full key exchange QR
    const serialized = serializeKeyExchange(invite);
    const data = QR_CODE_PREFIX + btoa(JSON.stringify(serialized));
    
    // Check if data is too large for QR code (rough estimate)
    if (data.length > 2000) {
      // Fallback to simpler contact QR if we have identity info
      if (invite.preKeyBundle?.identityKey) {
        const tempIdentity: IdentityKey = {
          publicKey: invite.preKeyBundle.identityKey,
          privateKey: new Uint8Array(), // Not needed for contact QR
          fingerprint: invite.senderFingerprint,
          createdAt: new Date(invite.timestamp)
        };
        return await generateContactQR(tempIdentity);
      }
    }
    
    // Return the raw data string for the QRCode component to encode
    return data;
  } catch (error) {
    // If full QR fails, try contact QR as fallback
    if (invite.preKeyBundle?.identityKey) {
      const tempIdentity: IdentityKey = {
        publicKey: invite.preKeyBundle.identityKey,
        privateKey: new Uint8Array(),
        fingerprint: invite.senderFingerprint,
        createdAt: new Date(invite.timestamp)
      };
      return await generateContactQR(tempIdentity);
    }
    throw new CryptoError(`Failed to generate QR code: ${error}`);
  }
}

/**
 * Parse contact QR code data
 */
export function parseContactQR(qrData: string): { fingerprint: string; timestamp: number } {
  try {
    const contactPrefix = "anochat://contact/";
    if (!qrData.startsWith(contactPrefix)) {
      throw new CryptoError("Invalid contact QR code format");
    }

    const encodedData = qrData.slice(contactPrefix.length);
    const jsonData = atob(encodedData);
    const contactData = JSON.parse(jsonData);

    if (contactData.type !== "contact") {
      throw new CryptoError("Not a contact QR code");
    }

    return {
      fingerprint: contactData.fingerprint,
      timestamp: contactData.timestamp * 1000 // Convert back to milliseconds
    };
  } catch (error) {
    throw new CryptoError(`Failed to parse contact QR code: ${error}`);
  }
}

/**
 * Parse key exchange invitation from QR code data
 */
export function parseKeyExchangeQR(qrData: string): KeyExchangeInvite {
  try {
    // First check if it's a contact QR code
    if (qrData.startsWith("anochat://contact/")) {
      throw new CryptoError("This is a contact QR code. Use parseContactQR() instead.");
    }

    if (!qrData.startsWith(QR_CODE_PREFIX)) {
      throw new CryptoError("Invalid QR code format");
    }

    const encodedData = qrData.slice(QR_CODE_PREFIX.length);
    const jsonData = atob(encodedData);
    const serialized: SerializedKeyExchange = JSON.parse(jsonData);

    // Validate version
    if (serialized.v !== KEY_EXCHANGE_VERSION && serialized.v !== "1") {
      throw new CryptoError(`Unsupported key exchange version: ${serialized.v}`);
    }

    return deserializeKeyExchange(serialized);
  } catch (error) {
    throw new CryptoError(`Failed to parse QR code: ${error}`);
  }
}

/**
 * Validate key exchange invitation
 */
export function validateKeyExchangeInvite(invite: KeyExchangeInvite): boolean {
  try {
    // Check version
    if (invite.version !== KEY_EXCHANGE_VERSION) {
      return false;
    }

    // Check required fields
    if (!invite.inviteId || !invite.senderFingerprint || !invite.preKeyBundle) {
      return false;
    }

    // Check timestamp (not too old - 24 hours max)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (Date.now() - invite.timestamp > maxAge) {
      return false;
    }

    // Validate fingerprint matches identity key
    const computedFingerprint = generateFingerprint(invite.preKeyBundle.identityKey);
    if (computedFingerprint !== invite.senderFingerprint) {
      return false;
    }

    // Basic validation of pre-key bundle structure
    if (!invite.preKeyBundle.identityKey || !invite.preKeyBundle.signedPreKey) {
      return false;
    }

    if (!invite.preKeyBundle.signedPreKey.publicKey || !invite.preKeyBundle.signedPreKey.signature) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a shareable link for key exchange
 */
export function generateKeyExchangeLink(invite: KeyExchangeInvite): string {
  try {
    const serialized = serializeKeyExchange(invite);
    const encodedData = btoa(JSON.stringify(serialized));
    
    // For web deployment, this could be your domain
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'https://anochat.example.com';
    
    return `${baseUrl}/join?k=${encodeURIComponent(encodedData)}`;
  } catch (error) {
    throw new CryptoError(`Failed to generate key exchange link: ${error}`);
  }
}

/**
 * Parse key exchange invitation from shareable link
 */
export function parseKeyExchangeLink(url: string): KeyExchangeInvite {
  try {
    const urlObj = new URL(url);
    const encodedData = urlObj.searchParams.get('k');
    
    if (!encodedData) {
      throw new CryptoError("No key exchange data found in link");
    }

    const decodedData = decodeURIComponent(encodedData);
    const jsonData = atob(decodedData);
    const serialized: SerializedKeyExchange = JSON.parse(jsonData);

    // Validate version
    if (serialized.v !== KEY_EXCHANGE_VERSION) {
      throw new CryptoError(`Unsupported key exchange version: ${serialized.v}`);
    }

    return deserializeKeyExchange(serialized);
  } catch {
    throw new CryptoError(`Failed to parse key exchange link`);
  }
}

/**
 * Get a short, human-readable representation of a fingerprint
 */
export function getShortFingerprint(fingerprint: string): string {
  if (fingerprint.length < 8) {
    return fingerprint;
  }
  
  // Return first 4 and last 4 characters
  return `${fingerprint.slice(0, 4)}...${fingerprint.slice(-4)}`;
}

/**
 * Format fingerprint for display with spaces
 */
export function formatFingerprint(fingerprint: string): string {
  // Insert spaces every 4 characters for better readability
  return fingerprint.replace(/(.{4})/g, '$1 ').trim().toUpperCase();
}

/**
 * Verify that two fingerprints match
 */
export function verifyFingerprints(fingerprint1: string, fingerprint2: string): boolean {
  // Normalize both fingerprints (remove spaces, convert to lowercase)
  const normalize = (fp: string) => fp.replace(/\s/g, '').toLowerCase();
  return normalize(fingerprint1) === normalize(fingerprint2);
}

/**
 * Parse any AnoChat QR code (contact or key exchange)
 */
export function parseAnyQR(qrData: string): { type: 'contact' | 'keyexchange'; data: { fingerprint: string; timestamp: number } | KeyExchangeInvite } {
  try {
    if (qrData.startsWith("anochat://contact/")) {
      return {
        type: 'contact',
        data: parseContactQR(qrData)
      };
    } else if (qrData.startsWith(QR_CODE_PREFIX)) {
      return {
        type: 'keyexchange',
        data: parseKeyExchangeQR(qrData)
      };
    } else {
      throw new CryptoError("Unknown QR code format");
    }
  } catch (error) {
    throw new CryptoError(`Failed to parse QR code: ${error}`);
  }
}

/**
 * Generate a room invitation with key exchange
 */
export async function generateRoomInvite(
  identity: IdentityKey,
  roomId: string,
): Promise<{
  invite: KeyExchangeInvite;
  qrCode: string;
  link: string;
}> {
  try {
    const invite = await createKeyExchangeInvite(identity, roomId);
    const qrCode = await generateKeyExchangeQR(invite);
    const link = generateKeyExchangeLink(invite);

    return {
      invite,
      qrCode,
      link
    };
  } catch (error) {
    throw new CryptoError(`Failed to generate room invite: ${error}`);
  }
} 