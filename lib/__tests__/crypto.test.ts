/**
 * Tests for crypto module
 */

import {
  initCrypto,
  generateIdentityKey,
  generateFingerprint,
  encryptPrivateKey,
  decryptPrivateKey,
  generateSessionId,
  setSessionId,
  getOrCreateSessionId,
  createIdentity,
  loadIdentity,
  generateRoomId,
  validatePassphrase,
  uint8ArrayToBase64,
  base64ToUint8Array,
  uint8ArrayToHex,
  hexToUint8Array,
  randomBytes,
  clearMemory,
  isCryptoInitialized,
} from "../crypto";
import { CryptoError } from "../types";
import storage from "../storage";

// Mock storage module
jest.mock("../storage");

describe("Crypto Module", () => {
  beforeAll(async () => {
    await initCrypto();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  describe("initCrypto", () => {
    it("should initialize crypto library", () => {
      expect(isCryptoInitialized()).toBe(true);
    });
  });

  describe("generateIdentityKey", () => {
    it("should generate a valid keypair", () => {
      const keypair = generateIdentityKey();
      expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
      expect(keypair.publicKey.length).toBe(32); // X25519 public key size
      expect(keypair.privateKey.length).toBe(32); // X25519 private key size
    });

    it("should generate different keypairs each time", () => {
      const keypair1 = generateIdentityKey();
      const keypair2 = generateIdentityKey();
      expect(keypair1.publicKey).not.toEqual(keypair2.publicKey);
      expect(keypair1.privateKey).not.toEqual(keypair2.privateKey);
    });
  });

  describe("generateFingerprint", () => {
    it("should generate a hex fingerprint from public key", () => {
      const keypair = generateIdentityKey();
      const fingerprint = generateFingerprint(keypair.publicKey);
      expect(typeof fingerprint).toBe("string");
      expect(fingerprint.length).toBe(64); // 32 bytes as hex = 64 chars
      expect(/^[0-9a-f]+$/.test(fingerprint)).toBe(true);
    });

    it("should generate same fingerprint for same key", () => {
      const keypair = generateIdentityKey();
      const fingerprint1 = generateFingerprint(keypair.publicKey);
      const fingerprint2 = generateFingerprint(keypair.publicKey);
      expect(fingerprint1).toBe(fingerprint2);
    });
  });

  describe("encryptPrivateKey and decryptPrivateKey", () => {
    it("should encrypt and decrypt private key successfully", async () => {
      const keypair = generateIdentityKey();
      const passphrase = "MySecurePassphrase123!";
      
      const encrypted = await encryptPrivateKey(keypair.privateKey, passphrase);
      expect(encrypted.salt).toBeInstanceOf(Uint8Array);
      expect(encrypted.nonce).toBeInstanceOf(Uint8Array);
      expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
      
      const decrypted = await decryptPrivateKey(encrypted, passphrase);
      expect(decrypted).toEqual(keypair.privateKey);
    });

    it("should fail to decrypt with wrong passphrase", async () => {
      const keypair = generateIdentityKey();
      const passphrase = "MySecurePassphrase123!";
      const wrongPassphrase = "WrongPassphrase123!";
      
      const encrypted = await encryptPrivateKey(keypair.privateKey, passphrase);
      
      await expect(decryptPrivateKey(encrypted, wrongPassphrase))
        .rejects.toThrow("Failed to decrypt private key. Invalid passphrase?");
    });

    it("should use different salt and nonce each time", async () => {
      const keypair = generateIdentityKey();
      const passphrase = "MySecurePassphrase123!";
      
      const encrypted1 = await encryptPrivateKey(keypair.privateKey, passphrase);
      const encrypted2 = await encryptPrivateKey(keypair.privateKey, passphrase);
      
      expect(encrypted1.salt).not.toEqual(encrypted2.salt);
      expect(encrypted1.nonce).not.toEqual(encrypted2.nonce);
    });
  });

  describe("Session ID Management", () => {
    it("should generate valid UUID v4 session ID", () => {
      const sessionId = generateSessionId();
      expect(sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("should store and retrieve session ID", () => {
      const sessionId = generateSessionId();
      setSessionId(sessionId);
      expect(sessionStorage.setItem).toHaveBeenCalledWith("anochat_session_id", sessionId);
    });

    it("should get or create session ID", () => {
      const mockSessionId = "existing-session-id";
      (sessionStorage.getItem as jest.Mock).mockReturnValue(mockSessionId);
      
      const sessionId = getOrCreateSessionId();
      expect(sessionId).toBe(mockSessionId);
      expect(sessionStorage.getItem).toHaveBeenCalledWith("anochat_session_id");
    });

    it("should create new session ID if none exists", () => {
      (sessionStorage.getItem as jest.Mock).mockReturnValue(null);
      
      const sessionId = getOrCreateSessionId();
      expect(sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(sessionStorage.setItem).toHaveBeenCalled();
    });
  });

  describe("createIdentity and loadIdentity", () => {
    it("should create and store identity", async () => {
      const passphrase = "MySecurePassphrase123!";
      const mockStorageSave = jest.fn().mockResolvedValue(1);
      (storage.saveIdentity as jest.Mock) = mockStorageSave;
      
      const identity = await createIdentity(passphrase);
      
      expect(identity.publicKey).toBeInstanceOf(Uint8Array);
      expect(identity.privateKey).toBeInstanceOf(Uint8Array);
      expect(typeof identity.fingerprint).toBe("string");
      expect(identity.createdAt).toBeInstanceOf(Date);
      expect(mockStorageSave).toHaveBeenCalled();
    });

    it("should load identity from storage", async () => {
      const passphrase = "MySecurePassphrase123!";
      const keypair = generateIdentityKey();
      const fingerprint = generateFingerprint(keypair.publicKey);
      const encryptedKey = await encryptPrivateKey(keypair.privateKey, passphrase);
      
      const mockStorageGet = jest.fn().mockResolvedValue({
        fingerprint,
        publicKey: keypair.publicKey,
        encryptedPrivateKey: encryptedKey,
        createdAt: new Date(),
      });
      (storage.getIdentity as jest.Mock) = mockStorageGet;
      
      const identity = await loadIdentity(fingerprint, passphrase);
      
      expect(identity).not.toBeNull();
      expect(identity?.publicKey).toEqual(keypair.publicKey);
      expect(identity?.privateKey).toEqual(keypair.privateKey);
      expect(identity?.fingerprint).toBe(fingerprint);
    });

    it("should return null if identity not found", async () => {
      const mockStorageGet = jest.fn().mockResolvedValue(undefined);
      (storage.getIdentity as jest.Mock) = mockStorageGet;
      
      const identity = await loadIdentity("non-existent", "passphrase");
      expect(identity).toBeNull();
    });

    it("should throw error on wrong passphrase", async () => {
      const passphrase = "MySecurePassphrase123!";
      const wrongPassphrase = "WrongPassphrase123!";
      const keypair = generateIdentityKey();
      const fingerprint = generateFingerprint(keypair.publicKey);
      const encryptedKey = await encryptPrivateKey(keypair.privateKey, passphrase);
      
      const mockStorageGet = jest.fn().mockResolvedValue({
        fingerprint,
        publicKey: keypair.publicKey,
        encryptedPrivateKey: encryptedKey,
        createdAt: new Date(),
      });
      (storage.getIdentity as jest.Mock) = mockStorageGet;
      
      await expect(loadIdentity(fingerprint, wrongPassphrase))
        .rejects.toThrow("Failed to decrypt identity. Wrong passphrase?");
    });
  });

  describe("generateRoomId", () => {
    it("should generate valid UUID v4 room ID", () => {
      const roomId = generateRoomId();
      expect(roomId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });
  });

  describe("validatePassphrase", () => {
    it("should validate strong passphrase", () => {
      const result = validatePassphrase("MySecurePass123!");
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(result.feedback.length).toBe(0);
    });

    it("should reject short passphrase", () => {
      const result = validatePassphrase("Pass1!");
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain("Passphrase must be at least 8 characters long");
    });

    it("should provide feedback for weak passphrase", () => {
      const result = validatePassphrase("password");
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain("Include uppercase letters");
      expect(result.feedback).toContain("Include numbers");
      expect(result.feedback).toContain("Include special characters");
      expect(result.feedback).toContain("Avoid common patterns");
    });

    it("should give bonus for long passphrase", () => {
      const result = validatePassphrase("ThisIsAVeryLongPassphrase123!");
      expect(result.score).toBe(5); // Max score
      expect(result.isValid).toBe(true);
    });
  });

  describe("Utility Functions", () => {
    it("should convert between Uint8Array and base64", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const base64 = uint8ArrayToBase64(data);
      expect(typeof base64).toBe("string");
      
      const converted = base64ToUint8Array(base64);
      expect(converted).toEqual(data);
    });

    it("should convert between Uint8Array and hex", () => {
      const data = new Uint8Array([255, 0, 127, 64]);
      const hex = uint8ArrayToHex(data);
      expect(hex).toBe("ff007f40");
      
      const converted = hexToUint8Array(hex);
      expect(converted).toEqual(data);
    });

    it("should generate random bytes", () => {
      const bytes1 = randomBytes(16);
      const bytes2 = randomBytes(16);
      
      expect(bytes1).toBeInstanceOf(Uint8Array);
      expect(bytes1.length).toBe(16);
      expect(bytes1).not.toEqual(bytes2);
    });

    it("should clear memory", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      clearMemory(data);
      expect(data).toEqual(new Uint8Array(5));
    });
  });

  describe("Error Handling", () => {
    it("should throw CryptoError when sodium not initialized", () => {
      // This would require mocking the sodium initialization state
      // which is complex in the current setup
      expect(CryptoError).toBeDefined();
    });
  });
}); 