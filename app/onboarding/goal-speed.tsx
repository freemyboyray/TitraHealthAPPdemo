import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { addWeeks } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FF = 'System';

const SNAP_VALUES = [0.2, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
const N = SNAP_VALUES.length;
const REC_IDX = 2; // 1.0 lbs/week — the recommended sweet spot

const CONTEXT_NOTES: Record<string, string> = {
  '0.2': 'A gentle, sustainable pace, easy on your body.',
  '0.5': 'A gentle, sustainable pace, great for long-term success.',
  '1.0': 'A balanced pace with steady results. Ideal for most.',
  '1.5': 'A moderate pace with good results.',
  '2.0': 'Aggressive. Keep your protein and recovery up.',
  '2.5': 'Aggressive. Keep your protein and recovery up.',
  '3.0': 'Aggressive. Keep your protein and recovery up.',
};

// Warm heat ramp for the gauge: amber (gentle) → orange (fast).
const HEAT = ['#C9A36A', '#E8852A', '#FF742A'];

// ── Gauge geometry ──
const R = 104;
const ARC_SW = 16;
const SVG_W = 2 * R + ARC_SW; // 224
const CX = SVG_W / 2; // 112
const CY = R + ARC_SW / 2; // 112
const SVG_H = CY + 16;
const ARC_LEN = Math.PI * R;
const NEEDLE_L = R - 30;
// Upper semicircle, left → right (sweep flag 1 arcs over the top in y-down space).
const ARC_PATH = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);

// ── The sweeping speedometer ──
function PaceGauge({ t, c }: { t: SharedValue<number>; c: AppColors }) {
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LEN * (1 - t.value),
    stroke: interpolateColor(t.value, [0, 0.5, 1], HEAT),
  }));
  const needleProps = useAnimatedProps(() => {
    const a = t.value * Math.PI; // 0 → π : left → up → right
    return {
      x2: CX - NEEDLE_L * Math.cos(a),
      y2: CY - NEEDLE_L * Math.sin(a),
      stroke: interpolateColor(t.value, [0, 0.5, 1], HEAT),
    };
  });

  return (
    <Svg width={SVG_W} height={SVG_H} style={{ alignSelf: 'center' }}>
      {/* Track */}
      <Path
        d={ARC_PATH}
        stroke={c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}
        strokeWidth={ARC_SW}
        strokeLinecap="round"
        fill="none"
      />
      {/* Warm fill */}
      <AnimatedPath
        d={ARC_PATH}
        strokeWidth={ARC_SW}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={ARC_LEN}
        animatedProps={arcProps}
      />
      {/* Needle */}
      <AnimatedLine x1={CX} y1={CY} strokeWidth={5} strokeLinecap="round" animatedProps={needleProps} />
      <Circle cx={CX} cy={CY} r={9} fill={c.isDark ? '#FAF8F5' : '#1C1816'} />
      <Circle cx={CX} cy={CY} r={4} fill={c.orange} />
    </Svg>
  );
}

// ── Draggable snap slider ──
function SnapSlider({
  index,
  onChange,
  c,
  s,
}: {
  index: number;
  onChange: (i: number) => void;
  c: AppColors;
  s: ReturnType<typeof createStyles>;
}) {
  const [w, setW] = useState(0);
  const wRef = useRef(0);
  const idxRef = useRef(index);
  idxRef.current = index;
  const THUMB = 28;

  const commit = (x: number) => {
    const width = wRef.current;
    if (width <= 0) return;
    const usable = width - THUMB;
    const frac = Math.max(0, Math.min(1, (x - THUMB / 2) / usable));
    const i = Math.round(frac * (N - 1));
    if (i !== idxRef.current) {
      Haptics.selectionAsync();
      onChange(i);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => commit(e.nativeEvent.locationX),
      onPanResponderMove: (e) => commit(e.nativeEvent.locationX),
    }),
  ).current;

  const usable = Math.max(0, w - THUMB);
  const frac = index / (N - 1);
  const thumbLeft = frac * usable;
  const fillW = thumbLeft + THUMB / 2;

  return (
    <View
      style={s.sliderWrap}
      onLayout={(e) => {
        const width = e.nativeEvent.layout.width;
        wRef.current = width;
        setW(width);
      }}
      {...pan.panHandlers}
    >
      <View style={s.sliderTrack} />
      {w > 0 && <View style={[s.sliderFill, { width: fillW }]} />}
      {w > 0 &&
        SNAP_VALUES.map((_, i) => (
          <View
            key={i}
            style={[
              s.tick,
              { left: (i / (N - 1)) * usable + THUMB / 2 - 2 },
              i <= index && s.tickActive,
            ]}
          />
        ))}
      {w > 0 && <View style={[s.sliderThumb, { left: thumbLeft }]} />}
    </View>
  );
}

export default function GoalSpeedScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const isStarting = draft.glp1Status !== 'active';
  const total = isStarting ? 10 : 15;
  const stepNum = isStarting ? 9 : 14;
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [speedIdx, setSpeedIdx] = useState(REC_IDX);
  const speed = SNAP_VALUES[speedIdx];

  // Drive the gauge: spring toward the selected position (0..1).
  const t = useSharedValue(REC_IDX / (N - 1));
  useEffect(() => {
    t.value = withSpring(speedIdx / (N - 1), { damping: 15, stiffness: 130 });
  }, [speedIdx, t]);

  // Projection
  const lbsToLose = Math.max(1, (draft.weightLbs ?? 180) - (draft.goalWeightLbs ?? 160));
  const weeks = lbsToLose / speed;
  const months = weeks / 4.345;
  const projection =
    weeks < 1
      ? 'under a week'
      : months < 1.5
        ? `about ${Math.max(1, Math.round(weeks))} weeks`
        : `about ${Math.round(months)} months`;
  const goalDate = addWeeks(new Date(), weeks);
  const dateStr = goalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const zone = speedIdx <= 1 ? 'gentle' : speedIdx <= 3 ? 'rec' : 'fast';

  const jump = (i: number) => {
    if (i !== speedIdx) Haptics.selectionAsync();
    setSpeedIdx(i);
  };

  const handleContinue = () => {
    updateDraft({ targetWeeklyLossLbs: speed });
    router.push('/onboarding/activity');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={stepNum} total={total} onBack={() => router.back()} />

        <Text style={s.title} accessibilityRole="header">
          How quickly do you want to reach your goal?
        </Text>
        <Text style={s.subtitle}>
          (Don&apos;t worry, we&apos;ll help you stay healthy whatever pace you choose.)
        </Text>

        {/* Hero: live number + sweeping gauge */}
        <View style={s.hero}>
          <Text style={s.heroLabel}>WEEKLY CHANGE</Text>
          <Text style={s.heroValue}>
            {speed.toFixed(1)}
            <Text style={s.heroUnit}> lbs</Text>
          </Text>
          <PaceGauge t={t} c={colors} />
        </View>

        {/* Tier labels (tap to jump) */}
        <View style={s.tierRow}>
          <TouchableOpacity onPress={() => jump(0)} hitSlop={10} activeOpacity={0.7}>
            <Text style={[s.tier, zone === 'gentle' && s.tierActive]}>Gentle</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => jump(REC_IDX)} hitSlop={10} activeOpacity={0.7}>
            <Text style={[s.tier, zone === 'rec' && s.tierActive]}>Recommended</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => jump(N - 1)} hitSlop={10} activeOpacity={0.7}>
            <Text style={[s.tier, zone === 'fast' && s.tierActive]}>Fast</Text>
          </TouchableOpacity>
        </View>

        {/* Slider */}
        <SnapSlider index={speedIdx} onChange={setSpeedIdx} c={colors} s={s} />

        {/* Projection */}
        <Text style={s.projection}>
          You&apos;ll reach your goal in <Text style={s.projectionBold}>{projection}</Text>
        </Text>
        <Text style={s.contextNote}>{CONTEXT_NOTES[speed.toFixed(1)]}</Text>
        <Text style={s.dateNote}>Est. goal date: {dateStr}</Text>

        <View style={s.spacer} />
        <ContinueButton onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, paddingHorizontal: 24 },

    title: {
      fontSize: 26,
      fontWeight: '800',
      color: c.textPrimary,
      lineHeight: 32,
      letterSpacing: -0.4,
      fontFamily: FF,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '400',
      color: c.textSecondary,
      fontFamily: FF,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },

    hero: {
      alignItems: 'center',
    },
    heroLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: FF,
      letterSpacing: 1.5,
      marginBottom: 2,
    },
    heroValue: {
      fontSize: 46,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      letterSpacing: -1.5,
      marginBottom: 8,
    },
    heroUnit: {
      fontSize: 22,
      fontWeight: '700',
      color: c.textSecondary,
      letterSpacing: -0.5,
    },

    tierRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 14,
      paddingHorizontal: 2,
    },
    tier: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textMuted,
      fontFamily: FF,
    },
    tierActive: {
      color: c.orange,
      fontWeight: '800',
    },

    sliderWrap: {
      height: 40,
      justifyContent: 'center',
      marginTop: 12,
      marginBottom: 24,
    },
    sliderTrack: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
    },
    sliderFill: {
      position: 'absolute',
      left: 0,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.orange,
    },
    tick: {
      position: 'absolute',
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)',
    },
    tickActive: {
      backgroundColor: '#FFFFFF',
      opacity: 0.9,
    },
    sliderThumb: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.isDark ? '#FAF8F5' : '#FFFFFF',
      borderWidth: 1,
      borderColor: c.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 4,
    },

    projection: {
      fontSize: 16,
      fontWeight: '400',
      color: c.textSecondary,
      fontFamily: FF,
      textAlign: 'center',
      lineHeight: 22,
    },
    projectionBold: {
      fontWeight: '800',
      color: c.textPrimary,
    },
    contextNote: {
      fontSize: 13,
      fontWeight: '400',
      color: c.textMuted,
      fontFamily: FF,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 8,
      paddingHorizontal: 12,
    },
    dateNote: {
      fontSize: 12,
      fontWeight: '500',
      color: c.textMuted,
      fontFamily: FF,
      textAlign: 'center',
      marginTop: 6,
    },

    spacer: { flex: 1 },
  });
