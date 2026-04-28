import React, { useEffect, useMemo } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/contexts/theme-context';
import { GlassBorder } from '@/components/ui/glass-border';
import { CATEGORY_LABELS, type Achievement } from '@/constants/achievements';

const { width: SCREEN_W } = Dimensions.get('window');
const FF = 'System';
const ORANGE = '#FF742A';

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
      <View style={{ width: size, height: size * 1.5, borderRadius: 2, backgroundColor: color }} />
    </Animated.View>
  );
}

const CONFETTI_COUNT = 40;
function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        key: i,
        delay: Math.random() * 600,
        x: Math.random() * SCREEN_W,
      })),
    [],
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p) => (
        <ConfettiPiece key={p.key} delay={p.delay + 500} x={p.x} />
      ))}
    </View>
  );
}

type Props = {
  achievement: Achievement | null;
  onDismiss: () => void;
};

export function AchievementCongrats({ achievement, onDismiss }: Props) {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();

  // ── Animations ──
  const backdropOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const glowOpacity = useSharedValue(0.4);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  const pillOpacity = useSharedValue(0);
  const btnOpacity = useSharedValue(0);
  const btnTranslateY = useSharedValue(30);

  useEffect(() => {
    if (!achievement) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    backdropOpacity.value = withTiming(1, { duration: 200 });
    iconScale.value = withDelay(100, withSpring(1, { damping: 10, stiffness: 120 }));
    glowOpacity.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    textOpacity.value = withDelay(400, withTiming(1, { duration: 300 }));
    textTranslateY.value = withDelay(400, withTiming(0, { duration: 300 }));
    pillOpacity.value = withDelay(600, withTiming(1, { duration: 250 }));
    btnOpacity.value = withDelay(800, withTiming(1, { duration: 250 }));
    btnTranslateY.value = withDelay(800, withSpring(0, { damping: 12, stiffness: 100 }));

    return () => {
      backdropOpacity.value = 0;
      iconScale.value = 0;
      glowOpacity.value = 0.4;
      textOpacity.value = 0;
      textTranslateY.value = 20;
      pillOpacity.value = 0;
      btnOpacity.value = 0;
      btnTranslateY.value = 30;
    };
  }, [achievement]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: pillOpacity.value }));
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnTranslateY.value }],
  }));

  if (!achievement) return null;

  const categoryLabel = CATEGORY_LABELS[achievement.category];
  const categoryColor =
    achievement.category === 'streak'
      ? '#FF742A'
      : achievement.category === 'weight'
        ? '#FFD700'
        : '#5AC8FA';

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView
          intensity={40}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)' },
          ]}
        />
      </Animated.View>

      {/* Confetti */}
      <ConfettiBurst />

      {/* Content card */}
      <View style={styles.centerer}>
        <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
          <GlassBorder r={28} isDark={isDark} />

          {/* Header label */}
          <Text style={[styles.header, { color: ORANGE }]}>ACHIEVEMENT UNLOCKED</Text>

          {/* Icon with glow ring */}
          <View style={styles.iconContainer}>
            <Animated.View style={[styles.glowRing, { borderColor: categoryColor }, glowStyle]} />
            <Animated.View style={iconStyle}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                <Text style={styles.iconEmoji}>{achievement.icon}</Text>
              </View>
            </Animated.View>
          </View>

          {/* Title & description */}
          <Animated.View style={textStyle}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {achievement.name}
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {achievement.description}
            </Text>
          </Animated.View>

          {/* Category pill */}
          <Animated.View style={pillStyle}>
            <View style={[styles.pill, { backgroundColor: categoryColor + '20' }]}>
              <Text style={[styles.pillText, { color: categoryColor }]}>{categoryLabel}</Text>
            </View>
          </Animated.View>

          {/* CTA */}
          <Animated.View style={[styles.btnContainer, btnStyle]}>
            <Pressable
              style={({ pressed }) => [styles.ctaBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={onDismiss}
            >
              <Text style={styles.ctaText}>Keep Going</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onDismiss();
                router.push('/streak' as any);
              }}
              hitSlop={8}
            >
              <Text style={[styles.linkText, { color: colors.textMuted }]}>
                View All Achievements
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centerer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    overflow: 'hidden',
  },
  header: {
    fontFamily: FF,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  glowRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 56,
  },
  title: {
    fontFamily: FF,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  description: {
    fontFamily: FF,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 28,
  },
  pillText: {
    fontFamily: FF,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  btnContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },
  ctaBtn: {
    width: '100%',
    backgroundColor: ORANGE,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: FF,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  linkText: {
    fontFamily: FF,
    fontSize: 14,
    fontWeight: '600',
  },
});
