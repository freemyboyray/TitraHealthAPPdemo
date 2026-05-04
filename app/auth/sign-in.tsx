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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/user-store';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

const FONT = 'System';

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SignInScreen() {
  const router = useRouter();
  const { setSession, loadProfile } = useUserStore();
  const { reloadProfile } = useProfile();
  const { colors: c } = useAppTheme();
  const s = useMemo(() => createStyles(c), [c]);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading]   = useState(false);
  const [error, setError]                 = useState<string | null>(null);

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

      if (result.type !== 'success' || !result.url) return;

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
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Apple sign-in failed: ${msg}`);
    } finally {
      setAppleLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* ── Top spacer ── */}
        <View style={s.spacer} />

        {/* ── Title section (left-aligned) ── */}
        <View style={s.titleSection}>
          <Image
            source={require('@/assets/images/titra-logo.png')}
            style={s.titleLogo}
            resizeMode="cover"
          />
          <Text style={s.title}>Sign In</Text>
          <Text style={s.subtitle}>
            Built to help you track more,{'\n'}so you can achieve more.
          </Text>
        </View>

        {/* ── Provider cards (side by side) ── */}
        <View style={s.cardRow}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={s.providerCard}
              onPress={handleAppleSignIn}
              activeOpacity={0.7}
              disabled={appleLoading}
            >
              {appleLoading ? (
                <ActivityIndicator size="small" color={c.textPrimary} style={s.cardIcon} />
              ) : (
                <Ionicons name="logo-apple" size={32} color={c.textPrimary} style={s.cardIcon} />
              )}
              <Text style={s.cardWith}>with</Text>
              <Text style={s.cardLabel}>Apple</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={s.providerCard}
            onPress={handleGoogleSignIn}
            activeOpacity={0.7}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={c.textPrimary} style={s.cardIcon} />
            ) : (
              <Image
                source={require('@/assets/images/google-logo.png')}
                style={[s.googleLogo, s.cardIcon]}
                resizeMode="contain"
              />
            )}
            <Text style={s.cardWith}>with</Text>
            <Text style={s.cardLabel}>Google</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={s.errorText}>{error}</Text> : null}

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.legalText}>
            By continuing, you agree to our{' '}
            <Text style={s.legalLink}>Terms</Text>
            {' & '}
            <Text style={s.legalLink}>Privacy Policy</Text>
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },
    safe: {
      flex: 1,
      paddingHorizontal: 28,
    },
    spacer: {
      flex: 1,
    },

    // ── Title ──
    titleSection: {
      marginBottom: 28,
    },
    titleLogo: {
      width: 44,
      height: 44,
      borderRadius: 11,
      marginBottom: 12,
    },
    title: {
      fontSize: 34,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FONT,
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '400',
      color: c.textSecondary,
      fontFamily: FONT,
      lineHeight: 22,
    },

    // ── Provider cards ──
    cardRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    providerCard: {
      flex: 1,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      borderRadius: 18,
      paddingVertical: 20,
      paddingHorizontal: 16,
      ...(c.isDark
        ? {
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }
        : {
            shadowColor: 'rgba(0,0,0,0.08)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 1,
            shadowRadius: 12,
            elevation: 2,
          }),
    },
    cardIcon: {
      marginBottom: 14,
    },
    googleLogo: {
      width: 28,
      height: 28,
    },
    cardWith: {
      fontSize: 14,
      fontWeight: '400',
      color: c.textSecondary,
      fontFamily: FONT,
      marginBottom: 2,
    },
    cardLabel: {
      fontSize: 18,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: FONT,
      letterSpacing: -0.2,
    },

    // ── Error ──
    errorText: {
      fontSize: 14,
      color: '#FF453A',
      textAlign: 'center',
      fontFamily: FONT,
      lineHeight: 20,
      marginBottom: 12,
    },

    // ── Footer ──
    footer: {
      paddingBottom: 8,
      paddingTop: 12,
    },
    legalText: {
      fontSize: 12,
      color: c.textMuted,
      textAlign: 'center',
      fontFamily: FONT,
      lineHeight: 18,
    },
    legalLink: {
      color: c.textSecondary,
      fontWeight: '500',
    },
  });
