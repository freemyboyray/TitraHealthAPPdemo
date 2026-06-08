import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { requestNotificationPermission } from '@/lib/notifications';
import { useAppTheme } from '@/contexts/theme-context';
import { usePostHog } from '@/lib/posthog';
import type { AppColors } from '@/constants/theme';
import { LucideIconByName } from '@/lib/lucide-icon-map';

const FF = 'System';

// Each benefit row uses either a custom illustrated `image` (art-style) or a
// fallback lucide `icon` until its illustration is added.
const BENEFITS: { text: string; image?: number; icon?: string }[] = [
  { text: 'Dose day reminders so you never miss a shot', image: require('@/assets/images/icon-dose.png') },
  { text: 'Daily nudges to log food and water', image: require('@/assets/images/icon-nudge.png') },
  { text: 'Weekly check-in prompts to track progress', image: require('@/assets/images/icon-checkin.png') },
];

export default function RemindersScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const posthog = usePostHog();

  const handleEnable = async () => {
    await requestNotificationPermission();
    posthog?.capture('reminders_enabled');
    router.replace('/onboarding/building-plan');
  };

  const handleSkip = () => {
    posthog?.capture('reminders_skipped');
    router.replace('/onboarding/building-plan');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={15} total={16} onBack={() => router.back()} />

        <View style={s.content}>
          {/* Hero illustration */}
          <Image
            source={require('@/assets/images/reminders-hero.png')}
            style={s.hero}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />

          <Text style={s.title}>Stay on track with{'\n'}gentle reminders</Text>
          <Text style={s.subtitle}>
            We'll only send what's useful — never spam.
          </Text>

          {/* Benefit rows */}
          <View style={s.benefits}>
            {BENEFITS.map((b) => (
              <View key={b.text} style={s.benefitRow}>
                {b.image ? (
                  <View style={s.benefitCircle}>
                    <Image source={b.image} style={s.benefitImg} resizeMode="contain" />
                  </View>
                ) : (
                  <View style={s.benefitIcon}>
                    <LucideIconByName name={b.icon as any} size={20} color={colors.orange} />
                  </View>
                )}
                <Text style={s.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.bottom}>
          <ContinueButton onPress={handleEnable} label="Turn On Reminders" />
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={s.skipBtn}>
            <Text style={s.skipText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  hero: {
    width: '100%',
    height: 210,
    alignSelf: 'center',
    marginBottom: 12,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: c.textPrimary,
    textAlign: 'center',
    lineHeight: 34,
    fontFamily: FF,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: FF,
    marginBottom: 32,
  },

  benefits: {
    gap: 16,
    width: '100%',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.isDark ? 'rgba(255,116,42,0.08)' : 'rgba(255,116,42,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.isDark ? 'rgba(255,116,42,0.12)' : '#FFFFFF',
    borderWidth: 1,
    borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitImg: {
    width: 30,
    height: 30,
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    color: c.textPrimary,
    fontFamily: FF,
    lineHeight: 20,
  },

  bottom: {
    paddingBottom: 8,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  skipText: {
    fontSize: 16,
    color: c.textMuted,
    fontFamily: FF,
    fontWeight: '500',
  },
});
