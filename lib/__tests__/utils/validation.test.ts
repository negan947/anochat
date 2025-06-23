/**
 * Tests for validation utilities
 */

import {
  validatePassphrase,
  isValidUUID,
  isValidHex,
  isValidBase64,
  validateRoomName,
  validateMessage,
} from '../../utils/validation';

describe('Validation Utilities', () => {
  describe('validatePassphrase', () => {
    it('should validate strong passphrase', () => {
      const result = validatePassphrase('MySecurePass123!');
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(result.feedback.length).toBe(0);
    });

    it('should reject short passphrase', () => {
      const result = validatePassphrase('Pass1!');
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Passphrase must be at least 8 characters long');
    });

    it('should provide feedback for weak passphrase', () => {
      const result = validatePassphrase('password');
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Include uppercase letters');
      expect(result.feedback).toContain('Include numbers');
      expect(result.feedback).toContain('Include special characters');
      expect(result.feedback).toContain('Avoid common patterns');
    });

    it('should give bonus for long passphrase', () => {
      const result = validatePassphrase('ThisIsAVeryLongPassphrase123!');
      expect(result.score).toBe(5); // Max score
      expect(result.isValid).toBe(true);
    });

    it('should detect common patterns', () => {
      const result = validatePassphrase('Password12345!');
      expect(result.feedback).toContain('Avoid common patterns');
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUID v4', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(false); // v1
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('isValidHex', () => {
    it('should validate hex strings', () => {
      expect(isValidHex('0123456789abcdef')).toBe(true);
      expect(isValidHex('ABCDEF')).toBe(true);
      expect(isValidHex('ff00ff')).toBe(true);
    });

    it('should reject non-hex strings', () => {
      expect(isValidHex('xyz')).toBe(false);
      expect(isValidHex('0x123')).toBe(false);
      expect(isValidHex('123g')).toBe(false);
      expect(isValidHex('')).toBe(false);
    });
  });

  describe('isValidBase64', () => {
    it('should validate base64 strings', () => {
      expect(isValidBase64('SGVsbG8gV29ybGQ=')).toBe(true);
      expect(isValidBase64('SGVsbG8gV29ybGQ')).toBe(true);
      expect(isValidBase64('U29tZSBkYXRh')).toBe(true);
    });

    it('should reject invalid base64', () => {
      expect(isValidBase64('Hello World!')).toBe(false);
      expect(isValidBase64('SGVsbG8@V29ybGQ=')).toBe(false);
      expect(isValidBase64('')).toBe(true); // Empty string is valid base64
    });
  });

  describe('validateRoomName', () => {
    it('should validate valid room names', () => {
      expect(validateRoomName('My Room')).toEqual({ isValid: true });
      expect(validateRoomName('Test')).toEqual({ isValid: true });
      expect(validateRoomName('Room 123')).toEqual({ isValid: true });
    });

    it('should reject empty room names', () => {
      const result = validateRoomName('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Room name cannot be empty');
    });

    it('should reject whitespace-only room names', () => {
      const result = validateRoomName('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Room name cannot be empty');
    });

    it('should reject too long room names', () => {
      const longName = 'a'.repeat(51);
      const result = validateRoomName(longName);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Room name must be less than 50 characters');
    });
  });

  describe('validateMessage', () => {
    it('should validate valid messages', () => {
      expect(validateMessage('Hello!')).toEqual({ isValid: true });
      expect(validateMessage('This is a longer message with multiple words')).toEqual({ isValid: true });
    });

    it('should reject empty messages', () => {
      const result = validateMessage('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message cannot be empty');
    });

    it('should reject whitespace-only messages', () => {
      const result = validateMessage('   \n\t  ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message cannot be empty');
    });

    it('should reject too long messages', () => {
      const longMessage = 'a'.repeat(5001);
      const result = validateMessage(longMessage);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Message must be less than 5000 characters');
    });
  });
}); 