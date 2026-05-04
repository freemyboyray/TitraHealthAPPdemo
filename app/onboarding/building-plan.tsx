import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { usePreferencesStore } from '@/stores/preferences-store';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
const ORANGE = '#FF742A';

const STEPS = [
  'Analyzing your profile',
  'Setting nutrition targets',
  'Calibrating activity goals',
  'Finalizing your plan',
];

export default function BuildingPlanScreen() {
  const router = useRouter();
  const { completeOnboarding } = useProfile();
  const { initStreak } = usePreferencesStore();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [currentStep, setCurrentStep] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      for (let i = 0; i < STEPS.length; i++) {
        if (cancelled) return;
        setCurrentStep(i);
        Animated.timing(progress, {
          toValue: (i + 1) / STEPS.length,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();

        if (i === STEPS.length - 1) {
          try {
            await completeOnboarding();
            initStreak();
          } catch (e) {
            // Continue to home even if save fails — data is in draft
          }
        } else {
          await new Promise((r) => setTimeout(r, 900));
        }
      }

      await new Promise((r) => setTimeout(r, 700));
      if (!cancelled) router.replace('/onboarding/upgrade');
    }

    run();
    return () => { cancelled = true; };
  }, []);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={s.safe}>
      <Animated.View style={[s.container, { opacity: fadeIn }]}>
        <View style={s.top} />

        <View style={s.center}>
          {/* Current step label */}
          <Text style={s.stepLabel}>{STEPS[currentStep]}</Text>

          {/* Progress bar */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth }]} />
          </View>

          {/* Step indicators */}
          <View style={s.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  i <= currentStep && s.dotActive,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={s.bottom}>
          <Text style={s.title}>Building your plan</Text>
          <Text style={s.subtitle}>
            Personalizing your experience based on your goals, medication, and lifestyle.
          </Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, paddingHorizontal: 32 },

    top: { flex: 1 },

    center: {
      alignItems: 'center',
    },
    stepLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: c.textSecondary,
      fontFamily: FF,
      marginBottom: 20,
      letterSpacing: 0.1,
    },
    progressTrack: {
      width: '100%',
      height: 4,
      borderRadius: 2,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      overflow: 'hidden',
      marginBottom: 16,
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: ORANGE,
    },
    dots: {
      flexDirection: 'row',
      gap: 8,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    },
    dotActive: {
      backgroundColor: ORANGE,
    },

    bottom: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      letterSpacing: -0.5,
      textAlign: 'center',
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '400',
      color: c.textSecondary,
      fontFamily: FF,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 12,
    },
  });
