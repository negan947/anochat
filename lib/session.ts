/**
 * Session Management for AnoChat
 * Handles ephemeral session IDs, rotation, and anonymity features
 */

import { v4 as uuidv4 } from 'uuid';
import { SessionInfo } from './types';

// Session constants
const SESSION_KEY = 'anochat_session';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_WARNING_MS = 5 * 60 * 1000; // 5 minutes before expiry

// Session events
export const SESSION_EVENTS = {
  CREATED: 'session:created',
  ROTATED: 'session:rotated',
  WARNING: 'session:warning',
  EXPIRED: 'session:expired',
} as const;

class SessionManager {
  private sessionInfo: SessionInfo | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private expiryTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  constructor() {
    // Initialize session on creation
    this.initializeSession();
    
    // Listen for page visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
    
    // Listen for beforeunload to clean up
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }
  }

  /**
   * Initialize or restore session
   */
  private initializeSession(): void {
    // Never restore from storage - always create new ephemeral session
    this.createNewSession();
  }

  /**
   * Create a new ephemeral session
   */
  private createNewSession(): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MS);
    
    this.sessionInfo = {
      sessionId: this.generateEphemeralId(),
      createdAt: now,
      expiresAt,
    };

    // Store in sessionStorage only (cleared on tab close)
    if (typeof sessionStorage !== 'undefined' && sessionStorage.setItem) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.sessionInfo));
    }

    // Set up timers
    this.setupTimers();

    // Emit created event
    this.emit(SESSION_EVENTS.CREATED, this.sessionInfo);
  }

  /**
   * Generate cryptographically secure ephemeral ID
   */
  private generateEphemeralId(): string {
    // Use UUID v4 for simplicity, but could use crypto.getRandomValues for more control
    return uuidv4();
  }

  /**
   * Setup warning and expiry timers
   */
  private setupTimers(): void {
    this.clearTimers();

    if (!this.sessionInfo?.expiresAt) return;

    const now = Date.now();
    const expiryTime = this.sessionInfo.expiresAt.getTime();
    const warningTime = expiryTime - SESSION_WARNING_MS;

    // Set warning timer
    if (warningTime > now) {
      this.warningTimer = setTimeout(() => {
        this.emit(SESSION_EVENTS.WARNING, {
          sessionId: this.sessionInfo?.sessionId,
          expiresIn: SESSION_WARNING_MS,
        });
      }, warningTime - now);
    }

    // Set expiry timer
    if (expiryTime > now) {
      this.expiryTimer = setTimeout(() => {
        this.handleSessionExpiry();
      }, expiryTime - now);
    }
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  /**
   * Handle session expiry
   */
  private handleSessionExpiry(): void {
    const oldSession = this.sessionInfo;
    
    // Emit expired event
    this.emit(SESSION_EVENTS.EXPIRED, oldSession);
    
    // Rotate to new session
    this.rotateSession();
  }

  /**
   * Rotate session (create new ephemeral ID)
   */
  public rotateSession(): void {
    const oldSession = this.sessionInfo;
    
    // Create new session
    this.createNewSession();
    
    // Emit rotated event
    this.emit(SESSION_EVENTS.ROTATED, {
      oldSession,
      newSession: this.sessionInfo,
    });
  }

  /**
   * Get current session info
   */
  public getSession(): SessionInfo | null {
    // Create new session if none exists
    if (!this.sessionInfo) {
      this.createNewSession();
    }
    
    // Check if session has expired
    if (this.sessionInfo?.expiresAt && new Date() > this.sessionInfo.expiresAt) {
      this.handleSessionExpiry();
    }
    
    return this.sessionInfo;
  }

  /**
   * Get current session ID
   */
  public getSessionId(): string | null {
    return this.getSession()?.sessionId || null;
  }

  /**
   * Extend session timeout (on activity)
   */
  public extendSession(): void {
    if (!this.sessionInfo) return;
    
    const now = new Date();
    this.sessionInfo.expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MS);
    
    // Update storage
    if (typeof sessionStorage !== 'undefined' && sessionStorage.setItem) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.sessionInfo));
    }
    
    // Reset timers
    this.setupTimers();
  }

  /**
   * Handle visibility change (tab focus/blur)
   */
  private handleVisibilityChange(): void {
    if (!document.hidden) {
      // Tab became visible - check session validity
      if (this.sessionInfo?.expiresAt && new Date() > this.sessionInfo.expiresAt) {
        this.handleSessionExpiry();
      } else {
        // Extend session on return to tab
        this.extendSession();
      }
    }
  }

  /**
   * Handle before unload
   */
  private handleBeforeUnload(): void {
    // Clear timers but don't clear session - let sessionStorage handle it
    this.clearTimers();
  }

  /**
   * Add event listener
   */
  public on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  public off(event: string, callback: (...args: unknown[]) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  /**
   * Emit event
   */
  private emit(event: string, data: unknown): void {
    this.eventListeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in session event listener:`, error);
      }
    });
  }

  /**
   * Clear session (for burn notice)
   */
  public clearSession(): void {
    this.clearTimers();
    this.sessionInfo = null;
    
    if (typeof sessionStorage !== 'undefined' && sessionStorage.removeItem) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  /**
   * Get anonymized user agent for metadata minimization
   */
  public getAnonymizedUserAgent(): string {
    // Return generic user agent to prevent fingerprinting
    return 'AnoChat/1.0';
  }

  /**
   * Get time until session expiry
   */
  public getTimeUntilExpiry(): number | null {
    if (!this.sessionInfo?.expiresAt) return null;
    
    const now = Date.now();
    const expiryTime = this.sessionInfo.expiresAt.getTime();
    
    return Math.max(0, expiryTime - now);
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Export types
export type { SessionInfo };

 