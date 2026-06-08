// Onboarding account-creation step. Shown right after the AI consent screen
// (app/onboarding/ai-consent.tsx). Onboarding runs anonymously up to this point
// — the draft lives in AsyncStorage — so this is where the user creates a real
// Supabase account (Apple, Google, or email + password). Creating an account is
// REQUIRED to continue: without it, completeOnboarding() can't persist a cloud
// profile (it skips the upsert when there's no session).
//
// On success we call finishAuth(..., { returnTo: '/onboarding/doctor-code' }) so
// a brand-new account RESUMES onboarding at the next step instead of restarting
// the whole flow. The provider-specific auth logic mirrors app/auth/sign-in.tsx;
// it's intentionally duplicated here to keep the live login screen untouched.

// expo-auth-session depends on expo-crypto (native); guard so Expo Go doesn't crash.
let makeRedirectUri: typeof import('expo-auth-session').makeRedirectUri = () => 'titrahealth://';
try { makeRedirectUri = require('expo-auth-session').makeRedirectUri; } catch {}
// Type-only import (erased at runtime) — the iOS-only native module is lazily
// required inside handleAppleSignIn, behind a Platform.OS === 'ios' gate.
import type * as AppleAuthenticationModule from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { supabase } from '@/lib/supabase';
import { useFinishAuth } from '@/lib/auth-helpers';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

const FF = 'System';
const NEXT_STEP = '/onboarding/doctor-code';

const providerLabel = (p: string) =>
  p === 'google' ? 'Google' : p === 'apple' ? 'Apple' : p === 'email' ? 'email & password' : p;

export default function AccountScreen() {
  const router = useRouter();
  const { colors: c } = useAppTheme();
  const s = useMemo(() => createStyles(c), [c]);
  const finishAuth = useFinishAuth();
  const { draft } = useProfile();
  const fallbackName = draft.username?.trim() || undefined;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const anyLoading = googleLoading || appleLoading || emailLoading;

  // Inline 6-digit email confirmation (kept on this screen).
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  // Brand-new (or not-yet-onboarded) account → resume at the next onboarding
  // step. A returning, fully-onboarded user is routed home by finishAuth.
  const onSession = async (session: import('@supabase/supabase-js').Session | null) => {
    if (!session) {
      setError('Sign-in completed but no session was returned. Please try again.');
      return;
    }
    await finishAuth(session, fallbackName, { returnTo: NEXT_STEP });
  };

  function checkConfigured(): boolean {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!url || url.includes('placeholder') || !key || key.includes('placeholder')) {
      setError('Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.');
      return false;
    }
    return true;
  }

  // A Google/Apple-only account has no password, so signInWithPassword returns a
  // generic error. Point the user at the method they actually used.
  const maybeShowSocialOnlyHint = async (addr: string): Promise<boolean> => {
    try {
      const { data } = await supabase.rpc('auth_methods_for_email', { p_email: addr });
      const methods = Array.isArray(data) ? data : [];
      if (methods.length > 0 && !methods.includes('email')) {
        const social = methods.filter((m: string) => m === 'google' || m === 'apple').map(providerLabel);
        const label = social.length > 0 ? social.join(' or ') : 'a different method';
        setError(`This email is registered with ${label}. Use “Continue with ${label}” below.`);
        return true;
      }
    } catch { /* fall back to the generic error */ }
    return false;
  };

  const handleExistingAccount = async (addr: string) => {
    let methods: string[] = [];
    try {
      const { data } = await supabase.rpc('auth_methods_for_email', { p_email: addr });
      if (Array.isArray(data)) methods = data;
    } catch { /* generic fallback */ }
    const social = methods.filter((m) => m === 'google' || m === 'apple');
    if (methods.includes('email')) {
      setIsLoginMode(true);
      setError('You already have an account with this email. Enter your password to log in.');
    } else if (social.length > 0) {
      setError(`This email is already registered with ${social.map(providerLabel).join(' or ')}. Use the button below.`);
    } else {
      setIsLoginMode(true);
      setError('An account with this email already exists. Try logging in instead.');
    }
  };

  // ── Email / password ──────────────────────────────────────────────────────
  const handleEmailContinue = async () => {
    const trimmed = email.trim();
    if (!trimmed || !password) { setError('Please enter your email and password.'); return; }
    if (!isLoginMode && password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!checkConfigured()) return;
    setError(null);
    setEmailLoading(true);
    try {
      if (isLoginMode) {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email: trimmed, password });
        if (err) {
          const handled = await maybeShowSocialOnlyHint(trimmed);
          if (!handled) setError(err.message);
          return;
        }
        await onSession(data.session);
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email: trimmed, password });
        if (err) {
          if (err.message.toLowerCase().includes('already registered')) await handleExistingAccount(trimmed);
          else setError(err.message);
          return;
        }
        // Supabase anti-enumeration: an existing email returns a user with an
        // empty identities array and no session.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          await handleExistingAccount(trimmed);
          return;
        }
        if (data.session) {
          await onSession(data.session);
        } else {
          setCode('');
          setResendNotice(null);
          setConfirmationSent(true);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const trimmed = email.trim();
    const token = code.trim();
    if (token.length < 6) { setError('Please enter the 6-digit code from your email.'); return; }
    setError(null);
    setVerifying(true);
    try {
      const { data, error: err } = await supabase.auth.verifyOtp({ email: trimmed, token, type: 'signup' });
      if (err) { setError(err.message); return; }
      await onSession(data.session);
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
      const { error: err } = await supabase.auth.resend({ type: 'signup', email: trimmed });
      if (err) { setError(err.message); return; }
      setResendNotice('A new code is on its way.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    if (!checkConfigured()) return;
    setGoogleLoading(true);
    setError(null);
    try {
      const redirectUri = makeRedirectUri({ scheme: 'titrahealth' });
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      });
      if (err || !data.url) { setError(err?.message ?? 'Google sign-in failed. Please try again.'); return; }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      if (result.type !== 'success' || !result.url) { setError('Google sign-in was interrupted. Please try again.'); return; }

      const url = result.url;
      const hashPart = url.includes('#') ? url.split('#')[1] : '';
      const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
      const params = Object.fromEntries(new URLSearchParams(`${queryPart}&${hashPart}`));

      const oauthError = params['error_description'] || params['error'];
      if (oauthError) { setError(`Google sign-in failed: ${decodeURIComponent(oauthError).replace(/\+/g, ' ')}`); return; }

      const accessToken = params['access_token'];
      const refreshToken = params['refresh_token'];
      if (!accessToken) { setError('Google sign-in failed: no token returned. Please try again.'); return; }

      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken ?? '',
      });
      if (sessionErr) { setError(sessionErr.message); return; }
      const { data: { session } } = await supabase.auth.getSession();
      await onSession(session);
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

  // ── Apple Sign-In (native iOS) ────────────────────────────────────────────
  async function handleAppleSignIn() {
    if (!checkConfigured()) return;
    setAppleLoading(true);
    setError(null);
    const AppleAuthentication = require('expo-apple-authentication') as typeof AppleAuthenticationModule;
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) { setError('Apple sign-in failed: no identity token returned.'); return; }

      const { error: err } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (err) { setError('Apple sign-in failed. Please try again.'); return; }

      const { data: { session } } = await supabase.auth.getSession();
      // Apple only returns the name on first authorization — capture it if the
      // profile doesn't have one yet (falls back to the onboarding draft name).
      if (session?.user && credential.fullName) {
        const parts = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean);
        if (parts.length > 0) {
          const { data: existing } = await supabase.from('profiles').select('username').eq('id', session.user.id).single();
          if (!existing?.username) {
            await supabase.from('profiles').upsert({ id: session.user.id, username: parts.join(' ') }, { onConflict: 'id' });
          }
        }
      }
      await onSession(session);
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      setError(`Apple sign-in failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAppleLoading(false);
    }
  }

  const exitVerification = () => {
    setConfirmationSent(false);
    setCode('');
    setError(null);
    setResendNotice(null);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={5} total={17} onBack={() => (confirmationSent ? exitVerification() : router.back())} />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {confirmationSent ? (
              <>
                <Text style={s.title}>Verify your email</Text>
                <Text style={s.subtitle}>
                  Enter the 6-digit code we sent to{'\n'}
                  <Text style={s.emailStrong}>{email.trim()}</Text>
                </Text>

                <View style={s.inputWrap}>
                  <TextInput
                    style={[s.input, { textAlign: 'center', letterSpacing: 8, fontSize: 22, fontWeight: '700' }]}
                    placeholder="000000"
                    placeholderTextColor={c.textMuted}
                    value={code}
                    onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    editable={!verifying}
                    onSubmitEditing={handleVerifyOtp}
                  />
                </View>

                {resendNotice && !error ? <Text style={s.notice}>{resendNotice}</Text> : null}

                <TouchableOpacity
                  style={[s.primaryBtn, (verifying || code.length < 6) && s.btnDisabled]}
                  onPress={handleVerifyOtp}
                  activeOpacity={0.85}
                  disabled={verifying || code.length < 6}
                >
                  {verifying ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={s.primaryBtnText}>Verify &amp; Continue</Text>}
                </TouchableOpacity>

                {error ? <Text style={s.errorText}>{error}</Text> : null}

                <Text style={s.footerText}>
                  Didn&apos;t get a code?{' '}
                  <Text style={s.footerLink} onPress={resending ? undefined : handleResendCode}>
                    {resending ? 'Sending…' : 'Resend'}
                  </Text>
                </Text>
              </>
            ) : (
              <>
                <Text style={s.title}>Create your account</Text>
                <Text style={s.subtitle}>
                  Save your progress and securely sync your plan across devices.
                </Text>

                {/* Email + password */}
                <View style={s.inputWrap}>
                  <TextInput
                    style={s.input}
                    placeholder="Enter your email"
                    placeholderTextColor={c.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!anyLoading}
                  />
                </View>
                <View style={[s.inputWrap, { marginBottom: 16 }]}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder="Enter your password"
                    placeholderTextColor={c.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                    editable={!anyLoading}
                  />
                  <Pressable onPress={() => setShowPassword((p) => !p)} hitSlop={8} style={s.eyeBtn}>
                    {showPassword ? <Eye size={22} color={c.textMuted} /> : <EyeOff size={22} color={c.textMuted} />}
                  </Pressable>
                </View>

                <TouchableOpacity
                  style={[s.primaryBtn, anyLoading && s.btnDisabled]}
                  onPress={handleEmailContinue}
                  activeOpacity={0.85}
                  disabled={anyLoading}
                >
                  {emailLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={s.primaryBtnText}>{isLoginMode ? 'Log In' : 'Create Account'}</Text>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={s.divider}>
                  <View style={s.dividerLine} />
                  <Text style={s.dividerText}>or</Text>
                  <View style={s.dividerLine} />
                </View>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[s.socialBtn, anyLoading && !appleLoading && s.btnDisabled]}
                    onPress={handleAppleSignIn}
                    activeOpacity={0.85}
                    disabled={anyLoading}
                  >
                    {appleLoading ? (
                      <ActivityIndicator size="small" color={c.textPrimary} />
                    ) : (
                      <>
                        <IconSymbol name="apple.logo" size={22} color={c.textPrimary} />
                        <Text style={s.socialBtnText}>Continue with Apple</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[s.socialBtn, anyLoading && !googleLoading && s.btnDisabled]}
                  onPress={handleGoogleSignIn}
                  activeOpacity={0.85}
                  disabled={anyLoading}
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color={c.textPrimary} />
                  ) : (
                    <>
                      <Image source={require('@/assets/images/google-logo.png')} style={s.googleLogo} resizeMode="contain" />
                      <Text style={s.socialBtnText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>

                {error ? <Text style={s.errorText}>{error}</Text> : null}

                <Text style={s.footerText}>
                  {isLoginMode ? 'Need an account? ' : 'Already have an account? '}
                  <Text style={s.footerLink} onPress={() => { setIsLoginMode((m) => !m); setError(null); }}>
                    {isLoginMode ? 'Sign up' : 'Sign in'}
                  </Text>
                </Text>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, paddingHorizontal: 24 },
    scroll: { flex: 1 },
    scrollContent: { paddingTop: 8, paddingBottom: 24 },

    title: {
      fontSize: 28, fontWeight: '800', color: c.textPrimary,
      lineHeight: 34, fontFamily: FF, letterSpacing: -0.3, marginBottom: 8,
    },
    subtitle: {
      fontSize: 16, color: c.textSecondary, lineHeight: 22, fontFamily: FF, marginBottom: 24,
    },
    emailStrong: { color: c.textPrimary, fontWeight: '700' },

    inputWrap: {
      minHeight: 54, borderRadius: 14, borderWidth: 1.5,
      borderColor: c.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      justifyContent: 'center', paddingHorizontal: 18, marginBottom: 12,
    },
    input: { fontSize: 16, fontWeight: '500', color: c.textPrimary, fontFamily: FF, paddingVertical: 16 },
    eyeBtn: { position: 'absolute', right: 16, top: 16 },

    primaryBtn: {
      height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.orange, marginTop: 4,
    },
    primaryBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', fontFamily: FF, letterSpacing: -0.2 },
    btnDisabled: { opacity: 0.5 },

    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle },
    dividerText: {
      fontSize: 12, fontWeight: '500', color: c.textMuted, fontFamily: FF,
      letterSpacing: 0.5, textTransform: 'uppercase',
    },

    socialBtn: {
      height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 10,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
      borderWidth: 1, borderColor: c.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
      marginBottom: 12,
    },
    socialBtnText: { fontSize: 17, fontWeight: '600', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.2 },
    googleLogo: { width: 22, height: 22, borderRadius: 4 },

    notice: { fontSize: 14, color: c.textSecondary, textAlign: 'center', fontFamily: FF, lineHeight: 20, marginBottom: 12 },
    errorText: { fontSize: 14, color: '#FF453A', textAlign: 'center', fontFamily: FF, lineHeight: 20, marginTop: 16 },
    footerText: { fontSize: 13, color: c.textSecondary, textAlign: 'center', fontFamily: FF, lineHeight: 18, marginTop: 20 },
    footerLink: { color: c.textPrimary, fontWeight: '700' },
  });
