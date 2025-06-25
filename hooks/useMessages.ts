import { useEffect, useState, useCallback, useRef } from 'react';
import { DecryptedMessage } from '../lib/types';
import {
  sendMessage,
  loadRoomHistory,
  subscribeToRoomMessages,
  clearRoomQueue,
  getPendingMessagesCount,
  retryFailedMessages,
} from '../lib/message-handler';
import { subscribeToTyping } from '../lib/supabase';

interface UseMessagesOptions {
  roomId: string;
  senderFingerprint: string;
  recipientFingerprint: string;
}

export function useMessages({
  roomId,
  senderFingerprint,
  recipientFingerprint,
}: UseMessagesOptions) {
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const typingUnsubscribeRef = useRef<ReturnType<typeof subscribeToTyping> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load message history
  useEffect(() => {
    if (!roomId) return;

    setLoading(true);
    setError(null);

    loadRoomHistory(roomId)
      .then(history => {
        setMessages(history);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [roomId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!roomId) return;

    unsubscribeRef.current = subscribeToRoomMessages(roomId, (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [roomId]);

  // Subscribe to typing indicators
  useEffect(() => {
    if (!roomId || !senderFingerprint) return;

    typingUnsubscribeRef.current = subscribeToTyping(
      roomId,
      senderFingerprint,
      setTypingUsers
    );

    return () => {
      if (typingUnsubscribeRef.current) {
        typingUnsubscribeRef.current.unsubscribe();
        typingUnsubscribeRef.current = null;
      }
    };
  }, [roomId, senderFingerprint]);

  // Monitor pending messages
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(getPendingMessagesCount());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Send message function
  const send = useCallback(async (content: string) => {
    if (!content.trim() || !roomId || !recipientFingerprint || !senderFingerprint) {
      return false;
    }

    setIsSending(true);
    setError(null);

    try {
      const success = await sendMessage(
        roomId,
        content,
        recipientFingerprint,
        senderFingerprint
      );

      if (!success) {
        setError('Failed to send message');
      }

      return success;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setIsSending(false);
    }
  }, [roomId, recipientFingerprint, senderFingerprint]);

  // Set typing status
  const setTyping = useCallback((isTyping: boolean) => {
    if (!typingUnsubscribeRef.current) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    typingUnsubscribeRef.current.setTyping(isTyping);

    // Auto-clear typing after 3 seconds
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        typingUnsubscribeRef.current?.setTyping(false);
      }, 3000);
    }
  }, []);

  // Retry failed messages
  const retry = useCallback(async () => {
    if (!senderFingerprint) return;

    try {
      await retryFailedMessages(senderFingerprint);
    } catch (err: any) {
      setError(err.message);
    }
  }, [senderFingerprint]);

  // Clear room queue
  const clearQueue = useCallback(() => {
    if (!roomId) return;
    clearRoomQueue(roomId);
    setPendingCount(0);
  }, [roomId]);

  return {
    messages,
    loading,
    error,
    pendingCount,
    typingUsers,
    isSending,
    sendMessage: send,
    setTyping,
    retryFailed: retry,
    clearQueue,
  };
} 