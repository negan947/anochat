"use client";

import { useState, useEffect } from "react";
import Welcome from "@/components/Welcome";
import QuickStart from "@/components/QuickStart";
import KeyManager from "@/components/KeyManager";
import Identity from "@/components/Identity";
import RoomManager from "@/components/RoomManager";
import ChatInterface from "@/components/ChatInterface";
import BurnNotice from "@/components/BurnNotice";
import { SessionIndicator } from "@/components/SessionIndicator";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import { IdentityKey } from "@/lib/types";
import storage from "@/lib/storage";
import { identityStore } from "@/lib/identity-store";

type AppState = "loading" | "welcome" | "quickstart" | "advanced" | "dashboard" | "chat" | "burn";

export default function AnoChat() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [currentIdentity, setCurrentIdentity] = useState<IdentityKey | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string>("");
  const [currentRoomName, setCurrentRoomName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after the initial render.
    // We can now safely use browser-specific APIs.
    setIsClient(true);
    
    const checkForExistingIdentities = async () => {
      setIsLoading(true);
      try {
        // Simulate loading time for better UX
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const identities = await storage.getAllIdentities();
        if (identities.length > 0) {
          setAppState("advanced"); // Show identity manager to load existing
        } else {
          setAppState("welcome"); // Show welcome screen for new users
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to check identities: ${errorMessage}`);
        setAppState("welcome");
      } finally {
        setIsLoading(false);
      }
    };

    checkForExistingIdentities();
  }, []);

  const handleWelcomeGetStarted = () => {
    setAppState("quickstart");
  };

  const handleWelcomeAdvanced = () => {
    setAppState("advanced");
  };

  const handleQuickStartBack = () => {
    setAppState("welcome");
  };

  const handleIdentityLoaded = (identity: IdentityKey) => {
    setCurrentIdentity(identity);
    identityStore.setActiveIdentity(identity);
    setAppState("dashboard");
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
    setAppState("dashboard");
  };

  const handleBurnNotice = () => {
    setAppState("burn");
  };

  const handleBurnComplete = () => {
    setCurrentIdentity(null);
    identityStore.setActiveIdentity(null);
    setCurrentRoomId("");
    setCurrentRoomName("");
    setError("");
    setAppState("welcome");
  };

  const handleShowIdentity = () => {
    setAppState(appState === "advanced" ? "dashboard" : "advanced");
  };

  // Loading state: always show this on server and first client render
  if (!isClient || appState === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-anon-900 text-anon-100 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4" variant="glass">
          <CardContent className="text-center space-y-6 py-8">
            <div className="w-16 h-16 mx-auto">
              <LoadingSpinner size="lg" variant="phantom" />
            </div>
            <div className="space-y-3">
              <h2 className="text-xl font-semibold bg-gradient-to-r from-phantom-400 to-phantom-600 bg-clip-text text-transparent">
                Welcome to AnoChat
              </h2>
              <p className="text-anon-400 text-sm">
                Preparing your secure anonymous messaging experience...
              </p>
            </div>
            <div className="flex items-center justify-center space-x-6 text-xs text-anon-500">
              <div className="flex items-center space-x-1">
                <span>🔒</span>
                <span>Encrypted</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>👻</span>
                <span>Anonymous</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>🌐</span>
                <span>Private</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Welcome screen for new users
  if (appState === "welcome") {
    return (
      <Welcome
        onGetStarted={handleWelcomeGetStarted}
        onAdvancedSetup={handleWelcomeAdvanced}
      />
    );
  }

  // Quick start flow for easy setup
  if (appState === "quickstart") {
    return (
      <QuickStart
        onIdentityCreated={handleIdentityLoaded}
        onBack={handleQuickStartBack}
      />
    );
  }

  // Burn notice state
  if (appState === "burn") {
    return <BurnNotice onComplete={handleBurnComplete} />;
  }

  // Chat state with loading skeleton
  if (appState === "chat" && currentIdentity) {
    return (
      <div className="flex flex-col h-screen">
        <ChatInterface
          identity={currentIdentity}
          roomId={currentRoomId}
          roomName={currentRoomName}
          onLeaveRoom={handleLeaveRoom}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-anon-900 text-anon-100">
      {/* Session Indicator */}
      <SessionIndicator />
      
      {/* Header */}
      <div className="bg-anon-800/80 backdrop-blur-lg border-b border-anon-700/50 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-phantom-500 to-phantom-700 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-phantom-400 to-phantom-600 bg-clip-text text-transparent">
                    AnoChat
                  </h1>
                  <div className="text-2xs text-anon-500 -mt-1">
                    Private • Encrypted • Anonymous
                  </div>
                </div>
              </div>
            </div>
            
            {currentIdentity && (
              <div className="flex items-center space-x-3">
                <Tooltip content="View your identity and security settings">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShowIdentity}
                    icon={
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    }
                  >
                    My Identity
                  </Button>
                </Tooltip>
                
                {appState === "chat" && (
                  <Tooltip content="Return to dashboard">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLeaveRoom}
                      icon={
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                      }
                    >
                      Dashboard
                    </Button>
                  </Tooltip>
                )}

                <Tooltip content="Emergency delete all data">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBurnNotice}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    icon={
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    }
                  >
                    Emergency Delete
                  </Button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-500/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center space-x-2 text-red-200">
              <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span className="text-sm">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError("")}
                className="ml-auto"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {appState === "advanced" && (
          <div className="space-y-8">
            {currentIdentity ? (
              <div className="grid lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <KeyManager onIdentityLoaded={handleIdentityLoaded} />
                </div>
                <div className="space-y-6">
                  <Identity 
                    identity={currentIdentity} 
                    onBurnNotice={handleBurnNotice}
                  />
                </div>
              </div>
            ) : (
              <div className="max-w-lg mx-auto">
                <KeyManager onIdentityLoaded={handleIdentityLoaded} />
              </div>
            )}
          </div>
        )}

        {appState === "dashboard" && currentIdentity && (
          <div className="space-y-8">
            {/* Welcome Message */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-anon-100">
                Welcome back! 👋
              </h2>
              <p className="text-anon-400">
                Ready to start a private conversation?
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <RoomManager 
                  identity={currentIdentity} 
                  onRoomJoined={handleRoomJoined}
                />
              </div>
              <div className="space-y-6">
                <Identity 
                  identity={currentIdentity} 
                  onBurnNotice={handleBurnNotice}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-anon-800/50 border-t border-anon-700/50 backdrop-blur-sm mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center justify-center space-x-2 text-secure-400">
                <span>🔒</span>
                <span>End-to-End Encrypted</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-phantom-400">
                <span>🔐</span>
                <span>Signal Protocol</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-anon-400">
                <span>👻</span>
                <span>Anonymous</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-anon-400">
                <span>🌐</span>
                <span>Zero-Knowledge</span>
              </div>
            </div>
            <div className="text-2xs text-anon-500 max-w-2xl mx-auto">
              Your privacy is guaranteed • Messages encrypted on your device • 
              No data stored on servers
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
