import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useProfile } from '@/contexts/profile-context';
import { useUserStore } from '@/stores/user-store';
import { useLogStore } from '@/stores/log-store';
import { usePreferencesStore } from '@/stores/preferences-store';

export default function Index() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { isLoading, profile } = useProfile();
  const { session, sessionLoaded, demoMode } = useUserStore();
  const { injectionLogs } = useLogStore();
  const { lastWeeklySummaryDate } = usePreferencesStore();
  const router = useRouter();

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!session && !demoMode) {
      router.replace('/auth/sign-in');
      return;
    }
    if (isLoading) return;
    if (!profile) {
      router.replace('/onboarding');
      return;
    }

    // Shot-day gate: show weekly summary once per calendar day on injection day
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const freq = profile.injectionFrequencyDays ?? 7;
    const lastInjDate = injectionLogs[0]?.injection_date ?? null;
    const nextShot = lastInjDate ? new Date(new Date(lastInjDate + 'T00:00:00').getTime() + freq * 86400000) : null;
    const ns = nextShot;
    const nextShotStr = ns ? `${ns.getFullYear()}-${String(ns.getMonth() + 1).padStart(2, '0')}-${String(ns.getDate()).padStart(2, '0')}` : null;
    const isShotDay = nextShotStr === today;
    const alreadyShown = lastWeeklySummaryDate === today;

    if (freq >= 7 && isShotDay && !alreadyShown) {
      router.replace('/entry/weekly-summary');
    } else {
      router.replace('/(tabs)');
    }
  }, [sessionLoaded, session, isLoading, profile, injectionLogs]);

  return (
    <View style={s.container}>
      <Text style={s.wordmark}>titra</Text>
      <Text style={s.tagline}>GLP-1 Companion</Text>
      {isLoading && <ActivityIndicator style={s.spinner} color="#FF742A" />}
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 48,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 15,
    color: c.textSecondary,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  spinner: {
    marginTop: 40,
  },
});
