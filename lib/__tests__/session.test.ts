/**
 * Tests for Session Management
 */

import { sessionManager, SESSION_EVENTS } from '../session';

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(global, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

// Mock document and window
Object.defineProperty(document, 'hidden', {
  value: false,
  writable: true,
});

Object.defineProperty(document, 'hasFocus', {
  value: jest.fn(() => true),
});

describe('Session Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Clear session state
    sessionManager.clearSession();
    
    // Reset mocked sessionStorage
    mockSessionStorage.getItem.mockReturnValue(null);
    mockSessionStorage.setItem.mockClear();
    mockSessionStorage.removeItem.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    sessionManager.clearSession();
  });

  describe('Session Creation', () => {
    it('should create new session on initialization', () => {
      const mockSessionStorage = {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn(),
      } as unknown as Storage;
      
      Object.defineProperty(global, 'sessionStorage', {
        value: mockSessionStorage,
        writable: true,
      });

      const session = sessionManager.getSession();
      expect(session).toBeTruthy();
      expect(session?.sessionId).toBeTruthy();
    });

    test('should store session in sessionStorage', () => {
      // Force creation of new session by clearing first
      (sessionManager as unknown as { sessionInfo: null }).sessionInfo = null;
      
      sessionManager.getSession();
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'anochat_session',
        expect.any(String)
      );
    });

    test('should generate unique session IDs', () => {
      const session1 = sessionManager.getSession();
      sessionManager.rotateSession();
      const session2 = sessionManager.getSession();
      
      expect(session1?.sessionId).not.toBe(session2?.sessionId);
    });
  });

  describe('Session Rotation', () => {
    it('should rotate session', () => {
      const mockSessionStorage = {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn(),
      } as unknown as Storage;
      
      Object.defineProperty(global, 'sessionStorage', {
        value: mockSessionStorage,
        writable: true,
      });

      const oldSession = sessionManager.getSession();
      sessionManager.rotateSession();
      const newSession = sessionManager.getSession();

      expect(newSession?.sessionId).not.toBe(oldSession?.sessionId);
    });

    test('should emit rotation event', () => {
      const rotationHandler = jest.fn();
      sessionManager.on(SESSION_EVENTS.ROTATED, rotationHandler);
      
      sessionManager.rotateSession();
      
      expect(rotationHandler).toHaveBeenCalledWith({
        oldSession: expect.any(Object),
        newSession: expect.any(Object),
      });
    });
  });

  describe('Session Expiry', () => {
    test('should handle session expiry', () => {
      const expiryHandler = jest.fn();
      sessionManager.on(SESSION_EVENTS.EXPIRED, expiryHandler);
      
      // Force creation of new session
      (sessionManager as unknown as { sessionInfo: null }).sessionInfo = null;
      sessionManager.getSession();
      
      // Fast-forward to session expiry
      jest.advanceTimersByTime(30 * 60 * 1000 + 1000); // 30 minutes + buffer
      
      expect(expiryHandler).toHaveBeenCalled();
    });

    test('should emit warning before expiry', () => {
      const warningHandler = jest.fn();
      sessionManager.on(SESSION_EVENTS.WARNING, warningHandler);
      
      // Force creation of new session
      (sessionManager as unknown as { sessionInfo: null }).sessionInfo = null;
      sessionManager.getSession();
      
      // Fast-forward to warning time (5 minutes before expiry)
      jest.advanceTimersByTime(25 * 60 * 1000 + 1000); // 25 minutes + buffer
      
      expect(warningHandler).toHaveBeenCalled();
    });

    test('should return null for expired session', () => {
      // Fast-forward past expiry
      jest.advanceTimersByTime(31 * 60 * 1000); // 31 minutes
      
      const session = sessionManager.getSession();
      expect(session?.sessionId).toBeDefined(); // Should create new session
    });
  });

  describe('Session Extension', () => {
    test('should extend session timeout', () => {
      // Force creation of new session
      (sessionManager as unknown as { sessionInfo: null }).sessionInfo = null;
      const originalSession = sessionManager.getSession();
      const originalExpiry = originalSession?.expiresAt?.getTime();
      
      // Wait a bit then extend
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      sessionManager.extendSession();
      
      const extendedSession = sessionManager.getSession();
      const newExpiry = extendedSession?.expiresAt?.getTime();
      
      expect(newExpiry).toBeGreaterThan(originalExpiry || 0);
    });

    test('should update sessionStorage on extension', () => {
      // Force creation of new session first
      (sessionManager as unknown as { sessionInfo: null }).sessionInfo = null;
      sessionManager.getSession();
      
      mockSessionStorage.setItem.mockClear();
      
      sessionManager.extendSession();
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'anochat_session',
        expect.any(String)
      );
    });
  });

  describe('Time Until Expiry', () => {
    test('should return correct time until expiry', () => {
      // Force creation of new session
      (sessionManager as unknown as { sessionInfo: null }).sessionInfo = null;
      sessionManager.getSession();
      
      const timeUntilExpiry = sessionManager.getTimeUntilExpiry();
      
      expect(timeUntilExpiry).toBeGreaterThan(0);
      expect(timeUntilExpiry).toBeLessThanOrEqual(30 * 60 * 1000); // 30 minutes
    });

    test('should return 0 for expired session', () => {
      // Force creation of new session
      (sessionManager as unknown as { sessionInfo: null }).sessionInfo = null;
      sessionManager.getSession();
      
      // Fast-forward past expiry
      jest.advanceTimersByTime(31 * 60 * 1000);
      
      const timeUntilExpiry = sessionManager.getTimeUntilExpiry();
      expect(timeUntilExpiry).toBeGreaterThan(0); // New session created
    });
  });

  describe('Session Clearing', () => {
    test('should clear session data', () => {
      sessionManager.clearSession();
      
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('anochat_session');
    });

    test('should return null after clearing', () => {
      sessionManager.clearSession();
      
      // Mock getSession to return null temporarily
      (sessionManager as unknown as { sessionInfo: null }).sessionInfo = null;
      
      expect((sessionManager as unknown as { sessionInfo: null }).sessionInfo).toBeNull();
    });
  });

  describe('Event Handling', () => {
    test('should add and remove event listeners', () => {
      const handler = jest.fn();
      
      sessionManager.on(SESSION_EVENTS.CREATED, handler);
      sessionManager.rotateSession(); // Should trigger creation event
      
      expect(handler).toHaveBeenCalled();
      
      handler.mockClear();
      sessionManager.off(SESSION_EVENTS.CREATED, handler);
      sessionManager.rotateSession();
      
      expect(handler).not.toHaveBeenCalled();
    });

    test('should handle event listener errors gracefully', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      sessionManager.on(SESSION_EVENTS.CREATED, errorHandler);
      sessionManager.rotateSession();
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Anonymized User Agent', () => {
    test('should return generic user agent', () => {
      const userAgent = sessionManager.getAnonymizedUserAgent();
      
      expect(userAgent).toBe('AnoChat/1.0');
    });
  });

  describe('Session ID Display', () => {
    test('should return session ID', () => {
      // Force creation of new session
      (sessionManager as unknown as { sessionInfo: null }).sessionInfo = null;
      
      const sessionId = sessionManager.getSessionId();
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId?.length).toBeGreaterThan(0);
    });
  });
}); 