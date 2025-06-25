"use client";

import { useState, useEffect } from "react";
import { 
  initCrypto,
  createIdentity,
  generateRoomId,
  randomBytes,
  uint8ArrayToBase64
} from "@/lib/crypto";
import { generateRoomInvite } from "@/lib/key-exchange";
import { initSignalProtocol } from "@/lib/signal-protocol";
import storage from "@/lib/storage";
import { IdentityKey } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { LoadingSpinner } from "./ui/LoadingSpinner";
import QRCode from "react-qr-code";

interface QuickStartProps {
  onIdentityCreated: (identity: IdentityKey) => void;
  onBack: () => void;
}

type QuickStartStep = "setup" | "identity" | "ready";

export default function QuickStart({ onIdentityCreated, onBack }: QuickStartProps) {
  const [currentStep, setCurrentStep] = useState<QuickStartStep>("setup");
  const [identity, setIdentity] = useState<IdentityKey | null>(null);
  const [inviteLink, setInviteLink] = useState<string>("");
  const [autoPassphrase, setAutoPassphrase] = useState<string>("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    initializeQuickStart();
  }, []);

  const initializeQuickStart = async () => {
    setIsLoading(true);
    try {
      await initCrypto();
      await initSignalProtocol();
      
      // Generate a secure auto-passphrase
      const randomData = randomBytes(32);
      const passphrase = uint8ArrayToBase64(randomData).slice(0, 24); // 24 chars, secure
      setAutoPassphrase(passphrase);
      
      setCurrentStep("identity");
    } catch (error) {
      setError(`Setup failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createIdentityAndRoom = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      // Create identity with auto-generated passphrase
      const newIdentity = await createIdentity(autoPassphrase);
      setIdentity(newIdentity);
      
      // Create a default room
      const newRoomId = generateRoomId();
      
      // Save room to storage
      await storage.saveRoom(
        newRoomId,
        "My Chat Room",
        [newIdentity.fingerprint]
      );
      
      // Generate invite link
      const invite = await generateRoomInvite(newIdentity, newRoomId);
      setInviteLink(invite.qrCode);
      
      setCurrentStep("ready");
    } catch (error) {
      setError(`Failed to create identity: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartChatting = () => {
    if (identity) {
      onIdentityCreated(identity);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add toast notification here
    } catch {
      setError("Failed to copy to clipboard");
    }
  };

  const downloadPassphrase = () => {
    const element = document.createElement("a");
    const file = new Blob([`AnoChat Recovery Passphrase\n\nYour Passphrase: ${autoPassphrase}\n\nKeep this safe! You'll need it to access your chat identity.\n\nDate: ${new Date().toISOString()}`], 
      {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "anochat-recovery-passphrase.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (currentStep === "setup" || isLoading) {
    return (
      <div className="min-h-screen bg-anon-900 text-anon-100 flex items-center justify-center px-4">
        <Card variant="glass" className="max-w-md w-full">
          <CardContent className="text-center space-y-6 py-8">
            <LoadingSpinner size="lg" variant="phantom" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Setting up your secure chat</h2>
              <p className="text-anon-400 text-sm">
                Initializing encryption and creating your anonymous identity...
              </p>
            </div>
            {error && (
              <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-anon-900 text-anon-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-phantom-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
              ✓
            </div>
            <span className="text-phantom-300 text-sm">Setup</span>
          </div>
          
          <div className="w-12 h-0.5 bg-phantom-500"></div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              currentStep === "ready" ? "bg-phantom-500 text-white" : "bg-anon-700 text-anon-400"
            }`}>
              {currentStep === "ready" ? "✓" : "2"}
            </div>
            <span className={`text-sm ${
              currentStep === "ready" ? "text-phantom-300" : "text-anon-400"
            }`}>Identity</span>
          </div>
          
          <div className={`w-12 h-0.5 ${
            currentStep === "ready" ? "bg-phantom-500" : "bg-anon-700"
          }`}></div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              currentStep === "ready" ? "bg-phantom-500 text-white" : "bg-anon-700 text-anon-400"
            }`}>
              3
            </div>
            <span className={`text-sm ${
              currentStep === "ready" ? "text-phantom-300" : "text-anon-400"
            }`}>Ready</span>
          </div>
        </div>

        {currentStep === "identity" && (
          <Card variant="elevated" className="text-center">
            <CardHeader>
              <CardTitle className="bg-gradient-to-r from-phantom-400 to-phantom-600 bg-clip-text text-transparent">
                Create Your Anonymous Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-anon-300">
                We&apos;ll create a secure, anonymous identity for you. This is like your private key to encrypted conversations.
              </p>

              <Card variant="glass" className="border-amber-700/50 bg-amber-950/20">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-amber-200">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span className="font-medium">Important: Save Your Recovery Key</span>
                  </div>
                  <p className="text-sm text-amber-200">
                    We&apos;ve generated a secure recovery passphrase for you. Save it now - you&apos;ll need it if you want to access your chats from another device.
                  </p>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      icon={
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      }
                    >
                      {showPassphrase ? "Hide" : "Show"} Passphrase
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={downloadPassphrase}
                      icon={
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                          <polyline points="7,10 12,15 17,10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                      }
                    >
                      Download
                    </Button>
                  </div>
                  
                  {showPassphrase && (
                    <div className="bg-anon-900 p-3 rounded border font-mono text-sm text-anon-200 break-all">
                      {autoPassphrase}
                    </div>
                  )}
                </CardContent>
              </Card>

              {error && (
                <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex space-x-4">
                <Button
                  variant="ghost"
                  onClick={onBack}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  variant="phantom"
                  onClick={createIdentityAndRoom}
                  disabled={isLoading}
                  loading={isLoading}
                  className="flex-1"
                >
                  Create Identity
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === "ready" && identity && (
          <Card variant="elevated" className="text-center">
            <CardHeader>
              <CardTitle className="bg-gradient-to-r from-secure-400 to-secure-600 bg-clip-text text-transparent">
                🎉 You&apos;re Ready to Chat!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-anon-300">
                Your anonymous identity has been created. You can now start chatting privately or invite friends to join you.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <Card variant="glass">
                  <CardContent className="p-4 space-y-4">
                    <h3 className="font-medium text-anon-200">Invite a Friend</h3>
                    <p className="text-sm text-anon-400">
                      Share this code with someone to start a private conversation
                    </p>
                    
                    <div className="bg-white p-3 rounded-lg">
                      <QRCode
                        value={inviteLink}
                        size={120}
                        className="mx-auto"
                      />
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(inviteLink)}
                      className="w-full"
                      icon={
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                      }
                    >
                      Copy Invite Link
                    </Button>
                  </CardContent>
                </Card>

                <Card variant="glass">
                  <CardContent className="p-4 space-y-4">
                    <h3 className="font-medium text-anon-200">Your Chat Identity</h3>
                    <p className="text-sm text-anon-400">
                      Your anonymous identifier (first 8 characters)
                    </p>
                    
                    <div className="bg-anon-800 p-3 rounded-lg">
                      <div className="font-mono text-sm text-phantom-300">
                        {identity.fingerprint.slice(0, 8)}...
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-xs text-secure-400">
                      <span>🔒</span>
                      <span>Encrypted & Anonymous</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Button
                variant="secure"
                size="lg"
                onClick={handleStartChatting}
                className="w-full"
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                }
              >
                Start Chatting
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 