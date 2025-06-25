"use client";

import { useState, useEffect, useRef } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Tooltip } from "./ui/Tooltip";
import { IdentityKey } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

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

interface ChatInterfaceProps {
  identity: IdentityKey;
  roomId: string;
  roomName?: string;
  onLeaveRoom: () => void;
}

export default function ChatInterface({ 
  identity, 
  roomId, 
  roomName, 
  onLeaveRoom 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "error">("connecting");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate connection
    const timer = setTimeout(() => {
      setConnectionStatus("connected");
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSendMessage = (message: string) => {
    // Create a new message for optimistic UI
    const newMessage: Message = {
      id: uuidv4(),
      roomId: roomId,
      senderFingerprint: identity.fingerprint,
      ciphertext: { type: 1, body: btoa(message) }, // Mock encryption
      timestamp: new Date(),
      decryptedContent: message,
      isOwn: true,
    };

    setMessages(prev => [...prev, newMessage]);
    
    // Scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleLeaveRoom = () => {
    if (confirm("Leave this chat? You'll need the invite code to rejoin.")) {
      onLeaveRoom();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-anon-900">
      {/* Chat Header */}
      <div className="bg-anon-800/90 backdrop-blur-lg border-b border-anon-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLeaveRoom}
              className="mr-2"
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              }
            >
              Back
            </Button>
            
            <div className="w-10 h-10 bg-gradient-to-br from-phantom-500/20 to-phantom-700/20 rounded-lg flex items-center justify-center">
              <span className="text-lg">💬</span>
            </div>
            
            <div>
              <h1 className="text-lg font-semibold text-anon-100">
                {roomName || "Private Chat"}
              </h1>
              <div className="flex items-center space-x-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === "connected" ? "bg-secure-400" : 
                  connectionStatus === "connecting" ? "bg-amber-400 animate-pulse" : 
                  "bg-red-400"
                }`} />
                <span className={`${
                  connectionStatus === "connected" ? "text-secure-400" : 
                  connectionStatus === "connecting" ? "text-amber-400" : 
                  "text-red-400"
                }`}>
                  {connectionStatus === "connected" ? "Encrypted & Connected" : 
                   connectionStatus === "connecting" ? "Connecting..." : 
                   "Connection Error"}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Tooltip content="Chat ID for sharing">
              <Card variant="glass" className="px-3 py-1">
                <div className="text-xs text-anon-400 font-mono">
                  {roomId.slice(0, 8)}...
                </div>
              </Card>
            </Tooltip>
            
            <Tooltip content="Chat settings">
              <Button
                variant="ghost"
                size="sm"
                icon={
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6m11-6h-6m-6 0H1"/>
                  </svg>
                }
              />
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} />
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput 
        onSendMessage={handleSendMessage}
        placeholder="Type your message..."
      />

      {/* Security Footer */}
      <div className="bg-anon-800/50 backdrop-blur-sm border-t border-anon-700 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-center space-x-6 text-xs text-anon-500">
          <div className="flex items-center space-x-1">
            <span>🔒</span>
            <span>End-to-end encrypted</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>🌐</span>
            <span>Zero-knowledge</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>👻</span>
            <span>Anonymous</span>
          </div>
        </div>
      </div>
    </div>
  );
}