// lib/auth/context.tsx
// Unified Authentication Context supporting Supabase Auth and Demo/Offline Mode.

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  isDemo: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemo: boolean;
  isCloudAuth: boolean;
  signIn: (email: string, password?: string) => Promise<{ error?: string }>;
  signUp: (email: string, password?: string, name?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const DEMO_STORAGE_KEY = 'agriintel_demo_session';

const DEMO_USER: AuthUser = {
  id: 'demo-farmer-patil',
  email: 'farmer.patil@demo.agriintel.in',
  name: 'Patil Farm',
  isDemo: true,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const cloudAvailable = isSupabaseConfigured();

  // Initialize session
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (mounted && !error && session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Farmer',
              isDemo: false,
            });
            setIsLoading(false);
            return;
          }
        }

        // Check local demo session
        if (typeof window !== 'undefined') {
          const hasDemoSession = localStorage.getItem(DEMO_STORAGE_KEY);
          // If NEXT_PUBLIC_DEMO_MODE is true or local demo session flag is set
          const isDemoEnv = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
          if (hasDemoSession === 'true' || isDemoEnv) {
            if (mounted) {
              setUser(DEMO_USER);
            }
          }
        }
      } catch (err) {
        console.warn('[Auth] Session check failed, defaulting to offline mode:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initSession();

    // Listen to Supabase auth events if available
    const supabase = getSupabaseClient();
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Farmer',
            isDemo: false,
          });
        } else {
          // If signed out of Supabase, check demo session
          const hasDemo = typeof window !== 'undefined' && localStorage.getItem(DEMO_STORAGE_KEY) === 'true';
          setUser(hasDemo ? DEMO_USER : null);
        }
      });
      authListener = data;
    }

    return () => {
      mounted = false;
      if (authListener) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = useCallback(async (email: string, password?: string): Promise<{ error?: string }> => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        // Fallback demo sign-in
        const demoUser: AuthUser = {
          id: `demo-user-${Date.now()}`,
          email,
          name: email.split('@')[0] || 'Farmer',
          isDemo: true,
        };
        setUser(demoUser);
        if (typeof window !== 'undefined') {
          localStorage.setItem(DEMO_STORAGE_KEY, 'true');
        }
        setIsLoading(false);
        return {};
      }

      if (!password) {
        return { error: 'Password is required' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setIsLoading(false);
        return { error: error.message };
      }

      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Farmer',
          isDemo: false,
        });
      }
      setIsLoading(false);
      return {};
    } catch (err) {
      setIsLoading(false);
      return { error: err instanceof Error ? err.message : 'Login failed' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password?: string, name?: string): Promise<{ error?: string }> => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        // Demo sign-up fallback
        const demoUser: AuthUser = {
          id: `demo-user-${Date.now()}`,
          email,
          name: name || email.split('@')[0] || 'Farmer',
          isDemo: true,
        };
        setUser(demoUser);
        if (typeof window !== 'undefined') {
          localStorage.setItem(DEMO_STORAGE_KEY, 'true');
        }
        setIsLoading(false);
        return {};
      }

      if (!password) {
        return { error: 'Password is required' };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name || 'Farmer',
          },
        },
      });

      if (error) {
        // If email rate limit exceeded or user already registered, attempt direct sign-in
        const isRateLimit = error.message?.toLowerCase().includes('rate limit');
        const isAlreadyRegistered = error.message?.toLowerCase().includes('already registered') || error.message?.toLowerCase().includes('already in use');

        if ((isRateLimit || isAlreadyRegistered) && password) {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (!signInErr && signInData?.user) {
            setUser({
              id: signInData.user.id,
              email: signInData.user.email,
              name: name || signInData.user.user_metadata?.full_name || email.split('@')[0] || 'Farmer',
              isDemo: false,
            });
            setIsLoading(false);
            return {};
          }
        }

        setIsLoading(false);
        return { error: error.message };
      }

      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email,
          name: name || data.user.email?.split('@')[0] || 'Farmer',
          isDemo: false,
        });
      }
      setIsLoading(false);
      return {};
    } catch (err) {
      setIsLoading(false);
      return { error: err instanceof Error ? err.message : 'Sign up failed' };
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {
      // ignore network errors on signout
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(DEMO_STORAGE_KEY);
      }
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const enterDemoMode = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEMO_STORAGE_KEY, 'true');
    }
    setUser(DEMO_USER);
  }, []);

  const exitDemoMode = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DEMO_STORAGE_KEY);
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      isDemo: Boolean(user?.isDemo),
      isCloudAuth: cloudAvailable && Boolean(user && !user.isDemo),
      signIn,
      signUp,
      signOut,
      enterDemoMode,
      exitDemoMode,
    }),
    [user, isLoading, cloudAvailable, signIn, signUp, signOut, enterDemoMode, exitDemoMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
