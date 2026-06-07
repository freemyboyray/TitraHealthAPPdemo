import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Beef, Droplet, Wheat, Footprints, Moon, ChevronRight, Lock } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useLifestyleMetrics } from '@/hooks/use-lifestyle-metrics';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useSubscriptionStore } from '@/stores/subscription-store';
import type { EnergyBankResult, FocusItem } from '@/constants/scoring';

const FF = 'System';

type Metrics = ReturnType<typeof useLifestyleMetrics>;

type MetricDef = {
  id: string;
  color: string;
  icon: (c: string) => React.ReactNode;
  build: (m: Metrics) => { pct: number; locked: boolean };
};

const METRICS: MetricDef[] = [
  {
    id: 'protein', color: '#E0533A', icon: (c) => <Beef size={16} color={c} />,
    build: (m) => ({ pct: (m.targets.proteinG || 0) > 0 ? m.todayProteinG / m.targets.proteinG : 0, locked: false }),
  },
  {
    id: 'water', color: '#2BA7E0', icon: (c) => <Droplet size={16} color={c} />,
    build: (m) => ({ pct: m.waterTargetOz > 0 ? m.waterOz / m.waterTargetOz : 0, locked: false }),
  },
  {
    id: 'fiber', color: '#3AAE5A', icon: (c) => <Wheat size={16} color={c} />,
    build: (m) => ({ pct: (m.targets.fiberG || 0) > 0 ? m.todayFiberG / m.targets.fiberG : 0, locked: false }),
  },
  {
    id: 'activity', color: '#F5972A', icon: (c) => <Footprints size={16} color={c} />,
    build: (m) => ({
      pct: (m.targets.steps || 0) > 0 ? m.todaySteps / m.targets.steps : 0,
      locked: !m.appleHealthEnabled && m.todaySteps === 0,
    }),
  },
  {
    id: 'sleep', color: '#6E73E0', icon: (c) => <Moon size={16} color={c} />,
    build: (m) => ({
      pct: m.hkStore.sleepHours != null ? m.hkStore.sleepHours / 8 : 0,
      locked: m.hkStore.sleepHours == null,
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
  const enabledIds = usePreferencesStore((st) => st.homeFocusTiles);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  const metrics = useMemo(() => METRICS.filter((x) => enabledIds.includes(x.id)), [enabledIds]);

  return (
    <Pressable
      style={[s.tile, { width }]}
      onPress={() => router.push('/daily-focus' as any)}
      accessibilityLabel="Today's Focus. View details."
      accessibilityRole="button"
    >
      <View style={s.tileHead}>
        <Text style={s.tileTitle}>Today's{'\n'}Focus</Text>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>

      <View style={s.barList}>
        {metrics.map((mt) => {
          const { pct, locked } = mt.build(m);
          return (
            <View key={mt.id} style={s.barRow}>
              {mt.icon(locked ? w(0.35) : mt.color)}
              <View style={[s.track, { backgroundColor: w(0.07) }]}>
                {!locked && <View style={{ height: '100%', width: pctStr(pct), backgroundColor: mt.color, opacity: 0.92, borderRadius: 5 }} />}
              </View>
              {locked && <Lock size={12} color={w(0.35)} />}
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

function EnergyTile({ width, result }: { width: number; result: EnergyBankResult | null }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const isPremium = useSubscriptionStore((st) => st.isPremium);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  const score = result?.score ?? 0;
  const color = energyColor(score);
  const showData = isPremium && result != null;

  return (
    <Pressable
      style={[s.tile, { width }]}
      onPress={() => router.push((isPremium ? '/energy-detail' : '/upgrade') as any)}
      accessibilityLabel={showData ? `Energy ${score} percent` : 'Energy Bank, premium feature'}
      accessibilityRole="button"
    >
      <View style={s.tileHead}>
        <Text style={s.tileTitle}>Energy</Text>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>

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
    </Pressable>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

export function FocusEnergyRow({ energy, focuses: _focuses }: {
  energy: { result: EnergyBankResult; phase: string } | null;
  focuses?: FocusItem[];
}) {
  const { width } = useWindowDimensions();
  const SIDE = 20;
  const GAP = 12;
  const halfW = (width - SIDE * 2 - GAP) / 2;

  return (
    <View style={{ flexDirection: 'row', gap: GAP, marginBottom: 16 }}>
      <TodayFocusTile width={halfW} />
      <EnergyTile width={halfW} result={energy?.result ?? null} />
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
    track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },

    // Energy horizontal battery
    batteryWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 12 },
    batteryRow: { flexDirection: 'row', alignItems: 'center' },
    batteryBody: {
      width: 104, height: 38, borderRadius: 12, borderWidth: 2.5,
      overflow: 'hidden', flexDirection: 'row', alignItems: 'stretch',
    },
    batteryCap: { width: 5, height: 15, borderRadius: 2, marginLeft: 2 },
    batteryScore: { fontSize: 24, fontWeight: '800', fontFamily: FF, letterSpacing: -0.5 },
  });
};
