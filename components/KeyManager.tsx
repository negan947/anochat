"use client";

import { useState, useEffect } from "react";
import {
  initCrypto,
  createIdentity,
  loadIdentity,
  validatePassphrase,
} from "@/lib/crypto";
import storage from "@/lib/storage";
import { IdentityKey, StoredIdentity } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { LoadingSpinner } from "./ui/LoadingSpinner";

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const strengthColor = validation.isValid ? "text-secure-400" : "text-red-400";
    
    return (
      <div className={`text-sm ${strengthColor} mt-1`}>
        {validation.feedback.length > 0 ? validation.feedback.join(", ") : "Strong passphrase"}
      </div>
    );
  };

  if (!isInitialized) {
    return (
      <Card variant="glass" className="max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-4">
            <LoadingSpinner size="lg" variant="secure" />
            <p className="text-anon-300">Initializing cryptography...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center bg-gradient-to-r from-phantom-400 to-phantom-600 bg-clip-text text-transparent">
          Identity Manager
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {currentStep === "list" && (
          <div className="space-y-6">
            <div className="text-center text-anon-400 text-sm">
              Anonymous chat requires an encrypted identity
            </div>

            {storedIdentities.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-anon-300">Existing Identities</h3>
                <div className="space-y-2">
                  {storedIdentities.map((identity) => (
                    <Card
                      key={identity.fingerprint}
                      variant="bordered"
                      className="cursor-pointer hover:border-phantom-500 transition-colors"
                      onClick={() => {
                        setSelectedIdentity(identity.fingerprint);
                        setCurrentStep("load");
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="text-sm font-mono text-anon-200">
                          {identity.fingerprint.slice(0, 16)}...
                        </div>
                        <div className="text-xs text-anon-500 mt-1">
                          Created: {new Date(identity.createdAt).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Button
              variant="secure"
              onClick={() => setCurrentStep("create")}
              className="w-full"
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Create New Identity
            </Button>
          </div>
        )}

        {currentStep === "create" && (
          <div className="space-y-6">
            <div className="text-center text-anon-400 text-sm">
              Create a new anonymous identity
            </div>

            <div className="space-y-4">
              <Input
                type="password"
                variant="secure"
                label="Passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter a strong passphrase"
                icon={
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <circle cx="12" cy="16" r="1"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                }
              />
              {renderPassphraseStrength()}

              <Input
                type="password"
                variant="secure"
                label="Confirm Passphrase"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Confirm your passphrase"
                icon={
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <circle cx="12" cy="16" r="1"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                }
              />
            </div>

            <Card variant="bordered" className="border-amber-700/50 bg-amber-950/30">
              <CardContent className="p-3">
                <div className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-amber-400 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div className="text-xs text-amber-200">
                    <strong>Warning:</strong> Your passphrase encrypts your private key. 
                    If you lose it, your identity cannot be recovered.
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex space-x-3">
              <Button
                variant="ghost"
                onClick={resetForm}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="secure"
                onClick={handleCreateIdentity}
                disabled={isLoading || !passphrase || !confirmPassphrase}
                loading={isLoading}
                className="flex-1"
              >
                Create Identity
              </Button>
            </div>
          </div>
        )}

        {currentStep === "load" && (
          <div className="space-y-6">
            <div className="text-center text-anon-400 text-sm">
              Load existing identity
            </div>

            <Card variant="bordered" className="border-phantom-700/50">
              <CardContent className="p-3">
                <div className="text-sm font-mono text-anon-200">
                  {selectedIdentity.slice(0, 16)}...
                </div>
                <div className="text-xs text-anon-500">Selected Identity</div>
              </CardContent>
            </Card>

            <Input
              type="password"
              variant="secure"
              label="Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter your passphrase"
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <circle cx="12" cy="16" r="1"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              }
            />

            <div className="flex space-x-3">
              <Button
                variant="ghost"
                onClick={resetForm}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="phantom"
                onClick={handleLoadIdentity}
                disabled={isLoading || !passphrase}
                loading={isLoading}
                className="flex-1"
              >
                Load Identity
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 