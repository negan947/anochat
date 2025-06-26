"use client";

import { useState, KeyboardEvent, useEffect, useRef } from "react";
import { Button } from "./ui/Button";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onTyping?: (isTyping: boolean) => void;
  disabledReason?: string;
}

export default function MessageInput({ 
  onSendMessage, 
  placeholder = "Type a message...",
  disabled = false,
  onTyping,
  disabledReason
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
      
      // Clear typing status
      if (onTyping) {
        onTyping(false);
      }
      
      // Clear any pending typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (value: string) => {
    setMessage(value);
    
    // Handle typing indicator
    if (onTyping) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      if (value.length > 0) {
        // Set typing to true
        onTyping(true);
        
        // Auto-clear typing after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          onTyping(false);
        }, 2000);
      } else {
        // Clear typing immediately if input is empty
        onTyping(false);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (onTyping) {
        onTyping(false);
      }
    };
  }, [onTyping]);

  return (
    <div className="bg-anon-800/90 backdrop-blur-sm border-t border-anon-700 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              value={message}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? (disabledReason || "Cannot send messages right now...") : placeholder}
              disabled={disabled}
              rows={1}
              className={`w-full bg-anon-900 border text-anon-100 px-4 py-3 pr-12 rounded-xl resize-none focus:outline-none transition-all duration-200 min-h-[48px] max-h-[120px] overflow-y-auto text-sm md:text-base ${
                disabled 
                  ? "border-anon-700 opacity-50 cursor-not-allowed" 
                  : "border-anon-600 focus:border-phantom-500 focus:ring-2 focus:ring-phantom-500/20"
              }`}
              style={{
                height: "auto",
                minHeight: "48px",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            
            {/* Character indicator */}
            {message.length > 0 && !disabled && (
              <div className="absolute bottom-2 right-2 text-xs text-anon-500">
                {message.length}
              </div>
            )}
          </div>
          
          <Button
            variant="phantom"
            onClick={handleSend}
            disabled={!message.trim() || disabled}
            className="h-12 w-12 p-0 rounded-lg"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            }
          />
        </div>
        
        {/* Formatting hint */}
        {!disabled && (
          <div className="mt-2 text-xs text-anon-500">
            Press <kbd className="px-1.5 py-0.5 bg-anon-700 rounded text-anon-300">Enter</kbd> to send, 
            <kbd className="px-1.5 py-0.5 bg-anon-700 rounded text-anon-300 ml-1">Shift + Enter</kbd> for new line
          </div>
        )}
      </div>
    </div>
  );
} 