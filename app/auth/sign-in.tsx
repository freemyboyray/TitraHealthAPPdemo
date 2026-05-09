import { Ionicons } from '@expo/vector-icons';
// expo-auth-session depends on expo-crypto (native); guard so Expo Go doesn't crash.
let makeRedirectUri: typeof import('expo-auth-session').makeRedirectUri = () => 'titrahealthappdemo://';
try { makeRedirectUri = require('expo-auth-session').makeRedirectUri; } catch {}
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { useFinishAuth } from '@/lib/auth-helpers';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

const FONT = 'System';
const SCREEN_HEIGHT = Dimensions.get('window').height;

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SignInScreen() {
  const router = useRouter();
  const finishAuth = useFinishAuth();
  const { colors: c } = useAppTheme();
  const s = useMemo(() => createStyles(c), [c]);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading]   = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const anyLoading = googleLoading || appleLoading;

  // ── Entrance animations ──────────────────────────────────────────────────
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(16);
  const btn1Opacity = useSharedValue(0);
  const btn1TranslateY = useSharedValue(20);
  const btn2Opacity = useSharedValue(0);
  const btn2TranslateY = useSharedValue(20);
  const dividerOpacity = useSharedValue(0);
  const btn3Opacity = useSharedValue(0);
  const btn3TranslateY = useSharedValue(20);

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 14, stiffness: 150 });
    logoOpacity.value = withTiming(1, { duration: 400 });
    titleOpacity.value = withDelay(150, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
    titleTranslateY.value = withDelay(150, withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }));
    btn1Opacity.value = withDelay(300, withTiming(1, { duration: 350 }));
    btn1TranslateY.value = withDelay(300, withTiming(0, { duration: 350, easing: Easing.out(Easing.quad) }));
    btn2Opacity.value = withDelay(400, withTiming(1, { duration: 350 }));
    btn2TranslateY.value = withDelay(400, withTiming(0, { duration: 350, easing: Easing.out(Easing.quad) }));
    dividerOpacity.value = withDelay(450, withTiming(1, { duration: 250 }));
    btn3Opacity.value = withDelay(500, withTiming(1, { duration: 350 }));
    btn3TranslateY.value = withDelay(500, withTiming(0, { duration: 350, easing: Easing.out(Easing.quad) }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const logoAnim = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));
  const titleAnim = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));
  const btn1Anim = useAnimatedStyle(() => ({
    opacity: btn1Opacity.value,
    transform: [{ translateY: btn1TranslateY.value }],
  }));
  const btn2Anim = useAnimatedStyle(() => ({
    opacity: btn2Opacity.value,
    transform: [{ translateY: btn2TranslateY.value }],
  }));
  const dividerAnim = useAnimatedStyle(() => ({
    opacity: dividerOpacity.value,
  }));
  const btn3Anim = useAnimatedStyle(() => ({
    opacity: btn3Opacity.value,
    transform: [{ translateY: btn3TranslateY.value }],
  }));

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

  async function completeSession(session: import('@supabase/supabase-js').Session | null) {
    if (!session) {
      setError('Sign-in completed but no session was returned. Please try again.');
      return;
    }
    await finishAuth(session);
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
      await completeSession(session);
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

      await completeSession(session);
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
      <StatusBar style="light" />

      {/* ── Hero gradient background ── */}
      <LinearGradient
        colors={c.heroGradient as unknown as [string, string, ...string[]]}
        locations={[0, 0.35, 0.65, 1.0]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={s.gradient}
        pointerEvents="none"
      />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* ── Brand section (centered on gradient) ── */}
        <View style={s.brandSection}>
          <Animated.View style={logoAnim}>
            <Image
              source={require('@/assets/images/titra-logo.png')}
              style={s.logo}
              resizeMode="cover"
            />
          </Animated.View>
          <Animated.View style={titleAnim}>
            <Text style={s.brandName}>TitraHealth</Text>
            <Text style={s.tagline}>Track more. Achieve more.</Text>
          </Animated.View>
        </View>

        {/* ── Auth buttons section ── */}
        <View style={s.buttonsSection}>
          {Platform.OS === 'ios' && (
            <Animated.View style={btn1Anim}>
              <TouchableOpacity
                style={[s.appleBtn, anyLoading && !appleLoading && s.btnDisabled]}
                onPress={handleAppleSignIn}
                activeOpacity={0.85}
                disabled={anyLoading}
              >
                {appleLoading ? (
                  <ActivityIndicator size="small" color={c.isDark ? '#000' : '#FFF'} />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={22} color={c.isDark ? '#000' : '#FFF'} />
                    <Text style={s.appleBtnText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}

          <Animated.View style={btn2Anim}>
            <TouchableOpacity
              style={[s.googleBtn, anyLoading && !googleLoading && s.btnDisabled]}
              onPress={handleGoogleSignIn}
              activeOpacity={0.85}
              disabled={anyLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={c.textPrimary} />
              ) : (
                <>
                  <Image
                    source={require('@/assets/images/google-logo.png')}
                    style={s.googleLogo}
                    resizeMode="contain"
                  />
                  <Text style={s.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* ── Divider ── */}
          <Animated.View style={[s.divider, dividerAnim]}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </Animated.View>

          {/* ── Email CTA ── */}
          <Animated.View style={btn3Anim}>
            <TouchableOpacity
              style={[s.emailBtn, anyLoading && s.btnDisabled]}
              onPress={() => router.push('/auth/email-sign-in')}
              activeOpacity={0.85}
              disabled={anyLoading}
            >
              <Ionicons name="mail-outline" size={20} color="#FFF" />
              <Text style={s.emailBtnText}>Continue with Email</Text>
            </TouchableOpacity>
          </Animated.View>

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
    gradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: SCREEN_HEIGHT * 0.52,
    },
    safe: {
      flex: 1,
      paddingHorizontal: 28,
    },

    // ── Brand ──
    brandSection: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 40,
    },
    logo: {
      width: 72,
      height: 72,
      borderRadius: 18,
      marginBottom: 20,
    },
    brandName: {
      fontSize: 38,
      fontWeight: '800',
      color: '#FFFFFF',
      fontFamily: FONT,
      letterSpacing: -1.0,
      textAlign: 'center',
      marginBottom: 8,
    },
    tagline: {
      fontSize: 17,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.75)',
      fontFamily: FONT,
      letterSpacing: -0.2,
      textAlign: 'center',
    },

    // ── Auth buttons ──
    buttonsSection: {
      paddingBottom: 8,
    },
    appleBtn: {
      height: 56,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: c.isDark ? '#FFFFFF' : '#000000',
      marginBottom: 12,
    },
    appleBtnText: {
      fontSize: 17,
      fontWeight: '600',
      color: c.isDark ? '#000000' : '#FFFFFF',
      fontFamily: FONT,
      letterSpacing: -0.2,
    },
    googleBtn: {
      height: 56,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
      ...(c.isDark
        ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }
        : {
            shadowColor: 'rgba(0,0,0,0.08)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 1,
            shadowRadius: 12,
            elevation: 2,
          }),
    },
    googleLogo: {
      width: 22,
      height: 22,
    },
    googleBtnText: {
      fontSize: 17,
      fontWeight: '600',
      color: c.textPrimary,
      fontFamily: FONT,
      letterSpacing: -0.2,
    },
    emailBtn: {
      height: 56,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.orange,
    },
    emailBtnText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: FONT,
      letterSpacing: -0.2,
    },
    btnDisabled: {
      opacity: 0.5,
    },

    // ── Divider ──
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
      gap: 12,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.borderSubtle,
    },
    dividerText: {
      fontSize: 12,
      fontWeight: '500',
      color: c.textMuted,
      fontFamily: FONT,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },

    // ── Error ──
    errorText: {
      fontSize: 14,
      color: '#FF453A',
      textAlign: 'center',
      fontFamily: FONT,
      lineHeight: 20,
      marginTop: 16,
    },

    // ── Footer ──
    footer: {
      paddingTop: 16,
      paddingBottom: 8,
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
