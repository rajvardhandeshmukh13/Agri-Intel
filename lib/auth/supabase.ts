// lib/auth/supabase.ts
// Supabase client initialization with graceful fallback for unconfigured environments.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  try {
    const url = new URL(supabaseUrl);
    return Boolean(url.protocol && url.host) && supabaseAnonKey.trim().length > 10;
  } catch {
    return false;
  }
}

// Client-safe Supabase singleton. Null if credentials are not configured.
let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (clientInstance) return clientInstance;
  if (!isSupabaseConfigured()) return null;

  try {
    clientInstance = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return clientInstance;
  } catch (err) {
    console.warn('[Supabase] Failed to initialize client, defaulting to demo/offline mode:', err);
    return null;
  }
}
