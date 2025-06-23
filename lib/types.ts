/**
 * Core TypeScript types and interfaces for AnoChat
 * All types follow zero-knowledge principles - no plaintext user data
 */

// Crypto-related types
export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface EncryptedPrivateKey {
  salt: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

export interface IdentityKey {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  fingerprint: string;
  createdAt: Date;
}

// Message types
export interface EncryptedMessage {
  id?: string;
  room_id: string;
  sender_fingerprint: string;
  ciphertext: Uint8Array;
  header: Uint8Array;
  created_at?: Date;
}

export interface DecryptedMessage {
  id: string;
  room_id: string;
  sender_fingerprint: string;
  content: string;
  timestamp: Date;
}

// Session types
export interface SessionInfo {
  sessionId: string;
  createdAt: Date;
  expiresAt?: Date;
}

// Room types
export interface Room {
  id: string;
  name?: string; // Optional display name (stored locally only)
  participants: string[]; // Array of fingerprints
  createdAt: Date;
}

// Storage types
export interface StoredIdentity {
  id: number;
  fingerprint: string;
  publicKey: Uint8Array;
  encryptedPrivateKey: EncryptedPrivateKey;
  createdAt: Date;
  lastUsed: Date;
}

export interface StoredRoom {
  id: number;
  room_id: string;
  name?: string;
  participants: string[];
  joinedAt: Date;
  lastMessageAt?: Date;
}

// Signal Protocol types
export interface PreKeyBundle {
  identityKey: Uint8Array;
  signedPreKey: {
    keyId: number;
    publicKey: Uint8Array;
    signature: Uint8Array;
  };
  preKey?: {
    keyId: number;
    publicKey: Uint8Array;
  };
}

export interface SignalSession {
  remoteFingerprint: string;
  sessionData: Uint8Array; // Encrypted session state
}

// Utility types
export type HexString = string;
export type Base64String = string;

// Error types
export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

// Constants
export const CONSTANTS = {
  PBKDF2_ITERATIONS: 100000,
  SALT_BYTES: 16,
  NONCE_BYTES: 24,
  KEY_BYTES: 32,
  SESSION_ID_BYTES: 16,
  FINGERPRINT_BYTES: 32,
} as const;

// Type guards
export function isEncryptedMessage(obj: unknown): obj is EncryptedMessage {
  const msg = obj as EncryptedMessage;
  return (
    !!msg &&
    typeof msg.room_id === "string" &&
    typeof msg.sender_fingerprint === "string" &&
    msg.ciphertext instanceof Uint8Array &&
    msg.header instanceof Uint8Array
  );
}

export function isKeyPair(obj: unknown): obj is KeyPair {
  const pair = obj as KeyPair;
  return (
    !!pair &&
    pair.publicKey instanceof Uint8Array &&
    pair.privateKey instanceof Uint8Array
  );
} 