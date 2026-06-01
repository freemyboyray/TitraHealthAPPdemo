import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  View,
} from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useProfile } from '@/contexts/profile-context';
import { useUserStore } from '@/stores/user-store';
import { useLogStore } from '@/stores/log-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { TOS_VERSION } from '@/constants/legal';

const { width: SW, height: SH } = Dimensions.get('window');
const LOGO_SIZE = 80;

// ── Blob config ──────────────────────────────────────────────────────────────
// Large soft circles that drift slowly — creates a lava lamp feel.
// Using RN's built-in Animated API (not Reanimated) for stability.
const BLOB_DEFS = [
  { size: 380, x: -60, y: -90, dx: 110, dy: 80,  dur: 7000 },
  { size: 320, x:  50, y:  70, dx: 90,  dy: 120, dur: 8000 },
  { size: 420, x:  30, y: -55, dx: 80,  dy: 70,  dur: 10000 },
  { size: 280, x: -45, y:  80, dx: 100, dy: 90,  dur: 6500 },
  { size: 340, x:  10, y:  20, dx: 120, dy: 100, dur: 9000 },
] as const;

const DARK_BLOB_COLORS = [
  { color: '#FF742A', opacity: 0.30 },
  { color: '#D4A574', opacity: 0.25 },
  { color: '#C4652A', opacity: 0.22 },
  { color: '#7A4028', opacity: 0.35 },
  { color: '#E8652A', opacity: 0.20 },
];
const LIGHT_BLOB_COLORS = [
  { color: '#FF742A', opacity: 0.18 },
  { color: '#EDAB78', opacity: 0.22 },
  { color: '#DC8E5A', opacity: 0.20 },
  { color: '#C4785A', opacity: 0.22 },
  { color: '#E8652A', opacity: 0.16 },
];

// ── Animated blob component ──────────────────────────────────────────────────
function LavaBlob({
  size, startX, startY, driftX, driftY, duration, color, opacity,
}: {
  size: number; startX: number; startY: number;
  driftX: number; driftY: number; duration: number;
  color: string; opacity: number;
}) {
  const animX = useRef(new Animated.Value(0)).current;
  const animY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopX = Animated.loop(
      Animated.sequence([
        Animated.timing(animX, { toValue: driftX, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(animX, { toValue: -driftX, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    // Offset Y duration slightly so X and Y don't sync
    const loopY = Animated.loop(
      Animated.sequence([
        Animated.timing(animY, { toValue: driftY, duration: duration * 1.3, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(animY, { toValue: -driftY, duration: duration * 1.3, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loopX.start();
    loopY.start();
    return () => { loopX.stop(); loopY.stop(); };
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        left: (SW - size) / 2 + startX,
        top: (SH - size) / 2 + startY,
        transform: [{ translateX: animX }, { translateY: animY }],
      }}
    />
  );
}

export default function Index() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const blobColors = colors.isDark ? DARK_BLOB_COLORS : LIGHT_BLOB_COLORS;

  // ── Logo breathing + screen fade (simple Animated values) ──────────────────
  const logoScale = useRef(new Animated.Value(1)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const breathRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, { toValue: 1.04, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1.0,  duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    breathRef.current = breath;
    breath.start();
    return () => breath.stop();
  }, []);

  // ── Auth / routing logic (preserved exactly) ───────────────────────────────
  const { isLoading, profile } = useProfile();
  const { session, sessionLoaded, demoMode } = useUserStore();
  const { injectionLogs, weeklySummaries } = useLogStore();
  const logStoreHydrated = useLogStore((s) => s.hydrated);
  const fetchInsightsData = useLogStore((s) => s.fetchInsightsData);
  const { lastWeeklySummaryDate } = usePreferencesStore();
  const router = useRouter();
  const [targetRoute, setTargetRoute] = useState<string | null>(null);
  const exitStarted = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!sessionLoaded || !profile) setTargetRoute('/auth/welcome');
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!sessionLoaded || (!session && !demoMode)) return;
    if (isLoading || !profile) return;
    if (!logStoreHydrated) fetchInsightsData();
  }, [sessionLoaded, session, demoMode, isLoading, profile, logStoreHydrated]);

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!session && !demoMode) { setTargetRoute('/auth/welcome'); return; }
    if (isLoading || !profile) return;
    if (!profile.onboardingCompletedAt) { setTargetRoute('/onboarding'); return; }
    if (profile.tosVersion !== TOS_VERSION) { setTargetRoute('/tos-update'); return; }
    if (!logStoreHydrated) return;

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const freq = profile.injectionFrequencyDays ?? 7;

    // Don't show weekly summary until user has been on treatment for at least 7 days
    const startDate = profile.startDate ? new Date(profile.startDate + 'T12:00:00') : null;
    const nowNoon = new Date(); nowNoon.setHours(12, 0, 0, 0);
    const daysOnTreatment = startDate ? Math.floor((nowNoon.getTime() - startDate.getTime()) / 86400000) : 0;

    if (daysOnTreatment < 7) {
      setTargetRoute('/(tabs)');
      return;
    }

    const lastInjDate = injectionLogs[0]?.injection_date ?? null;
    const nextShot = lastInjDate ? new Date(new Date(lastInjDate + 'T00:00:00').getTime() + freq * 86400000) : null;
    const ns = nextShot;
    const nextShotStr = ns ? `${ns.getFullYear()}-${String(ns.getMonth() + 1).padStart(2, '0')}-${String(ns.getDate()).padStart(2, '0')}` : null;
    const inWashout = profile.pendingFirstDoseDate != null && today < profile.pendingFirstDoseDate;
    const isShotDay = !inWashout && nextShotStr === today;
    const alreadyShown = lastWeeklySummaryDate === today;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;
    const lastSummaryEnd = weeklySummaries[0]?.window_end ?? null;
    const dailyDue = !inWashout && freq < 7 && !alreadyShown && (!lastSummaryEnd || lastSummaryEnd < sevenDaysAgoStr);

    if ((freq >= 7 && isShotDay && !alreadyShown) || dailyDue) {
      setTargetRoute('/entry/weekly-summary');
    } else {
      setTargetRoute('/(tabs)');
    }
  }, [sessionLoaded, session, isLoading, profile, injectionLogs, weeklySummaries, logStoreHydrated]);

  // ── Exit animation — fade out then navigate ────────────────────────────────
  useEffect(() => {
    if (!targetRoute || exitStarted.current) return;
    exitStarted.current = true;

    breathRef.current?.stop();
    Animated.timing(logoScale, { toValue: 1, duration: 150, useNativeDriver: true }).start();

    // Navigate early (at ~70% through the fade) so the next screen is already
    // mounted by the time the overlay becomes fully transparent — no white flash.
    const fadeDuration = 500;
    setTimeout(() => {
      router.replace(targetRoute as any);
    }, fadeDuration * 0.65);

    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: fadeDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [targetRoute]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[s.container, { opacity: screenOpacity }]}>
      {/* Gradient base */}
      <LinearGradient
        colors={colors.heroGradient as unknown as string[]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* Lava lamp blobs */}
      {BLOB_DEFS.map((b, i) => (
        <LavaBlob
          key={i}
          size={b.size}
          startX={b.x}
          startY={b.y}
          driftX={b.dx}
          driftY={b.dy}
          duration={b.dur}
          color={blobColors[i].color}
          opacity={blobColors[i].opacity}
        />
      ))}

      {/* Logo — centered, breathing */}
      <Animated.Image
        source={require('@/assets/images/titra-logo.png')}
        style={[s.logo, { transform: [{ scale: logoScale }] }]}
      />
    </Animated.View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 18,
  },
});
