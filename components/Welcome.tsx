"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";

interface WelcomeProps {
  onGetStarted: () => void;
  onAdvancedSetup: () => void;
}

export default function Welcome({ onGetStarted, onAdvancedSetup }: WelcomeProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="min-h-screen bg-anon-900 text-anon-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-phantom-500 to-phantom-700 rounded-2xl flex items-center justify-center shadow-2xl">
              <span className="text-white font-bold text-2xl">A</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-phantom-400 to-phantom-600 bg-clip-text text-transparent">
                AnoChat
              </h1>
              <p className="text-anon-400 text-lg">Private messaging made simple</p>
            </div>
          </div>

          <p className="text-xl text-anon-200 max-w-lg mx-auto leading-relaxed">
            Chat privately with friends using military-grade encryption. 
            No accounts, no tracking, no data collection.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card variant="glass" className="text-center">
            <CardContent className="pt-6 space-y-3">
              <div className="w-12 h-12 bg-secure-500/20 rounded-xl flex items-center justify-center mx-auto">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="font-semibold text-secure-300">Encrypted</h3>
              <p className="text-sm text-anon-400">
                Messages are encrypted before leaving your device
              </p>
            </CardContent>
          </Card>

          <Card variant="glass" className="text-center">
            <CardContent className="pt-6 space-y-3">
              <div className="w-12 h-12 bg-phantom-500/20 rounded-xl flex items-center justify-center mx-auto">
                <span className="text-2xl">👻</span>
              </div>
              <h3 className="font-semibold text-phantom-300">Anonymous</h3>
              <p className="text-sm text-anon-400">
                No usernames, emails, or personal information required
              </p>
            </CardContent>
          </Card>

          <Card variant="glass" className="text-center">
            <CardContent className="pt-6 space-y-3">
              <div className="w-12 h-12 bg-anon-500/20 rounded-xl flex items-center justify-center mx-auto">
                <span className="text-2xl">🌐</span>
              </div>
              <h3 className="font-semibold text-anon-300">Zero-Knowledge</h3>
              <p className="text-sm text-anon-400">
                We can&apos;t read your messages even if we wanted to
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="text-center">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div className="space-y-3">
                <div className="w-10 h-10 bg-gradient-to-br from-phantom-500 to-phantom-600 rounded-full flex items-center justify-center mx-auto text-white font-bold">
                  1
                </div>
                <h4 className="font-medium text-anon-200">Quick Setup</h4>
                <p className="text-sm text-anon-400">
                  Create your anonymous chat identity in seconds
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="w-10 h-10 bg-gradient-to-br from-phantom-500 to-phantom-600 rounded-full flex items-center justify-center mx-auto text-white font-bold">
                  2
                </div>
                <h4 className="font-medium text-anon-200">Connect</h4>
                <p className="text-sm text-anon-400">
                  Share a simple link or QR code with your friend
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="w-10 h-10 bg-gradient-to-br from-phantom-500 to-phantom-600 rounded-full flex items-center justify-center mx-auto text-white font-bold">
                  3
                </div>
                <h4 className="font-medium text-anon-200">Chat Privately</h4>
                <p className="text-sm text-anon-400">
                  Start messaging with complete privacy and security
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="phantom"
            size="lg"
            onClick={onGetStarted}
            className="text-lg px-8 py-4"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            }
          >
            Get Started
          </Button>
          
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setShowDetails(!showDetails)}
            className="text-lg px-8 py-4"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            }
          >
            Learn More
          </Button>
        </div>

        {/* Detailed Information (Expandable) */}
        {showDetails && (
          <Card variant="glass" className="mt-8">
            <CardContent className="space-y-6 pt-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-secure-300 flex items-center space-x-2">
                    <span>🔐</span>
                    <span>Security Details</span>
                  </h3>
                  <ul className="text-sm text-anon-300 space-y-2">
                    <li>• Uses Signal Protocol for encryption</li>
                    <li>• Perfect forward secrecy</li>
                    <li>• No message history stored on servers</li>
                    <li>• Open source and auditable</li>
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-phantom-300 flex items-center space-x-2">
                    <span>🛡️</span>
                    <span>Privacy Features</span>
                  </h3>
                  <ul className="text-sm text-anon-300 space-y-2">
                    <li>• Anonymous identities</li>
                    <li>• No IP address logging</li>
                    <li>• Ephemeral session IDs</li>
                    <li>• Emergency burn notice</li>
                  </ul>
                </div>
              </div>
              
              <div className="pt-4 border-t border-anon-700">
                <p className="text-xs text-anon-500 text-center">
                  Need advanced settings? Use 
                  <button 
                    onClick={onAdvancedSetup}
                    className="text-phantom-400 hover:text-phantom-300 ml-1 underline"
                  >
                    Advanced Setup
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-anon-500 pt-8">
          <p>No cookies • No tracking • No data collection • Open source</p>
        </div>
      </div>
    </div>
  );
} 