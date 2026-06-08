import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { ChevronRight, Lock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useLifestyleMetrics } from '@/hooks/use-lifestyle-metrics';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { smoothPath } from '@/lib/chart-utils';
import type { EnergyTimelinePoint } from '@/lib/energy-timeline';
import type { EnergyBankResult, FocusItem } from '@/constants/scoring';

const FF = 'System';

type Metrics = ReturnType<typeof useLifestyleMetrics>;

type MetricDef = {
  id: string;
  image: ImageSourcePropType;
  color: string;
  build: (m: Metrics) => { pct: number; label: string };
};

function fmtSteps(n: number): string {
  const v = Math.round(n);
  return v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${v}`;
}

const METRICS: MetricDef[] = [
  {
    id: 'protein', image: require('@/assets/images/focus/protein.png'), color: '#FF742A',
    build: (m) => ({
      pct: (m.targets.proteinG || 0) > 0 ? m.todayProteinG / m.targets.proteinG : 0,
      label: `${Math.round(m.todayProteinG)}g`,
    }),
  },
  {
    id: 'water', image: require('@/assets/images/focus/water.png'), color: '#3B9EFF',
    build: (m) => ({
      pct: m.waterTargetOz > 0 ? m.waterOz / m.waterTargetOz : 0,
      label: `${Math.round(m.waterOz)} oz`,
    }),
  },
  {
    id: 'fiber', image: require('@/assets/images/focus/fiber.png'), color: '#27AE60',
    build: (m) => ({
      pct: (m.targets.fiberG || 0) > 0 ? m.todayFiberG / m.targets.fiberG : 0,
      label: `${Math.round(m.todayFiberG)}g`,
    }),
  },
  {
    id: 'activity', image: require('@/assets/images/focus/steps.png'), color: '#9B7EDE',
    build: (m) => ({
      pct: (m.targets.steps || 0) > 0 ? m.todaySteps / m.targets.steps : 0,
      label: fmtSteps(m.todaySteps),
    }),
  },
];

function pctStr(pct: number): `${number}%` {
  return `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`;
}

// ─── Today's Focus tile (horizontal bars) ────────────────────────────────────

function TodayFocusTile({ width }: { width: number }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const m = useLifestyleMetrics();
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  return (
    <Pressable
      style={[s.tile, { width }]}
      onPress={() => router.push('/daily-focus' as any)}
      accessibilityLabel="Today's Focuses. View details."
      accessibilityRole="button"
    >
      <View style={s.tileHead}>
        <Text style={s.tileTitle}>Today's{'\n'}Focuses</Text>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>

      <View style={s.barList}>
        {METRICS.map((mt) => {
          const { pct, label } = mt.build(m);
          const clamped = Math.max(0, Math.min(1, pct));
          return (
            <View key={mt.id} style={s.barRow}>
              <Image
                source={mt.image}
                style={s.metricIcon}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <View style={[s.track, { backgroundColor: w(0.07) }]}>
                <View style={{ height: '100%', width: pctStr(pct), backgroundColor: mt.color, borderRadius: 5 }} />
              </View>
              <Text style={[s.barPct, { color: clamped >= 1 ? mt.color : colors.textSecondary }]}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

// ─── Energy battery tile (horizontal) ────────────────────────────────────────

function energyColor(pct: number): string {
  if (pct >= 70) return '#27AE60';
  if (pct >= 45) return '#F6CB45';
  if (pct >= 20) return '#E8960C';
  return '#E53E3E';
}

// ─── Mini 24h sparkline (area + line on a fixed 0–100 scale) ──────────────────

const SPARK_H = 58;

function EnergySparkline({
  data, width, color, isDark,
}: {
  data: EnergyTimelinePoint[];
  width: number;
  color: string;
  isDark: boolean;
}) {
  const pad = 4;
  if (data.length < 2 || width <= 0) return null;

  const n = data.length;
  const toX = (i: number) => pad + (i / (n - 1)) * (width - pad * 2);
  const toY = (v: number) => pad + (1 - v / 100) * (SPARK_H - pad * 2);

  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.score) }));
  const line = smoothPath(pts);
  const area = `${line} L ${pts[n - 1].x} ${SPARK_H} L ${pts[0].x} ${SPARK_H} Z`;
  const last = pts[n - 1];

  return (
    <Svg width={width} height={SPARK_H}>
      <Defs>
        <LinearGradient id="energyTileFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={isDark ? '0.32' : '0.38'} />
          <Stop offset="1" stopColor={color} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#energyTileFill)" />
      <Path
        d={line}
        stroke={color}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={last.x} cy={last.y} r={3.5} fill={color} />
    </Svg>
  );
}

function EnergyTile({
  width, result, timeline,
}: {
  width: number;
  result: EnergyBankResult | null;
  timeline?: EnergyTimelinePoint[];
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const isPremium = useSubscriptionStore((st) => st.isPremium);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  const score = result?.score ?? 0;
  const color = energyColor(score);
  const showData = isPremium && result != null;
  const hasGraph = showData && timeline != null && timeline.length >= 2;
  const innerW = width - 32; // tile paddingHorizontal: 16 each side

  return (
    <Pressable
      style={[s.tile, { width }]}
      onPress={() => router.push((isPremium ? '/energy-detail' : '/upgrade') as any)}
      accessibilityLabel={showData ? `Energy ${score} percent, last 24 hours` : 'Energy Bank, premium feature'}
      accessibilityRole="button"
    >
      <View style={s.tileHead}>
        <Text style={s.tileTitle}>Energy{'\n'}Bank</Text>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>

      {hasGraph ? (
        // ── Premium: mini graph on top, score at the bottom ──────────────────
        <View style={s.graphWrap}>
          <EnergySparkline data={timeline!} width={innerW} color={color} isDark={colors.isDark} />
          <Text style={[s.batteryScore, { color, marginTop: 'auto' }]}>{score}%</Text>
        </View>
      ) : (
        // ── No timeline yet, or locked: fall back to the battery ─────────────
        <View style={s.batteryWrap}>
          <View style={s.batteryRow}>
            <View style={[s.batteryBody, { borderColor: w(0.2) }, !showData && { alignItems: 'center', justifyContent: 'center' }]}>
              {showData
                ? <View style={{ height: '100%', width: pctStr(score / 100), backgroundColor: color }} />
                : <Lock size={18} color={w(0.3)} />}
            </View>
            <View style={[s.batteryCap, { backgroundColor: w(0.25) }]} />
          </View>
          <Text style={[s.batteryScore, { color: showData ? color : w(0.3) }]}>
            {showData ? `${score}%` : '—'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

export function FocusEnergyRow({ energy, focuses: _focuses }: {
  energy: { result: EnergyBankResult; phase: string; timeline?: EnergyTimelinePoint[] } | null;
  focuses?: FocusItem[];
}) {
  const { width } = useWindowDimensions();
  const SIDE = 20;
  const GAP = 12;
  const halfW = (width - SIDE * 2 - GAP) / 2;

  return (
    <View style={{ flexDirection: 'row', gap: GAP, marginBottom: 16 }}>
      <TodayFocusTile width={halfW} />
      <EnergyTile width={halfW} result={energy?.result ?? null} timeline={energy?.timeline} />
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    tile: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingTop: 16,
      paddingBottom: 18,
      paddingHorizontal: 16,
      minHeight: 196,
    },
    tileHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    tileTitle: { fontSize: 21, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.5, lineHeight: 24 },

    // Focus horizontal bars
    barList: { marginTop: 'auto', paddingTop: 14, gap: 12 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    metricIcon: { width: 22, height: 22 },
    track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
    barPct: { minWidth: 42, textAlign: 'right', fontSize: 12, fontWeight: '700', fontFamily: FF, letterSpacing: -0.2 },

    // Energy mini graph (top) + score (bottom)
    graphWrap: { flex: 1, justifyContent: 'flex-start', paddingTop: 14 },

    // Energy horizontal battery
    batteryWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 12 },
    batteryRow: { flexDirection: 'row', alignItems: 'center' },
    batteryBody: {
      width: 104, height: 38, borderRadius: 12, borderWidth: 2.5,
      overflow: 'hidden', flexDirection: 'row', alignItems: 'stretch',
    },
    batteryCap: { width: 5, height: 15, borderRadius: 2, marginLeft: 2 },
    batteryScore: { fontSize: 30, fontWeight: '800', fontFamily: FF, letterSpacing: -0.5 },
  });
};
