import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View, Image } from 'react-native';

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

  // Logo starts fully opaque at full scale so the JS layer is visually
  // identical to the native iOS launch storyboard — no fade flash.
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const spinnerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(spinnerOpacity, { toValue: 1, duration: 400, delay: 400, useNativeDriver: true }).start();
  }, []);

  const { isLoading, profile } = useProfile();
  const { session, sessionLoaded, demoMode } = useUserStore();
  const { injectionLogs, weeklySummaries } = useLogStore();
  const logStoreHydrated = useLogStore((s) => s.hydrated);
  const fetchInsightsData = useLogStore((s) => s.fetchInsightsData);
  const { lastWeeklySummaryDate } = usePreferencesStore();
  const router = useRouter();

  // Safety timeout: if nothing resolves within 10s, go to sign-in
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!sessionLoaded || !profile) {
        router.replace('/auth/welcome');
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

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
      router.replace('/auth/welcome');
      return;
    }
    if (isLoading || !profile) return;
    if (!profile.onboardingCompletedAt) {
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

    // Weekly summary gate.
    // - Weekly+ users (freq >= 7): trigger on shot day, once per calendar day.
    // - Daily users (freq < 7): rolling 7-day cadence keyed off the most recent
    //   persisted snapshot (or first eligible open if none exists).
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

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;
    const lastSummaryEnd = weeklySummaries[0]?.window_end ?? null;
    const dailyDue = !inWashout
      && freq < 7
      && !alreadyShown
      && (!lastSummaryEnd || lastSummaryEnd < sevenDaysAgoStr);

    if ((freq >= 7 && isShotDay && !alreadyShown) || dailyDue) {
      router.replace('/entry/weekly-summary');
    } else {
      router.replace('/(tabs)');
    }
  }, [sessionLoaded, session, isLoading, profile, injectionLogs, weeklySummaries, logStoreHydrated]);

  return (
    <View style={s.container}>
      <Animated.View style={[s.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Image source={require('@/assets/images/titra-logo.png')} style={s.logo} />
      </Animated.View>
      <Animated.View style={[s.spinnerWrap, { opacity: spinnerOpacity }]}>
        <ActivityIndicator size="small" color={colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'} />
      </Animated.View>
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
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: 'hidden',
  },
  logo: {
    width: 80,
    height: 80,
  },
  spinnerWrap: {
    position: 'absolute',
    bottom: 120,
  },
});
