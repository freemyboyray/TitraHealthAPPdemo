import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
// expo-print requires a dev build; guard so Expo Go doesn't crash.
let Print: typeof import('expo-print') | undefined;
try { Print = require('expo-print'); } catch {}
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleIconButton } from '@/components/ui/circle-icon-button';
import { WeekBarChart } from '@/components/summary/week-bar-chart';
import { CompareBars, type CompareRow } from '@/components/summary/compare-bars';
import { DualLineChart } from '@/components/summary/dual-line-chart';
import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { useHealthData, waterStorageKey } from '@/contexts/health-data';
import { cardElevation, type AppColors } from '@/constants/theme';
import { computeWeeklySummary, type WeeklySummaryData } from '@/lib/weekly-summary';
import { useLogStore } from '@/stores/log-store';
import { useUiStore } from '@/stores/ui-store';
import {
  ArrowRight, BarChart3, Clock, MessageCircle,
  Share2, Sparkles, TrendingDown, TrendingUp, X,
} from 'lucide-react-native';

// Hand-illustrated metric art (same assets used across the insights + check-in screens).
const ART_NUTRITION = require('@/assets/images/cards/nutrition-bowl.png');
const ART_STEPS = require('@/assets/images/cards/steps.png');
const ART_CHECKIN = require('@/assets/images/cards/wellness-meditation.png');
const ART_SIDE_EFFECTS = require('@/assets/images/cards/symptom-log.png');
// Per-metric art for the individual chart blocks.
const ART_CALORIES = require('@/assets/images/cards/calories.png');
const ART_PROTEIN = require('@/assets/images/cards/protein.png');
const ART_FIBER = require('@/assets/images/cards/fiber.png');
const ART_WATER = require('@/assets/images/cards/hydration.png');

const GREEN = '#27AE60';
const RED = '#E53E3E';
const FF = 'System';

// Per-metric identity colors (DESIGN.md "Per-metric data colors").
const C_PROTEIN = '#E0533A';
const C_WATER = '#2BA7E0';
const C_FIBER = '#3AAE5A';
const C_STEPS = '#F5972A';
const C_SE = '#E0699B';

const FILL_NULL: (number | null)[] = [null, null, null, null, null, null, null];
const FILL_ZERO: number[] = [0, 0, 0, 0, 0, 0, 0];

// Single-letter weekday labels for the 7-day window (derived from its real start
// date, so the axis matches the actual program week — not a hardcoded Mon–Sun).
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function weekdayLabels(startStr: string): string[] {
  try {
    const d0 = new Date(`${startStr}T00:00:00`).getTime();
    return Array.from({ length: 7 }, (_, i) => WD[new Date(d0 + i * 86400000).getDay()]);
  } catch {
    return ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  }
}

// Qualitative descriptor for a higher-is-better average vs goal (protein, steps).
function goalDescriptor(avg: number | null, goal: number): string {
  if (avg == null) return 'No data logged';
  const r = goal > 0 ? avg / goal : 0;
  if (r >= 1) return 'Goal reached';
  if (r >= 0.8) return 'Close to goal';
  if (r >= 0.5) return 'Below goal';
  return 'Well below goal';
}

// Calories is a target band, not higher-is-better.
function calorieDescriptor(avg: number | null, goal: number): string {
  if (avg == null) return 'No data logged';
  const r = goal > 0 ? avg / goal : 1;
  if (r > 1.1) return 'Above target';
  if (r < 0.9) return 'Below target';
  return 'On target';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mlToOz(ml: number) { return Math.round(ml / 29.5735); }
function formatDate(d: string) {
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return d; }
}
function capitalize(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const CHECKIN_LABELS: Record<string, string> = {
  foodNoise:       'Food Noise',
  appetite:        'Appetite',
  energyMood:      'Energy & Mood',
  giBurden:        'GI Symptoms',
  activityQuality: 'Activity',
  sleepQuality:    'Sleep',
  mentalHealth:    'Mental Health',
};

// ─── PDF Builder (unchanged) ────────────────────────────────────────────────────

function buildPdfHtml(
  summary: WeeklySummaryData,
  aiInsight: string,
  brandName: string,
  doseMg: number,
): string {
  const dateRange = `${formatDate(summary.windowStart)} – ${formatDate(summary.windowEnd)}`;
  const weightRow = summary.weight.delta != null
    ? `${summary.weight.start?.toFixed(1) ?? '—'} lbs → ${summary.weight.end?.toFixed(1) ?? '—'} lbs (${summary.weight.delta > 0 ? '+' : ''}${summary.weight.delta.toFixed(1)} lbs)`
    : 'No weight logs this week';

  const checkinRows = Object.entries(summary.checkins)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `<tr><td>${CHECKIN_LABELS[k] ?? k}</td><td>${v}/100</td></tr>`)
    .join('');

  const seRow = summary.sideEffects.totalCount === 0
    ? 'None logged'
    : `${summary.sideEffects.totalCount} logged${summary.sideEffects.topTypes.length ? ': ' + summary.sideEffects.topTypes.map(capitalize).join(', ') : ''}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, System, sans-serif; color: #1a1a1a; padding: 40px; max-width: 680px; margin: auto; }
  h1   { font-size: 28px; font-weight: 800; color: #FF742A; margin-bottom: 2px; }
  .sub { font-size: 14px; color: #666; margin-bottom: 32px; }
  h2   { font-size: 16px; font-weight: 700; margin: 24px 0 8px; border-bottom: 2px solid #FF742A; padding-bottom: 4px; }
  .ai  { background: #fff8f4; border-left: 4px solid #FF742A; padding: 14px 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  th   { font-weight: 600; color: #888; }
  footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; }
</style>
</head>
<body>
<h1>titra</h1>
<div class="sub">Weekly Summary · ${dateRange} · ${capitalize(brandName)} ${doseMg}mg</div>

<h2>AI Insight</h2>
<div class="ai">${aiInsight || 'No AI insight available.'}</div>

<h2>Weight</h2>
<p>${weightRow}</p>

<h2>Nutrition (${summary.nutrition.daysLogged}/7 days logged)</h2>
<table>
  <tr><th>Metric</th><th>Avg</th><th>Target</th></tr>
  <tr><td>Calories</td><td>${summary.nutrition.avgCalories ?? '—'}</td><td>${summary.nutrition.caloriesTarget}</td></tr>
  <tr><td>Protein</td><td>${summary.nutrition.avgProteinG != null ? summary.nutrition.avgProteinG + 'g' : '—'}</td><td>${summary.nutrition.proteinTarget}g</td></tr>
  <tr><td>Fiber</td><td>${summary.nutrition.avgFiberG != null ? summary.nutrition.avgFiberG + 'g' : '—'}</td><td>${summary.nutrition.fiberTarget}g</td></tr>
  <tr><td>Water</td><td>${summary.nutrition.avgWaterMl != null ? mlToOz(summary.nutrition.avgWaterMl) + ' oz' : '—'}</td><td>${mlToOz(summary.nutrition.waterTarget)} oz</td></tr>
</table>

<h2>Activity</h2>
<table>
  <tr><th>Metric</th><th>Value</th></tr>
  <tr><td>Avg Steps</td><td>${summary.activity.avgSteps?.toLocaleString() ?? '—'} / ${summary.activity.stepsTarget.toLocaleString()}</td></tr>
  <tr><td>Active Days</td><td>${summary.activity.activeDays} / 7</td></tr>
</table>

${checkinRows ? `<h2>Check-In Scores</h2><table><tr><th>Type</th><th>Score</th></tr>${checkinRows}</table>` : ''}

<h2>Side Effects</h2>
<p>${seRow}</p>

<footer>Generated by Titra · ${new Date().toLocaleDateString()}</footer>
</body>
</html>`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Card header: title + optional subtitle on the left, the metric's hand-illustrated
// art on the right (matching the insights cards).
function CardHead({ image, title, subtitle, colors }: {
  image: ImageSourcePropType; title: string; subtitle?: string; colors: AppColors;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, fontFamily: FF, letterSpacing: -0.3 }}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={{ fontSize: 13.5, color: colors.textSecondary, fontFamily: FF, marginTop: 2 }}>{subtitle}</Text>
        )}
      </View>
      <Image source={image} style={{ width: 62, height: 62 }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

// A single metric inside a card: eyebrow + 7-day-average headline + qualitative
// descriptor (with the metric's art on the right), then a WeekBarChart with the
// goal drawn as a dashed line.
function MetricBlock({
  title, avg, unit, goal, descriptor, values, labels, color, colors, image, topGap = 16,
}: {
  title: string; avg: number | null; unit: string; goal: number; descriptor: string;
  values: (number | null)[]; labels: string[]; color: string; colors: AppColors;
  image?: ImageSourcePropType; topGap?: number;
}) {
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return (
    <View style={{ marginTop: topGap }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: w(0.4), fontFamily: FF }}>
            {title.toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
            <Text style={{ fontSize: 30, fontWeight: '800', color: colors.textPrimary, fontFamily: FF, letterSpacing: -0.6 }}>
              {avg != null ? avg.toLocaleString() : '—'}
            </Text>
            {!!unit.trim() && (
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textSecondary, fontFamily: FF }}>{unit.trim()}</Text>
            )}
            <Text style={{ fontSize: 14, color: w(0.4), fontFamily: FF, marginLeft: 2 }}>· 7-day avg</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, fontFamily: FF, marginTop: 2 }}>
            {descriptor}
          </Text>
        </View>
        {image && (
          <Image source={image} style={{ width: 46, height: 46 }} resizeMode="contain" accessibilityIgnoresInvertColors />
        )}
      </View>
      <View style={{ marginTop: 14 }}>
        <WeekBarChart values={values} labels={labels} color={color} goal={goal} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklySummaryScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const {
    weeklySummaries, foodLogs, weightLogs, activityLogs, sideEffectLogs,
    weeklyCheckins, foodNoiseLogs,
  } = useLogStore();
  const { targets } = useHealthData();
  const { openAiChat } = useUiStore();

  const { snapshot_id } = useLocalSearchParams<{ snapshot_id?: string }>();
  const snapshot = useMemo(
    () => snapshot_id
      ? weeklySummaries.find(s => s.id === snapshot_id) ?? null
      : weeklySummaries[0] ?? null,
    [snapshot_id, weeklySummaries],
  );

  const storedSummary: WeeklySummaryData | null = snapshot
    ? (snapshot.summary_data as unknown as WeeklySummaryData)
    : null;
  const aiInsight = snapshot?.ai_insight ?? '';

  const [pdfLoading, setPdfLoading] = useState(false);

  // Water lives in AsyncStorage (per-day). Load this window's 7 days so a stale
  // snapshot can be recomputed with real water values.
  const [waterByDate, setWaterByDate] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    (async () => {
      const map: Record<string, number> = {};
      const start = new Date(`${snapshot.window_start}T00:00:00`).getTime();
      for (let i = 0; i < 7; i++) {
        const d = new Date(start + i * 86400000);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const v = await AsyncStorage.getItem(waterStorageKey(ds)).catch(() => null);
        if (v) map[ds] = parseFloat(v);
      }
      if (!cancelled) setWaterByDate(map);
    })();
    return () => { cancelled = true; };
  }, [snapshot?.window_start]);

  // Older snapshots were frozen before the per-day chart fields existed (or before
  // the week's logs had synced). When we detect that stale format, recompute live
  // from the current logs for the snapshot's window so the charts reflect reality.
  const summary: WeeklySummaryData | null = useMemo(() => {
    if (!storedSummary || !snapshot) return storedSummary;
    const isStale = !Array.isArray((storedSummary.nutrition as { caloriesByDay?: unknown }).caloriesByDay);
    if (!isStale) return storedSummary;
    return computeWeeklySummary(
      { foodLogs, weightLogs, activityLogs, sideEffectLogs, weeklyCheckins, foodNoiseLogs },
      targets,
      waterByDate,
      { windowStart: snapshot.window_start, windowEnd: snapshot.window_end },
    );
  }, [storedSummary, snapshot, foodLogs, weightLogs, activityLogs, sideEffectLogs, weeklyCheckins, foodNoiseLogs, targets, waterByDate]);

  // The chronologically-previous snapshot, for week-over-week comparisons.
  const prevSummary = useMemo<WeeklySummaryData | null>(() => {
    if (!snapshot) return null;
    const earlier = weeklySummaries
      .filter(x => x.window_end < snapshot.window_start)
      .sort((a, b) => b.window_end.localeCompare(a.window_end));
    return earlier[0]
      ? (earlier[0].summary_data as unknown as WeeklySummaryData)
      : null;
  }, [snapshot, weeklySummaries]);

  const dayLabels = useMemo(
    () => (summary ? weekdayLabels(summary.windowStart) : FILL_NULL.map(() => '')),
    [summary],
  );

  // Check-in rows: this week vs last week, dropping domains with no data either week.
  const checkinRows = useMemo<CompareRow[]>(() => {
    if (!summary) return [];
    return (Object.keys(CHECKIN_LABELS) as (keyof typeof CHECKIN_LABELS)[])
      .map(k => ({
        label: CHECKIN_LABELS[k],
        current: (summary.checkins as Record<string, number | null>)[k] ?? null,
        previous: prevSummary ? ((prevSummary.checkins as Record<string, number | null>)[k] ?? null) : null,
      }))
      .filter(r => r.current != null || r.previous != null);
  }, [summary, prevSummary]);

  // Side-effect symptom log: union of types across both weeks, this/last counts.
  const seTypeRows = useMemo(() => {
    if (!summary) return [];
    const cur = summary.sideEffects.typeCounts ?? {};
    const prev = prevSummary?.sideEffects.typeCounts ?? {};
    const keys = Array.from(new Set([...Object.keys(cur), ...Object.keys(prev)]));
    return keys
      .map(type => ({ type, cur: cur[type] ?? 0, prev: prev[type] ?? 0 }))
      .sort((a, b) => (b.cur - a.cur) || (b.prev - a.prev));
  }, [summary, prevSummary]);

  if (!profile) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.orange} />
      </View>
    );
  }

  // From history → go back. From the home card → return to the dashboard.
  const handleClose = () => (snapshot_id ? router.back() : router.replace('/(tabs)'));

  const handleExportPdf = async () => {
    if (!summary || !profile) return;
    if (!Print) { console.warn('expo-print not available in Expo Go'); return; }
    setPdfLoading(true);
    try {
      const html = buildPdfHtml(summary, aiInsight, profile.medicationBrand, profile.doseMg);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch (err) {
      console.warn('PDF export error:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleAskAi = () => {
    openAiChat({
      type: 'weekly_summary',
      chips: JSON.stringify([
        'Why did my weight change this week?',
        'How can I hit my protein goal?',
        'Is my activity level on track?',
        'What should I tell my provider?',
      ]),
    });
  };

  const dateRange = summary
    ? `${formatDate(summary.windowStart)} – ${formatDate(summary.windowEnd)}`
    : '';

  // Weight hero values
  const wDelta = summary?.weight.delta ?? null;
  const wDown = (wDelta ?? 0) <= 0;
  const wColor = wDelta == null ? colors.textSecondary : wDown ? GREEN : RED;
  const wDescriptor = wDelta == null
    ? 'No weight logged this week'
    : wDelta === 0 ? 'Holding steady'
    : wDown ? 'Trending down · on track' : 'Up slightly this week';

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <CircleIconButton icon={X} onPress={handleClose} accessibilityLabel="Close summary" />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>Weekly Summary</Text>
          {dateRange ? <Text style={s.headerSub}>{dateRange}</Text> : null}
        </View>
        <CircleIconButton
          icon={Clock}
          onPress={() => router.push('/entry/weekly-summary-history' as any)}
          accessibilityLabel="Past summaries"
        />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Not-ready state */}
        {!summary && (
          <View style={s.emptyState}>
            <BarChart3 size={48} color={colors.textSecondary} style={{ marginBottom: 14, opacity: 0.4 }} />
            <Text style={s.emptyTitle}>No summary yet</Text>
            <Text style={s.emptyBody}>
              Your weekly summary is generated automatically once you complete your first
              full week on your program. Check back then.
            </Text>
          </View>
        )}

        {summary && (
          <>
            {/* ── Weight hero (radial glow number) ── */}
            <View style={s.card}>
              <View style={s.hero}>
                <View pointerEvents="none" style={[s.heroGlow, { backgroundColor: wColor + '26' }]} />
                <Text style={s.heroEyebrow}>WEIGHT</Text>
                {wDelta == null ? (
                  <Text style={[s.heroValue, { color: colors.textPrimary, fontSize: 30 }]}>—</Text>
                ) : (
                  <View style={s.heroValueRow}>
                    {wDown
                      ? <TrendingDown size={26} color={wColor} />
                      : <TrendingUp size={26} color={wColor} />}
                    <Text style={[s.heroValue, { color: wColor }]}>
                      {wDelta > 0 ? '+' : ''}{wDelta.toFixed(1)}
                    </Text>
                    <Text style={[s.heroUnit, { color: wColor }]}>lbs</Text>
                  </View>
                )}
                <View style={s.heroStatusRow}>
                  <View style={[s.statusDot, { backgroundColor: wColor }]} />
                  <Text style={s.heroDescriptor}>{wDescriptor}</Text>
                </View>
                {summary.weight.start != null && summary.weight.end != null && (
                  <View style={s.heroRange}>
                    <Text style={s.heroRangeText}>{summary.weight.start.toFixed(1)}</Text>
                    <ArrowRight size={14} color={colors.textMuted} />
                    <Text style={s.heroRangeText}>{summary.weight.end.toFixed(1)} lbs</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── AI Insight ── */}
            <View style={s.card}>
              <View style={s.cardPad}>
                <View style={s.aiHead}>
                  <Sparkles size={15} color={colors.orange} />
                  <Text style={s.aiLabel}>AI INSIGHT</Text>
                </View>
                <Text style={s.aiText}>
                  {aiInsight || 'Tap “Chat with AI” for a personalized recap of your week.'}
                </Text>
                <TouchableOpacity style={s.askAiBtn} onPress={handleAskAi} activeOpacity={0.7}>
                  <MessageCircle size={14} color={colors.orange} />
                  <Text style={s.askAiBtnText}>Ask AI about this week</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Nutrition (daily bar charts) ── */}
            <View style={s.card}>
              <View style={s.cardPad}>
                <CardHead
                  image={ART_NUTRITION} title="Nutrition"
                  subtitle={`${summary.nutrition.daysLogged} of 7 days logged`}
                  colors={colors}
                />

                <MetricBlock
                  title="Calories" avg={summary.nutrition.avgCalories} unit=" cal"
                  goal={summary.nutrition.caloriesTarget}
                  descriptor={calorieDescriptor(summary.nutrition.avgCalories, summary.nutrition.caloriesTarget)}
                  values={summary.nutrition.caloriesByDay ?? FILL_NULL}
                  labels={dayLabels} color={colors.orange} colors={colors} image={ART_CALORIES}
                />

                <View style={s.divider} />

                <MetricBlock
                  title="Protein" avg={summary.nutrition.avgProteinG} unit="g"
                  goal={summary.nutrition.proteinTarget}
                  descriptor={goalDescriptor(summary.nutrition.avgProteinG, summary.nutrition.proteinTarget)}
                  values={summary.nutrition.proteinByDay ?? FILL_NULL}
                  labels={dayLabels} color={C_PROTEIN} colors={colors} image={ART_PROTEIN}
                  topGap={20}
                />

                <View style={s.divider} />

                <MetricBlock
                  title="Fiber" avg={summary.nutrition.avgFiberG} unit="g"
                  goal={summary.nutrition.fiberTarget}
                  descriptor={goalDescriptor(summary.nutrition.avgFiberG, summary.nutrition.fiberTarget)}
                  values={summary.nutrition.fiberByDay ?? FILL_NULL}
                  labels={dayLabels} color={C_FIBER} colors={colors} image={ART_FIBER}
                  topGap={20}
                />

                <View style={s.divider} />

                <MetricBlock
                  title="Water"
                  avg={summary.nutrition.avgWaterMl != null ? mlToOz(summary.nutrition.avgWaterMl) : null}
                  unit=" oz"
                  goal={mlToOz(summary.nutrition.waterTarget)}
                  descriptor={goalDescriptor(
                    summary.nutrition.avgWaterMl != null ? mlToOz(summary.nutrition.avgWaterMl) : null,
                    mlToOz(summary.nutrition.waterTarget),
                  )}
                  values={(summary.nutrition.waterByDay ?? FILL_NULL).map(ml => (ml == null ? null : mlToOz(ml)))}
                  labels={dayLabels} color={C_WATER} colors={colors} image={ART_WATER}
                  topGap={20}
                />
              </View>
            </View>

            {/* ── Activity (daily step bars) ── */}
            <View style={s.card}>
              <View style={s.cardPad}>
                <CardHead
                  image={ART_STEPS} title="Activity"
                  subtitle={`${summary.activity.activeDays} of 7 days active`}
                  colors={colors}
                />
                <MetricBlock
                  title="Steps" avg={summary.activity.avgSteps} unit=""
                  goal={summary.activity.stepsTarget}
                  descriptor={goalDescriptor(summary.activity.avgSteps, summary.activity.stepsTarget)}
                  values={(summary.activity.stepsByDay ?? FILL_ZERO).map(v => (v > 0 ? v : null))}
                  labels={dayLabels} color={C_STEPS} colors={colors}
                  topGap={6}
                />
              </View>
            </View>

            {/* ── Check-In Scores (this week vs last week) ── */}
            <View style={s.card}>
              <View style={s.cardPad}>
                <CardHead image={ART_CHECKIN} title="Check-In Scores" colors={colors} />
                {checkinRows.length === 0 ? (
                  <Text style={[s.mutedBody, { marginTop: 6 }]}>No check-ins completed this week</Text>
                ) : (
                  <View style={{ marginTop: 8 }}>
                    <CompareBars rows={checkinRows} color={GREEN} hasPrevious={!!prevSummary} />
                  </View>
                )}
              </View>
            </View>

            {/* ── Side Effects (this week vs last week trend) ── */}
            <View style={s.card}>
              <View style={s.cardPad}>
                <CardHead
                  image={ART_SIDE_EFFECTS} title="Side Effects"
                  subtitle={
                    summary.sideEffects.totalCount === 0 && seTypeRows.length === 0
                      ? undefined
                      : `${summary.sideEffects.totalCount} logged this week${prevSummary ? ` · ${prevSummary.sideEffects.totalCount} last week` : ''}`
                  }
                  colors={colors}
                />
                {summary.sideEffects.totalCount === 0 && seTypeRows.length === 0 ? (
                  <Text style={[s.mutedBody, { marginTop: 6 }]}>None logged this week</Text>
                ) : (
                  <>
                    <View style={{ marginTop: 8 }}>
                      <DualLineChart
                        current={summary.sideEffects.countByDay ?? FILL_ZERO}
                        previous={prevSummary?.sideEffects.countByDay ?? null}
                        labels={dayLabels} color={C_SE}
                      />
                    </View>

                    {seTypeRows.length > 0 && (
                      <View style={{ marginTop: 18 }}>
                        <Text style={s.logHeader}>SYMPTOM LOG</Text>
                        <View style={s.logRow}>
                          <Text style={[s.logCellLabel, { color: colors.textMuted, fontWeight: '700' }]}>Type</Text>
                          <Text style={[s.logCellNum, { color: colors.textMuted }]}>This wk</Text>
                          <Text style={[s.logCellNum, { color: colors.textMuted }]}>Last wk</Text>
                        </View>
                        {seTypeRows.map(r => (
                          <View key={r.type} style={s.logRow}>
                            <Text style={s.logCellLabel} numberOfLines={1}>{capitalize(r.type)}</Text>
                            <Text style={[s.logCellNum, { color: r.cur > 0 ? colors.textPrimary : colors.textMuted }]}>{r.cur}</Text>
                            <Text style={[s.logCellNum, { color: colors.textSecondary }]}>{prevSummary ? r.prev : '—'}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky Footer */}
      {summary && (
        <BlurView intensity={30} tint={colors.blurTint} style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={s.primaryBtn} onPress={handleAskAi} activeOpacity={0.85}>
            <MessageCircle size={16} color="#fff" />
            <Text style={s.primaryBtnText}>Chat with AI</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={handleExportPdf} disabled={pdfLoading} activeOpacity={0.7}>
            {pdfLoading
              ? <ActivityIndicator size="small" color={colors.orange} />
              : (<><Share2 size={16} color={colors.orange} /><Text style={s.secondaryBtnText}>Export PDF</Text></>)}
          </TouchableOpacity>
        </BlurView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingBottom: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.4 },
  headerSub: { fontSize: 14, color: c.textSecondary, marginTop: 1, fontFamily: FF },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: c.textPrimary, fontFamily: FF, marginBottom: 8 },
  emptyBody: { fontSize: 15, color: c.textSecondary, fontFamily: FF, textAlign: 'center', lineHeight: 21 },

  // Solid white card (no blur) — the clean Apple-Health surface.
  card: {
    borderRadius: 22,
    backgroundColor: c.surfaceElevated,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    ...cardElevation(c.isDark),
  },
  cardPad: { padding: 18 },
  subNote: { fontSize: 14, color: c.textSecondary, fontFamily: FF },
  mutedBody: { fontSize: 15, color: c.textSecondary, fontFamily: FF },

  divider: {
    height: StyleSheet.hairlineWidth, marginVertical: 18,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  },

  // Side-effect symptom log table
  logHeader: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: c.textMuted, fontFamily: FF, marginBottom: 8 },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  logCellLabel: { flex: 1, fontSize: 14.5, color: c.textPrimary, fontFamily: FF },
  logCellNum: { width: 64, textAlign: 'right', fontSize: 14.5, fontWeight: '700', color: c.textPrimary, fontFamily: FF },

  // Weight hero
  hero: { padding: 22, alignItems: 'center', overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 999, top: -70 },
  heroEyebrow: { fontSize: 12, fontWeight: '800', color: c.textMuted, letterSpacing: 1.5, fontFamily: FF, marginBottom: 8 },
  heroValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroValue: { fontSize: 46, fontWeight: '800', fontFamily: FF, letterSpacing: -1 },
  heroUnit: { fontSize: 20, fontWeight: '700', fontFamily: FF, marginBottom: 6 },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  heroDescriptor: { fontSize: 14, fontWeight: '600', color: c.textSecondary, fontFamily: FF },
  heroRange: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  heroRangeText: { fontSize: 15, fontWeight: '700', color: c.textPrimary, fontFamily: FF },

  // AI
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiLabel: { fontSize: 12, fontWeight: '800', color: c.orange, letterSpacing: 1.2, fontFamily: FF },
  aiText: { fontSize: 16, color: c.textPrimary, lineHeight: 22, fontFamily: FF },
  askAiBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, alignSelf: 'flex-start' },
  askAiBtnText: { fontSize: 15, color: c.orange, fontWeight: '700', fontFamily: FF },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
  },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: c.orange, height: 50, borderRadius: 999,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, fontFamily: FF },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: c.orange, height: 50, borderRadius: 999,
  },
  secondaryBtnText: { color: c.orange, fontWeight: '700', fontSize: 16, fontFamily: FF },
});
