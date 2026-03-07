import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

// Pure-JS in-memory storage — works in Expo Go without any native modules.
// Sessions are lost on cold restart but the app functions normally.
// Switch to expo-secure-store in a custom dev client build for persistence.
const memoryStore = new Map<string, string>();
const MemoryStorageAdapter = {
  getItem: (key: string) => Promise.resolve(memoryStore.get(key) ?? null),
  setItem: (key: string, value: string) => { memoryStore.set(key, value); return Promise.resolve(); },
  removeItem: (key: string) => { memoryStore.delete(key); return Promise.resolve(); },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: MemoryStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
