import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check, Plus, Lock, Moon } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/contexts/theme-context';
import { HEALTH_SERVICE_NAME } from '@/lib/health-service';
import type { AppColors } from '@/constants/theme';
import { useLifestyleMetrics } from '@/hooks/use-lifestyle-metrics';
import { WaterLogSheet } from '@/components/water-log-sheet';

const FF = 'System';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Metric registry (per-metric color identity — matches DESIGN.md + home tile) ─

type Metrics = ReturnType<typeof useLifestyleMetrics>;
type MetricData = { pct: number; valueText: string; subText: string; locked: boolean };

type MetricDef = {
  id: string;
  label: string;
  color: string;
  section: 'eat' | 'move' | 'rest';
  /** Illustrated icon (preferred). */
  image?: ImageSourcePropType;
  /** Fallback Lucide icon when no illustration exists (e.g. sleep). */
  icon?: (c: string, size?: number) => React.ReactNode;
  build: (m: Metrics) => MetricData;
};

function fmtSleep(hrs: number): string {
  const h = Math.floor(hrs);
  const mn = Math.round((hrs - h) * 60);
  return mn > 0 ? `${h}h ${mn}m` : `${h}h`;
}

const METRICS: MetricDef[] = [
  {
    id: 'protein', label: 'Protein', color: '#E0533A', section: 'eat',
    image: require('@/assets/images/focus/protein.png'),
    build: (m) => {
      const t = m.targets.proteinG || 0;
      return { pct: t > 0 ? m.todayProteinG / t : 0, valueText: `${m.todayProteinG}g`, subText: t ? `of ${t}g` : '', locked: false };
    },
  },
  {
    id: 'water', label: 'Hydration', color: '#2BA7E0', section: 'eat',
    image: require('@/assets/images/focus/water.png'),
    build: (m) => ({
      pct: m.waterTargetOz > 0 ? m.waterOz / m.waterTargetOz : 0,
      valueText: `${m.waterOz}oz`, subText: m.waterTargetOz ? `of ${m.waterTargetOz}oz` : '', locked: false,
    }),
  },
  {
    id: 'fiber', label: 'Fiber', color: '#3AAE5A', section: 'eat',
    image: require('@/assets/images/focus/fiber.png'),
    build: (m) => {
      const t = m.targets.fiberG || 0;
      return { pct: t > 0 ? m.todayFiberG / t : 0, valueText: `${m.todayFiberG}g`, subText: t ? `of ${t}g` : '', locked: false };
    },
  },
  {
    id: 'activity', label: 'Steps', color: '#F5972A', section: 'move',
    image: require('@/assets/images/focus/steps.png'),
    build: (m) => {
      const t = m.targets.steps || 0;
      return {
        pct: t > 0 ? m.todaySteps / t : 0,
        valueText: m.todaySteps.toLocaleString(), subText: t ? `of ${t.toLocaleString()}` : '',
        locked: !m.appleHealthEnabled && m.todaySteps === 0,
      };
    },
  },
  {
    id: 'sleep', label: 'Sleep', color: '#6E73E0', section: 'rest',
    icon: (c, s = 18) => <Moon size={s} color={c} />,
    build: (m) => {
      const hrs = m.hkStore.sleepHours;
      return {
        pct: hrs != null ? hrs / 8 : 0,
        valueText: hrs != null ? fmtSleep(hrs) : '—',
        subText: hrs != null ? 'of 8h' : `Connect ${HEALTH_SERVICE_NAME}`,
        locked: hrs == null,
      };
    },
  },
];

const SECTIONS: { key: 'eat' | 'move' | 'rest'; label: string }[] = [
  { key: 'eat', label: 'Eat' },
  { key: 'move', label: 'Move' },
  { key: 'rest', label: 'Rest' },
];

function statusLabel(d: MetricData): string {
  if (d.locked) return 'No data yet';
  if (d.pct >= 1.15) return 'Above typical';
  if (d.pct >= 0.95) return 'Goal reached';
  if (d.pct >= 0.6) return 'On track';
  if (d.pct >= 0.3) return 'Below typical';
  return 'Just getting started';
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function Ring({ pct, color, done, locked, colors }: {
  pct: number; color: string; done: boolean; locked: boolean; colors: AppColors;
}) {
  const SIZE = 72, SW = 7;
  const R = (SIZE - SW) / 2;
  const C = 2 * Math.PI * R;
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const target = Math.max(0, Math.min(1, pct));
  const v = useSharedValue(0);
  useEffect(() => { v.value = withTiming(locked ? 0 : target, { duration: 900, easing: Easing.out(Easing.cubic) }); }, [target, locked]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - v.value) }));
  const gid = `ring-${color}`;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2={SIZE} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={color} stopOpacity="0.7" />
          </LinearGradient>
        </Defs>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={w(0.08)} strokeWidth={SW} fill="none" />
        {!locked && (
          <AnimatedCircle
            cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
            stroke={done ? '#4CAF50' : `url(#${gid})`} strokeWidth={SW} strokeLinecap="round"
            strokeDasharray={`${C} ${C}`} animatedProps={arc}
            rotation="-90" origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        )}
      </Svg>
      <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }}>
        {locked ? <Lock size={18} color={w(0.3)} />
          : done ? <Check size={22} color="#4CAF50" strokeWidth={3} />
          : <Text style={{ fontSize: 16, fontWeight: '800', color, fontFamily: FF }}>{Math.round(target * 100)}%</Text>}
      </View>
    </View>
  );
}

// ─── Metric card ────────────────────────────────────────────────────────────

function MetricCard({ def, data, onLog, colors }: {
  def: MetricDef; data: MetricData; onLog: (id: string, locked: boolean) => void; colors: AppColors;
}) {
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const done = !data.locked && data.pct >= 1;

  return (
    <Pressable
      style={[s.card, data.locked && { opacity: 0.5 }]}
      onPress={() => onLog(def.id, data.locked)}
      accessibilityLabel={`${def.label}, ${statusLabel(data)}, ${data.valueText}`}
      accessibilityRole="button"
    >
      <Ring pct={data.pct} color={def.color} done={done} locked={data.locked} colors={colors} />

      <View style={{ flex: 1, marginLeft: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          {def.image
            ? <Image source={def.image} style={{ width: 20, height: 20 }} resizeMode="contain" accessibilityIgnoresInvertColors />
            : def.icon?.(def.color, 16)}
          <Text style={s.cardLabel}>{def.label}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
          <Text style={[s.cardValue, { color: data.locked ? w(0.3) : colors.textPrimary }]}>{data.valueText}</Text>
          {!!data.subText && <Text style={s.cardSub}>{data.subText}</Text>}
        </View>
        <Text style={[s.cardStatus, { color: data.locked ? w(0.4) : def.color }]}>{statusLabel(data)}</Text>
      </View>

      <View style={[s.logBtn, { backgroundColor: data.locked ? w(0.06) : def.color + '1A' }]}>
        <Plus size={20} color={data.locked ? w(0.35) : def.color} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function DailyFocusScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const m = useLifestyleMetrics();
  const [waterLogVisible, setWaterLogVisible] = useState(false);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  // Detail page is the full view — show every focus (Eat/Move/Rest), regardless of
  // which tiles the user chose to surface on the home tile.
  const built = useMemo(() => METRICS.map((def) => ({ def, data: def.build(m) })), [m]);

  const onTrack = built.filter(({ data }) => !data.locked && data.pct >= 0.6).length;
  const total = built.length;

  const handleLog = useCallback((id: string, locked: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (locked) { router.push('/settings/apple-health' as any); return; }
    if (id === 'water') { setWaterLogVisible(true); return; }
    const routes: Record<string, string> = {
      protein: '/entry/log-food', fiber: '/entry/log-food', activity: '/entry/log-activity',
    };
    if (routes[id]) router.push(routes[id] as any);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar — back + centered title (matches the Energy Bank header) */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backBtn} accessibilityLabel="Back" accessibilityRole="button">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Today's Focus</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro — what this is + what you get out of it */}
        <Text style={s.intro}>
          These are the daily habits that help you lose fat, protect muscle, and feel steadier while
          you're on a GLP-1. Tap any card to log toward its target.
        </Text>
        <Text style={s.introStatus}>
          {total > 0 ? `${onTrack} of ${total} on track today` : 'No focuses selected'}
        </Text>

        {/* Sections */}
        <View style={{ marginTop: 22 }}>
          {SECTIONS.map(({ key, label }) => {
            const items = built.filter(({ def }) => def.section === key);
            if (items.length === 0) return null;
            return (
              <View key={key} style={{ marginBottom: 22 }}>
                <Text style={s.sectionHeader}>{label}</Text>
                <View style={{ gap: 12 }}>
                  {items.map(({ def, data }) => (
                    <MetricCard key={def.id} def={def} data={data} onLog={handleLog} colors={colors} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <WaterLogSheet visible={waterLogVisible} onClose={() => setWaterLogVisible(false)} />
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
    intro: { fontSize: 14.5, color: w(0.55), fontFamily: FF, lineHeight: 21, marginTop: 4 },
    introStatus: { fontSize: 13, fontWeight: '600', color: w(0.4), fontFamily: FF, marginTop: 10 },
    sectionHeader: { fontSize: 22, fontWeight: '700', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.3, marginBottom: 12 },
    card: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: 24,
      borderWidth: 0.5, borderColor: c.border,
      paddingVertical: 16, paddingHorizontal: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: c.isDark ? 0.18 : 0.08, shadowRadius: 14, elevation: 4,
    },
    cardLabel: { fontSize: 17, fontWeight: '700', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.2 },
    cardValue: { fontSize: 24, fontWeight: '800', fontFamily: FF, letterSpacing: -0.5 },
    cardSub: { fontSize: 13, fontWeight: '500', color: w(0.4), fontFamily: FF },
    cardStatus: { fontSize: 13, fontWeight: '600', fontFamily: FF, marginTop: 2 },
    logBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  });
};
