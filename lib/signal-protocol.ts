/**
 * Signal Protocol wrapper for AnoChat
 * Implements Double Ratchet protocol for perfect forward secrecy
 * Phase 4: Signal Protocol Integration
 */

import { KeyHelper, SignalProtocolAddress, SessionBuilder, SessionCipher } from "libsignal-protocol";
import { 
  PreKeyBundle, 
  SignalSession, 
  IdentityKey,
  CryptoError 
} from "./types";
import storage from "./storage";
import { initCrypto } from "./crypto";

// Signal Protocol Store implementation
class SignalProtocolStore {
  constructor() {}

  async getIdentityKeyPair(): Promise<ArrayBuffer> {
    // Get current identity from storage
    const identities = await storage.getAllIdentities();
    if (identities.length === 0) {
      throw new CryptoError("No identity key found. Create an identity first.");
    }
    
    // Use the most recently used identity
    const identity = identities.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())[0];
    
    // For Signal protocol, we need to convert our X25519 keys to the format expected
    // This is a simplified implementation - in production, you'd need proper key conversion
    return new ArrayBuffer(32); // Placeholder - needs proper implementation
  }

  async getLocalRegistrationId(): Promise<number> {
    return 1; // Fixed registration ID for this implementation
  }

  async storePreKey(keyId: number, keyPair: ArrayBuffer): Promise<void> {
    await storage.storePreKey(keyId, keyPair);
  }

  async loadPreKey(keyId: number): Promise<ArrayBuffer> {
    const preKey = await storage.getPreKey(keyId);
    if (!preKey) {
      throw new CryptoError(`PreKey ${keyId} not found`);
    }
    return preKey;
  }

  async removePreKey(keyId: number): Promise<void> {
    await storage.removePreKey(keyId);
  }

  async storeSignedPreKey(keyId: number, keyPair: ArrayBuffer): Promise<void> {
    await storage.storeSignedPreKey(keyId, keyPair);
  }

  async loadSignedPreKey(keyId: number): Promise<ArrayBuffer> {
    const signedPreKey = await storage.getSignedPreKey(keyId);
    if (!signedPreKey) {
      throw new CryptoError(`SignedPreKey ${keyId} not found`);
    }
    return signedPreKey;
  }

  async storeSession(identifier: string, record: ArrayBuffer): Promise<void> {
    await storage.storeSession(identifier, record);
  }

  async loadSession(identifier: string): Promise<ArrayBuffer | undefined> {
    return await storage.getSession(identifier);
  }

  async removeSession(identifier: string): Promise<void> {
    await storage.removeSession(identifier);
  }

  async removeAllSessions(identifier: string): Promise<void> {
    await storage.removeAllSessionsForIdentifier(identifier);
  }

  async getDeviceIds(identifier: string): Promise<number[]> {
    return await storage.getDeviceIds(identifier);
  }

  async storeIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
    await storage.storeIdentityKey(identifier, identityKey);
    return true;
  }

  async isTrustedIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
    const storedKey = await storage.getIdentityKey(identifier);
    if (!storedKey) {
      return true; // First time seeing this identity
    }
    
    // Compare keys
    const stored = new Uint8Array(storedKey);
    const provided = new Uint8Array(identityKey);
    
    if (stored.length !== provided.length) {
      return false;
    }
    
    for (let i = 0; i < stored.length; i++) {
      if (stored[i] !== provided[i]) {
        return false;
      }
    }
    
    return true;
  }
}

// Global store instance
let protocolStore: SignalProtocolStore;

/**
 * Initialize Signal Protocol
 * Must be called before any other Signal operations
 */
export async function initSignalProtocol(): Promise<void> {
  await initCrypto();
  protocolStore = new SignalProtocolStore();
}

/**
 * Generate a complete pre-key bundle for key exchange
 */
export async function generatePreKeyBundle(
  identity: IdentityKey
): Promise<PreKeyBundle> {
  if (!protocolStore) {
    throw new CryptoError("Signal Protocol not initialized. Call initSignalProtocol() first.");
  }

  try {
    // Generate a signed pre-key
    const signedPreKeyId = Math.floor(Math.random() * 16777216); // 24-bit ID
    const signedPreKey = await KeyHelper.generateSignedPreKey(
      await protocolStore.getIdentityKeyPair(),
      signedPreKeyId
    );

    // Generate a one-time pre-key
    const preKeyId = Math.floor(Math.random() * 16777216);
    const preKey = await KeyHelper.generatePreKey(preKeyId);

    // Store the keys
    await protocolStore.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);
    await protocolStore.storePreKey(preKeyId, preKey.keyPair);

    return {
      identityKey: identity.publicKey,
      signedPreKey: {
        keyId: signedPreKeyId,
        publicKey: signedPreKey.keyPair,
        signature: signedPreKey.signature
      },
      preKey: {
        keyId: preKeyId,
        publicKey: preKey.keyPair
      }
    };
  } catch (error) {
    throw new CryptoError(`Failed to generate pre-key bundle: ${error}`);
  }
}

/**
 * Process a pre-key bundle and establish a session
 */
export async function processPreKeyBundle(
  remoteAddress: string,
  deviceId: number,
  preKeyBundle: PreKeyBundle
): Promise<void> {
  if (!protocolStore) {
    throw new CryptoError("Signal Protocol not initialized. Call initSignalProtocol() first.");
  }

  try {
    const address = new SignalProtocolAddress(remoteAddress, deviceId);
    const sessionBuilder = new SessionBuilder(protocolStore, address);

    const bundle = {
      identityKey: preKeyBundle.identityKey,
      registrationId: await protocolStore.getLocalRegistrationId(),
      signedPreKey: {
        keyId: preKeyBundle.signedPreKey.keyId,
        publicKey: preKeyBundle.signedPreKey.publicKey,
        signature: preKeyBundle.signedPreKey.signature
      },
      preKey: preKeyBundle.preKey ? {
        keyId: preKeyBundle.preKey.keyId,
        publicKey: preKeyBundle.preKey.publicKey
      } : undefined
    };

    await sessionBuilder.processPreKey(bundle);
  } catch (error) {
    throw new CryptoError(`Failed to process pre-key bundle: ${error}`);
  }
}

/**
 * Encrypt a message using Signal Protocol
 */
export async function encryptMessage(
  remoteAddress: string,
  deviceId: number,
  plaintext: string
): Promise<{ type: number; body: string }> {
  if (!protocolStore) {
    throw new CryptoError("Signal Protocol not initialized. Call initSignalProtocol() first.");
  }

  try {
    const address = new SignalProtocolAddress(remoteAddress, deviceId);
    const sessionCipher = new SessionCipher(protocolStore, address);

    const ciphertext = await sessionCipher.encrypt(plaintext);
    return {
      type: ciphertext.type,
      body: ciphertext.body
    };
  } catch (error) {
    throw new CryptoError(`Failed to encrypt message: ${error}`);
  }
}

/**
 * Decrypt a message using Signal Protocol
 */
export async function decryptMessage(
  remoteAddress: string,
  deviceId: number,
  ciphertext: { type: number; body: string }
): Promise<string> {
  if (!protocolStore) {
    throw new CryptoError("Signal Protocol not initialized. Call initSignalProtocol() first.");
  }

  try {
    const address = new SignalProtocolAddress(remoteAddress, deviceId);
    const sessionCipher = new SessionCipher(protocolStore, address);

    let plaintext: ArrayBuffer;

    if (ciphertext.type === 3) { // PreKeyWhisperMessage
      plaintext = await sessionCipher.decryptPreKeyWhisperMessage(ciphertext.body);
    } else if (ciphertext.type === 1) { // WhisperMessage
      plaintext = await sessionCipher.decryptWhisperMessage(ciphertext.body);
    } else {
      throw new CryptoError(`Unknown message type: ${ciphertext.type}`);
    }

    // Convert ArrayBuffer to string
    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  } catch (error) {
    throw new CryptoError(`Failed to decrypt message: ${error}`);
  }
}

/**
 * Check if a session exists with a remote party
 */
export async function hasSession(
  remoteAddress: string,
  deviceId: number
): Promise<boolean> {
  if (!protocolStore) {
    throw new CryptoError("Signal Protocol not initialized. Call initSignalProtocol() first.");
  }

  try {
    const address = new SignalProtocolAddress(remoteAddress, deviceId);
    const session = await protocolStore.loadSession(address.toString());
    return !!session;
  } catch (error) {
    return false;
  }
}

/**
 * Delete a session with a remote party
 */
export async function deleteSession(
  remoteAddress: string,
  deviceId: number
): Promise<void> {
  if (!protocolStore) {
    throw new CryptoError("Signal Protocol not initialized. Call initSignalProtocol() first.");
  }

  try {
    const address = new SignalProtocolAddress(remoteAddress, deviceId);
    await protocolStore.removeSession(address.toString());
  } catch (error) {
    throw new CryptoError(`Failed to delete session: ${error}`);
  }
}

/**
 * Delete all sessions with a remote party (all devices)
 */
export async function deleteAllSessions(remoteAddress: string): Promise<void> {
  if (!protocolStore) {
    throw new CryptoError("Signal Protocol not initialized. Call initSignalProtocol() first.");
  }

  try {
    await protocolStore.removeAllSessions(remoteAddress);
  } catch (error) {
    throw new CryptoError(`Failed to delete all sessions: ${error}`);
  }
}

/**
 * Get all device IDs for a remote address
 */
export async function getDeviceIds(remoteAddress: string): Promise<number[]> {
  if (!protocolStore) {
    throw new CryptoError("Signal Protocol not initialized. Call initSignalProtocol() first.");
  }

  try {
    return await protocolStore.getDeviceIds(remoteAddress);
  } catch (error) {
    throw new CryptoError(`Failed to get device IDs: ${error}`);
  }
}

// Export the store for advanced usage
export { SignalProtocolStore }; 