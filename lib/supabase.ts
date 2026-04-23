import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { SecureSessionStorage } from './secure-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required environment variables: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set',
  );
}

// Session tokens are encrypted at rest using a device-bound key stored in
// iOS Keychain / Android Keystore (see lib/secure-storage.ts).
// We can't use SecureStore directly because it's inaccessible when the app
// is backgrounded during OAuth browser redirect.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE verifier is lost when the app is backgrounded during OAuth browser flow;
    // implicit flow returns tokens directly in the redirect URL fragment, avoiding the exchange.
    flowType: 'implicit',
  },
});
