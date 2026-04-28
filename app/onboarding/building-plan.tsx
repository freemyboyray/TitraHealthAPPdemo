import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const ORANGE = '#FF742A';

const STEPS = [
  { label: 'Analyzing your profile', icon: 'person-outline' as const },
  { label: 'Setting nutrition targets', icon: 'nutrition-outline' as const },
  { label: 'Calibrating activity goals', icon: 'fitness-outline' as const },
  { label: 'Finalizing your plan', icon: 'checkmark-circle-outline' as const },
];

export default function BuildingPlanScreen() {
  const router = useRouter();
  const { completeOnboarding } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [currentStep, setCurrentStep] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Spinning animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Step progression + actual save
  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Step through the visual steps
      for (let i = 0; i < STEPS.length; i++) {
        if (cancelled) return;
        setCurrentStep(i);
        Animated.timing(progress, {
          toValue: (i + 1) / STEPS.length,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();

        if (i === STEPS.length - 1) {
          // Last step — actually save
          try {
            await completeOnboarding();
          } catch (e) {
            console.warn('completeOnboarding failed:', e);
          }
        } else {
          // Visual delay for earlier steps
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      // Brief pause to show completion
      await new Promise((r) => setTimeout(r, 600));
      if (!cancelled) router.replace('/(tabs)');
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
      <View style={s.container}>
        <View style={s.center}>
          {/* Spinning loader */}
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="sync-outline" size={48} color={ORANGE} />
          </Animated.View>

          <Text style={s.title}>Building your plan</Text>
          <Text style={s.subtitle}>
            Personalizing everything based on your goals
          </Text>

          {/* Progress bar */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth }]} />
          </View>

          {/* Step list */}
          <View style={s.steps}>
            {STEPS.map((step, i) => {
              const done = i < currentStep;
              const active = i === currentStep;
              return (
                <View key={i} style={s.stepRow}>
                  <Ionicons
                    name={done ? 'checkmark-circle' : step.icon}
                    size={20}
                    color={done ? ORANGE : active ? colors.textPrimary : colors.textMuted}
                  />
                  <Text
                    style={[
                      s.stepLabel,
                      done && s.stepDone,
                      active && s.stepActive,
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
    center: { alignItems: 'center' },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: 'System',
      marginTop: 24,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 17,
      color: c.textSecondary,
      fontFamily: 'System',
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 21,
    },
    progressTrack: {
      width: '100%',
      height: 6,
      borderRadius: 3,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      overflow: 'hidden',
      marginBottom: 32,
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: ORANGE,
    },
    steps: { width: '100%', gap: 16 },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    stepLabel: {
      fontSize: 17,
      fontFamily: 'System',
      color: c.textMuted,
    },
    stepDone: { color: c.textSecondary },
    stepActive: { color: c.textPrimary, fontWeight: '600' },
  });
