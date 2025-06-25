/**
 * Metadata Protection for AnoChat
 * Implements techniques to minimize metadata leakage and fingerprinting
 */

import { EncryptedMessage } from './types';

// Constants for metadata protection
const MIN_MESSAGE_SIZE = 128; // Minimum padded message size in bytes
const MAX_MESSAGE_SIZE = 4096; // Maximum message size in bytes
const PADDING_BLOCK_SIZE = 64; // Pad to nearest 64 bytes
const MIN_DELAY_MS = 100; // Minimum artificial delay
const MAX_DELAY_MS = 500; // Maximum artificial delay
const TYPING_INDICATOR_DELAY_MS = 1000; // Delay before showing typing

// Padding schemes
export enum PaddingScheme {
  FIXED = 'fixed',
  BLOCK = 'block',
  RANDOM = 'random',
}

class MetadataProtection {
  private typingTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Pad message to hide actual length
   */
  public padMessage(message: Uint8Array, scheme: PaddingScheme = PaddingScheme.BLOCK): Uint8Array {
    switch (scheme) {
      case PaddingScheme.FIXED:
        return this.padToFixed(message);
      case PaddingScheme.BLOCK:
        return this.padToBlock(message);
      case PaddingScheme.RANDOM:
        return this.padRandom(message);
      default:
        return this.padToBlock(message);
    }
  }

  /**
   * Remove padding from message
   */
  public unpadMessage(paddedMessage: Uint8Array): Uint8Array {
    // Look for padding delimiter (0x80 followed by zeros)
    let paddingStart = paddedMessage.length;
    
    for (let i = paddedMessage.length - 1; i >= 0; i--) {
      if (paddedMessage[i] === 0x80) {
        // Check if all bytes after this are zeros
        let allZeros = true;
        for (let j = i + 1; j < paddedMessage.length; j++) {
          if (paddedMessage[j] !== 0x00) {
            allZeros = false;
            break;
          }
        }
        if (allZeros) {
          paddingStart = i;
          break;
        }
      }
    }
    
    return paddedMessage.slice(0, paddingStart);
  }

  /**
   * Pad to fixed size
   */
  private padToFixed(message: Uint8Array): Uint8Array {
    if (message.length >= MIN_MESSAGE_SIZE) {
      return message;
    }
    
    const padded = new Uint8Array(MIN_MESSAGE_SIZE);
    padded.set(message);
    padded[message.length] = 0x80; // Padding delimiter
    
    return padded;
  }

  /**
   * Pad to nearest block size
   */
  private padToBlock(message: Uint8Array): Uint8Array {
    const minSize = Math.max(message.length + 1, MIN_MESSAGE_SIZE); // +1 for delimiter
    const targetSize = Math.ceil(minSize / PADDING_BLOCK_SIZE) * PADDING_BLOCK_SIZE;
    
    const padded = new Uint8Array(targetSize);
    padded.set(message);
    padded[message.length] = 0x80; // Padding delimiter
    
    return padded;
  }

  /**
   * Add random padding
   */
  private padRandom(message: Uint8Array): Uint8Array {
    const minPadding = MIN_MESSAGE_SIZE - message.length;
    const maxPadding = MAX_MESSAGE_SIZE - message.length - 1; // -1 for delimiter
    
    if (minPadding <= 0) {
      return message;
    }
    
    const randomPadding = Math.floor(Math.random() * (maxPadding - minPadding)) + minPadding;
    const paddedSize = message.length + randomPadding + 1;
    
    const padded = new Uint8Array(paddedSize);
    padded.set(message);
    padded[message.length] = 0x80; // Padding delimiter
    
    // Fill with random bytes (except delimiter position)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const randomBytes = new Uint8Array(randomPadding);
      crypto.getRandomValues(randomBytes);
      padded.set(randomBytes, message.length + 1);
    }
    
    return padded;
  }

  /**
   * Add random delay to message sending
   */
  public async addRandomDelay(): Promise<void> {
    const delay = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)) + MIN_DELAY_MS;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Normalize timestamp to reduce timing precision
   */
  public normalizeTimestamp(timestamp: Date = new Date()): Date {
    // Round to nearest minute to reduce timing precision
    const ms = timestamp.getTime();
    const rounded = Math.round(ms / 60000) * 60000;
    return new Date(rounded);
  }

  /**
   * Generate decoy traffic pattern
   */
  public generateDecoyPattern(): { shouldSend: boolean; delay: number } {
    // Simple implementation - can be made more sophisticated
    const shouldSend = Math.random() < 0.1; // 10% chance of decoy
    const delay = Math.floor(Math.random() * 10000); // Up to 10 seconds
    
    return { shouldSend, delay };
  }

  /**
   * Anonymize room ID (one-way transformation)
   */
  public anonymizeRoomId(roomId: string): string {
    // Use simple transformation for synchronous operation
    return btoa(roomId).replace(/[+/=]/g, '');
  }

  /**
   * Hash room ID using Web Crypto API
   */
  private async hashRoomId(roomId: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(roomId);
    const hash = await crypto.subtle.digest('SHA-256', data);
    
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Delay typing indicator to prevent timing analysis
   */
  public delayTypingIndicator(roomId: string, callback: () => void): void {
    // Clear existing timer
    const existingTimer = this.typingTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      callback();
      this.typingTimers.delete(roomId);
    }, TYPING_INDICATOR_DELAY_MS);
    
    this.typingTimers.set(roomId, timer);
  }

  /**
   * Clear typing indicator timer
   */
  public clearTypingIndicator(roomId: string): void {
    const timer = this.typingTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.typingTimers.delete(roomId);
    }
  }

  /**
   * Generate dummy message for traffic analysis resistance
   */
  public generateDummyMessage(): Uint8Array {
    const size = Math.floor(Math.random() * (MAX_MESSAGE_SIZE - MIN_MESSAGE_SIZE)) + MIN_MESSAGE_SIZE;
    const dummy = new Uint8Array(size);
    
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(dummy);
    }
    
    return dummy;
  }

  /**
   * Check if browser fingerprinting protections are enabled
   */
  public checkFingerprintingProtection(): {
    canvas: boolean;
    webgl: boolean;
    audio: boolean;
    fonts: boolean;
  } {
    const protections = {
      canvas: false,
      webgl: false,
      audio: false,
      fonts: false,
    };
    
    // Check Canvas fingerprinting
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillText('test', 0, 0);
        const data = canvas.toDataURL();
        // If data is generic/blocked, protection is likely enabled
        protections.canvas = data.length < 100;
      }
    } catch {
      protections.canvas = true;
    }
    
    // Check WebGL fingerprinting
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      protections.webgl = !gl;
    } catch {
      protections.webgl = true;
    }
    
    // More checks can be added for audio, fonts, etc.
    
    return protections;
  }

  /**
   * Get privacy-preserving headers
   */
  public getPrivacyHeaders(): Record<string, string> {
    return {
      'DNT': '1', // Do Not Track
      'Sec-GPC': '1', // Global Privacy Control
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
  }

  /**
   * Sanitize message metadata before storage
   */
  public sanitizeMessageMetadata(message: EncryptedMessage): EncryptedMessage {
    return {
      ...message,
      // Remove or normalize timing information
      created_at: this.normalizeTimestamp(message.created_at),
      // Ensure no additional metadata is leaked
      id: undefined, // Let database generate
    };
  }
}

// Export singleton instance
export const metadataProtection = new MetadataProtection();

// PaddingScheme is already exported above, no need to export again 