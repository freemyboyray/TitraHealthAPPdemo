import { Ionicons } from '@expo/vector-icons';
// expo-auth-session depends on expo-crypto (native); guard so Expo Go doesn't crash.
let makeRedirectUri: typeof import('expo-auth-session').makeRedirectUri = () => 'titrahealthappdemo://';
try { makeRedirectUri = require('expo-auth-session').makeRedirectUri; } catch {}
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/user-store';
import { useProfile } from '@/contexts/profile-context';
import { MOCK_PROFILE } from '@/constants/mock-profile';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

// ─── Design tokens (light card - intentionally fixed, theme-independent) ──────
const CARD_BG    = '#FFFFFF';
const INPUT_TEXT = '#1C1C1E';
const INPUT_ICON = '#8E8E93';
const SOCIAL_BDR = '#E5E5EA';
const ORANGE     = '#FF742A';
const FONT       = 'System';

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SignInScreen() {
  const router = useRouter();
  const { setSession, loadProfile, setDemoMode, setSessionLoaded } = useUserStore();
  const { setProfile, reloadProfile } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading]   = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // ── Demo login ──────────────────────────────────────────────────────────
  function handleDemoLogin() {
    setProfile(MOCK_PROFILE);
    setDemoMode(true);
    setSessionLoaded(true);
    router.replace('/(tabs)');
  }

  // ── Shared: credential guard + post-auth navigation ─────────────────────
  function checkSupabaseConfigured(): boolean {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!url || url.includes('placeholder') || !key || key.includes('placeholder')) {
      setError('Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.');
      return false;
    }
    return true;
  }

  async function finishOAuth(session: import('@supabase/supabase-js').Session | null) {
    if (!session) {
      setError('Sign-in completed but no session was returned. Please try again.');
      return;
    }
    setSession(session);
    // For OAuth users, populate username from provider metadata if missing
    const user = session.user;
    if (user) {
      const { data: existing } = await supabase.from('profiles').select('username, program_start_date').eq('id', user.id).single();
      if (!existing?.username) {
        const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];
        if (name) {
          await supabase.from('profiles').upsert({ id: user.id, username: name }, { onConflict: 'id' });
        }
      }
      await loadProfile();
      if (existing?.program_start_date) {
        await reloadProfile();
        router.replace('/');
      } else {
        router.replace('/onboarding');
      }
    } else {
      await loadProfile();
      router.replace('/');
    }
  }

  // ── Google OAuth ────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    if (!checkSupabaseConfigured()) return;
    setGoogleLoading(true);
    setError(null);

    try {
      const redirectUri = makeRedirectUri({ scheme: 'titrahealthappdemo' });

      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      });

      if (err || !data.url) {
        setError(err?.message ?? 'Google sign-in failed. Please try again.');
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (result.type !== 'success' || !result.url) {
        // User cancelled or browser dismissed - not an error
        return;
      }

      // Implicit flow: tokens arrive in the URL fragment (#access_token=...&refresh_token=...)
      const url = result.url;
      const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
      const params = Object.fromEntries(new URLSearchParams(fragment));
      const accessToken = params['access_token'];
      const refreshToken = params['refresh_token'];

      if (!accessToken) {
        setError('Google sign-in failed: no token returned. Please try again.');
        return;
      }

      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken ?? '',
      });
      if (sessionErr) { setError(sessionErr.message); return; }
      const { data: { session } } = await supabase.auth.getSession();
      await finishOAuth(session);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes('redirect') || msg.toLowerCase().includes('uri')) {
        const uri = makeRedirectUri({ scheme: 'titrahealthappdemo' });
        setError(`Redirect URI mismatch.\n\nAdd this exact URL to Supabase → Auth → URL Configuration → Redirect URLs:\n${uri}`);
      } else {
        setError(`Google sign-in failed: ${msg}`);
      }
    } finally {
      setGoogleLoading(false);
    }
  }


  // ── Apple Sign-In (native iOS) ───────────────────────────────────────
  async function handleAppleSignIn() {
    if (!checkSupabaseConfigured()) return;
    setAppleLoading(true);
    setError(null);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        setError('Apple sign-in failed: no identity token returned.');
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (signInErr) {
        setError('Apple sign-in failed. Please try again.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      // Apple only sends the user's name on the FIRST sign-in; persist it now
      if (session?.user && credential.fullName) {
        const parts = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean);
        if (parts.length > 0) {
          const { data: existing } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', session.user.id)
            .single();
          if (!existing?.username) {
            await supabase
              .from('profiles')
              .upsert({ id: session.user.id, username: parts.join(' ') }, { onConflict: 'id' });
          }
        }
      }

      await finishOAuth(session);
    } catch (e: unknown) {
      // User cancelled — not an error
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Apple sign-in failed: ${msg}`);
    } finally {
      setAppleLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Dark header ── */}
        <View style={s.header}>
          <SafeAreaView edges={['top']} />
          <View style={s.headerContent}>
            <View style={s.brandRow}>
              <Image
                source={require('@/assets/images/titra-logo.png')}
                style={s.logoMark}
                resizeMode="cover"
              />
              <Text style={s.brandName}>Titra Health</Text>
            </View>
            <Text style={s.headline}>Welcome</Text>
            <Text style={s.subtitle}>Your GLP-1 companion, always in your corner.</Text>
          </View>
        </View>

        {/* ── White card ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Sign in to continue</Text>

          {/* Error */}
          {error ? <Text style={s.errorText}>{error}</Text> : null}

          {/* Google */}
          <TouchableOpacity
            style={s.socialBtn}
            onPress={handleGoogleSignIn}
            activeOpacity={0.85}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={INPUT_TEXT} />
            ) : (
              <>
                <Image source={require('@/assets/images/google-logo.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />
                <Text style={s.socialBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple (iOS only) */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[s.socialBtn, s.appleSocialBtn]}
              onPress={handleAppleSignIn}
              activeOpacity={0.85}
              disabled={appleLoading}
            >
              {appleLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                  <Text style={[s.socialBtnText, { color: '#FFFFFF' }]}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Demo link */}
          <TouchableOpacity
            style={s.demoLink}
            onPress={handleDemoLogin}
            activeOpacity={0.7}
          >
            <Text style={s.demoLinkText}>Try demo — no account needed</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  root:    { flex: 1, backgroundColor: c.bg },

  // Header (dark, theme-aware)
  header: {
    backgroundColor: c.bg,
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  headerContent: {
    paddingTop: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: ORANGE,
    fontFamily: FONT,
    marginLeft: 12,
    letterSpacing: 0.3,
  },
  headline: {
    fontSize: 34,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -0.5,
    fontFamily: FONT,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 18,
    color: w(0.55),
    fontWeight: '500',
    fontFamily: FONT,
  },

  // Card (fixed light - intentional design contrast)
  scrollContent: { flexGrow: 1 },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: INPUT_TEXT,
    fontFamily: FONT,
    textAlign: 'center',
    marginBottom: 24,
  },

  // Error
  errorText: {
    color: '#C0392B',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: FONT,
  },

  // Social buttons
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: SOCIAL_BDR,
    backgroundColor: CARD_BG,
    marginBottom: 12,
  },
  appleSocialBtn: { backgroundColor: '#000000', borderColor: '#000000' },
  socialBtnText: { fontSize: 17, fontWeight: '600', color: INPUT_TEXT, fontFamily: FONT },

  // Demo link
  demoLink:     { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  demoLinkText: { fontSize: 16, color: INPUT_ICON, fontFamily: FONT },
  });
};
