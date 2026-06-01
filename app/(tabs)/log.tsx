import { Maximize2, XCircle, Zap, TrendingUp, ChevronRight, ChevronDown, Check, Frown, MessageCircle, Heart, Syringe, Pill } from 'lucide-react-native';
import { LucideIconByName } from '@/lib/lucide-icon-map';
import Svg, { Path, Circle, Line, Rect, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, LayoutAnimation, LayoutChangeEvent, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/ui/gradient-background';
import { SlidingTabs } from '@/components/ui/sliding-tabs';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';
import { useHealthData } from '@/contexts/health-data';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { categoryColor, healthCategoryColor, ORANGE } from '@/constants/theme';
import { useInsightsAiStore } from '@/stores/insights-ai-store';
import { generatePkCurveHighRes, generateIntradayPkCurve, pkCycleLabels, pkConcentrationPct, DRUG_HALF_LIFE_LABEL, DRUG_DEFAULT_FREQ_DAYS, DRUG_IS_ORAL, INTRADAY_TIME_LABELS, isOralDrug, doseNoun } from '@/constants/drug-pk';
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
  buildCycleBiometricContext,
} from '@/lib/cycle-intelligence';
import { CycleBiometricCard } from '@/components/cycle-biometric-card';
import { BodyCompositionCard } from '@/components/body-composition-card';
import { ClinicalBenchmarkCard } from '@/components/clinical-benchmark-card';
import { LeanMassPreservationCard } from '@/components/lean-mass-preservation-card';
import { PremiumGate } from '@/components/ui/premium-gate';
import { LifestyleInsightsCard } from '@/components/lifestyle-insights-card';
import { CategoryRow } from '@/components/insights/category-row';
import { useLifestyleMetrics } from '@/hooks/use-lifestyle-metrics';
import { computeFatToLeanRatio, bodyCompTrendData, computeLeanPreservation } from '@/lib/body-composition';
import { computeClinicalBenchmark } from '@/stores/insights-store';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedReaction, runOnJS as reanimatedRunOnJS, FadeIn } from 'react-native-reanimated';
import { useChartScrub } from '@/hooks/useChartScrub';
import { ChartScrubOverlay } from '@/components/chart-scrub-overlay';
import { smoothPath, niceYTicks } from '@/lib/chart-utils';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScrollTitle } from '@/components/ui/scroll-title';


// ─── Health Monitor types + helpers ──────────────────────────────────────────

export type HMStatus = 'good' | 'normal' | 'low' | 'elevated';
export type HealthMetric = {
  id: string; label: string; value: string; unit: string;
  status: HMStatus; lucideIcon: string; rangeLabel: string;
  gaugePosition: number | null;
  /** True when we track this metric but have no data yet — rendered greyed out. */
  noData?: boolean;
};
function hmRhrStatus(bpm: number): HMStatus { return bpm < 55 ? 'good' : bpm < 70 ? 'normal' : 'elevated'; }
function hmRhrLabel(bpm: number): string { return bpm < 55 ? 'Optimal' : bpm < 70 ? 'Normal' : 'Elevated'; }
function hmHrvStatus(ms: number): HMStatus { return ms >= 50 ? 'good' : ms >= 30 ? 'normal' : 'low'; }
function hmHrvLabel(ms: number): string { return ms >= 50 ? 'Strong' : ms >= 30 ? 'Normal' : 'Low'; }
function hmSleepStatus(min: number): HMStatus { return min >= 420 ? 'good' : min >= 360 ? 'normal' : 'low'; }
function hmSleepLabel(min: number): string { return min >= 420 ? 'On Target' : min >= 360 ? 'Normal' : 'Below Goal'; }
// Steps
function hmStepsStatus(n: number): HMStatus { return n >= 10000 ? 'good' : n >= 6000 ? 'normal' : 'low'; }
function hmStepsLabel(n: number): string { return n >= 10000 ? 'Active' : n >= 6000 ? 'Normal' : 'Below Goal'; }
// Active calories
function hmCalStatus(n: number): HMStatus { return n >= 400 ? 'good' : n >= 200 ? 'normal' : 'low'; }
function hmCalLabel(n: number): string { return n >= 400 ? 'Active' : n >= 200 ? 'Normal' : 'Low'; }
// Weight — no good/bad, just informational
function hmWeightStatus(): HMStatus { return 'normal'; }
function hmWeightLabel(): string { return 'Latest'; }
// Body fat
function hmBodyFatStatus(pct: number): HMStatus { return pct <= 20 ? 'good' : pct <= 30 ? 'normal' : 'elevated'; }
function hmBodyFatLabel(pct: number): string { return pct <= 20 ? 'Lean' : pct <= 30 ? 'Normal' : 'High'; }
// Lean mass — informational
function hmLeanMassStatus(): HMStatus { return 'normal'; }
function hmLeanMassLabel(): string { return 'Latest'; }
// Waist — informational
function hmWaistStatus(): HMStatus { return 'normal'; }
function hmWaistLabel(): string { return 'Latest'; }
// BMI
function hmBmiStatus(v: number): HMStatus { return v < 18.5 ? 'low' : v < 25 ? 'good' : v < 30 ? 'normal' : 'elevated'; }
function hmBmiLabel(v: number): string { return v < 18.5 ? 'Underweight' : v < 25 ? 'Normal' : v < 30 ? 'Overweight' : 'Obese'; }
// VO2 Max
function hmVo2Status(v: number): HMStatus { return v >= 45 ? 'good' : v >= 35 ? 'normal' : 'low'; }
function hmVo2Label(v: number): string { return v >= 45 ? 'Excellent' : v >= 35 ? 'Normal' : 'Below Avg'; }
// SpO2
function hmSpo2Status(v: number): HMStatus { return v >= 96 ? 'good' : v >= 92 ? 'normal' : 'low'; }
function hmSpo2Label(v: number): string { return v >= 96 ? 'Normal' : v >= 92 ? 'Borderline' : 'Low'; }
// Blood pressure
function hmBpStatus(sys: number): HMStatus { return sys < 120 ? 'good' : sys < 140 ? 'normal' : 'elevated'; }
function hmBpLabel(sys: number): string { return sys < 120 ? 'Normal' : sys < 140 ? 'Elevated' : 'High'; }
// Exercise minutes
function hmExMinStatus(v: number): HMStatus { return v >= 30 ? 'good' : v >= 15 ? 'normal' : 'low'; }
function hmExMinLabel(v: number): string { return v >= 30 ? 'On Target' : v >= 15 ? 'Normal' : 'Below Goal'; }
// Water
function hmWaterStatus(oz: number): HMStatus { return oz >= 64 ? 'good' : oz >= 32 ? 'normal' : 'low'; }
function hmWaterLabel(oz: number): string { return oz >= 64 ? 'On Target' : oz >= 32 ? 'Normal' : 'Low'; }
// Respiratory rate
function hmRespRateStatus(v: number): HMStatus { return v >= 12 && v <= 20 ? 'good' : v > 20 ? 'elevated' : 'low'; }
function hmRespRateLabel(v: number): string { return v >= 12 && v <= 20 ? 'Normal' : v > 20 ? 'Elevated' : 'Low'; }
// Distance
function hmDistanceStatus(mi: number): HMStatus { return mi >= 5 ? 'good' : mi >= 2 ? 'normal' : 'low'; }
function hmDistanceLabel(mi: number): string { return mi >= 5 ? 'Active' : mi >= 2 ? 'Normal' : 'Low'; }
// Flights climbed
function hmFlightsStatus(n: number): HMStatus { return n >= 10 ? 'good' : n >= 5 ? 'normal' : 'low'; }
function hmFlightsLabel(n: number): string { return n >= 10 ? 'Active' : n >= 5 ? 'Normal' : 'Low'; }
// Mindful minutes
function hmMindfulStatus(m: number): HMStatus { return m >= 15 ? 'good' : m >= 5 ? 'normal' : 'low'; }
function hmMindfulLabel(m: number): string { return m >= 15 ? 'Great' : m >= 5 ? 'Good Start' : 'Low'; }
// TDEE (basal + active)
function hmTdeeStatus(cal: number): HMStatus { return cal >= 1800 ? 'good' : cal >= 1400 ? 'normal' : 'low'; }
function hmTdeeLabel(cal: number): string { return cal >= 1800 ? 'Normal' : cal >= 1400 ? 'Low' : 'Very Low'; }
// Glucose time-in-range
function hmTirStatus(pct: number): HMStatus { return pct >= 70 ? 'good' : pct >= 50 ? 'normal' : 'low'; }
function hmTirLabel(pct: number): string { return pct >= 70 ? 'On Target' : pct >= 50 ? 'Needs Work' : 'Low'; }
function fmtSleep(min: number): string { return `${Math.floor(min / 60)}h ${min % 60}m`; }
// Workout type name cleanup
function fmtWorkoutType(raw: string): string {
  return raw.replace('HKWorkoutActivityType', '').replace(/([A-Z])/g, ' $1').trim();
}
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
    case 'rhr':       return c(1 - (rawVal - 40) / 55);        // 40-95 bpm, lower = top
    case 'hrv':       return c((rawVal - 15) / 85);             // 15-100 ms, higher = top
    case 'sleep':     return c((rawVal - 240) / 360);           // 4h-10h, higher = top
    case 'spo2':      return c((rawVal - 88) / 12);             // 88-100%, higher = top
    case 'glucose':   return c(1 - (rawVal - 70) / 80);        // 70-150, lower = top
    case 'steps':     return c(rawVal / 15000);                 // 0-15k, higher = top
    case 'activeCal': return c(rawVal / 800);                   // 0-800 kcal
    case 'weight':    return 0.5;                               // informational
    case 'bodyFat':   return c(1 - (rawVal - 5) / 40);         // 5-45%, lower = top
    case 'leanMass':  return 0.5;                               // informational
    case 'waist':     return 0.5;                               // informational
    case 'bmi':       return c(1 - (rawVal - 15) / 25);        // 15-40, lower = top
    case 'vo2max':    return c((rawVal - 20) / 40);             // 20-60, higher = top
    case 'bp':        return c(1 - (rawVal - 90) / 70);        // 90-160 sys, lower = top
    case 'exMin':     return c(rawVal / 60);                    // 0-60 min
    case 'water':     return c(rawVal / 100);                   // 0-100 fl oz
    case 'respRate':  return c(1 - Math.abs(rawVal - 16) / 12); // 16 bpm ideal, penalize deviation
    case 'distance':  return c(rawVal / 8);                     // 0-8 miles
    case 'flights':   return c(rawVal / 20);                    // 0-20 flights
    case 'mindful':   return c(rawVal / 30);                    // 0-30 min
    case 'tdee':      return c((rawVal - 1000) / 2000);         // 1000-3000 kcal
    case 'tir':       return c(rawVal / 100);                   // 0-100%
    default:          return 0.5;
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
export function HealthMonitorCard({ metric, fullWidth }: { metric: HealthMetric; fullWidth?: boolean }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { openAiChat } = useUiStore();
  const noData = metric.noData;
  const mutedBg = colors.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const mutedText = colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  const ss = noData ? { bg: mutedBg, text: mutedText } : hmStatusStyle[metric.status];
  const iconColor = noData
    ? (colors.isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)')
    : (colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)');
  const icon = <LucideIconByName name={metric.lucideIcon} size={16} color={iconColor} />;
  const contextValue = `${metric.value}${metric.unit ? ' ' + metric.unit : ''} · ${metric.rangeLabel}`;

  // No-data cards are passive placeholders — no AI long-press, dimmed styling.
  if (noData) {
    return (
      <View style={[s.hmWrap, fullWidth && { flexBasis: '100%' }, { opacity: 0.55 }]} accessibilityLabel={`${metric.label}, no data yet`}>
        <View style={[s.hmBody, { borderRadius: 20, backgroundColor: colors.surface }]}>
          <View style={[s.hmInner, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                {icon}
                <Text style={[s.hmLabel, { marginBottom: 0 }]}>{metric.label}</Text>
              </View>
              <Text style={[s.hmValue, { color: mutedText }]}>—</Text>
              <View style={[s.hmBadge, { backgroundColor: mutedBg, alignSelf: 'flex-start', marginTop: 10 }]}>
                <Text style={[s.hmBadgeText, { color: mutedText }]}>No data</Text>
              </View>
            </View>
            <GaugeBar position={null} color={mutedText} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <Pressable style={[s.hmWrap, fullWidth && { flexBasis: '100%' }]} onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openAiChat({ type: 'metric', contextLabel: metric.label, contextValue, chips: JSON.stringify(['How can I improve this?', 'Is this normal for my phase?', `How does GLP-1 affect ${metric.label}?`, 'What trends should I watch?']) }); }} accessibilityRole="button" accessibilityLabel={`${metric.label}, ${metric.value} ${metric.unit}, ${metric.rangeLabel}. Long press to ask AI`}>
      <View style={[s.hmBody, { borderRadius: 20, backgroundColor: colors.surface }]}>
        <View style={[s.hmInner, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
          {/* Left: content */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              {icon}
              <Text style={[s.hmLabel, { marginBottom: 0 }]}>{metric.label}</Text>
            </View>
            <Text style={s.hmValue}>{metric.value}{metric.unit ? <Text style={s.hmUnit}> {metric.unit}</Text> : null}</Text>
            <View style={[s.hmBadge, { backgroundColor: ss.bg, alignSelf: 'flex-start', marginTop: 10 }]}>
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
    return [...logs]
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
      .map(l => ({ weight: l.weight_lbs, date: l.logged_at }));
  }
  const days = { '7D': 7, '14D': 14, '30D': 30, '90D': 90 }[period];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  return logs
    .filter(l => l.logged_at >= since)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    .map(l => ({ weight: l.weight_lbs, date: l.logged_at }));
}

// smoothPath and niceYTicks imported from @/lib/chart-utils

function xAxisLabels(_data: WeightPoint[], period: string, plotW: number, tStart?: number, tEnd?: number): { x: number; label: string }[] {
  const now = Date.now();
  const periodDays = { '7D': 7, '14D': 14, '30D': 30, '90D': 90, 'MAX': -1 }[period] ?? 30;
  const rangeStart = tStart ?? (period === 'MAX' && _data.length > 0 ? new Date(_data[0].date).getTime() : now - (periodDays > 0 ? periodDays : 90) * 86400000);
  const rangeEnd = tEnd ?? now;
  const rangeMs = Math.max(rangeEnd - rangeStart, 1);

  const maxLabels = 5;
  const labels: { x: number; label: string }[] = [];
  for (let i = 0; i < maxLabels; i++) {
    const frac = i / (maxLabels - 1);
    const t = rangeStart + frac * rangeMs;
    const d = new Date(t);
    let label: string;
    if (period === 'MAX') {
      label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    } else {
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    labels.push({ x: frac * plotW, label });
  }
  return labels;
}

// ─── Lifestyle Trend helpers ──────────────────────────────────────────────────

type FoodByDate = Record<string, {
  protein: number; carbs: number; fat: number; calories: number; fiber: number;
  sodium_mg: number; sugar_g: number; saturated_fat_g: number; cholesterol_mg: number;
}>;
type ActivityByDate = Record<string, { steps: number; calories: number }>;

type MetricConfig = {
  id: string;
  label: string;
  unit: string;
  color: string;
  getTarget: (t: DailyTargets) => number;
  getValue: (f: FoodByDate, a: ActivityByDate, d: string) => number | null;
  /** When true, "on target" means staying UNDER the target (sodium, sugar, etc.) */
  inverseGoal?: boolean;
};

// Phase 2 default targets for Premier metrics; Phase 3 wires these to user_goals.
// Sodium 2300mg = FDA daily limit. Sugar 50g = FDA added-sugar daily value.
// Sat fat 22g ≈ 10% of 2000 kcal (AHA). Cholesterol 300mg = general guidance.
export const DEFAULT_SODIUM_MG = 2300;
export const DEFAULT_SUGAR_G = 50;
export const DEFAULT_SAT_FAT_G = 22;
export const DEFAULT_CHOLESTEROL_MG = 300;
// Extended nutrient default targets, FDA Daily Values / dietary guidance:
// Trans fat — keep as low as possible (2g reference). Added sugars 50g = FDA DV.
// Poly/mono fat have no RDA; references ≈ 10%/20% of 2000 kcal. Potassium 3400mg,
// Calcium 1300mg, Iron 18mg, Vitamin A 900mcg, Vitamin C 90mg, Vitamin D 20mcg = DVs.
export const DEFAULT_TRANS_FAT_G = 2;
export const DEFAULT_POLY_FAT_G = 22;
export const DEFAULT_MONO_FAT_G = 44;
export const DEFAULT_POTASSIUM_MG = 3400;
export const DEFAULT_ADDED_SUGARS_G = 50;
export const DEFAULT_VITAMIN_A_MCG = 900;
export const DEFAULT_VITAMIN_C_MG = 90;
export const DEFAULT_VITAMIN_D_MCG = 20;
export const DEFAULT_CALCIUM_MG = 1300;
export const DEFAULT_IRON_MG = 18;

const LIFESTYLE_METRICS: MetricConfig[] = [
  { id: 'protein',     label: 'Protein',    unit: 'g',     color: '#FF742A', getTarget: t => t.proteinG,             getValue: (f, _, d) => f[d]?.protein ?? null },
  { id: 'carbs',       label: 'Carbs',      unit: 'g',     color: '#5B8BF5', getTarget: t => t.carbsG,               getValue: (f, _, d) => f[d]?.carbs ?? null },
  { id: 'fat',         label: 'Fat',        unit: 'g',     color: '#F6CB45', getTarget: t => t.fatG,                 getValue: (f, _, d) => f[d]?.fat ?? null },
  { id: 'fiber',       label: 'Fiber',      unit: 'g',     color: '#27AE60', getTarget: t => t.fiberG,               getValue: (f, _, d) => f[d]?.fiber ?? null },
  { id: 'calories',    label: 'Calories',   unit: 'cal',   color: '#C084FC', getTarget: t => t.caloriesTarget,       getValue: (f, _, d) => f[d]?.calories ?? null },
  { id: 'sodium',      label: 'Sodium',     unit: 'mg',    color: '#FF6B6B', getTarget: _t => DEFAULT_SODIUM_MG,      getValue: (f, _, d) => f[d]?.sodium_mg ?? null,        inverseGoal: true },
  { id: 'sugar',       label: 'Sugar',      unit: 'g',     color: '#E879F9', getTarget: _t => DEFAULT_SUGAR_G,        getValue: (f, _, d) => f[d]?.sugar_g ?? null,          inverseGoal: true },
  { id: 'sat_fat',     label: 'Sat Fat',    unit: 'g',     color: '#F59E0B', getTarget: _t => DEFAULT_SAT_FAT_G,      getValue: (f, _, d) => f[d]?.saturated_fat_g ?? null,  inverseGoal: true },
  { id: 'cholesterol', label: 'Cholesterol',unit: 'mg',    color: '#A78BFA', getTarget: _t => DEFAULT_CHOLESTEROL_MG, getValue: (f, _, d) => f[d]?.cholesterol_mg ?? null,   inverseGoal: true },
  { id: 'steps',       label: 'Steps',      unit: 'steps', color: '#FF742A', getTarget: t => t.steps,                getValue: (_, a, d) => a[d]?.steps ?? null },
  { id: 'active_cal',  label: 'Active Cal', unit: 'cal',   color: '#5B8BF5', getTarget: t => t.activeCaloriesTarget, getValue: (_, a, d) => a[d]?.calories ?? null },
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

function activityIcon(exerciseType: string | null | undefined): React.ReactElement {
  const t = (exerciseType ?? '').toLowerCase();
  let lucideName = 'Zap';
  if (t.includes('run') || t.includes('jog'))      lucideName = 'Activity';
  else if (t.includes('walk'))                      lucideName = 'Footprints';
  else if (t.includes('cycl') || t.includes('bike')) lucideName = 'Bike';
  else if (t.includes('swim'))                      lucideName = 'Waves';
  else if (t.includes('yoga') || t.includes('stretch')) lucideName = 'Brain';
  else if (t.includes('strength') || t.includes('weight') || t.includes('lift')) lucideName = 'Dumbbell';
  else if (t.includes('hike'))                      lucideName = 'Mountain';
  else if (t.includes('dance'))                     lucideName = 'Music';
  else if (t.includes('sport') || t.includes('tennis') || t.includes('basketball') || t.includes('soccer')) lucideName = 'Trophy';
  return <LucideIconByName name={lucideName} size={20} color={ORANGE_LOG} />;
}

function foodToEntry(f: FoodLog): LogEntry {
  const details = `${Math.round(f.calories)} cal · ${Math.round(f.protein_g)}g protein · ${Math.round(f.fiber_g)}g fiber · ${Math.round(f.carbs_g)}g carbs`;
  const impact = `+${Math.round(f.protein_g)}g protein, +${Math.round(f.carbs_g)}g carbs, +${Math.round(f.fiber_g)}g fiber`;
  return {
    id: f.id, timestamp: fmtDateTime(f.logged_at), rawDate: localDateStr(new Date(f.logged_at)),
    title: f.food_name, details, impact, impactStatus: 'positive',
    icon: <IconSymbol name="fork.knife" size={20} color={ORANGE_LOG} />,
    kind: 'food',
  };
}

function activityToEntry(a: ActivityLog): LogEntry {
  const durationStr = a.duration_min ? `${a.duration_min} min` : '';
  const stepsStr = a.steps ? `${a.steps.toLocaleString()} steps` : '';
  const calStr = a.active_calories ? `${a.active_calories} cal burned` : '';
  const details = [durationStr, stepsStr, calStr].filter(Boolean).join(' · ') || 'Activity logged';
  const impact = `Steps ${a.steps ? `+${a.steps.toLocaleString()}` : '-'} · Calories ${a.active_calories ? `+${a.active_calories}` : '-'}`;
  return {
    id: a.id, timestamp: fmtDateOnly(a.date), rawDate: a.date,
    title: a.exercise_type ?? 'Activity', details, impact, impactStatus: 'positive',
    icon: activityIcon(a.exercise_type),
    kind: 'activity',
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
    id: inj.id, timestamp: fmtDateOnly(inj.injection_date), rawDate: inj.injection_date,
    title: `${medName} ${inj.dose_mg}mg`,
    details, impact, impactStatus: 'neutral',
    icon: oral ? <Pill size={18} color={ORANGE_LOG} /> : <Syringe size={18} color={ORANGE_LOG} />,
    kind: 'medication',
  };
}

function weightToEntry(log: WeightLog, prevLog?: WeightLog): LogEntry {
  const delta = prevLog ? Math.round((log.weight_lbs - prevLog.weight_lbs) * 10) / 10 : 0;
  const deltaStr = delta < 0 ? `Down ${Math.abs(delta)} lbs` : delta > 0 ? `Up ${delta} lbs` : 'Steady';
  return {
    id: log.id, timestamp: fmtDateTime(log.logged_at), rawDate: localDateStr(new Date(log.logged_at)),
    title: `Weight Log - ${log.weight_lbs} lbs`,
    details: `${log.weight_lbs} lbs · ${deltaStr} from last entry`,
    impact: delta <= 0 ? deltaStr : `Up ${Math.abs(delta)} lbs`,
    impactStatus: delta < 0 ? 'positive' : delta > 0 ? 'negative' : 'neutral',
    icon: <IconSymbol name="scalemass.fill" size={20} color={ORANGE_LOG} />,
    kind: 'weight',
  };
}

function sideEffectToEntry(se: SideEffectLog): LogEntry {
  const label = se.effect_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const sevLabel = se.severity <= 3 ? 'Mild' : se.severity <= 6 ? 'Moderate' : 'Severe';
  const details = `Severity: ${se.severity}/10${se.notes ? ` · ${se.notes}` : ''}`;
  return {
    id: se.id, timestamp: fmtDateTime(se.logged_at), rawDate: localDateStr(new Date(se.logged_at)),
    title: label, details, impact: sevLabel,
    impactStatus: se.severity <= 3 ? 'neutral' : 'negative',
    icon: <Frown size={20} color={ORANGE_LOG} />,
    kind: 'side_effect',
  };
}

// ─── Segmented control ────────────────────────────────────────────────────────

type Tab = 'medication' | 'lifestyle' | 'progress';

const TABS: { key: Tab; label: string }[] = [
  { key: 'medication', label: 'Medication' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'progress', label: 'Progress' },
];

// Which log categories each Insights tab surfaces in its Today's Logs card. Mirrored
// in log-history.tsx (TAB_KINDS) so the scoped "See Full History" link matches.
const TAB_LOG_KINDS: Record<Tab, LogKind[]> = {
  medication: ['medication', 'side_effect'],
  lifestyle: ['food', 'activity'],
  progress: ['weight'],
};

// SegmentedControl replaced by SlidingTabs component

// ─── Ring indicator ───────────────────────────────────────────────────────────

function RingIndicator({ size = 88, strokeWidth = 7, color = ORANGE, pct = 1 }: { size?: number; strokeWidth?: number; color?: string; pct?: number }) {
  const { colors } = useAppTheme();
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clampedPct = Math.min(Math.max(pct, 0), 1);
  const dashOffset = circumference * (1 - clampedPct);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
          strokeWidth={strokeWidth} fill="none"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </Svg>
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
          <Text style={[s.aiLabel, { color: colors.textPrimary, fontSize: 19, fontWeight: '700', letterSpacing: -0.3, textTransform: 'none', marginBottom: 10 }]}>Analysis</Text>
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
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: colors.isDark ? 8 : 2 }, shadowOpacity: colors.isDark ? 0.3 : 0.06, shadowRadius: colors.isDark ? 24 : 8, elevation: colors.isDark ? 8 : 2 }), [colors]);
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
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.orange, fontFamily: 'System' }}>
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

export function ActivityDailyCard({ value, label, ringColor, current = 0, target = 0, unit = '', emptyCtaLabel, onEmptyCta, onIncrement, onDecrement }: {
  value: string; label: string; ringColor: string;
  current?: number; target?: number; unit?: string;
  emptyCtaLabel?: string; onEmptyCta?: () => void;
  onIncrement?: () => void; onDecrement?: () => void;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: colors.isDark ? 8 : 2 }, shadowOpacity: colors.isDark ? 0.3 : 0.06, shadowRadius: colors.isDark ? 24 : 8, elevation: colors.isDark ? 8 : 2 }), [colors]);
  const { openAiChat } = useUiStore();
  const isEmpty = value === '-';
  const pct = target > 0 ? current / target : (isEmpty ? 0 : 1);
  const remaining = target > 0 ? Math.max(0, target - current) : 0;
  const btnBg = colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const btnTxt = colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';

  const handleAskAI = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openAiChat({ type: 'metric', contextLabel: label, contextValue: value,
      chips: JSON.stringify(['Is this on track for my goals?', 'How can I improve this?', 'How does GLP-1 affect this?']) });
  };

  return (
    <Pressable style={[s.dailyWrap, glassShadow]} onLongPress={handleAskAI} delayLongPress={400} accessibilityRole="button" accessibilityLabel={`${label}, ${isEmpty ? 'no data' : value}${target > 0 ? `, ${remaining > 0 ? `${remaining.toLocaleString()}${unit} to go` : 'goal reached'}` : ''}. Long press to ask AI`}>
      <View style={[s.cardBody, { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border, flex: 1 }]}>
        <View style={[s.dailyInner, { flex: 1 }]}>
          <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <RingIndicator size={64} strokeWidth={5} pct={pct} color={isEmpty ? (colors.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)') : ringColor} />
            <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: isEmpty ? (colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)') : ringColor, letterSpacing: -0.3, fontFamily: 'System' }}>
                {isEmpty ? '–' : value}
              </Text>
            </View>
          </View>
          <Text style={s.dailyLabel}>{label}</Text>
          {!isEmpty && target > 0 && (
            <Text style={{ fontSize: 12, color: w(0.4), fontFamily: 'System', marginTop: 3 }}>
              {remaining > 0 ? `${remaining.toLocaleString()}${unit} to go` : 'Goal reached'}
            </Text>
          )}
          {isEmpty && emptyCtaLabel && onEmptyCta && (
            <Pressable onPress={onEmptyCta} style={{ marginTop: 10, backgroundColor: 'rgba(255,116,42,0.10)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.orange, fontFamily: 'System' }}>{emptyCtaLabel}</Text>
            </Pressable>
          )}
          {(onIncrement || onDecrement) && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 'auto', paddingTop: 12 }}>
              {onDecrement && (
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDecrement(); }}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: btnBg, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${label}`}
                >
                  <Text style={{ fontSize: 20, fontWeight: '700', color: btnTxt, marginTop: -1 }}>−</Text>
                </Pressable>
              )}
              {onIncrement && (
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onIncrement(); }}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,116,42,0.12)', alignItems: 'center', justifyContent: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${label}`}
                >
                  <Text style={{ fontSize: 20, fontWeight: '700', color: colors.orange, marginTop: -1 }}>+</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Daily metric card (2×2 grid) ────────────────────────────────────────────

type Status = 'positive' | 'negative' | 'neutral';

// Category each entry belongs to — vocabulary matches log-history's FilterType so
// the per-tab scoping in both screens stays in sync.
type LogKind = 'food' | 'activity' | 'weight' | 'medication' | 'side_effect';

type LogEntry = {
  id: string;
  timestamp: string;
  rawDate: string; // YYYY-MM-DD for grouping
  title: string;
  details: string;
  impact: string;
  impactStatus: Status;
  icon: React.ReactElement;
  kind: LogKind;
};

const statusStyle: Record<Status, { bg: string; text: string }> = {
  positive: { bg: 'rgba(43,148,80,0.15)', text: '#2B9450' },
  negative: { bg: 'rgba(220,50,50,0.15)', text: '#DC3232' },
  neutral: { bg: 'rgba(150,150,150,0.10)', text: '#9A9490' },
};

export function DailyMetricCard({
  icon, label, value, change, status, pct, onIncrement, onDecrement, onPress,
}: {
  icon: React.ReactNode; label: string; value: string; change: string; status: Status; pct: number;
  onIncrement?: () => void; onDecrement?: () => void; onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: colors.isDark ? 8 : 2 }, shadowOpacity: colors.isDark ? 0.3 : 0.06, shadowRadius: colors.isDark ? 24 : 8, elevation: colors.isDark ? 8 : 2 }), [colors]);
  const ss = statusStyle[status];
  const { openAiChat } = useUiStore();
  const handleAskAI = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openAiChat({ type: 'metric', contextLabel: label, contextValue: `${value} · ${change}`, chips: JSON.stringify(['Is this on track?', 'How can I improve this?', `Why is my ${label.toLowerCase()} important on GLP-1?`]) });
  };
  const trackColor = colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const btnBg = colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const btnTxt = colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
  return (
    <Pressable style={[s.dailyWrap, glassShadow, { minHeight: 184 }]} onPress={onPress} onLongPress={handleAskAI} accessibilityRole="button" accessibilityLabel={`${label}, ${value}, ${change}. Long press to ask AI`}>
      <View style={[s.cardBody, { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border, flex: 1 }]}>
        <View style={[s.dailyInner, { flex: 1 }]}>
          <View style={s.dailyIconWrap}>{icon}</View>
          <Text style={s.dailyLabel}>{label}</Text>
          <Text style={s.dailyValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
          <View style={{ height: 3, borderRadius: 2, backgroundColor: trackColor, marginTop: 10, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(pct, 1) * 100}%`, height: 3, borderRadius: 2, backgroundColor: ss.text }} />
          </View>
          {(onIncrement || onDecrement) && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 12 }}>
              {onDecrement && (
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDecrement(); }}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: btnBg, alignItems: 'center', justifyContent: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${label}`}
                >
                  <Text style={{ fontSize: 20, fontWeight: '700', color: btnTxt, marginTop: -1 }}>−</Text>
                </Pressable>
              )}
              {onIncrement && (
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onIncrement(); }}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,116,42,0.12)', alignItems: 'center', justifyContent: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${label}`}
                >
                  <Text style={{ fontSize: 20, fontWeight: '700', color: colors.orange, marginTop: -1 }}>+</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Combined Premier Nutrition Card ─────────────────────────────────────────

export function PremierNutritionCard({
  metrics,
}: {
  metrics: { label: string; current: number; target: number; unit: string; color: string; onIncrement: () => void; onDecrement: () => void }[];
}) {
  const { colors } = useAppTheme();
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: colors.isDark ? 8 : 2 }, shadowOpacity: colors.isDark ? 0.3 : 0.06, shadowRadius: colors.isDark ? 24 : 8, elevation: colors.isDark ? 8 : 2 }), [colors]);
  const trackColor = colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const btnBg = colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const btnTxt = colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
  const labelColor = colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const valueColor = colors.isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)';

  return (
    <View style={[{ width: '100%', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border, padding: 16, gap: 14 }, glassShadow]}>
      {metrics.map((m, i) => {
        const pct = m.target > 0 ? Math.min(m.current / m.target, 1) : 0;
        // Inverse status: green under 80%, neutral 80-100%, red over
        const rawPct = m.target > 0 ? (m.current / m.target) * 100 : 0;
        const barColor = rawPct <= 80 ? '#2B9450' : rawPct <= 100 ? '#9A9490' : '#DC3232';
        return (
          <View key={m.label}>
            {i > 0 && <View style={{ height: 0.5, backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', marginBottom: 14 }} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {/* Minus button */}
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); m.onDecrement(); }}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: btnBg, alignItems: 'center', justifyContent: 'center' }}
                accessibilityRole="button"
                accessibilityLabel={`Decrease ${m.label}`}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: btnTxt, marginTop: -1 }}>−</Text>
              </Pressable>
              {/* Label + bar + value */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, fontFamily: 'System' }}>{m.label}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: valueColor, fontFamily: 'System' }}>{m.current}/{m.target}{m.unit}</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: trackColor, overflow: 'hidden' }}>
                  <View style={{ width: `${pct * 100}%`, height: 6, borderRadius: 3, backgroundColor: barColor }} />
                </View>
              </View>
              {/* Plus button */}
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); m.onIncrement(); }}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,116,42,0.12)', alignItems: 'center', justifyContent: 'center' }}
                accessibilityRole="button"
                accessibilityLabel={`Increase ${m.label}`}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.orange, marginTop: -1 }}>+</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Health Data connect prompt ──────────────────────────────────────────────────

export function HealthDataConnectPrompt() {
  const { colors } = useAppTheme();
  return (
    <View style={{ borderRadius: 16, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border, padding: 16, gap: 10, marginTop: 8, marginBottom: 8 }}>
      <Text style={{ fontSize: 15, color: colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', lineHeight: 19, fontFamily: 'System' }}>
        Connect Apple Health in Settings to see your vitals, body composition, activity, and more — all in one place.
      </Text>
      <Pressable
        onPress={() => router.push('/settings')}
        style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,116,42,0.12)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Go to Settings to connect Apple Health"
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.orange, fontFamily: 'System' }}>
          Go to Settings
        </Text>
      </Pressable>
    </View>
  );
}

/** Placeholder card for a tracked-but-unavailable metric (rendered greyed out). */
function hmEmpty(id: string, label: string, lucideIcon: string): HealthMetric {
  return { id, label, value: '—', unit: '', status: 'normal', lucideIcon, rangeLabel: 'No data', gaugePosition: null, noData: true };
}

export function buildHealthMetrics(hkStore: ReturnType<typeof useHealthKitStore.getState>): { category: string; metrics: HealthMetric[] }[] {
  const groups: { category: string; metrics: HealthMetric[] }[] = [];

  // ── Vitals ── (always show the full set we track; greyed when no data)
  const rhr = hkStore.restingHR;
  const hrv = hkStore.hrv;
  const sleep = hkStore.sleepHours;
  const sleepMin = sleep != null ? Math.round(sleep * 60) : null;
  const glucose = hkStore.bloodGlucose;
  const spo2 = hkStore.spo2;
  const bp = hkStore.bloodPressure;
  const respRate = hkStore.respiratoryRate;
  const vitals: HealthMetric[] = [
    rhr != null ? { id: 'rhr', label: 'Resting HR', value: String(rhr), unit: 'bpm', status: hmRhrStatus(rhr), lucideIcon: 'Heart', rangeLabel: hmRhrLabel(rhr), gaugePosition: hmGaugePos('rhr', rhr) } : hmEmpty('rhr', 'Resting HR', 'Heart'),
    hrv != null ? { id: 'hrv', label: 'HRV', value: String(hrv), unit: 'ms', status: hmHrvStatus(hrv), lucideIcon: 'TrendingUp', rangeLabel: hmHrvLabel(hrv), gaugePosition: hmGaugePos('hrv', hrv) } : hmEmpty('hrv', 'HRV', 'TrendingUp'),
    sleepMin != null ? { id: 'sleep', label: 'Sleep', value: fmtSleep(sleepMin), unit: '', status: hmSleepStatus(sleepMin), lucideIcon: 'Moon', rangeLabel: hmSleepLabel(sleepMin), gaugePosition: hmGaugePos('sleep', sleepMin) } : hmEmpty('sleep', 'Sleep', 'Moon'),
    glucose != null ? { id: 'glucose', label: 'Blood Glucose', value: String(glucose), unit: 'mg/dL', status: glucose < 100 ? 'good' : glucose < 125 ? 'normal' : 'elevated', lucideIcon: 'Droplet', rangeLabel: glucose < 100 ? 'Normal' : glucose < 125 ? 'Pre-range' : 'High', gaugePosition: hmGaugePos('glucose', glucose) } : hmEmpty('glucose', 'Blood Glucose', 'Droplet'),
    spo2 != null ? { id: 'spo2', label: 'SpO2', value: `${spo2}`, unit: '%', status: hmSpo2Status(spo2), lucideIcon: 'Wind', rangeLabel: hmSpo2Label(spo2), gaugePosition: hmGaugePos('spo2', spo2) } : hmEmpty('spo2', 'SpO2', 'Wind'),
    bp != null ? { id: 'bp', label: 'Blood Pressure', value: `${bp.systolic}/${bp.diastolic}`, unit: 'mmHg', status: hmBpStatus(bp.systolic), lucideIcon: 'HeartPulse', rangeLabel: hmBpLabel(bp.systolic), gaugePosition: hmGaugePos('bp', bp.systolic) } : hmEmpty('bp', 'Blood Pressure', 'HeartPulse'),
    respRate != null ? { id: 'respRate', label: 'Resp. Rate', value: `${respRate}`, unit: 'bpm', status: hmRespRateStatus(respRate), lucideIcon: 'Leaf', rangeLabel: hmRespRateLabel(respRate), gaugePosition: hmGaugePos('respRate', respRate) } : hmEmpty('respRate', 'Resp. Rate', 'Leaf'),
  ];
  groups.push({ category: 'Vitals', metrics: vitals });

  // ── Body Composition ──
  // Note: Weight is omitted here — Titra tracks it directly (logStore syncs from
  // HK on home tab focus). Showing it again would duplicate the Progress tab card.
  const body: HealthMetric[] = [];
  const bf = hkStore.bodyFat;
  if (bf != null) body.push({ id: 'bodyFat', label: 'Body Fat', value: `${bf}`, unit: '%', status: hmBodyFatStatus(bf), lucideIcon: 'PersonStanding', rangeLabel: hmBodyFatLabel(bf), gaugePosition: hmGaugePos('bodyFat', bf) });
  const lm = hkStore.leanMass;
  if (lm != null) body.push({ id: 'leanMass', label: 'Lean Mass', value: `${lm}`, unit: 'lbs', status: hmLeanMassStatus(), lucideIcon: 'Dumbbell', rangeLabel: hmLeanMassLabel(), gaugePosition: hmGaugePos('leanMass', lm) });
  const waist = hkStore.waist;
  if (waist != null) body.push({ id: 'waist', label: 'Waist', value: `${waist}`, unit: 'in', status: hmWaistStatus(), lucideIcon: 'Ruler', rangeLabel: hmWaistLabel(), gaugePosition: hmGaugePos('waist', waist) });
  const bmi = hkStore.bmi;
  if (bmi != null) body.push({ id: 'bmi', label: 'BMI', value: `${bmi}`, unit: '', status: hmBmiStatus(bmi), lucideIcon: 'Scale', rangeLabel: hmBmiLabel(bmi), gaugePosition: hmGaugePos('bmi', bmi) });
  if (body.length > 0) groups.push({ category: 'Body Composition', metrics: body });

  // ── Activity ── (always show the full set we track; greyed when no data)
  // Note: Steps + Active Calories live in the Daily Metrics row above (with HK
  // fallback). We keep TDEE/exMin/VO2/etc. here since those are HK-only.
  const cal = hkStore.activeCalories; // used for TDEE calc below
  const exMin = hkStore.exerciseMinutes;
  const vo2 = hkStore.vo2max;
  const dist = hkStore.distance;
  const flights = hkStore.flightsClimbed;
  const basal = hkStore.basalEnergy;
  const tdee = basal != null && cal != null ? basal + cal : null;
  const activity: HealthMetric[] = [
    exMin != null && exMin > 0 ? { id: 'exMin', label: 'Exercise', value: String(exMin), unit: 'min', status: hmExMinStatus(exMin), lucideIcon: 'Clock', rangeLabel: hmExMinLabel(exMin), gaugePosition: hmGaugePos('exMin', exMin) } : hmEmpty('exMin', 'Exercise', 'Clock'),
    dist != null ? { id: 'distance', label: 'Distance', value: `${dist}`, unit: 'mi', status: hmDistanceStatus(dist), lucideIcon: 'Map', rangeLabel: hmDistanceLabel(dist), gaugePosition: hmGaugePos('distance', dist) } : hmEmpty('distance', 'Distance', 'Map'),
    flights != null ? { id: 'flights', label: 'Flights', value: `${flights}`, unit: '', status: hmFlightsStatus(flights), lucideIcon: 'TrendingUp', rangeLabel: hmFlightsLabel(flights), gaugePosition: hmGaugePos('flights', flights) } : hmEmpty('flights', 'Flights', 'TrendingUp'),
    vo2 != null ? { id: 'vo2max', label: 'VO2 Max', value: `${vo2}`, unit: 'mL/kg/min', status: hmVo2Status(vo2), lucideIcon: 'Gauge', rangeLabel: hmVo2Label(vo2), gaugePosition: hmGaugePos('vo2max', vo2) } : hmEmpty('vo2max', 'VO2 Max', 'Gauge'),
    tdee != null ? { id: 'tdee', label: 'TDEE', value: tdee.toLocaleString(), unit: 'cal', status: hmTdeeStatus(tdee), lucideIcon: 'Zap', rangeLabel: hmTdeeLabel(tdee), gaugePosition: hmGaugePos('tdee', tdee) } : hmEmpty('tdee', 'TDEE', 'Zap'),
  ];
  groups.push({ category: 'Activity', metrics: activity });

  // ── Workouts ──
  const workouts = hkStore.workouts;
  if (workouts.length > 0) {
    const workoutMetrics: HealthMetric[] = workouts.slice(0, 5).map((w, i) => ({
      id: `workout-${i}`, label: fmtWorkoutType(w.workoutActivityType),
      value: `${w.duration}`, unit: 'min',
      status: w.duration >= 30 ? 'good' : 'normal',
      lucideIcon: 'Dumbbell',
      rangeLabel: w.sourceName,
      gaugePosition: null,
    }));
    groups.push({ category: 'Workouts', metrics: workoutMetrics });
  }

  // ── Mindfulness ──
  const mindful = hkStore.mindfulMinutes;
  if (mindful != null && mindful > 0) {
    const mindMetrics: HealthMetric[] = [
      { id: 'mindful', label: 'Mindful Minutes', value: `${mindful}`, unit: 'min', status: hmMindfulStatus(mindful), lucideIcon: 'Brain', rangeLabel: hmMindfulLabel(mindful), gaugePosition: hmGaugePos('mindful', mindful) },
    ];
    groups.push({ category: 'Mindfulness', metrics: mindMetrics });
  }

  // Nutrition + Water are intentionally NOT shown here — those metrics flow
  // into the protein/fiber/carbs/hydration daily metric cards above (with HK
  // fallback when no in-app log exists), so we don't duplicate them.

  // ── Glucose (CGM time-series stats) ──
  const gStats = hkStore.glucoseStats;
  if (gStats != null && gStats.sampleCount >= 3) {
    const glucoseMetrics: HealthMetric[] = [
      { id: 'glucoseAvg', label: 'Avg Glucose', value: `${gStats.average}`, unit: 'mg/dL', status: gStats.average < 100 ? 'good' : gStats.average < 125 ? 'normal' : 'elevated', lucideIcon: 'Droplet', rangeLabel: gStats.average < 100 ? 'Normal' : gStats.average < 125 ? 'Pre-range' : 'High', gaugePosition: hmGaugePos('glucose', gStats.average) },
      { id: 'tir', label: 'Time in Range', value: `${gStats.timeInRange}`, unit: '%', status: hmTirStatus(gStats.timeInRange), lucideIcon: 'Target', rangeLabel: hmTirLabel(gStats.timeInRange), gaugePosition: hmGaugePos('tir', gStats.timeInRange) },
      { id: 'glucoseRange', label: 'Range', value: `${gStats.min}–${gStats.max}`, unit: 'mg/dL', status: 'normal', lucideIcon: 'ArrowUpDown', rangeLabel: `${gStats.sampleCount} readings`, gaugePosition: null },
    ];
    groups.push({ category: 'Glucose (24h)', metrics: glucoseMetrics });
  }

  return groups;
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

const CHART_HEIGHT = 180;
const EXP_CHART_HEIGHT = 234;
const ML = 48; // left margin for Y-axis labels
const MR = 8;  // right margin
const MT = 8;  // top margin
const MB = 14; // bottom margin so 0% label isn't clipped

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

function MedLevelChartCard({ chartData, daysSince, dayLabels, glp1Type, medicationBrand, isDailyDrug, oral, currentCyclePct, currentConcentrationPct, injFreqDays, injTimestamp, lastDoseMg }: {
  chartData: number[] | null;
  daysSince: number;
  dayLabels: string[];
  glp1Type: import('@/constants/user-profile').Glp1Type;
  medicationBrand: import('@/constants/user-profile').MedicationBrand;
  isDailyDrug: boolean;
  oral: boolean;
  currentCyclePct?: number | null;
  currentConcentrationPct?: number | null;
  injFreqDays: number;
  injTimestamp?: string | null;
  lastDoseMg?: number | null;
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
    Animated.timing(sheetTranslateY, { toValue: screenHeight, duration: 240, useNativeDriver: true }).start(() => {
      setExpandedModal(false);
      setSelectedPointIdx(null);
    });
  };
  useEffect(() => {
    if (expandedModal) {
      Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
    }
  }, [expandedModal, sheetTranslateY]);
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
        y: MT + (CHART_HEIGHT - MT - MB) * (1 - v / 100),
      }))
    : [];

  const expPoints = chartData
    ? chartData.map((v, i) => ({
        x: expChartWidth > 0 ? ML + (n > 1 ? (expPlotW / (n - 1)) * i : expPlotW / 2) : 0,
        y: MT + (EXP_CHART_HEIGHT - MT - MB) * (1 - v / 100),
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
  const eventNoun = doseNoun(oral); // 'dose' | 'injection'

  // Route/cadence-aware sublabel. Weekly drugs keep the half-life label (interval = cycle);
  // daily drugs read "Daily oral · ~7-day half-life" instead of the misleading "7-day cycle".
  const cadenceLabel = isDailyDrug
    ? `${oral ? 'Daily oral' : 'Daily'} · ~${halfLifeInfo.halfLifeDays} half-life`
    : DRUG_HALF_LIFE_LABEL[glp1Type];

  // Daily drugs are flat — there's no weekly peak-and-trough cycle to narrate.
  const dailyConsistencyNote =
    glp1Type === 'oral_semaglutide' ? 'Take fasted at the same time daily; wait 30 min before eating'
    : glp1Type === 'orforglipron'   ? 'Take at the same time daily — no food restrictions'
    : 'Take at the same time each day';

  // Build real-date X-axis labels when injection timestamp is available
  // Thin labels so they don't overlap — show at most ~5 evenly spaced labels
  const realDayLabels = useMemo(() => {
    if (!injTimestamp || isDailyDrug) return dayLabels;
    const injDate = new Date(injTimestamp);
    if (isNaN(injDate.getTime())) return dayLabels;
    const total = dayLabels.length;
    const maxLabels = 5;
    const step = total <= maxLabels ? 1 : Math.ceil(total / maxLabels);
    return dayLabels.map((_, i) => {
      // Always show first and last; skip intermediate labels to avoid smushing
      if (i !== 0 && i !== total - 1 && i % step !== 0) return '';
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
    if (chartData && !expandedModal) {
      sheetTranslateY.setValue(screenHeight);
      setExpandedModal(true);
    }
  }, [chartData, expandedModal, screenHeight, sheetTranslateY]);

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
          <Text style={[s.chartMuted, { textAlign: 'center', marginBottom: 4 }]}>{BRAND_DISPLAY_NAMES[medicationBrand]} · {cadenceLabel}</Text>
          <Text style={[s.chartBig, { textAlign: 'center', marginTop: 8 }]}>Log your first {eventNoun}</Text>
          <Text style={[s.chartMuted, { textAlign: 'center', marginTop: 4 }]}>Your medication level curve will appear here</Text>
        </View>
      </View>
    );
  }

  // Render chart internals as SVG (used in both compact and expanded views)
  function renderChartInternals(pts: { x: number; y: number }[], chartH: number, cW: number, cWFull: number) {
    if (cWFull <= 0 || pts.length === 0) return null;
    const plotH = chartH - MT - MB;
    const yTicks = [0, 25, 50, 75, 100];
    const linePath = smoothPath(pts);
    const firstPt = pts[0];
    const lastPt = pts[pts.length - 1];
    const bottomY = MT + plotH; // bottom of plot area (above MB)
    const areaPath = pts.length >= 2
      ? `${linePath} L ${lastPt.x} ${bottomY} L ${firstPt.x} ${bottomY} Z`
      : '';
    const nowX = currentCyclePct != null ? ML + currentCyclePct * (cWFull - ML - MR) : null;
    const nowY = currentConcentrationPct != null ? MT + plotH * (1 - currentConcentrationPct / 100) : null;
    return (
      <Svg width={cWFull} height={chartH}>
        <Defs>
          <LinearGradient id="pkGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.orange} stopOpacity="0.25" />
            <Stop offset="1" stopColor={colors.orange} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Optimal zone background removed — too faint to be useful */}

        {/* Y-axis gridlines + labels */}
        {yTicks.map(tick => {
          const y = MT + plotH * (1 - tick / 100);
          return (
            <React.Fragment key={`y-${tick}`}>
              <Line
                x1={ML} y1={y} x2={cWFull - MR} y2={y}
                stroke={colors.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)'} strokeWidth={1} strokeDasharray="3,4"
              />
              <SvgText
                x={ML - 8} y={y + 3.5}
                fontSize={11} fill={colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)'}
                textAnchor="end" fontFamily="System"
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
          <Path d={linePath} stroke={colors.orange} strokeWidth={2} fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Data dots */}
        {pts.map((pt, i) => (
          <Circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill={colors.orange} opacity={0.8} />
        ))}

        {/* NOW marker — rendered last for highest z-order */}
        {nowX != null && nowY != null && (
          <>
            <Line
              x1={nowX} y1={0} x2={nowX} y2={chartH}
              stroke={colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'} strokeWidth={1.5} strokeDasharray="4,3"
            />
            <Circle cx={nowX} cy={nowY} r={8} fill="rgba(255,116,42,0.2)" />
            <Circle cx={nowX} cy={nowY} r={5.5} fill={colors.isDark ? '#FFFFFF' : '#FFFFFF'} stroke={colors.orange} strokeWidth={2.5} />
            <SvgText
              x={nowX} y={nowY > 40 ? nowY - 18 : nowY + 28}
              fontSize={11} fontWeight="800" fill={colors.orange}
              textAnchor="middle" fontFamily="System"
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
      <View style={{ marginBottom: 16 }}>
      {/* Card flows directly under nav — no title on gradient */}
      <Pressable
        style={s.cardWrap}
        onPress={openModal}
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openAiChat({ type: 'metric', contextLabel: 'Medication Level', contextValue: isDailyDrug ? `${levelLabel} · ${oral ? 'oral ' : ''}daily dosing` : `${levelLabel} · Last injection ${daysSinceLabel}`, chips: JSON.stringify(isDailyDrug ? ['Why does my level stay steady all day?', 'When is my peak each day?', `Does timing my ${eventNoun} matter?`, 'How does this affect my appetite?'] : ['What does optimal mean?', 'How will this change over my cycle?', 'When is my peak concentration?', 'How does this affect my appetite?']) }); }}
      >
        <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
          <View style={{ padding: 18 }}>

            {/* Top row: medication info + tap-for-full-view */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[s.chartMuted, { fontSize: 13, flexShrink: 1 }]} numberOfLines={1}>{brandName}{lastDoseMg ? ` ${lastDoseMg}mg` : ''} · {cadenceLabel}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 8 }}>
                <Maximize2 size={11} color={colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
                <Text style={[s.chartMuted, { fontSize: 12 }]}>Tap for full view</Text>
              </View>
            </View>

            {/* Level display */}
            <View style={{ marginBottom: 14 }}>
              <Text style={s.chartBig}>{concentrationDisplay ?? levelLabel}</Text>
              {concentrationDisplay && (
                <Text style={[s.chartMuted, { marginTop: 2 }]}>{levelLabel} · of peak level</Text>
              )}
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
                    color={colors.orange}
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
              intensity={colors.isDark ? 60 : 90}
              tint={colors.blurTint}
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.isDark ? colors.glassOverlay : 'rgba(255,255,255,0.82)' }]} />

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
                  <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'System' }}>Drug Concentration</Text>
                  <Text style={[s.chartMuted, { marginTop: 2 }]}>{brandName} · {cadenceLabel}</Text>
                </View>
                <Pressable onPress={dismissSheet} hitSlop={12}>
                  <XCircle size={28} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} />
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
                        color={colors.orange}
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
                      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, fontFamily: 'System' }}>{ptLabel}</Text>
                      <Text style={[s.chartMuted, { marginTop: 2 }]}>{selPct}% of peak</Text>
                    </View>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: `${selTier.color}22` }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: selTier.color, fontFamily: 'System' }}>{selTier.label}</Text>
                    </View>
                  </View>
                );
              })()}

              {/* ── Status block — daily drugs are flat, weekly drugs cycle through tiers ── */}
              {isDailyDrug ? (
                <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#27AE60' }} />
                    <Text style={{ fontSize: 17, fontWeight: '700', color: '#27AE60', fontFamily: 'System' }}>Steady all day</Text>
                  </View>
                  <Text style={{ fontSize: 14, lineHeight: 20, color: colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontFamily: 'System' }}>
                    {`${oral ? 'Daily oral' : 'Daily'} dosing keeps your level nearly flat — there's no weekly peak-and-trough cycle. ${halfLifeInfo.troughNote ? `Day-to-day ${halfLifeInfo.troughNote}.` : ''}`.trim()}
                  </Text>
                </View>
              ) : (
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tierInfo.color }} />
                  <Text style={{ fontSize: 17, fontWeight: '700', color: tierInfo.color, fontFamily: 'System' }}>{tierInfo.label}</Text>
                  <Text style={{ fontSize: 15, color: colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', fontFamily: 'System' }}>· {currentLevel}% active</Text>
                </View>
                {/* Gradient phase bar */}
                <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  {PK_TIER_GUIDE.slice().reverse().map((tier) => {
                    const isActive = tier.label === tierInfo.label;
                    return (
                      <View key={tier.label} style={{ flex: 1, backgroundColor: isActive ? tier.color : `${tier.color}30` }} />
                    );
                  })}
                </View>
                {/* Phase position indicator */}
                <View style={{ position: 'relative', height: 0 }}>
                  <View style={{
                    position: 'absolute',
                    left: `${Math.min(98, Math.max(2, currentLevel))}%`,
                    top: -14,
                    width: 3,
                    height: 6,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 1.5,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.3,
                    shadowRadius: 2,
                  }} />
                </View>
                {/* Compact tier legend */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  {PK_TIER_GUIDE.slice().reverse().map((tier) => {
                    const isActive = tier.label === tierInfo.label;
                    return (
                      <Text key={tier.label} style={{ fontSize: 11, color: isActive ? colors.textPrimary : colors.textSecondary, fontWeight: isActive ? '800' : '500', fontFamily: 'System' }}>{tier.label}</Text>
                    );
                  })}
                </View>
              </View>
              )}

              <View style={s.eduDivider} />

              {/* ── Key moments cards ── */}
              <View style={{ marginBottom: 20 }}>
                <Text style={[s.eduTitle, { marginBottom: 12 }]}>{isDailyDrug ? 'Your Daily Profile' : 'Your Cycle'}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {/* Peak card */}
                  <View style={{
                    flex: 1,
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 14,
                    padding: 12,
                    alignItems: 'center',
                  }}>
                    <IconSymbol name="checkmark.circle.fill" size={20} color="#27AE60" style={{ marginBottom: 6 }} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, fontFamily: 'System', textAlign: 'center' }}>Peak</Text>
                    <Text style={{ fontSize: 12, color: colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: 'System', textAlign: 'center', marginTop: 2 }}>{peakInfo.tmaxLabel}</Text>
                  </View>
                  {/* Half-life card */}
                  <View style={{
                    flex: 1,
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 14,
                    padding: 12,
                    alignItems: 'center',
                  }}>
                    <IconSymbol name="magnifyingglass" size={20} color="#5B8BF5" style={{ marginBottom: 6 }} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, fontFamily: 'System', textAlign: 'center' }}>Half-life</Text>
                    <Text style={{ fontSize: 12, color: colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: 'System', textAlign: 'center', marginTop: 2 }}>{halfLifeInfo.halfLifeDays}</Text>
                  </View>
                  {/* Trough card */}
                  <View style={{
                    flex: 1,
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 14,
                    padding: 12,
                    alignItems: 'center',
                  }}>
                    <IconSymbol name="chart.line.downtrend.xyaxis" size={20} color="#F6CB45" style={{ marginBottom: 6 }} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, fontFamily: 'System', textAlign: 'center' }}>Trough</Text>
                    <Text style={{ fontSize: 12, color: colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: 'System', textAlign: 'center', marginTop: 2 }}>{halfLifeInfo.troughNote || 'End of cycle'}</Text>
                  </View>
                </View>
              </View>

              <View style={s.eduDivider} />

              {/* ── What to expect — compact timeline ── */}
              <View style={{ marginBottom: 8 }}>
                <Text style={[s.eduTitle, { marginBottom: 12 }]}>What to Expect</Text>
                {(isDailyDrug ? [
                  { icon: 'Zap', color: '#27AE60', label: 'Peak appetite suppression', when: `Around ${peakInfo.tmaxLabel}` },
                  { icon: 'Utensils', color: '#5B8BF5', label: 'Steady through the day', when: halfLifeInfo.troughNote ? `Stays near peak — ${halfLifeInfo.troughNote}` : 'Level stays nearly flat' },
                  { icon: 'TrendingUp', color: '#F6CB45', label: oral ? 'Consistency matters' : 'Daily timing matters', when: dailyConsistencyNote },
                ] : [
                  { icon: 'Zap', color: '#27AE60', label: 'Peak appetite suppression', when: `Around ${peakInfo.tmaxLabel} post-dose` },
                  { icon: 'Utensils', color: '#5B8BF5', label: 'Best window for new habits', when: 'Days 3–5 of cycle' },
                  { icon: 'TrendingUp', color: '#F6CB45', label: 'Hunger may return', when: 'Last 1–2 days before next dose' },
                ]).map((item) => (
                  <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${item.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                      <LucideIconByName name={item.icon} size={16} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, fontFamily: 'System' }}>{item.label}</Text>
                      <Text style={{ fontSize: 13, color: colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', fontFamily: 'System', marginTop: 1 }}>{item.when}</Text>
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
                      contextValue: isDailyDrug
                        ? `${levelLabel} - ${oral ? 'oral ' : ''}daily dosing`
                        : `${currentLevel}% - ${tierInfo.label} - Last injection ${daysSinceLabel}`,
                      chips: JSON.stringify(isDailyDrug
                        ? ['Why does my level stay steady all day?', 'When is my peak each day?', `Does timing my ${eventNoun} matter?`, 'How does this affect my side effects?']
                        : ['What does my current level mean?', 'When will I hit peak concentration?', 'Why is my appetite returning?', 'How does this affect my side effects?']),
                    });
                  }, 350);
                }}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? 'rgba(255,116,42,0.85)' : colors.orange,
                  borderRadius: 28,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: colors.orange,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 16,
                  elevation: 8,
                })}
              >
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFF', letterSpacing: -0.2, fontFamily: 'System' }}>Ask AI about my medication</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
      </View>
    </>
  );
}

// ─── Latest injection entry-point (taps through to /injection-history) ──────

function LatestInjectionEntry({
  lastInj, lastSite, rotateTo, lastDosage, nextInjLabel, lastDaysSince, oral,
}: {
  lastInj: InjectionLog | null;
  lastSite: string | null;
  rotateTo: string;
  lastDosage: string;
  nextInjLabel: string;
  lastDaysSince: number;
  oral: boolean;
}) {
  const { colors } = useAppTheme();
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const noun = oral ? 'Dose' : 'Injection';

  const sinceLabel = !lastInj
    ? null
    : lastDaysSince <= 1
      ? 'Today'
      : lastDaysSince === 2
        ? 'Yesterday'
        : `${lastDaysSince - 1} days ago`;

  return (
    <Pressable
      onPress={() => router.push('/injection-history' as any)}
      style={({ pressed }) => [{
        borderRadius: 20,
        marginBottom: 24,
        backgroundColor: colors.surface,
        borderWidth: 0.5,
        borderColor: colors.border,
        padding: 18,
        opacity: pressed ? 0.85 : 1,
        ...(colors.isDark
          ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }
          : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 }),
      }]}
      accessibilityLabel={`Latest ${noun.toLowerCase()}, tap to view history`}
      accessibilityRole="button"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {oral ? <Pill size={14} color={colors.orange} /> : <Syringe size={14} color={colors.orange} />}
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary, fontFamily: 'System', letterSpacing: -0.2 }}>
            Latest {noun}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={16} color={w(0.35)} />
      </View>

      {lastInj ? (
        <>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, fontFamily: 'System', marginBottom: 4 }}>
            {!oral && lastSite ? `${lastSite} · ${lastDosage}` : lastDosage}
          </Text>
          <Text style={{ fontSize: 14, color: w(0.55), fontFamily: 'System' }}>
            {sinceLabel ? `${sinceLabel} · ` : ''}Next {oral ? 'dose' : 'injection'} {nextInjLabel.toLowerCase()}
          </Text>
          {!oral && lastSite && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: w(0.08) }}>
              <IconSymbol name="arrow.triangle.2.circlepath" size={13} color={w(0.5)} />
              <Text style={{ fontSize: 13, color: w(0.55), fontFamily: 'System' }}>
                Rotate to <Text style={{ color: colors.orange, fontWeight: '700' }}>{rotateTo}</Text>
              </Text>
            </View>
          )}
        </>
      ) : (
        <Text style={{ fontSize: 14, color: w(0.45), fontFamily: 'System' }}>
          No {noun.toLowerCase()}s logged yet. Tap to view history.
        </Text>
      )}
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

function WeightChartCard({ datasets, currentWeight, startWeight, chartHeight = WEIGHT_CHART_HEIGHT, inline = false, activePeriod: activePeriodProp, onPeriodChange }: {
  datasets: Record<string, WeightPoint[]>;
  currentWeight: number | null;
  startWeight?: number | null;
  chartHeight?: number;
  inline?: boolean;
  activePeriod?: '7D' | '14D' | '30D' | '90D' | 'MAX';
  onPeriodChange?: (p: '7D' | '14D' | '30D' | '90D' | 'MAX') => void;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [localPeriod, setLocalPeriod] = useState<'7D' | '14D' | '30D' | '90D' | 'MAX'>('30D');
  const activePeriod = activePeriodProp ?? localPeriod;
  const setActivePeriod = onPeriodChange ?? setLocalPeriod;
  const [svgWidth, setSvgWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setSvgWidth(e.nativeEvent.layout.width);

  const data = datasets[activePeriod];
  const hasData = data && data.length >= 1;

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

  // X position by real timestamp so dots and X-axis labels share the same time
  // axis. The previous index-based mapping stretched 2 close-together points
  // across the full plot width, making the chart look like a 30-day trend.
  const periodDays = { '7D': 7, '14D': 14, '30D': 30, '90D': 90 }[activePeriod as '7D' | '14D' | '30D' | '90D'] ?? null;
  const tEndChart = Date.now();
  const tStartChart = activePeriod === 'MAX'
    ? (hasData ? new Date(data[0].date).getTime() : tEndChart - 30 * 86400000)
    : tEndChart - (periodDays ?? 30) * 86400000;
  const tRangeChart = Math.max(tEndChart - tStartChart, 1);

  const toX = (i: number) => {
    if (!data || data.length === 0) return WML;
    if (data.length === 1) return WML + plotW / 2;
    const t = new Date(data[i].date).getTime();
    const frac = Math.max(0, Math.min(1, (t - tStartChart) / tRangeChart));
    return WML + plotW * frac;
  };
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
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'System' }}>Weight Journey</Text>
            <Text style={s.chartMuted}>{PERIOD_SUBTITLES[activePeriod]}</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.orange, letterSpacing: -1, fontFamily: 'System' }}>
            {displayWeight != null ? `${displayWeight} lbs` : '-'}
          </Text>
        </View>
      )}

      <GestureDetector gesture={weightScrub.gesture}>
        <View style={{ height: svgH, position: 'relative' }} onLayout={onLayout} accessibilityRole="image" accessibilityLabel="Weight trend chart. Long press and drag to scrub through data points">
          {!hasData ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={s.chartMuted}>Log weight entries to see your chart</Text>
            </View>
          ) : svgWidth > 0 && (
            <>
              <Svg width={svgWidth} height={svgH}>
                <Defs>
                  <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={colors.orange} stopOpacity="0.28" />
                    <Stop offset="1" stopColor={colors.orange} stopOpacity="0" />
                  </LinearGradient>
                </Defs>

                {/* Y-axis gridlines + labels */}
                {yTicks.map((tick) => {
                  const y = toY(tick);
                  return (
                    <React.Fragment key={`y-${tick}`}>
                      <Line
                        x1={WML} y1={y} x2={WML + plotW} y2={y}
                        stroke={colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'} strokeWidth={1} strokeDasharray="4,4"
                      />
                      <SvgText
                        x={WML - 6} y={y + 4}
                        fontSize={12} fill={colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)'}
                        textAnchor="end" fontFamily="System"
                      >
                        {Math.round(tick)}
                      </SvgText>
                    </React.Fragment>
                  );
                })}

                {/* X-axis labels */}
                {xLabels.map(({ x, label }, idx) => {
                  const anchor = idx === 0 ? 'start' : idx === xLabels.length - 1 ? 'end' : 'middle';
                  return (
                    <React.Fragment key={`x-${label}-${x}`}>
                      <Line
                        x1={WML + x} y1={WMT} x2={WML + x} y2={WMT + plotH}
                        stroke={colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'} strokeWidth={1}
                      />
                      <SvgText
                        x={WML + x} y={WMT + plotH + 18}
                        fontSize={11} fill={colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)'}
                        textAnchor={anchor} fontFamily="System"
                      >
                        {label}
                      </SvgText>
                    </React.Fragment>
                  );
                })}

                {/* Area fill */}
                {areaPath ? (
                  <Path d={areaPath} fill="url(#areaGrad)" />
                ) : null}

                {/* Line */}
                {linePath ? (
                  <Path d={linePath} stroke={colors.orange} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                ) : null}

                {/* Data dots */}
                {points.slice(0, -1).map((pt, i) => (
                  <Circle key={`dot-${i}`} cx={pt.x} cy={pt.y} r={4} fill={colors.orange} />
                ))}

                {/* Last point — double ring */}
                {lastPt && (
                  <>
                    <Circle cx={lastPt.x} cy={lastPt.y} r={9} fill="rgba(255,116,42,0.2)" />
                    <Circle cx={lastPt.x} cy={lastPt.y} r={5.5} fill={colors.orange} />
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
                color={colors.orange}
                formatTooltip={weightTooltipFormatter}
              />
            </>
          )}
        </View>
      </GestureDetector>

      {hasData && svgWidth > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Text style={s.progGoalLabel}>START ({startWeight ?? data[0].weight} lbs)</Text>
          <Text style={[s.progGoalLabel, { color: colors.orange, fontWeight: '700' }]}>
            CURRENT ({currentWeight ?? data[data.length - 1].weight} lbs)
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
  projection, datasets, currentWeight, startWeight, programWeek,
}: {
  projection: WeightProjection | null;
  datasets: Record<string, WeightPoint[]>;
  currentWeight: number | null;
  startWeight?: number | null;
  programWeek?: number;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const [expanded, setExpanded] = useState(false);
  const [activePeriod, setActivePeriod] = useState<'7D' | '14D' | '30D' | '90D' | 'MAX'>('30D');
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { openAiChat } = useUiStore();

  // Drag-to-dismiss + slide-in/out
  const sheetY = useRef(new Animated.Value(0)).current;
  const openSheet = useCallback(() => {
    sheetY.setValue(screenHeight);
    setExpanded(true);
  }, [screenHeight, sheetY]);
  const closeSheet = () => {
    Animated.timing(sheetY, { toValue: screenHeight, duration: 240, useNativeDriver: true }).start(() => {
      setExpanded(false);
    });
  };
  useEffect(() => {
    if (expanded) {
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
    }
  }, [expanded, sheetY]);
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

  const goalDateLabel = projection
    ? new Date(projection.projectedGoalDate + 'T00:00:00')
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <>
      {/* Header row — outside the card */}
      <Pressable
        onPress={openSheet}
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
        style={{ marginBottom: 10, paddingHorizontal: 4 }}
      >
        <View style={{ height: 4 }} />
      </Pressable>

      <Pressable style={[s.cardWrap, { marginBottom: 16 }]} onPress={openSheet} accessibilityLabel="Weight Journey chart. Tap for full view" accessibilityRole="button">
        <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
          <View style={{ padding: 18 }}>
            <View style={{ position: 'absolute', top: 22, right: 18, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Maximize2 size={11} color={w(0.3)} />
              <Text style={[s.chartMuted, { fontSize: 12 }]}>Tap for full view</Text>
            </View>
            {/* Weight value */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.orange, letterSpacing: -1 }}>
                {currentWeight != null ? `${currentWeight} lbs` : '-'}
              </Text>
            </View>
            {/* Period selector */}
            <View style={s.progPeriodRow}>
              {(['7D', '14D', '30D', '90D', 'MAX'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.progPeriodBtn, activePeriod === p && s.progPeriodBtnActive]}
                  onPress={() => setActivePeriod(p)}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel={`${p === 'MAX' ? 'All time' : p} period${activePeriod === p ? ', selected' : ''}`}
                  accessibilityState={{ selected: activePeriod === p }}
                >
                  <Text style={[s.progPeriodLabel, activePeriod === p && s.progPeriodLabelActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Always-visible chart */}
            <WeightChartCard
              datasets={datasets}
              currentWeight={currentWeight}
              startWeight={startWeight}
              chartHeight={130}
              inline
              activePeriod={activePeriod}
              onPeriodChange={setActivePeriod}
            />
          </View>
        </View>
      </Pressable>

      <Modal visible={expanded} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.18)' }]}
            onPress={closeSheet}
          />
          <Animated.View style={{ height: screenHeight * 0.82, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', transform: [{ translateY: sheetY }] }}>
            <BlurView intensity={colors.isDark ? 60 : 90} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.isDark ? colors.glassOverlay : 'rgba(255,255,255,0.85)' }]} />

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
                <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'System' }}>Weight Journey</Text>
                <Pressable onPress={closeSheet} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close weight journey detail">
                  <XCircle size={28} color={w(0.4)} />
                </Pressable>
              </View>

              {/* Period selector */}
              <View style={s.progPeriodRow}>
                {(['7D', '14D', '30D', '90D', 'MAX'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[s.progPeriodBtn, activePeriod === p && s.progPeriodBtnActive]}
                    onPress={() => setActivePeriod(p)}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel={`${p === 'MAX' ? 'All time' : p} period${activePeriod === p ? ', selected' : ''}`}
                    accessibilityState={{ selected: activePeriod === p }}
                  >
                    <Text style={[s.progPeriodLabel, activePeriod === p && s.progPeriodLabelActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Embedded chart at 220px */}
              <WeightChartCard
                datasets={datasets}
                currentWeight={currentWeight}
                startWeight={startWeight}
                chartHeight={220}
                inline
                activePeriod={activePeriod}
                onPeriodChange={setActivePeriod}
              />

              {/* Stats + plateau below chart */}
              {projection && (
                <>
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSubtle, marginBottom: 16 }} />
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                    <View style={{ flex: 1, backgroundColor: colors.borderSubtle, borderRadius: 14, padding: 12 }}>
                      <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.8, fontFamily: 'System', marginBottom: 4 }}>WEEKLY RATE</Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'System' }}>
                        {projection.weeklyLossRateLbs > 0 ? `-${projection.weeklyLossRateLbs}` : '0'}
                        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textMuted }}> lbs/wk</Text>
                      </Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: colors.borderSubtle, borderRadius: 14, padding: 12 }}>
                      <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.8, fontFamily: 'System', marginBottom: 4 }}>GOAL DATE</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, fontFamily: 'System' }}>{goalDateLabel}</Text>
                      <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: 'System', marginTop: 2 }}>{projection.weeksToGoal} wks away</Text>
                    </View>
                  </View>
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
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: pressed ? '#E5661F' : colors.orange,
                  borderRadius: 14, paddingVertical: 13, paddingHorizontal: 24,
                })}
              >
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF', fontFamily: 'System', letterSpacing: -0.2 }}>Ask AI about my weight</Text>
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
  const goalDateLabel = projection
    ? new Date(projection.projectedGoalDate + 'T00:00:00')
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ height: 12 }} />
      <View style={s.cardWrap}>
        <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
          <View style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: colors.borderSubtle, borderRadius: 14, padding: 12 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.8, fontFamily: 'System', marginBottom: 4 }}>GOAL WEIGHT</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'System' }}>
                {goalWeight != null ? `${goalWeight}` : '-'}
                {goalWeight != null && <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textMuted }}> lbs</Text>}
              </Text>
              {toGoalPct != null && (
                <>
                  <View style={[s.progBar, { marginTop: 8 }]}>
                    <View style={[s.progBarFill, { width: `${toGoalPct}%` as any }]} />
                  </View>
                  <Text style={{ fontSize: 13, color: w(0.4), fontFamily: 'System', marginTop: 4 }}>{toGoalPct}% of the way there</Text>
                </>
              )}
            </View>
            <View style={{ flex: 1, backgroundColor: colors.borderSubtle, borderRadius: 14, padding: 12 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.8, fontFamily: 'System', marginBottom: 4 }}>PROJECTED DATE</Text>
              {goalDateLabel ? (
                <>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, fontFamily: 'System' }}>{goalDateLabel}</Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: 'System', marginTop: 2 }}>{projection!.weeksToGoal} wks · based on current rate</Text>
                </>
              ) : (
                <Text style={{ fontSize: 14, color: w(0.35), fontFamily: 'System', marginTop: 4 }}>Log 2+ weights to unlock</Text>
              )}
            </View>
          </View>

          </View>
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
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: colors.isDark ? 8 : 2 }, shadowOpacity: colors.isDark ? 0.3 : 0.06, shadowRadius: colors.isDark ? 24 : 8, elevation: colors.isDark ? 8 : 2 }), [colors]);
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

const EFFECT_ICONS: Record<string, string> = {
  nausea:         'Frown',
  vomiting:       'Frown',
  fatigue:        'Bed',
  constipation:   'PersonStanding',
  diarrhea:       'Droplet',
  headache:       'Brain',
  injection_site: 'Syringe',
  appetite_loss:  'Utensils',
  dehydration:    'Droplet',
  dizziness:      'RefreshCw',
  muscle_loss:    'Dumbbell',
  heartburn:      'Flame',
  food_noise:     'Brain',
  sulfur_burps:   'Wind',
  bloating:       'Wind',
  hair_loss:      'PersonStanding',
  other:          'TriangleAlert',
};

function EffectIcon({ type, size = 22, color }: { type: string; size?: number; color: string }) {
  const iconName = EFFECT_ICONS[type] ?? 'TriangleAlert';
  return <LucideIconByName name={iconName} size={size} color={color} />;
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
    <View style={{ marginBottom: 16 }}>
      <View style={{ height: 12 }} />
      <Pressable
        style={s.cardWrap}
        onLongPress={() => { if (top.length > 0) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openAiChat({ type: 'metric', contextLabel: 'Side Effects', contextValue: aiContext, chips: JSON.stringify(['Are these normal for my phase?', 'How can I reduce nausea?', 'Should I contact my doctor?', 'Do these affect my score?']) }); } }}
      >
        <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
          <View style={{ padding: 18 }}>

          {top.length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
              <IconSymbol name="checkmark.circle.fill" size={20} color="#27AE60" />
              <Text style={{ fontSize: 16, color: w(0.45), fontFamily: 'System' }}>No side effects logged recently</Text>
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
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, fontFamily: 'System' }}>{name}</Text>
                      <Text style={{ fontSize: 14, color: w(0.4), fontFamily: 'System', marginTop: 2 }}>
                        {item.count} {item.count === 1 ? 'time' : 'times'} logged
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <View style={{ backgroundColor: color + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color, fontFamily: 'System' }}>{severityLabel(item.avgSev)}</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: w(0.3), fontFamily: 'System' }}>avg {item.avgSev}/10</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

// ─── Side Effect Insights entry-point ────────────────────────────────────────

function SideEffectInsightsEntryCard({ count }: { count: number }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const subtitle = count === 0
    ? 'Track symptoms to surface cycle patterns'
    : `Cycle patterns, trends & clusters from ${count} log${count === 1 ? '' : 's'}`;
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/insights/side-effects'); }}
      style={[s.cardWrap, { marginBottom: 16 }]}
      accessibilityRole="button"
      accessibilityLabel="View side effect insights"
    >
      <View style={[s.cardBody, { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orange + '1A', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} color={colors.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, fontFamily: 'System' }}>
              Side Effect Insights
            </Text>
            <Text style={{ fontSize: 13, color: w(0.5), fontFamily: 'System', marginTop: 2 }}>
              {subtitle}
            </Text>
          </View>
          <ChevronRight size={18} color={w(0.35)} />
        </View>
      </View>
    </Pressable>
  );
}

// ─── Today's Logs card ────────────────────────────────────────────────────────

// Itemized list of the day's entries scoped to the active tab's categories, with a
// link to the full cross-day history (also scoped to the tab).
function TodayLogsCard({ entries, tab }: { entries: LogEntry[]; tab: Tab }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const kinds = TAB_LOG_KINDS[tab];
  const shown = useMemo(() => entries.filter(e => kinds.includes(e.kind)), [entries, kinds]);

  const renderEntry = (entry: LogEntry, isLast: boolean) => (
    <View key={entry.id}>
      <View style={s.logEntryRow}>
        <View style={s.logEntryIconWrap}>{entry.icon}</View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={s.logEntryTitle} numberOfLines={1}>{entry.title}</Text>
            <Text style={s.logEntryTime}>{entry.timestamp}</Text>
          </View>
          <Text style={s.logEntryDetails}>{entry.details}</Text>
          <View style={[s.logImpactTag, { backgroundColor: statusStyle[entry.impactStatus].bg, marginTop: 6, alignSelf: 'flex-start' }]}>
            <Text style={[s.logImpactText, { color: statusStyle[entry.impactStatus].text }]}>
              {entry.impact}
            </Text>
          </View>
        </View>
      </View>
      {!isLast && <View style={s.logDivider} />}
    </View>
  );

  return (
    <View style={[s.cardWrap, { marginTop: 24, marginBottom: 8 }]}>
      <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>

        <View style={s.logHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={s.logHeaderText}>Today&apos;s Logs</Text>
            {shown.length > 0 && (
              <View style={s.logCountBadge}>
                <Text style={s.logCountText}>{shown.length}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.logEntryList}>
          <View style={s.logDivider} />
          {shown.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', fontSize: 15, fontFamily: 'System' }}>Nothing logged today</Text>
            </View>
          ) : (
            shown.map((entry, i) => renderEntry(entry, i === shown.length - 1))
          )}
          <TouchableOpacity onPress={() => router.push({ pathname: '/log-history', params: { tab } })} style={{ paddingVertical: 14, alignItems: 'center' }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="See full log history">
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.orange, fontFamily: 'System' }}>See Full History →</Text>
          </TouchableOpacity>
        </View>
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
  const { colors } = useAppTheme();
  const dk = colors.isDark;
  const tc = (a: number) => dk ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const [metricId, setMetricId] = useState('protein');
  const [periodDays, setPeriodDays] = useState(30);
  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [compactW, setCompactW] = useState(0);
  const [expW, setExpW] = useState(0);
  const [selIdx, setSelIdx] = useState<number | null>(null);

  const sheetY = useRef(new Animated.Value(0)).current;

  const dismiss = () => {
    // Force-close the picker overlay first so it can't leak into the post-expanded state.
    setPickerOpen(false);
    Animated.timing(sheetY, { toValue: screenHeight, duration: 240, useNativeDriver: true }).start(() => {
      setExpanded(false);
      setSelIdx(null);
    });
  };

  // Reset sheet position + spring up when expanded flips true.
  // Putting the setValue inside the effect (not in openExpanded) makes it idempotent —
  // a double-fired tap (chart GestureDetector + outer Pressable both calling openExpanded)
  // won't reset sheetY mid-animation and strand the sheet off-screen.
  useEffect(() => {
    if (expanded) {
      sheetY.setValue(screenHeight);
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
    }
  }, [expanded, sheetY, screenHeight]);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

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

  const { dates, values, target, hitRate, average, trendPct, bestStreak, todayCenterIdx } = useMemo(() => {
    // Extend range so today sits near the center
    const futurePad = Math.max(1, Math.round(effectiveDays * 0.35));
    const totalDays = effectiveDays + futurePad;
    const ds = Array.from({ length: totalDays }, (_, i) => {
      const d = new Date(todayStr + 'T12:00:00');
      d.setDate(d.getDate() - (effectiveDays - 1 - i));
      return d.toISOString().slice(0, 10);
    });
    const todayCenter = effectiveDays - 1;
    const vs = ds.map(d => metric.getValue(foodByDate, activityByDate, d));
    const tgtRaw = metric.getTarget(targets);
    const tgt = Math.round(tgtRaw);
    const withData = vs.filter(v => v !== null) as number[];
    const onTarget = (v: number) => metric.inverseGoal ? Math.round(v) <= tgt : Math.round(v) >= tgt;
    const hr = withData.length ? withData.filter(onTarget).length / withData.length : 0;
    const avg = withData.length ? withData.reduce((s, v) => s + v, 0) / withData.length : 0;
    const mid = Math.floor(withData.length / 2);
    const firstHalf = mid > 0 ? withData.slice(0, mid).reduce((s, v) => s + v, 0) / mid : 0;
    const secondHalf = mid > 0 ? withData.slice(mid).reduce((s, v) => s + v, 0) / (withData.length - mid) : 0;
    const tp = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
    let cur = 0, best = 0;
    vs.forEach(v => { if (v !== null && onTarget(v)) { cur++; best = Math.max(best, cur); } else cur = 0; });
    return { dates: ds, values: vs, target: tgt, hitRate: hr, average: avg, trendPct: tp, bestStreak: best, todayCenterIdx: todayCenter };
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
    metric.unit === 'cal' || metric.unit === 'steps' ? Math.round(v).toLocaleString() : v.toFixed(0);
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
    const formatted = metric.unit === 'cal' || metric.unit === 'steps'
      ? Math.round(v).toLocaleString()
      : v.toFixed(0);
    const onTarget = metric.inverseGoal ? v <= target : v >= target;
    const overUnder = metric.inverseGoal ? 'over' : 'below';
    return {
      title: `${formatted} ${metric.unit}`,
      subtitle: d,
      badge: onTarget
        ? { text: 'On target', color: '#27AE60' }
        : { text: `${Math.abs(((v - target) / target) * 100).toFixed(0)}% ${overUnder}`, color: '#E74C3C' },
    };
  }, [values, dates, metric, target]);

  const openExpanded = useCallback(() => {
    setExpanded(true);
  }, []);

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

  function renderMetricDropdown() {
    return (
      <Pressable
        onPress={() => { Haptics.selectionAsync(); openPicker(); }}
        accessibilityRole="button"
        accessibilityLabel={`Select metric. Current: ${metric.label}`}
        style={({ pressed }) => ({
          marginTop: 12,
          marginBottom: 4,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderRadius: 14,
          backgroundColor: tc(pressed ? 0.10 : 0.06),
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: metric.color }} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, fontFamily: 'System' }}>
            {metric.label}
          </Text>
        </View>
        <ChevronDown size={16} color={tc(0.45)} />
      </Pressable>
    );
  }

  // Picker sheet contents (without Modal wrapper).
  // Rendered inline so it can layer over either the compact card OR the expanded sheet.
  function renderMetricPickerSheet() {
    return (
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', zIndex: 100 }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          onPress={closePicker}
        />
        <View
          style={{
            maxHeight: screenHeight * 0.7,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: 'hidden',
            paddingBottom: insets.bottom + 12,
            backgroundColor: dk ? '#141416' : '#FFFFFF',
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 6 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tc(0.18) }} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10, fontFamily: 'System', letterSpacing: -0.3 }}>
            Choose metric
          </Text>
          <ScrollView style={{ paddingHorizontal: 12 }} showsVerticalScrollIndicator={false}>
            {LIFESTYLE_METRICS.map(m => {
              const isActive = m.id === metricId;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setMetricId(m.id);
                    setSelIdx(null);
                    closePicker();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 14,
                    borderRadius: 14,
                    backgroundColor: isActive ? `${m.color}1A` : 'transparent',
                  }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color }} />
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: colors.textPrimary, fontFamily: 'System' }}>
                    {m.label}
                  </Text>
                  {isActive && <Check size={20} color={m.color} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  }

  // Wraps the picker sheet in a Modal — used when no other modal is active.
  function renderMetricPicker() {
    if (!pickerOpen || expanded) return null;
    return (
      <Modal visible transparent animationType="fade" onRequestClose={closePicker}>
        {renderMetricPickerSheet()}
      </Modal>
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
              backgroundColor: periodDays === p.days ? tc(0.15) : 'transparent',
            }}
          >
            <Text style={{
              fontSize: 13, fontWeight: '600', fontFamily: 'System',
              color: periodDays === p.days ? colors.textPrimary : tc(0.35),
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
          <Text style={{ fontSize: 14, color: tc(0.35), fontFamily: 'System' }}>
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
                stroke={tc(0.07)} strokeWidth={1} strokeDasharray="3,4" />
              <SvgText x={LT_TML - 6} y={y + 3.5}
                fontSize={11} fill={tc(0.35)}
                textAnchor="end" fontFamily="System">
                {label}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* X-axis vertical tick lines + labels */}
        {labels.map((lbl, i) => (
          <React.Fragment key={i}>
            <Line x1={lbl.x} y1={LT_TMT} x2={lbl.x} y2={LT_TMT + plotH}
              stroke={tc(0.04)} strokeWidth={1} />
            <SvgText x={lbl.x} y={chartH - 5}
              fontSize={11} fill={tc(0.35)}
              textAnchor="middle" fontFamily="System">
              {lbl.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Today vertical marker */}
        {todayCenterIdx < data.pts.length && data.pts[todayCenterIdx] && (
          <>
            <Line x1={data.pts[todayCenterIdx].x} y1={LT_TMT} x2={data.pts[todayCenterIdx].x} y2={LT_TMT + plotH}
              stroke={metric.color} strokeWidth={1} strokeOpacity={0.3} strokeDasharray="3,3" />
            <SvgText x={data.pts[todayCenterIdx].x} y={LT_TMT - 2}
              fontSize={9} fill={metric.color} fillOpacity={0.6}
              textAnchor="middle" fontFamily="System" fontWeight="600">
              Today
            </SvgText>
          </>
        )}

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
              fontSize={10} fill={metric.color} fillOpacity={0.6}
              textAnchor="end" fontFamily="System">
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
          borderRadius: 24,
          backgroundColor: colors.surface,
          borderWidth: 0.5,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 16,
        }}
      >
        {/* Tappable area: period tabs + chart + footer — opens expanded view */}
        <Pressable onPress={openExpanded} accessibilityLabel={`${metric.label} trend chart. Tap to expand`} accessibilityRole="button">
          {/* Period tabs — top */}
          {renderPeriodTabs()}
          {/* Chart with scrub */}
          <GestureDetector gesture={ltCompactScrub.gesture}>
            <View style={{ height: LT_COMPACT_H, position: 'relative' }} onLayout={e => setCompactW(e.nativeEvent.layout.width)}>
              {compactW > 0 && (
                <Reanimated.View key={metricId} entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
                  {renderChart(LT_COMPACT_H, compact, compactW, compactLabels, 'ltGradCompact')}
                </Reanimated.View>
              )}
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
          {/* Footer stats */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <Text style={{ fontSize: 13, color: tc(0.5), fontFamily: 'System' }}>
              Avg {hasData ? fmtVal(average) : '--'} {metric.unit}/day
            </Text>
            {hasData && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: `${hitRateColor}22` }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: hitRateColor, fontFamily: 'System' }}>
                  {hitRatePct}% on target
                </Text>
              </View>
            )}
          </View>
        </Pressable>
        {/* Metric dropdown — bottom (not tappable for expand) */}
        {renderMetricDropdown()}
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
            <BlurView intensity={60} tint={dk ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: dk ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.85)' }]} />

            {/* Drag handle */}
            <View
              {...panRef.panHandlers}
              style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 12 }}
            >
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tc(0.18) }} />
            </View>

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'System' }}>
                {metric.label} Trend
              </Text>
              <Pressable onPress={dismiss} hitSlop={12}>
                <XCircle size={28} color={tc(0.4)} />
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
                  <View style={{ height: LT_EXP_H, position: 'relative' }} onLayout={e => setExpW(e.nativeEvent.layout.width)}>
                    {expW > 0 && (
                      <Reanimated.View key={metricId} entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
                        {renderChart(LT_EXP_H, exp, expW, expLabels, 'ltGradExp')}
                      </Reanimated.View>
                    )}
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

              {/* Metric dropdown — below chart */}
              {renderMetricDropdown()}

              {/* Selected point tooltip */}
              {selValue !== null && selDate !== null && (
                <View style={{ marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: tc(0.08), marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, color: tc(0.5), fontFamily: 'System' }}>{selDate}</Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, fontFamily: 'System', marginTop: 2 }}>
                    {fmtVal(selValue)} {metric.unit}
                  </Text>
                  {(() => {
                    const onTarget = metric.inverseGoal ? Math.round(selValue) <= target : Math.round(selValue) >= target;
                    const overUnder = metric.inverseGoal ? 'over' : 'below';
                    return (
                      <Text style={{
                        fontSize: 14, fontWeight: '600', fontFamily: 'System', marginTop: 2,
                        color: onTarget ? '#27AE60' : '#E74C3C',
                      }}>
                        {onTarget
                          ? 'On target ✓'
                          : `${Math.abs(((selValue - target) / target) * 100).toFixed(0)}% ${overUnder} target`}
                      </Text>
                    );
                  })()}
                </View>
              )}

              {/* Insights panel */}
              {hasData && (
                <View style={{ marginTop: 16 }}>
                  {/* Hit rate */}
                  <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ fontSize: 56, fontWeight: '800', color: hitRateColor, fontFamily: 'System', lineHeight: 60 }}>
                      {hitRatePct}%
                    </Text>
                    <Text style={{ fontSize: 15, color: tc(0.5), fontFamily: 'System' }}>
                      of days on target
                    </Text>
                  </View>

                  {/* Stat chips */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[
                      { value: fmtVal(average), sub: `avg ${metric.unit}/day`, color: colors.textPrimary },
                      { value: `${trendSign}${trendPct.toFixed(0)}%`, sub: 'trend vs prior', color: (metric.inverseGoal ? trendPct <= 0 : trendPct >= 0) ? '#27AE60' : '#E74C3C' },
                      { value: `${bestStreak}d`, sub: 'best streak', color: colors.textPrimary },
                    ].map((chip, i) => (
                      <View key={i} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: tc(0.06), alignItems: 'center' }}>
                        <Text style={{ fontSize: 17, fontWeight: '700', color: chip.color, fontFamily: 'System' }}>{chip.value}</Text>
                        <Text style={{ fontSize: 12, color: tc(0.45), fontFamily: 'System', marginTop: 2, textAlign: 'center' }}>{chip.sub}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Contextual text */}
                  <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: tc(0.04) }}>
                    <Text style={{ fontSize: 15, color: tc(0.6), fontFamily: 'System', lineHeight: 20 }}>
                      {hitRatePct >= 70
                        ? `You're consistently hitting your ${metric.label.toLowerCase()} target. Keep it up!`
                        : hitRatePct >= 40
                        ? `You're hitting your ${metric.label.toLowerCase()} target ${hitRatePct}% of the time. Small improvements can add up.`
                        : metric.inverseGoal
                          ? `You've been over your ${metric.label.toLowerCase()} target most days. Try cutting back.`
                          : `Your ${metric.label.toLowerCase()} is below target most days. Focus here to maximize your GLP-1 results.`}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Picker sheet — layered on top of the expanded sheet */}
            {pickerOpen && renderMetricPickerSheet()}
          </Animated.View>
        </View>
      </Modal>

      {/* Metric picker (only when expanded sheet is closed) */}
      {renderMetricPicker()}
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { colors } = useAppTheme();
  const { appleHealthEnabled, headerStyle } = usePreferencesStore();
  const minimalHeader = (headerStyle ?? 'gradient') === 'minimal';
  const s = useMemo(() => createStyles(colors, minimalHeader), [colors, minimalHeader]);
  const scrollY = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { onScroll: tabBarOnScroll, onScrollEnd } = useTabBarVisibility();
  const onScroll = useCallback((e: any) => { scrollY.setValue(e.nativeEvent.contentOffset.y); tabBarOnScroll(e); }, [tabBarOnScroll]);
  const health = useHealthData();
  const { targets } = health;
  const { weightLogs, injectionLogs, foodLogs, activityLogs, sideEffectLogs, profile, deleteInjectionLog, fetchInsightsData, syncWeightFromHealthKit } = useLogStore();
  const hkStore = useHealthKitStore();
  // Shared lifestyle data. The same hook powers the three /insights detail
  // screens so the row preview and detail cards never diverge.
  const { todayCalories, todaySteps, routedHealthGroups } = useLifestyleMetrics();
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

  const todayStr = localDateStr();

  // ── Historical aggregations ────────────────────────────────────────────────
  const foodByDate: FoodByDate = useMemo(() => {
    const map: FoodByDate = {};
    foodLogs.forEach(log => {
      const date = localDateStr(new Date(log.logged_at));
      if (!map[date]) map[date] = {
        protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0,
        sodium_mg: 0, sugar_g: 0, saturated_fat_g: 0, cholesterol_mg: 0,
      };
      map[date].protein         += log.protein_g;
      map[date].carbs           += log.carbs_g;
      map[date].fat             += log.fat_g;
      map[date].calories        += log.calories;
      map[date].fiber           += log.fiber_g;
      map[date].sodium_mg       += log.sodium_mg ?? 0;
      map[date].sugar_g         += log.sugar_g ?? 0;
      map[date].saturated_fat_g += log.saturated_fat_g ?? 0;
      map[date].cholesterol_mg  += log.cholesterol_mg ?? 0;
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

  // ── Shot phase (needed for biometric baseline exclusion) ───────────────────
  const currentShotPhase = getShotPhase(Math.min(lastDaysSince, 7));

  // ── Refresh data on tab focus ───────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    fetchInsightsData();
    if (!appleHealthEnabled) return;
    hkStore.fetchAll().then(() => syncWeightFromHealthKit()).catch(() => {});
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

  // ── Progress data ──────────────────────────────────────────────────────────
  // Prefer Supabase-persisted profile fields; fall back to in-memory onboarding profile
  const heightIn    = (profile?.height_inches
                      ?? (health.profile.heightFt * 12 + health.profile.heightIn)) || null;
  const startWeight = (profile?.start_weight_lbs
                      ?? health.profile.startWeightLbs) || null;
  const goalWeight  = (profile?.goal_weight_lbs
                      ?? health.profile.goalWeightLbs) || null;
  // Use profile.current_weight_lbs (synced on every weigh-in) as primary source.
  // weightLogs[0] can be the onboarding seed weight whose synthetic timestamp
  // sorts after real logs, making it unreliable as "latest."
  const currentWeight = (profile?.current_weight_lbs ?? health.profile.currentWeightLbs)
    || weightLogs[0]?.weight_lbs
    || startWeight;
  const bmi        = currentWeight && heightIn ? computeBMI(currentWeight, heightIn) : null;
  const startBmi   = startWeight && heightIn   ? computeBMI(startWeight, heightIn)   : null;
  const rawBmiDelta = bmi && startBmi ? Math.round((startBmi - bmi) * 10) / 10 : null;
  const bmiDelta   = rawBmiDelta !== 0 ? rawBmiDelta : null;
  const toGoalPct  = startWeight && currentWeight && goalWeight
    ? goalProgress(startWeight, currentWeight, goalWeight)
    : null;

  const weightLost = startWeight != null && currentWeight != null
    ? Math.round((startWeight - currentWeight) * 10) / 10
    : null;
  const weightLostPct = weightLost != null && weightLost > 0 && startWeight
    ? Math.round((weightLost / startWeight) * 1000) / 10
    : null;

  // Body composition analytics
  const fatToLeanResult = useMemo(() => computeFatToLeanRatio(weightLogs), [weightLogs]);
  const bodyCompTrend = useMemo(() => bodyCompTrendData(weightLogs), [weightLogs]);

  // Advanced trends (clinical benchmark, lean preservation)
  const benchmarkResult = useMemo(
    () => computeClinicalBenchmark(weightLogs, profile?.program_start_date ?? null, health.profile.glp1Type),
    [weightLogs, profile?.program_start_date, health.profile.glp1Type],
  );
  const leanPreservationResult = useMemo(
    () => computeLeanPreservation(weightLogs),
    [weightLogs],
  );

  // Latest body comp values for stat cards
  const latestBodyFatLog = useMemo(() => {
    const withBf = weightLogs.filter(l => l.body_fat_pct != null);
    return withBf.length > 0 ? withBf[0] : null; // weightLogs are sorted newest-first
  }, [weightLogs]);
  const firstBodyFatLog = useMemo(() => {
    const withBf = weightLogs.filter(l => l.body_fat_pct != null);
    return withBf.length > 1 ? withBf[withBf.length - 1] : null;
  }, [weightLogs]);
  const bodyFatDelta = latestBodyFatLog && firstBodyFatLog
    ? Math.round(((firstBodyFatLog.body_fat_pct ?? 0) - (latestBodyFatLog.body_fat_pct ?? 0)) * 10) / 10
    : null;

  const latestLeanLog = useMemo(() => {
    const withLm = weightLogs.filter(l => l.lean_mass_lbs != null);
    return withLm.length > 0 ? withLm[0] : null;
  }, [weightLogs]);

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


  // ── Today's logs (all types, for the shared Today's Logs card) ──────────────
  const todayLogs: LogEntry[] = [
    ...foodLogs.filter(f => localDateStr(new Date(f.logged_at)) === todayStr).map(foodToEntry),
    ...activityLogs.filter(a => a.date === todayStr).map(activityToEntry),
    ...weightLogs
      .map((log, i) => [log, weightLogs[i + 1]] as const)
      .filter(([log]) => localDateStr(new Date(log.logged_at)) === todayStr)
      .map(([log, prev]) => weightToEntry(log, prev)),
    ...injectionLogs.filter(inj => inj.injection_date === todayStr).map(inj => injectionToEntry(inj, oral)),
    ...sideEffectLogs.filter(se => localDateStr(new Date(se.logged_at)) === todayStr).map(sideEffectToEntry),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          onScrollEndDrag={onScrollEnd}
          onMomentumScrollEnd={onScrollEnd}
          scrollEventThrottle={16}
        >
          <GradientBackground />
          <Pressable onLongPress={handleBackgroundLongPress} delayLongPress={600}>

          {/* ── Hero title ── */}
          <View style={s.heroHeader}>
            <Text style={s.heroTitle}>Insights</Text>
          </View>

          {/* ── Segmented Control ── */}
          <View style={{ marginTop: 16, marginBottom: 12 }}>
            <SlidingTabs
              tabs={onTreatment ? TABS : TABS.filter(t => t.key !== 'medication')}
              activeKey={activeTab}
              onChange={setActiveTab}
              height={42}
              borderRadius={28}
              padding={5}
            />
          </View>
          {/* <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 6, marginBottom: 4 }}>
            <MessageCircle size={11} color={colors.textMuted} />
            <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: 'System' }}>
              Hold any card to ask AI
            </Text>
          </View> */}

          {/* ── Lifestyle content ── */}
          {activeTab === 'lifestyle' && (
            <Reanimated.View key="lifestyle" entering={FadeIn.duration(350)}>
              {/* <AIInsightsCard /> */}

              <View style={{ height: 4 }} />
              {/* ── Lifestyle Trend Card ── */}
              <LifestyleTrendCard
                foodByDate={foodByDate}
                activityByDate={activityByDate}
                todayStr={todayStr}
                targets={targets}
                profile={profile}
              />

              <View style={{ height: 12 }} />
              <View style={{ gap: 12 }}>
                <CategoryRow
                  icon={<IconSymbol name="fork.knife" size={18} color={categoryColor(colors.isDark, 'nutrition')} />}
                  label="Nutrition"
                  categoryKey="nutrition"
                  todayValue={`${todayCalories.toLocaleString()} cal`}
                  onPress={() => router.push('/insights/nutrition')}
                  aiChips={['How am I doing on nutrition?', 'Is my protein intake on track?', 'What should I eat next?', 'How does GLP-1 affect appetite?']}
                />
                <CategoryRow
                  icon={<IconSymbol name="bolt.fill" size={18} color={categoryColor(colors.isDark, 'activity')} />}
                  label="Activity"
                  categoryKey="activity"
                  todayValue={todaySteps > 0 ? `${todaySteps.toLocaleString()} steps` : '—'}
                  onPress={() => router.push('/insights/activity')}
                  aiChips={['Am I active enough today?', 'How can I move more?', 'How does activity affect GLP-1 results?', 'What workout fits my phase?']}
                />
                <CategoryRow
                  icon={<Heart size={18} color={healthCategoryColor(colors.isDark, 'Vitals')} />}
                  label="Vitals"
                  categoryKey="vitals"
                  todayValue={
                    hkStore.hrv != null ? `${hkStore.hrv} ms HRV`
                    : hkStore.restingHR != null ? `${hkStore.restingHR} bpm RHR`
                    : hkStore.sleepHours != null ? `${hkStore.sleepHours.toFixed(1)} h sleep`
                    : '—'
                  }
                  onPress={() => router.push('/insights/vitals')}
                  aiChips={['What do my biometrics show?', 'How is GLP-1 affecting my HRV?', 'How was my sleep last night?', 'What should I watch for?']}
                />
              </View>

              <TodayLogsCard entries={todayLogs} tab="lifestyle" />
            </Reanimated.View>
          )}

          {/* ── Medication content ── */}
          {activeTab === 'medication' && (
            <Reanimated.View key="medication" entering={FadeIn.duration(350)}>
              {/* <MedAIInsightsCard /> */}
              <MedLevelChartCard
                chartData={medChartData}
                daysSince={lastDaysSince}
                dayLabels={medDayLabels}
                glp1Type={health.profile.glp1Type}
                medicationBrand={health.profile.medicationBrand}
                isDailyDrug={isDailyDrug}
                oral={oral}
                currentCyclePct={currentCyclePct}
                currentConcentrationPct={currentConcentrationPct}
                injFreqDays={health.profile.injectionFrequencyDays ?? 7}
                injTimestamp={injTimestamp}
                lastDoseMg={lastInj?.dose_mg ?? null}
              />
              <SideEffectsCard logs={sideEffectLogs} />
              <PremiumGate feature="side_effect_insights" variant="soft" title="Side Effect Insights">
                <SideEffectInsightsEntryCard count={sideEffectLogs.length} />
              </PremiumGate>
              {appleHealthEnabled && (hkStore.hrv != null || hkStore.restingHR != null || hkStore.sleepHours != null) && (
                <>
                  <Text style={[s.sectionTitle, { marginTop: 8 }]}>Cycle Biometrics</Text>
                  <CycleBiometricCard
                    result={cycleIntelligenceResult}
                    cycleiqContext={cycleiqContextStr}
                  />
                </>
              )}
              <View style={{ height: 12 }} />
              <LatestInjectionEntry
                lastInj={lastInj}
                lastSite={lastSite}
                rotateTo={rotateTo}
                lastDosage={lastDosage}
                nextInjLabel={nextInjLabel}
                lastDaysSince={lastDaysSince}
                oral={oral}
              />
              <TodayLogsCard entries={todayLogs} tab="medication" />
            </Reanimated.View>
          )}

          {/* ── Progress content ── */}
          {activeTab === 'progress' && (
            <Reanimated.View key="progress" entering={FadeIn.duration(350)}>
              {/* <ProgAIInsightsCard /> */}
              <WeightProjectionCard
                projection={projection ?? null}
                datasets={weightDatasets}
                currentWeight={currentWeight}
                startWeight={startWeight}
                programWeek={programWeek}
              />
              <WeightGoalCard
                projection={projection ?? null}
                currentWeight={currentWeight}
                goalWeight={goalWeight}
                toGoalPct={toGoalPct}
              />
              <View style={[s.dailyGrid, { marginBottom: 14 }]}>
                <ProgressStatCard
                  icon={<IconSymbol name="dumbbell.fill" size={20} color={colors.orange} />}
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
                  icon={<IconSymbol name="chart.line.downtrend.xyaxis" size={20} color={colors.orange} />}
                  label="Lost So Far"
                  value={weightLost != null ? `${weightLost} lbs` : '0 lbs'}
                >
                  {weightLostPct != null && weightLostPct > 0 && (
                    <View style={[s.changeBadge, { backgroundColor: statusStyle.positive.bg }]}>
                      <Text style={[s.changeText, { color: statusStyle.positive.text }]}>↓ {weightLostPct}% of body wt</Text>
                    </View>
                  )}
                </ProgressStatCard>
              </View>

              {/* Body composition stat cards */}
              {(latestBodyFatLog || latestLeanLog) && (
                <View style={[s.dailyGrid, { marginBottom: 14 }]}>
                  {latestBodyFatLog && (
                    <ProgressStatCard
                      icon={<IconSymbol name="percent" size={20} color={colors.orange} />}
                      label="Body Fat"
                      value={`${latestBodyFatLog.body_fat_pct}%`}
                    >
                      {bodyFatDelta != null && bodyFatDelta > 0 && (
                        <View style={[s.changeBadge, { backgroundColor: statusStyle.positive.bg }]}>
                          <Text style={[s.changeText, { color: statusStyle.positive.text }]}>↓ Down {bodyFatDelta}%</Text>
                        </View>
                      )}
                    </ProgressStatCard>
                  )}
                  {latestLeanLog && (
                    <ProgressStatCard
                      icon={<IconSymbol name="figure.strengthtraining.traditional" size={20} color={colors.orange} />}
                      label="Lean Mass"
                      value={`${latestLeanLog.lean_mass_lbs} lbs`}
                    />
                  )}
                </View>
              )}

              {/* Apple Health Body Composition group (moved here from Lifestyle tab) */}
              {appleHealthEnabled && routedHealthGroups.bodyComp.map((group) => (
                <View key={group.category} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: healthCategoryColor(colors.isDark, group.category) }} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', fontFamily: 'System', letterSpacing: 2, textTransform: 'uppercase' }}>
                      {group.category}
                    </Text>
                  </View>
                  <View style={s.hmGrid}>
                    {(() => {
                      const isOdd = group.metrics.length % 2 !== 0;
                      return group.metrics.map((m, i) => (
                        <HealthMonitorCard key={m.id} metric={m} fullWidth={isOdd && i === group.metrics.length - 1} />
                      ));
                    })()}
                  </View>
                </View>
              ))}

              {/* Body composition card or prompt */}
              {fatToLeanResult ? (
                <BodyCompositionCard result={fatToLeanResult} trend={bodyCompTrend} />
              ) : !latestBodyFatLog && (
                <TouchableOpacity
                  onPress={() => router.push('/entry/log-weight')}
                  activeOpacity={0.7}
                  style={{
                    borderRadius: 24, backgroundColor: colors.surface,
                    borderWidth: 0.5, borderColor: colors.border,
                    padding: 20, marginBottom: 16, alignItems: 'center', gap: 10,
                  }}
                >
                  <IconSymbol name="figure.strengthtraining.traditional" size={28} color={colors.orange} />
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>
                    Start Tracking Body Composition
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', textAlign: 'center', lineHeight: 20 }}>
                    Log body fat %, lean mass, and more alongside your weight to see how your body composition changes over time.
                  </Text>
                  <View style={{
                    marginTop: 4, backgroundColor: colors.orange, borderRadius: 14,
                    paddingHorizontal: 16, paddingVertical: 8,
                  }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#000' }}>Log Weight</Text>
                  </View>
                </TouchableOpacity>
              )}

              {onTreatment && (
                <>
                  <PremiumGate
                    feature="clinical_benchmark"
                    variant="soft"
                    title="Clinical Benchmark"
                  >
                    <ClinicalBenchmarkCard result={benchmarkResult} medicationBrand={health.profile.medicationBrand} />
                  </PremiumGate>

                  {leanPreservationResult && (
                    <PremiumGate
                      feature="lean_preservation"
                      variant="hard"
                      title="Lean Mass Preservation"
                      teaser="Track how well you're preserving muscle during weight loss."
                    >
                      <LeanMassPreservationCard result={leanPreservationResult} medicationBrand={health.profile.medicationBrand} />
                    </PremiumGate>
                  )}
                </>
              )}
              <TodayLogsCard entries={todayLogs} tab="progress" />
            </Reanimated.View>
          )}

          </Pressable>
        </ScrollView>
      </SafeAreaView>
      <ScrollTitle title="Insights" scrollY={scrollY} />
    </View>
    </TabScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors, minimalHeader = false) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 120 },

  // Hero title (matches Education / Home)
  heroHeader: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  heroTitle: { fontSize: 36, fontWeight: '800', color: minimalHeader && !c.isDark ? '#000000' : '#FFFFFF', letterSpacing: -1, fontFamily: 'System' },

  // Header (legacy)
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  headerTitle: { fontSize: 36, fontWeight: '800', color: c.textPrimary, letterSpacing: -1, fontFamily: 'System' },


  // Card base
  cardWrap: { borderRadius: 24 },
  cardBody: { overflow: 'hidden' },

  // AI Insights
  aiAccent: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, backgroundColor: c.orange, borderTopLeftRadius: 24, borderBottomLeftRadius: 24 },
  aiContent: { paddingVertical: 18, paddingLeft: 20, paddingRight: 18 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  aiLabel: { fontSize: 13, fontWeight: '700', color: c.orange, letterSpacing: 1.5, marginLeft: 6, textTransform: 'uppercase', fontFamily: 'System' },
  aiBody: { fontSize: 16, color: w(0.6), lineHeight: 21, fontFamily: 'System' },

  // Metrics row
  metricsRow: { flexDirection: 'row', gap: 20, marginBottom: 24, paddingHorizontal: 4 },
  metricWrap: { flex: 1, borderRadius: 22 },
  metricInner: { padding: 18, alignItems: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5, fontFamily: 'System' },
  metricLabel: { fontSize: 14, color: w(0.45), fontWeight: '500', textAlign: 'center', fontFamily: 'System' },

  // Daily Metrics grid
  sectionTitle: { fontSize: 20, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, marginTop: 12, marginBottom: 16, fontFamily: 'System' },
  dailyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  dailyWrap: { flexBasis: '47%', flexGrow: 1, borderRadius: 20 },
  dailyInner: { padding: 18 },
  dailyTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dailyIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  changeText: { fontSize: 12, fontWeight: '700', fontFamily: 'System' },
  dailyLabel: { fontSize: 14, color: w(0.45), fontWeight: '500', marginBottom: 6, fontFamily: 'System' },
  dailyValue: { fontSize: 22, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, fontFamily: 'System' },

  // Medication chart card
  chartMuted: { fontSize: 14, color: w(0.45), fontWeight: '500', fontFamily: 'System' },
  chartBig: { fontSize: 28, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, fontFamily: 'System' },
  dayLabel: { fontSize: 12, fontWeight: '600', color: w(0.35), letterSpacing: 0.5, fontFamily: 'System' },

  // Education sections (expanded modal)
  eduTitle: { fontSize: 17, fontWeight: '700' as const, color: c.textPrimary, fontFamily: 'System', marginBottom: 10 },
  eduBody: { fontSize: 16, color: w(0.6), lineHeight: 21, fontFamily: 'System' },
  eduSubtitle: { fontSize: 14, fontStyle: 'italic' as const, color: w(0.4), marginBottom: 8, fontFamily: 'System' },
  eduDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginBottom: 20 },

  // Progress chart
  progPeriodRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  progPeriodBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  progPeriodBtnActive: { backgroundColor: c.orange },
  progPeriodLabel: { fontSize: 14, fontWeight: '700', color: w(0.35), fontFamily: 'System' },
  progPeriodLabelActive: { color: c.textPrimary, fontFamily: 'System' },
  progCurrentDotRing: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: c.bg },
  progGoalLabel: { fontSize: 12, fontWeight: '600', color: w(0.35), fontFamily: 'System' },

  // Progress stat card
  progStatSub: { marginTop: 6 },
  progBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,116,42,0.15)', marginTop: 6, overflow: 'hidden' },
  progBarFill: { height: 6, backgroundColor: c.orange, borderRadius: 3 },

  // Recent Logs card
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
  logHeaderText: { fontSize: 18, fontWeight: '700', color: c.textPrimary, fontFamily: 'System' },
  logCountBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(255,116,42,0.12)' },
  logCountText: { fontSize: 13, fontWeight: '700', color: c.orange, fontFamily: 'System' },
  logEntryList: { paddingHorizontal: 18, paddingBottom: 14 },
  logDivider: { height: 1, backgroundColor: w(0.06) },
  logEntryRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  logEntryIconWrap: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logEntryTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary, flex: 1, fontFamily: 'System' },
  logEntryTime: { fontSize: 13, color: w(0.35), fontWeight: '500', flexShrink: 0, marginLeft: 8, fontFamily: 'System' },
  logEntryDetails: { fontSize: 14, color: w(0.45), lineHeight: 18, marginTop: 3, fontFamily: 'System' },
  logImpactTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  logImpactText: { fontSize: 12, fontWeight: '700', fontFamily: 'System' },

  // Health Monitor
  hmGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 8 },
  hmWrap: { flexBasis: '47%', flexGrow: 1, borderRadius: 20 },
  hmBody: { overflow: 'hidden', borderWidth: 0.5, borderColor: c.border },
  hmInner: { padding: 18 },
  hmTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  hmBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  hmBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: 'System' },
  hmLabel: { fontSize: 14, color: w(0.45), fontWeight: '500', marginBottom: 6, fontFamily: 'System' },
  hmValue: { fontSize: 22, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, fontFamily: 'System' },
  hmUnit: { fontSize: 15, fontWeight: '500', color: w(0.45), letterSpacing: 0, fontFamily: 'System' },
  });
};
