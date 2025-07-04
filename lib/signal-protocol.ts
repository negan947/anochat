/**
 * Simplified Signal Protocol implementation for AnoChat
 * Demonstrates Double Ratchet concepts using our existing crypto infrastructure
 * Phase 4: Signal Protocol Integration (Simplified)
 */

import { 
  PreKeyBundle, 
  IdentityKey,
  CryptoError 
} from "./types";
import storage from "./storage";
import { 
  initCrypto,
  randomBytes,
  uint8ArrayToBase64,
  base64ToUint8Array,
  clearMemory
} from "./crypto";
import _sodium from "libsodium-wrappers-sumo";
import { identityStore } from "./identity-store";

// Initialize sodium for crypto operations
let sodium: typeof _sodium;

/**
 * Simple Signal Protocol Store implementation
 * Uses our existing storage layer
 */
class SimpleSignalProtocolStore {
  constructor() {}

  async getIdentityKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
    // Get the currently active identity from our in-memory store
    const identity = identityStore.getActiveIdentity();
    
    if (!identity) {
      throw new CryptoError("No active identity found. Load an identity first.");
    }
    
    // Return the real public and private keys
    return {
      publicKey: identity.publicKey,
      privateKey: identity.privateKey
    };
  }

  async getLocalRegistrationId(): Promise<number> {
    return 1; // Fixed registration ID for this implementation
  }

  async storePreKey(keyId: number, keyPair: { publicKey: Uint8Array; privateKey: Uint8Array }): Promise<void> {
    // Convert to ArrayBuffer for storage
    const combined = new ArrayBuffer(64);
    const view = new Uint8Array(combined);
    view.set(keyPair.publicKey, 0);
    view.set(keyPair.privateKey, 32);
    
    await storage.storePreKey(keyId, combined as ArrayBuffer);
  }

  async loadPreKey(keyId: number): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array } | null> {
    const stored = await storage.getPreKey(keyId);
    if (!stored) return null;
    
    const view = new Uint8Array(stored);
    return {
      publicKey: view.slice(0, 32),
      privateKey: view.slice(32, 64)
    };
  }

  async removePreKey(keyId: number): Promise<void> {
    await storage.removePreKey(keyId);
  }

  async storeSignedPreKey(keyId: number, keyPair: { publicKey: Uint8Array; privateKey: Uint8Array }): Promise<void> {
    // Convert to ArrayBuffer for storage
    const combined = new ArrayBuffer(64);
    const view = new Uint8Array(combined);
    view.set(keyPair.publicKey, 0);
    view.set(keyPair.privateKey, 32);
    
    await storage.storeSignedPreKey(keyId, combined as ArrayBuffer);
  }

  async loadSignedPreKey(keyId: number): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array } | null> {
    const stored = await storage.getSignedPreKey(keyId);
    if (!stored) return null;
    
    const view = new Uint8Array(stored);
    return {
      publicKey: view.slice(0, 32),
      privateKey: view.slice(32, 64)
    };
  }

  async storeSession(identifier: string, sessionData: Uint8Array): Promise<void> {
    // Convert Uint8Array to ArrayBuffer
    const buffer = new ArrayBuffer(sessionData.length);
    new Uint8Array(buffer).set(sessionData);
    await storage.storeSignalSession(identifier, buffer);
  }

  async loadSession(identifier: string): Promise<Uint8Array | undefined> {
    const stored = await storage.getSignalSession(identifier);
    return stored ? new Uint8Array(stored) : undefined;
  }

  async removeSession(identifier: string): Promise<void> {
    await storage.removeSignalSession(identifier);
  }

  async removeAllSessions(identifier: string): Promise<void> {
    await storage.removeAllSessionsForIdentifier(identifier);
  }

  async getDeviceIds(identifier: string): Promise<number[]> {
    return await storage.getDeviceIds(identifier);
  }

  async storeIdentity(identifier: string, identityKey: Uint8Array): Promise<boolean> {
    // Convert Uint8Array to ArrayBuffer
    const buffer = new ArrayBuffer(identityKey.length);
    new Uint8Array(buffer).set(identityKey);
    await storage.storeIdentityKey(identifier, buffer);
    return true;
  }

  async isTrustedIdentity(identifier: string, identityKey: Uint8Array): Promise<boolean> {
    const storedKey = await storage.getIdentityKey(identifier);
    if (!storedKey) {
      return true; // First time seeing this identity
    }
    
    // Compare keys
    const stored = new Uint8Array(storedKey);
    
    if (stored.length !== identityKey.length) {
      return false;
    }
    
    for (let i = 0; i < stored.length; i++) {
      if (stored[i] !== identityKey[i]) {
        return false;
      }
    }
    
    return true;
  }
}

// Global store instance
let protocolStore: SimpleSignalProtocolStore;

/**
 * Initialize Signal Protocol
 * Must be called before any other Signal operations
 */
export async function initSignalProtocol(): Promise<void> {
  await initCrypto();
  await _sodium.ready;
  sodium = _sodium;
  protocolStore = new SimpleSignalProtocolStore();
}

/**
 * Generate a simple key pair using libsodium
 */
function generateKeyPair(): { publicKey: Uint8Array; privateKey: Uint8Array } {
  if (!sodium) {
    throw new CryptoError("Sodium not initialized. Call initSignalProtocol() first.");
  }
  
  const keypair = sodium.crypto_box_keypair();
  return {
    publicKey: keypair.publicKey,
    privateKey: keypair.privateKey
  };
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
    const signedPreKeyPair = generateKeyPair();
    
    // The identity key is an X25519 keypair (32-byte secret key). The Ed25519
    // signing API however expects a 64-byte Ed25519 secret key.  We can safely
    // treat our 32-byte secret key as a seed and deterministically derive an
    // Ed25519 signing key from it.  This preserves compatibility with the
    // rest of the code-base without having to migrate existing identities.

    const messageToSign = signedPreKeyPair.publicKey;

    // Derive a deterministic Ed25519 key­pair from the existing secret key
    // (libsodium interprets the 32-byte seed as an Ed25519 seed).
    const edKeyPair = sodium.crypto_sign_seed_keypair(identity.privateKey);

    // Generate the detached signature using the derived 64-byte secret key.
    const signature = sodium.crypto_sign_detached(messageToSign, edKeyPair.privateKey);

    // Clear sensitive memory
    clearMemory(edKeyPair.privateKey);

    // Generate a one-time pre-key
    const preKeyId = Math.floor(Math.random() * 16777216);
    const preKeyPair = generateKeyPair();

    // Store the keys
    await protocolStore.storeSignedPreKey(signedPreKeyId, signedPreKeyPair);
    await protocolStore.storePreKey(preKeyId, preKeyPair);

    return {
      // Publish the Ed25519 public key so peers can verify our signatures.
      // Peers can convert this key to a Curve25519 key when they need to perform
      // Diffie-Hellman operations (see processPreKeyBundle).
      identityKey: edKeyPair.publicKey,
      signedPreKey: {
        keyId: signedPreKeyId,
        publicKey: signedPreKeyPair.publicKey,
        signature: signature
      },
      preKey: {
        keyId: preKeyId,
        publicKey: preKeyPair.publicKey
      }
    };
  } catch (error) {
    throw new CryptoError(`Failed to generate pre-key bundle: ${error}`);
  }
}

/**
 * Process a pre-key bundle and establish a session (simplified X3DH)
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
    // Verify signature on signed pre-key
    const isValidSignature = sodium.crypto_sign_verify_detached(
      preKeyBundle.signedPreKey.signature,
      preKeyBundle.signedPreKey.publicKey,
      preKeyBundle.identityKey
    );

    if (!isValidSignature) {
      throw new CryptoError("Invalid signature on signed pre-key");
    }

    // Convert the peer's Ed25519 identity key to a Curve25519 key so we can use
    // it in Diffie-Hellman computations.
    const peerCurve25519IdentityKey = sodium.crypto_sign_ed25519_pk_to_curve25519(
      preKeyBundle.identityKey
    );

    // Get our identity
    const ourIdentity = await protocolStore.getIdentityKeyPair();
    
    // Generate ephemeral key
    const ephemeralKey = generateKeyPair();

    // Simplified X3DH key agreement
    // DH1 = DH(IK_A, SPK_B)
    const dh1 = sodium.crypto_scalarmult(ourIdentity.privateKey, preKeyBundle.signedPreKey.publicKey);
    
    // DH2 = DH(EK_A, IK_B)  (use converted Curve25519 key)
    const dh2 = sodium.crypto_scalarmult(ephemeralKey.privateKey, peerCurve25519IdentityKey);
    
    // DH3 = DH(EK_A, SPK_B)
    const dh3 = sodium.crypto_scalarmult(ephemeralKey.privateKey, preKeyBundle.signedPreKey.publicKey);
    
    // DH4 = DH(EK_A, OPK_B) (if one-time pre-key exists)
    let dh4: Uint8Array | null = null;
    if (preKeyBundle.preKey) {
      dh4 = sodium.crypto_scalarmult(ephemeralKey.privateKey, preKeyBundle.preKey.publicKey);
    }

    // Combine all DH outputs to create shared secret
    const dhOutputs = [dh1, dh2, dh3];
    if (dh4) dhOutputs.push(dh4);
    
    // Create shared secret by concatenating and hashing
    const combinedLength = dhOutputs.reduce((sum, dh) => sum + dh.length, 0);
    const combined = new Uint8Array(combinedLength);
    let offset = 0;
    for (const dh of dhOutputs) {
      combined.set(dh, offset);
      offset += dh.length;
    }
    
    // Derive root key and chain key using KDF
    const sharedSecret = sodium.crypto_generichash(32, combined);
    
    // Create session data (simplified)
    const sessionData = new Uint8Array(64);
    sessionData.set(sharedSecret, 0);
    sessionData.set(ephemeralKey.publicKey, 32);
    
    // Store session
    const sessionId = `${remoteAddress}.${deviceId}`;
    await protocolStore.storeSession(sessionId, sessionData);
    
    // Store remote identity
    await protocolStore.storeIdentity(remoteAddress, preKeyBundle.identityKey);
    
    // Clean up sensitive data
    clearMemory(ephemeralKey.privateKey);
    clearMemory(dh1);
    clearMemory(dh2);
    clearMemory(dh3);
    if (dh4) clearMemory(dh4);
    clearMemory(combined);
    clearMemory(sharedSecret);

  } catch (error) {
    throw new CryptoError(`Failed to process pre-key bundle: ${error}`);
  }
}

/**
 * Encrypt a message using simplified Double Ratchet
 */
export async function encryptMessage(
  remoteAddress: string,
  deviceId: number,
  plaintext: string
): Promise<{ type: number; body: string; ek?: string; ik?: string }> {
  if (!protocolStore) {
    throw new CryptoError("Signal Protocol not initialized. Call initSignalProtocol() first.");
  }

  // TODO: SECURITY WARNING
  // This implementation is a simplified X3DH handshake. It does NOT implement
  // the Double Ratchet algorithm. It lacks forward secrecy and post-compromise
  // security. This should be replaced with a full implementation from the
  // official libsignal-protocol-javascript library for production use.
  try {
    const sessionId = `${remoteAddress}.${deviceId}`;
    const sessionData = await protocolStore.loadSession(sessionId);
    
    if (!sessionData) {
      throw new CryptoError("No session found. Establish a session first.");
    }

    // Extract session key (simplified)
    const sessionKey = sessionData.slice(0, 32);
    
    // Encrypt using authenticated encryption
    const nonce = randomBytes(24);
    const plaintextBytes = sodium.from_string(plaintext);
    const ciphertext = sodium.crypto_secretbox_easy(plaintextBytes, nonce, sessionKey);
    
    // Create message with nonce prepended
    const messageBytes = new Uint8Array(nonce.length + ciphertext.length);
    messageBytes.set(nonce, 0);
    messageBytes.set(ciphertext, nonce.length);
    
    return {
      type: 1,
      body: uint8ArrayToBase64(messageBytes),
      ek: uint8ArrayToBase64(sessionData.slice(32, 64)),
      ik: uint8ArrayToBase64((await protocolStore.getIdentityKeyPair()).publicKey)
    };
  } catch (error) {
    throw new CryptoError(`Failed to encrypt message: ${error}`);
  }
}

/**
 * Decrypt a message using simplified Double Ratchet
 */
export async function decryptMessage(
  remoteAddress: string,
  deviceId: number,
  ciphertext: { type: number; body: string; ek?: string; ik?: string }
): Promise<string> {
  if (!protocolStore) {
    throw new CryptoError("Signal Protocol not initialized. Call initSignalProtocol() first.");
  }

  // TODO: SECURITY WARNING
  // This implementation is a simplified X3DH handshake. It does NOT implement
  // the Double Ratchet algorithm. It lacks forward secrecy and post-compromise
  // security. This should be replaced with a full implementation from the
  // official libsignal-protocol-javascript library for production use.
  try {
    const sessionId = `${remoteAddress}.${deviceId}`;
    let sessionData = await protocolStore.loadSession(sessionId);
    
    if (!sessionData) {
      // Attempt to derive a session from the peer-supplied keys (bootstrap).
      if (ciphertext.ek && ciphertext.ik) {
        const peerEphemeralKey = base64ToUint8Array(ciphertext.ek);
        const peerIdentityKeyEd = base64ToUint8Array(ciphertext.ik);

        // Convert peer identity key to Curve25519
        const peerIdentityKey = sodium.crypto_sign_ed25519_pk_to_curve25519(
          peerIdentityKeyEd
        );

        // Load OUR keys
        const ourIdentity = await protocolStore.getIdentityKeyPair();

        // We assume the most recently generated signed/pre-key pair was used.
        const allSignedIds = await storage.getAllPreKeyIds();
        const signedPreKeyId = allSignedIds.length > 0 ? allSignedIds[allSignedIds.length - 1] : undefined;
        if (!signedPreKeyId) {
          throw new CryptoError("No signed pre-key available to complete handshake");
        }
        const ourSignedPreKey = await protocolStore.loadSignedPreKey(signedPreKeyId);
        if (!ourSignedPreKey) {
          throw new CryptoError("Signed pre-key not found in store");
        }

        // If we still have a one-time pre-key, load it; otherwise skip DH4.
        const preKeyIds = await storage.getAllPreKeyIds();
        const ourPreKeyId = preKeyIds.find(id => id !== signedPreKeyId);
        const ourPreKeyPair = ourPreKeyId ? await protocolStore.loadPreKey(ourPreKeyId) : null;

        // Perform the symmetric DH calculations (Bob side)
        const dh1 = sodium.crypto_scalarmult(ourSignedPreKey.privateKey, peerIdentityKey); // DH(SPK_B, IK_A)
        const dh2 = sodium.crypto_scalarmult(ourIdentity.privateKey, peerEphemeralKey);   // DH(IK_B, EK_A)
        const dh3 = sodium.crypto_scalarmult(ourSignedPreKey.privateKey, peerEphemeralKey); // DH(SPK_B, EK_A)

        let dh4: Uint8Array | null = null;
        if (ourPreKeyPair) {
          dh4 = sodium.crypto_scalarmult(ourPreKeyPair.privateKey, peerEphemeralKey);
        }

        // Combine DH outputs
        const dhOutputs = [dh1, dh2, dh3];
        if (dh4) dhOutputs.push(dh4);

        const combinedLength = dhOutputs.reduce((s, d) => s + d.length, 0);
        const combined = new Uint8Array(combinedLength);
        let offset = 0;
        for (const dh of dhOutputs) {
          combined.set(dh, offset); offset += dh.length;
        }

        const sharedSecret = sodium.crypto_generichash(32, combined);
        const newSessionData = new Uint8Array(64);
        newSessionData.set(sharedSecret, 0);
        newSessionData.set(peerEphemeralKey, 32);

        const sessionId = `${remoteAddress}.${deviceId}`;
        await protocolStore.storeSession(sessionId, newSessionData);

        sessionData = newSessionData;

        // Remove one-time pre-key so it cannot be reused
        if (ourPreKeyId) {
          await protocolStore.removePreKey(ourPreKeyId);
        }
      } else {
        throw new CryptoError("No session found and no bootstrap keys provided.");
      }
    }

    // Extract session key (simplified)
    const sessionKey = sessionData.slice(0, 32);
    
    // Decode message
    const messageBytes = base64ToUint8Array(ciphertext.body);
    
    // Extract nonce and ciphertext
    const nonce = messageBytes.slice(0, 24);
    const encryptedData = messageBytes.slice(24);
    
    // Decrypt
    const plaintextBytes = sodium.crypto_secretbox_open_easy(encryptedData, nonce, sessionKey);
    
    return sodium.to_string(plaintextBytes);
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
    const sessionId = `${remoteAddress}.${deviceId}`;
    const session = await protocolStore.loadSession(sessionId);
    return !!session;
      } catch {
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
    const sessionId = `${remoteAddress}.${deviceId}`;
    await protocolStore.removeSession(sessionId);
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
export { SimpleSignalProtocolStore }; 