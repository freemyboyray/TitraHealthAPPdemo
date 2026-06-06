// expo-auth-session depends on expo-crypto (native); guard so Expo Go doesn't crash.
let makeRedirectUri: typeof import('expo-auth-session').makeRedirectUri = () => 'titrahealth://';
try { makeRedirectUri = require('expo-auth-session').makeRedirectUri; } catch {}
// Type-only import (erased at runtime) so the iOS-only native module is never
// eagerly evaluated on Android. The real module is lazy-required inside
// handleAppleSignIn, which only runs behind a Platform.OS === 'ios' gate.
import type * as AppleAuthenticationModule from 'expo-apple-authentication';
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
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

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

  // Inline email-confirmation (6-digit code) state — keeps verification on this
  // same screen instead of pushing to a separate page.
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [code, setCode]                   = useState('');
  const [verifying, setVerifying]         = useState(false);
  const [resending, setResending]         = useState(false);
  const [resendNotice, setResendNotice]   = useState<string | null>(null);

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
        // No email confirmation required → straight into the app.
        await finishAuth(data.session);
      } else {
        // Email confirmation required → show the inline 6-digit code step.
        setCode('');
        setResendNotice(null);
        setConfirmationSent(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-up failed');
    } finally {
      setSignUpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const trimmed = email.trim();
    const token = code.trim();
    if (token.length < 6) { setError('Please enter the 6-digit code from your email.'); return; }
    setError(null);
    setVerifying(true);
    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({ email: trimmed, token, type: 'signup' });
      if (verifyErr) { setError(verifyErr.message); return; }
      if (data.session) {
        await finishAuth(data.session);
      } else {
        setError('Verification succeeded but no session was returned. Please try signing in.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setResending(true);
    setError(null);
    setResendNotice(null);
    try {
      const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email: trimmed });
      if (resendErr) { setError(resendErr.message); return; }
      setResendNotice('A new code is on its way.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  const exitVerification = () => {
    setConfirmationSent(false);
    setCode('');
    setError(null);
    setResendNotice(null);
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
      const redirectUri = makeRedirectUri({ scheme: 'titrahealth' });

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
        const uri = makeRedirectUri({ scheme: 'titrahealth' });
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

    const AppleAuthentication =
      require('expo-apple-authentication') as typeof AppleAuthenticationModule;

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

      {/* ── Gradient background ── */}
      <LinearGradient
        colors={c.isDark
          ? ['#1A1410', '#2A1E14', '#1A1410']
          : ['#C4785A', '#DC8E5A', '#EDAB78', '#F5F3EF']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <Pressable onPress={() => (confirmationSent ? exitVerification() : router.back())} hitSlop={12} style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, alignSelf: 'flex-start' }} accessibilityLabel="Back" accessibilityRole="button">
          <ChevronLeft size={26} color={c.isDark ? '#FFFFFF' : '#1A1A1A'} />
        </Pressable>

        {/* Spacer to push content below illustration */}
        <View style={{ flex: 1 }} />

        {/* ── Auth section ── */}
        <View style={s.buttonsSection}>
          {/* Logo + Tagline */}
          <View style={{ marginBottom: 24 }}>
            <Image
              source={require('@/assets/images/titra-logo.png')}
              style={{ width: 80, height: 80, borderRadius: 20, marginBottom: 16 }}
              resizeMode="cover"
            />
            <Text style={s.tagline}>
              {confirmationSent
                ? 'Verify your email'
                : 'Built to track more,\nso you can achieve more.'}
            </Text>
            {confirmationSent ? (
              <Text style={s.verifySubtitle}>
                Enter the 6-digit code we sent to{'\n'}
                <Text style={s.verifyEmail}>{email.trim()}</Text>
              </Text>
            ) : null}
          </View>

          {confirmationSent ? (
            /* ── Inline 6-digit code verification ── */
            <>
              <View style={s.inputContainer}>
                <TextInput
                  style={[s.input, { textAlign: 'center', letterSpacing: 8, fontSize: 22, fontWeight: '700' }]}
                  placeholder="000000"
                  placeholderTextColor="#999"
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  editable={!verifying}
                  onSubmitEditing={handleVerifyOtp}
                />
              </View>

              {resendNotice && !error ? <Text style={s.resendNotice}>{resendNotice}</Text> : null}

              <TouchableOpacity
                style={[s.emailBtn, { marginTop: 4 }, (verifying || code.length < 6) && s.btnDisabled]}
                onPress={handleVerifyOtp}
                activeOpacity={0.85}
                disabled={verifying || code.length < 6}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={s.emailBtnText}>Verify &amp; Continue</Text>
                )}
              </TouchableOpacity>

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              <View style={s.footer}>
                <Text style={s.legalText}>
                  Didn&apos;t get a code?{' '}
                  <Text style={s.legalLink} onPress={resending ? undefined : handleResendCode}>
                    {resending ? 'Sending…' : 'Resend'}
                  </Text>
                </Text>
              </View>
            </>
          ) : (
          <>
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
                    <IconSymbol name="apple.logo" size={22} color={c.isDark ? '#FFFFFF' : '#1A1A1A'} />
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
          </>
          )}
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
      backgroundColor: c.isDark ? '#1A1410' : '#F5F3EF',
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
      fontSize: 32,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: FONT,
      letterSpacing: -0.5,
      lineHeight: 40,
    },
    verifySubtitle: {
      fontSize: 15,
      fontWeight: '500',
      color: c.isDark ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.9)',
      fontFamily: FONT,
      lineHeight: 22,
      marginTop: 10,
    },
    verifyEmail: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    resendNotice: {
      fontSize: 14,
      color: '#FFFFFF',
      textAlign: 'center',
      fontFamily: FONT,
      lineHeight: 20,
      marginBottom: 12,
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
      color: c.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)',
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
      color: c.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)',
      textAlign: 'center',
      fontFamily: FONT,
      lineHeight: 18,
    },
    legalLink: {
      color: c.isDark ? '#FFFFFF' : '#1A1A1A',
      fontWeight: '600',
    },
  });
