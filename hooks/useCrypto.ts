import { useEffect, useState, useCallback } from 'react';
import { IdentityKey } from '../lib/types';
import {
  initCrypto,
  generateIdentityKey,
  generateFingerprint,
  encryptPrivateKey,
  decryptPrivateKey,
  generateSessionId,
} from '../lib/crypto';
import storage from '../lib/storage';

export function useCrypto() {
  const [initialized, setInitialized] = useState(false);
  const [identity, setIdentity] = useState<IdentityKey | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize crypto library
  useEffect(() => {
    initCrypto()
      .then(() => {
        setInitialized(true);
        
        // Generate session ID
        const sid = generateSessionId();
        setSessionId(sid);
        
        // Store in sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('anochat_session_id', sid);
        }
      })
      .catch(err => {
        setError('Failed to initialize crypto library');
        console.error(err);
      });
  }, []);

  // Load existing identity
  useEffect(() => {
    if (!initialized) return;

    loadStoredIdentity()
      .then(identity => {
        if (identity) {
          setIdentity(identity);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load identity:', err);
        setLoading(false);
      });
  }, [initialized]);

  // Load stored identity
  const loadStoredIdentity = async (): Promise<IdentityKey | null> => {
    try {
      const identities = await storage.getAllIdentities();
      if (identities.length === 0) return null;
      
      // Use the most recently used identity
      const stored = identities[0];

      // Prompt for passphrase
      const passphrase = await promptForPassphrase('Enter your passphrase to unlock your identity:');
      if (!passphrase) return null;

      const privateKey = await decryptPrivateKey(
        stored.encryptedPrivateKey,
        passphrase
      );

      return {
        publicKey: stored.publicKey,
        privateKey,
        fingerprint: stored.fingerprint,
        createdAt: stored.createdAt,
      };
    } catch (err) {
      console.error('Failed to decrypt identity:', err);
      throw new Error('Invalid passphrase');
    }
  };

  // Generate new identity
  const generateNewIdentity = useCallback(async (passphrase: string): Promise<IdentityKey> => {
    if (!initialized) {
      throw new Error('Crypto not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      // Generate new identity key
      const { publicKey, privateKey } = await generateIdentityKey();
      const fingerprint = await generateFingerprint(publicKey);

      // Encrypt and store private key
      const encryptedPrivateKey = await encryptPrivateKey(privateKey, passphrase);

      // Store in database
      await storage.saveIdentity(fingerprint, publicKey, encryptedPrivateKey);

      const identity: IdentityKey = {
        publicKey,
        privateKey,
        fingerprint,
        createdAt: new Date(),
      };

      setIdentity(identity);
      return identity;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  // Clear identity (for logout/burn)
  const clearIdentity = useCallback(() => {
    setIdentity(null);
    setSessionId(generateSessionId());
    
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('anochat_session_id');
    }
  }, []);

  // Get fingerprint for any public key
  const getFingerprintForKey = useCallback(async (publicKey: Uint8Array): Promise<string> => {
    if (!initialized) {
      throw new Error('Crypto not initialized');
    }
    return generateFingerprint(publicKey);
  }, [initialized]);

  return {
    initialized,
    identity,
    sessionId,
    loading,
    error,
    generateNewIdentity,
    clearIdentity,
    getFingerprint: getFingerprintForKey,
  };
}

// Helper function to prompt for passphrase
async function promptForPassphrase(message: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  // In a real implementation, this would be a proper modal/dialog
  // For now, we'll use a simple prompt
  return window.prompt(message);
} 