import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { useUiStore } from '@/stores/ui-store';

// How long the splash stays fully visible before it fades out on its own.
const HOLD_MS = 1250;

/**
 * Global "logged" confirmation. Mounted once at the root; any save flow fires
 * it via useUiStore().showLogSuccess({ title, subtitle }). A check springs in,
 * the card holds briefly, then everything fades and the store clears itself.
 * Tap anywhere to dismiss early.
 */
export function LogSuccessOverlay() {
  const data = useUiStore((s) => s.logSuccess);
  const hide = useUiStore((s) => s.hideLogSuccess);
  const { colors } = useAppTheme();

  const backdrop = useSharedValue(0);
  const cardScale = useSharedValue(0.85);
  const cardOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0);

  function runOut() {
    'worklet';
    backdrop.value = withTiming(0, { duration: 220 });
    cardScale.value = withTiming(0.92, { duration: 220 });
    cardOpacity.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) runOnJS(hide)();
    });
  }

  useEffect(() => {
    if (!data) return;

    // Reset to entrance start values, then animate in.
    backdrop.value = 0;
    cardScale.value = 0.85;
    cardOpacity.value = 0;
    checkScale.value = 0;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    backdrop.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
    cardOpacity.value = withTiming(1, { duration: 200 });
    cardScale.value = withSpring(1, { damping: 14, stiffness: 170 });
    checkScale.value = withDelay(110, withSpring(1, { damping: 10, stiffness: 190 }));

    const timer = setTimeout(() => runOut(), HOLD_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimation(backdrop);
      cancelAnimation(cardScale);
      cancelAnimation(cardOpacity);
      cancelAnimation(checkScale);
    };
  }, [data]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkScale.value,
    transform: [{ scale: checkScale.value }],
  }));

  if (!data) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, backdropStyle]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)' },
        ]}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={() => runOut()} />

      <Animated.View
        pointerEvents="none"
        style={[styles.card, cardStyle, { backgroundColor: colors.cardBg }]}
      >
        <Animated.View style={[styles.checkCircle, checkStyle, { backgroundColor: colors.orange }]}>
          <Check size={38} color="#FFFFFF" strokeWidth={3} />
        </Animated.View>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {data.title}
        </Text>
        {data.subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>
            {data.subtitle}
          </Text>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  card: {
    width: 230,
    borderRadius: 28,
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 18,
  },
  checkCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
});
