import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/user-store';

WebBrowser.maybeCompleteAuthSession();

const BG = '#F0EAE4';
const TERRACOTTA = '#C4784B';
const DARK = '#1C0F09';
const MUTED = 'rgba(28,15,9,0.45)';

function GlassBorder({ r = 16 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: r,
          borderWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.80)',
          borderLeftColor: 'rgba(255,255,255,0.55)',
          borderRightColor: 'rgba(255,255,255,0.18)',
          borderBottomColor: 'rgba(255,255,255,0.10)',
        },
      ]}
    />
  );
}

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setSession, loadProfile } = useUserStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (sbProfile?.program_start_date) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    }
    setLoading(false);
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);

    try {
      // NOTE: Requires Google provider enabled in Supabase dashboard
      // and redirect URI configured in Google Cloud Console.
      const { makeRedirectUri } = await import('expo-auth-session');
      const redirectUri = makeRedirectUri();

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
      if (result.type === 'success' && result.url) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(result.url);
        if (exchangeErr) {
          setError(exchangeErr.message);
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setSession(session);
            await loadProfile();
            const sbProfile = useUserStore.getState().profile;
            if (sbProfile?.program_start_date) {
              router.replace('/(tabs)');
            } else {
              router.replace('/onboarding');
            }
          }
        }
      }
    } catch {
      setError('Google sign-in is not configured. Use email/password below.');
    }

    setGoogleLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / wordmark */}
        <View style={s.logoWrap}>
          <View style={s.logoIcon}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, s.logoOverlay]} />
            <GlassBorder r={22} />
            <Ionicons name="leaf-outline" size={28} color={TERRACOTTA} />
          </View>
          <Text style={s.wordmark}>TitraHealth</Text>
          <Text style={s.tagline}>Your GLP-1 companion</Text>
        </View>

        {/* Card */}
        <View style={s.cardShadow}>
          <View style={s.card}>
            <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, s.cardOverlay]} />
            <GlassBorder r={28} />

            <View style={s.cardContent}>

              {/* Google button */}
              <TouchableOpacity
                style={s.googleBtn}
                onPress={handleGoogleSignIn}
                activeOpacity={0.85}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={DARK} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#4285F4" />
                    <Text style={s.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or</Text>
                <View style={s.dividerLine} />
              </View>

              {/* Email */}
              <View style={s.inputWrap}>
                <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
                <View style={[StyleSheet.absoluteFillObject, s.inputOverlay]} />
                <GlassBorder r={14} />
                <TextInput
                  style={s.input}
                  placeholder="Email"
                  placeholderTextColor={MUTED}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                />
              </View>

              {/* Password */}
              <View style={[s.inputWrap, { marginTop: 12 }]}>
                <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
                <View style={[StyleSheet.absoluteFillObject, s.inputOverlay]} />
                <GlassBorder r={14} />
                <TextInput
                  style={s.input}
                  placeholder="Password"
                  placeholderTextColor={MUTED}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="password"
                  autoComplete="current-password"
                  returnKeyType="go"
                  onSubmitEditing={handleSignIn}
                />
              </View>

              {/* Error */}
              {error && <Text style={s.errorText}>{error}</Text>}

              {/* Sign In button */}
              <TouchableOpacity
                style={[s.signInBtn, loading && s.btnDisabled]}
                onPress={handleSignIn}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.signInBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Link to sign up */}
              <TouchableOpacity
                style={s.linkBtn}
                onPress={() => router.push('/auth/sign-up')}
                activeOpacity={0.7}
              >
                <Text style={s.linkText}>
                  Don't have an account?{' '}
                  <Text style={s.linkBold}>Sign up →</Text>
                </Text>
              </TouchableOpacity>

            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },

  // Logo
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 64, height: 64, borderRadius: 20, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: DARK, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
  },
  logoOverlay: { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.45)' },
  wordmark: { fontSize: 30, fontWeight: '800', color: DARK, letterSpacing: -0.8 },
  tagline: { fontSize: 14, color: MUTED, fontWeight: '500', marginTop: 4 },

  // Card
  cardShadow: {
    borderRadius: 28,
    shadowColor: DARK, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 32, elevation: 10,
  },
  card: { borderRadius: 28, overflow: 'hidden' },
  cardOverlay: { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.40)' },
  cardContent: { padding: 24 },

  // Google button
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 52, borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: DARK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: DARK },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(28,15,9,0.12)' },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: MUTED, fontWeight: '500' },

  // Inputs
  inputWrap: { height: 52, borderRadius: 14, overflow: 'hidden', justifyContent: 'center' },
  inputOverlay: { borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.50)' },
  input: { paddingHorizontal: 16, fontSize: 15, color: DARK, height: 52 },

  // Error
  errorText: { color: '#E05252', fontSize: 13, marginTop: 10, textAlign: 'center' },

  // Sign In button
  signInBtn: {
    height: 52, borderRadius: 14, backgroundColor: TERRACOTTA,
    alignItems: 'center', justifyContent: 'center', marginTop: 18,
    shadowColor: TERRACOTTA, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
  },
  btnDisabled: { opacity: 0.55 },
  signInBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Link
  linkBtn: { marginTop: 18, alignItems: 'center' },
  linkText: { fontSize: 14, color: MUTED },
  linkBold: { color: TERRACOTTA, fontWeight: '700' },
});
