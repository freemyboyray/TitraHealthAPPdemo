import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
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
import { MEDICAL_DISCLAIMER } from '@/constants/medical-sources';
import { pkConcentrationPct } from '@/constants/drug-pk';
import { useUiStore } from '@/stores/ui-store';
import { useBiometricStore } from '@/stores/biometric-store';
import { buildEnergyTimeline } from '@/lib/energy-timeline';
import { EnergyTimelineChart } from '@/components/energy-timeline-chart';
import { localDateStr } from '@/lib/date-utils';

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

// ─── Animated Ring Gauge ────────────────────────────────────────────────────

const HERO_RING_SIZE = 140;
const HERO_RING_SW = 10;
const HERO_RING_R = (HERO_RING_SIZE - HERO_RING_SW) / 2;
const HERO_RING_C = 2 * Math.PI * HERO_RING_R;

function HeroRing({ score, color, isDark }: { score: number; color: string; isDark: boolean }) {
  const w = (a: number) => isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const cx = HERO_RING_SIZE / 2;
  const cy = HERO_RING_SIZE / 2;
  const gradId = 'energyHeroGrad';

  const animScore = useSharedValue(0);

  useEffect(() => {
    animScore.value = withTiming(score, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
  }, [score]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: HERO_RING_C * (1 - animScore.value / 100),
  }));

  return (
    <View style={{ width: HERO_RING_SIZE, height: HERO_RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={HERO_RING_SIZE} height={HERO_RING_SIZE}>
        <Defs>
          <LinearGradient id={gradId} x1={cx} y1="0" x2={cx} y2={HERO_RING_SIZE} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.7" />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Circle cx={cx} cy={cy} r={HERO_RING_R} strokeWidth={HERO_RING_SW}
          stroke={w(0.08)} fill="none" />
        {/* Animated arc */}
        <AnimatedCircle cx={cx} cy={cy} r={HERO_RING_R} fill="none"
          stroke={`url(#${gradId})`} strokeWidth={HERO_RING_SW}
          strokeLinecap="round"
          strokeDasharray={`${HERO_RING_C} ${HERO_RING_C}`}
          animatedProps={arcProps}
          rotation="-90" origin={`${cx}, ${cy}`} />
      </Svg>
      {/* Center text */}
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ fontSize: 44, fontWeight: '800', color, fontFamily: FF, letterSpacing: -2 }}>
            {score}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color, fontFamily: FF }}>
            %
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Component Row ──────────────────────────────────────────────────────────

function ComponentRow({ component, isDark }: { component: EnergyComponent; isDark: boolean }) {
  const w = (a: number) => isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const color = component.available ? (COMPONENT_COLORS[component.id] ?? '#999') : w(0.2);
  const weightPct = Math.round(component.baseWeight * 100);

  return (
    <View style={{
      gap: 10, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w(0.06),
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Color accent bar */}
          <View style={{
            width: 3, height: 28, borderRadius: 1.5,
            backgroundColor: component.available ? (COMPONENT_COLORS[component.id] ?? '#999') : w(0.25),
          }} />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#FFF' : '#1A1A1A', fontFamily: FF, letterSpacing: -0.2 }}>
                {component.label}
              </Text>
              {!component.available && (
                <View style={{
                  backgroundColor: w(0.1), borderRadius: 6,
                  paddingHorizontal: 6, paddingVertical: 2,
                }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: w(0.55), fontFamily: FF, letterSpacing: 0.5 }}>
                    NOT TRACKED
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 11, fontWeight: '500', color: w(component.available ? 0.3 : 0.5), fontFamily: FF }}>
              {component.available
                ? `${weightPct}% of total score`
                : `Normally ${weightPct}% — excluded`}
            </Text>
          </View>
        </View>
        {component.available ? (
          <Text style={{ fontSize: 22, fontWeight: '800', color: COMPONENT_COLORS[component.id] ?? '#999', fontFamily: FF, letterSpacing: -0.5 }}>
            {component.score}
          </Text>
        ) : (
          <Ionicons name="remove-circle-outline" size={22} color={w(0.4)} />
        )}
      </View>

      {/* Score bar */}
      {component.available ? (
        <View style={{ height: 8, borderRadius: 4, backgroundColor: w(0.08), overflow: 'hidden' }}>
          <View style={{
            height: '100%', borderRadius: 4,
            width: `${component.score}%`, backgroundColor: COMPONENT_COLORS[component.id],
          }} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={{
              width: 16, height: 8, borderRadius: 4, backgroundColor: w(0.12),
            }} />
          ))}
        </View>
      )}

      {/* Detail text */}
      <Text style={{ fontSize: 13, color: w(component.available ? 0.4 : 0.5), fontFamily: FF, lineHeight: 18 }}>
        {component.detail}
      </Text>
    </View>
  );
}

export default function EnergyDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const healthData = useHealthData();
  const logStore = useLogStore();
  const { openAiChat } = useUiStore();

  const { actuals, targets, profile, wearable } = healthData;
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
  const pkPct = glp1Type && tHours > 0
    ? pkConcentrationPct(tHours, glp1Type as any, true, intervalH)
    : null;
  const fatigueLogs = seLogs.filter(l => l.effect_type === 'fatigue');
  const { burden: fatigueBurden } = fatigueLogs.length > 0
    ? computeSideEffectBurden(fatigueLogs, phase, 14)
    : { burden: 0 };
  const biometricBaseline = useBiometricStore(st => st.baseline);
  const result = computeEnergyBank(wearable, actuals, targets, phase, seBurden, pkPct, fatigueBurden, biometricBaseline);

  // Build energy timeline for today's chart
  const timelineData = useMemo(() => {
    const today = localDateStr();
    const todayFood = (logStore.foodLogs ?? []).filter(f => {
      const d = f.logged_at ? localDateStr(new Date(f.logged_at)) : '';
      return d === today;
    });
    const todaySE = (logStore.sideEffectLogs ?? []).filter(se => {
      const d = se.logged_at ? localDateStr(new Date(se.logged_at)) : '';
      return d === today;
    });
    return buildEnergyTimeline({
      wearable,
      targets,
      phase,
      seBurden,
      fatigueBurden,
      baseline: biometricBaseline,
      pkHoursSinceInjection: tHours,
      glp1Type: glp1Type as any,
      injectionFrequencyDays: freq,
      todayFoodLogs: todayFood.map(f => ({
        logged_at: f.logged_at, calories: f.calories, protein_g: f.protein_g, fiber_g: f.fiber_g,
      })),
      todayWaterMl: actuals.waterMl,
      todaySideEffectLogs: todaySE.map(se => ({
        logged_at: se.logged_at, severity: se.severity ?? 0, effect_type: se.effect_type,
      })),
    });
  }, [logStore.foodLogs, logStore.sideEffectLogs, wearable, targets, phase, seBurden, fatigueBurden, biometricBaseline, tHours, glp1Type, freq, actuals.waterMl]);

  const color = energyColor(result.score);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const phaseLabels: Record<string, string> = {
    shot: 'Dose Day', peak: 'Peak Phase', balance: 'Balance Phase', reset: 'Reset Phase',
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14,
      }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Energy Bank</Text>
        <TouchableOpacity
          onPress={() => {
            const contextValue = `${result.score}% · ${result.label} · ${phaseLabels[phase] ?? phase}`;
            const chips = [
              'Why is my energy this level?',
              'How can I boost my energy today?',
              'How does my medication affect energy?',
              'What should I eat to feel more energized?',
            ];
            openAiChat({ type: 'energy', contextLabel: 'Energy Bank', contextValue, chips: JSON.stringify(chips) });
          }}
          activeOpacity={0.7}
          hitSlop={12}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 80 }}
      >
        {/* Hero ring */}
        <View style={[s.heroCard, { backgroundColor: colors.surface }]}>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <HeroRing score={result.score} color={color} isDark={colors.isDark} />
            <Text style={[s.heroLabel, { color }]}>{result.label}</Text>
            <View style={s.phasePill}>
              <Ionicons name="medical" size={12} color={w(0.4)} />
              <Text style={s.phaseText}>{phaseLabels[phase] ?? 'Active'}</Text>
            </View>
          </View>
        </View>

        {/* Missing data disclaimer */}
        {result.disclaimer && (
          <View style={[s.disclaimerCard, { backgroundColor: colors.isDark ? 'rgba(255,149,0,0.08)' : 'rgba(255,149,0,0.06)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Ionicons name="information-circle" size={18} color="#FF9500" style={{ marginTop: 1 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF9500', fontFamily: FF }}>
                  Incomplete Data
                </Text>
                <Text style={{ fontSize: 12, color: w(0.5), fontFamily: FF, lineHeight: 17 }}>
                  {result.disclaimer}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Energy timeline chart */}
        <EnergyTimelineChart data={timelineData} />

        {/* Component breakdown */}
        <Text style={s.breakdownTitle}>BREAKDOWN</Text>
        <View style={[s.breakdownCard, { backgroundColor: colors.surface }]}>
          {result.components.map(c => (
            <ComponentRow key={c.id} component={c} isDark={colors.isDark} />
          ))}
        </View>

        {/* Disclaimer */}
        <Text style={s.disclaimer}>
          {MEDICAL_DISCLAIMER}
        </Text>
      </ScrollView>

    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    headerTitle: {
      fontSize: 17, fontWeight: '700', color: c.textPrimary, fontFamily: FF,
      letterSpacing: -0.3,
    },
    heroCard: {
      borderRadius: 24, padding: 32,
      borderWidth: 0.5, borderColor: c.borderSubtle,
      ...cardElevation(c.isDark),
      marginBottom: 20,
    },
    disclaimerCard: {
      borderRadius: 14, padding: 16,
      borderWidth: 1, borderColor: 'rgba(255,149,0,0.2)',
      marginBottom: 20,
    },
    heroLabel: {
      fontSize: 16, fontWeight: '700', fontFamily: FF, textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    phasePill: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: w(0.06), borderRadius: 10,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    phaseText: {
      fontSize: 12, fontWeight: '600', color: w(0.4), fontFamily: FF,
    },
    breakdownTitle: {
      fontSize: 13, fontWeight: '700', color: w(0.35), fontFamily: FF,
      letterSpacing: 1.0,
      marginBottom: 12,
    },
    breakdownCard: {
      borderRadius: 20, paddingHorizontal: 20,
      borderWidth: 0.5, borderColor: c.borderSubtle,
      ...cardElevation(c.isDark),
      marginBottom: 20,
    },
    disclaimer: {
      fontSize: 11, color: w(0.25), fontFamily: FF, lineHeight: 16,
      textAlign: 'center', marginTop: 8,
    },
  });
};
