import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation, type AppColors } from '@/constants/theme';

const FF = 'System';

/**
 * The personalized AI overview at the top of the Side Effect Insights screen.
 * Renders nothing until there's something to show (so the screen doesn't reserve
 * dead space for users without AI consent / data). Shows a shimmer while the
 * batched insight is generating.
 */
export function SideEffectAiCard({ text, loading }: { text: string; loading: boolean }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  if (!text && !loading) return null;

  return (
    <View style={s.card}>
      <View style={s.flourish} />
      <Text style={s.eyebrow}>Your patterns this cycle</Text>
      {text ? (
        <Text style={s.body}>{text}</Text>
      ) : (
        <ShimmerLines colors={colors} />
      )}
    </View>
  );
}

function ShimmerLines({ colors }: { colors: AppColors }) {
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const v = useSharedValue(0.4);
  useEffect(() => {
    v.value = withRepeat(withTiming(0.85, { duration: 850, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      {['96%', '88%', '64%'].map((width, i) => (
        <Reanimated.View key={i} style={[{ width: width as any, height: 11, borderRadius: 6, backgroundColor: w(0.1) }, style]} />
      ))}
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    card: {
      borderRadius: 24,
      backgroundColor: c.surface,
      padding: 18,
      overflow: 'hidden',
      ...cardElevation(c.isDark),
    },
    flourish: {
      position: 'absolute',
      right: -40, top: -40,
      width: 140, height: 140, borderRadius: 70,
      backgroundColor: c.orange,
      opacity: c.isDark ? 0.1 : 0.06,
    },
    eyebrow: { fontSize: 14, fontWeight: '700', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.2 },
    body: { fontSize: 15, color: w(0.72), lineHeight: 22, marginTop: 10, fontFamily: FF },
  });
};
