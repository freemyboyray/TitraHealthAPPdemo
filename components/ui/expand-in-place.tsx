import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useWindowDimensions } from 'react-native';
import Reanimated, {
  Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming, runOnJS,
} from 'react-native-reanimated';

import { useAppTheme } from '@/contexts/theme-context';

/**
 * Tap a card → measure its rect → morph it in place (no navigation, no bottom sheet).
 * `mode:'fullscreen'` grows to the whole page; `mode:'card'` grows to a centered card
 * over a blurred, tap-to-dismiss backdrop. Pair the returned controller with
 * <ExpandOverlay/>, and put `ref={exp.cardRef}` + `onPress={exp.open}` on the card.
 */
export function useExpandToFullscreen(opts?: { mode?: 'fullscreen' | 'card'; cardHeight?: number }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isCard = opts?.mode === 'card';
  const MARGIN = 12;
  const cardH = Math.min(Math.round(screenH * 0.86), opts?.cardHeight ?? Math.round(screenH * 0.7));
  const target = isCard
    ? { x: MARGIN, y: Math.round((screenH - cardH) / 2), width: screenW - MARGIN * 2, height: cardH, radius: 24 }
    : { x: 0, y: 0, width: screenW, height: screenH, radius: 0 };

  const cardRef = useRef<View>(null);
  const [expanded, setExpanded] = useState(false);
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const progress = useSharedValue(0);

  const open = () => {
    const node = cardRef.current;
    const finish = () => { setExpanded(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };
    if (!node) { finish(); return; }
    node.measureInWindow((x, y, width, height) => { setRect({ x, y, width, height }); finish(); });
  };
  useEffect(() => {
    if (expanded) progress.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [expanded, progress]);
  const close = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    progress.value = withTiming(0, { duration: 240, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setExpanded)(false);
    });
  };

  const morphStyle = useAnimatedStyle(() => {
    const r = rect ?? { x: target.x, y: target.y, width: target.width, height: target.height };
    const p = progress.value;
    return {
      position: 'absolute',
      left: interpolate(p, [0, 1], [r.x, target.x]),
      top: interpolate(p, [0, 1], [r.y, target.y]),
      width: interpolate(p, [0, 1], [r.width, target.width]),
      height: interpolate(p, [0, 1], [r.height, target.height]),
      borderRadius: interpolate(p, [0, 1], [24, target.radius]),
    };
  });
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.15, 0.6], [0, 1], Extrapolation.CLAMP) }));

  return { cardRef, expanded, open, close, morphStyle, scrimStyle, contentStyle, isCard, contentW: target.width, contentH: target.height };
}

export type ExpandController = ReturnType<typeof useExpandToFullscreen>;

/**
 * The morph container. Content is rendered at the fixed target size so it lays out
 * once; the container clips a growing window of it (smooth reveal). Card mode adds a
 * blurred backdrop you can tap to dismiss.
 */
export function ExpandOverlay({ exp, children }: { exp: ExpandController; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  if (!exp.expanded) return null;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={exp.close}>
      <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, exp.scrimStyle]}>
        {exp.isCard ? (
          <>
            <BlurView intensity={colors.isDark ? 40 : 28} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)' }]} />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)' }]} />
        )}
      </Reanimated.View>
      {exp.isCard && <Pressable style={StyleSheet.absoluteFill} onPress={exp.close} accessibilityRole="button" accessibilityLabel="Close" />}
      <Reanimated.View style={[exp.morphStyle, { overflow: 'hidden', backgroundColor: colors.surface }]}>
        <Reanimated.View style={[{ width: exp.contentW, height: exp.contentH }, exp.contentStyle]}>
          {children}
        </Reanimated.View>
      </Reanimated.View>
    </Modal>
  );
}
