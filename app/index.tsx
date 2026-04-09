import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useProfile } from '@/contexts/profile-context';
import { useUserStore } from '@/stores/user-store';
import { useLogStore } from '@/stores/log-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { TOS_VERSION } from '@/constants/legal';

export default function Index() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { isLoading, profile } = useProfile();
  const { session, sessionLoaded, demoMode } = useUserStore();
  const { injectionLogs } = useLogStore();
  const logStoreHydrated = useLogStore((s) => s.hydrated);
  const fetchInsightsData = useLogStore((s) => s.fetchInsightsData);
  const { lastWeeklySummaryDate } = usePreferencesStore();
  const router = useRouter();

  // Kick off data fetch as soon as we have a valid session + profile
  useEffect(() => {
    if (!sessionLoaded || (!session && !demoMode)) return;
    if (isLoading || !profile) return;
    if (!logStoreHydrated) {
      fetchInsightsData();
    }
  }, [sessionLoaded, session, demoMode, isLoading, profile, logStoreHydrated]);

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

    // TOS version gate: require acceptance of current TOS version
    if (profile.tosVersion !== TOS_VERSION) {
      router.replace('/tos-update' as any);
      return;
    }

    // Wait for log store to finish loading so the home screen renders
    // with real data immediately — no flash of stale state
    if (!logStoreHydrated) return;

    // Shot-day gate: show weekly summary once per calendar day on injection day
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const freq = profile.injectionFrequencyDays ?? 7;
    const lastInjDate = injectionLogs[0]?.injection_date ?? null;
    const nextShot = lastInjDate ? new Date(new Date(lastInjDate + 'T00:00:00').getTime() + freq * 86400000) : null;
    const ns = nextShot;
    const nextShotStr = ns ? `${ns.getFullYear()}-${String(ns.getMonth() + 1).padStart(2, '0')}-${String(ns.getDate()).padStart(2, '0')}` : null;
    // During washout (pending transition with future start date), no active cycle
    const inWashout = profile.pendingFirstDoseDate != null && today < profile.pendingFirstDoseDate;
    const isShotDay = !inWashout && nextShotStr === today;
    const alreadyShown = lastWeeklySummaryDate === today;

    if (freq >= 7 && isShotDay && !alreadyShown) {
      router.replace('/entry/weekly-summary');
    } else {
      router.replace('/(tabs)');
    }
  }, [sessionLoaded, session, isLoading, profile, injectionLogs, logStoreHydrated]);

  return (
    <View style={s.container}>
      <Text style={s.wordmark}>Titra Health</Text>
      <Text style={s.tagline}>Personalized GLP-1 Management</Text>
      <ActivityIndicator style={s.spinner} color="#FF742A" />
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
