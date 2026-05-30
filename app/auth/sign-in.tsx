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
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { useFinishAuth } from '@/lib/auth-helpers';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { Apple, ChevronLeft, Eye, EyeOff } from 'lucide-react-native';

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
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [isLoginMode, setIsLoginMode]     = useState(false);
  const anyLoading = googleLoading || appleLoading || signUpLoading;

  // Crossfade animation for mode toggle
  const modeOpacity = useSharedValue(1);
  const swapMode = () => { setIsLoginMode(m => !m); setError(null); };
  const toggleMode = () => {
    modeOpacity.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) }, (finished) => {
      if (finished) runOnJS(swapMode)();
    });
  };
  useEffect(() => {
    modeOpacity.value = withTiming(1, { duration: 200, easing: Easing.in(Easing.quad) });
  }, [isLoginMode]);
  const modeAnim = useAnimatedStyle(() => ({ opacity: modeOpacity.value }));

  const handleLogin = async () => {
    const trimmed = email.trim();
    if (!trimmed || !password) { setError('Please enter your email and password.'); return; }
    setError(null);
    setSignUpLoading(true);
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email: trimmed, password });
      if (signInErr) { setError(signInErr.message); return; }
      if (data.session) await finishAuth(data.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setSignUpLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    const trimmed = email.trim();
    if (!trimmed || !password) { setError('Please enter your email and password.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError(null);
    setSignUpLoading(true);
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({ email: trimmed, password });
      if (signUpErr) { setError(signUpErr.message); return; }
      if (data.session) {
        await finishAuth(data.session);
      } else {
        router.push('/auth/sign-up');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-up failed');
    } finally {
      setSignUpLoading(false);
    }
  };

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
      <StatusBar style={c.isDark ? 'light' : 'dark'} />

      {/* ── Background illustration ── */}
      <Image
        source={c.isDark ? require('@/assets/images/signin-bg-dark.png') : require('@/assets/images/signin-bg.png')}
        style={s.gradient}
        resizeMode="cover"
        pointerEvents="none"
      />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, alignSelf: 'flex-start' }} accessibilityLabel="Back" accessibilityRole="button">
          <ChevronLeft size={26} color={c.isDark ? '#FFFFFF' : '#1A1A1A'} />
        </Pressable>

        {/* Spacer to push content below illustration */}
        <View style={{ flex: 1 }} />

        {/* ── Auth section ── */}
        <View style={s.buttonsSection}>
          {/* Welcome text */}
          <Animated.View style={[{ marginBottom: 20 }, modeAnim]}>
            <Text style={s.brandName}>{isLoginMode ? 'Welcome Back!' : 'Welcome!'}</Text>
            <Text style={s.tagline}>{isLoginMode ? 'Continue your journey.' : 'Start your journey today.'}</Text>
          </Animated.View>

          {/* Email & Password inputs */}
          <View style={s.inputContainer}>
            <TextInput
              style={s.input}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
          </View>
          <View style={[s.inputContainer, { marginBottom: 16 }]}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Enter your password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
            />
            <Pressable onPress={() => setShowPassword(p => !p)} hitSlop={8} style={{ position: 'absolute', right: 16, top: 16 }}>
              {showPassword ? <Eye size={22} color="#999" /> : <EyeOff size={22} color="#999" />}
            </Pressable>
          </View>

          {/* Action button */}
          <TouchableOpacity
            style={[s.emailBtn, anyLoading && s.btnDisabled]}
            onPress={isLoginMode ? handleLogin : handleCreateAccount}
            activeOpacity={0.85}
            disabled={anyLoading}
          >
            {signUpLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Animated.Text style={[s.emailBtnText, modeAnim]}>{isLoginMode ? 'Login' : 'Create Your Account'}</Animated.Text>
            )}
          </TouchableOpacity>

          {/* ── Divider ── */}
          <Animated.View style={[s.divider, dividerAnim]}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </Animated.View>

          {/* Social sign-in */}
          {Platform.OS === 'ios' && (
            <Animated.View style={btn2Anim}>
              <TouchableOpacity
                style={[s.appleBtn, anyLoading && !appleLoading && s.btnDisabled]}
                onPress={handleAppleSignIn}
                activeOpacity={0.85}
                disabled={anyLoading}
              >
                {appleLoading ? (
                  <ActivityIndicator size="small" color="#1A1A1A" />
                ) : (
                  <>
                    <Apple size={22} color={c.isDark ? '#FFFFFF' : '#1A1A1A'} />
                    <Text style={s.appleBtnText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}

          <Animated.View style={btn3Anim}>
            <TouchableOpacity
              style={[s.googleBtn, anyLoading && !googleLoading && s.btnDisabled]}
              onPress={handleGoogleSignIn}
              activeOpacity={0.85}
              disabled={anyLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#1A1A1A" />
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

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          {/* ── Toggle mode ── */}
          <Animated.View style={[s.footer, modeAnim]}>
            <Text style={s.legalText}>
              {isLoginMode ? "Don't have an account? " : 'Already have an account? '}
              <Text style={s.legalLink} onPress={toggleMode}>
                {isLoginMode ? 'Sign up' : 'Sign in'}
              </Text>
            </Text>
          </Animated.View>
        </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.isDark ? '#1A1A1A' : '#FFFFFF',
    },
    gradient: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
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
      fontSize: 32,
      fontWeight: '700',
      color: c.isDark ? '#FFFFFF' : '#1A1A1A',
      fontFamily: FONT,
      letterSpacing: -0.5,
      textAlign: 'center',
      marginBottom: 8,
    },
    tagline: {
      fontSize: 17,
      fontWeight: '500',
      color: c.isDark ? 'rgba(255,255,255,0.6)' : '#777777',
      fontFamily: FONT,
      letterSpacing: -0.2,
      textAlign: 'center',
    },

    // ── Auth buttons ──
    buttonsSection: {
      paddingBottom: 8,
    },
    inputContainer: {
      height: 54,
      borderRadius: 27,
      borderWidth: 1.5,
      borderColor: c.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      justifyContent: 'center',
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    input: {
      fontSize: 16,
      fontWeight: '500',
      color: c.isDark ? '#FFFFFF' : '#1A1A1A',
      fontFamily: FONT,
      height: '100%',
    },
    appleBtn: {
      height: 56,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
      marginBottom: 12,
    },
    appleBtnText: {
      fontSize: 17,
      fontWeight: '600',
      color: c.isDark ? '#FFFFFF' : '#1A1A1A',
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
      borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
    },
    googleLogo: {
      width: 22,
      height: 22,
      borderRadius: 4,
    },
    googleBtnText: {
      fontSize: 17,
      fontWeight: '600',
      color: c.isDark ? '#FFFFFF' : '#1A1A1A',
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
