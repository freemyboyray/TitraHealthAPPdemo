import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

import { GlassBorder } from '@/components/ui/glass-border';
import { useAppTheme } from '@/contexts/theme-context';
import { useTour, type TourRect } from '@/contexts/tour-context';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const DIM = 'rgba(0,0,0,0.74)';
const CARD_W_INSET = 20; // horizontal screen margin for the tooltip card
const GAP = 16; // space between the spotlight and the tooltip
const TIMING = { duration: 320, easing: Easing.out(Easing.cubic) };

function holeGeometry(rect: TourRect, padding: number, radius: number | 'full') {
  const pad = padding;
  const x = rect.x - pad;
  const y = rect.y - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const r = radius === 'full' ? Math.min(w, h) / 2 : radius;
  return { x, y, w, h, r };
}

export function TourOverlay() {
  const { active, step, rect, index, total, next, back, skip } = useTour();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const r = useSharedValue(0);
  const firstRef = useRef(true);

  const [cardH, setCardH] = useState(160);

  useEffect(() => {
    if (!active) { firstRef.current = true; return; }
    if (!rect || !step) return;
    const g = holeGeometry(rect, step.padding ?? 10, step.radius ?? 16);
    if (firstRef.current) {
      // First step: pop the hole in at its target size (no slide from 0,0).
      x.value = g.x; y.value = g.y; w.value = g.w; h.value = g.h; r.value = g.r;
      firstRef.current = false;
    } else {
      x.value = withTiming(g.x, TIMING);
      y.value = withTiming(g.y, TIMING);
      w.value = withTiming(g.w, TIMING);
      h.value = withTiming(g.h, TIMING);
      r.value = withTiming(g.r, TIMING);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [active, rect, step]);

  const holeProps = useAnimatedProps(() => ({
    x: x.value,
    y: y.value,
    width: w.value,
    height: h.value,
    rx: r.value,
    ry: r.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: w.value,
    height: h.value,
    borderRadius: r.value,
  }));

  if (!active) return null;

  const isLast = index >= total - 1;

  // Place the card on whichever side actually has room, honoring an explicit
  // request only when the card fits there — otherwise flip so it never lands
  // on top of the highlighted target.
  const g = rect ? holeGeometry(rect, step?.padding ?? 10, step?.radius ?? 16) : null;
  let cardTop = insets.top + 24;
  if (g) {
    const topLimit = insets.top + 12;
    const bottomLimit = H - insets.bottom - 12;
    const roomAbove = g.y - GAP - topLimit;
    const roomBelow = bottomLimit - (g.y + g.h) - GAP;
    const fitsAbove = roomAbove >= cardH;
    const fitsBelow = roomBelow >= cardH;

    let placeBelow = (g.y + g.h / 2) < H * 0.5;
    if (step?.placement === 'top') placeBelow = false;
    if (step?.placement === 'bottom') placeBelow = true;
    // Flip to the side that fits; if neither fits, take the roomier side.
    if (placeBelow && !fitsBelow && fitsAbove) placeBelow = false;
    else if (!placeBelow && !fitsAbove && fitsBelow) placeBelow = true;
    else if (!fitsAbove && !fitsBelow) placeBelow = roomBelow >= roomAbove;

    cardTop = placeBelow ? g.y + g.h + GAP : g.y - GAP - cardH;
    cardTop = Math.max(topLimit, Math.min(cardTop, bottomLimit - cardH));
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      {/* Tap anywhere on the dim to advance. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={next}
        accessibilityLabel="Next tip"
        accessibilityRole="button"
      />

      {/* Dimmed scrim with a transparent hole punched over the target. */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="tour-hole">
            <Rect x={0} y={0} width={W} height={H} fill="#fff" />
            <AnimatedRect animatedProps={holeProps} fill="#000" />
          </Mask>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={DIM} mask="url(#tour-hole)" />
      </Svg>

      {/* Glowing ring around the highlight. */}
      {rect && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            ringStyle,
            {
              borderColor: colors.orange,
              shadowColor: colors.orange,
            },
          ]}
        />
      )}

      {/* Tooltip card. */}
      {step && (
        <View
          style={[styles.card, { top: cardTop, left: CARD_W_INSET, right: CARD_W_INSET }]}
          onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
        >
          <View style={styles.cardShadow}>
            <View style={[styles.cardBody, { backgroundColor: colors.surface }]}>
              <BlurView intensity={40} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
              <GlassBorder r={22} />

              <View style={styles.cardContent}>
                <Pressable
                  onPress={skip}
                  hitSlop={10}
                  style={styles.skipCorner}
                  accessibilityRole="button"
                  accessibilityLabel="Skip tour"
                >
                  <Text style={[styles.skip, { color: colors.textMuted }]}>Skip</Text>
                </Pressable>

                <Text style={[styles.title, { color: colors.textPrimary }]}>{step.title}</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>{step.body}</Text>

                <View style={styles.footer}>
                  {index > 0 ? (
                    <Pressable onPress={back} hitSlop={10} style={styles.navSlot} accessibilityRole="button" accessibilityLabel="Previous tip">
                      <Text style={[styles.back, { color: colors.textMuted }]}>Back</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.navSlot} />
                  )}

                  <View style={styles.dots}>
                    {Array.from({ length: total }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          {
                            backgroundColor: i === index ? colors.orange : colors.border,
                            width: i === index ? 18 : 6,
                          },
                        ]}
                      />
                    ))}
                  </View>

                  <Pressable
                    onPress={next}
                    style={[styles.nextBtn, { backgroundColor: colors.orange }]}
                    accessibilityRole="button"
                    accessibilityLabel={isLast ? 'Finish tour' : 'Next tip'}
                  >
                    <Text style={styles.nextText}>{isLast ? 'Done' : 'Next'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 0,
  },
  card: { position: 'absolute' },
  cardShadow: {
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 14,
  },
  cardBody: { borderRadius: 22, overflow: 'hidden' },
  cardContent: { padding: 18 },
  skipCorner: { position: 'absolute', top: 14, right: 16, zIndex: 2 },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4, marginBottom: 6, paddingRight: 44, fontFamily: 'System' },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 21, fontFamily: 'System' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  navSlot: { minWidth: 52 },
  skip: { fontSize: 15, fontWeight: '600', fontFamily: 'System' },
  back: { fontSize: 15, fontWeight: '600', fontFamily: 'System' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { height: 6, borderRadius: 3 },
  nextBtn: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10, minWidth: 52, alignItems: 'center' },
  nextText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', fontFamily: 'System' },
});
