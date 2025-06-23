"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { IdentityKey } from "@/lib/types";
import { getOrCreateSessionId } from "@/lib/crypto";

interface IdentityProps {
  identity: IdentityKey;
  onBurnNotice: () => void;
}

export default function Identity({ identity, onBurnNotice }: IdentityProps) {
  const [showQR, setShowQR] = useState(false);
  const [showFingerprint, setShowFingerprint] = useState(false);
  
  const sessionId = getOrCreateSessionId();
  const truncatedFingerprint = `${identity.fingerprint.slice(0, 8)}...${identity.fingerprint.slice(-8)}`;
  const truncatedSession = `${sessionId.slice(0, 8)}...${sessionId.slice(-8)}`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
    } catch (error) {
      console.error(`Failed to copy ${label}:`, error);
    }
  };

  const handleBurnNotice = () => {
    if (confirm("⚠️ BURN NOTICE\n\nThis will permanently delete:\n- All stored identities\n- All room data\n- All messages\n- Current session\n\nThis action cannot be undone. Continue?")) {
      onBurnNotice();
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-3 flex items-center justify-center">
          <span className="text-2xl">👤</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-100">Anonymous Identity</h2>
        <p className="text-sm text-gray-400">Zero-knowledge encrypted chat</p>
      </div>

      <div className="space-y-4">
        {/* Session ID */}
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-300">Session ID</h3>
              <p className="text-xs text-gray-400 mt-1">Ephemeral • Resets on refresh</p>
            </div>
            <button
              onClick={() => copyToClipboard(sessionId, "session ID")}
              className="text-blue-400 hover:text-blue-300 transition-colors"
              title="Copy session ID"
            >
              📋
            </button>
          </div>
          <div className="mt-2 font-mono text-sm text-gray-200 bg-gray-800 px-3 py-2 rounded">
            {truncatedSession}
          </div>
        </div>

        {/* Identity Fingerprint */}
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-300">Identity Key</h3>
              <p className="text-xs text-gray-400 mt-1">Cryptographic fingerprint</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowQR(!showQR)}
                className="text-green-400 hover:text-green-300 transition-colors"
                title="Show QR code"
              >
                📱
              </button>
              <button
                onClick={() => setShowFingerprint(!showFingerprint)}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Toggle full fingerprint"
              >
                👁️
              </button>
              <button
                onClick={() => copyToClipboard(identity.fingerprint, "fingerprint")}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Copy fingerprint"
              >
                📋
              </button>
            </div>
          </div>
          <div className="mt-2 font-mono text-sm text-gray-200 bg-gray-800 px-3 py-2 rounded">
            {showFingerprint ? identity.fingerprint : truncatedFingerprint}
          </div>
        </div>

        {/* QR Code */}
        {showQR && (
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Identity QR Code</h3>
                         <div className="bg-white p-4 rounded inline-block">
               <QRCode
                 value={identity.fingerprint}
                 size={160}
               />
             </div>
            <p className="text-xs text-gray-400 mt-2">
              Scan to share your identity fingerprint
            </p>
          </div>
        )}

        {/* Creation Date */}
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300">Created</h3>
          <p className="text-sm text-gray-200 mt-1">
            {new Date(identity.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 space-y-3">
        <button
          onClick={handleBurnNotice}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded transition-colors flex items-center justify-center"
        >
          🔥 Burn Notice - Delete Everything
        </button>
        
        <div className="text-xs text-gray-400 text-center">
          Emergency data destruction • Cannot be undone
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="mt-6 text-xs text-gray-500 bg-gray-900 p-3 rounded">
        <strong>Privacy:</strong> Your identity is anonymous and encrypted. 
        No personal information is stored or transmitted.
      </div>
    </div>
  );
} 