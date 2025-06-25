"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { IdentityKey } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Tooltip } from "./ui/Tooltip";

interface IdentityProps {
  identity: IdentityKey;
  onBurnNotice: () => void;
}

export default function Identity({ identity, onBurnNotice }: IdentityProps) {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyFingerprint = async () => {
    try {
      await navigator.clipboard.writeText(identity.fingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Failed to copy
    }
  };

  const getContactQR = () => {
    try {
      // Return the raw data for QR code generation
      return JSON.stringify({
        fingerprint: identity.fingerprint,
        publicKey: btoa(String.fromCharCode(...identity.publicKey)),
        timestamp: Date.now()
      });
    } catch {
      return "";
    }
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="text-center bg-gradient-to-r from-secure-400 to-secure-600 bg-clip-text text-transparent">
          🔐 Your Chat Identity
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="text-center space-y-2">
          <p className="text-sm text-anon-400">
            This is your anonymous identity for secure chats
          </p>
        </div>

        {/* Identity Display */}
        <div className="space-y-4">
          {/* Visual Identity */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-secure-400 to-secure-600 rounded-2xl flex items-center justify-center shadow-xl">
                <span className="text-4xl text-white font-bold">
                  {identity.fingerprint.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-secure-500 rounded-full flex items-center justify-center border-4 border-anon-800">
                <span className="text-xs">🔒</span>
              </div>
            </div>
          </div>

          {/* Fingerprint */}
          <Card variant="glass">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-anon-400">Your ID:</span>
                <Tooltip content={copied ? "Copied!" : "Click to copy"}>
                  <button
                    onClick={copyFingerprint}
                    className="font-mono text-sm text-secure-300 hover:text-secure-200 transition-colors flex items-center space-x-2"
                  >
                    <span>{identity.fingerprint.slice(0, 16)}...</span>
                    {copied ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                    )}
                  </button>
                </Tooltip>
              </div>
              <div className="text-xs text-anon-500">
                Created: {new Date(identity.createdAt).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>

          {/* Share Identity */}
          <Button
            variant="ghost"
            onClick={() => setShowQR(!showQR)}
            className="w-full"
            icon={
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <rect x="7" y="7" width="3" height="3"/>
                <rect x="14" y="7" width="3" height="3"/>
                <rect x="7" y="14" width="3" height="3"/>
              </svg>
            }
          >
            {showQR ? "Hide" : "Show"} Identity QR Code
          </Button>

          {showQR && (
            <Card variant="glass">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs text-anon-400 text-center">
                  Friends can scan this to add you as a contact
                </p>
                <div className="bg-white p-4 rounded-lg">
                  <QRCode
                    value={getContactQR()}
                    size={180}
                    className="mx-auto"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Security Info */}
        <Card variant="bordered" className="border-anon-600/50 bg-anon-800/30">
          <CardContent className="p-3 space-y-2">
            <h4 className="text-sm font-medium text-anon-200 flex items-center space-x-2">
              <span>🛡️</span>
              <span>Security Features</span>
            </h4>
            <ul className="text-xs text-anon-400 space-y-1">
              <li className="flex items-center space-x-2">
                <span>✓</span>
                <span>End-to-end encrypted messages</span>
              </li>
              <li className="flex items-center space-x-2">
                <span>✓</span>
                <span>No personal information required</span>
              </li>
              <li className="flex items-center space-x-2">
                <span>✓</span>
                <span>Anonymous identity system</span>
              </li>
              <li className="flex items-center space-x-2">
                <span>✓</span>
                <span>Perfect forward secrecy</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Emergency Delete */}
        <div className="pt-4 border-t border-anon-700">
          <Button
            variant="ghost"
            onClick={onBurnNotice}
            className="w-full text-red-400 hover:text-red-300 hover:bg-red-900/20"
            icon={
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            }
          >
            Emergency Delete Everything
          </Button>
          <p className="text-xs text-anon-500 text-center mt-2">
            Instantly delete all messages, chats, and identity
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 