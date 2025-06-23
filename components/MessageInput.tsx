"use client";

import { useState, useRef, useEffect } from "react";
import { encryptMessage } from "@/lib/signal-protocol";

interface MessageInputProps {
  roomId: string;
  recipientFingerprint: string;
  onSendMessage: (encryptedMessage: { type: number; body: string }) => void;
  isConnected: boolean;
}

export default function MessageInput({ 
  roomId, 
  recipientFingerprint, 
  onSendMessage, 
  isConnected 
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || isEncrypting || !isConnected) return;

    setError("");
    setIsEncrypting(true);

    try {
      // Encrypt message using Signal Protocol
      const encryptedMessage = await encryptMessage(
        recipientFingerprint,
        1, // device ID
        message.trim()
      );

      // Send encrypted message
      onSendMessage(encryptedMessage);
      
      // Clear input
      setMessage("");
      
    } catch (error) {
      setError(`Failed to send message: ${error}`);
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getPlaceholderText = () => {
    if (!isConnected) return "Connecting...";
    if (isEncrypting) return "Encrypting message...";
    return "Type your message... (Enter to send, Shift+Enter for new line)";
  };

  const getConnectionStatus = () => {
    if (!isConnected) return "🔴 Disconnected";
    if (isEncrypting) return "🔒 Encrypting...";
    return "🟢 Connected • E2EE Active";
  };

  return (
    <div className="bg-gray-800 border-t border-gray-700 p-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-400">
          {getConnectionStatus()}
        </div>
        <div className="text-xs text-gray-500">
          Room: {roomId.slice(0, 8)}...
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-3 py-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      {/* Message Input Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex space-x-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={getPlaceholderText()}
              disabled={!isConnected || isEncrypting}
              rows={1}
              className="w-full bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              style={{
                minHeight: "40px",
                maxHeight: "120px",
              }}
            />
          </div>
          
          <button
            type="submit"
            disabled={!message.trim() || isEncrypting || !isConnected}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center min-w-[80px]"
          >
            {isEncrypting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              "Send"
            )}
          </button>
        </div>

        {/* Message Info */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-2">
            <span>🔒 End-to-end encrypted</span>
            <span>•</span>
            <span>{message.length} characters</span>
          </div>
          
          {message.length > 0 && (
            <button
              type="button"
              onClick={() => setMessage("")}
              className="text-gray-500 hover:text-gray-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Security Notice */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        <span className="inline-flex items-center">
          🛡️ Messages are encrypted with Signal Protocol • Zero-knowledge • Forward secrecy
        </span>
      </div>
    </div>
  );
} 