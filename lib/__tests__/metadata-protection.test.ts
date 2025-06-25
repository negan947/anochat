/**
 * Tests for Metadata Protection
 */

import { metadataProtection, PaddingScheme } from '../metadata-protection';
import { EncryptedMessage } from '../types';

// Mock crypto API
const mockCrypto = {
  getRandomValues: jest.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
  subtle: {
    digest: jest.fn(async (algorithm: string, data: Uint8Array) => {
      // Mock SHA-256 hash
      const hash = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        hash[i] = data[i % data.length] ^ i;
      }
      return hash.buffer;
    }),
  },
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
});

// Mock btoa/atob
global.btoa = jest.fn((str: string) => Buffer.from(str, 'binary').toString('base64'));
global.atob = jest.fn((str: string) => Buffer.from(str, 'base64').toString('binary'));

describe('Metadata Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Message Padding', () => {
    test('should pad message to fixed size', () => {
      const message = new Uint8Array([1, 2, 3, 4, 5]);
      const padded = metadataProtection.padMessage(message, PaddingScheme.FIXED);
      
      expect(padded.length).toBeGreaterThanOrEqual(128); // MIN_MESSAGE_SIZE
      expect(padded[message.length]).toBe(0x80); // Padding delimiter
    });

    test('should pad message to block size', () => {
      const message = new Uint8Array([1, 2, 3, 4, 5]);
      const padded = metadataProtection.padMessage(message, PaddingScheme.BLOCK);
      
      expect(padded.length % 64).toBe(0); // Should be multiple of PADDING_BLOCK_SIZE
      expect(padded[message.length]).toBe(0x80); // Padding delimiter
    });

    test('should pad message with random padding', () => {
      const message = new Uint8Array([1, 2, 3, 4, 5]);
      const padded1 = metadataProtection.padMessage(message, PaddingScheme.RANDOM);
      const padded2 = metadataProtection.padMessage(message, PaddingScheme.RANDOM);
      
      // Random padding should produce different sizes (with high probability)
      expect(padded1.length).toBeGreaterThanOrEqual(128);
      expect(padded2.length).toBeGreaterThanOrEqual(128);
      expect(padded1[message.length]).toBe(0x80);
      expect(padded2[message.length]).toBe(0x80);
    });

    test('should preserve original message in padded data', () => {
      const message = new Uint8Array([1, 2, 3, 4, 5]);
      const padded = metadataProtection.padMessage(message, PaddingScheme.BLOCK);
      
      // Original message should be at the beginning
      for (let i = 0; i < message.length; i++) {
        expect(padded[i]).toBe(message[i]);
      }
    });
  });

  describe('Message Unpadding', () => {
    test('should remove padding correctly', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const padded = metadataProtection.padMessage(original, PaddingScheme.BLOCK);
      const unpadded = metadataProtection.unpadMessage(padded);
      
      expect(unpadded.length).toBe(original.length);
      expect(Array.from(unpadded)).toEqual(Array.from(original));
    });

    test('should handle message without padding', () => {
      const message = new Uint8Array([1, 2, 3, 4, 5]);
      const unpadded = metadataProtection.unpadMessage(message);
      
      expect(Array.from(unpadded)).toEqual(Array.from(message));
    });

    test('should handle multiple padding delimiters', () => {
      const message = new Uint8Array([1, 2, 0x80, 4, 5]);
      const padded = metadataProtection.padMessage(message, PaddingScheme.BLOCK);
      const unpadded = metadataProtection.unpadMessage(padded);
      
      expect(Array.from(unpadded)).toEqual(Array.from(message));
    });
  });

  describe('Random Delays', () => {
    test('should add random delay', async () => {
      const delayPromise = metadataProtection.addRandomDelay();
      
      // Advance timers to complete the delay
      jest.runAllTimers();
      
      // Should resolve without error
      await expect(delayPromise).resolves.toBeUndefined();
    });

    test('should resolve delay promise', async () => {
      const delayPromise = metadataProtection.addRandomDelay();
      jest.runAllTimers();
      
      await expect(delayPromise).resolves.toBeUndefined();
    });
  });

  describe('Timestamp Normalization', () => {
    test('should normalize timestamp to nearest minute', () => {
      const timestamp = new Date('2023-01-01T12:34:56.789Z');
      const normalized = metadataProtection.normalizeTimestamp(timestamp);
      
      expect(normalized.getSeconds()).toBe(0);
      expect(normalized.getMilliseconds()).toBe(0);
      expect(normalized.getMinutes()).toBe(35); // Rounded to nearest minute
    });

    test('should use current time if no timestamp provided', () => {
      const before = Date.now();
      const normalized = metadataProtection.normalizeTimestamp();
      const after = Date.now();
      
      const normalizedTime = normalized.getTime();
      expect(normalizedTime).toBeGreaterThanOrEqual(Math.floor(before / 60000) * 60000);
      expect(normalizedTime).toBeLessThanOrEqual(Math.ceil(after / 60000) * 60000);
    });
  });

  describe('Room ID Anonymization', () => {
    test('should anonymize room ID', () => {
      const roomId = 'test-room-123';
      const anonymized = metadataProtection.anonymizeRoomId(roomId);
      
      expect(anonymized).toBeDefined();
      expect(anonymized).not.toBe(roomId);
      expect(typeof anonymized).toBe('string');
    });

    test('should produce consistent anonymization', () => {
      const roomId = 'test-room-123';
      const anonymized1 = metadataProtection.anonymizeRoomId(roomId);
      const anonymized2 = metadataProtection.anonymizeRoomId(roomId);
      
      expect(anonymized1).toBe(anonymized2);
    });

    test('should produce different results for different room IDs', () => {
      const roomId1 = 'test-room-123';
      const roomId2 = 'test-room-456';
      const anonymized1 = metadataProtection.anonymizeRoomId(roomId1);
      const anonymized2 = metadataProtection.anonymizeRoomId(roomId2);
      
      expect(anonymized1).not.toBe(anonymized2);
    });
  });

  describe('Typing Indicator Delays', () => {
    test('should delay typing indicator', () => {
      const callback = jest.fn();
      const roomId = 'test-room';
      
      metadataProtection.delayTypingIndicator(roomId, callback);
      
      expect(callback).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(1000); // TYPING_INDICATOR_DELAY_MS
      
      expect(callback).toHaveBeenCalled();
    });

    test('should clear existing timer when new delay is set', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const roomId = 'test-room';
      
      metadataProtection.delayTypingIndicator(roomId, callback1);
      jest.advanceTimersByTime(500);
      
      metadataProtection.delayTypingIndicator(roomId, callback2);
      jest.advanceTimersByTime(1000);
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    test('should clear typing indicator timer', () => {
      const callback = jest.fn();
      const roomId = 'test-room';
      
      metadataProtection.delayTypingIndicator(roomId, callback);
      metadataProtection.clearTypingIndicator(roomId);
      
      jest.advanceTimersByTime(1000);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Dummy Message Generation', () => {
    test('should generate dummy message', () => {
      const dummy = metadataProtection.generateDummyMessage();
      
      expect(dummy).toBeInstanceOf(Uint8Array);
      expect(dummy.length).toBeGreaterThanOrEqual(128);
      expect(dummy.length).toBeLessThanOrEqual(4096);
    });

    test('should generate different dummy messages', () => {
      const dummy1 = metadataProtection.generateDummyMessage();
      const dummy2 = metadataProtection.generateDummyMessage();
      
      // Should be different (with high probability)
      expect(Array.from(dummy1)).not.toEqual(Array.from(dummy2));
    });
  });

  describe('Privacy Headers', () => {
    test('should return privacy-preserving headers', () => {
      const headers = metadataProtection.getPrivacyHeaders();
      
      expect(headers['DNT']).toBe('1');
      expect(headers['Sec-GPC']).toBe('1');
      expect(headers['Cache-Control']).toContain('no-store');
      expect(headers['Pragma']).toBe('no-cache');
      expect(headers['Expires']).toBe('0');
    });
  });

  describe('Message Metadata Sanitization', () => {
    test('should sanitize message metadata', () => {
      const message: EncryptedMessage = {
        id: 'test-id',
        room_id: 'test-room',
        sender_fingerprint: 'test-fingerprint',
        ciphertext: new Uint8Array([1, 2, 3]),
        header: new Uint8Array([4, 5, 6]),
        created_at: new Date('2023-01-01T12:34:56.789Z'),
      };
      
      const sanitized = metadataProtection.sanitizeMessageMetadata(message);
      
      expect(sanitized.id).toBeUndefined();
      expect(sanitized.created_at?.getSeconds()).toBe(0);
      expect(sanitized.created_at?.getMilliseconds()).toBe(0);
      expect(sanitized.room_id).toBe(message.room_id);
      expect(sanitized.sender_fingerprint).toBe(message.sender_fingerprint);
    });
  });

  describe('Decoy Traffic', () => {
    test('should generate decoy pattern', () => {
      const pattern = metadataProtection.generateDecoyPattern();
      
      expect(typeof pattern.shouldSend).toBe('boolean');
      expect(typeof pattern.delay).toBe('number');
      expect(pattern.delay).toBeGreaterThanOrEqual(0);
      expect(pattern.delay).toBeLessThanOrEqual(10000);
    });
  });
}); 