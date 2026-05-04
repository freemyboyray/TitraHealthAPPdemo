import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedFire } from '@/components/animated-fire';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { useLogStore } from '@/stores/log-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
const ORANGE = '#FF742A';

// ── Milestone definitions ──
const STREAK_MILESTONES = [7, 14, 30, 60, 100, 200, 365];
const WEIGHT_MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

type Milestone = {
  type: 'streak' | 'weight' | 'treatment';
  label: string;
  value: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
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
      label: `${streak}-Day Streak`,
      value: `${streak} days in a row`,
      iconName: 'flame',
      iconColor: ORANGE,
    });
  }

  if (weightLost != null && weightLost > 0) {
    for (const m of WEIGHT_MILESTONES) {
      if (weightLost >= m && weightLost < m + (WEIGHT_MILESTONES[WEIGHT_MILESTONES.indexOf(m) + 1] ?? m + 10)) {
        milestones.push({
          type: 'weight',
          label: `${m} lbs Lost`,
          value: `${weightLost.toFixed(1)} lbs total`,
          iconName: 'trending-down',
          iconColor: '#34C759',
        });
        break;
      }
    }
  }

  if (daysOnTreatment != null) {
    const treatmentMilestones: [number, string, string][] = [
      [7, 'First Week', '1 week on treatment'],
      [30, 'One Month', '30 days on treatment'],
      [90, 'Three Months', '90 days on treatment'],
      [180, 'Six Months', '180 days on treatment'],
      [365, 'One Year', '365 days on treatment'],
    ];
    for (const [threshold, label, value] of treatmentMilestones) {
      if (daysOnTreatment === threshold) {
        milestones.push({
          type: 'treatment',
          label,
          value,
          iconName: 'medical',
          iconColor: '#5AC8FA',
        });
      }
    }
  }

  return milestones;
}

export default function DailyStreakScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile } = useProfile();
  const logStore = useLogStore();
  const { setLastDailyStreakDate, updateStreakOnOpen } = usePreferencesStore();
  const s = useMemo(() => createStyles(colors), [colors]);

  const streak = useMemo(() => updateStreakOnOpen(), []);

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
  const iconScale = useSharedValue(0.6);
  const numberOpacity = useSharedValue(0);
  const labelOpacity = useSharedValue(0);
  const milestoneOpacity = useSharedValue(0);
  const milestoneScale = useSharedValue(0.9);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setLastDailyStreakDate(today);

    iconScale.value = withSpring(1, { damping: 14, stiffness: 140 });
    numberOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    labelOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));

    if (hasMilestone) {
      milestoneOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
      milestoneScale.value = withDelay(400, withSpring(1, { damping: 14, stiffness: 130 }));
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 600);
    }

    buttonOpacity.value = withDelay(hasMilestone ? 1000 : 600, withTiming(1, { duration: 400 }));
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));
  const numberStyle = useAnimatedStyle(() => ({ opacity: numberOpacity.value }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));
  const milestoneStyle = useAnimatedStyle(() => ({
    opacity: milestoneOpacity.value,
    transform: [{ scale: milestoneScale.value }],
  }));
  const buttonStyle = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }));

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(tabs)');
  };

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.content}>
          {/* Flame icon */}
          <Animated.View style={iconStyle}>
            <View style={s.flameCircle}>
              <AnimatedFire size={56} streak={streak} active={streak > 0} />
            </View>
          </Animated.View>

          {/* Streak number */}
          <Animated.View style={numberStyle}>
            <Text style={s.streakNumber}>
              {streak === 0 ? '0' : streak}
            </Text>
          </Animated.View>

          {/* Label */}
          <Animated.View style={labelStyle}>
            <Text style={s.streakLabel}>
              {streak === 0
                ? 'Start your streak'
                : streak === 1
                  ? 'day streak'
                  : 'day streak'}
            </Text>
            <Text style={s.streakSub}>
              {streak === 0
                ? 'Log something today to begin'
                : 'Keep it going — log daily'}
            </Text>
          </Animated.View>

          {/* Milestones */}
          {hasMilestone && (
            <Animated.View style={[s.milestoneCard, milestoneStyle]}>
              {milestones.map((m, i) => (
                <View key={i} style={s.milestoneRow}>
                  <View style={[s.milestoneIcon, { backgroundColor: m.iconColor + '1A' }]}>
                    <Ionicons name={m.iconName} size={20} color={m.iconColor} />
                  </View>
                  <View style={s.milestoneText}>
                    <Text style={s.milestoneLabel}>{m.label}</Text>
                    <Text style={s.milestoneValue}>{m.value}</Text>
                  </View>
                </View>
              ))}
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
  flameCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.isDark ? 'rgba(255,116,42,0.12)' : 'rgba(255,116,42,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakNumber: {
    fontSize: 56,
    fontWeight: '900',
    color: c.textPrimary,
    fontFamily: FF,
    letterSpacing: -1,
    textAlign: 'center',
  },
  streakLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: c.textSecondary,
    fontFamily: FF,
    textAlign: 'center',
    marginTop: 2,
  },
  streakSub: {
    fontSize: 15,
    color: c.textMuted,
    fontFamily: FF,
    marginTop: 6,
    textAlign: 'center',
  },
  milestoneCard: {
    marginTop: 32,
    backgroundColor: c.isDark ? 'rgba(255,116,42,0.08)' : 'rgba(255,116,42,0.05)',
    borderRadius: 20,
    padding: 16,
    width: '100%',
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  milestoneIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneText: { flex: 1 },
  milestoneLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: c.textPrimary,
    fontFamily: FF,
    letterSpacing: -0.2,
  },
  milestoneValue: {
    fontSize: 13,
    color: c.textSecondary,
    fontFamily: FF,
    marginTop: 1,
  },
  buttonWrap: {
    paddingHorizontal: 32,
    paddingBottom: 16,
  },
  continueBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    fontFamily: FF,
  },
});
