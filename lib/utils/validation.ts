/**
 * Validation utilities for AnoChat
 */

import { UI, PATTERNS } from '../constants';

/**
 * Validate passphrase strength
 */
export function validatePassphrase(passphrase: string): {
  score: number;
  feedback: string[];
  isValid: boolean;
} {
  const feedback: string[] = [];
  let score = 0;

  // Check length
  if (passphrase.length >= 12) {
    score += 2;
  } else if (passphrase.length >= UI.PASSPHRASE_MIN_LENGTH) {
    score += 1;
    feedback.push("Use at least 12 characters for better security");
  } else {
    feedback.push(`Passphrase must be at least ${UI.PASSPHRASE_MIN_LENGTH} characters long`);
  }

  // Check for uppercase
  if (/[A-Z]/.test(passphrase)) {
    score += 1;
  } else {
    feedback.push("Include uppercase letters");
  }

  // Check for lowercase
  if (/[a-z]/.test(passphrase)) {
    score += 1;
  } else {
    feedback.push("Include lowercase letters");
  }

  // Check for numbers
  if (/\d/.test(passphrase)) {
    score += 1;
  } else {
    feedback.push("Include numbers");
  }

  // Check for special characters
  if (/[^A-Za-z0-9]/.test(passphrase)) {
    score += 1;
  } else {
    feedback.push("Include special characters");
  }

  // Check for common patterns
  const commonPatterns = [
    "password",
    "12345",
    "qwerty",
    "admin",
    "letmein",
    "welcome",
  ];
  
  const lowerPassphrase = passphrase.toLowerCase();
  if (commonPatterns.some((pattern) => lowerPassphrase.includes(pattern))) {
    score = Math.max(0, score - 2);
    feedback.push("Avoid common patterns");
  }

  return {
    score: Math.min(5, score), // Max score of 5
    feedback,
    isValid: passphrase.length >= UI.PASSPHRASE_MIN_LENGTH && score >= 3,
  };
}

/**
 * Validate UUID v4
 */
export function isValidUUID(uuid: string): boolean {
  return PATTERNS.UUID_V4.test(uuid);
}

/**
 * Validate hex string
 */
export function isValidHex(hex: string): boolean {
  return PATTERNS.HEX_STRING.test(hex);
}

/**
 * Validate base64 string
 */
export function isValidBase64(base64: string): boolean {
  return PATTERNS.BASE64.test(base64);
}

/**
 * Validate room name
 */
export function validateRoomName(name: string): {
  isValid: boolean;
  error?: string;
} {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: "Room name cannot be empty" };
  }
  
  if (name.length > UI.ROOM_NAME_MAX_LENGTH) {
    return { isValid: false, error: `Room name must be less than ${UI.ROOM_NAME_MAX_LENGTH} characters` };
  }
  
  return { isValid: true };
}

/**
 * Validate message content
 */
export function validateMessage(message: string): {
  isValid: boolean;
  error?: string;
} {
  if (!message || message.trim().length === 0) {
    return { isValid: false, error: "Message cannot be empty" };
  }
  
  if (message.length > UI.MESSAGE_MAX_LENGTH) {
    return { isValid: false, error: `Message must be less than ${UI.MESSAGE_MAX_LENGTH} characters` };
  }
  
  return { isValid: true };
} 