import { Ionicons } from '@expo/vector-icons';
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

const FONT = 'System';
const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const router = useRouter();
  const finishAuth = useFinishAuth();
  const { colors: c } = useAppTheme();
  const s = useMemo(() => createStyles(c), [c]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  // Focus tracking
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);

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

  async function handleSignUp() {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter your email and a password.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: trimmedName ? { data: { full_name: trimmedName } } : undefined,
      });
      if (signUpErr) {
        setError(signUpErr.message);
        return;
      }

      // If email confirmation is enabled, Supabase returns a user but no session.
      // We show a "check your email" card. The reviewer never hits this branch
      // because they sign in with a pre-verified demo account.
      if (!data.session) {
        setConfirmationSent(true);
        return;
      }

      await finishAuth(data.session, trimmedName || null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Sign-up failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const token = code.trim();
    if (token.length < 6) {
      setVerifyError('Please enter the 6-digit code from your email.');
      return;
    }
    setVerifyError(null);
    setVerifying(true);
    try {
      const { data, error: verifyErr } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token,
        type: 'signup',
      });
      if (verifyErr) {
        setVerifyError(verifyErr.message);
        return;
      }
      if (!data.session) {
        setVerifyError('Verification succeeded but no session was returned. Please sign in.');
        return;
      }
      await finishAuth(data.session, trimmedName || null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setVerifyError(`Verification failed: ${msg}`);
    } finally {
      setVerifying(false);
    }
  }

  async function handleResendCode() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setResending(true);
    setVerifyError(null);
    setResendNotice(null);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
      });
      if (resendErr) {
        setVerifyError(resendErr.message);
        return;
      }
      setResendNotice('A new code is on its way.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setVerifyError(`Could not resend code: ${msg}`);
    } finally {
      setResending(false);
    }
  }

  if (confirmationSent) {
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
                onPress={() => {
                  setConfirmationSent(false);
                  setCode('');
                  setVerifyError(null);
                  setResendNotice(null);
                }}
                hitSlop={12}
              >
                <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
              </TouchableOpacity>

              <View style={s.spacer} />

              <Animated.View style={contentAnim}>
                {/* ── Title with mail icon ── */}
                <View style={s.titleSection}>
                  <Ionicons name="mail-outline" size={48} color={c.orange} style={s.otpIcon} />
                  <Text style={s.title}>Verify your email</Text>
                  <Text style={s.subtitle}>
                    Enter the 6-digit code we sent to{'\n'}
                    <Text style={s.subtitleEmail}>{email.trim()}</Text>
                  </Text>
                </View>

                {/* ── Code input ── */}
                <View style={s.fields}>
                  <View style={s.field}>
                    <Text style={s.label}>Verification Code</Text>
                    <TextInput
                      style={[s.input, s.codeInput, codeFocused && s.inputFocused]}
                      value={code}
                      onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      placeholderTextColor={c.textMuted}
                      keyboardType="number-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      maxLength={6}
                      editable={!verifying}
                      onSubmitEditing={handleVerifyOtp}
                      onFocus={() => setCodeFocused(true)}
                      onBlur={() => setCodeFocused(false)}
                    />
                  </View>
                </View>

                {verifyError ? <Text style={s.errorText}>{verifyError}</Text> : null}
                {resendNotice && !verifyError ? (
                  <Text style={s.resendNotice}>{resendNotice}</Text>
                ) : null}

                {/* ── Primary CTA ── */}
                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    (verifying || code.length < 6) && s.primaryBtnDisabled,
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={verifying || code.length < 6}
                  activeOpacity={0.85}
                >
                  {verifying ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={s.primaryBtnText}>Verify & Continue</Text>
                  )}
                </TouchableOpacity>

                {/* ── Resend link ── */}
                <TouchableOpacity
                  style={s.switchRow}
                  onPress={handleResendCode}
                  disabled={verifying || resending}
                  activeOpacity={0.7}
                >
                  <Text style={s.switchText}>
                    Didn't get a code?{' '}
                    <Text style={s.switchTextAccent}>
                      {resending ? 'Sending...' : 'Resend'}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
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
              <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
            </TouchableOpacity>

            <View style={s.spacer} />

            <Animated.View style={contentAnim}>
              {/* ── Title ── */}
              <View style={s.titleSection}>
                <Text style={s.title}>Create your account</Text>
                <Text style={s.subtitle}>Start your GLP-1 journey</Text>
              </View>

              {/* ── Inputs ── */}
              <View style={s.fields}>
                <View style={s.field}>
                  <Text style={s.label}>Name (optional)</Text>
                  <TextInput
                    style={[s.input, nameFocused && s.inputFocused]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor={c.textMuted}
                    autoCapitalize="sentences"
                    autoCorrect={false}
                    autoComplete="name"
                    textContentType="name"
                    editable={!loading}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                  />
                </View>

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
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    placeholderTextColor={c.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password-new"
                    textContentType="newPassword"
                    editable={!loading}
                    onSubmitEditing={handleSignUp}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                </View>
              </View>

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              {/* ── Primary CTA ── */}
              <TouchableOpacity
                style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
                onPress={handleSignUp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.primaryBtnText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* ── Switch to sign in ── */}
              <TouchableOpacity
                style={s.switchRow}
                onPress={() => router.replace('/auth/email-sign-in')}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text style={s.switchText}>
                  Already have an account?{' '}
                  <Text style={s.switchTextAccent}>Sign in</Text>
                </Text>
              </TouchableOpacity>

              {/* ── Legal ── */}
              <Text style={s.legalText}>
                By creating an account, you agree to our{' '}
                <Text style={s.legalLink}>Terms</Text>
                {' & '}
                <Text style={s.legalLink}>Privacy Policy</Text>
              </Text>
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
    otpIcon: {
      marginBottom: 16,
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
    subtitleEmail: {
      color: c.textPrimary,
      fontWeight: '600',
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
    codeInput: {
      textAlign: 'center',
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: 12,
      paddingVertical: 22,
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
    resendNotice: {
      fontSize: 14,
      color: c.orange,
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
      marginBottom: 8,
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

    // ── Legal ──
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
