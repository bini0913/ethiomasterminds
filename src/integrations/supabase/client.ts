// Production browser client for Master Minds.
// Keep the native Supabase auth flow, while tolerating browsers/WebViews where
// localStorage is blocked (privacy mode, storage policy, or embedded WebViews).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Supabase calls this adapter for auth session persistence. The in-memory
// fallback keeps the current tab usable when durable browser storage is denied;
// the session will simply not survive a full reload in that environment.
const memoryAuthStorage = new Map<string, string>();

const authStorage = {
  getItem(key: string): string | null {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        memoryAuthStorage.set(key, stored);
        return stored;
      }
    } catch {
      // Fall through to this-tab memory storage.
    }
    return memoryAuthStorage.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    memoryAuthStorage.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Auth remains available for this tab; durable persistence is unavailable.
    }
  },
  removeItem(key: string): void {
    memoryAuthStorage.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // The in-memory copy is still cleared.
    }
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
  },
});
