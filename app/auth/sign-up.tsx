import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
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

const BG         = '#F0EAE4';
const TERRACOTTA = '#D67455';
const DARK       = '#1C0F09';
const MUTED      = 'rgba(28,15,9,0.45)';
const FONT       = 'Helvetica Neue';

function GlassBorder({ r = 16 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: r,
          borderWidth: 1,
          borderTopColor:    'rgba(255,255,255,0.80)',
          borderLeftColor:   'rgba(255,255,255,0.55)',
          borderRightColor:  'rgba(255,255,255,0.18)',
          borderBottomColor: 'rgba(255,255,255,0.10)',
        },
      ]}
    />
  );
}

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setSession, loadProfile } = useUserStore();

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

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
        {/* Back button */}
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={DARK} />
        </TouchableOpacity>

        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoIcon}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, s.logoOverlay]} />
            <GlassBorder r={22} />
            <Ionicons name="leaf-outline" size={28} color={TERRACOTTA} />
          </View>
          <Text style={s.wordmark}>Create Account</Text>
          <Text style={s.tagline}>Start your GLP-1 journey</Text>
        </View>

        {/* Card */}
        <View style={s.cardShadow}>
          <View style={s.card}>
            <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, s.cardOverlay]} />
            <GlassBorder r={28} />

            <View style={s.cardContent}>

              {/* Name */}
              <View style={s.inputWrap}>
                <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
                <View style={[StyleSheet.absoluteFillObject, s.inputOverlay]} />
                <GlassBorder r={14} />
                <TextInput
                  style={s.input}
                  placeholder="Full Name"
                  placeholderTextColor={MUTED}
                  value={name}
                  onChangeText={setName}
                  textContentType="name"
                  autoComplete="name"
                />
              </View>

              {/* Email */}
              <View style={[s.inputWrap, { marginTop: 12 }]}>
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
                  placeholder="Password (6+ characters)"
                  placeholderTextColor={MUTED}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="newPassword"
                  autoComplete="new-password"
                  returnKeyType="go"
                  onSubmitEditing={handleSignUp}
                />
              </View>

              {/* Error */}
              {error && <Text style={s.errorText}>{error}</Text>}

              {/* Create Account button */}
              <TouchableOpacity
                style={[s.primaryBtn, loading && s.btnDisabled]}
                onPress={handleSignUp}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.primaryBtnText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Link to sign in */}
              <TouchableOpacity
                style={s.linkBtn}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Text style={s.linkText}>
                  Already have an account?{' '}
                  <Text style={s.linkBold}>Sign in →</Text>
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
  root:   { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },

  backBtn: { position: 'absolute', top: 56, left: 24, zIndex: 10, padding: 8 },

  // Logo
  logoWrap:    { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 64, height: 64, borderRadius: 20, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: DARK, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
  },
  logoOverlay: { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.45)' },
  wordmark:    { fontSize: 28, fontWeight: '800', color: DARK, letterSpacing: -0.8, fontFamily: FONT },
  tagline:     { fontSize: 14, color: MUTED, fontWeight: '500', marginTop: 4, fontFamily: FONT },

  // Card
  cardShadow: {
    borderRadius: 28,
    shadowColor: DARK, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 32, elevation: 10,
  },
  card:        { borderRadius: 28, overflow: 'hidden' },
  cardOverlay: { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.35)' },
  cardContent: { padding: 24 },

  // Inputs
  inputWrap:    { height: 52, borderRadius: 14, overflow: 'hidden', justifyContent: 'center' },
  inputOverlay: { borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.50)' },
  input:        { paddingHorizontal: 16, fontSize: 15, color: DARK, height: 52, fontFamily: FONT },

  // Error
  errorText: { color: '#C0392B', fontSize: 13, marginTop: 10, textAlign: 'center', fontFamily: FONT },

  // Primary button
  primaryBtn: {
    height: 52, borderRadius: 14, backgroundColor: TERRACOTTA,
    alignItems: 'center', justifyContent: 'center', marginTop: 18,
    shadowColor: TERRACOTTA, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.30, shadowRadius: 14, elevation: 6,
  },
  btnDisabled:    { opacity: 0.55 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: FONT },

  // Link
  linkBtn:  { marginTop: 18, alignItems: 'center' },
  linkText: { fontSize: 14, color: MUTED, fontFamily: FONT },
  linkBold: { color: TERRACOTTA, fontWeight: '700', fontFamily: FONT },
});
