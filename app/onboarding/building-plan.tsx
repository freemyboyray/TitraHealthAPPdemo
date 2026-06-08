import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { usePreferencesStore } from '@/stores/preferences-store';
import { usePostHog } from '@/lib/posthog';
import type { AppColors } from '@/constants/theme';

const FF = 'System';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Circular progress ring geometry.
const RING = 150;
const STROKE = 12;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

// Each frame: rotating illustration + headline (accent word in orange). Frames
// advance with the build steps; the ring fills 0 → 100% across them.
const STEPS = [
  { image: require('@/assets/images/plan-1.png'), pre: 'Analyzing your ',    accent: 'profile',   post: '' },
  { image: require('@/assets/images/plan-2.png'), pre: 'Setting your ',      accent: 'nutrition', post: ' targets' },
  { image: require('@/assets/images/plan-3.png'), pre: 'Calibrating your ',  accent: 'activity',  post: ' goals' },
  { image: require('@/assets/images/plan-4.png'), pre: 'Finalizing your ',   accent: 'plan',      post: '' },
];

export default function BuildingPlanScreen() {
  const router = useRouter();
  const { completeOnboarding } = useProfile();
  const { initStreak } = usePreferencesStore();
  const { colors } = useAppTheme();
  const posthog = usePostHog();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [currentStep, setCurrentStep] = useState(0);
  const [percent, setPercent] = useState(0);

  const progress = useSharedValue(0);
  const fade = useSharedValue(0);

  // Mirror the animated progress into a JS % counter for the center label.
  useAnimatedReaction(
    () => Math.round(progress.value * 100),
    (v, prev) => {
      if (v !== prev) runOnJS(setPercent)(v);
    },
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      for (let i = 0; i < STEPS.length; i++) {
        if (cancelled) return;
        setCurrentStep(i);

        // Fade the frame in.
        fade.value = 0;
        fade.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });

        // Advance the ring to this step's fraction.
        progress.value = withTiming((i + 1) / STEPS.length, {
          duration: 800,
          easing: Easing.out(Easing.cubic),
        });

        if (i === STEPS.length - 1) {
          try {
            await completeOnboarding();
            initStreak();
            posthog?.capture('onboarding_completed');
          } catch {
            // Continue even if save fails — data is in the draft.
          }
        }

        await new Promise((r) => setTimeout(r, 1100));
      }

      await new Promise((r) => setTimeout(r, 400));
      if (!cancelled) router.replace('/onboarding/commitment');
    }

    run();
    return () => { cancelled = true; };
  }, []);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value),
  }));

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const step = STEPS[currentStep];
  const trackColor = colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        {/* Rotating hero + headline */}
        <Animated.View style={[s.heroWrap, fadeStyle]}>
          <Image source={step.image} style={s.hero} resizeMode="contain" accessibilityIgnoresInvertColors />
          <Text style={s.headline}>
            {step.pre}
            <Text style={s.accent}>{step.accent}</Text>
            {step.post}
          </Text>
        </Animated.View>

        {/* Progress ring */}
        <View style={s.ringWrap}>
          <Svg width={RING} height={RING}>
            <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={trackColor} strokeWidth={STROKE} fill="none" />
            <AnimatedCircle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={colors.orange}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              animatedProps={ringProps}
              rotation="-90"
              origin={`${RING / 2}, ${RING / 2}`}
            />
          </Svg>
          <View style={s.ringCenter} pointerEvents="none">
            <Text style={s.percent}>{percent}%</Text>
          </View>
        </View>

        <Text style={s.subline}>Personalizing your plan…</Text>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: {
      flex: 1,
      paddingHorizontal: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },

    heroWrap: {
      alignItems: 'center',
      marginBottom: 44,
    },
    hero: {
      width: 200,
      height: 200,
      marginBottom: 20,
    },
    headline: {
      fontSize: 26,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      textAlign: 'center',
      letterSpacing: -0.4,
      lineHeight: 32,
    },
    accent: {
      color: c.orange,
    },

    ringWrap: {
      width: RING,
      height: RING,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringCenter: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    percent: {
      fontSize: 34,
      fontWeight: '800',
      color: c.orange,
      fontFamily: FF,
      letterSpacing: -1,
    },

    subline: {
      fontSize: 15,
      fontWeight: '500',
      color: c.textSecondary,
      fontFamily: FF,
      marginTop: 28,
      letterSpacing: 0.1,
    },
  });
