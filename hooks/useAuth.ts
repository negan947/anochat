import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { signInAnonymously, signOut, getSession, supabase } from '../lib/supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    getSession().then(session => {
      if (session) {
        setSession(session);
      } else {
        // Auto sign in anonymously if no session
        signInAnonymously()
          .then(data => setSession(data.session))
          .catch(err => setError(err.message));
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (event === 'SIGNED_OUT') {
          // Clear any local data on sign out
          if (typeof window !== 'undefined') {
            sessionStorage.clear();
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInAnon = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await signInAnonymously();
      setSession(data.session);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    setLoading(true);
    setError(null);
    try {
      await signOut();
      setSession(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    session,
    loading,
    error,
    isAuthenticated: !!session,
    signIn: signInAnon,
    signOut: signOutUser,
  };
} 