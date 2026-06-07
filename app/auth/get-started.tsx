import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { ChevronLeft } from 'lucide-react-native';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FONT = 'System';

// First step after "Get Started" on the welcome screen. Collects a display
// name, then hands off to the intro value-prop carousel (/auth/intro), which
// continues to the sign-in screen (create-account mode). The name is passed
// forward as a route param through intro and applied as the profile username
// by finishAuth(session, fallbackName) once the account is created.
export default function GetStartedScreen() {
  const router = useRouter();
  const { colors: c } = useAppTheme();
  const s = useMemo(() => createStyles(c), [c]);

  const [name, setName] = useState('');
  const trimmed = name.trim();

  const goNext = (withName: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const target =
      withName && trimmed
        ? `/auth/intro?name=${encodeURIComponent(trimmed)}`
        : '/auth/intro';
    router.navigate(target as any);
  };

  return (
    <View style={s.root}>
      <StatusBar style={c.isDark ? 'light' : 'dark'} />

      {/* ── Gradient background (matches welcome / sign-in) ── */}
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
        {/* Back + Skip */}
        <View style={s.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={26} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
          <Pressable
            onPress={() => goNext(false)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip"
          >
            <Text style={s.skip}>Skip</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.content}>
            <Text style={s.subtitle}>Let&apos;s get to know each other!</Text>
            <Text style={s.headline}>What would you like us to call you?</Text>

            <View style={s.inputContainer}>
              <TextInput
                style={s.input}
                placeholder="Your name"
                placeholderTextColor={c.isDark ? 'rgba(255,255,255,0.4)' : '#999'}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                returnKeyType="done"
                onSubmitEditing={() => trimmed && goNext(true)}
                autoFocus
              />
            </View>
          </View>

          {/* Continue */}
          <Pressable
            style={({ pressed }) => [
              s.cta,
              !trimmed && s.ctaDisabled,
              pressed && trimmed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => goNext(true)}
            disabled={!trimmed}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={s.ctaText}>Continue</Text>
          </Pressable>
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
    safe: {
      flex: 1,
      paddingHorizontal: 28,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 8,
      paddingBottom: 4,
    },
    backBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      marginLeft: -8,
    },
    skip: {
      fontSize: 17,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.75)',
      fontFamily: FONT,
      letterSpacing: -0.2,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingBottom: 40,
    },
    subtitle: {
      fontSize: 17,
      fontWeight: '500',
      textAlign: 'center',
      color: 'rgba(255,255,255,0.85)',
      fontFamily: FONT,
      letterSpacing: -0.2,
      marginBottom: 12,
    },
    headline: {
      fontSize: 30,
      fontWeight: '800',
      textAlign: 'center',
      color: '#FFFFFF',
      fontFamily: FONT,
      letterSpacing: -0.5,
      lineHeight: 38,
      marginBottom: 32,
    },
    inputContainer: {
      height: 60,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: c.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    input: {
      fontSize: 17,
      fontWeight: '500',
      color: c.isDark ? '#FFFFFF' : '#1A1A1A',
      fontFamily: FONT,
      height: '100%',
    },
    cta: {
      height: 56,
      borderRadius: 28,
      backgroundColor: c.orange,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    ctaDisabled: {
      opacity: 0.4,
    },
    ctaText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: FONT,
      letterSpacing: -0.3,
    },
  });
