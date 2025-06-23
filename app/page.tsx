"use client";

import { useState, useEffect } from "react";
import KeyManager from "@/components/KeyManager";
import Identity from "@/components/Identity";
import RoomManager from "@/components/RoomManager";
import ChatInterface from "@/components/ChatInterface";
import BurnNotice from "@/components/BurnNotice";
import { IdentityKey } from "@/lib/types";
import storage from "@/lib/storage";

type AppState = "loading" | "identity" | "menu" | "chat" | "burn";

export default function AnoChat() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [currentIdentity, setCurrentIdentity] = useState<IdentityKey | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string>("");
  const [currentRoomName, setCurrentRoomName] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Check if we have any stored identities on startup
    checkForExistingIdentities();
  }, []);

  const checkForExistingIdentities = async () => {
    try {
      const identities = await storage.getAllIdentities();
      if (identities.length > 0) {
        setAppState("identity"); // Show identity manager to load existing
      } else {
        setAppState("identity"); // Show identity manager to create new
      }
    } catch (error) {
      setError(`Failed to check identities: ${error}`);
      setAppState("identity");
    }
  };

  const handleIdentityLoaded = (identity: IdentityKey) => {
    setCurrentIdentity(identity);
    setAppState("menu");
    setError("");
  };

  const handleRoomJoined = (roomId: string, roomName?: string) => {
    setCurrentRoomId(roomId);
    setCurrentRoomName(roomName || "");
    setAppState("chat");
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId("");
    setCurrentRoomName("");
    setAppState("menu");
  };

  const handleBurnNotice = () => {
    setAppState("burn");
  };

  const handleBurnComplete = () => {
    // Reset everything
    setCurrentIdentity(null);
    setCurrentRoomId("");
    setCurrentRoomName("");
    setError("");
    setAppState("identity");
  };

  const handleShowIdentity = () => {
    // Toggle between room manager and identity view
    setAppState(appState === "identity" ? "menu" : "identity");
  };

  if (appState === "loading") {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading AnoChat...</p>
        </div>
      </div>
    );
  }

  if (appState === "burn") {
    return <BurnNotice onComplete={handleBurnComplete} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              AnoChat
            </h1>
            <div className="text-xs text-gray-400">
              Anonymous • Encrypted • Zero-Knowledge
            </div>
          </div>
          
          {currentIdentity && appState !== "identity" && (
            <div className="flex items-center space-x-3">
              <button
                onClick={handleShowIdentity}
                className="text-gray-400 hover:text-gray-300 transition-colors text-sm"
              >
                👤 Identity
              </button>
              {appState === "chat" && (
                <button
                  onClick={handleLeaveRoom}
                  className="text-gray-400 hover:text-gray-300 transition-colors text-sm"
                >
                  ← Back
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-500 text-red-200 px-4 py-3">
          <div className="max-w-4xl mx-auto">
            {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {appState === "identity" && (
          <div className="p-8">
            {currentIdentity ? (
              <div className="grid md:grid-cols-2 gap-8">
                <KeyManager onIdentityLoaded={handleIdentityLoaded} />
                <Identity 
                  identity={currentIdentity} 
                  onBurnNotice={handleBurnNotice}
                />
              </div>
            ) : (
              <KeyManager onIdentityLoaded={handleIdentityLoaded} />
            )}
          </div>
        )}

        {appState === "menu" && currentIdentity && (
          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <RoomManager 
                identity={currentIdentity} 
                onRoomJoined={handleRoomJoined}
              />
              <Identity 
                identity={currentIdentity} 
                onBurnNotice={handleBurnNotice}
              />
            </div>
          </div>
        )}

        {appState === "chat" && currentIdentity && (
          <ChatInterface
            identity={currentIdentity}
            roomId={currentRoomId}
            roomName={currentRoomName}
            onLeaveRoom={handleLeaveRoom}
          />
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 mt-8">
        <div className="max-w-4xl mx-auto text-center text-xs text-gray-500">
          <div className="flex items-center justify-center space-x-4">
            <span>🔒 End-to-End Encrypted</span>
            <span>•</span>
            <span>🔐 Signal Protocol</span>
            <span>•</span>
            <span>👻 Anonymous</span>
            <span>•</span>
            <span>🌐 Zero-Knowledge</span>
          </div>
          <div className="mt-2">
            No data is stored on servers • Your privacy is guaranteed
          </div>
        </div>
      </div>
    </div>
  );
}
