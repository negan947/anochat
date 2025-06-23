"use client";

import { useState, useEffect } from "react";
import {
  initCrypto,
  generateIdentityKey,
  generateFingerprint,
  createIdentity,
  loadIdentity,
  generateSessionId,
  getOrCreateSessionId,
  validatePassphrase,
  isCryptoInitialized,
} from "@/lib/crypto";
import storage from "@/lib/storage";

export default function CryptoTestPage() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [testResults, setTestResults] = useState<string[]>([]);
  const [currentIdentity, setCurrentIdentity] = useState<any>(null);
  const [storedIdentities, setStoredIdentities] = useState<any[]>([]);

  useEffect(() => {
    // Initialize crypto on page load
    initializeCrypto();
  }, []);

  const initializeCrypto = async () => {
    try {
      await initCrypto();
      setIsInitialized(true);
      addTestResult("✅ Crypto library initialized successfully");
      
      // Get or create session ID
      const sid = getOrCreateSessionId();
      setSessionId(sid);
      addTestResult(`✅ Session ID: ${sid}`);
      
      // Load stored identities
      await loadStoredIdentities();
    } catch (error) {
      addTestResult(`❌ Failed to initialize crypto: ${error}`);
    }
  };

  const loadStoredIdentities = async () => {
    try {
      const identities = await storage.getAllIdentities();
      setStoredIdentities(identities);
      addTestResult(`✅ Loaded ${identities.length} stored identities`);
    } catch (error) {
      addTestResult(`❌ Failed to load identities: ${error}`);
    }
  };

  const addTestResult = (result: string) => {
    setTestResults((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${result}`]);
  };

  const testKeyGeneration = () => {
    try {
      const keypair = generateIdentityKey();
      const fingerprint = generateFingerprint(keypair.publicKey);
      addTestResult("✅ Generated new keypair");
      addTestResult(`   Public key: ${keypair.publicKey.slice(0, 8)}...`);
      addTestResult(`   Private key: ${keypair.privateKey.slice(0, 8)}...`);
      addTestResult(`   Fingerprint: ${fingerprint}`);
    } catch (error) {
      addTestResult(`❌ Key generation failed: ${error}`);
    }
  };

  const testCreateIdentity = async () => {
    if (!passphrase) {
      addTestResult("❌ Please enter a passphrase first");
      return;
    }

    const validation = validatePassphrase(passphrase);
    if (!validation.isValid) {
      addTestResult(`❌ Weak passphrase: ${validation.feedback.join(", ")}`);
      return;
    }

    try {
      const identity = await createIdentity(passphrase);
      setCurrentIdentity(identity);
      addTestResult("✅ Created and stored new identity");
      addTestResult(`   Fingerprint: ${identity.fingerprint}`);
      await loadStoredIdentities();
    } catch (error) {
      addTestResult(`❌ Failed to create identity: ${error}`);
    }
  };

  const testLoadIdentity = async (fingerprint: string) => {
    if (!passphrase) {
      addTestResult("❌ Please enter a passphrase first");
      return;
    }

    try {
      const identity = await loadIdentity(fingerprint, passphrase);
      if (identity) {
        setCurrentIdentity(identity);
        addTestResult(`✅ Loaded identity: ${fingerprint}`);
      } else {
        addTestResult(`❌ Identity not found: ${fingerprint}`);
      }
    } catch (error) {
      addTestResult(`❌ Failed to load identity: ${error}`);
    }
  };

  const testBurnEverything = async () => {
    if (confirm("Are you sure you want to delete all data? This cannot be undone!")) {
      try {
        await storage.burnEverything();
        setCurrentIdentity(null);
        setStoredIdentities([]);
        setTestResults([]);
        addTestResult("🔥 All data burned successfully");
        
        // Generate new session ID
        const newSid = generateSessionId();
        setSessionId(newSid);
        sessionStorage.setItem("anochat_session_id", newSid);
      } catch (error) {
        addTestResult(`❌ Failed to burn data: ${error}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">AnoChat Crypto Test Suite</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="space-y-2">
            <p>Crypto Initialized: {isInitialized ? "✅ Yes" : "❌ No"}</p>
            <p>Session ID: <code className="bg-gray-700 px-2 py-1 rounded text-sm">{sessionId || "Not generated"}</code></p>
            <p>Current Identity: <code className="bg-gray-700 px-2 py-1 rounded text-sm">{currentIdentity?.fingerprint || "None"}</code></p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Passphrase</h2>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter passphrase for key encryption"
            className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 mb-2"
          />
          <p className="text-sm text-gray-400">Used for encrypting/decrypting private keys</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Operations</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={testKeyGeneration}
              disabled={!isInitialized}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              Test Key Generation
            </button>
            <button
              onClick={testCreateIdentity}
              disabled={!isInitialized}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded"
            >
              Create & Store Identity
            </button>
            <button
              onClick={testBurnEverything}
              disabled={!isInitialized}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded col-span-2"
            >
              🔥 Burn Everything
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Stored Identities</h2>
          {storedIdentities.length === 0 ? (
            <p className="text-gray-400">No identities stored</p>
          ) : (
            <div className="space-y-2">
              {storedIdentities.map((identity) => (
                <div key={identity.fingerprint} className="flex items-center justify-between bg-gray-700 p-3 rounded">
                  <div>
                    <p className="text-sm font-mono">{identity.fingerprint}</p>
                    <p className="text-xs text-gray-400">Created: {new Date(identity.createdAt).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => testLoadIdentity(identity.fingerprint)}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          <div className="bg-gray-900 rounded p-4 h-64 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-gray-400">No test results yet</p>
            ) : (
              <div className="space-y-1 font-mono text-sm">
                {testResults.map((result, index) => (
                  <p key={index} className="text-green-400">{result}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
