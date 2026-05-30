import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useFinishAuth } from '@/lib/auth-helpers';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { ChevronLeft } from 'lucide-react-native';

const FONT = 'System';

export default function EmailSignInScreen() {
  const router = useRouter();
  const finishAuth = useFinishAuth();
  const { colors: c } = useAppTheme();
  const s = useMemo(() => createStyles(c), [c]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // ── Entrance animation ──
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(12);

  useEffect(() => {
    contentOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
    contentTranslateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
  }, []);

  const contentAnim = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  async function handleSignIn() {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (signInErr) {
        setError(signInErr.message);
        return;
      }
      if (!data.session) {
        setError('Sign-in completed but no session was returned. Please try again.');
        return;
      }
      await finishAuth(data.session);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Sign-in failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Glass back button ── */}
            <TouchableOpacity
              style={s.backButton}
              onPress={() => router.back()}
              hitSlop={12}
            >
              <ChevronLeft size={22} color={c.textPrimary} />
            </TouchableOpacity>

            <View style={s.spacer} />

            <Animated.View style={contentAnim}>
              {/* ── Title ── */}
              <View style={s.titleSection}>
                <Text style={s.title}>Welcome back</Text>
                <Text style={s.subtitle}>Sign in to your account</Text>
              </View>

              {/* ── Inputs ── */}
              <View style={s.fields}>
                <View style={s.field}>
                  <Text style={s.label}>Email</Text>
                  <TextInput
                    style={[s.input, emailFocused && s.inputFocused]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={c.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    editable={!loading}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>Password</Text>
                  <TextInput
                    style={[s.input, passwordFocused && s.inputFocused]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Your password"
                    placeholderTextColor={c.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    textContentType="password"
                    editable={!loading}
                    onSubmitEditing={handleSignIn}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                </View>
              </View>

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              {/* ── Primary CTA ── */}
              <TouchableOpacity
                style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
                onPress={handleSignIn}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.primaryBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {/* ── Switch to sign up ── */}
              <TouchableOpacity
                style={s.switchRow}
                onPress={() => router.push('/auth/sign-up')}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text style={s.switchText}>
                  Don't have an account?{' '}
                  <Text style={s.switchTextAccent}>Sign up</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },
    flex: { flex: 1 },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 28,
      paddingBottom: 24,
    },

    // ── Glass back button ──
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },

    spacer: { flex: 1 },

    // ── Title ──
    titleSection: {
      marginBottom: 32,
    },
    title: {
      fontSize: 30,
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

    // ── Fields ──
    fields: {
      gap: 14,
      marginBottom: 18,
    },
    field: {
      gap: 8,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
      fontFamily: FONT,
      letterSpacing: 0.2,
    },
    input: {
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      borderRadius: 18,
      paddingVertical: 18,
      paddingHorizontal: 18,
      fontSize: 16,
      color: c.textPrimary,
      fontFamily: FONT,
      letterSpacing: 0,
      borderWidth: 1.5,
      borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
      ...(c.isDark
        ? {}
        : {
            shadowColor: 'rgba(0,0,0,0.08)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 1,
            shadowRadius: 12,
            elevation: 2,
          }),
    },
    inputFocused: {
      borderColor: c.orange,
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

    // ── Primary CTA ──
    primaryBtn: {
      backgroundColor: c.orange,
      borderRadius: 18,
      paddingVertical: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    primaryBtnDisabled: {
      opacity: 0.6,
    },
    primaryBtnText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: FONT,
      letterSpacing: -0.2,
    },

    // ── Switch ──
    switchRow: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    switchText: {
      fontSize: 14,
      color: c.textSecondary,
      fontFamily: FONT,
    },
    switchTextAccent: {
      color: c.orange,
      fontWeight: '600',
    },
  });
