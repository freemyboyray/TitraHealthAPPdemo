import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { useLogStore, computeStreak } from '@/stores/log-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { AnimatedFire } from '@/components/animated-fire';
import type { AppColors } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const FF = 'System';
const ORANGE = '#FF742A';

// ── Milestone definitions ──
const STREAK_MILESTONES = [7, 14, 30, 60, 100, 200, 365];
const WEIGHT_MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

type Milestone = {
  type: 'streak' | 'weight' | 'treatment';
  label: string;
  value: string;
};

function detectMilestones(
  streak: number,
  weightLost: number | null,
  daysOnTreatment: number | null,
): Milestone[] {
  const milestones: Milestone[] = [];

  if (STREAK_MILESTONES.includes(streak)) {
    milestones.push({
      type: 'streak',
      label: `${streak}-Day Streak!`,
      value: `You've logged ${streak} days in a row`,
    });
  }

  if (weightLost != null && weightLost > 0) {
    for (const m of WEIGHT_MILESTONES) {
      if (weightLost >= m && weightLost < m + (WEIGHT_MILESTONES[WEIGHT_MILESTONES.indexOf(m) + 1] ?? m + 10)) {
        milestones.push({
          type: 'weight',
          label: `${m} lbs Lost!`,
          value: `You've lost ${weightLost.toFixed(1)} lbs total`,
        });
        break;
      }
    }
  }

  if (daysOnTreatment != null) {
    if (daysOnTreatment === 7) milestones.push({ type: 'treatment', label: 'First Week!', value: '1 week on treatment' });
    else if (daysOnTreatment === 30) milestones.push({ type: 'treatment', label: 'One Month!', value: '30 days on treatment' });
    else if (daysOnTreatment === 90) milestones.push({ type: 'treatment', label: 'Three Months!', value: '90 days on treatment' });
    else if (daysOnTreatment === 180) milestones.push({ type: 'treatment', label: 'Six Months!', value: '180 days on treatment' });
    else if (daysOnTreatment === 365) milestones.push({ type: 'treatment', label: 'One Year!', value: '365 days on treatment' });
  }

  return milestones;
}

// ── Confetti particle ──
function ConfettiPiece({ delay, x }: { delay: number; x: number }) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(x);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(delay, withTiming(SCREEN_W * 1.5, { duration: 2500, easing: Easing.in(Easing.quad) }));
    translateX.value = withDelay(delay, withTiming(x + (Math.random() - 0.5) * 120, { duration: 2500 }));
    rotate.value = withDelay(delay, withTiming(360 * (Math.random() > 0.5 ? 1 : -1), { duration: 2500 }));
    opacity.value = withDelay(delay + 1800, withTiming(0, { duration: 700 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: 0,
    left: translateX.value,
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const colors = ['#FF742A', '#FFD700', '#FF4500', '#27AE60', '#5AC8FA', '#FF69B4', '#FF8C00'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = 6 + Math.random() * 6;

  return (
    <Animated.View style={style}>
      <View style={{
        width: size,
        height: size * 1.5,
        borderRadius: 2,
        backgroundColor: color,
      }} />
    </Animated.View>
  );
}

export default function DailyStreakScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile } = useProfile();
  const logStore = useLogStore();
  const { setLastDailyStreakDate } = usePreferencesStore();
  const s = useMemo(() => createStyles(colors), [colors]);

  const streak = useMemo(() => computeStreak(logStore), [
    logStore.weightLogs, logStore.injectionLogs, logStore.foodLogs,
    logStore.activityLogs, logStore.sideEffectLogs, logStore.foodNoiseLogs,
  ]);

  const weightLost = useMemo(() => {
    const startWeight = profile?.startWeightLbs ?? 0;
    const latestLog = logStore.weightLogs[0];
    const currentWeight = latestLog?.weight_lbs ?? profile?.currentWeightLbs ?? 0;
    if (startWeight > 0 && currentWeight > 0) return startWeight - currentWeight;
    return null;
  }, [profile, logStore.weightLogs]);

  const daysOnTreatment = useMemo(() => {
    if (!profile?.startDate) return null;
    const start = new Date(profile.startDate + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.floor((now.getTime() - start.getTime()) / 86400000);
  }, [profile?.startDate]);

  const milestones = useMemo(
    () => detectMilestones(streak, weightLost, daysOnTreatment),
    [streak, weightLost, daysOnTreatment],
  );

  const hasMilestone = milestones.length > 0;

  // ── Animations ──
  const [showConfetti, setShowConfetti] = useState(false);
  const [displayStreak, setDisplayStreak] = useState(0);
  const fireScale = useSharedValue(0.5);
  const fireOpacity = useSharedValue(0);
  const milestoneOpacity = useSharedValue(0);
  const milestoneScale = useSharedValue(0.8);
  const buttonOpacity = useSharedValue(0);

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  useEffect(() => {
    // Mark today as shown
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setLastDailyStreakDate(today);

    // Fire entrance
    fireOpacity.value = withTiming(1, { duration: 400 });
    fireScale.value = withSpring(1, { damping: 12, stiffness: 100 });

    // Count up the streak number
    const countDuration = Math.min(streak * 80, 1500);
    const stepTime = streak > 0 ? countDuration / streak : 0;
    let count = 0;
    if (streak > 0) {
      const interval = setInterval(() => {
        count++;
        setDisplayStreak(count);
        if (count >= streak) {
          clearInterval(interval);
          if (hasMilestone) {
            milestoneOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
            milestoneScale.value = withDelay(300, withSpring(1, { damping: 10, stiffness: 120 }));
            setTimeout(() => runOnJS(triggerConfetti)(), 400);
          }
        }
      }, stepTime);
      return () => clearInterval(interval);
    }

    buttonOpacity.value = withDelay(hasMilestone ? 2000 : 1000, withTiming(1, { duration: 500 }));
  }, []);

  useEffect(() => {
    buttonOpacity.value = withDelay(hasMilestone ? 2500 : 1200, withTiming(1, { duration: 500 }));
  }, []);

  const fireStyle = useAnimatedStyle(() => ({
    opacity: fireOpacity.value,
    transform: [{ scale: fireScale.value }],
  }));

  const milestoneStyle = useAnimatedStyle(() => ({
    opacity: milestoneOpacity.value,
    transform: [{ scale: milestoneScale.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(tabs)');
  };

  const confettiPieces = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      delay: Math.random() * 600,
      x: Math.random() * SCREEN_W,
    }));
  }, []);

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {showConfetti && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {confettiPieces.map(p => (
              <ConfettiPiece key={p.id} delay={p.delay} x={p.x} />
            ))}
          </View>
        )}

        <View style={s.content}>
          <Animated.View style={[s.fireWrap, fireStyle]}>
            <AnimatedFire
              size={180}
              streak={displayStreak}
              showNumber
              active={streak > 0}
            />
          </Animated.View>

          <Text style={s.streakLabel}>
            {streak === 0
              ? 'Start your streak!'
              : streak === 1
                ? '1 day streak'
                : `${streak} day streak`}
          </Text>
          <Text style={s.streakSub}>
            {streak === 0
              ? 'Log something today to begin'
              : 'Keep it going — log daily!'}
          </Text>

          {hasMilestone && (
            <Animated.View style={[s.milestoneCard, milestoneStyle]}>
              {milestones.map((m, i) => (
                <View key={i} style={s.milestoneRow}>
                  <Text style={s.milestoneEmoji}>
                    {m.type === 'streak' ? '\uD83D\uDD25' : m.type === 'weight' ? '\uD83C\uDFC6' : '\uD83D\uDC8A'}
                  </Text>
                  <View style={s.milestoneText}>
                    <Text style={s.milestoneLabel}>{m.label}</Text>
                    <Text style={s.milestoneValue}>{m.value}</Text>
                  </View>
                </View>
              ))}
            </Animated.View>
          )}

          {milestones.some(m => m.type === 'weight') && (
            <Animated.View style={[s.photoPromptCard, milestoneStyle]}>
              <Ionicons name="camera-outline" size={22} color={ORANGE} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.photoPromptTitle}>Capture your progress</Text>
                <Text style={s.photoPromptSub}>Take a photo to see your transformation</Text>
              </View>
              <Pressable
                style={s.photoPromptBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const weightMilestone = milestones.find(m => m.type === 'weight');
                  const milestoneLbs = weightMilestone ? parseInt(weightMilestone.label) || 0 : 0;
                  router.push({ pathname: '/progress-photos/capture', params: { milestone: String(milestoneLbs) } } as any);
                }}
              >
                <Text style={s.photoPromptBtnText}>Photo</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>

        <Animated.View style={[s.buttonWrap, buttonStyle]}>
          <Pressable style={s.continueBtn} onPress={handleContinue}>
            <Text style={s.continueBtnText}>Continue</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  safe: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  fireWrap: { marginBottom: 8 },
  streakLabel: {
    fontSize: 28, fontWeight: '900', color: c.textPrimary,
    letterSpacing: -0.5, fontFamily: FF, marginTop: 8,
  },
  streakSub: {
    fontSize: 16, color: c.textSecondary, fontFamily: FF,
    marginTop: 6, textAlign: 'center',
  },
  milestoneCard: {
    marginTop: 32,
    backgroundColor: c.isDark ? 'rgba(255,116,42,0.10)' : 'rgba(255,116,42,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.isDark ? 'rgba(255,116,42,0.25)' : 'rgba(255,116,42,0.15)',
    padding: 20,
    width: '100%',
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 6,
  },
  milestoneEmoji: { fontSize: 28 },
  milestoneText: { flex: 1 },
  milestoneLabel: {
    fontSize: 20, fontWeight: '800', color: ORANGE,
    fontFamily: FF, letterSpacing: -0.3,
  },
  milestoneValue: {
    fontSize: 14, color: c.textSecondary, fontFamily: FF, marginTop: 2,
  },
  photoPromptCard: {
    marginTop: 16,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    padding: 16,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoPromptTitle: {
    fontSize: 15, fontWeight: '700', color: c.textPrimary,
    fontFamily: FF,
  },
  photoPromptSub: {
    fontSize: 13, color: c.textSecondary, fontFamily: FF, marginTop: 2,
  },
  photoPromptBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 8,
    marginLeft: 8,
  },
  photoPromptBtnText: {
    fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: FF,
  },
  buttonWrap: {
    paddingHorizontal: 32,
    paddingBottom: 16,
  },
  continueBtn: {
    backgroundColor: ORANGE,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnText: {
    fontSize: 17, fontWeight: '700', color: '#FFF', fontFamily: FF,
  },
});
