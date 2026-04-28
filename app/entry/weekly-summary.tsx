import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
// expo-print requires a dev build; guard so Expo Go doesn't crash.
let Print: typeof import('expo-print') | undefined;
try { Print = require('expo-print'); } catch {}
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import { useHealthData } from '@/contexts/health-data';
import { useProfile } from '@/contexts/profile-context';
import type { AppColors } from '@/constants/theme';
import { computeWeeklySummary, type WeeklySummaryData } from '@/lib/weekly-summary';
import { generateForecastStrip, generateIntradayForecast } from '@/lib/cycle-intelligence';
import { getScheduleMode } from '@/constants/scoring';
import { generateWeeklyInsight } from '@/lib/openai';
import { useLogStore } from '@/stores/log-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useUiStore } from '@/stores/ui-store';

const ORANGE = '#FF742A';
const GREEN  = '#27AE60';
const RED    = '#E53E3E';
const FF     = 'System';

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

function progressPct(actual: number | null, target: number): number {
  if (actual == null || target <= 0) return 0;
  return Math.min(1, actual / target);
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

function scoreColor(score: number): string {
  if (score >= 70) return '#27AE60';
  if (score >= 50) return '#F6CB45';
  if (score >= 30) return '#E8960C';
  return '#E53E3E';
}

// ─── PDF Builder ──────────────────────────────────────────────────────────────

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
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; }
  .green { background: #e8f8ef; color: #27AE60; }
  .red   { background: #fdeaea; color: #E53E3E; }
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

function SectionCard({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: AppColors;
}) {
  return (
    <View style={[cardStyles(colors).card]}>
      <Text style={cardStyles(colors).title}>{title}</Text>
      {children}
    </View>
  );
}

function ProgressRow({
  label,
  value,
  target,
  unit = '',
  colors,
}: {
  label: string;
  value: number | null;
  target: number;
  unit?: string;
  colors: AppColors;
}) {
  const pct = progressPct(value, target);
  const s = cardStyles(colors);
  return (
    <View style={s.row}>
      <View style={s.rowHeader}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue}>
          {value != null ? `${value}${unit}` : '—'}
          <Text style={s.rowTarget}> / {target}{unit}</Text>
        </Text>
      </View>
      <View style={s.barBg}>
        <View style={[s.barFill, { width: `${Math.round(pct * 100)}%` }]} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklySummaryScreen() {
  const { colors, isDark } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { targets } = useHealthData();
  const { foodLogs, weightLogs, activityLogs, sideEffectLogs, weeklyCheckins, foodNoiseLogs, injectionLogs } = useLogStore();
  const { setLastWeeklySummaryDate } = usePreferencesStore();
  const { openAiChat } = useUiStore();

  const [summary, setSummary] = useState<WeeklySummaryData | null>(null);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const computedRef = useRef(false);

  // Guard: profile required for AI insight + PDF export. Show loading until ready.
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  const pkComparisonData = useMemo(() => {
    const lastInjection = injectionLogs[0]?.injection_date ?? null;
    const reportedScore = summary?.checkins.appetite ?? null;
    if (reportedScore == null || !profile) return null;

    const injFreqDays = profile.injectionFrequencyDays ?? 7;
    const scheduleMode = getScheduleMode(injFreqDays);

    // Adherence streak: count injection logs in the past 7 days
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const dosesTaken = injectionLogs.filter(log => {
      const logMs = new Date(log.injection_date + 'T00:00:00').getTime();
      return logMs >= sevenDaysAgo;
    }).length;
    const adherenceStreak = scheduleMode === 'intraday' ? Math.min(dosesTaken, 7) : null;

    if (scheduleMode === 'intraday') {
      // Daily drugs: use intraday forecast averaged over all 6 hour-blocks
      const doseTime = (profile as any).doseTime ?? '08:00';
      const blocks = generateIntradayForecast(
        profile.glp1Type,
        profile.glp1Status === 'active',
        doseTime,
        profile.doseMg ?? null,
      );
      if (blocks.length === 0) return null;
      const avgSuppression = blocks.reduce((s, b) => s + b.appetiteSuppressionPct, 0) / blocks.length;
      const predictedScore = Math.min(100, Math.round((avgSuppression / 65) * 100));
      const delta = reportedScore - predictedScore;
      const deltaLabel =
        Math.abs(delta) <= 10 ? 'Control matched expectations'
        : delta > 10           ? 'Higher than predicted'
        :                        'Lower than predicted';
      return { predictedScore, reportedScore, deltaLabel, adherenceStreak, isIntraday: true };
    }

    // Cycle-day mode (weekly / bi-weekly)
    if (!lastInjection) return null;
    const strip = generateForecastStrip(
      lastInjection,
      injFreqDays,
      profile.glp1Type,
      profile.glp1Status === 'active',
      profile.doseMg ?? null,
    );
    if (strip.length === 0) return null;

    const avgSuppression = strip.reduce((s, d) => s + d.appetiteSuppressionPct, 0) / strip.length;
    // Map to 0–100 using 65 as universal denominator; cap at 100 (tirzepatide ceiling is 72)
    const predictedScore = Math.min(100, Math.round((avgSuppression / 65) * 100));

    const delta = reportedScore - predictedScore;
    const deltaLabel =
      Math.abs(delta) <= 10 ? 'Control matched expectations'
      : delta > 10           ? 'Higher than predicted'
      :                        'Lower than predicted';

    return { predictedScore, reportedScore, deltaLabel, adherenceStreak: null, isIntraday: false };
  }, [injectionLogs, summary?.checkins.appetite, profile]);

  // Mark summary as shown immediately on mount — prevents re-triggering gate
  useEffect(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setLastWeeklySummaryDate(today);
  }, []);

  // Compute summary once
  useEffect(() => {
    if (computedRef.current) return;
    computedRef.current = true;

    async function load() {
      // Read 7 water keys from AsyncStorage
      const waterByDate: Record<string, number> = {};
      const today = new Date();
      for (let i = 1; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, '0'), dy = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${mo}-${dy}`;
        const val = await AsyncStorage.getItem(`@titrahealth_water_${dateStr}`);
        if (val) waterByDate[dateStr] = parseFloat(val);
      }

      const computed = computeWeeklySummary(
        { foodLogs, weightLogs, activityLogs, sideEffectLogs, weeklyCheckins, foodNoiseLogs },
        targets,
        waterByDate,
      );
      setSummary(computed);

      // Load AI insight
      if (profile) {
        try {
          const insight = await generateWeeklyInsight(computed, profile);
          setAiInsight(insight);
        } catch {
          setAiInsight('');
        }
      }
      setAiLoading(false);
    }

    load();
  }, []);

  const handleClose = () => router.replace('/(tabs)');

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

  // Day of week labels (Mon–Sun) for the 7-day activity row
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Weekly Summary</Text>
          {dateRange ? <Text style={s.headerSub}>{dateRange}</Text> : null}
        </View>
        <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Insight Card */}
        <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={s.aiCard}>
          <View style={s.aiCardInner}>
            <View style={s.aiOrangeBorder} />
            <View style={s.aiContent}>
              <Text style={s.aiLabel}>AI Insight</Text>
              {aiLoading ? (
                <View style={s.shimmerRow}>
                  <ActivityIndicator size="small" color={ORANGE} />
                  <Text style={s.shimmerText}>Analyzing your week…</Text>
                </View>
              ) : (
                <Text style={s.aiText}>{aiInsight || 'Tap "Chat with AI" for a personalized recap.'}</Text>
              )}
              <TouchableOpacity style={s.askAiBtn} onPress={handleAskAi}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={ORANGE} />
                <Text style={s.askAiBtnText}>Ask AI</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>

        {summary && (
          <>
            {/* Weight */}
            <SectionCard title="Weight" colors={colors}>
              {summary.weight.start == null && summary.weight.end == null ? (
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>No weight logs this week</Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', fontFamily: FF }}>
                    {summary.weight.start?.toFixed(1) ?? '—'}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', fontFamily: FF }}>
                    {summary.weight.end?.toFixed(1) ?? '—'} lbs
                  </Text>
                  {summary.weight.delta != null && (
                    <View style={[s.deltaBadge, { backgroundColor: summary.weight.delta <= 0 ? '#e8f8ef' : '#fdeaea' }]}>
                      <Ionicons
                        name={summary.weight.delta <= 0 ? 'trending-down' : 'trending-up'}
                        size={12}
                        color={summary.weight.delta <= 0 ? GREEN : RED}
                      />
                      <Text style={[s.deltaBadgeText, { color: summary.weight.delta <= 0 ? GREEN : RED }]}>
                        {summary.weight.delta > 0 ? '+' : ''}{summary.weight.delta.toFixed(1)} lbs
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </SectionCard>

            {/* Nutrition */}
            <SectionCard title="Nutrition" colors={colors}>
              <Text style={[s.subNote, { marginBottom: 12 }]}>
                {summary.nutrition.daysLogged} of 7 days logged
              </Text>
              <ProgressRow
                label="Calories"
                value={summary.nutrition.avgCalories}
                target={summary.nutrition.caloriesTarget}
                colors={colors}
              />
              <ProgressRow
                label="Protein"
                value={summary.nutrition.avgProteinG}
                target={summary.nutrition.proteinTarget}
                unit="g"
                colors={colors}
              />
              <ProgressRow
                label="Fiber"
                value={summary.nutrition.avgFiberG}
                target={summary.nutrition.fiberTarget}
                unit="g"
                colors={colors}
              />
              <ProgressRow
                label="Water"
                value={summary.nutrition.avgWaterMl != null ? mlToOz(summary.nutrition.avgWaterMl) : null}
                target={mlToOz(summary.nutrition.waterTarget)}
                unit=" oz"
                colors={colors}
              />
            </SectionCard>

            {/* Activity */}
            <SectionCard title="Activity" colors={colors}>
              <View style={s.actRow}>
                <Text style={s.actSteps}>
                  {summary.activity.avgSteps?.toLocaleString() ?? '—'}
                </Text>
                <Text style={s.actTarget}>
                  / {summary.activity.stepsTarget.toLocaleString()} avg steps
                </Text>
              </View>
              <View style={s.dayDots}>
                {summary.activity.dayFlags.map((active, i) => (
                  <View key={i} style={s.dayDotCol}>
                    <View style={[s.dayDot, active && s.dayDotActive]} />
                    <Text style={s.dayDotLabel}>{DAY_LABELS[i]}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.subNote}>{summary.activity.activeDays} of 7 days active</Text>
            </SectionCard>

            {/* Check-In Scores */}
            <SectionCard title="Check-In Scores" colors={colors}>
              {Object.entries(summary.checkins).every(([, v]) => v == null) ? (
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>No check-ins completed this week</Text>
              ) : (
                <View style={s.checkinGrid}>
                  {Object.entries(summary.checkins)
                    .filter(([, v]) => v != null)
                    .map(([key, score]) => (
                      <View key={key} style={[s.checkinPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                        <Text style={s.checkinPillLabel}>{CHECKIN_LABELS[key] ?? key}</Text>
                        <View style={[s.checkinScore, { backgroundColor: scoreColor(score!) + '22' }]}>
                          <Text style={[s.checkinScoreText, { color: scoreColor(score!) }]}>{score}</Text>
                        </View>
                      </View>
                    ))
                  }
                </View>
              )}
              {pkComparisonData && (
                <View style={s.pkCompareBlock}>
                  <View style={s.pkCompareRow}>
                    <Text style={s.pkCompareLabel}>
                      {pkComparisonData.isIntraday ? 'Daily medication effect (avg)' : 'PK model prediction'}
                    </Text>
                    <View style={[s.checkinScore, { backgroundColor: scoreColor(pkComparisonData.predictedScore) + '22' }]}>
                      <Text style={[s.checkinScoreText, { color: scoreColor(pkComparisonData.predictedScore) }]}>
                        {pkComparisonData.predictedScore}
                      </Text>
                    </View>
                  </View>
                  <View style={s.pkCompareRow}>
                    <Text style={s.pkCompareLabel}>Reported appetite control</Text>
                    <View style={[s.checkinScore, { backgroundColor: scoreColor(pkComparisonData.reportedScore) + '22' }]}>
                      <Text style={[s.checkinScoreText, { color: scoreColor(pkComparisonData.reportedScore) }]}>
                        {pkComparisonData.reportedScore}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.pkDeltaLabel}>{pkComparisonData.deltaLabel}</Text>
                  {pkComparisonData.adherenceStreak != null && (
                    <Text style={[s.pkDeltaLabel, { marginTop: 4, fontStyle: 'normal', color: pkComparisonData.adherenceStreak >= 6 ? GREEN : ORANGE }]}>
                      {`Dose taken ${pkComparisonData.adherenceStreak} of 7 days this week`}
                    </Text>
                  )}
                </View>
              )}
            </SectionCard>

            {/* Side Effects */}
            <SectionCard title="Side Effects" colors={colors}>
              {summary.sideEffects.totalCount === 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>None logged this week</Text>
              ) : (
                <View>
                  <Text style={[s.actSteps, { marginBottom: 10 }]}>
                    {summary.sideEffects.totalCount}
                    <Text style={{ color: colors.textSecondary, fontSize: 17, fontWeight: '400' }}> logged</Text>
                  </Text>
                  <View style={s.seChips}>
                    {summary.sideEffects.topTypes.map(t => (
                      <View key={t} style={s.seChip}>
                        <Text style={s.seChipText}>{capitalize(t)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </SectionCard>
          </>
        )}

      </ScrollView>

      {/* Sticky Footer */}
      <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={s.primaryBtn} onPress={handleAskAi}>
          <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
          <Text style={s.primaryBtnText}>Chat with AI</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondaryBtn} onPress={handleExportPdf} disabled={pdfLoading}>
          {pdfLoading
            ? <ActivityIndicator size="small" color={ORANGE} />
            : <>
                <Ionicons name="share-outline" size={16} color={ORANGE} />
                <Text style={s.secondaryBtnText}>Export PDF</Text>
              </>
          }
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function cardStyles(c: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 12,
      fontFamily: FF,
    },
    row: { marginBottom: 12 },
    rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    rowLabel: { fontSize: 16, color: c.textPrimary, fontFamily: FF },
    rowValue: { fontSize: 16, fontWeight: '600', color: c.textPrimary, fontFamily: FF },
    rowTarget: { fontSize: 15, fontWeight: '400', color: c.textSecondary },
    barBg: {
      height: 5,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      borderRadius: 4,
      overflow: 'hidden',
    },
    barFill: { height: 5, backgroundColor: ORANGE, borderRadius: 4 },
  });
}

const createStyles = (c: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: c.textPrimary,
    fontFamily: 'System',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 15,
    color: c.textSecondary,
    marginTop: 2,
    fontFamily: FF,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  // AI Card
  aiCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  aiCardInner: { flexDirection: 'row' },
  aiOrangeBorder: { width: 4, backgroundColor: ORANGE },
  aiContent: { flex: 1, padding: 14 },
  aiLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: ORANGE,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    fontFamily: FF,
  },
  aiText: {
    fontSize: 16,
    color: c.textPrimary,
    lineHeight: 20,
    fontFamily: FF,
  },
  shimmerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shimmerText: { fontSize: 16, color: c.textSecondary, fontFamily: FF },
  askAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  askAiBtnText: { fontSize: 15, color: ORANGE, fontWeight: '600', fontFamily: FF },

  // Weight
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  deltaBadgeText: { fontSize: 14, fontWeight: '700', fontFamily: FF },

  // Activity
  actRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 12 },
  actSteps: { fontSize: 28, fontWeight: '800', color: c.textPrimary, fontFamily: FF },
  actTarget: { fontSize: 16, color: c.textSecondary, fontFamily: FF },
  dayDots: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dayDotCol: { alignItems: 'center', gap: 4 },
  dayDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
  },
  dayDotActive: { backgroundColor: ORANGE },
  dayDotLabel: { fontSize: 12, color: c.textSecondary, fontFamily: FF },
  subNote: { fontSize: 14, color: c.textSecondary, fontFamily: FF },

  // Check-ins
  checkinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  checkinPillLabel: { fontSize: 15, color: c.textPrimary, fontFamily: FF },
  checkinScore: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  checkinScoreText: { fontSize: 14, fontWeight: '700', fontFamily: FF },

  // PK comparison
  pkCompareBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
    gap: 6,
  },
  pkCompareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pkCompareLabel: {
    fontSize: 15,
    color: c.textSecondary,
    fontFamily: FF,
  },
  pkDeltaLabel: {
    fontSize: 13,
    color: c.textSecondary,
    fontFamily: FF,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Side effects
  seChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  seChip: {
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  seChipText: { fontSize: 15, color: c.textPrimary, fontFamily: FF },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ORANGE,
    height: 46,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 17, fontFamily: FF },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: ORANGE,
    height: 46,
    borderRadius: 12,
  },
  secondaryBtnText: { color: ORANGE, fontWeight: '700', fontSize: 17, fontFamily: FF },
});
