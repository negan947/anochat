/**
 * Core cryptographic operations for AnoChat
 * Uses libsodium for all crypto operations
 */

import _sodium from "libsodium-wrappers-sumo";
import { v4 as uuidv4 } from "uuid";
import {
  KeyPair,
  EncryptedPrivateKey,
  IdentityKey,
  CryptoError,
} from "./types";
import storage from "./storage";
import { CRYPTO, ERRORS } from "./constants";

// Sodium instance
let sodium: typeof _sodium;

/**
 * Initialize the sodium library
 * Must be called before any crypto operations
 */
export async function initCrypto(): Promise<void> {
  try {
    await _sodium.ready;
    sodium = _sodium;
  } catch (error) {
    throw new CryptoError(`Failed to initialize sodium: ${error}`);
  }
}

/**
 * Generate a new X25519 identity keypair
 */
export function generateIdentityKey(): KeyPair {
  if (!sodium) {
    throw new CryptoError(ERRORS.CRYPTO_NOT_INITIALIZED);
  }

  const keypair = sodium.crypto_box_keypair();
  return {
    publicKey: keypair.publicKey,
    privateKey: keypair.privateKey,
  };
}

/**
 * Generate fingerprint from public key
 * Uses generic hash of the public key
 */
export function generateFingerprint(publicKey: Uint8Array): string {
  if (!sodium) {
    throw new CryptoError(ERRORS.CRYPTO_NOT_INITIALIZED);
  }

  const hash = sodium.crypto_generichash(CRYPTO.FINGERPRINT_BYTES, publicKey);
  // Convert to hex string for display
  return sodium.to_hex(hash);
}

/**
 * Encrypt private key with passphrase using Argon2id
 */
export async function encryptPrivateKey(
  privateKey: Uint8Array,
  passphrase: string
): Promise<EncryptedPrivateKey> {
  if (!sodium) {
    throw new CryptoError("Sodium not initialized. Call initCrypto() first.");
  }

  // Generate random salt for Argon2 key derivation
  // Use the actual libsodium constant for salt bytes (16 bytes for Argon2)
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

  try {
    // Use sodium.crypto_pwhash for secure key derivation with Argon2id
    // This is MUCH more secure than the previous crypto_generichash approach
    const key = sodium.crypto_pwhash(
      CRYPTO.KEY_BYTES,                      // output length (32 bytes)
      passphrase,                            // password as string
      salt,                                  // salt (correct number of bytes)
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, // ops limit (secure default)
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE, // mem limit (64MB)
      sodium.crypto_pwhash_ALG_ARGON2ID13    // algorithm (Argon2id)
    );

    // Generate random nonce for encryption
    const nonce = sodium.randombytes_buf(CRYPTO.NONCE_BYTES);

    // Encrypt the private key
    const ciphertext = sodium.crypto_secretbox_easy(privateKey, nonce, key);

    // Clear sensitive data from memory
    sodium.memzero(key);

    return {
      salt,
      nonce,
      ciphertext,
    };
  } catch (error) {
    throw new CryptoError(`Password hashing failed: ${error}`);
  }
}

/**
 * Decrypt private key with passphrase using Argon2id
 */
export async function decryptPrivateKey(
  encryptedKey: EncryptedPrivateKey,
  passphrase: string
): Promise<Uint8Array> {
  if (!sodium) {
    throw new CryptoError("Sodium not initialized. Call initCrypto() first.");
  }

  try {
    // Use the new secure crypto_pwhash (Argon2id) method
    // Since we've upgraded to the secure method, we'll use it for all decryption
    const key = sodium.crypto_pwhash(
      CRYPTO.KEY_BYTES,                      // output length (32 bytes)
      passphrase,                            // password as string
      encryptedKey.salt,                     // salt (16 bytes)
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, // ops limit
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE, // mem limit (64MB)
      sodium.crypto_pwhash_ALG_ARGON2ID13    // algorithm (Argon2id)
    );

    // Decrypt the private key
    const privateKey = sodium.crypto_secretbox_open_easy(
      encryptedKey.ciphertext,
      encryptedKey.nonce,
      key
    );

    // Clear sensitive data from memory
    sodium.memzero(key);

    return privateKey;
  } catch (error: any) {
    // Handle specific sodium errors
    if (error?.message?.includes('incorrect key')) {
      throw new CryptoError(ERRORS.INVALID_PASSPHRASE);
    }
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError(ERRORS.INVALID_PASSPHRASE);
  }
}

/**
 * Generate ephemeral session ID
 * Stored only in sessionStorage, never persisted
 */
export function generateSessionId(): string {
  return uuidv4();
}

/**
 * Store session ID in sessionStorage
 */
export function setSessionId(sessionId: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("anochat_session_id", sessionId);
  }
}

/**
 * Get current session ID or generate new one
 */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return generateSessionId();
  }

  let sessionId = sessionStorage.getItem("anochat_session_id");
  if (!sessionId) {
    sessionId = generateSessionId();
    setSessionId(sessionId);
  }
  return sessionId;
}

/**
 * Create and store a new identity with passphrase protection
 */
export async function createIdentity(passphrase: string): Promise<IdentityKey> {
  if (!sodium) {
    throw new CryptoError("Sodium not initialized. Call initCrypto() first.");
  }

  // Generate new keypair
  const keypair = generateIdentityKey();
  
  // Generate fingerprint
  const fingerprint = generateFingerprint(keypair.publicKey);
  
  // Encrypt private key
  const encryptedPrivateKey = await encryptPrivateKey(
    keypair.privateKey,
    passphrase
  );
  
  // Store in IndexedDB
  await storage.saveIdentity(
    fingerprint,
    keypair.publicKey,
    encryptedPrivateKey
  );
  
  return {
    publicKey: keypair.publicKey,
    privateKey: keypair.privateKey,
    fingerprint,
    createdAt: new Date(),
  };
}

/**
 * Load identity from storage using passphrase
 */
export async function loadIdentity(
  fingerprint: string,
  passphrase: string
): Promise<IdentityKey | null> {
  const storedIdentity = await storage.getIdentity(fingerprint);
  if (!storedIdentity) {
    return null;
  }

  try {
    const privateKey = await decryptPrivateKey(
      storedIdentity.encryptedPrivateKey,
      passphrase
    );

    return {
      publicKey: storedIdentity.publicKey,
      privateKey,
      fingerprint: storedIdentity.fingerprint,
      createdAt: storedIdentity.createdAt,
    };
  } catch {
    throw new CryptoError("Failed to decrypt identity. Wrong passphrase?");
  }
}

/**
 * Generate a random room ID
 */
export function generateRoomId(): string {
  return uuidv4();
}

// Re-export validatePassphrase from utils/validation
export { validatePassphrase } from "./utils/validation";

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  if (!sodium) {
    throw new CryptoError("Sodium not initialized. Call initCrypto() first.");
  }
  return sodium.to_base64(array, sodium.base64_variants.ORIGINAL);
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (!sodium) {
    throw new CryptoError("Sodium not initialized. Call initCrypto() first.");
  }
  return sodium.from_base64(base64, sodium.base64_variants.ORIGINAL);
}

/**
 * Convert Uint8Array to hex string
 */
export function uint8ArrayToHex(array: Uint8Array): string {
  if (!sodium) {
    throw new CryptoError("Sodium not initialized. Call initCrypto() first.");
  }
  return sodium.to_hex(array);
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToUint8Array(hex: string): Uint8Array {
  if (!sodium) {
    throw new CryptoError("Sodium not initialized. Call initCrypto() first.");
  }
  return sodium.from_hex(hex);
}

/**
 * Generate random bytes
 */
export function randomBytes(length: number): Uint8Array {
  if (!sodium) {
    throw new CryptoError("Sodium not initialized. Call initCrypto() first.");
  }
  return sodium.randombytes_buf(length);
}

/**
 * Clear sensitive data from memory
 */
export function clearMemory(data: Uint8Array): void {
  if (!sodium) {
    throw new CryptoError("Sodium not initialized. Call initCrypto() first.");
  }
  sodium.memzero(data);
}

// Export initialized check
export function isCryptoInitialized(): boolean {
  return !!sodium;
} 