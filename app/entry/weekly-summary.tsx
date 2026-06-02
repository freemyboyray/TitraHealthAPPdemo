import { BlurView } from 'expo-blur';
// expo-print requires a dev build; guard so Expo Go doesn't crash.
let Print: typeof import('expo-print') | undefined;
try { Print = require('expo-print'); } catch {}
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
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
import { useProfile } from '@/contexts/profile-context';
import type { AppColors } from '@/constants/theme';
import { type WeeklySummaryData } from '@/lib/weekly-summary';
import { useLogStore } from '@/stores/log-store';
import { useUiStore } from '@/stores/ui-store';
import { ArrowRight, BarChart3, MessageCircle, Share2, TrendingDown, TrendingUp, X } from 'lucide-react-native';

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
  const { weeklySummaries } = useLogStore();
  const { openAiChat } = useUiStore();

  // Viewer only: snapshots are generated in the background (hooks/use-weekly-summary-gen)
  // and frozen per program week. Open by snapshot_id, or default to the latest.
  const { snapshot_id } = useLocalSearchParams<{ snapshot_id?: string }>();
  const snapshot = useMemo(
    () => snapshot_id
      ? weeklySummaries.find(s => s.id === snapshot_id) ?? null
      : weeklySummaries[0] ?? null,
    [snapshot_id, weeklySummaries],
  );

  const summary: WeeklySummaryData | null = snapshot
    ? (snapshot.summary_data as unknown as WeeklySummaryData)
    : null;
  const aiInsight = snapshot?.ai_insight ?? '';

  const [pdfLoading, setPdfLoading] = useState(false);

  // Guard: profile required for PDF export. Show loading until ready.
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.orange} />
      </View>
    );
  }

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
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Not-ready state — no snapshot for this week yet */}
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

        {/* AI Insight Card */}
        {summary && (
          <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={s.aiCard}>
            <View style={s.aiCardInner}>
              <View style={s.aiOrangeBorder} />
              <View style={s.aiContent}>
                <Text style={s.aiLabel}>AI Insight</Text>
                <Text style={s.aiText}>{aiInsight || 'Tap "Chat with AI" for a personalized recap.'}</Text>
                <TouchableOpacity style={s.askAiBtn} onPress={handleAskAi}>
                  <MessageCircle size={14} color={colors.orange} />
                  <Text style={s.askAiBtnText}>Ask AI</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        )}

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
                  <ArrowRight size={16} color={colors.textSecondary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', fontFamily: FF }}>
                    {summary.weight.end?.toFixed(1) ?? '—'} lbs
                  </Text>
                  {summary.weight.delta != null && (
                    <View style={[s.deltaBadge, { backgroundColor: summary.weight.delta <= 0 ? '#e8f8ef' : '#fdeaea' }]}>
                      {summary.weight.delta <= 0 ? <TrendingDown
                        size={12}
                        color={summary.weight.delta <= 0 ? GREEN : RED}
                      /> : <TrendingUp
                        size={12}
                        color={summary.weight.delta <= 0 ? GREEN : RED}
                      />}
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

      {/* Sticky Footer — only when a summary is loaded */}
      {summary && (
        <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={s.primaryBtn} onPress={handleAskAi}>
            <MessageCircle size={16} color="#fff" />
            <Text style={s.primaryBtnText}>Chat with AI</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={handleExportPdf} disabled={pdfLoading}>
            {pdfLoading
              ? <ActivityIndicator size="small" color={colors.orange} />
              : <>
                  <Share2 size={16} color={colors.orange} />
                  <Text style={s.secondaryBtnText}>Export PDF</Text>
                </>
            }
          </TouchableOpacity>
        </BlurView>
      )}
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
    barFill: { height: 5, backgroundColor: c.orange, borderRadius: 4 },
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

  // Not-ready empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: c.textPrimary,
    fontFamily: FF,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 15,
    color: c.textSecondary,
    fontFamily: FF,
    textAlign: 'center',
    lineHeight: 21,
  },

  // AI Card
  aiCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  aiCardInner: { flexDirection: 'row' },
  aiOrangeBorder: { width: 4, backgroundColor: c.orange },
  aiContent: { flex: 1, padding: 14 },
  aiLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: c.orange,
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
  askAiBtnText: { fontSize: 15, color: c.orange, fontWeight: '600', fontFamily: FF },

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
  dayDotActive: { backgroundColor: c.orange },
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
    backgroundColor: c.orange,
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
    borderColor: c.orange,
    height: 46,
    borderRadius: 12,
  },
  secondaryBtnText: { color: c.orange, fontWeight: '700', fontSize: 17, fontFamily: FF },
});
