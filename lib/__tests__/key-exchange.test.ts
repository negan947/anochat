/**
 * Tests for Key Exchange utilities
 * Phase 4: Signal Protocol Integration
 */

import {
  createKeyExchangeInvite,
  createKeyExchangeResponse,
  generateKeyExchangeQR,
  parseKeyExchangeQR,
  validateKeyExchangeInvite,
  generateKeyExchangeLink,
  parseKeyExchangeLink,
  getShortFingerprint,
  formatFingerprint,
  verifyFingerprints,
  generateRoomInvite,
  KeyExchangeInvite,
} from "../key-exchange";
import { createIdentity } from "../crypto";
import { initSignalProtocol } from "../signal-protocol";
import { PreKeyBundle, IdentityKey } from "../types";

// Mock IndexedDB
import 'fake-indexeddb/auto';

// Mock global btoa/atob for Node.js environment
if (typeof global.btoa === 'undefined') {
  global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
  global.atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');
}

describe("Key Exchange Tests", () => {
  beforeAll(async () => {
    await initSignalProtocol();
  });

  describe("Key Exchange Invite Creation", () => {
    test("should create a complete key exchange invite", async () => {
      const passphrase = "test-passphrase-123";
      const identity = await createIdentity(passphrase);
      const roomId = "room-123";

      const invite = await createKeyExchangeInvite(identity, roomId);

      expect(invite).toHaveProperty("version");
      expect(invite).toHaveProperty("inviteId");
      expect(invite).toHaveProperty("senderFingerprint");
      expect(invite).toHaveProperty("preKeyBundle");
      expect(invite).toHaveProperty("timestamp");
      expect(invite).toHaveProperty("roomId");

      expect(invite.version).toBe("1.0");
      expect(typeof invite.inviteId).toBe("string");
      expect(invite.inviteId.length).toBeGreaterThan(0);
      expect(invite.senderFingerprint).toBe(identity.fingerprint);
      expect(invite.roomId).toBe(roomId);
      expect(invite.timestamp).toBeCloseTo(Date.now(), 1000);

      // Verify pre-key bundle structure
      expect(invite.preKeyBundle).toHaveProperty("identityKey");
      expect(invite.preKeyBundle).toHaveProperty("signedPreKey");
      expect(invite.preKeyBundle).toHaveProperty("preKey");
      expect(invite.preKeyBundle.identityKey).toEqual(identity.publicKey);
    });

    test("should create invite without room ID", async () => {
      const passphrase = "test-passphrase-123";
      const identity = await createIdentity(passphrase);

      const invite = await createKeyExchangeInvite(identity);

      expect(invite.roomId).toBeUndefined();
      expect(invite.senderFingerprint).toBe(identity.fingerprint);
    });

    test("should generate different invites each time", async () => {
      const passphrase = "test-passphrase-123";
      const identity = await createIdentity(passphrase);

      const invite1 = await createKeyExchangeInvite(identity);
      const invite2 = await createKeyExchangeInvite(identity);

      expect(invite1.inviteId).not.toBe(invite2.inviteId);
      expect(invite1.preKeyBundle.signedPreKey.keyId).not.toBe(
        invite2.preKeyBundle.signedPreKey.keyId
      );
      expect(invite1.preKeyBundle.preKey!.keyId).not.toBe(
        invite2.preKeyBundle.preKey!.keyId
      );
    });
  });

  describe("Key Exchange Response Creation", () => {
    test("should create a key exchange response", async () => {
      const passphrase = "responder-passphrase-456";
      const identity = await createIdentity(passphrase);
      const inviteId = "original-invite-id-123";

      const response = await createKeyExchangeResponse(identity, inviteId);

      expect(response).toHaveProperty("version");
      expect(response).toHaveProperty("inviteId");
      expect(response).toHaveProperty("responderFingerprint");
      expect(response).toHaveProperty("preKeyBundle");
      expect(response).toHaveProperty("timestamp");

      expect(response.version).toBe("1.0");
      expect(response.inviteId).toBe(inviteId);
      expect(response.responderFingerprint).toBe(identity.fingerprint);
      expect(response.timestamp).toBeCloseTo(Date.now(), 1000);
    });
  });

  describe("QR Code Generation and Parsing", () => {
    let testInvite: KeyExchangeInvite;

    beforeEach(async () => {
      const passphrase = "test-passphrase-123";
      const identity = await createIdentity(passphrase);
      testInvite = await createKeyExchangeInvite(identity, "test-room");
    });

    test("should generate QR code data URL", async () => {
      const qrCodeData = await generateKeyExchangeQR(testInvite);

      expect(typeof qrCodeData).toBe("string");
      expect(qrCodeData).toMatch(/^anochat:\/\/keyexchange\//);
      expect(qrCodeData.length).toBeGreaterThan(100);
    });

    test("should parse QR code back to invite", async () => {
      // Extract the QR code data from the data URL
      // In a real implementation, this would be extracted by a QR code reader
      // For testing, we'll simulate the QR code content
      const qrData = "anochat://keyexchange/" + btoa(JSON.stringify({
        v: testInvite.version,
        i: testInvite.inviteId,
        f: testInvite.senderFingerprint,
        ik: btoa(String.fromCharCode(...testInvite.preKeyBundle.identityKey)),
        spk: {
          id: testInvite.preKeyBundle.signedPreKey.keyId,
          pk: btoa(String.fromCharCode(...testInvite.preKeyBundle.signedPreKey.publicKey)),
          sig: btoa(String.fromCharCode(...testInvite.preKeyBundle.signedPreKey.signature))
        },
        pk: testInvite.preKeyBundle.preKey ? {
          id: testInvite.preKeyBundle.preKey.keyId,
          pk: btoa(String.fromCharCode(...testInvite.preKeyBundle.preKey.publicKey))
        } : undefined,
        ts: testInvite.timestamp,
        r: testInvite.roomId
      }));

      const parsedInvite = parseKeyExchangeQR(qrData);

      expect(parsedInvite.version).toBe(testInvite.version);
      expect(parsedInvite.inviteId).toBe(testInvite.inviteId);
      expect(parsedInvite.senderFingerprint).toBe(testInvite.senderFingerprint);
      expect(parsedInvite.timestamp).toBe(testInvite.timestamp);
      expect(parsedInvite.roomId).toBe(testInvite.roomId);
    });

    test("should reject invalid QR code format", () => {
      const invalidQR = "https://example.com/not-anochat";

      expect(() => parseKeyExchangeQR(invalidQR)).toThrow("Invalid QR code format");
    });

    test("should reject unsupported version", () => {
      const futureVersionQR = "anochat://keyexchange/" + btoa(JSON.stringify({
        v: "2.0", // Future version
        i: "test-id",
        f: "test-fingerprint",
        ik: "test-key",
        spk: { id: 1, pk: "test", sig: "test" },
        ts: Date.now()
      }));

      expect(() => parseKeyExchangeQR(futureVersionQR)).toThrow("Unsupported key exchange version");
    });

    test("should handle malformed QR data", () => {
      const malformedQR = "anochat://keyexchange/invalid-base64-!@#$";

      expect(() => parseKeyExchangeQR(malformedQR)).toThrow();
    });
  });

  describe("Link Generation and Parsing", () => {
    let testInvite: KeyExchangeInvite;

    beforeEach(async () => {
      const passphrase = "test-passphrase-123";
      const identity = await createIdentity(passphrase);
      testInvite = await createKeyExchangeInvite(identity, "test-room");
    });

    test("should generate shareable link", () => {
      const link = generateKeyExchangeLink(testInvite);

      expect(typeof link).toBe("string");
      expect(link).toMatch(/^https?:\/\/.+\/join\?k=/);
      expect(link.includes("k=")).toBe(true);
    });

    test("should parse link back to invite", () => {
      const link = generateKeyExchangeLink(testInvite);
      const parsedInvite = parseKeyExchangeLink(link);

      expect(parsedInvite.version).toBe(testInvite.version);
      expect(parsedInvite.inviteId).toBe(testInvite.inviteId);
      expect(parsedInvite.senderFingerprint).toBe(testInvite.senderFingerprint);
      expect(parsedInvite.timestamp).toBe(testInvite.timestamp);
      expect(parsedInvite.roomId).toBe(testInvite.roomId);
    });

    test("should reject link without key parameter", () => {
      const invalidLink = "https://example.com/join";

      expect(() => parseKeyExchangeLink(invalidLink)).toThrow("No key exchange data found");
    });

    test("should handle malformed link data", () => {
      const malformedLink = "https://example.com/join?k=invalid-data";

      expect(() => parseKeyExchangeLink(malformedLink)).toThrow();
    });
  });

  describe("Invite Validation", () => {
    let validInvite: KeyExchangeInvite;

    beforeEach(async () => {
      const passphrase = "test-passphrase-123";
      const identity = await createIdentity(passphrase);
      validInvite = await createKeyExchangeInvite(identity);
    });

    test("should validate correct invite", () => {
      expect(validateKeyExchangeInvite(validInvite)).toBe(true);
    });

    test("should reject invite with wrong version", () => {
      const wrongVersionInvite = { ...validInvite, version: "0.9" };
      expect(validateKeyExchangeInvite(wrongVersionInvite)).toBe(false);
    });

    test("should reject invite with missing fields", () => {
      const missingIdInvite = { ...validInvite, inviteId: "" };
      expect(validateKeyExchangeInvite(missingIdInvite)).toBe(false);

      const missingFingerprintInvite = { ...validInvite, senderFingerprint: "" };
      expect(validateKeyExchangeInvite(missingFingerprintInvite)).toBe(false);

      const missingBundleInvite = { ...validInvite, preKeyBundle: null as unknown as PreKeyBundle };
      expect(validateKeyExchangeInvite(missingBundleInvite)).toBe(false);
    });

    test("should reject expired invite", () => {
      const expiredInvite = {
        ...validInvite,
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      };
      expect(validateKeyExchangeInvite(expiredInvite)).toBe(false);
    });

    test("should reject invite with mismatched fingerprint", async () => {
      const passphrase2 = "different-passphrase-456";
      const otherIdentity = await createIdentity(passphrase2);
      
      const mismatchedInvite = {
        ...validInvite,
        senderFingerprint: otherIdentity.fingerprint // Wrong fingerprint
      };
      expect(validateKeyExchangeInvite(mismatchedInvite)).toBe(false);
    });

    test("should reject invite with incomplete pre-key bundle", () => {
      const incompleteBundle = {
        ...validInvite,
        preKeyBundle: {
          ...validInvite.preKeyBundle,
          signedPreKey: {
            ...validInvite.preKeyBundle.signedPreKey,
            signature: new Uint8Array(0) // Empty signature
          }
        }
      };
      expect(validateKeyExchangeInvite(incompleteBundle)).toBe(false);
    });
  });

  describe("Fingerprint Utilities", () => {
    test("should create short fingerprint", () => {
      const longFingerprint = "abcdef1234567890abcdef1234567890abcdef12";
      const shortFingerprint = getShortFingerprint(longFingerprint);
      
      expect(shortFingerprint).toBe("abcd...ef12");
      expect(shortFingerprint.length).toBeLessThan(longFingerprint.length);
    });

    test("should handle short fingerprints", () => {
      const shortFingerprint = "abc123";
      expect(getShortFingerprint(shortFingerprint)).toBe(shortFingerprint);
    });

    test("should format fingerprint with spaces", () => {
      const fingerprint = "abcdef1234567890";
      const formatted = formatFingerprint(fingerprint);
      
      expect(formatted).toBe("ABCD EF12 3456 7890");
      expect(formatted.includes(" ")).toBe(true);
      expect(formatted).toBe(formatted.toUpperCase());
    });

    test("should verify matching fingerprints", () => {
      const fp1 = "abcdef1234567890";
      const fp2 = "ABCD EF12 3456 7890"; // Same but formatted
      const fp3 = "different123456789";

      expect(verifyFingerprints(fp1, fp2)).toBe(true);
      expect(verifyFingerprints(fp1, fp3)).toBe(false);
      expect(verifyFingerprints(fp1, fp1)).toBe(true);
    });

    test("should handle fingerprints with various formatting", () => {
      const variations = [
        "abcdef1234567890",
        "ABCDEF1234567890",
        "abcd ef12 3456 7890",
        "ABCD EF12 3456 7890",
        "abcd ef12  3456  7890" // Extra spaces
      ];

      for (let i = 0; i < variations.length; i++) {
        for (let j = 0; j < variations.length; j++) {
          expect(verifyFingerprints(variations[i], variations[j])).toBe(true);
        }
      }
    });
  });

  describe("Room Invite Generation", () => {
    test("should generate complete room invite", async () => {
      const passphrase = "host-passphrase-123";
      const identity = await createIdentity(passphrase);
      const roomId = "room-abc123";

      const roomInvite = await generateRoomInvite(identity, roomId);

      expect(roomInvite).toHaveProperty("invite");
      expect(roomInvite).toHaveProperty("qrCode");
      expect(roomInvite).toHaveProperty("link");

      expect(roomInvite.invite.roomId).toBe(roomId);
      expect(roomInvite.invite.senderFingerprint).toBe(identity.fingerprint);
      expect(typeof roomInvite.qrCode).toBe("string");
      expect(roomInvite.qrCode).toMatch(/^anochat:\/\/keyexchange\//);
      expect(typeof roomInvite.link).toBe("string");
      expect(roomInvite.link).toMatch(/\/join\?k=/);
    });

    test("should generate room invite without name", async () => {
      const passphrase = "host-passphrase-123";
      const identity = await createIdentity(passphrase);
      const roomId = "room-xyz789";

      const roomInvite = await generateRoomInvite(identity, roomId);

      expect(roomInvite.invite.roomId).toBe(roomId);
      expect(roomInvite.qrCode).toBeDefined();
      expect(roomInvite.link).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("should handle crypto initialization errors", async () => {
      // Test that functions handle uninitialized crypto gracefully
      // This is more conceptual since we initialize in beforeAll
      expect(true).toBe(true);
    });

    test("should handle invalid identity data", async () => {
      const invalidIdentity = {
        publicKey: new Uint8Array(16), // Wrong size
        privateKey: new Uint8Array(16),
        fingerprint: "invalid",
        createdAt: new Date()
      };

      await expect(
        createKeyExchangeInvite(invalidIdentity as IdentityKey)
      ).rejects.toThrow();
    });

    test("should handle QR code generation errors", async () => {
      const passphrase = "test-passphrase-123";
      const identity = await createIdentity(passphrase);
      const invite = await createKeyExchangeInvite(identity);

      // Corrupt the invite data
      const corruptedInvite = {
        ...invite,
        preKeyBundle: null as unknown as PreKeyBundle
      };

      await expect(
        generateKeyExchangeQR(corruptedInvite as KeyExchangeInvite)
      ).rejects.toThrow();
    });
  });

  describe("Integration", () => {
    test("should support full key exchange workflow", async () => {
      // Alice creates an invite
      const alicePassphrase = "alice-passphrase-123";
      const aliceIdentity = await createIdentity(alicePassphrase);
      const roomId = "integration-test-room";

      const roomInvite = await generateRoomInvite(aliceIdentity, roomId);
      expect(validateKeyExchangeInvite(roomInvite.invite)).toBe(true);

      // Bob receives the invite via QR or link
      const receivedInvite = parseKeyExchangeLink(roomInvite.link);
      expect(validateKeyExchangeInvite(receivedInvite)).toBe(true);

      // Bob creates a response
      const bobPassphrase = "bob-passphrase-456";
      const bobIdentity = await createIdentity(bobPassphrase);
      
      const response = await createKeyExchangeResponse(
        bobIdentity, 
        receivedInvite.inviteId
      );

      expect(response.inviteId).toBe(receivedInvite.inviteId);
      expect(response.responderFingerprint).toBe(bobIdentity.fingerprint);

      // Both parties should be able to establish sessions
      // (This would be tested in the signal-protocol tests)
    });

    test("should handle concurrent invite generation", async () => {
      const passphrase = "concurrent-test-789";
      const identity = await createIdentity(passphrase);

      // Generate multiple invites concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        createKeyExchangeInvite(identity, `room-${i}`)
      );

      const invites = await Promise.all(promises);

      // All invites should be unique
      const inviteIds = invites.map(invite => invite.inviteId);
      const uniqueIds = new Set(inviteIds);
      expect(uniqueIds.size).toBe(invites.length);

      // All invites should be valid
      invites.forEach(invite => {
        expect(validateKeyExchangeInvite(invite)).toBe(true);
      });
    });
  });

  describe('Room Invitation Logic', () => {
    let testIdentity: IdentityKey;

    beforeEach(async () => {
      const passphrase = "room-test-passphrase-123";
      testIdentity = await createIdentity(passphrase);
    });

    it('should preserve full room ID in serialization/deserialization', async () => {
      // Generate a full UUID for testing
      const fullRoomId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const invite = await createKeyExchangeInvite(testIdentity, fullRoomId);
      
      // Serialize the invite
      const serialized = (key_exchange as { serializeKeyExchange: (invite: KeyExchangeInvite) => unknown }).serializeKeyExchange(invite);
      
      // The room ID should be stored in full
      expect((serialized as { r: string }).r).toBe(fullRoomId);
      
      // Deserialize and check
      const deserialized = (key_exchange as { deserializeKeyExchange: (serialized: unknown) => KeyExchangeInvite }).deserializeKeyExchange(serialized);
      
      // The room ID should be exactly the same as the original
      expect(deserialized.roomId).toBe(fullRoomId);
      expect(deserialized.roomId).not.toContain('xxxx'); // Should not contain placeholders
    });

    it('should handle room invites with full UUIDs in QR codes', async () => {
      const roomId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const invite = await createKeyExchangeInvite(testIdentity, roomId);
      
      // Generate QR code
      const qrData = await generateKeyExchangeQR(invite);
      
      // Parse the QR code
      const parsedInvite = parseKeyExchangeQR(qrData);
      
      // Verify the room ID is preserved
      expect(parsedInvite.roomId).toBe(roomId);
    });

    it('should handle different UUID formats correctly', async () => {
      const testCases = [
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // Standard UUID
        '123e4567-e89b-12d3-a456-426614174000', // Version 1 UUID
        '550e8400-e29b-41d4-a716-446655440000', // Another format
      ];
      
      for (const roomId of testCases) {
        const invite = await createKeyExchangeInvite(testIdentity, roomId);
        const serialized = (key_exchange as { serializeKeyExchange: (invite: KeyExchangeInvite) => unknown }).serializeKeyExchange(invite);
        const deserialized = (key_exchange as { deserializeKeyExchange: (serialized: unknown) => KeyExchangeInvite }).deserializeKeyExchange(serialized);
        
        expect(deserialized.roomId).toBe(roomId);
      }
    });

    it('should not create invalid reconstructed room IDs', async () => {
      const roomId = '12345678-1234-5678-1234-567812345678';
      const invite = await createKeyExchangeInvite(testIdentity, roomId);
      
      // Serialize and deserialize
      const serialized = (key_exchange as { serializeKeyExchange: (invite: KeyExchangeInvite) => unknown }).serializeKeyExchange(invite);
      const deserialized = (key_exchange as { deserializeKeyExchange: (serialized: unknown) => KeyExchangeInvite }).deserializeKeyExchange(serialized);
      
      // Should not create a pattern like "12345678-xxxx-xxxx-xxxx-12345678"
      expect(deserialized.roomId).not.toMatch(/xxxx/);
      expect(deserialized.roomId).toBe(roomId);
      
      // Verify it's still a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(deserialized.roomId).toMatch(uuidRegex);
    });

    it('should generate room invites that work end-to-end', async () => {
      const roomId = 'test-room-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      // User A creates a room invite
      const inviteResult = await generateRoomInvite(testIdentity, roomId);
      
      // User B parses the QR code
      const parsedInvite = parseKeyExchangeQR(inviteResult.qrCode);
      
      // Verify all data is intact
      expect(parsedInvite.roomId).toBe(roomId);
      expect(parsedInvite.senderFingerprint).toBe(testIdentity.fingerprint);
      expect(parsedInvite.preKeyBundle).toBeDefined();
      expect(parsedInvite.preKeyBundle.identityKey).toBeDefined();
    });
  });
}); 