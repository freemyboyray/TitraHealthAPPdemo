import React, { useEffect, useMemo } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
const LB_TO_KG = 0.453592;
const TOKEN = 38;

// Track colors are brand-independent green (works in both light & dark).
const GREEN = '#34C759';        // covered (progress made)
const GREEN_DIM = 'rgba(52,199,89,0.22)'; // remaining lane

type Props = {
  startWeightLbs: number | null;
  currentWeightLbs: number | null;
  goalWeightLbs: number | null;
  unitSystem: 'imperial' | 'metric';
  onPress?: () => void;
};

/**
 * Home "race-to-goal" weight-loss card. A horizontal green track runs from the
 * user's start weight (left cap) to their goal weight (right cap); a glowing
 * token — their current weight — rides the track at their progress point, with
 * the covered lane filled vivid green. On load the token animates from Start to
 * the current position. No card chrome (sits directly on the page background).
 */
export function WeightTrackCard({
  startWeightLbs,
  currentWeightLbs,
  goalWeightLbs,
  unitSystem,
  onPress,
}: Props) {
  const { colors: c } = useAppTheme();
  const s = useMemo(() => createStyles(c), [c]);

  const isMetric = unitSystem === 'metric';
  const unit = isMetric ? 'kg' : 'lb';
  const toDisplay = (lbs: number) => Math.round(isMetric ? lbs * LB_TO_KG : lbs);

  // Until the user logs an actual weigh-in, treat their onboarding START weight
  // as the current weight — so the token shows that number (not a dash) at 0%
  // progress. Any logged weight (passed in as currentWeightLbs) then overrides it.
  const effectiveCurrent = currentWeightLbs ?? startWeightLbs;

  // A valid weight-loss track just needs a start, a goal, and start > goal.
  const valid =
    startWeightLbs != null &&
    goalWeightLbs != null &&
    startWeightLbs > goalWeightLbs;

  const span = valid ? startWeightLbs - goalWeightLbs : 0;
  const lostLbs = valid && effectiveCurrent != null ? Math.max(0, startWeightLbs - effectiveCurrent) : 0;
  const pct = valid ? Math.round((Math.min(span, lostLbs) / span) * 100) : 0;
  const tokenLeft = Math.max(0, Math.min(100, pct)); // 0..100 position on the bar
  const lostDisplay = toDisplay(lostLbs);

  const startLabel = startWeightLbs != null ? `${toDisplay(startWeightLbs)}` : '—';
  const goalLabel = goalWeightLbs != null ? `${toDisplay(goalWeightLbs)}` : '—';
  const currentLabel = effectiveCurrent != null ? `${toDisplay(effectiveCurrent)}` : '—';

  // ── Entrance animation: fill + token race from Start to the current point. ──
  const barW = useSharedValue(0);
  const prog = useSharedValue(0);
  useEffect(() => {
    prog.value = 0;
    prog.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [valid, pct, prog]);

  const onBarLayout = (e: LayoutChangeEvent) => {
    barW.value = e.nativeEvent.layout.width;
  };

  // Token travels flush from the Start edge to the Goal edge: its center spans
  // TOKEN/2 → (barWidth - TOKEN/2), so it never overhangs the caps. The green
  // fill is the COVERED distance — it grows from the LEFT (Start) edge up to the
  // token, and is zero-width at 0% (no fake progress when current === start).
  // Fill reaches the token's CENTER (runs under it) so the bar and token read as
  // one connected piece — no gap. The token sits on top and hides the small stub
  // at 0%, so there's still no fake progress when current === start.
  const fillStyle = useAnimatedStyle(() => {
    const usable = Math.max(0, barW.value - TOKEN);
    return { width: TOKEN / 2 + usable * (tokenLeft / 100) * prog.value };
  });
  const tokenStyle = useAnimatedStyle(() => {
    const usable = Math.max(0, barW.value - TOKEN);
    const centerX = TOKEN / 2 + usable * (tokenLeft / 100) * prog.value;
    return {
      transform: [
        { translateX: centerX - TOKEN / 2 },
        { translateY: -TOKEN / 2 },
      ],
    };
  });

  return (
    <Pressable
      style={({ pressed }) => [s.root, pressed && onPress ? { opacity: 0.85 } : null]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        valid
          ? `Weight loss progress. ${currentLabel} ${unit}, ${pct}% to goal, ${lostDisplay} ${unit} lost.`
          : 'Weight loss progress'
      }
    >
      {/* ── Track ── */}
      <View style={s.trackRow}>
        <View style={s.cap}>
          <Text style={s.capNum}>{startLabel}</Text>
          <Text style={s.capLbl}>Start</Text>
        </View>

        <View style={s.barWrap} onLayout={onBarLayout}>
          <View style={s.barBase} />
          <Animated.View style={[s.barFill, fillStyle]} />
          <Animated.View style={[s.token, tokenStyle]}>
            <View style={s.tokenInner}>
              <Text style={s.tokenTxt} numberOfLines={1}>{currentLabel}</Text>
            </View>
          </Animated.View>
        </View>

        <View style={s.cap}>
          <Text style={s.capNum}>{goalLabel}</Text>
          <Text style={s.capLbl}>Goal</Text>
        </View>
      </View>

      {/* ── Caption ── */}
      {valid && (
        <Text style={s.below}>
          <Text style={s.belowStrong}>{pct}%</Text> there
          {'  ·  '}
          <Text style={s.belowStrong}>{lostDisplay} {unit}</Text> lost
        </Text>
      )}
    </Pressable>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    // No card chrome — sits directly on the page background.
    root: {
      paddingHorizontal: 4,
      paddingTop: 6,
      paddingBottom: 4,
      marginBottom: 16,
    },

    trackRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TOKEN },

    cap: {
      minWidth: 54,
      height: 40,
      borderRadius: 14,
      paddingHorizontal: 8,
      backgroundColor: c.isDark ? '#2C2A28' : 'rgba(0,0,0,0.05)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    capNum: { fontSize: 15, fontWeight: '800', color: c.textPrimary, fontFamily: FF, lineHeight: 18 },
    capLbl: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: c.textMuted, fontFamily: FF },

    barWrap: { flex: 1, height: TOKEN, justifyContent: 'center' },
    barBase: {
      position: 'absolute', left: 0, right: 0,
      height: 22, borderRadius: 11, backgroundColor: GREEN_DIM,
    },
    barFill: {
      position: 'absolute', left: 0,
      height: 22, borderRadius: 11, backgroundColor: GREEN,
    },

    token: {
      position: 'absolute',
      top: '50%',
      left: 0,
      width: TOKEN,
      height: TOKEN,
      borderRadius: TOKEN / 2,
      backgroundColor: GREEN,             // green ring
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
      shadowColor: GREEN,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: 8,
      elevation: 6,
    },
    tokenInner: {
      width: TOKEN - 10,
      height: TOKEN - 10,
      borderRadius: (TOKEN - 10) / 2,
      backgroundColor: '#000000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tokenTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', fontFamily: FF, letterSpacing: -0.3 },

    below: { marginTop: 16, textAlign: 'center', fontSize: 13, fontWeight: '600', color: c.textSecondary, fontFamily: FF },
    belowStrong: { color: c.textPrimary, fontWeight: '800' },
  });
