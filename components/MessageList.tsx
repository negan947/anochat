"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent } from "./ui/Card";

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
}

export default function MessageList({ messages }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const messageDate = new Date(date);
    
    // Check if same day
    if (
      messageDate.getDate() === today.getDate() &&
      messageDate.getMonth() === today.getMonth() &&
      messageDate.getFullYear() === today.getFullYear()
    ) {
      return "Today";
    }
    
    // Check if yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      messageDate.getDate() === yesterday.getDate() &&
      messageDate.getMonth() === yesterday.getMonth() &&
      messageDate.getFullYear() === yesterday.getFullYear()
    ) {
      return "Yesterday";
    }
    
    // Otherwise show date
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    }).format(date);
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card variant="glass" className="max-w-md w-full">
          <CardContent className="text-center py-12 space-y-4">
            <div className="w-20 h-20 bg-anon-800/50 rounded-full flex items-center justify-center mx-auto">
              <span className="text-4xl">💬</span>
            </div>
            <h3 className="text-lg font-medium text-anon-200">
              No messages yet
            </h3>
            <p className="text-sm text-anon-400">
              Start the conversation with an encrypted message
            </p>
            <div className="flex items-center justify-center space-x-4 text-xs text-anon-500">
              <div className="flex items-center space-x-1">
                <span>🔒</span>
                <span>End-to-end encrypted</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>👻</span>
                <span>Anonymous</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <div className="max-w-4xl mx-auto">
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <div key={date} className="space-y-4">
            {/* Date Separator */}
            <div className="flex items-center justify-center my-6">
              <div className="bg-anon-800/80 backdrop-blur-sm px-4 py-1.5 rounded-full">
                <span className="text-xs text-anon-400 font-medium">{date}</span>
              </div>
            </div>
            
            {/* Messages for this date */}
            {dateMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isOwn ? "justify-end" : "justify-start"} mb-4`}
              >
                <div className={`max-w-[75%] md:max-w-[60%] ${message.isOwn ? "items-end" : "items-start"} space-y-1`}>
                  {/* Sender info */}
                  {!message.isOwn && (
                    <div className="flex items-center space-x-2 px-1">
                      <div className="w-6 h-6 bg-gradient-to-br from-phantom-400 to-phantom-600 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white font-bold">
                          {message.senderFingerprint.slice(0, 1).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-anon-400 font-mono">
                        {message.senderFingerprint.slice(0, 8)}...
                      </span>
                    </div>
                  )}
                  
                  {/* Message bubble */}
                  <div
                    className={`relative px-4 py-3 rounded-2xl ${
                      message.isOwn
                        ? "bg-gradient-to-br from-phantom-500 to-phantom-600 text-white"
                        : "bg-anon-800 text-anon-100 border border-anon-700"
                    }`}
                  >
                    {message.decryptionError ? (
                      <div className="flex items-center space-x-2 text-red-300">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span className="text-sm italic">Unable to decrypt message</span>
                      </div>
                    ) : (
                      <p className="text-sm md:text-base whitespace-pre-wrap break-words">
                        {message.decryptedContent || "Decrypting..."}
                      </p>
                    )}
                  </div>
                  
                  {/* Timestamp and status */}
                  <div className={`flex items-center space-x-2 px-1 ${
                    message.isOwn ? "justify-end" : "justify-start"
                  }`}>
                    <span className="text-xs text-anon-500">
                      {formatTime(message.timestamp)}
                    </span>
                    {message.isOwn && (
                      <svg className="w-3 h-3 text-anon-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
} 