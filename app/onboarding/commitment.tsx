import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, Image, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { usePostHog } from '@/lib/posthog';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
const HOLD_MS = 1600;
const LOGO_SIZE = 96;
const CIRCLE_BASE = 160;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// Scale needed for the base circle to fully cover the screen from its center.
const MAX_RADIUS = Math.hypot(SCREEN_W / 2, SCREEN_H / 2);
const FULL_SCREEN_SCALE = ((MAX_RADIUS * 2) / CIRCLE_BASE) * 1.1;

export default function CommitmentScreen() {
  const router = useRouter();
  const { profile, draft } = useProfile();
  const { colors } = useAppTheme();
  const posthog = usePostHog();
  const s = useMemo(() => createStyles(colors), [colors]);

  const name = (profile?.username || draft.username || '').trim();
  // Users not yet on a GLP-1 shouldn't pledge consistency "with my treatment".
  const isActive = draft.glp1Status === 'active';
  const pledgeTail = isActive
    ? 'will show up for myself — staying consistent with my treatment and building habits that last.'
    : 'will show up for myself — staying consistent and committed to building habits that last.';

  const [committed, setCommitted] = useState(false);
  const committedRef = useRef(false);
  const navigatedRef = useRef(false);

  const fillProgress = useSharedValue(0);
  const welcomeOpacity = useSharedValue(0);

  // ─── Haptics ────────────────────────────────────────────────────────────────
  const impactAt = (t: number) => {
    const style =
      t >= 0.75
        ? Haptics.ImpactFeedbackStyle.Heavy
        : t >= 0.5
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
    Haptics.impactAsync(style);
  };

  // Escalating haptics as the hold progresses past each threshold.
  useAnimatedReaction(
    () => fillProgress.value,
    (cur, prev) => {
      if (prev === null) return;
      for (const t of [0.25, 0.5, 0.75]) {
        if (prev < t && cur >= t) runOnJS(impactAt)(t);
      }
    },
  );

  // ─── Commit / release ─────────────────────────────────────────────────────────
  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    setCommitted(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    posthog?.capture('onboarding_commitment');
    fillProgress.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
    welcomeOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    setTimeout(() => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      router.replace('/upgrade?from=onboarding');
    }, 1300);
  };

  const startHold = () => {
    if (committedRef.current) return;
    fillProgress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });
  };

  const releaseHold = () => {
    if (committedRef.current) return;
    fillProgress.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) });
  };

  const hold = Gesture.LongPress()
    .minDuration(HOLD_MS)
    .maxDistance(60)
    .onBegin(() => runOnJS(startHold)())
    .onStart(() => runOnJS(commit)())
    .onFinalize(() => runOnJS(releaseHold)());

  // ─── Animated styles ──────────────────────────────────────────────────────────
  const circleStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(fillProgress.value, [0, 1], [1, FULL_SCREEN_SCALE]) },
    ],
  }));

  const welcomeStyle = useAnimatedStyle(() => ({ opacity: welcomeOpacity.value }));

  const pledgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fillProgress.value, [0, 0.4], [1, 0]),
  }));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style={committed ? 'light' : colors.isDark ? 'light' : 'dark'} />

      {/* Pledge (top) — fades out as the circle grows */}
      <Animated.View style={[s.pledgeWrap, pledgeStyle]} pointerEvents="none">
        <Text style={s.pledge}>
          {name ? (
            <>
              I, <Text style={s.pledgeName}>{name}</Text>, {pledgeTail}
            </>
          ) : (
            <>I {pledgeTail}</>
          )}
        </Text>
      </Animated.View>

      {/* Center — growing circle + logo */}
      <View style={s.center} pointerEvents="box-none">
        <GestureDetector gesture={hold}>
          <View
            style={s.logoTouch}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Commit"
            accessibilityHint="Press and hold the logo to commit"
          >
            {/* Growing orange circle (behind the logo) */}
            <Animated.View style={[s.circle, { backgroundColor: colors.orange }, circleStyle]} />
            {/* Logo stays on top throughout */}
            <Image source={require('@/assets/images/titra-logo.png')} style={s.logo} />
          </View>
        </GestureDetector>

        {/* Hint — fades out with the pledge */}
        <Animated.View style={pledgeStyle} pointerEvents="none">
          <Text style={s.hint}>Tap and hold the{'\n'}logo to commit</Text>
        </Animated.View>
      </View>

      {/* Reveal text */}
      <Animated.View style={[s.welcomeWrap, welcomeStyle]} pointerEvents="none">
        <Text style={s.welcome}>Welcome to Titra!</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },

    pledgeWrap: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingTop: 96,
      paddingHorizontal: 36,
      zIndex: 1,
    },
    pledge: {
      fontSize: 26,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: FF,
      textAlign: 'center',
      lineHeight: 34,
      letterSpacing: -0.3,
    },
    pledgeName: {
      color: c.orange,
      fontWeight: '800',
    },

    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoTouch: {
      width: CIRCLE_BASE,
      height: CIRCLE_BASE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circle: {
      position: 'absolute',
      width: CIRCLE_BASE,
      height: CIRCLE_BASE,
      borderRadius: CIRCLE_BASE / 2,
    },
    logo: {
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      borderRadius: 18,
    },
    hint: {
      marginTop: 56,
      fontSize: 16,
      fontWeight: '700',
      color: c.orange,
      fontFamily: FF,
      textAlign: 'center',
      lineHeight: 22,
      letterSpacing: 0.1,
    },

    welcomeWrap: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    welcome: {
      fontSize: 32,
      fontWeight: '800',
      color: '#FFFFFF',
      fontFamily: FF,
      textAlign: 'center',
      letterSpacing: -0.5,
      marginTop: 220,
    },
  });
