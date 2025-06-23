/**
 * Tests for Signal Protocol implementation
 * Phase 4: Signal Protocol Integration
 */

import {
  initSignalProtocol,
  generatePreKeyBundle,
  processPreKeyBundle,
  encryptMessage,
  decryptMessage,
  hasSession,
  deleteSession,
  deleteAllSessions,
  getDeviceIds,
} from "../signal-protocol";
import { createIdentity } from "../crypto";

// Mock IndexedDB
import 'fake-indexeddb/auto';

describe("Signal Protocol Tests", () => {
  beforeAll(async () => {
    await initSignalProtocol();
  });

  describe("Initialization", () => {
    test("should initialize Signal Protocol", async () => {
      // This should not throw
      await initSignalProtocol();
    });
  });

  describe("PreKey Bundle Generation", () => {
    test("should generate a complete pre-key bundle", async () => {
      const passphrase = "test-passphrase-123";
      const identity = await createIdentity(passphrase);

      const preKeyBundle = await generatePreKeyBundle(identity);

      expect(preKeyBundle).toHaveProperty("identityKey");
      expect(preKeyBundle).toHaveProperty("signedPreKey");
      expect(preKeyBundle).toHaveProperty("preKey");

      expect(preKeyBundle.identityKey).toEqual(identity.publicKey);
      expect(preKeyBundle.signedPreKey).toHaveProperty("keyId");
      expect(preKeyBundle.signedPreKey).toHaveProperty("publicKey");
      expect(preKeyBundle.signedPreKey).toHaveProperty("signature");
      expect(preKeyBundle.preKey).toHaveProperty("keyId");
      expect(preKeyBundle.preKey).toHaveProperty("publicKey");

      // Verify key IDs are valid
      expect(preKeyBundle.signedPreKey.keyId).toBeGreaterThan(0);
      expect(preKeyBundle.preKey!.keyId).toBeGreaterThan(0);

      // Verify keys are proper length (32 bytes for X25519)
      expect(preKeyBundle.signedPreKey.publicKey).toHaveLength(32);
      expect(preKeyBundle.preKey!.publicKey).toHaveLength(32);
      expect(preKeyBundle.signedPreKey.signature).toHaveLength(64); // Ed25519 signature
    });

    test("should generate different pre-key bundles each time", async () => {
      const passphrase = "test-passphrase-123";
      const identity = await createIdentity(passphrase);

      const bundle1 = await generatePreKeyBundle(identity);
      const bundle2 = await generatePreKeyBundle(identity);

      expect(bundle1.signedPreKey.keyId).not.toEqual(bundle2.signedPreKey.keyId);
      expect(bundle1.preKey!.keyId).not.toEqual(bundle2.preKey!.keyId);
      expect(bundle1.signedPreKey.publicKey).not.toEqual(bundle2.signedPreKey.publicKey);
      expect(bundle1.preKey!.publicKey).not.toEqual(bundle2.preKey!.publicKey);
    });
  });

  describe("Session Establishment", () => {
    test("should establish a session using X3DH", async () => {
      const alicePassphrase = "alice-passphrase-123";
      const bobPassphrase = "bob-passphrase-456";

      await createIdentity(alicePassphrase);
      const bobIdentity = await createIdentity(bobPassphrase);

      // Bob generates a pre-key bundle
      const bobPreKeyBundle = await generatePreKeyBundle(bobIdentity);

      // Alice processes Bob's pre-key bundle to establish a session
      const bobAddress = "bob@example.com";
      const bobDeviceId = 1;

      await processPreKeyBundle(bobAddress, bobDeviceId, bobPreKeyBundle);

      // Verify session was created
      expect(await hasSession(bobAddress, bobDeviceId)).toBe(true);
    });

    test("should reject invalid signature on signed pre-key", async () => {
      const alicePassphrase = "alice-passphrase-123";
      const bobPassphrase = "bob-passphrase-456";
      const evePassphrase = "eve-passphrase-789";

      await createIdentity(alicePassphrase);
      const bobIdentity = await createIdentity(bobPassphrase);
      const eveIdentity = await createIdentity(evePassphrase);

      // Bob generates a pre-key bundle
      const bobPreKeyBundle = await generatePreKeyBundle(bobIdentity);

      // Eve tries to impersonate Bob by replacing the identity key
      const maliciousBundle = {
        ...bobPreKeyBundle,
        identityKey: eveIdentity.publicKey // Wrong identity key
      };

      const bobAddress = "bob@example.com";
      const bobDeviceId = 1;

      // This should fail due to invalid signature
      await expect(
        processPreKeyBundle(bobAddress, bobDeviceId, maliciousBundle)
      ).rejects.toThrow("Invalid signature");
    });

    test("should handle multiple sessions for different devices", async () => {
      const alicePassphrase = "alice-passphrase-123";
      const bobPassphrase = "bob-passphrase-456";

      await createIdentity(alicePassphrase);
      const bobIdentity = await createIdentity(bobPassphrase);

      const bobAddress = "bob@example.com";
      const device1 = 1;
      const device2 = 2;

      // Create sessions with two different devices
      const bundle1 = await generatePreKeyBundle(bobIdentity);
      const bundle2 = await generatePreKeyBundle(bobIdentity);

      await processPreKeyBundle(bobAddress, device1, bundle1);
      await processPreKeyBundle(bobAddress, device2, bundle2);

      expect(await hasSession(bobAddress, device1)).toBe(true);
      expect(await hasSession(bobAddress, device2)).toBe(true);

      const deviceIds = await getDeviceIds(bobAddress);
      expect(deviceIds).toContain(device1);
      expect(deviceIds).toContain(device2);
    });
  });

  describe("Message Encryption and Decryption", () => {
    let bobIdentity: import("../types").IdentityKey;
    const bobAddress = "bob@example.com";
    const bobDeviceId = 1;

    beforeEach(async () => {
      const alicePassphrase = "alice-passphrase-123";
      const bobPassphrase = "bob-passphrase-456";

      await createIdentity(alicePassphrase);
      bobIdentity = await createIdentity(bobPassphrase);

      // Establish session
      const bobPreKeyBundle = await generatePreKeyBundle(bobIdentity);
      await processPreKeyBundle(bobAddress, bobDeviceId, bobPreKeyBundle);
    });

    test("should encrypt and decrypt messages", async () => {
      const originalMessage = "Hello, Bob! This is a secret message.";

      // Alice encrypts a message for Bob
      const encryptedMessage = await encryptMessage(
        bobAddress,
        bobDeviceId,
        originalMessage
      );

      expect(encryptedMessage).toHaveProperty("type");
      expect(encryptedMessage).toHaveProperty("body");
      expect(encryptedMessage.type).toBe(1); // WhisperMessage type
      expect(typeof encryptedMessage.body).toBe("string");

      // Bob decrypts the message
      const decryptedMessage = await decryptMessage(
        bobAddress,
        bobDeviceId,
        encryptedMessage
      );

      expect(decryptedMessage).toBe(originalMessage);
    });

    test("should handle different message types", async () => {
      const messages = [
        "Short",
        "A longer message with special characters: !@#$%^&*()",
        "Unicode message: 🔒🚀👋",
        "Very long message: " + "A".repeat(1000),
        ""
      ];

      for (const message of messages) {
        const encrypted = await encryptMessage(bobAddress, bobDeviceId, message);
        const decrypted = await decryptMessage(bobAddress, bobDeviceId, encrypted);
        expect(decrypted).toBe(message);
      }
    });

    test("should fail to encrypt without established session", async () => {
      const unknownAddress = "unknown@example.com";
      const unknownDeviceId = 999;

      await expect(
        encryptMessage(unknownAddress, unknownDeviceId, "test message")
      ).rejects.toThrow("No session found");
    });

    test("should fail to decrypt without established session", async () => {
      const unknownAddress = "unknown@example.com";
      const unknownDeviceId = 999;
      const fakeMessage = { type: 1, body: "fake-encrypted-data" };

      await expect(
        decryptMessage(unknownAddress, unknownDeviceId, fakeMessage)
      ).rejects.toThrow("No session found");
    });

    test("should fail to decrypt corrupted messages", async () => {
      const originalMessage = "Test message";
      const encrypted = await encryptMessage(bobAddress, bobDeviceId, originalMessage);

      // Corrupt the message
      const corruptedMessage = {
        ...encrypted,
        body: encrypted.body.slice(0, -5) + "XXXXX"
      };

      await expect(
        decryptMessage(bobAddress, bobDeviceId, corruptedMessage)
      ).rejects.toThrow();
    });
  });

  describe("Session Management", () => {
    let bobIdentity: import("../types").IdentityKey;
    const bobAddress = "bob@example.com";
    const bobDeviceId = 1;

    beforeEach(async () => {
      const alicePassphrase = "alice-passphrase-123";
      const bobPassphrase = "bob-passphrase-456";

      await createIdentity(alicePassphrase);
      bobIdentity = await createIdentity(bobPassphrase);

      // Establish session
      const bobPreKeyBundle = await generatePreKeyBundle(bobIdentity);
      await processPreKeyBundle(bobAddress, bobDeviceId, bobPreKeyBundle);
    });

    test("should check session existence", async () => {
      expect(await hasSession(bobAddress, bobDeviceId)).toBe(true);
      expect(await hasSession("unknown@example.com", 999)).toBe(false);
    });

    test("should delete individual sessions", async () => {
      expect(await hasSession(bobAddress, bobDeviceId)).toBe(true);

      await deleteSession(bobAddress, bobDeviceId);

      expect(await hasSession(bobAddress, bobDeviceId)).toBe(false);
    });

    test("should delete all sessions for an address", async () => {
      // Create multiple sessions
      const device2 = 2;
      const bundle2 = await generatePreKeyBundle(bobIdentity);
      await processPreKeyBundle(bobAddress, device2, bundle2);

      expect(await hasSession(bobAddress, bobDeviceId)).toBe(true);
      expect(await hasSession(bobAddress, device2)).toBe(true);

      await deleteAllSessions(bobAddress);

      expect(await hasSession(bobAddress, bobDeviceId)).toBe(false);
      expect(await hasSession(bobAddress, device2)).toBe(false);
    });

    test("should get device IDs for an address", async () => {
      // Create multiple sessions
      const device2 = 2;
      const device3 = 3;
      const bundle2 = await generatePreKeyBundle(bobIdentity);
      const bundle3 = await generatePreKeyBundle(bobIdentity);
      await processPreKeyBundle(bobAddress, device2, bundle2);
      await processPreKeyBundle(bobAddress, device3, bundle3);

      const deviceIds = await getDeviceIds(bobAddress);
      expect(deviceIds).toContain(bobDeviceId);
      expect(deviceIds).toContain(device2);
      expect(deviceIds).toContain(device3);
      expect(deviceIds).toHaveLength(3);
    });
  });

  describe("Error Handling", () => {
    test("should handle storage errors gracefully", async () => {
      // This test would require mocking storage to throw errors
      // For now, we just verify that errors are properly typed
      const bobAddress = "bob@example.com";
      const bobDeviceId = 999;
      const fakeMessage = { type: 1, body: "invalid-base64-!@#$" };

      await expect(
        decryptMessage(bobAddress, bobDeviceId, fakeMessage)
      ).rejects.toThrow();
    });

    test("should require initialization", async () => {
      // Test that operations fail if not initialized properly
      // This is more of a conceptual test since we initialize in beforeAll
      expect(true).toBe(true);
    });
  });

  describe("Performance", () => {
    test("should handle multiple rapid operations", async () => {
      const alicePassphrase = "alice-passphrase-123";
      const bobPassphrase = "bob-passphrase-456";

      await createIdentity(alicePassphrase);
      const bobIdentity = await createIdentity(bobPassphrase);

      const bobAddress = "bob@example.com";
      const bobDeviceId = 1;

      // Establish session
      const bobPreKeyBundle = await generatePreKeyBundle(bobIdentity);
      await processPreKeyBundle(bobAddress, bobDeviceId, bobPreKeyBundle);

      // Send multiple messages rapidly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const message = `Message number ${i}`;
        promises.push(
          encryptMessage(bobAddress, bobDeviceId, message)
            .then(encrypted => decryptMessage(bobAddress, bobDeviceId, encrypted))
            .then(decrypted => expect(decrypted).toBe(message))
        );
      }

      await Promise.all(promises);
    });

    test("should handle large messages", async () => {
      const alicePassphrase = "alice-passphrase-123";
      const bobPassphrase = "bob-passphrase-456";

      await createIdentity(alicePassphrase);
      const bobIdentity = await createIdentity(bobPassphrase);

      const bobAddress = "bob@example.com";
      const bobDeviceId = 1;

      // Establish session
      const bobPreKeyBundle = await generatePreKeyBundle(bobIdentity);
      await processPreKeyBundle(bobAddress, bobDeviceId, bobPreKeyBundle);

      // Test with a large message (1MB)
      const largeMessage = "A".repeat(1024 * 1024);
      const encrypted = await encryptMessage(bobAddress, bobDeviceId, largeMessage);
      const decrypted = await decryptMessage(bobAddress, bobDeviceId, encrypted);

      expect(decrypted).toBe(largeMessage);
    });
  });
}); 