import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, ActivityIndicator, Animated, LayoutAnimation, LayoutChangeEvent, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';
import { useHealthData } from '@/contexts/health-data';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useInsightsAiStore } from '@/stores/insights-ai-store';
import { generatePkCurveHighRes, generateIntradayPkCurve, pkCycleLabels, pkConcentrationPct, DRUG_HALF_LIFE_LABEL, DRUG_DEFAULT_FREQ_DAYS, DRUG_IS_ORAL, INTRADAY_TIME_LABELS } from '@/constants/drug-pk';
import { BRAND_DISPLAY_NAMES } from '@/constants/user-profile';
import { useLogStore, type WeightLog, type InjectionLog, type FoodLog, type ActivityLog, type SideEffectLog } from '@/stores/log-store';
import { computeWeightProjection, type WeightProjection } from '@/lib/weight-projection';
import { localDateStr } from '@/lib/date-utils';
import { useUiStore } from '@/stores/ui-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useBiometricStore } from '@/stores/biometric-store';
import { getShotPhase } from '@/constants/scoring';
import {
  computeCycleIntelligence,
  computeMetabolicAdaptationScore,
  buildCycleBiometricContext,
} from '@/lib/cycle-intelligence';
import { CycleBiometricCard } from '@/components/cycle-biometric-card';
import { MetabolicAdaptationCard } from '@/components/metabolic-adaptation-card';

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
function hmSpo2Status(pct: number): HMStatus { return pct >= 97 ? 'good' : pct >= 94 ? 'normal' : 'low'; }
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
function HealthMonitorCard({ metric }: { metric: HealthMetric }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const ss = hmStatusStyle[metric.status];
  const icon = metric.iconSet === 'Ionicons'
    ? <Ionicons name={metric.iconName as any} size={16} color={colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'} />
    : <MaterialIcons name={metric.iconName as any} size={16} color={colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'} />;
  const { openAiChat } = useUiStore();
  const contextValue = `${metric.value}${metric.unit ? ' ' + metric.unit : ''} · ${metric.rangeLabel}`;
  return (
    <Pressable style={s.hmWrap} onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openAiChat({ type: 'metric', contextLabel: metric.label, contextValue, chips: JSON.stringify(['How can I improve this?', 'Is this normal for my phase?', `How does GLP-1 affect ${metric.label}?`, 'What trends should I watch?']) }); }}>
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

function weightDataForPeriod(logs: WeightLog[], period: '7D' | '30D' | '90D' | '1Y'): number[] {
  const days = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 }[period];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const filtered = logs
    .filter(l => l.logged_at >= since)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    .map(l => l.weight_lbs);
  return filtered.length >= 2 ? filtered : [];
}

function emojiIcon(emoji: string) {
  return <Text style={{ fontSize: 20, lineHeight: 24 }}>{emoji}</Text>;
}

function activityEmoji(exerciseType: string | null | undefined): string {
  const t = (exerciseType ?? '').toLowerCase();
  if (t.includes('run') || t.includes('jog'))     return '🏃';
  if (t.includes('walk'))                          return '🚶';
  if (t.includes('cycl') || t.includes('bike'))   return '🚴';
  if (t.includes('swim'))                          return '🏊';
  if (t.includes('yoga') || t.includes('stretch')) return '🧘';
  if (t.includes('strength') || t.includes('weight') || t.includes('lift')) return '🏋️';
  if (t.includes('hike'))                          return '🥾';
  if (t.includes('dance'))                         return '💃';
  if (t.includes('sport') || t.includes('tennis') || t.includes('basketball') || t.includes('soccer')) return '🏅';
  return '⚡';
}

function foodToEntry(f: FoodLog): LogEntry {
  const details = `${Math.round(f.calories)} cal · ${Math.round(f.protein_g)}g protein · ${Math.round(f.fiber_g)}g fiber · ${Math.round(f.carbs_g)}g carbs`;
  const impact = `+${Math.round(f.protein_g)}g protein, +${Math.round(f.carbs_g)}g carbs, +${Math.round(f.fiber_g)}g fiber`;
  return {
    id: f.id, timestamp: fmtDateTime(f.logged_at), title: f.food_name,
    details, impact, impactStatus: 'positive',
    icon: emojiIcon('🍽️'),
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
    icon: emojiIcon(activityEmoji(a.exercise_type)),
  };
}

function injectionToEntry(inj: InjectionLog): LogEntry {
  const medName = inj.medication_name ?? 'Injection';
  const batchStr = inj.batch_number ? ` · Batch #${inj.batch_number}` : '';
  const details = `Site: ${inj.site ?? '-'} · Dose: ${inj.dose_mg}mg${batchStr}`;
  const next = nextSite(inj.site ?? null);
  return {
    id: inj.id, timestamp: fmtDateOnly(inj.injection_date),
    title: `${medName} ${inj.dose_mg}mg`,
    details, impact: `Next injection in 7 days - rotate to ${next}`, impactStatus: 'neutral',
    icon: emojiIcon('💉'),
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
    icon: emojiIcon('⚖️'),
  };
}

// ─── Segmented control ────────────────────────────────────────────────────────

type Tab = 'medication' | 'lifestyle' | 'progress';

const TABS: { key: Tab; label: string }[] = [
  { key: 'medication', label: 'Medication' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'progress', label: 'Progress' },
];

function SegmentedControl({ active, onChange, colors }: { active: Tab; onChange: (t: Tab) => void; colors: AppColors }) {
  const sc = useMemo(() => createSegmentedStyles(colors), [colors]);
  return (
    <View style={sc.wrap}>
      <View style={sc.row}>
        {TABS.map(({ key, label }) => {
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
          <Text style={[s.aiLabel, { color: colors.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: -0.3, textTransform: 'none', marginBottom: 10 }]}>Insights</Text>
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

function MetricCard({ value, label, ringColor }: { value: string; label: string; ringColor: string }) {
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
  icon, label, value, change, status,
}: {
  icon: React.ReactNode; label: string; value: string; change: string; status: Status;
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
  return (
    <Pressable style={[s.dailyWrap, glassShadow]} onLongPress={handleAskAI}>
      <View style={[s.cardBody, { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={s.dailyInner}>
          <View style={s.dailyTopRow}>
            <View style={s.dailyIconWrap}>{icon}</View>
            <View style={[s.changeBadge, { backgroundColor: ss.bg }]}>
              <Text style={[s.changeText, { color: ss.text }]}>{change}</Text>
            </View>
          </View>
          <Text style={s.dailyLabel}>{label}</Text>
          <Text style={s.dailyValue}>{value}</Text>
        </View>
      </View>
    </Pressable>
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

const CHART_HEIGHT = 110;
const EXP_CHART_HEIGHT = 220;

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
    label: 'Low',
    color: '#E74C3C',
    body: "Levels are near their lowest before your next dose. GLP-1 RAs maintain a floor level - they don't drop to zero. Returning hunger is a normal pharmacological effect, not a treatment failure.",
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
function pkPointLabel(idx: number, injFreqDays: number, nPoints: number): string {
  const totalHours = injFreqDays * 24;
  const hrs = idx * (totalHours / (nPoints - 1));
  if (idx === 0) return 'Injection Day';
  if (idx === nPoints - 1) return 'Next Injection';
  const day = Math.floor(hrs / 24) + 1;
  const h = Math.round(hrs % 24);
  return `Day ${day}${h > 0 ? `, +${h}h` : ''}`;
}

function MedLevelChartCard({ chartData, daysSince, dayLabels, glp1Type, medicationBrand, isDailyDrug, currentCyclePct, currentConcentrationPct, injFreqDays }: {
  chartData: number[] | null;
  daysSince: number;
  dayLabels: string[];
  glp1Type: import('@/constants/user-profile').Glp1Type;
  medicationBrand: import('@/constants/user-profile').MedicationBrand;
  isDailyDrug: boolean;
  currentCyclePct?: number | null;
  currentConcentrationPct?: number | null;
  injFreqDays: number;
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

  if (!chartData) {
    return (
      <View style={[s.cardWrap, { marginBottom: 16 }]}>
        <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border, padding: 24, alignItems: 'center' }]}>
          <Text style={[s.chartMuted, { textAlign: 'center', marginBottom: 4 }]}>{BRAND_DISPLAY_NAMES[medicationBrand]} · {DRUG_HALF_LIFE_LABEL[glp1Type]}</Text>
          <Text style={[s.chartBig, { textAlign: 'center', marginTop: 8 }]}>Log your first injection</Text>
          <Text style={[s.chartMuted, { textAlign: 'center', marginTop: 4 }]}>Your medication level curve will appear here</Text>
        </View>
      </View>
    );
  }

  const n = chartData.length;
  const colW = chartWidth > 0 ? chartWidth / n : 0;
  const expColW = expChartWidth > 0 ? expChartWidth / n : 0;

  const points = chartData.map((v, i) => ({
    x: colW * i + colW / 2,
    y: CHART_HEIGHT - (v / 100) * CHART_HEIGHT,
  }));

  const expPoints = chartData.map((v, i) => ({
    x: expColW * i + expColW / 2,
    y: EXP_CHART_HEIGHT - (v / 100) * EXP_CHART_HEIGHT,
  }));

  const currentLevel = currentConcentrationPct ?? (chartData[chartData.length - 1] ?? 0);
  const levelLabel = isDailyDrug
    ? (glp1Type === 'liraglutide' ? 'Peaks ~11h post-dose' : 'Steady State')
    : (currentLevel >= 75 ? 'Optimal' : currentLevel >= 50 ? 'Active' : currentLevel >= 30 ? 'Tapering' : 'Low');
  const daysSinceLabel = daysSince === 1 ? 'Today' : daysSince === 2 ? 'Yesterday' : `${daysSince - 1} days ago`;
  const concentrationDisplay = isDailyDrug ? null : `${currentLevel}%`;

  const tierInfo = pkTierInfo(currentLevel);
  const halfLifeInfo = pkHalfLifeExplain(glp1Type);
  const peakInfo = pkPeakEffectsExplain(glp1Type);
  const brandName = BRAND_DISPLAY_NAMES[medicationBrand];

  // Render chart internals (used in both compact and expanded views)
  function renderChartInternals(pts: { x: number; y: number }[], chartH: number, cW: number, cWFull: number) {
    return (
      <>
        {pts.map((pt, i) => (
          <View
            key={`area-${i}`}
            style={{
              position: 'absolute',
              left: cW * i,
              width: cW,
              top: pt.y,
              bottom: 0,
              backgroundColor: 'rgba(255,116,42,0.08)',
            }}
          />
        ))}

        {pts.slice(0, -1).map((pt, i) => {
          const next = pts[i + 1];
          const dx = next.x - pt.x;
          const dy = next.y - pt.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const midX = (pt.x + next.x) / 2;
          const midY = (pt.y + next.y) / 2;
          return (
            <View
              key={`line-${i}`}
              style={{
                position: 'absolute',
                width: length,
                height: 2.5,
                backgroundColor: ORANGE,
                left: midX - length / 2,
                top: midY - 1.25,
                transform: [{ rotate: `${angle}deg` }],
                borderRadius: 2,
              }}
            />
          );
        })}

        {currentCyclePct != null && cWFull > 0 && (() => {
          const markerX = currentCyclePct * cWFull;
          const markerConc = currentConcentrationPct ?? 0;
          const markerY = chartH - (markerConc / 100) * chartH;
          return (
            <>
              <View style={{
                position: 'absolute',
                left: markerX - 0.75,
                top: 0, bottom: 0, width: 1.5,
                backgroundColor: 'rgba(255,255,255,0.3)',
                zIndex: 5,
              }} />
              <View style={{
                position: 'absolute',
                left: markerX - 18,
                top: Math.max(2, markerY - 22),
                width: 36,
                alignItems: 'center',
                backgroundColor: colors.isDark ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.85)',
                borderRadius: 5,
                paddingHorizontal: 3,
                paddingVertical: 2,
                zIndex: 10,
              }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: ORANGE, letterSpacing: 0.5 }}>NOW</Text>
              </View>
              <View style={{
                position: 'absolute',
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: '#FFFFFF',
                borderWidth: 2, borderColor: ORANGE,
                left: markerX - 5, top: markerY - 5,
                zIndex: 6,
              }} />
            </>
          );
        })()}
      </>
    );
  }

  return (
    <>
      <Pressable
        style={[s.cardWrap, { marginBottom: 16 }]}
        onPress={() => { if (!isDailyDrug && chartData) setExpandedModal(true); }}
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openAiChat({ type: 'metric', contextLabel: 'Medication Level', contextValue: `${levelLabel} · Last injection ${daysSinceLabel}`, chips: JSON.stringify(['What does optimal mean?', 'How will this change over my cycle?', 'When is my peak concentration?', 'How does this affect my appetite?']) }); }}
      >
        <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
          <View style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.chartMuted}>{brandName} · {DRUG_HALF_LIFE_LABEL[glp1Type]}</Text>
              {!isDailyDrug && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="expand-outline" size={12} color={colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
                  <Text style={[s.chartMuted, { fontSize: 10 }]}>Tap to expand</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4, marginBottom: 2, gap: 8 }}>
              <Text style={s.chartBig}>{concentrationDisplay ?? levelLabel}</Text>
              {concentrationDisplay && (
                <Text style={s.chartMuted}>remaining in body · {levelLabel}</Text>
              )}
            </View>
            <Text style={[s.chartMuted, { marginBottom: 14 }]}>
              {isDailyDrug ? 'Intraday concentration profile' : `Since last injection: ${daysSinceLabel}`}
            </Text>

            <View style={{ height: CHART_HEIGHT }} onLayout={onLayout}>
              {chartWidth > 0 && (
                <>
                  {renderChartInternals(points, CHART_HEIGHT, colW, chartWidth)}
                  {points.map((pt, i) => (
                    <View
                      key={`dot-${i}`}
                      style={{
                        position: 'absolute',
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: ORANGE,
                        left: pt.x - 4, top: pt.y - 4,
                      }}
                    />
                  ))}
                </>
              )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              {dayLabels.map((d, i) => (
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
        animationType="slide"
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
                  <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' }}>Medication Level</Text>
                  <Text style={[s.chartMuted, { marginTop: 2 }]}>{brandName} · {DRUG_HALF_LIFE_LABEL[glp1Type]}</Text>
                </View>
                <Pressable onPress={dismissSheet} hitSlop={12}>
                  <Ionicons name="close-circle" size={28} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} />
                </Pressable>
              </View>

              {/* Expanded chart */}
              <View
                style={{ height: EXP_CHART_HEIGHT, marginBottom: 0 }}
                onLayout={e => setExpChartWidth(e.nativeEvent.layout.width)}
              >
                {expChartWidth > 0 && (
                  <>
                    {renderChartInternals(expPoints, EXP_CHART_HEIGHT, expColW, expChartWidth)}
                    {/* Tappable dots */}
                    {expPoints.map((pt, i) => (
                      <Pressable
                        key={`exp-dot-tap-${i}`}
                        onPress={() => setSelectedPointIdx(selectedPointIdx === i ? null : i)}
                        style={{
                          position: 'absolute',
                          width: 40, height: 40,
                          left: pt.x - 20, top: pt.y - 20,
                          alignItems: 'center', justifyContent: 'center',
                          zIndex: 20,
                        }}
                      >
                        <View style={{
                          width: 20, height: 20, borderRadius: 10,
                          backgroundColor: selectedPointIdx === i ? '#FFFFFF' : ORANGE,
                          borderWidth: selectedPointIdx === i ? 3 : 0,
                          borderColor: ORANGE,
                        }} />
                      </Pressable>
                    ))}
                  </>
                )}
              </View>

              {/* X-axis labels */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 }}>
                {dayLabels.map((d, i) => (
                  <Text key={`exp-${d}-${i}`} style={s.dayLabel}>{d}</Text>
                ))}
              </View>

              {/* Selected point panel */}
              {selectedPointIdx !== null && (() => {
                const selPct = chartData[selectedPointIdx] ?? 0;
                const selTier = pkTierInfo(selPct);
                const ptLabel = pkPointLabel(selectedPointIdx, injFreqDays, n);
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

              {/* ── Section 1: What does X% mean? ── */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Helvetica Neue', marginBottom: 10 }}>What does {currentLevel}% mean?</Text>
                <Text style={{ fontSize: 14, color: colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', lineHeight: 21, fontFamily: 'Helvetica Neue' }}>{tierInfo.body}</Text>
              </View>

              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSubtle, marginBottom: 20 }} />

              {/* ── Section 2: Half-life explained ── */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, fontFamily: 'Helvetica Neue' }}>{brandName}'s {halfLifeInfo.halfLifeDays} half-life explained</Text>
                {halfLifeInfo.troughNote !== '' && (
                  <Text style={{ fontSize: 12, fontStyle: 'italic', color: colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginBottom: 8, fontFamily: 'Helvetica Neue' }}>{halfLifeInfo.troughNote}</Text>
                )}
                <Text style={{ fontSize: 14, color: colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', lineHeight: 21, fontFamily: 'Helvetica Neue' }}>{halfLifeInfo.body}</Text>
              </View>

              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSubtle, marginBottom: 20 }} />

              {/* ── Section 3: Peak effects ── */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="time-outline" size={16} color={ORANGE} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Helvetica Neue' }}>Peak effects and side effects</Text>
                </View>
                <Text style={[s.chartMuted, { marginBottom: 8 }]}>Time to peak (Tmax): {peakInfo.tmaxLabel}</Text>
                <Text style={{ fontSize: 14, color: colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', lineHeight: 21, fontFamily: 'Helvetica Neue' }}>{peakInfo.body}</Text>
              </View>

              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSubtle, marginBottom: 20 }} />

              {/* ── Section 4: Level guide ── */}
              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Ionicons name="bar-chart-outline" size={16} color={ORANGE} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Helvetica Neue' }}>What each level means</Text>
                </View>
                {([
                  { label: 'Optimal', range: '75 - 100%', color: '#27AE60', desc: 'Strongest GLP-1 receptor engagement. Appetite suppression is at its peak. Nausea risk is highest in this window, especially in early weeks.' },
                  { label: 'Active',  range: '50 - 74%',  color: '#5B8BF5', desc: 'Medication is in its therapeutic range. Appetite control remains strong and nausea typically eases. Most people feel best during this phase.' },
                  { label: 'Tapering', range: '30 - 49%', color: '#F6CB45', desc: 'Concentration is declining toward your next dose. Hunger may gradually return. Protein-first meals help maintain momentum.' },
                  { label: 'Low',     range: '0 - 29%',   color: '#E74C3C', desc: 'Levels are near trough before your next injection. GLP-1 drugs never drop to zero. Returning appetite is a normal pharmacological effect.' },
                ] as { label: string; range: string; color: string; desc: string }[]).map((tier) => (
                  <View
                    key={tier.label}
                    style={{
                      flexDirection: 'row',
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <View style={{ width: 3, borderRadius: 2, backgroundColor: tier.color, alignSelf: 'stretch' }} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: tier.color, fontFamily: 'Helvetica Neue' }}>{tier.label}</Text>
                        <Text style={{ fontSize: 11, color: colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', fontFamily: 'Helvetica Neue' }}>{tier.range}</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: colors.isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', lineHeight: 19, fontFamily: 'Helvetica Neue' }}>{tier.desc}</Text>
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
                <Ionicons name="sparkles" size={16} color="#FFF" />
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
  '7D': 'Last 7 days', '30D': 'Last 30 days', '90D': 'Last 3 months', '1Y': 'Last year',
};

const PERIOD_PROJ_WEEKS: Record<string, number> = { '7D': 1, '30D': 4, '90D': 13, '1Y': 52 };

function WeightChartCard({ datasets, currentWeight, projection, programWeek, chartHeight = WEIGHT_CHART_HEIGHT }: {
  datasets: Record<string, number[]>;
  currentWeight: number | null;
  projection?: WeightProjection | null;
  programWeek?: number;
  chartHeight?: number;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [activePeriod, setActivePeriod] = useState<'7D' | '30D' | '90D' | '1Y'>('90D');
  const [chartWidth, setChartWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  const data = datasets[activePeriod];
  const hasData = data && data.length >= 2;
  const n = hasData ? data.length : 0;
  const colW = chartWidth > 0 && n > 0 ? chartWidth / n : 0;

  // Projection slice: clip curve to the active period's week span
  const pw = programWeek ?? 1;
  const periodWeeks = PERIOD_PROJ_WEEKS[activePeriod] ?? 13;
  const projStartWeek = Math.max(0, pw - periodWeeks);
  const projSlice = projection?.curve.filter(p => p.week >= projStartWeek && p.week <= pw) ?? [];
  const projWeights = projSlice.map(p => p.weightLbs);

  // Unified y-range covering both actual and projected weights
  const allForRange = [...(hasData ? data : []), ...projWeights];
  const minW = allForRange.length > 0 ? Math.min(...allForRange) : 0;
  const maxW = allForRange.length > 0 ? Math.max(...allForRange) + 5 : 5;
  const range = maxW - minW || 1;

  const toY = (v: number) => chartHeight - ((v - minW) / range) * chartHeight;
  const points = hasData ? data.map((v, i) => ({ x: colW * i + colW / 2, y: toY(v) })) : [];
  const lastPt = points[points.length - 1];

  // Projection points mapped to same chart width
  const projN = projSlice.length;
  const projPoints = projN > 1
    ? projSlice.map((p, i) => ({ x: (chartWidth / (projN - 1)) * i, y: toY(p.weightLbs) }))
    : [];

  const displayWeight = currentWeight ?? (hasData ? data[data.length - 1] : null);
  const PERIODS = ['7D', '30D', '90D', '1Y'] as const;
  const { openAiChat } = useUiStore();

  return (
    <Pressable style={[s.cardWrap, { marginBottom: 16 }]} onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openAiChat({ type: 'metric', contextLabel: 'Weight Journey', contextValue: `${displayWeight != null ? displayWeight + ' lbs' : '-'} · ${PERIOD_SUBTITLES[activePeriod]}`, chips: JSON.stringify(['Am I on pace for my goal?', 'Is my rate of loss healthy on GLP-1?', 'When will I reach my goal?', 'What can I do to accelerate progress?']) }); }}>
      <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' }}>Weight Journey</Text>
              <Text style={s.chartMuted}>{PERIOD_SUBTITLES[activePeriod]}</Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: ORANGE, letterSpacing: -1, fontFamily: 'Helvetica Neue' }}>
              {displayWeight != null ? `${displayWeight} lbs` : '-'}
            </Text>
          </View>

          <View style={s.progPeriodRow}>
            {PERIODS.map((p) => {
              const isActive = activePeriod === p;
              return (
                <Pressable
                  key={p}
                  style={[s.progPeriodBtn, isActive && s.progPeriodBtnActive]}
                  onPress={(e) => { e.stopPropagation(); setActivePeriod(p); }}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Text style={[s.progPeriodLabel, isActive && s.progPeriodLabelActive]}>{p}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: chartHeight }} onLayout={onLayout}>
            {!hasData ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={s.chartMuted}>Log weight entries to see your chart</Text>
              </View>
            ) : chartWidth > 0 && (
              <>
                {points.map((pt, i) => (
                  <View
                    key={`wa-${i}`}
                    style={{
                      position: 'absolute', left: colW * i, width: colW,
                      top: pt.y, bottom: 0,
                      backgroundColor: 'rgba(255,116,42,0.08)',
                    }}
                  />
                ))}

                {points.slice(0, -1).map((pt, i) => {
                  const next = points[i + 1];
                  const dx = next.x - pt.x;
                  const dy = next.y - pt.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  const midX = (pt.x + next.x) / 2;
                  const midY = (pt.y + next.y) / 2;
                  return (
                    <View
                      key={`wl-${i}`}
                      style={{
                        position: 'absolute', width: length, height: 2.5,
                        backgroundColor: ORANGE,
                        left: midX - length / 2, top: midY - 1.25,
                        transform: [{ rotate: `${angle}deg` }],
                        borderRadius: 2,
                      }}
                    />
                  );
                })}

                {points.slice(0, -1).map((pt, i) => (
                  <View
                    key={`wd-${i}`}
                    style={{
                      position: 'absolute', width: 8, height: 8, borderRadius: 4,
                      backgroundColor: ORANGE, left: pt.x - 4, top: pt.y - 4,
                    }}
                  />
                ))}

                {lastPt && (
                  <>
                    <View style={[s.progCurrentDotRing, { left: lastPt.x - 9, top: lastPt.y - 9 }]} />
                    <View style={{
                      position: 'absolute', width: 12, height: 12, borderRadius: 6,
                      backgroundColor: ORANGE, left: lastPt.x - 6, top: lastPt.y - 6,
                    }} />
                  </>
                )}

                {/* Dashed projection line - every other segment drawn to simulate dashes */}
                {projPoints.slice(0, -1).map((pt, i) => {
                  if (i % 2 !== 0) return null;
                  const next = projPoints[i + 1];
                  const dx = next.x - pt.x;
                  const dy = next.y - pt.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  const midX = (pt.x + next.x) / 2;
                  const midY = (pt.y + next.y) / 2;
                  return (
                    <View
                      key={`proj-${i}`}
                      style={{
                        position: 'absolute',
                        width: length * 0.6,
                        height: 1.5,
                        backgroundColor: 'rgba(255,116,42,0.45)',
                        left: midX - (length * 0.6) / 2,
                        top: midY - 0.75,
                        transform: [{ rotate: `${angle}deg` }],
                        borderRadius: 1,
                      }}
                    />
                  );
                })}

                <Text style={[s.progGoalLabel, { position: 'absolute', left: 0, top: 2 }]}>
                  START ({data[0]})
                </Text>
              </>
            )}
          </View>

          {hasData && chartWidth > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3A3735' }} />
                <Text style={s.progGoalLabel}>START</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {projPoints.length > 1 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                      <View style={{ width: 5, height: 1.5, borderRadius: 1, backgroundColor: 'rgba(255,116,42,0.45)' }} />
                      <View style={{ width: 5, height: 1.5, borderRadius: 1, backgroundColor: 'rgba(255,116,42,0.45)' }} />
                    </View>
                    <Text style={[s.progGoalLabel, { color: 'rgba(255,116,42,0.6)' }]}>PROJECTED</Text>
                  </View>
                )}
                <Text style={[s.progGoalLabel, { color: ORANGE, fontWeight: '700' }]}>
                  CURRENT ({data[data.length - 1]})
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Weight projection card (tap-to-expand) ───────────────────────────────────

function WeightProjectionCard({
  projection, datasets, currentWeight, programWeek,
}: {
  projection: WeightProjection | null;
  datasets: Record<string, number[]>;
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
      <Pressable style={[s.cardWrap, { marginBottom: 16 }]} onPress={() => setExpanded(true)}>
        <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }]}>
          <View style={{ padding: 18 }}>
            {/* Header row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' }}>Weight Journey</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="expand-outline" size={12} color={w(0.3)} />
                <Text style={[s.chartMuted, { fontSize: 10 }]}>Tap to see chart</Text>
              </View>
            </View>

            {!projection ? (
              <Text style={[s.chartMuted, { textAlign: 'center', paddingVertical: 12 }]}>
                Log 2+ weight entries to see your projection
              </Text>
            ) : (
              <>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: plateauColor + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: plateauColor, fontFamily: 'Helvetica Neue' }}>{plateauLabel}</Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Pressable>

      <Modal visible={expanded} transparent animationType="slide" onRequestClose={closeSheet}>
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
                projection={projection}
                programWeek={programWeek}
                chartHeight={220}
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

const EFFECT_ICONS: Record<string, string> = {
  nausea: '🤢', vomiting: '🤮', fatigue: '😴', constipation: '😣',
  diarrhea: '🚽', headache: '🤕', injection_site: '💉', appetite_loss: '🍽️',
  dehydration: '💧', dizziness: '😵', muscle_loss: '💪', heartburn: '🔥',
  food_noise: '🧠', sulfur_burps: '💨', bloating: '😮', hair_loss: '💇', other: '⚠️',
};

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
              <Text style={{ fontSize: 18 }}>✅</Text>
              <Text style={{ fontSize: 14, color: w(0.45), fontFamily: 'Helvetica Neue' }}>No side effects logged recently</Text>
            </View>
          ) : (
            top.map((item, i) => {
              const color = severityColor(item.avgSev);
              const icon = EFFECT_ICONS[item.type] ?? '⚠️';
              const name = EFFECT_LABELS[item.type] ?? item.type;
              return (
                <View key={item.type}>
                  {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: w(0.06), marginVertical: 10 }} />}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 22, width: 30, textAlign: 'center' }}>{icon}</Text>
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { onScroll, onScrollEnd } = useTabBarVisibility();
  const health = useHealthData();
  const { actuals, targets } = health;
  const { weightLogs, injectionLogs, foodLogs, activityLogs, sideEffectLogs, profile, deleteInjectionLog } = useLogStore();
  const hkStore = useHealthKitStore();
  const { appleHealthEnabled } = usePreferencesStore();
  const biometricStore = useBiometricStore();
  const [activeTab, setActiveTab] = useState<Tab>('medication');

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
  const lastDaysSince = (() => {
    if (!lastInj?.injection_date) return 0;
    const injMs = new Date(lastInj.injection_date + 'T00:00:00').getTime();
    if (isNaN(injMs)) return 0;
    const diff = Math.floor((new Date().setHours(0, 0, 0, 0) - injMs) / 86400000) + 1;
    // Cap at 30 days - beyond that the chart is meaningless anyway
    return Math.max(1, Math.min(diff, 30));
  })();
  const nextInjLabel = lastInj
    ? nextInjectionLabel(lastInj.injection_date, profile?.injection_frequency_days ?? 7)
    : '-';
  const isDailyDrug = DRUG_DEFAULT_FREQ_DAYS[health.profile.glp1Type] === 1;
  const hasInjectionData = isDailyDrug || !!lastInj;
  const hoursElapsed = (() => {
    if (!lastInj?.injection_date) return 0;
    const injMs = new Date(lastInj.injection_date + 'T00:00:00').getTime();
    if (isNaN(injMs)) return 0;
    return Math.max(0, (Date.now() - injMs) / 3600000); // ms → hours
  })();
  const medChartData: number[] | null = hasInjectionData
    ? isDailyDrug
      ? generateIntradayPkCurve(health.profile.glp1Type)
      : generatePkCurveHighRes(
          health.profile.glp1Type,
          health.profile.glp1Status,
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
  const medicationLogs: LogEntry[] = injectionLogs.slice(0, 5).map(injectionToEntry);

  // ── Shot phase (needed for biometric baseline exclusion) ───────────────────
  const currentShotPhase = getShotPhase(Math.min(lastDaysSince, 7));

  // ── Record today's biometric day entry on tab focus ─────────────────────────
  useFocusEffect(useCallback(() => {
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

  const weightDatasets: Record<string, number[]> = {
    '7D': weightDataForPeriod(weightLogs, '7D'),
    '30D': weightDataForPeriod(weightLogs, '30D'),
    '90D': weightDataForPeriod(weightLogs, '90D'),
    '1Y': weightDataForPeriod(weightLogs, '1Y'),
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

  const progressLogs: LogEntry[] = weightLogs.slice(0, 5).map((log, i) =>
    weightToEntry(log, weightLogs[i + 1])
  );

  const startDate = profile?.program_start_date
    ? new Date(profile.program_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : (weightLogs.length > 0
      ? new Date(weightLogs[weightLogs.length - 1].logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '-');
  const currentDate = weightLogs[0]
    ? new Date(weightLogs[0].logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '-';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          onScrollEndDrag={onScrollEnd}
          onMomentumScrollEnd={onScrollEnd}
          scrollEventThrottle={16}
        >

          {/* ── Header ── */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Insights</Text>
          </View>

          {/* ── Segmented Control ── */}
          <SegmentedControl active={activeTab} onChange={setActiveTab} colors={colors} />

          {/* ── Lifestyle content ── */}
          {activeTab === 'lifestyle' && (
            <>
              <AIInsightsCard />

              <View style={s.metricsRow}>
                <MetricCard
                  value={todayActiveCalories > 0 ? todayActiveCalories.toLocaleString() : '-'}
                  label="Calories Burned"
                  ringColor={ORANGE}
                />
                <MetricCard
                  value={todaySteps > 0 ? todaySteps.toLocaleString() : '-'}
                  label="Daily Steps"
                  ringColor={colors.textPrimary}
                />
              </View>

              <Text style={s.sectionTitle}>Daily Metrics</Text>
              <View style={s.dailyGrid}>
                <DailyMetricCard
                  icon={<MaterialIcons name="restaurant" size={20} color={ORANGE} />}
                  label="Protein" value={`${todayProteinG}/${targets.proteinG}g`}
                  change={`${proteinPct}%`}
                  status={proteinPct >= 80 ? 'positive' : proteinPct >= 40 ? 'neutral' : 'negative'}
                />
                <DailyMetricCard
                  icon={<Ionicons name="leaf-outline" size={20} color={ORANGE} />}
                  label="Fiber" value={`${todayFiberG}/${targets.fiberG}g`}
                  change={`${fiberPct}%`}
                  status={fiberPct >= 80 ? 'positive' : fiberPct >= 40 ? 'neutral' : 'negative'}
                />
                <DailyMetricCard
                  icon={<Ionicons name="water-outline" size={20} color={ORANGE} />}
                  label="Hydration" value={`${waterOz}/${waterTargetOz}oz`}
                  change={`${waterPct}%`}
                  status={waterPct >= 80 ? 'positive' : waterPct >= 40 ? 'neutral' : 'negative'}
                />
                <DailyMetricCard
                  icon={<MaterialIcons name="grain" size={20} color={ORANGE} />}
                  label="Carbs" value={`${todayCarbsG}/${targets.carbsG}g`}
                  change={`${carbsPct}%`}
                  status={carbsPct >= 80 ? 'positive' : carbsPct >= 40 ? 'neutral' : 'negative'}
                />
              </View>
              <RecentLogsCard entries={lifestyleLogs} />

              {/* ── Health Monitor ── */}
              <Text style={[s.sectionTitle, { marginTop: 8 }]}>Health Monitor</Text>
              <View style={s.hmGrid}>
                {((): HealthMetric[] => {
                  const noData = !appleHealthEnabled;
                  const rhrVal   = appleHealthEnabled ? hkStore.restingHR ?? null : null;
                  const hrvVal   = appleHealthEnabled ? hkStore.hrv ?? null : null;
                  const hkSleep  = appleHealthEnabled ? hkStore.sleepHours ?? null : null;
                  const sleepMin = hkSleep != null ? Math.round(hkSleep * 60) : null;
                  const hkGlucose = appleHealthEnabled ? hkStore.bloodGlucose ?? null : null;

                  const metrics: HealthMetric[] = [
                    { id: 'rhr',  label: 'Resting HR',  value: rhrVal  != null ? String(rhrVal)  : 'No data', unit: rhrVal  != null ? 'bpm' : '', status: rhrVal  != null ? hmRhrStatus(rhrVal)   : 'normal', iconSet: 'Ionicons',      iconName: 'heart-outline', rangeLabel: rhrVal  != null ? hmRhrLabel(rhrVal)   : '-', gaugePosition: hmGaugePos('rhr',   rhrVal) },
                    { id: 'hrv',  label: 'HRV',          value: hrvVal  != null ? String(hrvVal)  : 'No data', unit: hrvVal  != null ? 'ms'  : '', status: hrvVal  != null ? hmHrvStatus(hrvVal)   : 'normal', iconSet: 'MaterialIcons', iconName: 'show-chart',    rangeLabel: hrvVal  != null ? hmHrvLabel(hrvVal)   : '-', gaugePosition: hmGaugePos('hrv',   hrvVal) },
                    { id: 'sleep',label: 'Sleep',        value: sleepMin != null ? fmtSleep(sleepMin) : 'No data', unit: '', status: sleepMin != null ? hmSleepStatus(sleepMin) : 'normal', iconSet: 'Ionicons',      iconName: 'moon-outline',  rangeLabel: sleepMin != null ? hmSleepLabel(sleepMin) : '-', gaugePosition: hmGaugePos('sleep', sleepMin) },
                    { id: 'spo2', label: 'SpO₂',         value: noData ? 'No data' : '98', unit: noData ? '' : '%', status: 'good', iconSet: 'MaterialIcons', iconName: 'bloodtype',    rangeLabel: noData ? '-' : 'Normal', gaugePosition: noData ? null : hmGaugePos('spo2', 98) },
                    { id: 'temp', label: 'Temp',          value: noData ? 'No data' : '98.4', unit: noData ? '' : '°F', status: 'normal', iconSet: 'MaterialIcons', iconName: 'thermostat',   rangeLabel: noData ? '-' : 'Normal', gaugePosition: noData ? null : hmGaugePos('temp', 98.4) },
                  ];
                  if (hkGlucose != null) metrics.push({ id: 'glucose', label: 'Blood Glucose', value: String(hkGlucose), unit: 'mg/dL', status: hkGlucose < 100 ? 'good' : hkGlucose < 125 ? 'normal' : 'elevated', iconSet: 'MaterialIcons', iconName: 'water-drop', rangeLabel: hkGlucose < 100 ? 'Normal' : hkGlucose < 125 ? 'Pre-range' : 'High', gaugePosition: hmGaugePos('glucose', hkGlucose) });
                  return metrics;
                })().map(m => <HealthMonitorCard key={m.id} metric={m} />)}
              </View>
            </>
          )}

          {/* ── Medication content ── */}
          {activeTab === 'medication' && (
            <>
              <MedAIInsightsCard />
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
              />
              <CycleBiometricCard
                result={cycleIntelligenceResult}
                cycleiqContext={cycleiqContextStr}
              />
              <Text style={s.sectionTitle}>Injection Details</Text>
              <View style={[s.dailyGrid, { marginBottom: 24 }]}>
                <InjectionCard
                  icon={<Ionicons name="body-outline" size={20} color={ORANGE} />}
                  label="Last Injection Site"
                  value={lastSite ?? '-'}
                />
                <InjectionCard
                  icon={<Ionicons name="sync-outline" size={20} color={ORANGE} />}
                  label="Rotate To"
                  value={rotateTo}
                />
                <InjectionCard
                  icon={<FontAwesome5 name="syringe" size={18} color={ORANGE} />}
                  label="Last Dosage"
                  value={lastDosage}
                />
                <InjectionCard
                  icon={<Ionicons name="calendar-outline" size={20} color={ORANGE} />}
                  label="Next Injection"
                  value={nextInjLabel}
                />
              </View>
              <SideEffectsCard logs={sideEffectLogs} />
              <RecentLogsCard entries={medicationLogs} onDelete={(id) => {
                Alert.alert('Delete Log', 'Remove this injection entry?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteInjectionLog(id) },
                ]);
              }} />
            </>
          )}

          {/* ── Progress content ── */}
          {activeTab === 'progress' && (
            <>
              <ProgAIInsightsCard />
              <WeightProjectionCard
                projection={projection ?? null}
                datasets={weightDatasets}
                currentWeight={currentWeight}
                programWeek={programWeek}
              />
              <MetabolicAdaptationCard result={metabolicAdaptationResult} />
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
                  icon={<Ionicons name="flag-outline" size={20} color={ORANGE} />}
                  label="To Goal"
                  value={toGoalPct != null ? `${toGoalPct}%` : '-'}
                >
                  {toGoalPct != null && (
                    <View style={s.progBar}>
                      <View style={[s.progBarFill, { width: `${toGoalPct}%` as any }]} />
                    </View>
                  )}
                </ProgressStatCard>
              </View>
              <RecentLogsCard entries={progressLogs} />
            </>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
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
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
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
