"use client";

import { useState, useEffect } from "react";
import {
  initCrypto,
  createIdentity,
  loadIdentity,
  validatePassphrase,
  isCryptoInitialized,
} from "@/lib/crypto";
import storage from "@/lib/storage";
import { IdentityKey, StoredIdentity } from "@/lib/types";

interface KeyManagerProps {
  onIdentityLoaded: (identity: IdentityKey) => void;
}

export default function KeyManager({ onIdentityLoaded }: KeyManagerProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [storedIdentities, setStoredIdentities] = useState<StoredIdentity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<"list" | "create" | "load">("list");
  const [selectedIdentity, setSelectedIdentity] = useState<string>("");

  useEffect(() => {
    initializeSystem();
  }, []);

  const initializeSystem = async () => {
    try {
      await initCrypto();
      setIsInitialized(true);
      await loadStoredIdentities();
    } catch (error) {
      setError(`Failed to initialize crypto: ${error}`);
    }
  };

  const loadStoredIdentities = async () => {
    try {
      const identities = await storage.getAllIdentities();
      setStoredIdentities(identities);
    } catch (error) {
      setError(`Failed to load identities: ${error}`);
    }
  };

  const validateInputs = (): boolean => {
    const validation = validatePassphrase(passphrase);
    if (!validation.isValid) {
      setError(`Weak passphrase: ${validation.feedback.join(", ")}`);
      return false;
    }

    if (currentStep === "create" && passphrase !== confirmPassphrase) {
      setError("Passphrases do not match");
      return false;
    }

    return true;
  };

  const handleCreateIdentity = async () => {
    setError("");
    if (!validateInputs()) return;

    setIsLoading(true);
    try {
      const identity = await createIdentity(passphrase);
      onIdentityLoaded(identity);
      await loadStoredIdentities();
      resetForm();
    } catch (error) {
      setError(`Failed to create identity: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadIdentity = async () => {
    setError("");
    if (!selectedIdentity || !passphrase) {
      setError("Please select an identity and enter passphrase");
      return;
    }

    setIsLoading(true);
    try {
      const identity = await loadIdentity(selectedIdentity, passphrase);
      if (identity) {
        onIdentityLoaded(identity);
        resetForm();
      } else {
        setError("Identity not found");
      }
    } catch (error) {
      setError(`Failed to load identity: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setPassphrase("");
    setConfirmPassphrase("");
    setSelectedIdentity("");
    setCurrentStep("list");
    setError("");
  };

  const renderPassphraseStrength = () => {
    if (!passphrase) return null;
    
    const validation = validatePassphrase(passphrase);
    const strengthColor = validation.isValid ? "text-green-400" : "text-red-400";
    
    return (
      <div className={`text-sm ${strengthColor} mt-1`}>
        {validation.feedback.length > 0 ? validation.feedback.join(", ") : "Strong passphrase"}
      </div>
    );
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        <span className="ml-2 text-gray-300">Initializing cryptography...</span>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-100 mb-6 text-center">
        AnoChat Identity Manager
      </h2>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {currentStep === "list" && (
        <div className="space-y-4">
          <div className="text-center text-gray-300 text-sm mb-4">
            Anonymous chat requires an encrypted identity
          </div>

          {storedIdentities.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Existing Identities</h3>
              <div className="space-y-2 mb-4">
                {storedIdentities.map((identity) => (
                  <div
                    key={identity.fingerprint}
                    className="bg-gray-700 p-3 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => {
                      setSelectedIdentity(identity.fingerprint);
                      setCurrentStep("load");
                    }}
                  >
                    <div className="text-sm font-mono text-gray-200">
                      {identity.fingerprint.slice(0, 16)}...
                    </div>
                    <div className="text-xs text-gray-400">
                      Created: {new Date(identity.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setCurrentStep("create")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
          >
            Create New Identity
          </button>
        </div>
      )}

      {currentStep === "create" && (
        <div className="space-y-4">
          <div className="text-center text-gray-300 text-sm mb-4">
            Create a new anonymous identity
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Passphrase
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter a strong passphrase"
              className="w-full bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-blue-500"
            />
            {renderPassphraseStrength()}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Confirm Passphrase
            </label>
            <input
              type="password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              placeholder="Confirm your passphrase"
              className="w-full bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="text-xs text-gray-400 bg-gray-900 p-3 rounded">
            <strong>Warning:</strong> Your passphrase encrypts your private key. 
            If you lose it, your identity cannot be recovered.
          </div>

          <div className="flex space-x-3">
            <button
              onClick={resetForm}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateIdentity}
              disabled={isLoading || !passphrase || !confirmPassphrase}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
            >
              {isLoading ? "Creating..." : "Create Identity"}
            </button>
          </div>
        </div>
      )}

      {currentStep === "load" && (
        <div className="space-y-4">
          <div className="text-center text-gray-300 text-sm mb-4">
            Load existing identity
          </div>

          <div className="bg-gray-700 p-3 rounded">
            <div className="text-sm font-mono text-gray-200">
              {selectedIdentity.slice(0, 16)}...
            </div>
            <div className="text-xs text-gray-400">Selected Identity</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Passphrase
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter your passphrase"
              className="w-full bg-gray-700 border border-gray-600 text-gray-100 px-3 py-2 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={resetForm}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLoadIdentity}
              disabled={isLoading || !passphrase}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
            >
              {isLoading ? "Loading..." : "Load Identity"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 