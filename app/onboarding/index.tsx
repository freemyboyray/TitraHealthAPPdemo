import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
const ORANGE = '#FF742A';

const STATS = [
  { number: '60+', label: 'Studies' },
  { number: '9', label: 'Trials' },
  { number: '10+', label: 'Brands' },
];

export default function ResearchScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={1} total={17} />

        <View style={s.center}>
          {/* Hero text */}
          <Text style={s.title}>
            Backed by science.{'\n'}
            <Text style={s.titleAccent}>Built for you.</Text>
          </Text>

          {/* Stats */}
          <View style={s.statsCard}>
            {STATS.map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.statItem}>
                  <Text style={s.statNumber}>{stat.number}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Descriptor */}
          <Text style={s.body}>
            Every recommendation is grounded in{' '}
            <Text style={s.bodyBold}>peer-reviewed research</Text>,{' '}
            <Text style={s.bodyBold}>FDA-approved pharmacokinetics</Text>, and data from major clinical trials.
          </Text>

          {/* Trial names */}
          <View style={s.trialRow}>
            {['SURMOUNT', 'STEP', 'SELECT'].map((t, i) => (
              <React.Fragment key={t}>
                {i > 0 && <Text style={s.trialDot}>·</Text>}
                <Text style={s.trialName}>{t}</Text>
              </React.Fragment>
            ))}
          </View>
        </View>

        <ContinueButton
          onPress={() => router.push('/onboarding/journey')}
          label="Get Started"
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24 },

  center: {
    flex: 1,
    justifyContent: 'center',
  },

  title: {
    fontSize: 34,
    fontWeight: '800',
    color: c.textPrimary,
    lineHeight: 41,
    fontFamily: FF,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 40,
  },
  titleAccent: {
    color: ORANGE,
  },

  // Stats card
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 24,
    marginBottom: 32,
    ...(c.isDark
      ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }
      : {
          shadowColor: 'rgba(0,0,0,0.06)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 16,
          elevation: 2,
        }),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: c.textPrimary,
    fontFamily: FF,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: c.textSecondary,
    fontFamily: FF,
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  },

  // Body
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: c.textSecondary,
    lineHeight: 24,
    fontFamily: FF,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  bodyBold: {
    fontWeight: '600',
    color: c.textPrimary,
  },

  // Trial names
  trialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  trialName: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textMuted,
    letterSpacing: 2,
    fontFamily: FF,
  },
  trialDot: {
    fontSize: 14,
    color: c.textMuted,
  },
});
