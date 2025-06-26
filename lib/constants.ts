/**
 * Global constants for AnoChat
 */

// Crypto constants
export const CRYPTO = {
  PBKDF2_ITERATIONS: 100000,
  SALT_BYTES: 16,
  NONCE_BYTES: 24,
  KEY_BYTES: 32,
  SESSION_ID_BYTES: 16,
  FINGERPRINT_BYTES: 32,
  PUBLIC_KEY_BYTES: 32,
  PRIVATE_KEY_BYTES: 32,
  
  // Argon2 password hashing parameters (for crypto_pwhash)
  // Using INTERACTIVE parameters for good balance of security and performance
  // INTERACTIVE: ~64MB RAM, ~1 second on typical CPU
  PWHASH_SALTBYTES: 16,  // crypto_pwhash_SALTBYTES
  PWHASH_OPSLIMIT: 2,    // crypto_pwhash_OPSLIMIT_INTERACTIVE 
  PWHASH_MEMLIMIT: 67108864, // crypto_pwhash_MEMLIMIT_INTERACTIVE (64MB)
  PWHASH_ALG: 2,         // crypto_pwhash_ALG_ARGON2ID13 (most secure)
} as const;

// Storage constants
export const STORAGE = {
  SESSION_ID_KEY: 'anochat_session_id',
  DATABASE_NAME: 'AnoChat',
  DATABASE_VERSION: 1,
} as const;

// UI constants
export const UI = {
  MESSAGE_MAX_LENGTH: 5000,
  ROOM_NAME_MAX_LENGTH: 50,
  PASSPHRASE_MIN_LENGTH: 8,
  BURN_CONFIRMATION_TEXT: 'Are you sure you want to delete all data? This cannot be undone!',
} as const;

// Time constants (in milliseconds)
export const TIME = {
  SESSION_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
  MESSAGE_RETRY_DELAY: 1000, // 1 second
  TYPING_INDICATOR_TIMEOUT: 3000, // 3 seconds
  AUTO_BURN_TIMEOUT: 30 * 60 * 1000, // 30 minutes
} as const;

// Regex patterns
export const PATTERNS = {
  UUID_V4: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  HEX_STRING: /^[0-9a-f]+$/i,
  BASE64: /^[A-Za-z0-9+/]*={0,2}$/,
} as const;

// Error messages
export const ERRORS = {
  CRYPTO_NOT_INITIALIZED: 'Sodium not initialized. Call initCrypto() first.',
  INVALID_PASSPHRASE: 'Failed to decrypt private key. Invalid passphrase?',
  IDENTITY_NOT_FOUND: 'Identity not found',
  ROOM_NOT_FOUND: 'Room not found',
  STORAGE_FAILED: 'Storage operation failed',
} as const; 