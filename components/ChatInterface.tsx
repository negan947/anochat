"use client";

import { useState, useEffect } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { IdentityKey } from "@/lib/types";
import { generateFingerprint } from "@/lib/crypto";
import {
  initSignalProtocol,
  hasSession,
  generatePreKeyBundle,
  processPreKeyBundle
} from "@/lib/signal-protocol";

interface Message {
  id: string;
  roomId: string;
  senderFingerprint: string;
  ciphertext: { type: number; body: string };
  timestamp: Date;
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
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [typingUsers] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState("");

  // For demo purposes, we'll simulate a recipient fingerprint
  // In a real implementation, this would come from the room participants
  const [recipientFingerprint] = useState(() => {
    // Generate a mock recipient fingerprint for demonstration
    return generateFingerprint(new Uint8Array(32).fill(1)); // Mock data
  });

  useEffect(() => {
    // Initialize chat room
    initializeChatRoom();
    
    // Cleanup on unmount
    return () => {
      // Clean up any subscriptions or connections
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const initializeChatRoom = async () => {
    try {
      setIsConnected(true);
      setParticipants([identity.fingerprint, recipientFingerprint]);
      
      // Ensure Signal Protocol is ready
      await initSignalProtocol();

      // For demo purposes establish a local session with the simulated recipient
      const sessionExists = await hasSession(recipientFingerprint, 1);
      if (!sessionExists) {
        // Use our own identity keys to fabricate a bundle the other side would
        // normally provide. This is *only* for the local-demo environment and
        // should be replaced with the real remote bundle exchange.
        const preKeyBundle = await generatePreKeyBundle(identity);
        await processPreKeyBundle(recipientFingerprint, 1, preKeyBundle);
      }
      
      // In a real implementation, you would:
      // 1. Subscribe to real-time updates from Supabase
      // 2. Load existing messages from the database
      // 3. Set up typing indicators
      
      // For now, we'll simulate with some example messages
      loadExistingMessages();
      
    } catch (error) {
      setConnectionError(`Failed to initialize chat: ${error}`);
      setIsConnected(false);
    }
  };

  const loadExistingMessages = () => {
    // Simulate loading existing messages
    // In real implementation, this would query Supabase
    const exampleMessages: Message[] = [
      {
        id: "1",
        roomId,
        senderFingerprint: recipientFingerprint,
        ciphertext: { 
          type: 1, 
          body: "SGVsbG8sIHRoaXMgaXMgYSBzaW11bGF0ZWQgZW5jcnlwdGVkIG1lc3NhZ2U=" // Base64 encoded
        },
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        isOwn: false
      }
    ];
    
    setMessages(exampleMessages);
  };

  const handleSendMessage = async (encryptedMessage: { type: number; body: string }) => {
    try {
      const newMessage: Message = {
        id: `msg_${Date.now()}`,
        roomId,
        senderFingerprint: identity.fingerprint,
        ciphertext: encryptedMessage,
        timestamp: new Date(),
        isOwn: true
      };

      // Add message to local state immediately for instant feedback
      setMessages(prev => [...prev, newMessage]);

      // In a real implementation, you would:
      // 1. Insert the encrypted message to Supabase
      // 2. Handle delivery confirmation
      // 3. Update message status
      
      console.log("Message sent:", {
        roomId,
        senderFingerprint: identity.fingerprint,
        encryptedBody: encryptedMessage.body.slice(0, 50) + "...",
        timestamp: newMessage.timestamp
      });

    } catch (error) {
      setConnectionError(`Failed to send message: ${error}`);
    }
  };

  const handleLeaveRoom = () => {
    if (confirm("Leave this room? You'll need an invite to rejoin.")) {
      onLeaveRoom();
    }
  };

  const formatParticipants = () => {
    return participants.map(p => 
      p === identity.fingerprint ? "You" : `${p.slice(0, 6)}...${p.slice(-4)}`
    ).join(", ");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Chat Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-100">
              {roomName || "Anonymous Room"}
            </h1>
            <div className="text-sm text-gray-400">
              {participants.length} participant(s) • {formatParticipants()}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Connection Status */}
            <div className={`flex items-center space-x-1 text-xs ${
              isConnected ? 'text-green-400' : 'text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              }`}></div>
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            {/* Leave Room Button */}
            <button
              onClick={handleLeaveRoom}
              className="text-gray-400 hover:text-gray-300 transition-colors p-1"
              title="Leave room"
            >
              ←
            </button>
          </div>
        </div>
        
        {/* Room ID */}
        <div className="mt-2 text-xs text-gray-500">
          Room ID: {roomId.slice(0, 8)}...{roomId.slice(-8)}
        </div>
        
        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="mt-2 text-xs text-gray-400 italic">
            {typingUsers.join(", ")} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
      </div>

      {/* Connection Error */}
      {connectionError && (
        <div className="bg-red-900/50 border-b border-red-500 text-red-200 px-4 py-2 text-sm">
          {connectionError}
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={messages}
        currentUserFingerprint={identity.fingerprint}
        roomId={roomId}
      />

      {/* Message Input */}
      <MessageInput
        roomId={roomId}
        recipientFingerprint={recipientFingerprint}
        onSendMessage={handleSendMessage}
        isConnected={isConnected}
      />

      {/* Security Footer */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
        <div className="text-xs text-gray-500 text-center">
          <span className="inline-flex items-center space-x-2">
            <span>🔒</span>
            <span>End-to-end encrypted</span>
            <span>•</span>
            <span>Zero-knowledge</span>
            <span>•</span>
            <span>Anonymous</span>
          </span>
        </div>
      </div>
    </div>
  );
} 