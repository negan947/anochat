import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility for formatting time relative to now
export function timeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return "Just now";
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }
  
  return date.toLocaleDateString();
}

// Utility for truncating text with ellipsis
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

// Utility for formatting fingerprints
export function formatFingerprint(fingerprint: string, length: number = 6): string {
  if (fingerprint.length <= length * 2) return fingerprint;
  return `${fingerprint.slice(0, length)}...${fingerprint.slice(-length)}`;
}

// Utility for generating random anonymous names
const anonymousAdjectives = [
  "Silent", "Hidden", "Shadow", "Ghost", "Phantom", "Whisper", "Cipher", "Veil",
  "Mask", "Cloak", "Stealth", "Echo", "Mirage", "Enigma", "Mystery", "Vapor"
];

const anonymousNouns = [
  "Walker", "Runner", "Sender", "Voice", "Signal", "Wave", "Pulse", "Node",
  "Agent", "User", "Entity", "Being", "Soul", "Mind", "Spark", "Flame"
];

export function generateAnonymousName(): string {
  const adjective = anonymousAdjectives[Math.floor(Math.random() * anonymousAdjectives.length)];
  const noun = anonymousNouns[Math.floor(Math.random() * anonymousNouns.length)];
  const number = Math.floor(Math.random() * 9999);
  return `${adjective}${noun}${number}`;
}

// Utility for debouncing functions
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Utility for throttling functions
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Utility for copying text to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {  
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const result = document.execCommand("copy");
      document.body.removeChild(textArea);
      return result;
    } catch {
      return false;
    }
  }
}

// Security utilities for production hardening
export class SecurityUtils {
  // Check if running in development mode
  static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  // Check if running in production mode
  static isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Secure logging that only outputs in development
   */
  static secureLog(message: string, data?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === "development") {
      console.log(`[AnoChat] ${message}`, data || "");
    }
  }

  static secureError(message: string, error?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === "development") {
      console.error(`[AnoChat Error] ${message}`, error || "");
    }
    // In production, we might want to send to an error reporting service
    // but never log sensitive information
  }

  /**
   * Sanitize error for production logging
   */
  static sanitizeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "Unknown error occurred";
  }

  /**
   * Clear sensitive data from memory
   */
  static clearSensitiveData(data: Uint8Array): void {
    try {
      // Overwrite with zeros
      data.fill(0);
    } catch {
      // Ignore errors during cleanup
    }
  }

  /**
   * Clear sensitive string data
   */
  static clearSensitiveString(): void {
    // In JavaScript, strings are immutable, so we can't actually clear them
    // This is here for completeness but doesn't actually do anything
  }

  // Secure warning logging
  static secureWarn(message: string, ...args: unknown[]): void {
    if (this.isDevelopment()) {
      console.warn(`[AnoChat WARN] ${message}`, ...args);
    }
  }

  // Remove sensitive data from objects for logging
  static sanitizeForLogging(obj: unknown): unknown {
    if (this.isProduction()) {
      return '[REDACTED]';
    }

    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized = { ...obj as Record<string, unknown> };
    const sensitiveKeys = [
      'privateKey', 'secretKey', 'password', 'passphrase', 
      'token', 'key', 'secret', 'ciphertext', 'signature'
    ];

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  // Validate CSP compliance
  static validateCSP(): boolean {
    if (typeof window === 'undefined') return true;

    try {
      // Check if eval is blocked (good for security)
      eval('1');
      this.secureWarn('eval() is not blocked - potential security risk');
      return false;
    } catch {
      // eval is blocked, which is good
      return true;
    }
  }

  // Check for common security headers
  static checkSecurityHeaders(): void {
    if (typeof window === 'undefined') return;

    // This would typically be checked on the server side
    // Here we just log a reminder in development
    if (this.isDevelopment()) {
      this.secureLog('Security headers should be verified on deployment');
    }
  }

  // Generate secure random string for IDs
  static generateSecureId(length: number = 32): string {
    if (typeof window !== 'undefined' && window.crypto) {
      const array = new Uint8Array(length);
      window.crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback for non-browser environments
    return Math.random().toString(36).substring(2, length + 2);
  }

  // Secure comparison to prevent timing attacks
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  // Check for common client-side vulnerabilities
  static performSecurityCheck(): void {
    if (typeof window === 'undefined') return;

    // Check for XSS protection
    if (!this.validateCSP()) {
      this.secureWarn('CSP validation failed');
    }

    // Check for secure context (HTTPS)
    if (!window.isSecureContext && this.isProduction()) {
      this.secureError('Application is not running in a secure context (HTTPS required)');
    }

    // Check for basic security headers
    this.checkSecurityHeaders();

    // Log security check completion
    this.secureLog('Security check completed');
  }
}

// Initialize security check on module load
if (typeof window !== 'undefined') {
  SecurityUtils.performSecurityCheck();
} 