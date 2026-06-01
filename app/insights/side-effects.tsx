import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { useLogStore } from '@/stores/log-store';
import {
  computeCoOccurrence,
  computeCyclePositions,
  computeSymptomTrends,
  detectRecentSpike,
  type CyclePoint,
  type SymptomTrend,
  type CoOccurrencePair,
  type SpikeAlert,
} from '@/lib/side-effect-insights';
import type { AppColors } from '@/constants/theme';
import { smoothPath } from '@/lib/chart-utils';
import { isOralDrug, doseNoun, hasMeaningfulCycle } from '@/constants/drug-pk';
import { ChevronLeft, TriangleAlert } from 'lucide-react-native';
import { LucideIconByName } from '@/lib/lucide-icon-map';

const FF = 'System';

// ─── Effect label / icon registry ────────────────────────────────────────────

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

function EffectIcon({ type, size = 20, color }: { type: string; size?: number; color: string }) {
  const iconName = EFFECT_ICONS[type] ?? 'TriangleAlert';
  return <LucideIconByName name={iconName} size={size} color={color} />;
}

function severityTrendColor(avg: number): string {
  if (avg <= 3) return '#27AE60';
  if (avg <= 6) return '#F6CB45';
  return '#E74C3C';
}

// ─── Severity zones (semantic background bands for the cycle chart) ─────────

const SEV_MILD = '#27AE60';
const SEV_MOD  = '#F6CB45';
const SEV_SEV  = '#E74C3C';

const SEVERITY_ZONES = [
  { min: 0,  max: 3,  color: SEV_MILD, label: 'Mild' },
  { min: 3,  max: 6,  color: SEV_MOD,  label: 'Moderate' },
  { min: 6,  max: 10, color: SEV_SEV,  label: 'Severe' },
];

// ─── Co-occurrence interpretations ──────────────────────────────────────────

const PAIR_NOTES: Record<string, string> = {
  'fatigue::nausea':           'Often a dehydration signal',
  'headache::nausea':          'Often a dehydration signal',
  'fatigue::headache':         'Often a dehydration signal',
  'bloating::constipation':    'Reduced GI motility cluster',
  'constipation::nausea':      'Slowed digestion cluster',
  'appetite_loss::fatigue':    'Low intake may be a factor',
  'appetite_loss::nausea':     'GI suppression cluster',
  'food_noise::appetite_loss': 'Strong appetite-suppression response',
};

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

function pairNote(a: string, b: string): string | null {
  return PAIR_NOTES[pairKey(a, b)] ?? null;
}

// ─── Cycle helpers ──────────────────────────────────────────────────────────

const SYMPTOM_PALETTE = ['#FF742A', '#5B8BF5', '#C084FC'];
const OTHER_COLOR = '#9A9490';

function buildSymptomColorMap(points: CyclePoint[]): {
  map: Map<string, string>;
  ranked: { type: string; color: string; count: number; avgDay: number }[];
} {
  const grouped = new Map<string, { count: number; sumDay: number }>();
  for (const p of points) {
    const prev = grouped.get(p.type) ?? { count: 0, sumDay: 0 };
    prev.count += 1;
    prev.sumDay += p.dayInCycle;
    grouped.set(p.type, prev);
  }
  const ordered = [...grouped.entries()]
    .map(([type, d]) => ({ type, count: d.count, avgDay: d.sumDay / d.count }))
    .sort((a, b) => b.count - a.count);

  const map = new Map<string, string>();
  const ranked: { type: string; color: string; count: number; avgDay: number }[] = [];
  ordered.forEach((s, i) => {
    const color = i < SYMPTOM_PALETTE.length ? SYMPTOM_PALETTE[i] : OTHER_COLOR;
    map.set(s.type, color);
    if (i < SYMPTOM_PALETTE.length) ranked.push({ ...s, color });
  });
  return { map, ranked };
}

type Tick = { pos: number; label: string };

function buildCycleTicks(freqDays: number): Tick[] {
  // First tick (Day 0) intentionally omitted — the syringe glyph anchors it.
  if (freqDays <= 1) {
    return [
      { pos: 0.25, label: '+6h' },
      { pos: 0.5,  label: '+12h' },
      { pos: 0.75, label: '+18h' },
      { pos: 1,    label: 'Next' },
    ];
  }
  if (freqDays === 7) {
    return [
      { pos: 2, label: 'D2' },
      { pos: 4, label: 'D4' },
      { pos: 6, label: 'D6' },
      { pos: 7, label: 'Next' },
    ];
  }
  if (freqDays === 14) {
    return [
      { pos: 4,  label: 'D4' },
      { pos: 7,  label: 'D7' },
      { pos: 10, label: 'D10' },
      { pos: 14, label: 'Next' },
    ];
  }
  const q = (frac: number) => Math.round(freqDays * frac);
  return [
    { pos: freqDays * 0.25, label: `D${q(0.25)}` },
    { pos: freqDays * 0.5,  label: `D${q(0.5)}` },
    { pos: freqDays * 0.75, label: `D${q(0.75)}` },
    { pos: freqDays,        label: 'Next' },
  ];
}

function formatChipPosition(avgDay: number, freqDays: number, oral: boolean): string {
  if (freqDays <= 1) {
    const hours = avgDay * 24;
    return `~${hours.toFixed(0)}h after ${oral ? 'dose' : 'inject'}`;
  }
  return `~Day ${avgDay.toFixed(1)}`;
}

/** Median (50th percentile) of dayInCycle. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

type PeakWindow = { startDay: number; endDay: number; centerDay: number };

/**
 * IQR-based peak window with a sensible floor on width — for sparse data,
 * the 25–75 range can collapse to a point, so we expand by 10% of cycle.
 */
function computePeakWindow(points: CyclePoint[], freqDays: number): PeakWindow | null {
  if (points.length < 2) return null;
  const days = points.map(p => p.dayInCycle);
  const p25 = percentile(days, 25);
  const p75 = percentile(days, 75);
  const center = median(days);
  const minWidth = freqDays * 0.2;
  const observed = p75 - p25;
  if (observed >= minWidth) {
    return { startDay: p25, endDay: p75, centerDay: center };
  }
  const pad = minWidth / 2;
  return {
    startDay: Math.max(0, center - pad),
    endDay: Math.min(freqDays, center + pad),
    centerDay: center,
  };
}

function formatDayLabel(day: number, freqDays: number, oral: boolean): string {
  if (freqDays <= 1) {
    const hours = day * 24;
    return `${hours.toFixed(0)}h after ${oral ? 'dose' : 'injection'}`;
  }
  return `Day ${day.toFixed(1)}`;
}

function buildCycleHeadline(
  points: CyclePoint[],
  peak: PeakWindow | null,
  freqDays: number,
  oral: boolean,
  hasInjections: boolean,
): string {
  if (!hasInjections) return `Log ${oral ? 'a dose' : 'an injection'} to map symptoms to your cycle.`;
  if (points.length === 0) return `No symptoms logged after ${oral ? 'a dose' : 'an injection'} yet.`;
  if (!peak) return `Log a few more symptoms to see your cycle pattern.`;
  // Tight (< 0.5 cycle days) → single point; wider → range
  const width = peak.endDay - peak.startDay;
  if (freqDays <= 1) {
    const startH = peak.startDay * 24;
    const endH = peak.endDay * 24;
    if (width * 24 < 1.5) return `Most symptoms hit ~${Math.round((startH + endH) / 2)}h after your ${oral ? 'dose' : 'injection'}.`;
    return `Most symptoms hit ${Math.round(startH)}–${Math.round(endH)}h after your ${oral ? 'dose' : 'injection'}.`;
  }
  if (width < 0.5) return `Most symptoms hit around ${formatDayLabel(peak.centerDay, freqDays, oral)} of your cycle.`;
  return `Most symptoms hit Day ${peak.startDay.toFixed(1)}–${peak.endDay.toFixed(1)} of your cycle.`;
}

function buildTrendsHeadline(trends: SymptomTrend[]): string {
  if (trends.length === 0) return 'No symptoms logged in the last 30 days.';
  const improving = trends.filter(t => t.trend === 'improving');
  const worsening = trends.filter(t => t.trend === 'worsening');
  if (improving.length > 0 && worsening.length === 0) {
    if (improving.length === trends.length) return `All ${trends.length} symptoms are improving.`;
    const best = improving.sort((a, b) => a.trendDeltaPct - b.trendDeltaPct)[0];
    return `${EFFECT_LABELS[best.type] ?? best.type} is improving fastest, down ${Math.abs(best.trendDeltaPct)}%.`;
  }
  if (worsening.length > 0 && improving.length === 0) {
    const worst = worsening.sort((a, b) => b.trendDeltaPct - a.trendDeltaPct)[0];
    return `${EFFECT_LABELS[worst.type] ?? worst.type} is trending up ${Math.abs(worst.trendDeltaPct)}% — worth watching.`;
  }
  if (improving.length > 0 && worsening.length > 0) {
    return `${improving.length} symptom${improving.length === 1 ? '' : 's'} improving, ${worsening.length} worsening.`;
  }
  return `Severity is steady across ${trends.length} symptom${trends.length === 1 ? '' : 's'}.`;
}

function buildClustersHeadline(pairs: CoOccurrencePair[], totalLogs: number): string {
  if (pairs.length === 0) {
    return totalLogs < 4
      ? 'Patterns emerge with more variety in logs.'
      : 'No repeated pairs — symptoms appear independently.';
  }
  const top = pairs[0];
  const a = EFFECT_LABELS[top.a] ?? top.a;
  const b = EFFECT_LABELS[top.b] ?? top.b;
  return `${a} and ${b} most often appear together.`;
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function SideEffectsInsightsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile } = useProfile();
  const s = useMemo(() => createStyles(colors), [colors]);

  const sideEffectLogs = useLogStore(st => st.sideEffectLogs);
  const injectionLogs = useLogStore(st => st.injectionLogs);

  const freqDays = profile?.injectionFrequencyDays ?? 7;
  const oral = isOralDrug(profile?.glp1Type);
  const meaningfulCycle = hasMeaningfulCycle(profile?.glp1Type, freqDays);

  const cyclePoints = useMemo(
    () => computeCyclePositions(sideEffectLogs, injectionLogs, freqDays),
    [sideEffectLogs, injectionLogs, freqDays],
  );
  const trends = useMemo(() => computeSymptomTrends(sideEffectLogs), [sideEffectLogs]);
  const pairs = useMemo(() => computeCoOccurrence(sideEffectLogs), [sideEffectLogs]);
  const spike = useMemo(() => detectRecentSpike(sideEffectLogs), [sideEffectLogs]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Side Effect Insights</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {spike && <SpikeCard spike={spike} colors={colors} />}

        <CyclePatternCard
          points={cyclePoints}
          freqDays={freqDays}
          oral={oral}
          colors={colors}
          hasInjections={injectionLogs.length > 0}
          meaningfulCycle={meaningfulCycle}
        />

        <SymptomTrendsCard trends={trends} colors={colors} />

        <CoOccurrenceCard pairs={pairs} colors={colors} totalLogs={sideEffectLogs.length} />

        <Text style={s.footnote}>
          Based on the last 30 days of logs. Patterns sharpen as you log more.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Spike alert ────────────────────────────────────────────────────────────

function SpikeCard({ spike, colors }: { spike: SpikeAlert; colors: AppColors }) {
  const s = useMemo(() => createStyles(colors), [colors]);
  const label = EFFECT_LABELS[spike.type] ?? spike.type;
  return (
    <View style={s.alertCard}>
      <View style={s.alertIconWrap}>
        <TriangleAlert size={18} color="#E74C3C" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.alertTitle}>{label} spike — {spike.recentSev}/10, +{spike.deltaPct}% vs usual</Text>
        <Text style={s.alertBody}>
          Common triggers: high-fat meal, missed hydration, recent dose change.
        </Text>
      </View>
    </View>
  );
}

// ─── Cycle pattern ──────────────────────────────────────────────────────────

const CHART_H = 200;
const CHART_PAD_L = 16;
const CHART_PAD_R = 56;  // room for right-side zone labels
const CHART_PAD_T = 26;
const CHART_PAD_B = 28;
const DOT_R = 5;

function CyclePatternCard({
  points, freqDays, oral, colors, hasInjections, meaningfulCycle,
}: {
  points: CyclePoint[]; freqDays: number; oral: boolean; colors: AppColors; hasInjections: boolean; meaningfulCycle: boolean;
}) {
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const [chartW, setChartW] = React.useState(0);

  // Long-half-life daily orals stay near-flat across the day, so an intraday
  // scatter is misleading — symptoms track dose level, not time of day.
  if (!meaningfulCycle) {
    return (
      <View style={s.card}>
        <Text style={s.cardHeadline}>Your dose stays steady all day.</Text>
        <Text style={s.cardSub}>Cycle pattern</Text>
        <View style={s.placeholder}>
          <Text style={[s.placeholderText, { color: w(0.55) }]}>
            With a daily dose this long-lasting, your drug level barely changes hour to
            hour — so symptoms track your dose level and how long you&apos;ve been
            adjusting to it, not the time since your last pill. See the trend below.
          </Text>
        </View>
      </View>
    );
  }

  const hasData = points.length >= 2;
  const progress = Math.min(1, points.length / 2);

  const plotW = Math.max(0, chartW - CHART_PAD_L - CHART_PAD_R);
  const plotH = CHART_H - CHART_PAD_T - CHART_PAD_B;
  const toX = (day: number) => CHART_PAD_L + (day / freqDays) * plotW;
  const toY = (sev: number) => CHART_PAD_T + (1 - sev / 10) * plotH;

  const xTicks = useMemo(() => buildCycleTicks(freqDays), [freqDays]);
  const { map: colorMap, ranked } = useMemo(() => buildSymptomColorMap(points), [points]);
  const peak = useMemo(() => computePeakWindow(points, freqDays), [points, freqDays]);
  const headline = buildCycleHeadline(points, peak, freqDays, oral, hasInjections);

  // Sort chips left→right by avgDay so they read as a timeline
  const sortedChips = useMemo(() => [...ranked].sort((a, b) => a.avgDay - b.avgDay), [ranked]);
  const othersCount = points.length - ranked.reduce((sum, r) => sum + r.count, 0);
  const doseIcon = oral ? 'Pill' : 'Syringe';

  return (
    <View style={s.card}>
      <Text style={s.cardHeadline}>{headline}</Text>
      <Text style={s.cardSub}>Cycle pattern</Text>

      {!hasInjections ? null : !hasData ? (
        <View style={s.placeholder}>
          <Text style={[s.placeholderText, { color: w(0.55) }]}>
            Log {2 - points.length} more {points.length === 1 ? 'symptom' : 'symptoms'} after {oral ? 'a dose' : 'an injection'} to see your cycle pattern.
          </Text>
          <ProgressBar value={progress} colors={colors} />
        </View>
      ) : (
        <View
          onLayout={e => setChartW(e.nativeEvent.layout.width)}
          style={{ marginTop: 14, position: 'relative' }}
        >
          {chartW > 0 && (
            <>
              <Svg width={chartW} height={CHART_H}>
                {/* Severity zones (subtle background fills) */}
                {SEVERITY_ZONES.map(zone => {
                  const y1 = toY(zone.max);
                  const y2 = toY(zone.min);
                  return (
                    <Rect
                      key={zone.label}
                      x={CHART_PAD_L}
                      y={y1}
                      width={plotW}
                      height={y2 - y1}
                      fill={zone.color}
                      opacity={0.05}
                    />
                  );
                })}
                {/* Hairline dividers between zones */}
                {[3, 6].map(v => (
                  <Line
                    key={`div-${v}`}
                    x1={CHART_PAD_L} x2={CHART_PAD_L + plotW}
                    y1={toY(v)} y2={toY(v)}
                    stroke={w(0.06)} strokeWidth={1}
                  />
                ))}
                {/* Peak window highlight */}
                {peak && (
                  <Rect
                    x={toX(peak.startDay)}
                    y={CHART_PAD_T}
                    width={toX(peak.endDay) - toX(peak.startDay)}
                    height={plotH}
                    fill={colors.orange}
                    opacity={0.08}
                    rx={4}
                  />
                )}
                {/* Inject line (subtle) */}
                <Line
                  x1={toX(0)} x2={toX(0)}
                  y1={CHART_PAD_T} y2={CHART_PAD_T + plotH}
                  stroke={colors.orange} strokeWidth={1} opacity={0.45}
                />
                {/* Right-edge severity labels */}
                {SEVERITY_ZONES.map(zone => {
                  const cy = (toY(zone.min) + toY(zone.max)) / 2;
                  return (
                    <SvgText
                      key={`lbl-${zone.label}`}
                      x={CHART_PAD_L + plotW + 8}
                      y={cy + 3}
                      fontSize={9}
                      fontWeight="700"
                      fill={zone.color}
                      opacity={0.85}
                      textAnchor="start"
                      fontFamily={FF}
                    >
                      {zone.label.toUpperCase()}
                    </SvgText>
                  );
                })}
                {/* Peak label above the window */}
                {peak && (
                  <SvgText
                    x={(toX(peak.startDay) + toX(peak.endDay)) / 2}
                    y={CHART_PAD_T - 8}
                    fontSize={9}
                    fontWeight="700"
                    fill={colors.orange}
                    textAnchor="middle"
                    fontFamily={FF}
                  >
                    PEAK
                  </SvgText>
                )}
                {/* X ticks (no Day 0 — syringe glyph below anchors it) */}
                {xTicks.map((t, i) => (
                  <SvgText
                    key={`${t.label}-${i}`}
                    x={toX(t.pos)}
                    y={CHART_PAD_T + plotH + 16}
                    fontSize={10}
                    fill={w(0.45)}
                    textAnchor={i === xTicks.length - 1 ? 'end' : 'middle'}
                    fontFamily={FF}
                  >
                    {t.label}
                  </SvgText>
                ))}
                {/* Data dots */}
                {points.map(p => (
                  <Circle
                    key={p.id}
                    cx={toX(p.dayInCycle)}
                    cy={toY(p.severity)}
                    r={DOT_R}
                    fill={colorMap.get(p.type) ?? OTHER_COLOR}
                    opacity={0.95}
                  />
                ))}
              </Svg>
              {/* Syringe / pill glyph anchored at Day 0 baseline */}
              <View
                style={{
                  position: 'absolute',
                  left: toX(0) - 11,
                  top: CHART_PAD_T + plotH + 4,
                  width: 22, height: 22,
                  alignItems: 'center', justifyContent: 'center',
                }}
                pointerEvents="none"
              >
                <LucideIconByName name={doseIcon as any} size={11} color={colors.orange} />
              </View>
            </>
          )}
          <CycleSymptomChips
            ranked={sortedChips}
            freqDays={freqDays}
            oral={oral}
            othersCount={othersCount}
            colors={colors}
          />
        </View>
      )}
    </View>
  );
}

function CycleSymptomChips({
  ranked, freqDays, oral, othersCount, colors,
}: {
  ranked: { type: string; color: string; count: number; avgDay: number }[];
  freqDays: number; oral: boolean; othersCount: number; colors: AppColors;
}) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  if (ranked.length === 0) return null;
  return (
    <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {ranked.map(r => (
        <View
          key={r.type}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 10, paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: r.color + '12',
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.color }} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, fontFamily: FF }}>
            {EFFECT_LABELS[r.type] ?? r.type}
          </Text>
          <Text style={{ fontSize: 11, color: w(0.5), fontFamily: FF }}>
            {formatChipPosition(r.avgDay, freqDays, oral)} · {r.count}×
          </Text>
        </View>
      ))}
      {othersCount > 0 && (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 10, paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: OTHER_COLOR + '12',
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: OTHER_COLOR }} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, fontFamily: FF }}>Other</Text>
          <Text style={{ fontSize: 11, color: w(0.5), fontFamily: FF }}>{othersCount}×</Text>
        </View>
      )}
    </View>
  );
}

// ─── Symptom trends + sparklines ────────────────────────────────────────────

function SymptomTrendsCard({ trends, colors }: { trends: SymptomTrend[]; colors: AppColors }) {
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const headline = buildTrendsHeadline(trends);

  return (
    <View style={s.card}>
      <Text style={s.cardHeadline}>{headline}</Text>
      <Text style={s.cardSub}>30-day trend</Text>
      {trends.length === 0 ? null : (
        <View style={{ marginTop: 14 }}>
          {trends.map((t, i) => (
            <View key={t.type}>
              {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: w(0.06), marginVertical: 12 }} />}
              <SymptomRow trend={t} colors={colors} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function SymptomRow({ trend, colors }: { trend: SymptomTrend; colors: AppColors }) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const color = severityTrendColor(trend.avgSev);
  const name = EFFECT_LABELS[trend.type] ?? trend.type;

  let trendIcon: string = 'Minus';
  let trendColor = w(0.4);
  let trendLabel = 'Flat';
  if (trend.trend === 'improving') { trendIcon = 'ArrowDown'; trendColor = '#27AE60'; trendLabel = `${Math.abs(trend.trendDeltaPct)}% ↓`; }
  else if (trend.trend === 'worsening') { trendIcon = 'ArrowUp'; trendColor = '#E74C3C'; trendLabel = `${Math.abs(trend.trendDeltaPct)}% ↑`; }
  else if (trend.trend === 'insufficient') { trendLabel = 'New'; }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 28, alignItems: 'center' }}>
        <EffectIcon type={trend.type} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, fontFamily: FF }}>{name}</Text>
        <Text style={{ fontSize: 12, color: w(0.45), fontFamily: FF, marginTop: 2 }}>
          {trend.count}× · avg {trend.avgSev}/10
        </Text>
      </View>
      <Sparkline values={trend.sparkline} color={color} />
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: trendColor + '1A', borderRadius: 8,
        paddingHorizontal: 8, paddingVertical: 4,
        minWidth: 56, justifyContent: 'center',
      }}>
        {trend.trend !== 'insufficient' && trend.trend !== 'flat' && <LucideIconByName name={trendIcon as any} size={10} color={trendColor} />}
        <Text style={{ fontSize: 11, fontWeight: '700', color: trendColor, fontFamily: FF }}>{trendLabel}</Text>
      </View>
    </View>
  );
}

const SPARK_W = 56;
const SPARK_H = 26;

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return (
      <View style={{ width: SPARK_W, height: SPARK_H, justifyContent: 'center', alignItems: 'center' }}>
        {values.length === 1 && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />}
      </View>
    );
  }
  const pad = 3;
  const innerW = SPARK_W - pad * 2;
  const innerH = SPARK_H - pad * 2;
  const pts = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * innerW,
    y: pad + (1 - Math.max(0, Math.min(10, v)) / 10) * innerH,
  }));
  const path = smoothPath(pts);
  const last = pts[pts.length - 1];
  return (
    <Svg width={SPARK_W} height={SPARK_H}>
      <Path d={path} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </Svg>
  );
}

// ─── Co-occurrence ──────────────────────────────────────────────────────────

function CoOccurrenceCard({ pairs, colors, totalLogs }: { pairs: CoOccurrencePair[]; colors: AppColors; totalLogs: number }) {
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const headline = buildClustersHeadline(pairs, totalLogs);

  return (
    <View style={s.card}>
      <Text style={s.cardHeadline}>{headline}</Text>
      <Text style={s.cardSub}>Symptom clusters</Text>
      {pairs.length === 0 ? null : (
        <View style={{ marginTop: 14 }}>
          {pairs.map((p, i) => {
            const note = pairNote(p.a, p.b);
            return (
              <View key={`${p.a}::${p.b}`}>
                {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: w(0.06), marginVertical: 12 }} />}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.orange + '1A', alignItems: 'center', justifyContent: 'center' }}>
                      <EffectIcon type={p.a} size={14} color={colors.orange} />
                    </View>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.orange + '1A', alignItems: 'center', justifyContent: 'center', marginLeft: -10, borderWidth: 2, borderColor: colors.surface }}>
                      <EffectIcon type={p.b} size={14} color={colors.orange} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, fontFamily: FF }}>
                      {EFFECT_LABELS[p.a] ?? p.a} + {EFFECT_LABELS[p.b] ?? p.b}
                    </Text>
                    <Text style={{ fontSize: 12, color: w(0.5), fontFamily: FF, marginTop: 2 }}>
                      Same day {p.daysTogether}×{note ? ` · ${note}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function ProgressBar({ value, colors }: { value: number; colors: AppColors }) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return (
    <View style={{ marginTop: 12, height: 5, borderRadius: 3, backgroundColor: w(0.08), overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%`, height: 5, backgroundColor: colors.orange, borderRadius: 3 }} />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '700', fontFamily: FF, letterSpacing: -0.2 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 36, gap: 10 },
    card: {
      borderRadius: 20, backgroundColor: c.surface,
      borderWidth: 0.5, borderColor: c.border,
      padding: 16,
    },
    cardHeadline: {
      fontSize: 17, fontWeight: '800', color: c.textPrimary,
      fontFamily: FF, letterSpacing: -0.25, lineHeight: 22,
    },
    cardSub: {
      fontSize: 11, fontWeight: '700', color: w(0.4),
      letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: FF, marginTop: 4,
    },
    placeholder: {
      marginTop: 12, padding: 12, borderRadius: 12,
      backgroundColor: w(0.04),
      gap: 6,
    },
    placeholderText: {
      fontSize: 13, fontFamily: FF, lineHeight: 18,
    },
    alertCard: {
      flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16,
      backgroundColor: '#E74C3C' + '12',
      borderWidth: 0.5, borderColor: '#E74C3C' + '44',
    },
    alertIconWrap: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: '#E74C3C' + '22',
      alignItems: 'center', justifyContent: 'center',
    },
    alertTitle: {
      fontSize: 14, fontWeight: '800', color: c.textPrimary, fontFamily: FF,
    },
    alertBody: {
      fontSize: 12, color: w(0.6), fontFamily: FF, marginTop: 3, lineHeight: 16,
    },
    footnote: {
      fontSize: 11, color: w(0.4), textAlign: 'center',
      fontFamily: FF, marginTop: 2, paddingHorizontal: 12, lineHeight: 15,
    },
  });
};
