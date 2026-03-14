import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
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
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Design tokens (light card — intentionally fixed, theme-independent) ──────
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
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [activeTab, setActiveTab]         = useState<'login' | 'register'>(
    tab === 'register' ? 'register' : 'login',
  );
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [name, setName]                   = useState('');
  const [rememberMe, setRememberMe]       = useState(false);
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading]   = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  function handleTabChange(t: 'login' | 'register') {
    setActiveTab(t);
    setError(null);
  }

  // ── Demo login ──────────────────────────────────────────────────────────
  function handleDemoLogin() {
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
      const sbProfile = useUserStore.getState().profile;
      router.replace(sbProfile?.program_start_date ? '/(tabs)' : '/onboarding');
    }
    setLoading(false);
  }

  // ── Email sign-up ───────────────────────────────────────────────────────
  async function handleSignUp() {
    const trimmedEmail = email.trim();
    const trimmedName  = name.trim();
    if (!trimmedName || !trimmedEmail || !password) {
      setError('Please fill in all fields.');
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
      options: { data: { full_name: trimmedName } },
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      setSession(data.session);
      await supabase.from('profiles').upsert({ id: data.user!.id, full_name: trimmedName });
      await loadProfile();
      router.replace('/onboarding');
    } else {
      setError('Check your email for a confirmation link, then sign in.');
    }

    setLoading(false);
  }

  // ── Google OAuth ────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
      if (!supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseKey || supabaseKey.includes('placeholder')) {
        setError('Supabase not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env');
        setGoogleLoading(false);
        return;
      }

      const redirectUri = makeRedirectUri({ scheme: 'titrahealthappdemo' });
      console.log('[Google Sign-In] Redirect URI:', redirectUri);

      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      });

      if (err || !data.url) {
        setError(err?.message ?? 'Google sign-in failed. Is it enabled in Supabase?');
        setGoogleLoading(false);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      console.log('[Google Sign-In] Browser result type:', result.type);
      if (result.type === 'success' && result.url) {
        console.log('[Google Sign-In] Redirect URL:', result.url);

        let session = null;
        const hash = result.url.includes('#') ? result.url.split('#')[1] : '';
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data: sd, error: sessionErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionErr) {
            console.log('[Google Sign-In] setSession error:', sessionErr.message);
            setError(sessionErr.message);
            setGoogleLoading(false);
            return;
          }
          session = sd.session;
        } else {
          console.log('[Google Sign-In] No hash tokens, trying code exchange...');
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(result.url);
          if (exchangeErr) {
            console.log('[Google Sign-In] Exchange error:', exchangeErr.message);
            setError(exchangeErr.message);
            setGoogleLoading(false);
            return;
          }
          const { data: { session: s } } = await supabase.auth.getSession();
          session = s;
        }

        if (session) {
          setSession(session);
          await loadProfile();
          const sbProfile = useUserStore.getState().profile;
          router.replace(sbProfile?.program_start_date ? '/(tabs)' : '/onboarding');
        } else {
          setError('Sign in completed but no session was returned. Please try again.');
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      let hint = `Google sign-in failed: ${msg}`;
      if (msg.toLowerCase().includes('redirect') || msg.toLowerCase().includes('uri')) {
        const uri = makeRedirectUri({ scheme: 'titrahealthappdemo' });
        hint = `Redirect URI mismatch. Add this to Supabase → Auth → URL Configuration → Redirect URLs:\n${uri}`;
      }
      setError(hint);
    }

    setGoogleLoading(false);
  }

  // ── Apple Sign In ───────────────────────────────────────────────────────
  async function handleAppleSignIn() {
    if (Platform.OS !== 'ios') {
      setError('Apple Sign In is only available on iOS.');
      return;
    }
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      setError('Apple Sign In requires iOS 13+ on a real device.');
      return;
    }
    setAppleLoading(true);
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { identityToken } = credential;
      if (!identityToken) throw new Error('No identity token returned.');
      const { data, error: err } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
      });
      if (err) { setError(err.message); return; }
      if (data.session) {
        setSession(data.session);
        await loadProfile();
        const sbProfile = useUserStore.getState().profile;
        router.replace(sbProfile?.program_start_date ? '/(tabs)' : '/onboarding');
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') setError(e.message ?? 'Apple sign-in failed.');
    } finally {
      setAppleLoading(false);
    }
  }

  const isLogin = activeTab === 'login';
  const headline = isLogin ? 'Welcome back' : 'Create account';
  const subtitle = isLogin
    ? 'Track your GLP-1 journey'
    : 'Start your GLP-1 journey today';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Dark header ── */}
      <View style={s.header}>
        <SafeAreaView edges={['top']}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </SafeAreaView>
        <View style={s.headerContent}>
          <Ionicons name="leaf-outline" size={26} color={ORANGE} style={s.leafIcon} />
          <Text style={s.headline}>{headline}</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
        </View>
      </View>

      {/* ── White card ── */}
      <KeyboardAvoidingView
        style={s.kavRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.card}>

            <AuthTabSwitcher active={activeTab} onChange={handleTabChange} />

            {/* Register-only: Full Name */}
            {!isLogin && (
              <PillInput
                icon="person-outline"
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                textContentType="name"
                autoComplete="name"
                autoCapitalize="words"
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

              {/* Apple — iOS only */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={s.socialBtn}
                  onPress={handleAppleSignIn}
                  activeOpacity={0.85}
                  disabled={appleLoading}
                >
                  {appleLoading ? (
                    <ActivityIndicator size="small" color={INPUT_TEXT} />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={20} color={INPUT_TEXT} />
                      <Text style={s.socialBtnText}>Apple</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

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
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  root:    { flex: 1, backgroundColor: c.bg },

  // Header (dark, theme-aware)
  header: {
    height: SCREEN_H * 0.42,
    backgroundColor: c.bg,
    paddingHorizontal: 28,
  },
  backBtn: {
    marginTop: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: w(0.35),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 28,
  },
  leafIcon: { marginBottom: 12 },
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

  // Card (fixed light — intentional design contrast)
  kavRoot:     { flex: 1 },
  scrollContent: { flexGrow: 1 },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    minHeight: SCREEN_H * 0.6,
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
  });
};
