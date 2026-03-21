import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

// AsyncStorage is used instead of expo-secure-store because SecureStore uses
// iOS Keychain with whenUnlocked accessibility — during OAuth the app is
// backgrounded by the browser, making the Keychain inaccessible when the app
// returns, which causes "Invalid flow state" errors in the PKCE exchange.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE verifier is lost when the app is backgrounded during OAuth browser flow;
    // implicit flow returns tokens directly in the redirect URL fragment, avoiding the exchange.
    flowType: 'implicit',
  },
});
