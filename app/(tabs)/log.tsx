import { FontAwesome5, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, ActivityIndicator, Animated, LayoutAnimation, LayoutChangeEvent, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';
import { useHealthData } from '@/contexts/health-data';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useInsightsAiStore } from '@/stores/insights-ai-store';
import { generatePkCurveHighRes, generateIntradayPkCurve, pkCycleLabels, pkConcentrationPct, DRUG_HALF_LIFE_LABEL, DRUG_DEFAULT_FREQ_DAYS, DRUG_IS_ORAL, INTRADAY_TIME_LABELS, isOralDrug, doseNoun, doseIconName } from '@/constants/drug-pk';
import { BRAND_DISPLAY_NAMES, isOnTreatment } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useLogStore, type WeightLog, type InjectionLog, type FoodLog, type ActivityLog, type SideEffectLog } from '@/stores/log-store';
import { computeWeightProjection, type WeightProjection } from '@/lib/weight-projection';
import { localDateStr } from '@/lib/date-utils';
import { useUiStore } from '@/stores/ui-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useBiometricStore } from '@/stores/biometric-store';
import { getShotPhase, type DailyTargets } from '@/constants/scoring';
import {
  computeCycleIntelligence,
  computeMetabolicAdaptationScore,
  buildCycleBiometricContext,
} from '@/lib/cycle-intelligence';
import { CycleBiometricCard } from '@/components/cycle-biometric-card';
import { MetabolicAdaptationCard } from '@/components/metabolic-adaptation-card';
import { ClinicalBenchmarkCard } from '@/components/clinical-benchmark-card';
import { PeerComparisonCard } from '@/components/peer-comparison-card';
import { computeClinicalBenchmark } from '@/stores/insights-store';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import { WeeklyCheckinCard } from '@/components/weekly-checkin-card';
import { GestureDetector } from 'react-native-gesture-handler';
import { useAnimatedReaction, runOnJS as reanimatedRunOnJS } from 'react-native-reanimated';
import { useChartScrub } from '@/hooks/useChartScrub';
import { ChartScrubOverlay } from '@/components/chart-scrub-overlay';
import { smoothPath, niceYTicks } from '@/lib/chart-utils';

const ORANGE = '#FF742A';

// ─── Health Monitor types + helpers ──────────────────────────────────────────

type HMStatus = 'good' | 'normal' | 'low' | 'elevated';
type HealthMetric = {
  id: string; label: string; value: string; unit: string;
  status: HMStatus; iconName: string; iconSet: 'Ionicons' | 'MaterialIcons'; rangeLabel: string;
  gaugePosition: number | null;
};
function hmRhrStatus(bpm: number): HMStatus { return bpm < 55 ? 'good' : bpm < 70 ? 'normal' : 'elevated'; }
function hmRhrLabel(bpm: number): string { return bpm < 55 ? 'Optimal' : bpm < 70 ? 'Normal' : 'Elevated'; }
function hmHrvStatus(ms: number): HMStatus { return ms >= 50 ? 'good' : ms >= 30 ? 'normal' : 'low'; }
function hmHrvLabel(ms: number): string { return ms >= 50 ? 'Strong' : ms >= 30 ? 'Normal' : 'Low'; }
function hmSleepStatus(min: number): HMStatus { return min >= 420 ? 'good' : min >= 360 ? 'normal' : 'low'; }
function hmSleepLabel(min: number): string { return min >= 420 ? 'On Target' : min >= 360 ? 'Normal' : 'Below Goal'; }
function fmtSleep(min: number): string { return `${Math.floor(min / 60)}h ${min % 60}m`; }
const hmStatusStyle: Record<HMStatus, { bg: string; text: string }> = {
  good:     { bg: 'rgba(39,174,96,0.15)',   text: '#27AE60' },
  normal:   { bg: 'rgba(91,139,245,0.15)',  text: '#7BA3F7' },
  low:      { bg: 'rgba(243,156,18,0.15)',  text: '#F39C12' },
  elevated: { bg: 'rgba(231,76,60,0.15)',   text: '#E74C3C' },
};
function hmGaugePos(id: string, rawVal: number | null): number | null {
  if (rawVal == null) return null;
  const c = (v: number) => Math.max(0, Math.min(1, v));
  switch (id) {
    case 'rhr':     return c(1 - (rawVal - 40) / 55);        // 40-95 bpm, lower = top
    case 'hrv':     return c((rawVal - 15) / 85);             // 15-100 ms, higher = top
    case 'sleep':   return c((rawVal - 240) / 360);           // 4h-10h, higher = top
    case 'spo2':    return c((rawVal - 88) / 12);             // 88-100%, higher = top
    case 'temp':    return c(1 - Math.abs(rawVal - 98.6) / 3); // optimal at 98.6°F
    case 'glucose': return c(1 - (rawVal - 70) / 80);        // 70-150, lower = top
    default:        return 0.5;
  }
}
const GAUGE_TRACK_H = 76;
const GAUGE_TRACK_W = 5;
const GAUGE_THUMB_D = 14;
function GaugeBar({ position, color }: { position: number | null; color: string }) {
  const availH = GAUGE_TRACK_H - GAUGE_THUMB_D;
  const thumbTop = position != null ? (1 - position) * availH : null;
  const fillH    = position != null ? GAUGE_TRACK_H - (thumbTop! + GAUGE_THUMB_D / 2) : 0;
  return (
    <View style={{ width: GAUGE_THUMB_D, height: GAUGE_TRACK_H, alignItems: 'center' }}>
      {/* Track background */}
      <View style={{
        position: 'absolute', top: 0,
        width: GAUGE_TRACK_W, height: GAUGE_TRACK_H,
        borderRadius: GAUGE_TRACK_W / 2,
        backgroundColor: position != null ? `${color}28` : 'rgba(120,120,120,0.18)',
      }} />
      {/* Filled portion (bottom up to thumb center) */}
      {position != null && fillH > 0 && (
        <View style={{
          position: 'absolute', bottom: 0,
          width: GAUGE_TRACK_W, height: fillH,
          borderRadius: GAUGE_TRACK_W / 2,
          backgroundColor: color,
        }} />
      )}
      {/* Thumb */}
      {position != null && (
        <View style={{
          position: 'absolute',
          top: thumbTop!,
          width: GAUGE_THUMB_D, height: GAUGE_THUMB_D,
          borderRadius: GAUGE_THUMB_D / 2,
          backgroundColor: '#FFFFFF',
          borderWidth: 2.5,
          borderColor: color,
        }} />
      )}
    </View>
  );
}
function HealthMonitorCard({ metric, fullWidth }: { metric: HealthMetric; fullWidth?: boolean }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const ss = hmStatusStyle[metric.status];
  const icon = metric.iconSet === 'Ionicons'
    ? <Ionicons name={metric.iconName as any} size={16} color={colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'} />
    : <MaterialIcons name={metric.iconName as any} size={16} color={colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'} />;
  const { openAiChat } = useUiStore();
  const contextValue = `${metric.value}${metric.unit ? ' ' + metric.unit : ''} · ${metric.rangeLabel}`;
  return (
    <Pressable style={[s.hmWrap, fullWidth && { width: '100%' }]} onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openAiChat({ type: 'metric', contextLabel: metric.label, contextValue, chips: JSON.stringify(['How can I improve this?', 'Is this normal for my phase?', `How does GLP-1 affect ${metric.label}?`, 'What trends should I watch?']) }); }}>
      <View style={[s.hmBody, { borderRadius: 20, backgroundColor: colors.surface }]}>
        <View style={[s.hmInner, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
          {/* Left: content */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              {icon}
              <Text style={[s.hmLabel, { marginBottom: 0 }]}>{metric.label}</Text>
            </View>
            <Text style={s.hmValue}>{metric.value}{metric.unit ? <Text style={s.hmUnit}> {metric.unit}</Text> : null}</Text>
            <View style={[s.hmBadge, { backgroundColor: ss.bg, alignSelf: 'flex-start', marginTop: 8 }]}>
              <Text style={[s.hmBadgeText, { color: ss.text }]}>{metric.rangeLabel}</Text>
            </View>
          </View>
          {/* Right: gauge bar */}
          <GaugeBar position={metric.gaugePosition} color={ss.text} />
        </View>
      </View>
    </Pressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SITE_ROTATION = [
  'Left Abdomen', 'Right Abdomen',
  'Left Thigh', 'Right Thigh',
  'Left Upper Arm', 'Right Upper Arm',
];

function nextSite(current: string | null): string {
  if (!current) return '-';
  const idx = SITE_ROTATION.indexOf(current);
  return idx === -1 ? SITE_ROTATION[0] : SITE_ROTATION[(idx + 1) % SITE_ROTATION.length];
}

function fmtDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  const day = d.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st'
    : day % 10 === 2 && day !== 12 ? 'nd'
    : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  return `${month} ${day}${suffix}`;
}

function fmtDateOnly(dateStr: string): string {
  const today = localDateStr();
  if (dateStr === today) return 'Today';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function nextInjectionLabel(injectionDate: string | null | undefined, freqDays = 7): string {
  if (!injectionDate) return '-';
  const injMs = new Date(injectionDate + 'T00:00:00').getTime();
  if (isNaN(injMs)) return '-';
  const nextMs = injMs + freqDays * 86400000;
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const daysLeft = Math.round((nextMs - todayMs) / 86400000);
  if (isNaN(daysLeft) || daysLeft < -365 || daysLeft > 365) return '-';
  if (daysLeft <= 0) return 'Today';
  if (daysLeft === 1) return 'Tomorrow';
  return `In ${daysLeft} Days`;
}

function computeBMI(weightLbs: number, heightInches: number): number {
  if (!heightInches) return 0;
  return Math.round((weightLbs / (heightInches * heightInches)) * 703 * 10) / 10;
}

function goalProgress(start: number, current: number, goal: number): number {
  if (start <= goal) return 0;
  return Math.max(0, Math.min(100, Math.round(((start - current) / (start - goal)) * 100)));
}


function last7DayLabels(): string[] {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const todayIdx = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => days[(todayIdx - 6 + i + 7) % 7]);
}

type WeightPoint = { weight: number; date: string };

function weightDataForPeriod(logs: WeightLog[], period: '7D' | '14D' | '30D' | '90D' | 'MAX'): WeightPoint[] {
  if (period === 'MAX') {
    const sorted = [...logs]
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
      .map(l => ({ weight: l.weight_lbs, date: l.logged_at }));
    return sorted.length >= 2 ? sorted : [];
  }
  const days = { '7D': 7, '14D': 14, '30D': 30, '90D': 90 }[period];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const filtered = logs
    .filter(l => l.logged_at >= since)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    .map(l => ({ weight: l.weight_lbs, date: l.logged_at }));
  return filtered.length >= 2 ? filtered : [];
}

// smoothPath and niceYTicks imported from @/lib/chart-utils

function xAxisLabels(data: WeightPoint[], period: string, plotW: number): { x: number; label: string }[] {
  if (data.length < 2) return [];
  const maxLabels = 5;
  const step = Math.max(1, Math.floor((data.length - 1) / (maxLabels - 1)));
  const indices: number[] = [];
  for (let i = 0; i < data.length; i += step) indices.push(i);
  if (indices[indices.length - 1] !== data.length - 1) indices.push(data.length - 1);

  return indices.map(i => {
    const d = new Date(data[i].date);
    let label: string;
    if (period === 'MAX') {
      label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    } else if (period === '7D' || period === '14D') {
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    const x = (plotW / (data.length - 1)) * i;
    return { x, label };
  });
}

// ─── Lifestyle Trend helpers ──────────────────────────────────────────────────

type FoodByDate = Record<string, { protein: number; carbs: number; fat: number; calories: number; fiber: number }>;
type ActivityByDate = Record<string, { steps: number; calories: number }>;

type MetricConfig = {
  id: string;
  label: string;
  unit: string;
  color: string;
  getTarget: (t: DailyTargets) => number;
  getValue: (f: FoodByDate, a: ActivityByDate, d: string) => number | null;
};

const LIFESTYLE_METRICS: MetricConfig[] = [
  { id: 'protein',    label: 'Protein',    unit: 'g',     color: '#FF742A', getTarget: t => t.proteinG,             getValue: (f, _, d) => f[d]?.protein ?? null },
  { id: 'carbs',      label: 'Carbs',      unit: 'g',     color: '#5B8BF5', getTarget: t => t.carbsG,               getValue: (f, _, d) => f[d]?.carbs ?? null },
  { id: 'fat',        label: 'Fat',        unit: 'g',     color: '#F6CB45', getTarget: t => t.fatG,                 getValue: (f, _, d) => f[d]?.fat ?? null },
  { id: 'fiber',      label: 'Fiber',      unit: 'g',     color: '#27AE60', getTarget: t => t.fiberG,               getValue: (f, _, d) => f[d]?.fiber ?? null },
  { id: 'calories',   label: 'Calories',   unit: 'kcal',  color: '#C084FC', getTarget: t => t.caloriesTarget,       getValue: (f, _, d) => f[d]?.calories ?? null },
  { id: 'steps',      label: 'Steps',      unit: 'steps', color: '#FF742A', getTarget: t => t.steps,                getValue: (_, a, d) => a[d]?.steps ?? null },
  { id: 'active_cal', label: 'Active Cal', unit: 'kcal',  color: '#5B8BF5', getTarget: t => t.activeCaloriesTarget, getValue: (_, a, d) => a[d]?.calories ?? null },
];

const LT_TML = 44, LT_TMR = 12, LT_TMT = 10, LT_TMB = 24;
const LT_COMPACT_H = 110;
const LT_EXP_H = 220;
const LT_PERIODS: { label: string; days: number }[] = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'MAX', days: -1 },
];

function ltComputeChart(
  values: (number | null)[],
  target: number,
  chartH: number,
  plotW: number,
): {
  linePath: string; areaPath: string; goalY: number;
  pts: { x: number; y: number; valid: boolean }[];
  yTicks: number[]; minVal: number; maxVal: number;
} {
  if (plotW <= 0 || values.length === 0)
    return { linePath: '', areaPath: '', goalY: 0, pts: [], yTicks: [], minVal: 0, maxVal: 0 };

  const nonNull = values.filter(v => v !== null) as number[];
  if (nonNull.length === 0)
    return { linePath: '', areaPath: '', goalY: 0, pts: [], yTicks: [], minVal: 0, maxVal: 0 };

  const rawMax = Math.max(...nonNull, target * 1.05);
  const pad = Math.max(rawMax * 0.08, 1);
  const minVal = 0;
  const maxVal = rawMax + pad;
  const yRange = maxVal - minVal || 1;

  const plotH = chartH - LT_TMT - LT_TMB;
  const xStep = plotW / Math.max(values.length - 1, 1);

  const toY = (v: number) => LT_TMT + plotH * (1 - (v - minVal) / yRange);
  const goalY = Math.max(LT_TMT, Math.min(LT_TMT + plotH, toY(target)));

  const pts = values.map((v, i) => ({
    x: LT_TML + xStep * i,
    y: v !== null ? toY(v) : LT_TMT + plotH / 2,
    valid: v !== null,
  }));

  const allValid = pts.filter(p => p.valid);
  // Connect all valid points into one continuous line (skip null gaps between logged days)
  const linePath = smoothPath(allValid.map(p => ({ x: p.x, y: p.y })));

  // Guard: only produce areaPath when linePath starts with M (valid SVG), never a bare L
  const areaPath = linePath && allValid.length >= 2
    ? `${linePath} L ${allValid[allValid.length - 1].x.toFixed(1)} ${(LT_TMT + plotH).toFixed(1)} L ${allValid[0].x.toFixed(1)} ${(LT_TMT + plotH).toFixed(1)} Z`
    : '';

  const yTicks = niceYTicks(minVal, maxVal, 4);

  return { linePath, areaPath, goalY, pts, yTicks, minVal, maxVal };
}

function ltXLabels(dates: string[], plotW: number, periodDays: number): { x: number; label: string }[] {
  if (dates.length < 2 || plotW <= 0) return [];
  const maxL = periodDays <= 7 ? 7 : periodDays <= 14 ? 7 : 5;
  const step = Math.max(1, Math.ceil((dates.length - 1) / (maxL - 1)));
  const indices: number[] = [];
  for (let i = 0; i < dates.length; i += step) indices.push(i);
  if (indices[indices.length - 1] !== dates.length - 1) indices.push(dates.length - 1);
  const xStep = plotW / Math.max(dates.length - 1, 1);
  return indices.map(i => {
    const d = new Date(dates[i] + 'T12:00:00');
    const label = periodDays <= 7
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
      : `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
    return { x: LT_TML + xStep * i, label };
  });
}

const ORANGE_LOG = '#FF742A';

function activityIcon(exerciseType: string | null | undefined): React.ReactNode {
  const t = (exerciseType ?? '').toLowerCase();
  let name: React.ComponentProps<typeof MaterialIcons>['name'] = 'flash-on';
  if (t.includes('run') || t.includes('jog'))      name = 'directions-run';
  else if (t.includes('walk'))                      name = 'directions-walk';
  else if (t.includes('cycl') || t.includes('bike')) name = 'directions-bike';
  else if (t.includes('swim'))                      name = 'pool';
  else if (t.includes('yoga') || t.includes('stretch')) name = 'self-improvement';
  else if (t.includes('strength') || t.includes('weight') || t.includes('lift')) name = 'fitness-center';
  else if (t.includes('hike'))                      name = 'terrain';
  else if (t.includes('dance'))                     name = 'music-note';
  else if (t.includes('sport') || t.includes('tennis') || t.includes('basketball') || t.includes('soccer')) name = 'sports';
  return <MaterialIcons name={name} size={20} color={ORANGE_LOG} />;
}

function foodToEntry(f: FoodLog): LogEntry {
  const details = `${Math.round(f.calories)} cal · ${Math.round(f.protein_g)}g protein · ${Math.round(f.fiber_g)}g fiber · ${Math.round(f.carbs_g)}g carbs`;
  const impact = `+${Math.round(f.protein_g)}g protein, +${Math.round(f.carbs_g)}g carbs, +${Math.round(f.fiber_g)}g fiber`;
  return {
    id: f.id, timestamp: fmtDateTime(f.logged_at), title: f.food_name,
    details, impact, impactStatus: 'positive',
    icon: <MaterialIcons name="restaurant" size={20} color={ORANGE_LOG} />,
  };
}

function activityToEntry(a: ActivityLog): LogEntry {
  const durationStr = a.duration_min ? `${a.duration_min} min` : '';
  const stepsStr = a.steps ? `${a.steps.toLocaleString()} steps` : '';
  const calStr = a.active_calories ? `${a.active_calories} cal burned` : '';
  const details = [durationStr, stepsStr, calStr].filter(Boolean).join(' · ') || 'Activity logged';
  const impact = `Steps ${a.steps ? `+${a.steps.toLocaleString()}` : '-'} · Calories ${a.active_calories ? `+${a.active_calories}` : '-'}`;
  return {
    id: a.id, timestamp: fmtDateOnly(a.date), title: a.exercise_type ?? 'Activity',
    details, impact, impactStatus: 'positive',
    icon: activityIcon(a.exercise_type),
  };
}

function injectionToEntry(inj: InjectionLog, oral = false): LogEntry {
  const medName = inj.medication_name ?? (oral ? 'Dose' : 'Injection');
  const batchStr = inj.batch_number ? ` · Batch #${inj.batch_number}` : '';
  const siteStr = !oral && inj.site ? `Site: ${inj.site} · ` : '';
  const details = `${siteStr}Dose: ${inj.dose_mg}mg${batchStr}`;
  const next = nextSite(inj.site ?? null);
  const impact = oral
    ? `Next ${doseNoun(true)} in 1 day`
    : `Next injection in 7 days - rotate to ${next}`;
  return {
    id: inj.id, timestamp: fmtDateOnly(inj.injection_date),
    title: `${medName} ${inj.dose_mg}mg`,
    details, impact, impactStatus: 'neutral',
    icon: <FontAwesome5 name={doseIconName(oral)} size={18} color={ORANGE_LOG} />,
  };
}

function weightToEntry(log: WeightLog, prevLog?: WeightLog): LogEntry {
  const delta = prevLog ? Math.round((log.weight_lbs - prevLog.weight_lbs) * 10) / 10 : 0;
  const deltaStr = delta < 0 ? `Down ${Math.abs(delta)} lbs` : delta > 0 ? `Up ${delta} lbs` : 'Steady';
  return {
    id: log.id, timestamp: fmtDateTime(log.logged_at),
    title: `Weight Log - ${log.weight_lbs} lbs`,
    details: `${log.weight_lbs} lbs · ${deltaStr} from last entry`,
    impact: delta <= 0 ? deltaStr : `Up ${Math.abs(delta)} lbs`,
    impactStatus: delta < 0 ? 'positive' : delta > 0 ? 'negative' : 'neutral',
    icon: <MaterialCommunityIcons name="scale" size={20} color={ORANGE_LOG} />,
  };
}

// ─── Segmented control ────────────────────────────────────────────────────────

type Tab = 'medication' | 'lifestyle' | 'progress';

const TABS: { key: Tab; label: string }[] = [
  { key: 'medication', label: 'Medication' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'progress', label: 'Progress' },
];

function SegmentedControl({ active, onChange, colors, tabs }: { active: Tab; onChange: (t: Tab) => void; colors: AppColors; tabs?: typeof TABS }) {
  const sc = useMemo(() => createSegmentedStyles(colors), [colors]);
  const displayTabs = tabs ?? TABS;
  return (
    <View style={sc.wrap}>
      <View style={sc.row}>
        {displayTabs.map(({ key, label }) => {
          const isActive = active === key;
          return (
            <TouchableOpacity
              key={key}
              style={[sc.tab, isActive && sc.tabActive]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(key); }}
              activeOpacity={0.7}
            >
              {isActive && (
                <>
                  <BlurView intensity={30} tint={colors.blurTint} style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]} />
                  <View style={[StyleSheet.absoluteFillObject, sc.tabActiveOverlay]} />
                </>
              )}
              <Text style={[sc.tabLabel, isActive && sc.tabLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const createSegmentedStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: {
      borderRadius: 36, overflow: 'hidden', marginBottom: 24,
      shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
      backgroundColor: c.borderSubtle,
      borderWidth: 0.5, borderColor: c.border,
    },
    overlay: { borderRadius: 36, backgroundColor: c.glassOverlay },
    row: { flexDirection: 'row', padding: 5 },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 28, overflow: 'hidden' },
    tabActive: {},
    tabActiveOverlay: { borderRadius: 28, backgroundColor: 'rgba(255,116,42,0.15)' },
    tabLabel: { fontSize: 13, fontWeight: '600', color: w(0.35), fontFamily: 'Helvetica Neue' },
    tabLabelActive: { color: ORANGE, fontWeight: '700', fontFamily: 'Helvetica Neue' },
  });
};

// ─── Ring indicator ───────────────────────────────────────────────────────────

function RingIndicator({ size = 88, strokeWidth = 7, color = ORANGE }: { size?: number; strokeWidth?: number; color?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, borderWidth: strokeWidth, borderColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }} />
      <View style={{
        position: 'absolute',
        width: size - strokeWidth * 2 + 4, height: size - strokeWidth * 2 + 4,
        borderRadius: (size - strokeWidth * 2 + 4) / 2,
        borderWidth: strokeWidth, borderColor: color,
      }} />
    </View>
  );
}

// ─── Shared AI card renderer ──────────────────────────────────────────────────

function AIInsightsCardShell({ text, loading, onLongPress }: { text: string | null; loading: boolean; onLongPress?: () => void }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={[s.cardWrap, { marginBottom: 16 }]} onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onLongPress?.(); }} disabled={loading || !onLongPress}>
      <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={s.aiContent}>
          <Text style={[s.aiLabel, { color: colors.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: -0.3, textTransform: 'none', marginBottom: 10 }]}>Analysis</Text>
          {loading ? (
            <View style={{ gap: 7 }}>
              <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.borderSubtle, width: '88%' }} />
              <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.borderSubtle, width: '65%' }} />
            </View>
          ) : (
            <Text style={s.aiBody}>{text}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── AI Insights card ─────────────────────────────────────────────────────────

function AIInsightsCard() {
  const text = useInsightsAiStore(s => s.lifestyleText);
  const loading = useInsightsAiStore(s => s.lifestyleLoading);
  const { openAiChat } = useUiStore();
  const handlePress = () => {
    if (!text) return;
    openAiChat({ type: 'insight', contextLabel: 'Lifestyle Insight', contextValue: text.slice(0, 80), chips: JSON.stringify(['Tell me more', 'Give me an action plan', 'What should I prioritize?', 'How does this relate to my medication?']) });
  };
  return <AIInsightsCardShell text={text} loading={loading || text === null} onLongPress={handlePress} />;
}

// ─── Metric card (Calories / Steps) ──────────────────────────────────────────

function MetricCard({ value, label, ringColor, emptyCtaLabel, onEmptyCta }: {
  value: string; label: string; ringColor: string;
  emptyCtaLabel?: string; onEmptyCta?: () => void;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 }), [colors]);
  const { openAiChat } = useUiStore();
  const handleAskAI = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openAiChat({ type: 'metric', contextLabel: label, contextValue: value, chips: JSON.stringify(['Is this on track for my goals?', 'How can I improve this?', 'How does GLP-1 affect this?']) });
  };
  return (
    <Pressable style={[s.metricWrap, glassShadow]} onLongPress={handleAskAI}>
      <View style={[s.cardBody, { borderRadius: 22, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={s.metricInner}>
          <View style={s.ringWrap}>
            <RingIndicator color={ringColor} />
            <View style={s.ringCenter}>
              <Text style={[s.metricValue, { color: ringColor }]}>{value}</Text>
            </View>
          </View>
          <Text style={s.metricLabel}>{label}</Text>
          {value === '-' && emptyCtaLabel && onEmptyCta && (
            <Pressable
              onPress={onEmptyCta}
              style={{ marginTop: 8, backgroundColor: 'rgba(255,116,42,0.10)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: ORANGE, fontFamily: 'Helvetica Neue' }}>
                {emptyCtaLabel}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Activity daily card (fits in dailyGrid, ring replaces icon) ─────────────

function ActivityDailyCard({ value, label, ringColor, emptyCtaLabel, onEmptyCta }: {
  value: string; label: string; ringColor: string;
  emptyCtaLabel?: string; onEmptyCta?: () => void;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 }), [colors]);
  const { openAiChat } = useUiStore();
  const isEmpty = value === '-';

  const handleAskAI = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openAiChat({ type: 'metric', contextLabel: label, contextValue: value,
      chips: JSON.stringify(['Is this on track for my goals?', 'How can I improve this?', 'How does GLP-1 affect this?']) });
  };

  return (
    <Pressable style={[s.dailyWrap, glassShadow]} onLongPress={handleAskAI} delayLongPress={400}>
      <View style={[s.cardBody, { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={s.dailyInner}>
          <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <RingIndicator size={64} strokeWidth={5} color={isEmpty ? (colors.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)') : ringColor} />
            <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: isEmpty ? (colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)') : ringColor, letterSpacing: -0.3, fontFamily: 'Helvetica Neue' }}>
                {isEmpty ? '–' : value}
              </Text>
            </View>
          </View>
          <Text style={s.dailyLabel}>{label}</Text>
          {isEmpty && emptyCtaLabel && onEmptyCta && (
            <Pressable onPress={onEmptyCta} style={{ marginTop: 8, backgroundColor: 'rgba(255,116,42,0.10)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: ORANGE, fontFamily: 'Helvetica Neue' }}>{emptyCtaLabel}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Daily metric card (2×2 grid) ────────────────────────────────────────────

type Status = 'positive' | 'negative' | 'neutral';

type LogEntry = {
  id: string;
  timestamp: string;
  title: string;
  details: string;
  impact: string;
  impactStatus: Status;
  icon: React.ReactElement;
};

const statusStyle: Record<Status, { bg: string; text: string }> = {
  positive: { bg: 'rgba(43,148,80,0.15)', text: '#2B9450' },
  negative: { bg: 'rgba(220,50,50,0.15)', text: '#DC3232' },
  neutral: { bg: 'rgba(150,150,150,0.10)', text: '#9A9490' },
};

function DailyMetricCard({
  icon, label, value, change, status, pct,
}: {
  icon: React.ReactNode; label: string; value: string; change: string; status: Status; pct: number;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 }), [colors]);
  const ss = statusStyle[status];
  const { openAiChat } = useUiStore();
  const handleAskAI = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openAiChat({ type: 'metric', contextLabel: label, contextValue: `${value} · ${change}`, chips: JSON.stringify(['Is this on track?', 'How can I improve this?', `Why is my ${label.toLowerCase()} important on GLP-1?`]) });
  };
  const trackColor = colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  return (
    <Pressable style={[s.dailyWrap, glassShadow]} onLongPress={handleAskAI}>
      <View style={[s.cardBody, { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={s.dailyInner}>
          <View style={s.dailyIconWrap}>{icon}</View>
          <Text style={s.dailyLabel}>{label}</Text>
          <Text style={s.dailyValue}>{value}</Text>
          <View style={{ height: 3, borderRadius: 2, backgroundColor: trackColor, marginTop: 6, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(pct, 1) * 100}%`, height: 3, borderRadius: 2, backgroundColor: ss.text }} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Wearables connect prompt ──────────────────────────────────────────────────

function WearablesConnectPrompt() {
  const { colors } = useAppTheme();
  return (
    <View style={{ borderRadius: 16, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border, padding: 16, gap: 10, marginTop: 8, marginBottom: 8 }}>
      <Text style={{ fontSize: 13, color: colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', lineHeight: 19, fontFamily: 'Helvetica Neue' }}>
        Connect wearables in Settings to unlock deeper insights: resting heart rate, HRV, sleep, and more.
      </Text>
      <Pressable
        onPress={() => router.push('/settings')}
        style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,116,42,0.12)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 }}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: ORANGE, fontFamily: 'Helvetica Neue' }}>
          Go to Settings
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Med AI Insights card ─────────────────────────────────────────────────────

function MedAIInsightsCard() {
  const text = useInsightsAiStore(s => s.medicationText);
  const loading = useInsightsAiStore(s => s.medicationLoading);
  const { openAiChat } = useUiStore();
  const handlePress = () => {
    if (!text) return;
    openAiChat({ type: 'insight', contextLabel: 'Medication Insight', contextValue: text.slice(0, 80), chips: JSON.stringify(['Tell me more', 'When should I take my next dose?', 'What side effects should I watch for?', 'How do I optimize my medication timing?']) });
  };
  return <AIInsightsCardShell text={text} loading={loading || text === null} onLongPress={handlePress} />;
}

// ─── Medication Level Chart card ──────────────────────────────────────────────

const PK_TIER_GUIDE = [
  { label: 'Optimal', range: '75 – 100%', color: '#27AE60', desc: 'Strongest GLP-1 receptor engagement. Appetite suppression is at its peak. Nausea risk is highest in this window, especially in early weeks.' },
  { label: 'Active',  range: '50 – 74%',  color: '#5B8BF5', desc: 'Medication is in its therapeutic range. Appetite control remains strong and nausea typically eases. Most people feel best during this phase.' },
  { label: 'Tapering', range: '30 – 49%', color: '#F6CB45', desc: 'Concentration is declining toward your next dose. Hunger may gradually return. Protein-first meals help maintain momentum.' },
  { label: 'Trough',  range: '0 – 29%',   color: '#9A9490', desc: 'Levels are near trough before your next dose. GLP-1 drugs never drop to zero. Returning appetite is a normal pharmacological effect.' },
];

const CHART_HEIGHT = 110;
const EXP_CHART_HEIGHT = 220;
const ML = 40; // left margin for Y-axis labels
const MR = 8;  // right margin
const MT = 8;  // top margin

// ── PK tier info ──────────────────────────────────────────────────────────────
function pkTierInfo(pct: number): { label: string; color: string; body: string } {
  if (pct >= 75) return {
    label: 'Optimal',
    color: '#27AE60',
    body: "GLP-1 receptor engagement is at its strongest. Appetite suppression is most effective - lowest food noise and greatest satiety. Nausea risk is also highest at peak, which is normal and transient.",
  };
  if (pct >= 50) return {
    label: 'Active',
    color: '#5B8BF5',
    body: "Concentration is in the therapeutic sweet spot. Appetite control remains strong, and if nausea appeared near peak, it should be easing. This is typically the most comfortable window in your cycle.",
  };
  if (pct >= 30) return {
    label: 'Tapering',
    color: '#F6CB45',
    body: "Concentration is declining toward your next dose. Some people notice hunger returning gradually. Protein-first meals help maintain momentum through this window.",
  };
  return {
    label: 'Trough',
    color: '#9A9490',
    body: "Levels are near their lowest before your next dose. GLP-1 RAs maintain a floor level — they don't drop to zero. Returning hunger is a normal pharmacological effect, not a treatment failure.",
  };
}

// ── Half-life explanation per drug ────────────────────────────────────────────
function pkHalfLifeExplain(glp1Type: import('@/constants/user-profile').Glp1Type): { halfLifeDays: string; troughNote: string; body: string } {
  switch (glp1Type) {
    case 'semaglutide': return {
      halfLifeDays: '7-day',
      troughNote: 'trough ≈ 50% of peak at steady state',
      body: "Semaglutide's half-life matches its weekly dosing interval exactly, creating a stable drug reservoir in the body. Concentration never fully rebounds to zero, which means appetite suppression and glycemic control remain continuous throughout the week.",
    };
    case 'tirzepatide': return {
      halfLifeDays: '5-day',
      troughNote: 'trough ≈ 40% of peak',
      body: "Tirzepatide's 5-day half-life is slightly shorter than the 7-day dosing interval, meaning levels dip a bit more in days 5–7 compared to semaglutide. For most people this is imperceptible, but some notice a mild increase in hunger in the final days before their next injection.",
    };
    case 'dulaglutide': return {
      halfLifeDays: '5-day',
      troughNote: 'trough ≈ 40% of peak',
      body: "Dulaglutide shares tirzepatide's 5-day half-life, but its slower Tmax (~48h) means the rise after injection is gentler, which often makes it easier on the stomach. The gradual onset and moderate trough create a smooth, predictable weekly rhythm.",
    };
    case 'liraglutide': return {
      halfLifeDays: '13-hour',
      troughNote: 'near-daily reset',
      body: "Liraglutide's short half-life requires daily injections. Steady state is reached within 2–3 days of consistent daily dosing. Missing even one dose causes a more noticeable drop in appetite control compared to weekly GLP-1 RAs.",
    };
    case 'oral_semaglutide': return {
      halfLifeDays: '7-day',
      troughNote: 'trough ≈ 91% of peak',
      body: "Despite being taken daily, oral semaglutide's long 7-day half-life creates an extremely flat, stable plasma profile - the trough is ~91% of peak. SNAC-mediated gastric absorption peaks around 1 hour post-dose (fasting required), then the level barely moves for the rest of the day.",
    };
    case 'orforglipron': return {
      halfLifeDays: '2.5-day',
      troughNote: 'trough ≈ 55% of peak',
      body: "Orforglipron is a small-molecule GLP-1 RA with a 2.5-day half-life, requiring daily dosing. Unlike peptide GLP-1 RAs, it is orally absorbed without SNAC and has no food restrictions. Peak concentration occurs ~8h post-dose; the trough at 24h is ~55% of peak.",
    };
    default: return { halfLifeDays: 'variable', troughNote: '', body: '' };
  }
}

// ── Peak effects explanation per drug ─────────────────────────────────────────
function pkPeakEffectsExplain(glp1Type: import('@/constants/user-profile').Glp1Type): { tmaxLabel: string; body: string } {
  switch (glp1Type) {
    case 'semaglutide': return {
      tmaxLabel: '~56 hours (day 2–3)',
      body: "Peak nausea typically occurs on days 2–3 after injection, coinciding with maximum concentration. By days 3–5, nausea eases while appetite suppression remains strong - this is the best window for new routines. Nausea tolerance usually improves with each dose escalation.",
    };
    case 'tirzepatide': return {
      tmaxLabel: '~24 hours (day 1)',
      body: "Tirzepatide reaches peak concentration just ~24 hours post-injection - the fastest of the injectable weekly GLP-1 RAs. Nausea, if it occurs, tends to be most pronounced on injection day and the day after, then resolves by day 2–3 as concentration plateaus into the active range.",
    };
    case 'dulaglutide': return {
      tmaxLabel: '~48 hours (day 2)',
      body: "Dulaglutide's slower rise to peak (~48h) is one of its distinguishing tolerability features. The gradual concentration increase is easier on the stomach than a rapid spike, making nausea less common or severe compared to tirzepatide in the early weeks.",
    };
    case 'liraglutide': return {
      tmaxLabel: '~11 hours post-dose',
      body: "If you inject in the evening, peak concentration hits the following afternoon (~11h). Most people find nausea eases within the first 2–4 weeks as the body adapts. Consistent daily timing is key - erratic dosing causes repeated mini-peaks that can worsen GI side effects.",
    };
    case 'oral_semaglutide': return {
      tmaxLabel: '~1 hour post-dose (fasting)',
      body: "The daily fasting absorption window means peak concentration occurs ~1 hour after your morning dose - any nausea typically clusters around that window. The near-flat daily profile means there is no late-week trough: appetite control is consistent from day to day.",
    };
    case 'orforglipron': return {
      tmaxLabel: '~8 hours post-dose',
      body: "Peak concentration falls ~8 hours after dosing - for a morning dose, this is late afternoon or evening. As a small molecule, orforglipron is generally better tolerated than peptide GLP-1 RAs, with nausea that is typically milder and shorter-lived.",
    };
    default: return { tmaxLabel: 'variable', body: '' };
  }
}

// ── Point label helper ────────────────────────────────────────────────────────
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function pkPointLabel(idx: number, injFreqDays: number, nPoints: number, injTimestamp?: string | null): string {
  const totalHours = injFreqDays * 24;
  const hrs = idx * (totalHours / (nPoints - 1));

  // If we have an injection timestamp, show real dates
  if (injTimestamp) {
    const injDate = new Date(injTimestamp);
    if (!isNaN(injDate.getTime())) {
      const pointDate = new Date(injDate.getTime() + hrs * 3600000);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const pointDay = new Date(pointDate.getFullYear(), pointDate.getMonth(), pointDate.getDate());
      const diffDays = Math.round((pointDay.getTime() - today.getTime()) / 86400000);

      const timeStr = pointDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

      let dayStr: string;
      if (diffDays === 0) dayStr = 'Today';
      else if (diffDays === 1) dayStr = 'Tomorrow';
      else if (diffDays === -1) dayStr = 'Yesterday';
      else {
        dayStr = `${SHORT_DAYS[pointDate.getDay()]}, ${SHORT_MONTHS[pointDate.getMonth()]} ${pointDate.getDate()}`;
      }

      if (idx === 0) return `${dayStr} · Injection`;
      if (idx === nPoints - 1) return `${dayStr} · Next dose`;
      return `${dayStr}, ${timeStr}`;
    }
  }

  // Fallback
  if (idx === 0) return 'Injection Day';
  if (idx === nPoints - 1) return 'Next Injection';
  const day = Math.floor(hrs / 24) + 1;
  const h = Math.round(hrs % 24);
  return `Day ${day}${h > 0 ? `, +${h}h` : ''}`;
}

function MedLevelChartCard({ chartData, daysSince, dayLabels, glp1Type, medicationBrand, isDailyDrug, currentCyclePct, currentConcentrationPct, injFreqDays, injTimestamp }: {
  chartData: number[] | null;
  daysSince: number;
  dayLabels: string[];
  glp1Type: import('@/constants/user-profile').Glp1Type;
  medicationBrand: import('@/constants/user-profile').MedicationBrand;
  isDailyDrug: boolean;
  currentCyclePct?: number | null;
  currentConcentrationPct?: number | null;
  injFreqDays: number;
  injTimestamp?: string | null;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [chartWidth, setChartWidth] = useState(0);
  const [expandedModal, setExpandedModal] = useState(false);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  const [expChartWidth, setExpChartWidth] = useState(0);
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const onLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);
  const { openAiChat } = useUiStore();

  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const dismissSheet = () => {
    Animated.timing(sheetTranslateY, { toValue: screenHeight, duration: 220, useNativeDriver: true }).start(() => {
      sheetTranslateY.setValue(0);
      setExpandedModal(false);
      setSelectedPointIdx(null);
    });
  };
  const sheetPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) sheetTranslateY.setValue(gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80 || gs.vy > 0.5) {
        dismissSheet();
      } else {
        Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      }
    },
  })).current;

  const n = chartData ? chartData.length : 0;
  const colW = chartWidth > 0 && n > 0 ? chartWidth / n : 0;
  const expColW = expChartWidth > 0 && n > 0 ? expChartWidth / n : 0;

  const plotW = chartWidth > 0 ? chartWidth - ML - MR : 0;
  const expPlotW = expChartWidth > 0 ? expChartWidth - ML - MR : 0;

  const points = chartData
    ? chartData.map((v, i) => ({
        x: chartWidth > 0 ? ML + (n > 1 ? (plotW / (n - 1)) * i : plotW / 2) : 0,
        y: MT + (CHART_HEIGHT - MT) * (1 - v / 100),
      }))
    : [];

  const expPoints = chartData
    ? chartData.map((v, i) => ({
        x: expChartWidth > 0 ? ML + (n > 1 ? (expPlotW / (n - 1)) * i : expPlotW / 2) : 0,
        y: MT + (EXP_CHART_HEIGHT - MT) * (1 - v / 100),
      }))
    : [];

  const currentLevel = currentConcentrationPct ?? (chartData ? chartData[chartData.length - 1] ?? 0 : 0);
  const levelLabel = isDailyDrug
    ? (glp1Type === 'liraglutide' ? 'Peaks ~11h post-dose' : 'Steady State')
    : (currentLevel >= 75 ? 'Optimal' : currentLevel >= 50 ? 'Active' : currentLevel >= 30 ? 'Tapering' : 'Trough');
  const daysSinceLabel = daysSince === 1 ? 'Today' : daysSince === 2 ? 'Yesterday' : `${daysSince - 1} days ago`;
  const concentrationDisplay = isDailyDrug ? null : `${currentLevel}%`;

  const tierInfo = pkTierInfo(currentLevel);
  const halfLifeInfo = pkHalfLifeExplain(glp1Type);
  const peakInfo = pkPeakEffectsExplain(glp1Type);
  const brandName = BRAND_DISPLAY_NAMES[medicationBrand];

  // Build real-date X-axis labels when injection timestamp is available
  const realDayLabels = useMemo(() => {
    if (!injTimestamp || isDailyDrug) return dayLabels;
    const injDate = new Date(injTimestamp);
    if (isNaN(injDate.getTime())) return dayLabels;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return dayLabels.map((_, i) => {
      const d = new Date(injDate.getTime() + i * 24 * 3600000);
      return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
    });
  }, [injTimestamp, isDailyDrug, dayLabels]);

  // ── Scrub hooks ──────────────────────────────────────────────────────────────
  const medTooltipFormatter = useCallback((idx: number) => {
    if (!chartData || idx < 0 || idx >= chartData.length) return { title: '', subtitle: '' };
    const pct = chartData[idx];
    const tier = pkTierInfo(pct);
    return {
      title: pkPointLabel(idx, injFreqDays, chartData.length, injTimestamp),
      subtitle: `${pct}% · ${tier.label}`,
      badge: { text: tier.label, color: tier.color },
    };
  }, [chartData, injFreqDays, injTimestamp]);

  const openModal = useCallback(() => {
    if (!isDailyDrug && chartData) setExpandedModal(true);
  }, [isDailyDrug, chartData]);

  const compactScrub = useChartScrub({
    points,
    chartWidth,
    marginLeft: ML,
    marginRight: MR,
    mode: 'longpress-or-tap',
    onTap: openModal,
    enabled: !!chartData && chartWidth > 0,
  });

  const expScrub = useChartScrub({
    points: expPoints,
    chartWidth: expChartWidth,
    marginLeft: ML,
    marginRight: MR,
    mode: 'longpress-only',
    enabled: !!chartData && expChartWidth > 0 && expandedModal,
  });

  // Sync expanded scrub activeIndex → selectedPointIdx for the panel
  useAnimatedReaction(
    () => expScrub.activeIndex.value,
    (idx) => {
      reanimatedRunOnJS(setSelectedPointIdx)(idx >= 0 ? idx : null);
    },
    [expScrub.activeIndex],
  );

  if (!chartData) {
    return (
      <View style={[s.cardWrap, { marginBottom: 16 }]}>
        <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border, padding: 24, alignItems: 'center' }]}>
          <Text style={[s.sectionTitle, { textAlign: 'center', marginBottom: 2 }]}>Drug Concentration</Text>
          <Text style={[s.chartMuted, { textAlign: 'center', marginBottom: 4 }]}>{BRAND_DISPLAY_NAMES[medicationBrand]} · {DRUG_HALF_LIFE_LABEL[glp1Type]}</Text>
          <Text style={[s.chartBig, { textAlign: 'center', marginTop: 8 }]}>Log your first dose</Text>
          <Text style={[s.chartMuted, { textAlign: 'center', marginTop: 4 }]}>Your medication level curve will appear here</Text>
        </View>
      </View>
    );
  }

  // Render chart internals as SVG (used in both compact and expanded views)
  function renderChartInternals(pts: { x: number; y: number }[], chartH: number, cW: number, cWFull: number) {
    if (cWFull <= 0 || pts.length === 0) return null;
    const plotH = chartH - MT;
    const yTicks = [0, 25, 50, 75, 100];
    const linePath = smoothPath(pts);
    const firstPt = pts[0];
    const lastPt = pts[pts.length - 1];
    const areaPath = pts.length >= 2
      ? `${linePath} L ${lastPt.x} ${chartH} L ${firstPt.x} ${chartH} Z`
      : '';
    const nowX = currentCyclePct != null ? ML + currentCyclePct * (cWFull - ML - MR) : null;
    const nowY = currentConcentrationPct != null ? MT + plotH * (1 - currentConcentrationPct / 100) : null;
    return (
      <Svg width={cWFull} height={chartH}>
        <Defs>
          <LinearGradient id="pkGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={ORANGE} stopOpacity="0.14" />
            <Stop offset="1" stopColor={ORANGE} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Y-axis gridlines + labels */}
        {yTicks.map(tick => {
          const y = MT + plotH * (1 - tick / 100);
          return (
            <React.Fragment key={`y-${tick}`}>
              <Line
                x1={ML} y1={y} x2={cWFull - MR} y2={y}
                stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="3,4"
              />
              <SvgText
                x={ML - 5} y={y + 3.5}
                fontSize={9} fill="rgba(255,255,255,0.35)"
                textAnchor="end" fontFamily="Helvetica Neue"
              >
                {tick}%
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Area fill */}
        {areaPath.length > 0 && <Path d={areaPath} fill="url(#pkGrad)" />}

        {/* Line */}
        {linePath.length > 0 && (
          <Path d={linePath} stroke={ORANGE} strokeWidth={2} fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Data dots */}
        {pts.map((pt, i) => (
          <Circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill={ORANGE} opacity={0.8} />
        ))}

        {/* NOW marker — rendered last for highest z-order */}
        {nowX != null && nowY != null && (
          <>
            <Line
              x1={nowX} y1={0} x2={nowX} y2={chartH}
              stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeDasharray="4,3"
            />
            <Circle cx={nowX} cy={nowY} r={8} fill="rgba(255,116,42,0.2)" />
            <Circle cx={nowX} cy={nowY} r={5.5} fill="#FFFFFF" stroke={ORANGE} strokeWidth={2.5} />
            <SvgText
              x={nowX} y={Math.max(14, nowY - 12)}
              fontSize={10} fontWeight="800" fill={ORANGE}
              textAnchor="middle" fontFamily="Helvetica Neue"
            >
              NOW
            </SvgText>
          </>
        )}
      </Svg>
    );
  }

  return (
    <>
      <Pressable
        style={[s.cardWrap, { marginBottom: 16 }]}
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openAiChat({ type: 'metric', contextLabel: 'Medication Level', contextValue: `${levelLabel} · Last injection ${daysSinceLabel}`, chips: JSON.stringify(['What does optimal mean?', 'How will this change over my cycle?', 'When is my peak concentration?', 'How does this affect my appetite?']) }); }}
      >
        <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
          <View style={{ padding: 18 }}>
            {/* Header row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={[s.sectionTitle, { marginBottom: 0 }]}>Drug Concentration</Text>
                <Text style={[s.chartMuted, { marginTop: 2, fontSize: 11 }]}>{brandName} · {DRUG_HALF_LIFE_LABEL[glp1Type]}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {!isDailyDrug && (
                  <Ionicons name="expand-outline" size={14} color={colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
                )}
              </View>
            </View>

            {/* Level display */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
              <View>
                <Text style={s.chartBig}>{concentrationDisplay ?? levelLabel}</Text>
                {concentrationDisplay && (
                  <Text style={[s.chartMuted, { marginTop: 2 }]}>{levelLabel} · remaining in body</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.chartMuted, { fontSize: 11 }]}>
                  {isDailyDrug ? 'Intraday profile' : daysSinceLabel}
                </Text>
              </View>
            </View>

            <GestureDetector gesture={compactScrub.gesture}>
              <View style={{ height: CHART_HEIGHT, position: 'relative' }} onLayout={onLayout}>
                {chartWidth > 0 && renderChartInternals(points, CHART_HEIGHT, colW, chartWidth)}
                {chartWidth > 0 && (
                  <ChartScrubOverlay
                    activeIndex={compactScrub.activeIndex}
                    isActive={compactScrub.isActive}
                    crosshairX={compactScrub.crosshairX}
                    crosshairY={compactScrub.crosshairY}
                    chartHeight={CHART_HEIGHT}
                    chartWidth={chartWidth}
                    color={ORANGE}
                    formatTooltip={medTooltipFormatter}
                  />
                )}
              </View>
            </GestureDetector>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              {realDayLabels.map((d, i) => (
                <Text key={`${d}-${i}`} style={s.dayLabel}>{d}</Text>
              ))}
            </View>
          </View>
        </View>
      </Pressable>

      {/* ── Expanded Modal ── */}
      <Modal
        visible={expandedModal}
        transparent
        animationType="none"
        onRequestClose={dismissSheet}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Backdrop */}
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={dismissSheet}
          />
          <Animated.View
            style={{
              height: screenHeight * 0.82,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              overflow: 'hidden',
              transform: [{ translateY: sheetTranslateY }],
            }}
          >
            <BlurView
              intensity={60}
              tint={colors.blurTint}
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />

            {/* Drag handle — pan gesture target */}
            <View
              {...sheetPan.panHandlers}
              style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}
            >
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }} />
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8, marginBottom: 16 }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' }}>Drug Concentration</Text>
                  <Text style={[s.chartMuted, { marginTop: 2 }]}>{brandName} · {DRUG_HALF_LIFE_LABEL[glp1Type]}</Text>
                </View>
                <Pressable onPress={dismissSheet} hitSlop={12}>
                  <Ionicons name="close-circle" size={28} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} />
                </Pressable>
              </View>

              {/* Expanded chart with scrub */}
              <GestureDetector gesture={expScrub.gesture}>
                <View
                  style={{ height: EXP_CHART_HEIGHT, marginBottom: 0, position: 'relative' }}
                  onLayout={e => setExpChartWidth(e.nativeEvent.layout.width)}
                >
                  {expChartWidth > 0 && (
                    <>
                      {renderChartInternals(expPoints, EXP_CHART_HEIGHT, expColW, expChartWidth)}
                      <ChartScrubOverlay
                        activeIndex={expScrub.activeIndex}
                        isActive={expScrub.isActive}
                        crosshairX={expScrub.crosshairX}
                        crosshairY={expScrub.crosshairY}
                        chartHeight={EXP_CHART_HEIGHT}
                        chartWidth={expChartWidth}
                        color={ORANGE}
                        formatTooltip={medTooltipFormatter}
                      />
                    </>
                  )}
                </View>
              </GestureDetector>

              {/* X-axis labels */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 }}>
                {realDayLabels.map((d, i) => (
                  <Text key={`exp-${d}-${i}`} style={s.dayLabel}>{d}</Text>
                ))}
              </View>

              {/* Selected point panel */}
              {selectedPointIdx !== null && (() => {
                const selPct = chartData[selectedPointIdx] ?? 0;
                const selTier = pkTierInfo(selPct);
                const ptLabel = pkPointLabel(selectedPointIdx, injFreqDays, n, injTimestamp);
                return (
                  <View style={{
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 16,
                    padding: 14,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                  }}>
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Helvetica Neue' }}>{ptLabel}</Text>
                      <Text style={[s.chartMuted, { marginTop: 2 }]}>{selPct}% remaining</Text>
                    </View>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: `${selTier.color}22` }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: selTier.color, fontFamily: 'Helvetica Neue' }}>{selTier.label}</Text>
                    </View>
                  </View>
                );
              })()}

              {/* ── Phase bar — visual representation of current level ── */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tierInfo.color }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: tierInfo.color, fontFamily: 'Helvetica Neue' }}>{tierInfo.label}</Text>
                  <Text style={{ fontSize: 13, color: colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', fontFamily: 'Helvetica Neue' }}>· {currentLevel}% active</Text>
                </View>
                {/* Gradient phase bar */}
                <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  {PK_TIER_GUIDE.slice().reverse().map((tier) => (
                    <View key={tier.label} style={{ flex: 1, backgroundColor: `${tier.color}44` }} />
                  ))}
                </View>
                {/* Phase position indicator */}
                <View style={{ position: 'relative', height: 0 }}>
                  <View style={{
                    position: 'absolute',
                    left: `${Math.min(98, Math.max(2, currentLevel))}%`,
                    top: -14,
                    width: 2,
                    height: 6,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 1,
                  }} />
                </View>
                {/* Compact tier legend */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  {PK_TIER_GUIDE.slice().reverse().map((tier) => (
                    <Text key={tier.label} style={{ fontSize: 9, color: `${tier.color}99`, fontWeight: '600', fontFamily: 'Helvetica Neue' }}>{tier.label}</Text>
                  ))}
                </View>
              </View>

              <View style={s.eduDivider} />

              {/* ── Key moments cards ── */}
              <View style={{ marginBottom: 20 }}>
                <Text style={[s.eduTitle, { marginBottom: 12 }]}>Your Cycle</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {/* Peak card */}
                  <View style={{
                    flex: 1,
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 14,
                    padding: 12,
                    alignItems: 'center',
                  }}>
                    <Ionicons name="arrow-up-circle" size={20} color="#27AE60" style={{ marginBottom: 6 }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Helvetica Neue', textAlign: 'center' }}>Peak</Text>
                    <Text style={{ fontSize: 10, color: colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: 'Helvetica Neue', textAlign: 'center', marginTop: 2 }}>{peakInfo.tmaxLabel}</Text>
                  </View>
                  {/* Half-life card */}
                  <View style={{
                    flex: 1,
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 14,
                    padding: 12,
                    alignItems: 'center',
                  }}>
                    <Ionicons name="time-outline" size={20} color="#5B8BF5" style={{ marginBottom: 6 }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Helvetica Neue', textAlign: 'center' }}>Half-life</Text>
                    <Text style={{ fontSize: 10, color: colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: 'Helvetica Neue', textAlign: 'center', marginTop: 2 }}>{halfLifeInfo.halfLifeDays}</Text>
                  </View>
                  {/* Trough card */}
                  <View style={{
                    flex: 1,
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 14,
                    padding: 12,
                    alignItems: 'center',
                  }}>
                    <Ionicons name="arrow-down-circle" size={20} color="#F6CB45" style={{ marginBottom: 6 }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Helvetica Neue', textAlign: 'center' }}>Trough</Text>
                    <Text style={{ fontSize: 10, color: colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: 'Helvetica Neue', textAlign: 'center', marginTop: 2 }}>{halfLifeInfo.troughNote || 'End of cycle'}</Text>
                  </View>
                </View>
              </View>

              <View style={s.eduDivider} />

              {/* ── What to expect — compact timeline ── */}
              <View style={{ marginBottom: 8 }}>
                <Text style={[s.eduTitle, { marginBottom: 12 }]}>What to Expect</Text>
                {[
                  { icon: 'flash' as const, color: '#27AE60', label: 'Peak appetite suppression', when: `Around ${peakInfo.tmaxLabel} post-dose` },
                  { icon: 'restaurant' as const, color: '#5B8BF5', label: 'Best window for new habits', when: 'Days 3–5 of cycle' },
                  { icon: 'trending-down' as const, color: '#F6CB45', label: 'Hunger may return', when: 'Last 1–2 days before next dose' },
                ].map((item) => (
                  <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${item.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={item.icon} size={16} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, fontFamily: 'Helvetica Neue' }}>{item.label}</Text>
                      <Text style={{ fontSize: 11, color: colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', fontFamily: 'Helvetica Neue', marginTop: 1 }}>{item.when}</Text>
                    </View>
                  </View>
                ))}
              </View>

            </ScrollView>

            {/* ── Ask AI button ── */}
            <View style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: insets.bottom + 16,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              backgroundColor: 'transparent',
            }}>
              <Pressable
                onPress={() => {
                  dismissSheet();
                  setTimeout(() => {
                    openAiChat({
                      type: 'metric',
                      contextLabel: 'Medication Level',
                      contextValue: `${currentLevel}% - ${tierInfo.label} - Last injection ${daysSinceLabel}`,
                      chips: JSON.stringify(['What does my current level mean?', 'When will I hit peak concentration?', 'Why is my appetite returning?', 'How does this affect my side effects?']),
                    });
                  }, 350);
                }}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? 'rgba(255,116,42,0.85)' : ORANGE,
                  borderRadius: 28,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  shadowColor: ORANGE,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 16,
                  elevation: 8,
                })}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFF" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 0.3, fontFamily: 'Helvetica Neue' }}>Ask AI about my medication</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

// ─── Injection info card ───────────────────────────────────────────────────────

function InjectionCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 }), [colors]);
  const { openAiChat } = useUiStore();
  const handleAskAI = () => {
    openAiChat({ type: 'metric', contextLabel: label, contextValue: value, chips: JSON.stringify(['Why does this matter?', 'How does this affect my treatment?', 'What should I know about site rotation?']) });
  };
  return (
    <Pressable
      style={[s.dailyWrap, glassShadow]}
      onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleAskAI(); }}
      delayLongPress={400}
    >
      <View style={[s.cardBody, { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={s.dailyInner}>
          <View style={[s.dailyTopRow, { marginBottom: 10 }]}>
            <View style={s.dailyIconWrap}>{icon}</View>
          </View>
          <Text style={s.dailyLabel}>{label}</Text>
          <Text style={s.dailyValue}>{value}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Weight chart ─────────────────────────────────────────────────────────────

const WEIGHT_CHART_HEIGHT = 130;

const PERIOD_SUBTITLES: Record<string, string> = {
  '7D': 'Last 7 days', '14D': 'Last 14 days', '30D': 'Last 30 days', '90D': 'Last 3 months', 'MAX': 'All time',
};

const WML = 52; // margin left (Y-axis labels)
const WMR = 12; // margin right
const WMT = 10; // margin top
const WMB = 28; // margin bottom (X-axis labels)

function WeightChartCard({ datasets, currentWeight, chartHeight = WEIGHT_CHART_HEIGHT, inline = false }: {
  datasets: Record<string, WeightPoint[]>;
  currentWeight: number | null;
  chartHeight?: number;
  inline?: boolean;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [activePeriod, setActivePeriod] = useState<'7D' | '14D' | '30D' | '90D' | 'MAX'>('30D');
  const [svgWidth, setSvgWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setSvgWidth(e.nativeEvent.layout.width);

  const data = datasets[activePeriod];
  const hasData = data && data.length >= 2;

  const svgH = chartHeight + WMT + WMB;
  const plotW = Math.max(0, svgWidth - WML - WMR);
  const plotH = chartHeight;

  // Y range
  const weights = hasData ? data.map(d => d.weight) : [];
  const rawMin = hasData ? Math.min(...weights) : 0;
  const rawMax = hasData ? Math.max(...weights) : 10;
  const padding = Math.max(5, (rawMax - rawMin) * 0.15);
  const minW = rawMin - padding;
  const maxW = rawMax + padding;
  const yRange = maxW - minW || 1;

  const toX = (i: number) => WML + (plotW / Math.max((data?.length ?? 2) - 1, 1)) * i;
  const toY = (w: number) => WMT + plotH - ((w - minW) / yRange) * plotH;

  const points = hasData ? data.map((d, i) => ({ x: toX(i), y: toY(d.weight) })) : [];

  const linePath = smoothPath(points);
  const areaPath = points.length >= 2
    ? `${linePath} L ${points[points.length - 1].x} ${WMT + plotH} L ${points[0].x} ${WMT + plotH} Z`
    : '';

  const yTicks = hasData ? niceYTicks(rawMin, rawMax) : [];
  const xLabels = hasData && svgWidth > 0 ? xAxisLabels(data, activePeriod, plotW) : [];
  const lastPt = points[points.length - 1];

  const displayWeight = currentWeight ?? (hasData ? data[data.length - 1].weight : null);
  const PERIODS = ['7D', '14D', '30D', '90D', 'MAX'] as const;
  const { openAiChat } = useUiStore();

  // ── Scrub hook ──────────────────────────────────────────────────────────
  const weightTooltipFormatter = useCallback((idx: number) => {
    if (!data || idx < 0 || idx >= data.length) return { title: '', subtitle: '' };
    const pt = data[idx];
    const prevPt = idx > 0 ? data[idx - 1] : null;
    const delta = prevPt ? Math.round((pt.weight - prevPt.weight) * 10) / 10 : 0;
    const deltaStr = delta < 0 ? `${delta} lbs` : delta > 0 ? `+${delta} lbs` : 'Steady';
    return {
      title: `${pt.weight} lbs`,
      subtitle: new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      badge: delta !== 0
        ? { text: deltaStr, color: delta < 0 ? '#27AE60' : '#E74C3C' }
        : undefined,
    };
  }, [data]);

  const weightScrub = useChartScrub({
    points,
    chartWidth: svgWidth,
    marginLeft: WML,
    marginRight: WMR,
    mode: 'longpress-only',
    enabled: hasData && svgWidth > 0,
  });

  const chartContent = (
    <>
      {!inline && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' }}>Weight Journey</Text>
            <Text style={s.chartMuted}>{PERIOD_SUBTITLES[activePeriod]}</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: ORANGE, letterSpacing: -1, fontFamily: 'Helvetica Neue' }}>
            {displayWeight != null ? `${displayWeight} lbs` : '-'}
          </Text>
        </View>
      )}

      <View style={s.progPeriodRow}>
        {PERIODS.map((p) => {
          const isActive = activePeriod === p;
          return (
            <Pressable
              key={p}
              style={[s.progPeriodBtn, isActive && s.progPeriodBtnActive]}
              onPress={(e) => { e.stopPropagation(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActivePeriod(p); }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={[s.progPeriodLabel, isActive && s.progPeriodLabelActive]}>{p}</Text>
            </Pressable>
          );
        })}
      </View>

      <GestureDetector gesture={weightScrub.gesture}>
        <View style={{ height: svgH, position: 'relative' }} onLayout={onLayout}>
          {!hasData ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={s.chartMuted}>Log weight entries to see your chart</Text>
            </View>
          ) : svgWidth > 0 && (
            <>
              <Svg width={svgWidth} height={svgH}>
                <Defs>
                  <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={ORANGE} stopOpacity="0.28" />
                    <Stop offset="1" stopColor={ORANGE} stopOpacity="0" />
                  </LinearGradient>
                </Defs>

                {/* Y-axis gridlines + labels */}
                {yTicks.map((tick) => {
                  const y = toY(tick);
                  return (
                    <React.Fragment key={`y-${tick}`}>
                      <Line
                        x1={WML} y1={y} x2={WML + plotW} y2={y}
                        stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="4,4"
                      />
                      <SvgText
                        x={WML - 6} y={y + 4}
                        fontSize={10} fill="rgba(255,255,255,0.35)"
                        textAnchor="end" fontFamily="Helvetica Neue"
                      >
                        {Math.round(tick)}
                      </SvgText>
                    </React.Fragment>
                  );
                })}

                {/* X-axis labels */}
                {xLabels.map(({ x, label }) => (
                  <React.Fragment key={`x-${label}-${x}`}>
                    <Line
                      x1={WML + x} y1={WMT} x2={WML + x} y2={WMT + plotH}
                      stroke="rgba(255,255,255,0.05)" strokeWidth={1}
                    />
                    <SvgText
                      x={WML + x} y={WMT + plotH + 18}
                      fontSize={9} fill="rgba(255,255,255,0.35)"
                      textAnchor="middle" fontFamily="Helvetica Neue"
                    >
                      {label}
                    </SvgText>
                  </React.Fragment>
                ))}

                {/* Area fill */}
                {areaPath ? (
                  <Path d={areaPath} fill="url(#areaGrad)" />
                ) : null}

                {/* Line */}
                {linePath ? (
                  <Path d={linePath} stroke={ORANGE} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                ) : null}

                {/* Data dots */}
                {points.slice(0, -1).map((pt, i) => (
                  <Circle key={`dot-${i}`} cx={pt.x} cy={pt.y} r={4} fill={ORANGE} />
                ))}

                {/* Last point — double ring */}
                {lastPt && (
                  <>
                    <Circle cx={lastPt.x} cy={lastPt.y} r={9} fill="rgba(255,116,42,0.2)" />
                    <Circle cx={lastPt.x} cy={lastPt.y} r={5.5} fill={ORANGE} />
                  </>
                )}
              </Svg>
              <ChartScrubOverlay
                activeIndex={weightScrub.activeIndex}
                isActive={weightScrub.isActive}
                crosshairX={weightScrub.crosshairX}
                crosshairY={weightScrub.crosshairY}
                chartHeight={svgH}
                chartWidth={svgWidth}
                color={ORANGE}
                formatTooltip={weightTooltipFormatter}
              />
            </>
          )}
        </View>
      </GestureDetector>

      {hasData && svgWidth > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Text style={s.progGoalLabel}>START ({data[0].weight} lbs)</Text>
          <Text style={[s.progGoalLabel, { color: ORANGE, fontWeight: '700' }]}>
            CURRENT ({data[data.length - 1].weight} lbs)
          </Text>
        </View>
      )}
    </>
  );

  if (inline) {
    return chartContent;
  }

  return (
    <View style={[s.cardWrap, { marginBottom: 16 }]}>
      <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={{ padding: 18 }}>
          {chartContent}
        </View>
      </View>
    </View>
  );
}

// ─── Weight projection card (tap-to-expand) ───────────────────────────────────

function WeightProjectionCard({
  projection, datasets, currentWeight, programWeek,
}: {
  projection: WeightProjection | null;
  datasets: Record<string, WeightPoint[]>;
  currentWeight: number | null;
  programWeek?: number;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const [expanded, setExpanded] = useState(false);
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { openAiChat } = useUiStore();

  // Drag-to-dismiss
  const sheetY = useRef(new Animated.Value(0)).current;
  const closeSheet = () => { sheetY.setValue(0); setExpanded(false); };
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) sheetY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
        }
      },
    })
  ).current;

  const plateauColor = projection?.plateauRisk === 'detected' ? '#FF3B30' : '#FF9500';
  const plateauLabel = projection?.plateauRisk === 'detected' ? 'PLATEAU DETECTED' : 'PLATEAU APPROACHING';
  const goalDateLabel = projection
    ? new Date(projection.projectedGoalDate + 'T00:00:00')
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <>
      <Pressable
        style={[s.cardWrap, { marginBottom: 16 }]}
        onPress={() => setExpanded(true)}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          openAiChat({
            type: 'metric',
            contextLabel: 'Weight Journey',
            contextValue: `${currentWeight != null ? currentWeight + ' lbs' : '-'}${projection ? ` · -${projection.weeklyLossRateLbs} lbs/wk · goal ${goalDateLabel}` : ''}`,
            chips: JSON.stringify(['Am I on pace for my goal?', 'Is my rate of loss healthy on GLP-1?', 'When will I reach my goal?', 'What can I do to accelerate progress?']),
          });
        }}
        delayLongPress={400}
      >
        <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
          <View style={{ padding: 18 }}>
            {/* Header row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' }}>Weight Journey</Text>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: ORANGE, letterSpacing: -1, fontFamily: 'Helvetica Neue' }}>
                  {currentWeight != null ? `${currentWeight} lbs` : '-'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="expand-outline" size={11} color={w(0.3)} />
                  <Text style={[s.chartMuted, { fontSize: 10 }]}>Tap for full view</Text>
                </View>
              </View>
            </View>

            {/* Always-visible chart */}
            <WeightChartCard
              datasets={datasets}
              currentWeight={currentWeight}
              chartHeight={130}
              inline
            />
          </View>
        </View>
      </Pressable>

      <Modal visible={expanded} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={closeSheet}
          />
          <Animated.View style={{ height: screenHeight * 0.82, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', transform: [{ translateY: sheetY }] }}>
            <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />

            {/* Drag handle — swipe down to dismiss */}
            <View
              {...panResponder.panHandlers}
              style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 12 }}
            >
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: w(0.18) }} />
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 16 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' }}>Weight Journey</Text>
                <Pressable onPress={closeSheet} hitSlop={12}>
                  <Ionicons name="close-circle" size={28} color={w(0.4)} />
                </Pressable>
              </View>

              {/* Embedded chart at 220px */}
              <WeightChartCard
                datasets={datasets}
                currentWeight={currentWeight}
                chartHeight={220}
                inline
              />

              {/* Stats + plateau below chart */}
              {projection && (
                <>
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSubtle, marginBottom: 16 }} />
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                    <View style={{ flex: 1, backgroundColor: colors.borderSubtle, borderRadius: 14, padding: 12 }}>
                      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.8, fontFamily: 'Helvetica Neue', marginBottom: 4 }}>WEEKLY RATE</Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' }}>
                        {projection.weeklyLossRateLbs > 0 ? `-${projection.weeklyLossRateLbs}` : '0'}
                        <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textMuted }}> lbs/wk</Text>
                      </Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: colors.borderSubtle, borderRadius: 14, padding: 12 }}>
                      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.8, fontFamily: 'Helvetica Neue', marginBottom: 4 }}>GOAL DATE</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Helvetica Neue' }}>{goalDateLabel}</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: 'Helvetica Neue', marginTop: 2 }}>{projection.weeksToGoal} wks away</Text>
                    </View>
                  </View>
                  {projection.plateauRisk !== 'none' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 14 }}>
                      <View style={{ backgroundColor: plateauColor + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: plateauColor, fontFamily: 'Helvetica Neue' }}>{plateauLabel}</Text>
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* Ask AI button */}
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSubtle, marginBottom: 16 }} />
              <Pressable
                onPress={() => {
                  closeSheet();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  openAiChat({
                    type: 'metric',
                    contextLabel: 'Weight Journey',
                    contextValue: `${currentWeight != null ? currentWeight + ' lbs' : '-'}${projection ? ` · -${projection.weeklyLossRateLbs} lbs/wk · goal ${goalDateLabel}` : ''}`,
                    chips: JSON.stringify(['Am I on pace for my goal?', 'Is my rate of loss healthy on GLP-1?', 'When will I reach my goal?', 'What can I do to accelerate progress?']),
                  });
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: pressed ? '#E5661F' : ORANGE,
                  borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20,
                })}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Helvetica Neue', letterSpacing: -0.3 }}>Ask AI about my weight</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

// ─── Weight goal card ─────────────────────────────────────────────────────────

function WeightGoalCard({ projection, currentWeight, goalWeight, toGoalPct }: {
  projection: WeightProjection | null;
  currentWeight: number | null;
  goalWeight: number | null;
  toGoalPct: number | null;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const plateauColor = projection?.plateauRisk === 'detected' ? '#FF3B30' : '#FF9500';
  const plateauLabel = projection?.plateauRisk === 'detected' ? 'PLATEAU DETECTED' : 'PLATEAU APPROACHING';
  const goalDateLabel = projection
    ? new Date(projection.projectedGoalDate + 'T00:00:00')
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <View style={[s.cardWrap, { marginBottom: 16 }]}>
      <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={{ padding: 18 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue', marginBottom: 14 }}>Goal Progress</Text>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: projection?.plateauRisk && projection.plateauRisk !== 'none' ? 12 : 0 }}>
            <View style={{ flex: 1, backgroundColor: colors.borderSubtle, borderRadius: 14, padding: 12 }}>
              <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.8, fontFamily: 'Helvetica Neue', marginBottom: 4 }}>GOAL WEIGHT</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' }}>
                {goalWeight != null ? `${goalWeight}` : '-'}
                {goalWeight != null && <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textMuted }}> lbs</Text>}
              </Text>
              {toGoalPct != null && (
                <>
                  <View style={[s.progBar, { marginTop: 8 }]}>
                    <View style={[s.progBarFill, { width: `${toGoalPct}%` as any }]} />
                  </View>
                  <Text style={{ fontSize: 11, color: w(0.4), fontFamily: 'Helvetica Neue', marginTop: 4 }}>{toGoalPct}% of the way there</Text>
                </>
              )}
            </View>
            <View style={{ flex: 1, backgroundColor: colors.borderSubtle, borderRadius: 14, padding: 12 }}>
              <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.8, fontFamily: 'Helvetica Neue', marginBottom: 4 }}>PROJECTED DATE</Text>
              {goalDateLabel ? (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Helvetica Neue' }}>{goalDateLabel}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: 'Helvetica Neue', marginTop: 2 }}>{projection!.weeksToGoal} wks · based on current rate</Text>
                </>
              ) : (
                <Text style={{ fontSize: 12, color: w(0.35), fontFamily: 'Helvetica Neue', marginTop: 4 }}>Log 2+ weights to unlock</Text>
              )}
            </View>
          </View>

          {projection?.plateauRisk != null && projection.plateauRisk !== 'none' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: plateauColor + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: plateauColor, fontFamily: 'Helvetica Neue' }}>⚠ {plateauLabel}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Progress stat card ───────────────────────────────────────────────────────

function ProgressStatCard({
  icon, label, value, children,
}: {
  icon: React.ReactNode; label: string; value: string; children?: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 }), [colors]);
  const { openAiChat } = useUiStore();
  const handleAskAI = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openAiChat({ type: 'metric', contextLabel: label, contextValue: value, chips: JSON.stringify(['What does this mean for my health?', 'Is this a healthy rate of change?', 'What should my target be?']) });
  };
  return (
    <Pressable style={[s.dailyWrap, glassShadow]} onLongPress={handleAskAI}>
      <View style={[s.cardBody, { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={s.dailyInner}>
          <View style={[s.dailyTopRow, { marginBottom: 10 }]}>
            <View style={s.dailyIconWrap}>{icon}</View>
          </View>
          <Text style={s.dailyLabel}>{label}</Text>
          <Text style={s.dailyValue}>{value}</Text>
          {children != null && <View style={s.progStatSub}>{children}</View>}
        </View>
      </View>
    </Pressable>
  );
}


// ─── Side Effects card ────────────────────────────────────────────────────────

const EFFECT_LABELS: Record<string, string> = {
  nausea: 'Nausea', vomiting: 'Vomiting', fatigue: 'Fatigue',
  constipation: 'Constipation', diarrhea: 'Diarrhea', headache: 'Headache',
  injection_site: 'Injection Site', appetite_loss: 'Appetite Loss',
  dehydration: 'Dehydration', dizziness: 'Dizziness', muscle_loss: 'Muscle Loss',
  heartburn: 'Heartburn', food_noise: 'Food Noise', sulfur_burps: 'Sulfur Burps',
  bloating: 'Bloating', hair_loss: 'Hair Loss', other: 'Other',
};

type EffectIconDef =
  | { set: 'MaterialIcons'; name: React.ComponentProps<typeof MaterialIcons>['name'] }
  | { set: 'Ionicons'; name: React.ComponentProps<typeof Ionicons>['name'] }
  | { set: 'FontAwesome5'; name: React.ComponentProps<typeof FontAwesome5>['name'] };

const EFFECT_ICONS: Record<string, EffectIconDef> = {
  nausea:         { set: 'MaterialIcons', name: 'sick' },
  vomiting:       { set: 'MaterialIcons', name: 'sick' },
  fatigue:        { set: 'Ionicons',      name: 'bed-outline' },
  constipation:   { set: 'MaterialIcons', name: 'accessibility' },
  diarrhea:       { set: 'Ionicons',      name: 'water-outline' },
  headache:       { set: 'MaterialIcons', name: 'psychology' },
  injection_site: { set: 'FontAwesome5',  name: 'syringe' },
  appetite_loss:  { set: 'MaterialIcons', name: 'no-meals' },
  dehydration:    { set: 'Ionicons',      name: 'water-outline' },
  dizziness:      { set: 'MaterialIcons', name: 'loop' },
  muscle_loss:    { set: 'MaterialIcons', name: 'fitness-center' },
  heartburn:      { set: 'MaterialIcons', name: 'local-fire-department' },
  food_noise:     { set: 'MaterialIcons', name: 'psychology' },
  sulfur_burps:   { set: 'MaterialIcons', name: 'air' },
  bloating:       { set: 'MaterialIcons', name: 'air' },
  hair_loss:      { set: 'MaterialIcons', name: 'face' },
  other:          { set: 'Ionicons',      name: 'warning-outline' },
};

function EffectIcon({ type, size = 22, color }: { type: string; size?: number; color: string }) {
  const def = EFFECT_ICONS[type] ?? { set: 'Ionicons', name: 'warning-outline' } as EffectIconDef;
  if (def.set === 'MaterialIcons') return <MaterialIcons name={def.name as any} size={size} color={color} />;
  if (def.set === 'FontAwesome5') return <FontAwesome5 name={def.name as any} size={size - 4} color={color} />;
  return <Ionicons name={def.name as any} size={size} color={color} />;
}

function severityColor(avg: number): string {
  if (avg <= 3) return '#27AE60';
  if (avg <= 6) return '#F6CB45';
  return '#E74C3C';
}

function severityLabel(avg: number): string {
  if (avg <= 3) return 'Mild';
  if (avg <= 6) return 'Moderate';
  return 'Severe';
}

function SideEffectsCard({ logs }: { logs: SideEffectLog[] }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { openAiChat } = useUiStore();
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const cutoff = Date.now() - 30 * 86400000;
  const recent = logs.filter(l => new Date(l.logged_at).getTime() >= cutoff);

  const grouped = new Map<string, { count: number; totalSev: number }>();
  for (const l of recent) {
    const key = l.effect_type as string;
    const prev = grouped.get(key) ?? { count: 0, totalSev: 0 };
    grouped.set(key, { count: prev.count + 1, totalSev: prev.totalSev + (l.severity ?? 5) });
  }

  const top = [...grouped.entries()]
    .map(([type, d]) => ({ type, count: d.count, avgSev: Math.round((d.totalSev / d.count) * 10) / 10 }))
    .sort((a, b) => b.count - a.count || b.avgSev - a.avgSev)
    .slice(0, 4);

  const aiContext = top.map(e => `${EFFECT_LABELS[e.type] ?? e.type} x${e.count} (avg severity ${e.avgSev})`).join(', ');

  return (
    <Pressable
      style={[s.cardWrap, { marginBottom: 16 }]}
      onLongPress={() => { if (top.length > 0) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openAiChat({ type: 'metric', contextLabel: 'Side Effects', contextValue: aiContext, chips: JSON.stringify(['Are these normal for my phase?', 'How can I reduce nausea?', 'Should I contact my doctor?', 'Do these affect my score?']) }); } }}
    >
      <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={s.sectionTitle}>Side Effects</Text>
            <Text style={{ fontSize: 11, color: w(0.35), fontFamily: 'Helvetica Neue' }}>Last 30 days</Text>
          </View>

          {top.length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
              <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
              <Text style={{ fontSize: 14, color: w(0.45), fontFamily: 'Helvetica Neue' }}>No side effects logged recently</Text>
            </View>
          ) : (
            top.map((item, i) => {
              const color = severityColor(item.avgSev);
              const name = EFFECT_LABELS[item.type] ?? item.type;
              return (
                <View key={item.type}>
                  {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: w(0.06), marginVertical: 10 }} />}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 30, alignItems: 'center' }}>
                      <EffectIcon type={item.type} size={22} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, fontFamily: 'Helvetica Neue' }}>{name}</Text>
                      <Text style={{ fontSize: 12, color: w(0.4), fontFamily: 'Helvetica Neue', marginTop: 2 }}>
                        {item.count} {item.count === 1 ? 'time' : 'times'} logged
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <View style={{ backgroundColor: color + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color, fontFamily: 'Helvetica Neue' }}>{severityLabel(item.avgSev)}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: w(0.3), fontFamily: 'Helvetica Neue' }}>avg {item.avgSev}/10</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Recent Logs card ─────────────────────────────────────────────────────────

function RecentLogsCard({ entries, onDelete }: { entries: LogEntry[]; onDelete?: (id: string) => void }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(e => !e);
  };

  return (
    <View style={[s.cardWrap, { marginTop: 24, marginBottom: 8 }]}>
      <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>

        <TouchableOpacity style={s.logHeader} onPress={toggle} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={s.logHeaderText}>Recent Logs</Text>
            <View style={s.logCountBadge}>
              <Text style={s.logCountText}>{entries.length}</Text>
            </View>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'} />
        </TouchableOpacity>

        {expanded && (
          <View style={s.logEntryList}>
            <View style={s.logDivider} />
            {entries.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', fontSize: 13, fontFamily: 'Helvetica Neue' }}>No entries yet</Text>
              </View>
            ) : entries.map((entry, i) => (
              <View key={entry.id}>
                <View style={s.logEntryRow}>
                  <View style={s.logEntryIconWrap}>{entry.icon}</View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={s.logEntryTitle} numberOfLines={1}>{entry.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={s.logEntryTime}>{entry.timestamp}</Text>
                        {onDelete && (
                          <TouchableOpacity
                            onPress={() => onDelete(entry.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={14} color={colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <Text style={s.logEntryDetails}>{entry.details}</Text>
                    <View style={[s.logImpactTag, { backgroundColor: statusStyle[entry.impactStatus].bg, marginTop: 6, alignSelf: 'flex-start' }]}>
                      <Text style={[s.logImpactText, { color: statusStyle[entry.impactStatus].text }]}>
                        {entry.impact}
                      </Text>
                    </View>
                  </View>
                </View>
                {i < entries.length - 1 && <View style={s.logDivider} />}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Progress AI Insights card ────────────────────────────────────────────────

function ProgAIInsightsCard() {
  const text = useInsightsAiStore(s => s.progressText);
  const loading = useInsightsAiStore(s => s.progressLoading);
  const { openAiChat } = useUiStore();
  const handlePress = () => {
    if (!text) return;
    openAiChat({ type: 'insight', contextLabel: 'Progress Insight', contextValue: text.slice(0, 80), chips: JSON.stringify(['Tell me more', 'Am I on pace for my goal?', 'How can I accelerate my progress?', 'What does this mean long-term?']) });
  };
  return <AIInsightsCardShell text={text} loading={loading || text === null} onLongPress={handlePress} />;
}

// ─── LifestyleTrendCard ────────────────────────────────────────────────────────

function LifestyleTrendCard({
  foodByDate,
  activityByDate,
  todayStr,
  targets,
  profile,
}: {
  foodByDate: FoodByDate;
  activityByDate: ActivityByDate;
  todayStr: string;
  targets: DailyTargets;
  profile: import('@/stores/log-store').ProfileRow | null;
}) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [metricId, setMetricId] = useState('protein');
  const [periodDays, setPeriodDays] = useState(30);
  const [expanded, setExpanded] = useState(false);
  const [compactW, setCompactW] = useState(0);
  const [expW, setExpW] = useState(0);
  const [selIdx, setSelIdx] = useState<number | null>(null);

  const sheetY = useRef(new Animated.Value(0)).current;

  const dismiss = () => {
    Animated.timing(sheetY, { toValue: screenHeight, duration: 220, useNativeDriver: true }).start(() => {
      sheetY.setValue(0);
      setExpanded(false);
      setSelIdx(null);
    });
  };

  const panRef = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
    onPanResponderMove: (_, gs) => { if (gs.dy > 0) sheetY.setValue(gs.dy); },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80 || gs.vy > 0.5) dismiss();
      else Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    },
  })).current;

  const metric = LIFESTYLE_METRICS.find(m => m.id === metricId) ?? LIFESTYLE_METRICS[0];

  const effectiveDays = useMemo(() => {
    if (periodDays !== -1) return periodDays;
    const startStr = profile?.program_start_date;
    if (startStr) {
      const msAgo = Date.now() - new Date(startStr).getTime();
      return Math.max(7, Math.ceil(msAgo / 86400000));
    }
    const allDates = [...Object.keys(foodByDate), ...Object.keys(activityByDate)];
    if (allDates.length === 0) return 30;
    const earliest = allDates.sort()[0];
    const msAgo = Date.now() - new Date(earliest + 'T12:00:00').getTime();
    return Math.max(7, Math.ceil(msAgo / 86400000));
  }, [periodDays, profile, foodByDate, activityByDate]);

  const { dates, values, target, hitRate, average, trendPct, bestStreak } = useMemo(() => {
    const ds = Array.from({ length: effectiveDays }, (_, i) => {
      const d = new Date(todayStr + 'T12:00:00');
      d.setDate(d.getDate() - (effectiveDays - 1 - i));
      return d.toISOString().slice(0, 10);
    });
    const vs = ds.map(d => metric.getValue(foodByDate, activityByDate, d));
    const tgt = metric.getTarget(targets);
    const withData = vs.filter(v => v !== null) as number[];
    const hr = withData.length ? withData.filter(v => v >= tgt).length / withData.length : 0;
    const avg = withData.length ? withData.reduce((s, v) => s + v, 0) / withData.length : 0;
    const mid = Math.floor(withData.length / 2);
    const firstHalf = mid > 0 ? withData.slice(0, mid).reduce((s, v) => s + v, 0) / mid : 0;
    const secondHalf = mid > 0 ? withData.slice(mid).reduce((s, v) => s + v, 0) / (withData.length - mid) : 0;
    const tp = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
    let cur = 0, best = 0;
    vs.forEach(v => { if (v !== null && v >= tgt) { cur++; best = Math.max(best, cur); } else cur = 0; });
    return { dates: ds, values: vs, target: tgt, hitRate: hr, average: avg, trendPct: tp, bestStreak: best };
  }, [effectiveDays, todayStr, metric, foodByDate, activityByDate, targets]);

  const hasData = values.some(v => v !== null);

  const compact = useMemo(
    () => ltComputeChart(values, target, LT_COMPACT_H, Math.max(0, compactW - LT_TML - LT_TMR)),
    [values, target, compactW],
  );
  const exp = useMemo(
    () => ltComputeChart(values, target, LT_EXP_H, Math.max(0, expW - LT_TML - LT_TMR)),
    [values, target, expW],
  );
  const compactLabels = useMemo(
    () => ltXLabels(dates, Math.max(0, compactW - LT_TML - LT_TMR), effectiveDays),
    [dates, compactW, effectiveDays],
  );
  const expLabels = useMemo(
    () => ltXLabels(dates, Math.max(0, expW - LT_TML - LT_TMR), effectiveDays),
    [dates, expW, effectiveDays],
  );

  const hitRateColor = hitRate >= 0.7 ? '#27AE60' : hitRate >= 0.4 ? '#F6CB45' : '#E74C3C';
  const hitRatePct = Math.round(hitRate * 100);
  const fmtVal = (v: number) =>
    metric.unit === 'kcal' || metric.unit === 'steps' ? Math.round(v).toLocaleString() : v.toFixed(0);
  const trendSign = trendPct >= 0 ? '+' : '';
  const selValue = selIdx !== null ? values[selIdx] : null;
  const selDate = selIdx !== null ? dates[selIdx] : null;

  // ── Scrub hooks ──────────────────────────────────────────────────────────
  const validIndices = useMemo(
    () => values.map((v, i) => (v !== null ? i : -1)).filter(i => i >= 0),
    [values],
  );

  const ltTooltipFormatter = useCallback((idx: number) => {
    const v = values[idx];
    const d = dates[idx];
    if (v === null || !d) return { title: '', subtitle: '' };
    const formatted = metric.unit === 'kcal' || metric.unit === 'steps'
      ? Math.round(v).toLocaleString()
      : v.toFixed(0);
    return {
      title: `${formatted} ${metric.unit}`,
      subtitle: d,
      badge: v >= target
        ? { text: 'On target', color: '#27AE60' }
        : { text: `${Math.abs(((v - target) / target) * 100).toFixed(0)}% below`, color: '#E74C3C' },
    };
  }, [values, dates, metric, target]);

  const openExpanded = useCallback(() => setExpanded(true), []);

  const ltCompactScrub = useChartScrub({
    points: compact.pts,
    chartWidth: compactW,
    marginLeft: LT_TML,
    marginRight: LT_TMR,
    mode: 'longpress-or-tap',
    onTap: openExpanded,
    enabled: hasData && compactW > 0,
    validIndices,
  });

  const ltExpScrub = useChartScrub({
    points: exp.pts,
    chartWidth: expW,
    marginLeft: LT_TML,
    marginRight: LT_TMR,
    mode: 'longpress-only',
    enabled: hasData && expW > 0 && expanded,
    validIndices,
  });

  // Sync expanded scrub → selIdx
  useAnimatedReaction(
    () => ltExpScrub.activeIndex.value,
    (idx) => {
      reanimatedRunOnJS(setSelIdx)(idx >= 0 ? idx : null);
    },
    [ltExpScrub.activeIndex],
  );

  function renderMetricPills(onSelect: (id: string) => void) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingRight: 4 }}
        style={{ marginBottom: 8 }}
      >
        {LIFESTYLE_METRICS.map(m => (
          <Pressable
            key={m.id}
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); onSelect(m.id); setSelIdx(null); }}
            style={{
              paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
              backgroundColor: metricId === m.id ? m.color : 'rgba(255,255,255,0.08)',
            }}
          >
            <Text style={{
              fontSize: 11, fontWeight: '600', fontFamily: 'Helvetica Neue',
              color: metricId === m.id ? '#FFF' : 'rgba(255,255,255,0.45)',
            }}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  function renderPeriodTabs() {
    return (
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
        {LT_PERIODS.map(p => (
          <Pressable
            key={p.label}
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setPeriodDays(p.days); }}
            style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
              backgroundColor: periodDays === p.days ? 'rgba(255,255,255,0.15)' : 'transparent',
            }}
          >
            <Text style={{
              fontSize: 11, fontWeight: '600', fontFamily: 'Helvetica Neue',
              color: periodDays === p.days ? '#FFF' : 'rgba(255,255,255,0.35)',
            }}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  function renderChart(
    chartH: number,
    data: ReturnType<typeof ltComputeChart>,
    w: number,
    labels: { x: number; label: string }[],
    gradId: string,
  ) {
    if (!hasData) {
      return (
        <View style={{ height: chartH, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Helvetica Neue' }}>
            Start logging to see data
          </Text>
        </View>
      );
    }
    if (w <= 0) return <View style={{ height: chartH }} />;
    const plotH = chartH - LT_TMT - LT_TMB;
    const yRange = data.maxVal - data.minVal || 1;
    const lastValidPt = [...data.pts].reverse().find(p => p.valid) ?? null;
    return (
      <Svg width={w} height={chartH}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={metric.color} stopOpacity="0.18" />
            <Stop offset="1" stopColor={metric.color} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Y-axis gridlines + labels */}
        {data.yTicks.map(tick => {
          const y = LT_TMT + plotH * (1 - (tick - data.minVal) / yRange);
          const label = metric.unit === 'steps'
            ? tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : String(Math.round(tick))
            : String(Math.round(tick));
          return (
            <React.Fragment key={`y-${tick}`}>
              <Line x1={LT_TML} y1={y} x2={w - LT_TMR} y2={y}
                stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="3,4" />
              <SvgText x={LT_TML - 6} y={y + 3.5}
                fontSize={9} fill="rgba(255,255,255,0.35)"
                textAnchor="end" fontFamily="Helvetica Neue">
                {label}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* X-axis vertical tick lines + labels */}
        {labels.map((lbl, i) => (
          <React.Fragment key={i}>
            <Line x1={lbl.x} y1={LT_TMT} x2={lbl.x} y2={LT_TMT + plotH}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            <SvgText x={lbl.x} y={chartH - 5}
              fontSize={9} fill="rgba(255,255,255,0.35)"
              textAnchor="middle" fontFamily="Helvetica Neue">
              {lbl.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Area fill */}
        {data.areaPath ? <Path d={data.areaPath} fill={`url(#${gradId})`} /> : null}

        {/* Line */}
        {data.linePath ? (
          <Path d={data.linePath} stroke={metric.color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}

        {/* Goal line with label */}
        {data.goalY > LT_TMT && data.goalY < LT_TMT + plotH && (
          <>
            <Line x1={LT_TML} y1={data.goalY} x2={w - LT_TMR} y2={data.goalY}
              stroke={metric.color} strokeWidth={1} strokeDasharray="5,4" strokeOpacity="0.5" />
            <SvgText x={w - LT_TMR - 3} y={data.goalY - 3}
              fontSize={8} fill={metric.color} fillOpacity={0.6}
              textAnchor="end" fontFamily="Helvetica Neue">
              Goal
            </SvgText>
          </>
        )}

        {/* Dots for all valid data points */}
        {data.pts.filter(p => p.valid).map((pt, i) => (
          <Circle key={i} cx={pt.x} cy={pt.y} r={3} fill={metric.color} opacity={0.7} />
        ))}
        {/* Highlighted dot for last valid data point */}
        {lastValidPt && (
          <>
            <Circle cx={lastValidPt.x} cy={lastValidPt.y} r={7} fill={`${metric.color}33`} />
            <Circle cx={lastValidPt.x} cy={lastValidPt.y} r={4} fill={metric.color} />
          </>
        )}
      </Svg>
    );
  }

  return (
    <>
      {/* ── Compact Card ── */}
      <View
        style={{
          borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          padding: 14,
        }}
      >
        {/* Period tabs — top */}
        {renderPeriodTabs()}
        {/* Chart with scrub */}
        <GestureDetector gesture={ltCompactScrub.gesture}>
          <View style={{ height: LT_COMPACT_H, position: 'relative' }} onLayout={e => setCompactW(e.nativeEvent.layout.width)}>
            {compactW > 0 && renderChart(LT_COMPACT_H, compact, compactW, compactLabels, 'ltGradCompact')}
            {compactW > 0 && (
              <ChartScrubOverlay
                activeIndex={ltCompactScrub.activeIndex}
                isActive={ltCompactScrub.isActive}
                crosshairX={ltCompactScrub.crosshairX}
                crosshairY={ltCompactScrub.crosshairY}
                chartHeight={LT_COMPACT_H}
                chartWidth={compactW}
                color={metric.color}
                formatTooltip={ltTooltipFormatter}
              />
            )}
          </View>
        </GestureDetector>
        {/* Metric pills — bottom */}
        {renderMetricPills(setMetricId)}
        {/* Footer stats */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Helvetica Neue' }}>
            Avg {hasData ? fmtVal(average) : '--'} {metric.unit}/day
          </Text>
          {hasData && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: `${hitRateColor}22` }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: hitRateColor, fontFamily: 'Helvetica Neue' }}>
                {hitRatePct}% on target
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Expanded Modal (glassmorphism) ── */}
      <Modal visible={expanded} transparent animationType="none" onRequestClose={dismiss}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={dismiss}
          />
          <Animated.View
            style={{
              height: screenHeight * 0.82,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              overflow: 'hidden',
              transform: [{ translateY: sheetY }],
            }}
          >
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.07)' }]} />

            {/* Drag handle */}
            <View
              {...panRef.panHandlers}
              style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 12 }}
            >
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' }} />
            </View>

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: -0.5, fontFamily: 'Helvetica Neue' }}>
                {metric.label} Trend
              </Text>
              <Pressable onPress={dismiss} hitSlop={12}>
                <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            >
              {/* Period tabs — top */}
              {renderPeriodTabs()}

              {/* Chart with scrub */}
              <GestureDetector gesture={ltExpScrub.gesture}>
                <View style={{ position: 'relative' }}>
                  <View style={{ height: LT_EXP_H }} onLayout={e => setExpW(e.nativeEvent.layout.width)}>
                    {expW > 0 && renderChart(LT_EXP_H, exp, expW, expLabels, 'ltGradExp')}
                  </View>
                  {expW > 0 && (
                    <ChartScrubOverlay
                      activeIndex={ltExpScrub.activeIndex}
                      isActive={ltExpScrub.isActive}
                      crosshairX={ltExpScrub.crosshairX}
                      crosshairY={ltExpScrub.crosshairY}
                      chartHeight={LT_EXP_H}
                      chartWidth={expW}
                      color={metric.color}
                      formatTooltip={ltTooltipFormatter}
                    />
                  )}
                </View>
              </GestureDetector>

              {/* Metric pills — below chart */}
              {renderMetricPills(setMetricId)}

              {/* Selected point tooltip */}
              {selValue !== null && selDate !== null && (
                <View style={{ marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'Helvetica Neue' }}>{selDate}</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFF', fontFamily: 'Helvetica Neue', marginTop: 2 }}>
                    {fmtVal(selValue)} {metric.unit}
                  </Text>
                  <Text style={{
                    fontSize: 12, fontWeight: '600', fontFamily: 'Helvetica Neue', marginTop: 2,
                    color: selValue >= target ? '#27AE60' : '#E74C3C',
                  }}>
                    {selValue >= target
                      ? 'On target ✓'
                      : `${Math.abs(((selValue - target) / target) * 100).toFixed(0)}% below target`}
                  </Text>
                </View>
              )}

              {/* Insights panel */}
              {hasData && (
                <View style={{ marginTop: 16 }}>
                  {/* Hit rate */}
                  <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ fontSize: 56, fontWeight: '800', color: hitRateColor, fontFamily: 'Helvetica Neue', lineHeight: 60 }}>
                      {hitRatePct}%
                    </Text>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'Helvetica Neue' }}>
                      of days on target
                    </Text>
                  </View>

                  {/* Stat chips */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[
                      { value: fmtVal(average), sub: `avg ${metric.unit}/day`, color: '#FFF' },
                      { value: `${trendSign}${trendPct.toFixed(0)}%`, sub: 'trend vs prior', color: trendPct >= 0 ? '#27AE60' : '#E74C3C' },
                      { value: `${bestStreak}d`, sub: 'best streak', color: '#FFF' },
                    ].map((chip, i) => (
                      <View key={i} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: chip.color, fontFamily: 'Helvetica Neue' }}>{chip.value}</Text>
                        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: 'Helvetica Neue', marginTop: 2, textAlign: 'center' }}>{chip.sub}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Contextual text */}
                  <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)' }}>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'Helvetica Neue', lineHeight: 20 }}>
                      {hitRatePct >= 70
                        ? `You're consistently hitting your ${metric.label.toLowerCase()} target. Keep it up!`
                        : hitRatePct >= 40
                        ? `You're hitting your ${metric.label.toLowerCase()} target ${hitRatePct}% of the time. Small improvements can add up.`
                        : `Your ${metric.label.toLowerCase()} is below target most days. Focus here to maximize your GLP-1 results.`}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { onScroll, onScrollEnd } = useTabBarVisibility();
  const health = useHealthData();
  const { actuals, targets } = health;
  const { weightLogs, injectionLogs, foodLogs, activityLogs, sideEffectLogs, profile, deleteInjectionLog, deleteWeightLog, weeklyCheckins, peerComparison, fetchInsightsData } = useLogStore();
  const hkStore = useHealthKitStore();
  const { appleHealthEnabled } = usePreferencesStore();
  const biometricStore = useBiometricStore();
  const { profile: fullProfile } = useProfile();
  const onTreatment = isOnTreatment(fullProfile);
  const [activeTab, setActiveTab] = useState<Tab>(onTreatment ? 'medication' : 'lifestyle');
  const { openAiChat, insightsDefaultTab, setInsightsDefaultTab } = useUiStore();

  // Allow external navigation to a specific tab (e.g. after food logging)
  useFocusEffect(useCallback(() => {
    if (insightsDefaultTab) {
      setActiveTab(insightsDefaultTab);
      setInsightsDefaultTab(null);
    }
  }, [insightsDefaultTab]));

  const handleBackgroundLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tabChips: Record<string, string[]> = {
      medication: ['Explain my drug levels', 'When should I inject?', 'What side effects should I watch for?', 'Is my medication working?'],
      lifestyle: ['How am I doing on nutrition?', 'Am I active enough?', 'What lifestyle changes matter most?', 'What do my biometrics show?'],
      progress: ['Am I on pace for my goal?', 'Is my weight loss healthy?', 'When will I reach my goal?', 'How does my progress compare?'],
    };
    openAiChat({ chips: JSON.stringify(tabChips[activeTab] ?? tabChips.medication) });
  }, [openAiChat, activeTab]);

  // ── Today filters ──────────────────────────────────────────────────────────
  const todayStr = localDateStr();
  const todayFoodLogs = foodLogs.filter(f => localDateStr(new Date(f.logged_at)) === todayStr);
  const todayActivityLogs = activityLogs.filter(a => a.date === todayStr);

  // ── Lifestyle metrics ──────────────────────────────────────────────────────
  const todayProteinG = Math.round(todayFoodLogs.reduce((s, f) => s + f.protein_g, 0));
  const todayFiberG = Math.round(todayFoodLogs.reduce((s, f) => s + f.fiber_g, 0));
  const todayCarbsG = Math.round(todayFoodLogs.reduce((s, f) => s + f.carbs_g, 0));
  const todayActiveCalories = Math.round(todayActivityLogs.reduce((s, a) => s + (a.active_calories ?? 0), 0));
  const todaySteps = todayActivityLogs.reduce((s, a) => s + (a.steps ?? 0), 0);

  // ── Historical aggregations ────────────────────────────────────────────────
  const foodByDate = useMemo(() => {
    const map: Record<string, { protein: number; carbs: number; fat: number; calories: number; fiber: number }> = {};
    foodLogs.forEach(log => {
      const date = localDateStr(new Date(log.logged_at));
      if (!map[date]) map[date] = { protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0 };
      map[date].protein  += log.protein_g;
      map[date].carbs    += log.carbs_g;
      map[date].fat      += log.fat_g;
      map[date].calories += log.calories;
      map[date].fiber    += log.fiber_g;
    });
    return map;
  }, [foodLogs]);

  const activityByDate = useMemo(() => {
    const map: Record<string, { steps: number; calories: number }> = {};
    activityLogs.forEach(log => {
      if (!map[log.date]) map[log.date] = { steps: 0, calories: 0 };
      map[log.date].steps    += log.steps ?? 0;
      map[log.date].calories += log.active_calories ?? 0;
    });
    return map;
  }, [activityLogs]);

  const proteinPct = targets.proteinG > 0 ? Math.round((todayProteinG / targets.proteinG) * 100) : 0;
  const fiberPct = targets.fiberG > 0 ? Math.round((todayFiberG / targets.fiberG) * 100) : 0;
  const waterOz = Math.round(actuals.waterMl / 29.57);
  const waterTargetOz = Math.round(targets.waterMl / 29.57);
  const waterPct = targets.waterMl > 0 ? Math.round((actuals.waterMl / targets.waterMl) * 100) : 0;
  const carbsPct = targets.carbsG > 0 ? Math.round((todayCarbsG / targets.carbsG) * 100) : 0;

  // ── Lifestyle logs ─────────────────────────────────────────────────────────
  const lifestyleLogs: LogEntry[] = [
    ...todayFoodLogs.map(foodToEntry),
    ...todayActivityLogs.map(activityToEntry),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // ── Medication data ────────────────────────────────────────────────────────
  const lastInj = injectionLogs[0] ?? null;
  const lastSite = lastInj?.site ?? null;
  const rotateTo = nextSite(lastSite);
  const lastDosage = lastInj ? `${lastInj.dose_mg}mg` : '-';
  const injTimestamp = lastInj?.injection_date
    ? (lastInj.injection_time
        ? `${lastInj.injection_date}T${lastInj.injection_time}`
        : `${lastInj.injection_date}T00:00:00`)
    : null;
  const lastDaysSince = (() => {
    if (!injTimestamp) return 0;
    const injMs = new Date(injTimestamp).getTime();
    if (isNaN(injMs)) return 0;
    const diff = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(injTimestamp).setHours(0, 0, 0, 0)) / 86400000) + 1;
    // Cap at 30 days - beyond that the chart is meaningless anyway
    return Math.max(1, Math.min(diff, 30));
  })();
  const nextInjLabel = lastInj
    ? nextInjectionLabel(lastInj.injection_date, profile?.injection_frequency_days ?? 7)
    : '-';
  const isDailyDrug = DRUG_DEFAULT_FREQ_DAYS[health.profile.glp1Type] === 1;
  const oral = isOralDrug(health.profile.glp1Type);
  const hasInjectionData = isDailyDrug || !!lastInj;
  const hoursElapsed = (() => {
    if (!injTimestamp) return 0;
    const injMs = new Date(injTimestamp).getTime();
    if (isNaN(injMs)) return 0;
    return Math.max(0, (Date.now() - injMs) / 3600000); // ms → hours
  })();
  const medChartData: number[] | null = hasInjectionData
    ? isDailyDrug
      ? generateIntradayPkCurve(health.profile.glp1Type)
      : generatePkCurveHighRes(
          health.profile.glp1Type,
          health.profile.glp1Status === 'active',
          health.profile.injectionFrequencyDays ?? 7,
          28,
        )
    : null;
  const medDayLabels = isDailyDrug
    ? INTRADAY_TIME_LABELS
    : pkCycleLabels(health.profile.injectionFrequencyDays ?? 7);
  const cycleHours = (health.profile.injectionFrequencyDays ?? 7) * 24;
  const currentCyclePct = isDailyDrug
    ? null
    : Math.min(1, hoursElapsed / cycleHours);
  const currentConcentrationPct = isDailyDrug
    ? null
    : Math.round(pkConcentrationPct(
        Math.min(hoursElapsed, cycleHours),
        health.profile.glp1Type,
        health.profile.glp1Status === 'active',
        cycleHours,
      ));
  const medicationLogs: LogEntry[] = injectionLogs.slice(0, 5).map(inj => injectionToEntry(inj, oral));

  // ── Shot phase (needed for biometric baseline exclusion) ───────────────────
  const currentShotPhase = getShotPhase(Math.min(lastDaysSince, 7));

  // ── Refresh data on tab focus ───────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    fetchInsightsData();
    if (!appleHealthEnabled) return;
    biometricStore.recordDayEntry({
      dateStr: todayStr,
      hrvMs: hkStore.hrv,
      restingHR: hkStore.restingHR,
      sleepMinutes: hkStore.sleepHours != null ? Math.round(hkStore.sleepHours * 60) : null,
      shotPhase: currentShotPhase,
      pkConcentrationPct: currentConcentrationPct ?? null,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appleHealthEnabled, hkStore.hrv, hkStore.restingHR, hkStore.sleepHours, currentShotPhase]));

  // ── CycleIQ intelligence ───────────────────────────────────────────────────
  const cycleIntelligenceResult = useMemo(
    () => computeCycleIntelligence(
      biometricStore.baseline,
      { hrv: hkStore.hrv, restingHR: hkStore.restingHR, sleepHours: hkStore.sleepHours },
      currentShotPhase,
      lastDaysSince > 0 ? lastDaysSince : null,
      health.profile.glp1Type,
    ),
    [biometricStore.baseline, hkStore.hrv, hkStore.restingHR, hkStore.sleepHours, currentShotPhase, lastDaysSince, health.profile.glp1Type],
  );

  const cycleiqContextStr = useMemo(
    () => buildCycleBiometricContext(
      cycleIntelligenceResult,
      lastDaysSince > 0 ? lastDaysSince : null,
      currentShotPhase,
      health.profile.glp1Type,
    ),
    [cycleIntelligenceResult, lastDaysSince, currentShotPhase, health.profile.glp1Type],
  );

  // ── Metabolic adaptation ───────────────────────────────────────────────────
  const metabolicAdaptationResult = useMemo(
    () => computeMetabolicAdaptationScore(
      activityLogs,
      weightLogs,
      biometricStore.history.map(h => ({ dateStr: h.dateStr, restingHR: h.restingHR })),
    ),
    [activityLogs, weightLogs, biometricStore.history],
  );

  // ── Progress data ──────────────────────────────────────────────────────────
  // Prefer Supabase-persisted profile fields; fall back to in-memory onboarding profile
  const heightIn    = (profile?.height_inches
                      ?? (health.profile.heightFt * 12 + health.profile.heightIn)) || null;
  const startWeight = (profile?.start_weight_lbs
                      ?? health.profile.startWeightLbs) || null;
  const goalWeight  = (profile?.goal_weight_lbs
                      ?? health.profile.goalWeightLbs) || null;
  const currentWeight = weightLogs[0]?.weight_lbs ?? startWeight;
  const bmi        = currentWeight && heightIn ? computeBMI(currentWeight, heightIn) : null;
  const startBmi   = startWeight && heightIn   ? computeBMI(startWeight, heightIn)   : null;
  const rawBmiDelta = bmi && startBmi ? Math.round((startBmi - bmi) * 10) / 10 : null;
  const bmiDelta   = rawBmiDelta !== 0 ? rawBmiDelta : null;
  const toGoalPct  = startWeight && currentWeight && goalWeight
    ? goalProgress(startWeight, currentWeight, goalWeight)
    : null;

  const weightLost = startWeight != null && currentWeight != null && startWeight > currentWeight
    ? Math.round((startWeight - currentWeight) * 10) / 10
    : null;
  const weightLostPct = weightLost != null && startWeight
    ? Math.round((weightLost / startWeight) * 1000) / 10
    : null;

  const weightDatasets: Record<string, WeightPoint[]> = {
    '7D':  weightDataForPeriod(weightLogs, '7D'),
    '14D': weightDataForPeriod(weightLogs, '14D'),
    '30D': weightDataForPeriod(weightLogs, '30D'),
    '90D': weightDataForPeriod(weightLogs, '90D'),
    'MAX': weightDataForPeriod(weightLogs, 'MAX'),
  };

  // ── Weight projection ──────────────────────────────────────────────────────
  const programStartDate = profile?.program_start_date ?? null;
  const programWeek = useMemo(() => {
    const refDateStr = programStartDate ?? weightLogs[weightLogs.length - 1]?.logged_at ?? null;
    if (!refDateStr) return 1;
    return Math.max(1, Math.round((Date.now() - new Date(refDateStr).getTime()) / (7 * 86400000)));
  }, [programStartDate, weightLogs]);

  const projection = useMemo<WeightProjection | null>(() => {
    if (weightLogs.length < 2 || !startWeight || !currentWeight || !goalWeight) return null;
    return computeWeightProjection({
      startWeightLbs: startWeight,
      currentWeightLbs: currentWeight,
      goalWeightLbs: goalWeight,
      weightLogHistory: weightLogs.map(l => ({ weight_lbs: l.weight_lbs, logged_at: l.logged_at })),
      programWeek,
      medicationType: health.profile.glp1Type,
      doseMg: health.profile.doseMg,
      sex: health.profile.sex,
      heightCm: health.profile.heightCm,
      targetWeeklyLossLbs: health.profile.targetWeeklyLossLbs ?? 1.0,
    });
  }, [weightLogs, startWeight, currentWeight, goalWeight, programWeek, health.profile]);

  // ── Clinical trial benchmark ──────────────────────────────────────────────
  const benchmarkResult = useMemo(
    () => computeClinicalBenchmark(weightLogs, programStartDate, health.profile.glp1Type),
    [weightLogs, programStartDate, health.profile.glp1Type],
  );

  const progressLogs: LogEntry[] = weightLogs.slice(0, 5).map((log, i) =>
    weightToEntry(log, weightLogs[i + 1])
  );

  // Weekly check-in last completed date
  const lastCheckinLoggedAt = useMemo(() => {
    if (!weeklyCheckins) return null;
    const allEntries = Object.values(weeklyCheckins).flat();
    if (allEntries.length === 0) return null;
    const allDates = allEntries.map((c: any) => c.logged_at as string).filter(Boolean);
    return allDates.length > 0 ? allDates.reduce((a: string, b: string) => (a > b ? a : b)) : null;
  }, [weeklyCheckins]);

  const startDate = profile?.program_start_date
    ? new Date(profile.program_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : (weightLogs.length > 0
      ? new Date(weightLogs[weightLogs.length - 1].logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '-');
  const currentDate = weightLogs[0]
    ? new Date(weightLogs[0].logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '-';

  return (
    <TabScreenWrapper>
    <Pressable style={{ flex: 1, backgroundColor: colors.bg }} onLongPress={handleBackgroundLongPress} delayLongPress={600}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          onScrollEndDrag={onScrollEnd}
          onMomentumScrollEnd={onScrollEnd}
          scrollEventThrottle={16}
        >
          <Pressable onLongPress={handleBackgroundLongPress} delayLongPress={600}>

          {/* ── Header ── */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Insights</Text>
          </View>

          {/* ── Segmented Control ── */}
          <SegmentedControl active={activeTab} onChange={setActiveTab} colors={colors} tabs={onTreatment ? TABS : TABS.filter(t => t.key !== 'medication')} />
          {/* <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 6, marginBottom: 4 }}>
            <Ionicons name="chatbubble-ellipses-outline" size={11} color={colors.textMuted} />
            <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: 'Helvetica Neue' }}>
              Hold any card to ask AI
            </Text>
          </View> */}

          {/* ── Lifestyle content ── */}
          {activeTab === 'lifestyle' && (
            <>
              {/* <AIInsightsCard /> */}

              {/* ── Lifestyle Trend Card ── */}
              <LifestyleTrendCard
                foodByDate={foodByDate}
                activityByDate={activityByDate}
                todayStr={todayStr}
                targets={targets}
                profile={profile}
              />

              <Text style={s.sectionTitle}>Daily Metrics</Text>
              <View style={s.dailyGrid}>
                <DailyMetricCard
                  icon={<MaterialIcons name="restaurant" size={20} color={ORANGE} />}
                  label="Protein" value={`${todayProteinG}/${targets.proteinG}g`}
                  change={`${proteinPct}%`}
                  status={proteinPct >= 80 ? 'positive' : proteinPct >= 40 ? 'neutral' : 'negative'}
                  pct={proteinPct / 100}
                />
                <DailyMetricCard
                  icon={<Ionicons name="leaf-outline" size={20} color={ORANGE} />}
                  label="Fiber" value={`${todayFiberG}/${targets.fiberG}g`}
                  change={`${fiberPct}%`}
                  status={fiberPct >= 80 ? 'positive' : fiberPct >= 40 ? 'neutral' : 'negative'}
                  pct={fiberPct / 100}
                />
                <DailyMetricCard
                  icon={<Ionicons name="water-outline" size={20} color={ORANGE} />}
                  label="Hydration" value={`${waterOz}/${waterTargetOz}oz`}
                  change={`${waterPct}%`}
                  status={waterPct >= 80 ? 'positive' : waterPct >= 40 ? 'neutral' : 'negative'}
                  pct={waterPct / 100}
                />
                <DailyMetricCard
                  icon={<MaterialIcons name="grain" size={20} color={ORANGE} />}
                  label="Carbs" value={`${todayCarbsG}/${targets.carbsG}g`}
                  change={`${carbsPct}%`}
                  status={carbsPct >= 80 ? 'positive' : carbsPct >= 40 ? 'neutral' : 'negative'}
                  pct={carbsPct / 100}
                />
                <ActivityDailyCard
                  value={todayActiveCalories > 0 ? todayActiveCalories.toLocaleString() : '-'}
                  label="Calories Burned"
                  ringColor={ORANGE}
                  emptyCtaLabel="Log Activity"
                  onEmptyCta={() => router.push('/entry/log-activity')}
                />
                <ActivityDailyCard
                  value={todaySteps > 0 ? todaySteps.toLocaleString() : '-'}
                  label="Daily Steps"
                  ringColor={colors.textPrimary}
                  emptyCtaLabel="Log Activity"
                  onEmptyCta={() => router.push('/entry/log-activity')}
                />
              </View>

              {/* ── Wearables ── */}
              <Text style={[s.sectionTitle, { marginTop: 8 }]}>Wearables</Text>
              {!appleHealthEnabled ? (
                <WearablesConnectPrompt />
              ) : (
                <View style={s.hmGrid}>
                  {(() => {
                    const rhrVal    = hkStore.restingHR ?? null;
                    const hrvVal    = hkStore.hrv ?? null;
                    const hkSleep   = hkStore.sleepHours ?? null;
                    const sleepMin  = hkSleep != null ? Math.round(hkSleep * 60) : null;
                    const hkGlucose = hkStore.bloodGlucose ?? null;

                    const metrics: HealthMetric[] = [];
                    if (sleepMin != null) metrics.push({ id: 'sleep', label: 'Sleep', value: fmtSleep(sleepMin), unit: '', status: hmSleepStatus(sleepMin), iconSet: 'Ionicons', iconName: 'moon-outline', rangeLabel: hmSleepLabel(sleepMin), gaugePosition: hmGaugePos('sleep', sleepMin) });
                    if (rhrVal != null) metrics.push({ id: 'rhr', label: 'Resting HR', value: String(rhrVal), unit: 'bpm', status: hmRhrStatus(rhrVal), iconSet: 'Ionicons', iconName: 'heart-outline', rangeLabel: hmRhrLabel(rhrVal), gaugePosition: hmGaugePos('rhr', rhrVal) });
                    if (hrvVal != null) metrics.push({ id: 'hrv', label: 'HRV', value: String(hrvVal), unit: 'ms', status: hmHrvStatus(hrvVal), iconSet: 'MaterialIcons', iconName: 'show-chart', rangeLabel: hmHrvLabel(hrvVal), gaugePosition: hmGaugePos('hrv', hrvVal) });
                    if (hkGlucose != null) metrics.push({ id: 'glucose', label: 'Blood Glucose', value: String(hkGlucose), unit: 'mg/dL', status: hkGlucose < 100 ? 'good' : hkGlucose < 125 ? 'normal' : 'elevated', iconSet: 'MaterialIcons', iconName: 'water-drop', rangeLabel: hkGlucose < 100 ? 'Normal' : hkGlucose < 125 ? 'Pre-range' : 'High', gaugePosition: hmGaugePos('glucose', hkGlucose) });

                    if (metrics.length === 0) return (
                      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Helvetica Neue', paddingVertical: 8 }}>
                        No wearable data available yet. Wear your Apple Watch to see sleep, heart rate, and more.
                      </Text>
                    );

                    const isOdd = metrics.length % 2 !== 0;
                    return metrics.map((m, i) => (
                      <HealthMonitorCard key={m.id} metric={m} fullWidth={isOdd && i === metrics.length - 1} />
                    ));
                  })()}
                </View>
              )}
              <RecentLogsCard entries={lifestyleLogs} />
            </>
          )}

          {/* ── Medication content ── */}
          {activeTab === 'medication' && (
            <>
              {/* <MedAIInsightsCard /> */}
              <MedLevelChartCard
                chartData={medChartData}
                daysSince={lastDaysSince}
                dayLabels={medDayLabels}
                glp1Type={health.profile.glp1Type}
                medicationBrand={health.profile.medicationBrand}
                isDailyDrug={isDailyDrug}
                currentCyclePct={currentCyclePct}
                currentConcentrationPct={currentConcentrationPct}
                injFreqDays={health.profile.injectionFrequencyDays ?? 7}
                injTimestamp={injTimestamp}
              />
              <SideEffectsCard logs={sideEffectLogs} />
              {appleHealthEnabled && (hkStore.hrv != null || hkStore.restingHR != null || hkStore.sleepHours != null) && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: 8 }]}>Cycle Biometrics</Text>
                  <CycleBiometricCard
                    result={cycleIntelligenceResult}
                    cycleiqContext={cycleiqContextStr}
                  />
                </>
              )}
              <Text style={s.sectionTitle}>{oral ? 'Dose Details' : 'Injection Details'}</Text>
              <View style={[s.dailyGrid, { marginBottom: 24 }]}>
                {!oral && (
                  <InjectionCard
                    icon={<Ionicons name="body-outline" size={20} color={ORANGE} />}
                    label="Last Injection Site"
                    value={lastSite ?? '-'}
                  />
                )}
                {!oral && (
                  <InjectionCard
                    icon={<Ionicons name="sync-outline" size={20} color={ORANGE} />}
                    label="Rotate To"
                    value={rotateTo}
                  />
                )}
                <InjectionCard
                  icon={<FontAwesome5 name={doseIconName(oral)} size={18} color={ORANGE} />}
                  label="Last Dosage"
                  value={lastDosage}
                />
                <InjectionCard
                  icon={<Ionicons name="calendar-outline" size={20} color={ORANGE} />}
                  label={oral ? 'Next Dose' : 'Next Injection'}
                  value={nextInjLabel}
                />
              </View>
              <RecentLogsCard entries={medicationLogs} onDelete={(id) => {
                Alert.alert('Delete Log', 'Remove this dose entry?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteInjectionLog(id) },
                ]);
              }} />
            </>
          )}

          {/* ── Progress content ── */}
          {activeTab === 'progress' && (
            <>
              {/* <ProgAIInsightsCard /> */}
              <WeightProjectionCard
                projection={projection ?? null}
                datasets={weightDatasets}
                currentWeight={currentWeight}
                programWeek={programWeek}
              />
              <WeightGoalCard
                projection={projection ?? null}
                currentWeight={currentWeight}
                goalWeight={goalWeight}
                toGoalPct={toGoalPct}
              />
              <ClinicalBenchmarkCard result={benchmarkResult} medicationBrand={health.profile.medicationBrand} />
              <MetabolicAdaptationCard result={metabolicAdaptationResult} />
              <PeerComparisonCard
                data={peerComparison}
                isOptedIn={!!profile?.peer_comparison_opted_in}
              />
              <View style={s.dailyGrid}>
                <ProgressStatCard
                  icon={<MaterialIcons name="fitness-center" size={20} color={ORANGE} />}
                  label="Current BMI"
                  value={bmi != null ? String(bmi) : '-'}
                >
                  {bmiDelta != null && bmiDelta > 0 && (
                    <View style={[s.changeBadge, { backgroundColor: statusStyle.positive.bg }]}>
                      <Text style={[s.changeText, { color: statusStyle.positive.text }]}>↓ Down {bmiDelta} pts</Text>
                    </View>
                  )}
                </ProgressStatCard>

                <ProgressStatCard
                  icon={<MaterialIcons name="trending-down" size={20} color={ORANGE} />}
                  label="Lost So Far"
                  value={weightLost != null ? `${weightLost} lbs` : '-'}
                >
                  {weightLostPct != null && weightLostPct > 0 && (
                    <View style={[s.changeBadge, { backgroundColor: statusStyle.positive.bg }]}>
                      <Text style={[s.changeText, { color: statusStyle.positive.text }]}>↓ {weightLostPct}% of body wt</Text>
                    </View>
                  )}
                </ProgressStatCard>
              </View>
              <RecentLogsCard entries={progressLogs} onDelete={(id) => {
                Alert.alert('Delete Weight Log', 'Remove this weight entry?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteWeightLog(id) },
                ]);
              }} />
              <View style={{ marginTop: 16 }}>
                <Text style={[s.sectionTitle, { marginBottom: 12 }]}>Weekly Check-In</Text>
                <WeeklyCheckinCard lastLoggedAt={lastCheckinLoggedAt} />
              </View>
            </>
          )}

          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Pressable>
    </TabScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  headerTitle: { fontSize: 36, fontWeight: '800', color: c.textPrimary, letterSpacing: -1, fontFamily: 'Helvetica Neue' },


  // Card base
  cardWrap: { borderRadius: 24 },
  cardBody: { overflow: 'hidden' },

  // AI Insights
  aiAccent: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, backgroundColor: ORANGE, borderTopLeftRadius: 24, borderBottomLeftRadius: 24 },
  aiContent: { paddingVertical: 18, paddingLeft: 20, paddingRight: 18 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  aiLabel: { fontSize: 11, fontWeight: '700', color: ORANGE, letterSpacing: 1.5, marginLeft: 6, textTransform: 'uppercase', fontFamily: 'Helvetica Neue' },
  aiBody: { fontSize: 14, color: w(0.6), lineHeight: 21, fontFamily: 'Helvetica Neue' },

  // Metrics row
  metricsRow: { flexDirection: 'row', gap: 20, marginBottom: 24, paddingHorizontal: 4 },
  metricWrap: { flex: 1, borderRadius: 22 },
  metricInner: { padding: 18, alignItems: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 15, fontWeight: '800', letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },
  metricLabel: { fontSize: 12, color: w(0.45), fontWeight: '500', textAlign: 'center', fontFamily: 'Helvetica Neue' },

  // Daily Metrics grid
  sectionTitle: { fontSize: 20, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, marginBottom: 14, fontFamily: 'Helvetica Neue' },
  dailyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dailyWrap: { width: '47.5%', borderRadius: 20 },
  dailyInner: { padding: 16 },
  dailyTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dailyIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  changeText: { fontSize: 10, fontWeight: '700', fontFamily: 'Helvetica Neue' },
  dailyLabel: { fontSize: 12, color: w(0.45), fontWeight: '500', marginBottom: 3, fontFamily: 'Helvetica Neue' },
  dailyValue: { fontSize: 22, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },

  // Medication chart card
  chartMuted: { fontSize: 12, color: w(0.45), fontWeight: '500', fontFamily: 'Helvetica Neue' },
  chartBig: { fontSize: 28, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },
  dayLabel: { fontSize: 10, fontWeight: '600', color: w(0.35), letterSpacing: 0.5, fontFamily: 'Helvetica Neue' },

  // Education sections (expanded modal)
  eduTitle: { fontSize: 15, fontWeight: '700' as const, color: c.textPrimary, fontFamily: 'Helvetica Neue', marginBottom: 10 },
  eduBody: { fontSize: 14, color: w(0.6), lineHeight: 21, fontFamily: 'Helvetica Neue' },
  eduSubtitle: { fontSize: 12, fontStyle: 'italic' as const, color: w(0.4), marginBottom: 8, fontFamily: 'Helvetica Neue' },
  eduDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginBottom: 20 },

  // Progress chart
  progPeriodRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  progPeriodBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  progPeriodBtnActive: { backgroundColor: ORANGE },
  progPeriodLabel: { fontSize: 12, fontWeight: '700', color: w(0.35), fontFamily: 'Helvetica Neue' },
  progPeriodLabelActive: { color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  progCurrentDotRing: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: c.bg },
  progGoalLabel: { fontSize: 10, fontWeight: '600', color: w(0.35), fontFamily: 'Helvetica Neue' },

  // Progress stat card
  progStatSub: { marginTop: 6 },
  progBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,116,42,0.15)', marginTop: 6, overflow: 'hidden' },
  progBarFill: { height: 6, backgroundColor: ORANGE, borderRadius: 3 },

  // Recent Logs card
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
  logHeaderText: { fontSize: 16, fontWeight: '700', color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  logCountBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(255,116,42,0.12)' },
  logCountText: { fontSize: 11, fontWeight: '700', color: ORANGE, fontFamily: 'Helvetica Neue' },
  logEntryList: { paddingHorizontal: 18, paddingBottom: 14 },
  logDivider: { height: 1, backgroundColor: w(0.06) },
  logEntryRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  logEntryIconWrap: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logEntryTitle: { fontSize: 13, fontWeight: '700', color: c.textPrimary, flex: 1, fontFamily: 'Helvetica Neue' },
  logEntryTime: { fontSize: 11, color: w(0.35), fontWeight: '500', flexShrink: 0, marginLeft: 8, fontFamily: 'Helvetica Neue' },
  logEntryDetails: { fontSize: 12, color: w(0.45), lineHeight: 18, marginTop: 3, fontFamily: 'Helvetica Neue' },
  logImpactTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  logImpactText: { fontSize: 10, fontWeight: '700', fontFamily: 'Helvetica Neue' },

  // Health Monitor
  hmGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  hmWrap: { width: '47.5%', borderRadius: 20 },
  hmBody: { overflow: 'hidden', borderWidth: 0.5, borderColor: c.border },
  hmInner: { padding: 16 },
  hmTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  hmBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  hmBadgeText: { fontSize: 9, fontWeight: '700', fontFamily: 'Helvetica Neue' },
  hmLabel: { fontSize: 12, color: w(0.45), fontWeight: '500', marginBottom: 3, fontFamily: 'Helvetica Neue' },
  hmValue: { fontSize: 22, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },
  hmUnit: { fontSize: 13, fontWeight: '500', color: w(0.45), letterSpacing: 0, fontFamily: 'Helvetica Neue' },
  });
};
