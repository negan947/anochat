/**
 * Key Exchange utilities for AnoChat
 * Handles QR code generation, parsing, and validation for secure key exchange
 * Phase 4: Signal Protocol Integration
 */

import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import {
  PreKeyBundle,
  IdentityKey,
  CryptoError,
  HexString,
  Base64String
} from "./types";
import {
  uint8ArrayToBase64,
  base64ToUint8Array,
  uint8ArrayToHex,
  hexToUint8Array,
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
interface SerializedKeyExchange {
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
 * Serialize key exchange data for QR code
 */
function serializeKeyExchange(invite: KeyExchangeInvite): SerializedKeyExchange {
  const serialized: SerializedKeyExchange = {
    v: invite.version,
    i: invite.inviteId,
    f: invite.senderFingerprint,
    ik: uint8ArrayToBase64(invite.preKeyBundle.identityKey),
    spk: {
      id: invite.preKeyBundle.signedPreKey.keyId,
      pk: uint8ArrayToBase64(invite.preKeyBundle.signedPreKey.publicKey),
      sig: uint8ArrayToBase64(invite.preKeyBundle.signedPreKey.signature)
    },
    ts: invite.timestamp
  };

  if (invite.preKeyBundle.preKey) {
    serialized.pk = {
      id: invite.preKeyBundle.preKey.keyId,
      pk: uint8ArrayToBase64(invite.preKeyBundle.preKey.publicKey)
    };
  }

  if (invite.roomId) {
    serialized.r = invite.roomId;
  }

  return serialized;
}

/**
 * Deserialize key exchange data from QR code
 */
function deserializeKeyExchange(serialized: SerializedKeyExchange): KeyExchangeInvite {
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

    return {
      version: serialized.v,
      inviteId: serialized.i,
      senderFingerprint: serialized.f,
      preKeyBundle,
      timestamp: serialized.ts,
      roomId: serialized.r
    };
  } catch (error) {
    throw new CryptoError(`Failed to deserialize key exchange data: ${error}`);
  }
}

/**
 * Generate QR code for key exchange invitation
 */
export async function generateKeyExchangeQR(
  invite: KeyExchangeInvite
): Promise<string> {
  try {
    const serialized = serializeKeyExchange(invite);
    const data = QR_CODE_PREFIX + btoa(JSON.stringify(serialized));
    
    const qrCodeDataURL = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });

    return qrCodeDataURL;
  } catch (error) {
    throw new CryptoError(`Failed to generate QR code: ${error}`);
  }
}

/**
 * Parse key exchange invitation from QR code data
 */
export function parseKeyExchangeQR(qrData: string): KeyExchangeInvite {
  try {
    if (!qrData.startsWith(QR_CODE_PREFIX)) {
      throw new CryptoError("Invalid QR code format");
    }

    const encodedData = qrData.slice(QR_CODE_PREFIX.length);
    const jsonData = atob(encodedData);
    const serialized: SerializedKeyExchange = JSON.parse(jsonData);

    // Validate version
    if (serialized.v !== KEY_EXCHANGE_VERSION) {
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
  } catch (error) {
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
  } catch (error) {
    throw new CryptoError(`Failed to parse key exchange link: ${error}`);
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
 * Generate a room invitation with key exchange
 */
export async function generateRoomInvite(
  identity: IdentityKey,
  roomId: string,
  roomName?: string
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