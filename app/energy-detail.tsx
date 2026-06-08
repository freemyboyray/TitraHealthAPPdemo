import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { useHealthData } from '@/contexts/health-data';
import { useLogStore } from '@/stores/log-store';
import {
  computeEnergyBank,
  computeSideEffectBurden,
  daysSinceInjection,
  type EnergyComponent,
} from '@/constants/scoring';
import { pkConcentrationPct } from '@/constants/drug-pk';
import { isOnTreatment } from '@/constants/user-profile';
import { useUiStore } from '@/stores/ui-store';
import { useBiometricStore } from '@/stores/biometric-store';
import { buildEnergyTimeline } from '@/lib/energy-timeline';
import { EnergyTimelineChart } from '@/components/energy-timeline-chart';
import { localDateStr } from '@/lib/date-utils';
import {
  ChevronLeft, Sparkles,
  Moon, Pill, Activity, Apple, Droplet, Frown,
} from 'lucide-react-native';

const FF = 'System';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function energyColor(pct: number): string {
  if (pct >= 70) return '#27AE60';
  if (pct >= 45) return '#F6CB45';
  if (pct >= 20) return '#E8960C';
  return '#E53E3E';
}

const COMPONENT_COLORS: Record<string, string> = {
  sleep: '#5856D6',
  drugLevel: '#FF742A',
  recovery: '#AF52DE',
  nutrition: '#34C759',
  hydration: '#5AC8FA',
  sideEffects: '#FF3B30',
};

// Hand-illustrated card art, reused from the metric-detail screens. Where a
// component has no bespoke illustration (sleep, recovery) we fall back to the
// lucide glyph below — same pattern as the rest of the app.
const COMPONENT_IMAGE: Partial<Record<string, ImageSourcePropType>> = {
  drugLevel: require('@/assets/images/cards/past-doses.png'),
  nutrition: require('@/assets/images/cards/nutrition-bowl.png'),
  hydration: require('@/assets/images/cards/hydration.png'),
  sideEffects: require('@/assets/images/cards/symptom-log.png'),
};

function componentIcon(id: string, color: string, size = 18): React.ReactNode {
  switch (id) {
    case 'sleep': return <Moon size={size} color={color} />;
    case 'drugLevel': return <Pill size={size} color={color} />;
    case 'recovery': return <Activity size={size} color={color} />;
    case 'nutrition': return <Apple size={size} color={color} />;
    case 'hydration': return <Droplet size={size} color={color} />;
    case 'sideEffects': return <Frown size={size} color={color} />;
    default: return <Activity size={size} color={color} />;
  }
}

function qualLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Low';
  return 'Very low';
}

// ─── Animated ring gauge ──────────────────────────────────────────────────────

const HERO_RING_SIZE = 124;
const HERO_RING_SW = 12;
const HERO_RING_R = (HERO_RING_SIZE - HERO_RING_SW) / 2;
const HERO_RING_C = 2 * Math.PI * HERO_RING_R;

function HeroRing({ score, color, isDark }: { score: number; color: string; isDark: boolean }) {
  const w = (a: number) => (isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const cx = HERO_RING_SIZE / 2;
  const cy = HERO_RING_SIZE / 2;
  const gradId = 'energyHeroGrad';
  const animScore = useSharedValue(0);

  useEffect(() => {
    animScore.value = withTiming(score, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [score]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: HERO_RING_C * (1 - animScore.value / 100) }));

  return (
    <View style={{ width: HERO_RING_SIZE, height: HERO_RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={HERO_RING_SIZE} height={HERO_RING_SIZE}>
        <Defs>
          <LinearGradient id={gradId} x1={cx} y1="0" x2={cx} y2={HERO_RING_SIZE} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.7" />
          </LinearGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={HERO_RING_R} strokeWidth={HERO_RING_SW} stroke={w(0.08)} fill="none" />
        <AnimatedCircle cx={cx} cy={cy} r={HERO_RING_R} fill="none"
          stroke={color} strokeWidth={HERO_RING_SW + 8} opacity={0.15} strokeLinecap="round"
          strokeDasharray={`${HERO_RING_C} ${HERO_RING_C}`} animatedProps={arcProps}
          rotation="-90" origin={`${cx}, ${cy}`} />
        <AnimatedCircle cx={cx} cy={cy} r={HERO_RING_R} fill="none"
          stroke={`url(#${gradId})`} strokeWidth={HERO_RING_SW} strokeLinecap="round"
          strokeDasharray={`${HERO_RING_C} ${HERO_RING_C}`} animatedProps={arcProps}
          rotation="-90" origin={`${cx}, ${cy}`} />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ fontSize: 38, fontWeight: '800', color, fontFamily: FF, letterSpacing: -1.5 }}>{score}</Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color, fontFamily: FF }}>%</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Aurora hero background (tinted by the energy color) ──────────────────────

function AuroraHeroBg({ heroH, color, isDark }: { heroH: number; color: string; isDark: boolean }) {
  const W = 400;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: heroH }} pointerEvents="none">
      <Svg width="100%" height={heroH} viewBox={`0 0 ${W} ${heroH}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="enAuroraA" cx="78%" cy="14%" r="55%">
            <Stop offset="0" stopColor={color} stopOpacity={isDark ? 0.32 : 0.26} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="enAuroraB" cx="14%" cy="34%" r="55%">
            <Stop offset="0" stopColor="#5AC8FA" stopOpacity={isDark ? 0.22 : 0.18} />
            <Stop offset="1" stopColor="#5AC8FA" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={W} cy={heroH * 0.14} r={W * 0.7} fill="url(#enAuroraA)" />
        <Circle cx={0} cy={heroH * 0.34} r={W * 0.7} fill="url(#enAuroraB)" />
      </Svg>
    </View>
  );
}

// ─── Component card ───────────────────────────────────────────────────────────

function ComponentCard({ component, colors }: {
  component: EnergyComponent; colors: AppColors;
}) {
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const color = component.available ? (COMPONENT_COLORS[component.id] ?? colors.orange) : w(0.25);
  const img = component.available ? COMPONENT_IMAGE[component.id] : undefined;

  return (
    <View style={s.compCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {img ? (
          <Image source={img} style={s.compImg} resizeMode="contain" />
        ) : (
          <View style={[s.compIcon, { backgroundColor: w(0.06) }]}>
            {componentIcon(component.id, w(0.3), 18)}
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[s.compLabel, !component.available && { color: w(0.4) }]}>{component.label}</Text>
          <Text style={s.compMeta}>{component.available ? qualLabel(component.score) : 'Not tracked'}</Text>
        </View>
        {component.available && <Text style={[s.compScore, { color }]}>{component.score}</Text>}
      </View>

      {component.available ? (
        <View style={s.compTrack}>
          <View style={{ height: '100%', borderRadius: 4, width: `${component.score}%`, backgroundColor: color }} />
        </View>
      ) : (
        <View style={s.compTrack} />
      )}

      <Text style={[s.compDetail, !component.available && { color: w(0.3) }]}>{component.detail}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EnergyDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const healthData = useHealthData();
  const logStore = useLogStore();
  const { openAiChat } = useUiStore();

  const { actuals, targets, profile, wearable } = healthData;
  const onTx = isOnTreatment(profile);
  const freq = profile.injectionFrequencyDays ?? 7;
  const dayNum = daysSinceInjection(profile.lastInjectionDate, new Date(), freq);
  const phase = dayNum <= Math.round(freq * 0.15) ? 'shot' as const
    : dayNum <= Math.round(freq * 0.5) ? 'peak' as const
    : dayNum <= Math.round(freq * 0.85) ? 'balance' as const : 'reset' as const;

  const seLogs = (logStore.sideEffectLogs ?? []).map(l => ({
    effect_type: l.effect_type, severity: l.severity ?? 0, logged_at: l.logged_at, phase_at_log: l.phase_at_log ?? '',
  }));
  const { burden: seBurden } = computeSideEffectBurden(seLogs, phase, 14);
  const tHours = dayNum * 24;
  const glp1Type = profile.glp1Type;
  const intervalH = freq * 24;
  const pkPct = onTx && glp1Type && tHours > 0
    ? pkConcentrationPct(tHours, glp1Type as any, true, intervalH)
    : null;
  const fatigueLogs = seLogs.filter(l => l.effect_type === 'fatigue');
  const { burden: fatigueBurden } = fatigueLogs.length > 0
    ? computeSideEffectBurden(fatigueLogs, phase, 14)
    : { burden: 0 };
  const biometricBaseline = useBiometricStore(st => st.baseline);
  const result = computeEnergyBank(wearable, actuals, targets, phase, seBurden, pkPct, fatigueBurden, biometricBaseline, onTx);

  const timelineData = useMemo(() => {
    const today = localDateStr();
    const todayFood = (logStore.foodLogs ?? []).filter(f => (f.logged_at ? localDateStr(new Date(f.logged_at)) : '') === today);
    const todaySE = (logStore.sideEffectLogs ?? []).filter(se => (se.logged_at ? localDateStr(new Date(se.logged_at)) : '') === today);
    return buildEnergyTimeline({
      wearable, targets, phase, seBurden, fatigueBurden, baseline: biometricBaseline,
      pkHoursSinceInjection: tHours, glp1Type: glp1Type as any, injectionFrequencyDays: freq, isOnTreatment: onTx,
      todayFoodLogs: todayFood.map(f => ({ logged_at: f.logged_at, calories: f.calories, protein_g: f.protein_g, fiber_g: f.fiber_g })),
      todayWaterMl: actuals.waterMl,
      todaySideEffectLogs: todaySE.map(se => ({ logged_at: se.logged_at, severity: se.severity ?? 0, effect_type: se.effect_type })),
    });
  }, [logStore.foodLogs, logStore.sideEffectLogs, wearable, targets, phase, seBurden, fatigueBurden, biometricBaseline, tHours, glp1Type, freq, actuals.waterMl, onTx]);

  const color = energyColor(result.score);

  const phaseLabels: Record<string, string> = {
    shot: 'Dose Day', peak: 'Peak Phase', balance: 'Balance Phase', reset: 'Reset Phase',
  };

  // Tracked components first, untracked (grayed) ones sink to the bottom.
  const sortedComponents = useMemo(
    () => [...result.components].sort((a, b) => Number(b.available) - Number(a.available)),
    [result.components],
  );

  const askAi = (firstChip?: string) => {
    const contextValue = `${result.score}% · ${result.label} · ${phaseLabels[phase] ?? phase}`;
    const chips = [
      firstChip,
      'Why is my energy this level?',
      'How can I boost my energy today?',
      'How does my medication affect energy?',
    ].filter(Boolean) as string[];
    openAiChat({ type: 'energy', contextLabel: 'Energy Bank', contextValue, chips: JSON.stringify(chips) });
  };

  const heroH = insets.top + 240;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AuroraHeroBg heroH={heroH} color={color} isDark={colors.isDark} />

      {/* Top bar — back + centered title (matches the Nutrition detail header) */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backBtn} accessibilityLabel="Back" accessibilityRole="button">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Energy Bank</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — ring + label on the left, plain-language explainer on the right */}
        <View style={s.heroRow}>
          <View style={s.heroLeft}>
            <HeroRing score={result.score} color={color} isDark={colors.isDark} />
            <Text style={[s.heroLabel, { color }]}>{result.label}</Text>
          </View>
          <Text style={s.heroAbout}>
            Your Energy Bank gauges how much energy you likely have today, blended from your
            sleep, recovery, drug levels, nutrition, hydration, and side effects.
          </Text>
        </View>

        {/* Timeline — the graph sits immediately under the hero */}
        <Text style={s.sectionHeader}>Today's energy</Text>
        <EnergyTimelineChart data={timelineData} />

        {/* Breakdown — tracked signals first, untracked (grayed) ones at the bottom */}
        <Text style={s.sectionHeader}>What's driving it</Text>
        <Text style={s.drivingNote}>
          These are the signals behind your energy score, and they matter most while you're on a
          GLP-1. The grayed-out ones aren't tracked yet. Connect Apple Health or log them on a
          paired device to fold them into your score.
        </Text>
        <View style={{ gap: 12 }}>
          {sortedComponents.map(c => (
            <ComponentCard key={c.id} component={c} colors={colors} />
          ))}
        </View>

        {/* AI pill */}
        <Pressable style={s.aiPill} onPress={() => askAi()} accessibilityRole="button" accessibilityLabel="Ask about my energy">
          <Sparkles size={18} color="#FFFFFF" />
          <Text style={s.aiPillText}>Ask about my energy</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 12, paddingBottom: 8, zIndex: 10,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '700', fontFamily: FF, letterSpacing: -0.2 },

    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 8, marginBottom: 4 },
    heroLeft: { alignItems: 'center' },
    heroLabel: { fontSize: 15, fontWeight: '800', fontFamily: FF, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 8 },
    heroAbout: { flex: 1, fontSize: 14.5, color: w(0.55), fontFamily: FF, lineHeight: 21 },

    sectionHeader: { fontSize: 22, fontWeight: '700', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.3, marginTop: 26, marginBottom: 14 },
    drivingNote: { fontSize: 13.5, color: w(0.5), fontFamily: FF, lineHeight: 19, marginTop: -4, marginBottom: 16 },

    compCard: {
      backgroundColor: c.surface, borderRadius: 20, padding: 16,
      borderWidth: 0.5, borderColor: c.border, ...cardElevation(c.isDark),
    },
    compIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    compImg: { width: 44, height: 44 },
    compLabel: { fontSize: 16, fontWeight: '700', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.2 },
    compMeta: { fontSize: 12.5, fontWeight: '500', color: w(0.4), fontFamily: FF, marginTop: 2 },
    compScore: { fontSize: 24, fontWeight: '800', fontFamily: FF, letterSpacing: -0.5 },
    compTrack: { height: 8, borderRadius: 4, backgroundColor: w(0.08), overflow: 'hidden', marginTop: 12 },
    compDetail: { fontSize: 13, color: w(0.45), fontFamily: FF, lineHeight: 18, marginTop: 10 },

    aiPill: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.orange, borderRadius: 999, paddingVertical: 16, marginTop: 28,
    },
    aiPillText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', fontFamily: FF },
  });
};
