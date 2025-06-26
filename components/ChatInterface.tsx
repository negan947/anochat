"use client";

import { useState, useEffect, useRef } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Tooltip } from "./ui/Tooltip";
import { IdentityKey } from "@/lib/types";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { getConnectionStatus } from "@/lib/supabase";
import storage from "@/lib/storage";

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
  const [recipientFingerprint, setRecipientFingerprint] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "error">("connecting");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ensure user is authenticated with Supabase
  const { isAuthenticated, loading: authLoading, error: authError } = useAuth();

  // Get recipient fingerprint from room participants
  useEffect(() => {
    const loadRecipientFingerprint = async () => {
      try {
        const room = await storage.getRoom(roomId);
        if (room && room.participants.length > 1) {
          // Find the participant that isn't us
          const recipient = room.participants.find(fp => fp !== identity.fingerprint);
          if (recipient) {
            setRecipientFingerprint(recipient);
          }
        }
      } catch (error) {
        console.error("Failed to load recipient fingerprint:", error);
      }
    };

    loadRecipientFingerprint();
  }, [roomId, identity.fingerprint]);

  // Use the real messaging hook
  const {
    messages,
    loading,
    error,
    pendingCount,
    typingUsers,
    isSending,
    sendMessage,
    setTyping,
    retryFailed,
    clearQueue,
  } = useMessages({
    roomId,
    senderFingerprint: identity.fingerprint,
    recipientFingerprint,
  });

  // Monitor connection status
  useEffect(() => {
    const checkConnection = () => {
      const status = getConnectionStatus();
      setConnectionStatus(status === "connected" ? "connected" : 
                         status === "connecting" ? "connecting" : "error");
    };

    // Check immediately
    checkConnection();

    // Check periodically
    const interval = setInterval(checkConnection, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    const success = await sendMessage(content);
    if (success) {
      // Update room's last message timestamp
      await storage.updateRoomLastMessage(roomId);
    }
  };

  const handleLeaveRoom = () => {
    if (confirm("Leave this chat? You'll need the invite code to rejoin.")) {
      clearQueue();
      onLeaveRoom();
    }
  };

  // Transform messages to the format expected by MessageList
  const formattedMessages = messages.map(msg => ({
    id: msg.id,
    roomId: msg.room_id,
    senderFingerprint: msg.sender_fingerprint,
    ciphertext: { type: 1, body: "" }, // Not needed for display
    timestamp: new Date(msg.timestamp),
    decryptedContent: msg.content,
    isOwn: msg.sender_fingerprint === identity.fingerprint,
  }));

  // Determine if messaging should be disabled
  const isMessagingDisabled = !isAuthenticated || authLoading || isSending || 
                             connectionStatus !== "connected" || !recipientFingerprint;

  // Determine the specific reason for being disabled
  const getDisabledReason = () => {
    if (authLoading) return "Authenticating...";
    if (!isAuthenticated) return "Authentication required";
    if (connectionStatus === "connecting") return "Connecting to server...";
    if (connectionStatus === "error") return "Connection error - check your internet";
    if (!recipientFingerprint) return "Waiting for someone to join the chat...";
    if (isSending) return "Sending message...";
    return "Cannot send messages right now...";
  };

  // Debug logging to help identify the issue
  useEffect(() => {
    console.log("Chat Interface Debug:", {
      isAuthenticated,
      authLoading,
      isSending,
      connectionStatus,
      recipientFingerprint,
      roomId,
      participants: recipientFingerprint ? "found" : "not found",
      isMessagingDisabled
    });
  }, [isAuthenticated, authLoading, isSending, connectionStatus, recipientFingerprint, roomId, isMessagingDisabled]);

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
                  !isAuthenticated ? "bg-amber-400 animate-pulse" :
                  connectionStatus === "connected" ? "bg-secure-400" : 
                  connectionStatus === "connecting" ? "bg-amber-400 animate-pulse" : 
                  "bg-red-400"
                }`} />
                <span className={`${
                  !isAuthenticated ? "text-amber-400" :
                  connectionStatus === "connected" ? "text-secure-400" : 
                  connectionStatus === "connecting" ? "text-amber-400" : 
                  "text-red-400"
                }`}>
                  {!isAuthenticated ? "Authenticating..." :
                   connectionStatus === "connected" ? "Encrypted & Connected" : 
                   connectionStatus === "connecting" ? "Connecting..." : 
                   "Connection Error"}
                </span>
                {pendingCount > 0 && (
                  <span className="text-amber-400 text-xs">
                    ({pendingCount} pending)
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {pendingCount > 0 && (
              <Tooltip content="Retry sending failed messages">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={retryFailed}
                  className="text-amber-400"
                  icon={
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  }
                />
              </Tooltip>
            )}
            
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

      {/* Error Display */}
      {(error || authError) && (
        <div className="bg-red-900/50 border-b border-red-500/50 px-4 py-2">
          <div className="max-w-6xl mx-auto flex items-center space-x-2 text-red-200 text-sm">
            <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>{error || authError}</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        {loading || authLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-anon-400 text-sm">
              {authLoading ? "Authenticating..." : "Loading messages..."}
            </div>
          </div>
        ) : (
          <>
            <MessageList messages={formattedMessages} />
            {typingUsers.length > 0 && (
              <div className="px-4 py-2 text-xs text-anon-400 italic">
                {typingUsers.length === 1 ? "Someone is typing..." : "Multiple people are typing..."}
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <MessageInput 
        onSendMessage={handleSendMessage}
        placeholder="Type your message..."
        disabled={isMessagingDisabled}
        onTyping={setTyping}
        disabledReason={getDisabledReason()}
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