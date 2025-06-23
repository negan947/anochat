"use client";

import { useState } from "react";
import storage from "@/lib/storage";

interface BurnNoticeProps {
  onComplete: () => void;
}

export default function BurnNotice({ onComplete }: BurnNoticeProps) {
  const [step, setStep] = useState<"confirm" | "burning" | "complete">("confirm");
  const [countdown, setCountdown] = useState(10);
  const [error, setError] = useState("");

  const handleBurnEverything = async () => {
    setStep("burning");
    setError("");

    try {
      // Start countdown
      for (let i = 5; i >= 1; i--) {
        setCountdown(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Execute burn operation
      await storage.burnEverything();
      
      // Clear sessionStorage
      if (typeof window !== "undefined") {
        sessionStorage.clear();
        localStorage.clear();
      }

      setStep("complete");
      
      // Auto-complete after showing success
      setTimeout(() => {
        onComplete();
      }, 2000);

    } catch (error) {
      setError(`Burn operation failed: ${error}`);
      setStep("confirm");
    }
  };

  const handleCancel = () => {
    onComplete();
  };

  if (step === "burning") {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-red-900 border border-red-500 rounded-lg p-8 max-w-md mx-4 text-center">
          <div className="text-6xl mb-6 animate-pulse">🔥</div>
          <h2 className="text-2xl font-bold text-red-100 mb-4">BURNING DATA</h2>
          <div className="text-red-200 mb-6">
            <div className="text-4xl font-mono text-red-100 mb-2">{countdown}</div>
            <p>Destroying all data...</p>
          </div>
          <div className="space-y-2 text-sm text-red-300">
            <div className="animate-pulse">🔥 Deleting encrypted identities...</div>
            <div className="animate-pulse">🔥 Clearing room data...</div>
            <div className="animate-pulse">🔥 Wiping session storage...</div>
            <div className="animate-pulse">🔥 Overwriting memory...</div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "complete") {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-8 max-w-md mx-4 text-center">
          <div className="text-6xl mb-6">✅</div>
          <h2 className="text-2xl font-bold text-gray-100 mb-4">BURN COMPLETE</h2>
          <p className="text-gray-300 mb-6">
            All data has been permanently destroyed. 
            Your anonymity is preserved.
          </p>
          <div className="text-sm text-gray-400">
            Redirecting to fresh session...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-red-900 border border-red-500 rounded-lg p-8 max-w-md mx-4">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-100 mb-2">BURN NOTICE</h2>
          <p className="text-red-200">Emergency Data Destruction</p>
        </div>

        {error && (
          <div className="bg-red-800 border border-red-600 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="bg-red-800 border border-red-600 rounded p-4 mb-6">
          <h3 className="text-red-100 font-semibold mb-3">This will permanently delete:</h3>
          <ul className="text-red-200 text-sm space-y-1">
            <li>🔥 All encrypted identities and private keys</li>
            <li>🔥 All room data and message history</li>
            <li>🔥 All stored sessions and pre-keys</li>
            <li>🔥 Current session ID and browser storage</li>
            <li>🔥 Any cached cryptographic material</li>
          </ul>
        </div>

        <div className="bg-red-950 border border-red-700 rounded p-4 mb-6">
          <h3 className="text-red-100 font-semibold mb-2">⚠️ WARNING</h3>
          <ul className="text-red-300 text-sm space-y-1">
            <li>• This action cannot be undone</li>
            <li>• You will lose access to all rooms</li>
            <li>• All message history will be lost</li>
            <li>• You&apos;ll need to create a new identity</li>
          </ul>
        </div>

        <div className="text-center text-red-200 text-sm mb-6">
          <p className="mb-2">
            Use this feature if you suspect your device is compromised
            or need to maintain plausible deniability.
          </p>
          <p className="font-semibold">
            Only proceed if you&apos;re absolutely certain.
          </p>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={handleCancel}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBurnEverything}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded transition-colors font-semibold"
          >
            🔥 BURN EVERYTHING
          </button>
        </div>

        <div className="mt-4 text-xs text-red-400 text-center">
          This action will take effect immediately
        </div>
      </div>
    </div>
  );
} 