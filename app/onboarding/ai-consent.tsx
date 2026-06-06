import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { usePreferencesStore } from '@/stores/preferences-store';

const FF = 'System';

/**
 * Explicit, default-OFF opt-in for sending data to OpenAI. Shown right after the
 * terms screen. Required for App Store Guideline 5.1.1(i)/5.1.2(i): AI data
 * sharing must be affirmatively granted, separate from general terms acceptance.
 * Declining is non-blocking — core tracking works without AI, and the user can
 * still enable it later at the point of first use or in Settings.
 */
export default function AiConsentScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { setAiDataConsent } = usePreferencesStore();

  const next = () => router.push('/onboarding/doctor-code');

  const handleAllow = () => {
    setAiDataConsent(true);
    next();
  };

  const handleSkip = () => {
    // Leave aiDataConsent false. The user can opt in later from any AI feature.
    next();
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={4} total={17} onBack={() => router.back()} />

        <View style={s.iconBadge}>
          <Sparkles size={26} color={colors.orange} />
        </View>

        <Text style={s.title}>Enable AI features?</Text>
        <Text style={s.subtitle}>
          Titra can use OpenAI, a third-party AI provider, to power Ask AI, food analysis, and voice
          logging. This is optional — you can turn it on later anytime.
        </Text>

        <View style={s.card}>
          <Text style={s.cardHeading}>What gets sent to OpenAI</Text>
          <Text style={s.cardItem}>• Your chat messages and food descriptions</Text>
          <Text style={s.cardItem}>• Food photos you capture</Text>
          <Text style={s.cardItem}>• Voice recordings (for transcription)</Text>
          <Text style={s.cardItem}>
            • Wellness context: medication, dose, weight progress, scores, and side effects
          </Text>
          <View style={s.divider} />
          <Text style={s.cardNever}>
            <Text style={s.cardNeverStrong}>Never sent: </Text>
            your name, email, or account ID.
          </Text>
          <Text style={s.cardNever}>
            OpenAI doesn't train on this data and deletes it within 30 days.
          </Text>
        </View>

        <View style={s.bottom}>
          <ContinueButton onPress={handleAllow} label="Allow AI features" />
          <TouchableOpacity
            onPress={handleSkip}
            style={s.skipBtn}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <Text style={s.skipText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, paddingHorizontal: 24 },
    iconBadge: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: 'rgba(255,116,42,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 18,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
      lineHeight: 34,
      fontFamily: FF,
      letterSpacing: -0.3,
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 16,
      color: c.textSecondary,
      lineHeight: 22,
      fontFamily: FF,
      marginBottom: 24,
    },
    card: {
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      gap: 8,
    },
    cardHeading: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 4,
      fontFamily: FF,
    },
    cardItem: { fontSize: 14, color: c.textSecondary, lineHeight: 20, fontFamily: FF },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginVertical: 6 },
    cardNever: { fontSize: 14, color: c.textSecondary, lineHeight: 20, fontFamily: FF },
    cardNeverStrong: { color: c.textPrimary, fontWeight: '700' },
    bottom: { flex: 1, justifyContent: 'flex-end', paddingBottom: 8 },
    skipBtn: { paddingVertical: 16, alignItems: 'center' },
    skipText: { fontSize: 16, fontWeight: '600', color: c.textSecondary, fontFamily: FF },
  });
