'use client';

import React, { useState, useEffect } from 'react';
import { sessionManager, SESSION_EVENTS } from '@/lib/session';
import { SessionInfo } from '@/lib/types';

export function SessionIndicator() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Get initial session
    setSession(sessionManager.getSession());

    // Update timer every second
    const interval = setInterval(() => {
      const time = sessionManager.getTimeUntilExpiry();
      setTimeUntilExpiry(time);
      
      // Extend session on user activity
      if (document.hasFocus()) {
        sessionManager.extendSession();
      }
    }, 1000);

    // Listen for session events
    const handleSessionCreated = (...args: unknown[]) => {
      const newSession = args[0] as SessionInfo;
      setSession(newSession);
      setShowWarning(false);
    };

    const handleSessionRotated = (...args: unknown[]) => {
      const { newSession } = args[0] as { newSession: SessionInfo };
      setSession(newSession);
      setShowWarning(false);
    };

    const handleSessionWarning = () => {
      setShowWarning(true);
    };

    const handleSessionExpired = () => {
      setShowWarning(false);
    };

    sessionManager.on(SESSION_EVENTS.CREATED, handleSessionCreated);
    sessionManager.on(SESSION_EVENTS.ROTATED, handleSessionRotated);
    sessionManager.on(SESSION_EVENTS.WARNING, handleSessionWarning);
    sessionManager.on(SESSION_EVENTS.EXPIRED, handleSessionExpired);

    return () => {
      clearInterval(interval);
      sessionManager.off(SESSION_EVENTS.CREATED, handleSessionCreated);
      sessionManager.off(SESSION_EVENTS.ROTATED, handleSessionRotated);
      sessionManager.off(SESSION_EVENTS.WARNING, handleSessionWarning);
      sessionManager.off(SESSION_EVENTS.EXPIRED, handleSessionExpired);
    };
  }, []);

  const handleRotateSession = () => {
    sessionManager.rotateSession();
  };

  const formatTime = (ms: number | null): string => {
    if (ms === null) return '—';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getSessionIdDisplay = (id: string | null | undefined): string => {
    if (!id) return '—';
    // Show first 8 characters of session ID
    return id.substring(0, 8) + '...';
  };

  if (!session) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={`
        bg-gray-900 border rounded-lg p-4 shadow-lg transition-all
        ${showWarning ? 'border-yellow-500 animate-pulse' : 'border-gray-700'}
      `}>
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1">Ephemeral Session</div>
            <div className="font-mono text-sm text-gray-300">
              {getSessionIdDisplay(session.sessionId)}
            </div>
            {timeUntilExpiry !== null && (
              <div className="text-xs text-gray-500 mt-1">
                Expires in {formatTime(timeUntilExpiry)}
              </div>
            )}
          </div>
          
          <button
            onClick={handleRotateSession}
            className="p-2 rounded hover:bg-gray-800 transition-colors"
            title="Rotate Session ID"
          >
            <svg 
              className="w-4 h-4 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
          </button>
        </div>

        {showWarning && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-xs text-yellow-500 flex items-center">
              <svg 
                className="w-4 h-4 mr-1" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
              Session expiring soon
            </div>
            <button
              onClick={handleRotateSession}
              className="mt-2 text-xs bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded transition-colors w-full"
            >
              Rotate Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 