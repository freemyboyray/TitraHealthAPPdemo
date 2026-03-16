import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

const GARMIN_CLIENT_ID = process.env.EXPO_PUBLIC_GARMIN_CLIENT_ID ?? '';
const GARMIN_AUTH_URL = 'https://connect.garmin.com/oauthConfirm';
const REDIRECT_URI = 'titrahealthappdemo://garmin-callback';

export type GarminSyncResult = {
  steps: number | null;
  activeCalories: number | null;
  sleepHours: number | null;
  restingHR: number | null;
  weight: number | null;
};

/**
 * Initiates Garmin OAuth 2.0 PKCE flow.
 * Returns the auth code from the deep-link callback, or null if cancelled/failed.
 */
export async function initiateGarminOAuth(): Promise<string | null> {
  // Generate PKCE code verifier + challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: GARMIN_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'WELLNESS_DATA',
  });

  const authUrl = `${GARMIN_AUTH_URL}?${params.toString()}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

  if (result.type !== 'success' || !result.url) return null;

  const parsed = Linking.parse(result.url);
  const code = parsed.queryParams?.code;
  if (!code || typeof code !== 'string') return null;

  // Exchange code for tokens via Edge Function
  const { data, error } = await supabase.functions.invoke('garmin-token-exchange', {
    body: { code, code_verifier: codeVerifier, redirect_uri: REDIRECT_URI },
  });

  if (error || !data?.success) {
    console.error('[Garmin] Token exchange failed:', error ?? data);
    return null;
  }

  return code;
}

/**
 * Calls the garmin-sync Edge Function and returns today's wellness summary.
 */
export async function triggerGarminSync(): Promise<GarminSyncResult> {
  const { data, error } = await supabase.functions.invoke('garmin-sync', {
    body: {},
  });

  if (error) {
    console.error('[Garmin] Sync failed:', error);
    return { steps: null, activeCalories: null, sleepHours: null, restingHR: null, weight: null };
  }

  return {
    steps: data?.steps ?? null,
    activeCalories: data?.activeCalories ?? null,
    sleepHours: data?.sleepHours ?? null,
    restingHR: data?.restingHR ?? null,
    weight: data?.weight ?? null,
  };
}

/**
 * Revokes Garmin token via Edge Function.
 */
export async function disconnectGarmin(): Promise<void> {
  await supabase.functions.invoke('garmin-disconnect', { body: {} });
}

// ─── PKCE Helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
