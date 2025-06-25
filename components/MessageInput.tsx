"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "./ui/Button";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
}

export default function MessageInput({ 
  onSendMessage, 
  placeholder = "Type a message..." 
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage("");
      setIsTyping(false);
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
    setIsTyping(value.length > 0);
  };

  return (
    <div className="bg-anon-800/90 backdrop-blur-sm border-t border-anon-700 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              value={message}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              className="w-full bg-anon-900 border border-anon-600 text-anon-100 px-4 py-3 pr-12 rounded-xl resize-none focus:outline-none focus:border-phantom-500 focus:ring-2 focus:ring-phantom-500/20 transition-all duration-200 min-h-[48px] max-h-[120px] overflow-y-auto text-sm md:text-base"
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
            {isTyping && (
              <div className="absolute bottom-2 right-2 text-xs text-anon-500">
                {message.length}
              </div>
            )}
          </div>
          
          <Button
            variant="phantom"
            onClick={handleSend}
            disabled={!message.trim()}
            className="h-12 w-12 p-0 rounded-lg"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            }
          />
        </div>
        
        {/* Formatting hint */}
        <div className="mt-2 text-xs text-anon-500">
          Press <kbd className="px-1.5 py-0.5 bg-anon-700 rounded text-anon-300">Enter</kbd> to send, 
          <kbd className="px-1.5 py-0.5 bg-anon-700 rounded text-anon-300 ml-1">Shift + Enter</kbd> for new line
        </div>
      </div>
    </div>
  );
} 