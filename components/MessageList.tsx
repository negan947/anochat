"use client";

import { useState, useEffect, useRef } from "react";
import { decryptMessage } from "@/lib/signal-protocol";

interface Message {
  id: string;
  roomId: string;
  senderFingerprint: string;
  ciphertext: { type: number; body: string };
  timestamp: Date;
  decryptedContent?: string;
  decryptionError?: string;
  isOwn: boolean;
}

interface MessageListProps {
  messages: Message[];
  currentUserFingerprint: string;
  roomId: string;
}

export default function MessageList({ 
  messages,
}: MessageListProps) {
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const [decryptionErrors, setDecryptionErrors] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Decrypt messages as they arrive
  useEffect(() => {
    decryptNewMessages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const decryptNewMessages = async () => {
    const newDecrypted = new Map(decryptedMessages);
    const newErrors = new Map(decryptionErrors);

    for (const message of messages) {
      // Skip if already processed or is our own message
      if (newDecrypted.has(message.id) || newErrors.has(message.id)) {
        continue;
      }

      try {
        const decrypted = await decryptMessage(
          message.senderFingerprint,
          1, // device ID
          message.ciphertext
        );
        newDecrypted.set(message.id, decrypted);
      } catch (error) {
        newErrors.set(message.id, `Decryption failed: ${error}`);
      }
    }

    setDecryptedMessages(newDecrypted);
    setDecryptionErrors(newErrors);
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const isToday = timestamp.toDateString() === now.toDateString();
    
    if (isToday) {
      return timestamp.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return timestamp.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
      });
    }
  };

  const formatFingerprint = (fingerprint: string) => {
    return `${fingerprint.slice(0, 6)}...${fingerprint.slice(-4)}`;
  };

  const getMessageContent = (message: Message) => {
    const decrypted = decryptedMessages.get(message.id);
    const error = decryptionErrors.get(message.id);

    if (decrypted) {
      return decrypted;
    } else if (error) {
      return `🔒 ${error}`;
    } else {
      return "🔄 Decrypting...";
    }
  };

  const isMessageDecrypting = (message: Message) => {
    return !decryptedMessages.has(message.id) && !decryptionErrors.has(message.id);
  };

  const hasDecryptionError = (message: Message) => {
    return decryptionErrors.has(message.id);
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900 p-8">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-4">💬</div>
          <h3 className="text-lg font-medium mb-2">No messages yet</h3>
          <p className="text-sm">Send a message to start the conversation</p>
          <div className="mt-4 text-xs bg-gray-800 p-3 rounded-lg">
            <div className="flex items-center justify-center space-x-2">
              <span>🔒</span>
              <span>End-to-end encrypted</span>
              <span>•</span>
              <span>Zero-knowledge</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-900 p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              message.isOwn
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-100'
            }`}
          >
            {/* Sender info for received messages */}
            {!message.isOwn && (
              <div className="text-xs text-gray-400 mb-1">
                {formatFingerprint(message.senderFingerprint)}
              </div>
            )}

            {/* Message content */}
            <div
              className={`text-sm ${
                hasDecryptionError(message) 
                  ? 'text-red-300 italic' 
                  : isMessageDecrypting(message)
                  ? 'text-gray-400 italic'
                  : ''
              }`}
            >
              {getMessageContent(message)}
            </div>

            {/* Timestamp and status */}
            <div
              className={`text-xs mt-1 ${
                message.isOwn ? 'text-blue-200' : 'text-gray-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{formatTimestamp(message.timestamp)}</span>
                
                {/* Status indicators */}
                <div className="flex items-center space-x-1 ml-2">
                  {message.isOwn && (
                    <span title="Sent and encrypted">🔒</span>
                  )}
                  {isMessageDecrypting(message) && (
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-400"></div>
                  )}
                  {hasDecryptionError(message) && (
                    <span title="Decryption error">⚠️</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
} 