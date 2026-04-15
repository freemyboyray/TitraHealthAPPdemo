import { Ionicons } from '@expo/vector-icons';
// expo-auth-session depends on expo-crypto (native); guard so Expo Go doesn't crash.
let makeRedirectUri: typeof import('expo-auth-session').makeRedirectUri = () => 'titrahealthappdemo://';
try { makeRedirectUri = require('expo-auth-session').makeRedirectUri; } catch {}
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Design tokens (light card - intentionally fixed, theme-independent) ──────
const CARD_BG    = '#FFFFFF';
const INPUT_BG   = '#F2F2F7';
const INPUT_TEXT = '#1C1C1E';
const INPUT_ICON = '#8E8E93';
const PLACEHOLDER= 'rgba(60,60,67,0.40)';
const SEG_WRAP   = '#F2F2F7';
const SEG_ACTIVE = '#FFFFFF';
const TAB_ACTIVE = '#1C1C1E';
const TAB_INACT  = '#8E8E93';
const SOCIAL_BDR = '#E5E5EA';
const ORANGE     = '#FF742A';
const FONT       = 'Helvetica Neue';

// ─── AuthTabSwitcher ─────────────────────────────────────────────────────────
function AuthTabSwitcher({
  active,
  onChange,
}: {
  active: 'login' | 'register';
  onChange: (t: 'login' | 'register') => void;
}) {
  return (
    <View style={ts.wrap}>
      {(['login', 'register'] as const).map((tab) => {
        const isActive = tab === active;
        return (
          <TouchableOpacity
            key={tab}
            style={[ts.pill, isActive && ts.pillActive]}
            onPress={() => onChange(tab)}
            activeOpacity={0.8}
          >
            <Text style={[ts.label, isActive ? ts.labelActive : ts.labelInactive]}>
              {tab === 'login' ? 'Login' : 'Register'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const ts = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: SEG_WRAP,
    borderRadius: 36,
    padding: 4,
    marginBottom: 24,
  },
  pill: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
  },
  pillActive: {
    backgroundColor: SEG_ACTIVE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  label:        { fontSize: 15, fontFamily: FONT },
  labelActive:  { color: TAB_ACTIVE, fontWeight: '700' },
  labelInactive:{ color: TAB_INACT,  fontWeight: '500' },
});

// ─── PillInput ────────────────────────────────────────────────────────────────
function PillInput({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  textContentType,
  autoComplete,
  returnKeyType,
  onSubmitEditing,
  autoCapitalize,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  textContentType?: React.ComponentProps<typeof TextInput>['textContentType'];
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  returnKeyType?: React.ComponentProps<typeof TextInput>['returnKeyType'];
  onSubmitEditing?: () => void;
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
}) {
  return (
    <View style={pi.wrap}>
      <Ionicons name={icon} size={20} color={INPUT_ICON} style={pi.icon} />
      <TextInput
        style={pi.input}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        textContentType={textContentType}
        autoComplete={autoComplete}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize={autoCapitalize ?? 'none'}
      />
    </View>
  );
}

const pi = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 26,
    height: 52,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  icon:  { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: INPUT_TEXT, fontFamily: FONT },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SignInScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { setSession, loadProfile, setDemoMode, setSessionLoaded } = useUserStore();
  const { setProfile } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [activeTab, setActiveTab]         = useState<'login' | 'register'>(
    tab === 'register' ? 'register' : 'login',
  );
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [username, setUsername]             = useState('');
  const [rememberMe, setRememberMe]       = useState(false);
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [otpCode, setOtpCode]             = useState('');

  function handleTabChange(t: 'login' | 'register') {
    setActiveTab(t);
    setError(null);
  }

  // ── Demo login ──────────────────────────────────────────────────────────
  function handleDemoLogin() {
    setProfile(MOCK_PROFILE);
    setDemoMode(true);
    setSessionLoaded(true);
    router.replace('/(tabs)');
  }

  // ── Email sign-in ───────────────────────────────────────────────────────
  async function handleSignIn() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      setSession(data.session);
      await loadProfile();
      router.replace('/');
    }
    setLoading(false);
  }

  // ── Email sign-up ───────────────────────────────────────────────────────
  async function handleSignUp() {
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !trimmedEmail || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmedUsername)) {
      setError('Username must be 3-20 characters (letters, numbers, underscores).');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { data: { username: trimmedUsername } },
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      setSession(data.session);
      await supabase.from('profiles').upsert({ id: data.user!.id, username: trimmedUsername });
      await loadProfile();
      router.replace('/');
    } else {
      // No session = email confirmation required. Show OTP screen.
      setPendingVerification(true);
    }

    setLoading(false);
  }

  // ── OTP verification ───────────────────────────────────────────────────
  async function handleVerifyOtp() {
    const code = otpCode.trim();
    if (!code) {
      setError('Please enter the code from your email.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: 'signup',
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      setSession(data.session);
      const trimmedUsername = username.trim();
      if (trimmedUsername) {
        await supabase.from('profiles').upsert({ id: data.user!.id, username: trimmedUsername });
      }
      await loadProfile();
      router.replace('/');
    }
    setLoading(false);
  }

  async function handleResendCode() {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });
    if (err) {
      setError(err.message);
    } else {
      setError('A new code has been sent to your email.');
    }
    setLoading(false);
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
      const { data: existing } = await supabase.from('profiles').select('username').eq('id', user.id).single();
      if (!existing?.username) {
        const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];
        if (name) {
          await supabase.from('profiles').upsert({ id: user.id, username: name }, { onConflict: 'id' });
        }
      }
    }
    await loadProfile();
    router.replace('/');
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
        setError(err?.message ?? 'Google sign-in failed. Enable Google in Supabase → Authentication → Providers.');
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
        setError('Google sign-in failed: no token returned. Check Supabase redirect URL config.');
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


  const isLogin = activeTab === 'login';
  const headline = isLogin ? 'Welcome back' : 'Get started';
  const subtitle = isLogin
    ? 'Your GLP-1 companion, always in your corner.'
    : 'Smarter tracking for your GLP-1 journey.';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        automaticallyAdjustKeyboardInsets
      >
        {/* ── Dark header ── */}
        <View style={s.header}>
          <SafeAreaView edges={['top']} />
          <View style={s.headerContent}>
            <View style={s.brandRow}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={s.logoMark}
              />
              <Text style={s.brandName}>Titra Health</Text>
            </View>
            <Text style={s.headline}>{headline}</Text>
            <Text style={s.subtitle}>{subtitle}</Text>
          </View>
        </View>

        {/* ── White card ── */}
        <View style={s.card}>

          {pendingVerification ? (
            <>
              <Text style={s.otpTitle}>Check your email</Text>
              <Text style={s.otpSubtitle}>
                We sent a verification code to {email.trim()}
              </Text>

              <PillInput
                icon="key-outline"
                placeholder="Enter verification code"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                returnKeyType="go"
                onSubmitEditing={handleVerifyOtp}
              />

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[s.ctaBtn, loading && s.btnDisabled]}
                onPress={handleVerifyOtp}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.ctaBtnText}>Verify</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.resendBtn}
                onPress={handleResendCode}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text style={s.resendText}>Didn't get a code? Resend</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.resendBtn}
                onPress={() => { setPendingVerification(false); setOtpCode(''); setError(null); }}
                activeOpacity={0.7}
              >
                <Text style={s.resendText}>Back to sign up</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
            <AuthTabSwitcher active={activeTab} onChange={handleTabChange} />

            {/* Register-only: Full Name */}
            {!isLogin && (
              <PillInput
                icon="person-outline"
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                textContentType="username"
                autoComplete="username"
                autoCapitalize="none"
              />
            )}

            <PillInput
              icon="mail-outline"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
            />

            <PillInput
              icon="lock-closed-outline"
              placeholder={isLogin ? 'Password' : 'Password (6+ characters)'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType={isLogin ? 'password' : 'newPassword'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              returnKeyType="go"
              onSubmitEditing={isLogin ? handleSignIn : handleSignUp}
            />

            {/* Login-only: Remember me + Forgot */}
            {isLogin && (
              <View style={s.rememberRow}>
                <TouchableOpacity
                  style={s.rememberLeft}
                  onPress={() => setRememberMe((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[s.checkbox, rememberMe && s.checkboxOn]}>
                    {rememberMe && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text style={s.rememberLabel}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={s.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Error */}
            {error ? <Text style={s.errorText}>{error}</Text> : null}

            {/* CTA */}
            <TouchableOpacity
              style={[s.ctaBtn, loading && s.btnDisabled]}
              onPress={isLogin ? handleSignIn : handleSignUp}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.ctaBtnText}>{isLogin ? 'Log In' : 'Create Account'}</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>Or login with</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Social buttons */}
            <View style={[s.socialRow, Platform.OS !== 'ios' && s.socialRowCentered]}>
              {/* Google */}
              <TouchableOpacity
                style={[s.socialBtn, Platform.OS !== 'ios' && s.socialBtnFull]}
                onPress={handleGoogleSignIn}
                activeOpacity={0.85}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={INPUT_TEXT} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#4285F4" />
                    <Text style={s.socialBtnText}>Google</Text>
                  </>
                )}
              </TouchableOpacity>

            </View>

            {/* Demo link */}
            <TouchableOpacity
              style={s.demoLink}
              onPress={handleDemoLogin}
              activeOpacity={0.7}
            >
              <Text style={s.demoLinkText}>Try demo - no account needed</Text>
            </TouchableOpacity>
            </>
          )}

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
    fontSize: 16,
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
    paddingBottom: 40,
  },

  // Remember me row
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: -4,
  },
  rememberLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn:    { backgroundColor: ORANGE, borderColor: ORANGE },
  rememberLabel: { fontSize: 13, color: INPUT_ICON, fontFamily: FONT },
  forgotText:    { fontSize: 13, color: ORANGE, fontWeight: '600', fontFamily: FONT },

  // Error
  errorText: {
    color: '#C0392B',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: FONT,
  },

  // CTA button
  ctaBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 14,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.55 },
  ctaBtnText:  { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: FONT },

  // Divider
  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E5EA' },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: INPUT_ICON, fontWeight: '500', fontFamily: FONT },

  // Social buttons
  socialRow:        { flexDirection: 'row', gap: 12, marginBottom: 24 },
  socialRowCentered:{ justifyContent: 'center' },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: SOCIAL_BDR,
    backgroundColor: CARD_BG,
  },
  socialBtnFull: { flex: 0, width: 200 },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: INPUT_TEXT, fontFamily: FONT },

  // Demo link
  demoLink:     { alignItems: 'center', paddingVertical: 8 },
  demoLinkText: { fontSize: 14, color: INPUT_ICON, fontFamily: FONT },

  // OTP verification
  otpTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: INPUT_TEXT,
    fontFamily: FONT,
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  otpSubtitle: {
    fontSize: 15,
    color: INPUT_ICON,
    fontFamily: FONT,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 21,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  resendText: {
    fontSize: 14,
    color: ORANGE,
    fontWeight: '600',
    fontFamily: FONT,
  },
  });
};
