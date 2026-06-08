import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { ChevronLeft, Info, X } from 'lucide-react-native';
import Svg, {
  Circle, Defs, Line as SvgLine, LinearGradient, Path, Stop, Text as SvgText,
} from 'react-native-svg';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { LucideIconByName } from '@/lib/lucide-icon-map';
import { useLogStore } from '@/stores/log-store';
import { useLifestyleMetrics } from '@/hooks/use-lifestyle-metrics';
import { localDateStr } from '@/lib/date-utils';
import { niceYTicks, smoothPath } from '@/lib/chart-utils';
import { ARTICLES, type Article } from '@/constants/articles';
import {
  GENERIC_ARTICLE_ID,
  buildActivityByDate, buildFoodByDate, buildSeries, getSummaryMetric, goalStatus, seriesStats,
} from '@/lib/metric-history';

const FF = 'System';
const CHART_H = 210;
const PERIODS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

const fmtNum = (id: string, v: number) =>
  id === 'steps' || id === 'calories' || id === 'active_cal'
    ? Math.round(v).toLocaleString()
    : String(Math.round(v));

/**
 * Per-metric illustration — the SAME hand-illustrated card assets used on the insights
 * summary cards (steps.png, protein.png, …), NOT a lucide/AI glyph. Micros share the
 * micronutrient illustration; anything unmapped falls back to its lucide icon.
 */
const METRIC_IMAGE: Record<string, ImageSourcePropType> = {
  protein: require('@/assets/images/cards/protein.png'),
  carbs: require('@/assets/images/cards/carbs.png'),
  fat: require('@/assets/images/cards/fat.png'),
  calories: require('@/assets/images/cards/calories.png'),
  fiber: require('@/assets/images/cards/fiber.png'),
  steps: require('@/assets/images/cards/steps.png'),
  active_cal: require('@/assets/images/cards/active-calories.png'),
};
const MICRO_IMAGE = require('@/assets/images/cards/micronutrients.png');

/** What each stat tile means, in plain language — surfaced by the ⓘ button on the tile. */
function statInfo(metricLabel: string, inverseGoal?: boolean): Record<string, { title: string; body: string }> {
  const m = metricLabel.toLowerCase();
  const goalPhrase = inverseGoal ? `stayed under your ${m} limit` : `reached your ${m} goal`;
  return {
    Average: {
      title: 'Average',
      body: `Your typical ${m} per day across the selected period — the mean of every day with logged data. Days with no data are skipped, so this reflects how you actually tracked.`,
    },
    'Goal hit': {
      title: 'Goal hit',
      body: `The share of your logged days where you ${goalPhrase}. 100% means every tracked day was on target.`,
    },
    Trend: {
      title: 'Trend',
      body: `The direction your ${m} is moving — the average of the second half of this period compared with the first half. A positive value means it is rising over time.`,
    },
    'Best streak': {
      title: 'Best streak',
      body: `Your longest run of consecutive days where you ${goalPhrase} — a measure of consistency, not just total.`,
    },
  };
}

export default function MetricDetailScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const metric = id ? getSummaryMetric(id) : undefined;

  const { foodLogs, activityLogs } = useLogStore();
  const {
    targets,
    sodiumTargetMg, sugarTargetG, satFatTargetG, cholesterolTargetMg,
    transFatTargetG, polyFatTargetG, monoFatTargetG, potassiumTargetMg, addedSugarsTargetG,
    vitaminATargetMcg, vitaminCTargetMg, vitaminDTargetMcg, calciumTargetMg, ironTargetMg,
  } = useLifestyleMetrics();
  const [periodDays, setPeriodDays] = useState(30);
  const [chartW, setChartW] = useState(0);
  const [infoKey, setInfoKey] = useState<string | null>(null);

  const foodByDate = useMemo(() => buildFoodByDate(foodLogs), [foodLogs]);
  const activityByDate = useMemo(() => buildActivityByDate(activityLogs), [activityLogs]);
  const todayStr = localDateStr();

  const targetMap: Record<string, number> = {
    protein: targets.proteinG,
    carbs: targets.carbsG,
    fat: targets.fatG,
    calories: targets.caloriesTarget,
    fiber: targets.fiberG,
    steps: targets.steps,
    active_cal: targets.activeCaloriesTarget,
    // Micronutrients & extended fats
    sodium: sodiumTargetMg,
    sugar: sugarTargetG,
    added_sugars: addedSugarsTargetG,
    sat_fat: satFatTargetG,
    trans_fat: transFatTargetG,
    mono_fat: monoFatTargetG,
    poly_fat: polyFatTargetG,
    cholesterol: cholesterolTargetMg,
    potassium: potassiumTargetMg,
    calcium: calciumTargetMg,
    iron: ironTargetMg,
    vitamin_a: vitaminATargetMcg,
    vitamin_c: vitaminCTargetMg,
    vitamin_d: vitaminDTargetMcg,
  };
  const target = metric ? Math.round(targetMap[metric.id] ?? 0) : 0;

  const { values, dates } = useMemo(
    () => (metric ? buildSeries(metric, foodByDate, activityByDate, todayStr, periodDays) : { values: [], dates: [] }),
    [metric, foodByDate, activityByDate, todayStr, periodDays],
  );

  const stats = useMemo(
    () => seriesStats(values, target, metric?.inverseGoal),
    [values, target, metric],
  );
  const related = useMemo(() => {
    if (!metric) return [] as Article[];
    const ids = [metric.articleId, GENERIC_ARTICLE_ID].filter((v, i, arr) => arr.indexOf(v) === i);
    return ids
      .map((aid) => ARTICLES.find((a) => a.id === aid))
      .filter((a): a is Article => Boolean(a));
  }, [metric]);

  if (!metric) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <SafeAreaView>
          <Text style={{ color: colors.textMuted, fontSize: 17, fontFamily: FF }}>Metric not found.</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.orange, fontSize: 15, fontWeight: '600', fontFamily: FF, textAlign: 'center' }}>Go Back</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const todayValue = values.length ? values[values.length - 1] : null;
  const pct = target > 0 && todayValue != null ? (todayValue / target) * 100 : 0;
  const st = goalStatus(pct, metric.inverseGoal);
  const hitPct = Math.round(stats.hitRate * 100);
  const hitColor = stats.hitRate >= 0.7 ? '#27AE60' : stats.hitRate >= 0.4 ? '#F6CB45' : '#E74C3C';
  const trendUp = stats.trendPct >= 0;

  const metricImage = METRIC_IMAGE[metric.id] ?? (metric.group === 'micro' ? MICRO_IMAGE : undefined);
  const STAT_INFO = statInfo(metric.label, metric.inverseGoal);
  const activeInfo = infoKey ? STAT_INFO[infoKey] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Nav bar */}
        <View style={s.navBar}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={s.navTitleWrap}>
            {metricImage ? (
              <Image source={metricImage} style={s.navImage} resizeMode="contain" accessibilityIgnoresInvertColors />
            ) : (
              <LucideIconByName name={metric.icon} size={18} color={metric.color} />
            )}
            <Text style={s.navTitle} numberOfLines={1}>{metric.label}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Lead description — the first thing you read, no "About" heading */}
          <Text style={s.lead}>{metric.about}</Text>

          {/* Headline value */}
          <View style={s.headlineRow}>
            <Text style={s.bigValue}>{todayValue != null ? fmtNum(metric.id, todayValue) : '0'}</Text>
            <Text style={s.bigUnit}>{metric.unit}</Text>
          </View>
          <Text style={[s.descriptor, { color: st.color }]}>
            {st.label}{target > 0 ? ` (${fmtNum(metric.id, target)} ${metric.unit})` : ''}
          </Text>

          {/* Period selector */}
          <View style={s.periodRow}>
            {PERIODS.map((p) => {
              const active = p.days === periodDays;
              return (
                <Pressable
                  key={p.days}
                  onPress={() => setPeriodDays(p.days)}
                  style={[s.periodPill, active && { backgroundColor: metric.color + '22' }]}
                >
                  <Text style={[s.periodText, active && { color: metric.color }]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Chart */}
          <View style={s.chartCard} onLayout={(e) => setChartW(e.nativeEvent.layout.width)}>
            {chartW > 0 && (
              <MetricChart
                values={values}
                dates={dates}
                target={target}
                color={metric.color}
                width={chartW - 24}
                colors={colors}
                metricId={metric.id}
                unit={metric.unit}
              />
            )}
            {!stats.count && (
              <Text style={s.emptyChart}>No data logged in this period.</Text>
            )}
          </View>

          {/* Stats — each tile has a ⓘ explaining what it means */}
          <View style={s.statsGrid}>
            <Stat label="Average" value={`${fmtNum(metric.id, stats.average)}`} sub={metric.unit} colors={colors} onInfo={() => setInfoKey('Average')} />
            <Stat label="Goal hit" value={`${hitPct}%`} valueColor={hitColor} colors={colors} onInfo={() => setInfoKey('Goal hit')} />
            <Stat label="Trend" value={`${trendUp ? '+' : ''}${Math.round(stats.trendPct)}%`} valueColor={trendUp ? '#27AE60' : '#E74C3C'} colors={colors} onInfo={() => setInfoKey('Trend')} />
            <Stat label="Best streak" value={`${stats.bestStreak}`} sub="days" colors={colors} onInfo={() => setInfoKey('Best streak')} />
          </View>

          {/* Related education — horizontal row, matching the Education page */}
          {related.length > 0 && (
            <>
              <Text style={s.relatedTitle}>Learn more</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.relatedScroll}
                contentContainerStyle={s.relatedRow}
              >
                {related.map((a) => (
                  <ArticleCard key={a.id} article={a} colors={colors} />
                ))}
              </ScrollView>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Stat explainer */}
      <Modal visible={!!activeInfo} transparent animationType="fade" onRequestClose={() => setInfoKey(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setInfoKey(null)}>
          <Pressable style={s.infoSheet} onPress={(e) => e.stopPropagation()}>
            <BlurView
              intensity={colors.isDark ? 40 : 30}
              tint={colors.isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, opacity: colors.isDark ? 0.55 : 0.9 }]} />
            <View style={s.infoHeader}>
              <View style={[s.infoIconBadge, { backgroundColor: metric.color + '22' }]}>
                <Info size={18} color={metric.color} />
              </View>
              <Text style={s.infoTitle}>{activeInfo?.title}</Text>
              <Pressable onPress={() => setInfoKey(null)} style={s.infoClose} hitSlop={10}>
                <X size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={s.infoBody}>{activeInfo?.body}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Chart ────────────────────────────────────────────────────────────────────

function MetricChart({
  values, dates, target, color, width, colors, metricId, unit,
}: {
  values: (number | null)[];
  dates: string[];
  target: number;
  color: string;
  width: number;
  colors: AppColors;
  metricId: string;
  unit: string;
}) {
  const ml = 38, mr = 10, mt = 12, mb = 22;
  const plotW = Math.max(0, width - ml - mr);
  const plotH = CHART_H - mt - mb;
  const tc = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  const nums = values.filter((v): v is number => v != null);
  const dataMax = nums.length ? Math.max(...nums) : 1;
  // Axis baseline is always 0; top accommodates both the data and the goal line.
  const hi = Math.max(dataMax, target || dataMax, 1);
  const ticks = niceYTicks(0, hi, 4);
  const yMin = 0;
  const yMax = Math.max(...ticks, hi);
  const range = yMax - yMin || 1;
  const xSpan = values.length - 1 || 1;

  const X = (i: number) => ml + (i / xSpan) * plotW;
  const Y = (v: number) => mt + (1 - (v - yMin) / range) * plotH;

  // index-aware points (keep the index so the scrubber can map a touch → a day)
  const idxPts = values
    .map((v, i) => (v != null ? { i, x: X(i), y: Y(v), v } : null))
    .filter((p): p is { i: number; x: number; y: number; v: number } => p != null);
  const pts = idxPts.map((p) => ({ x: p.x, y: p.y }));
  const line = smoothPath(pts);
  const area = pts.length
    ? `${line} L ${pts[pts.length - 1].x} ${mt + plotH} L ${pts[0].x} ${mt + plotH} Z`
    : '';
  const goalY = Y(target);
  const last = pts[pts.length - 1];
  const gid = `metric-${color.replace('#', '')}`;

  // x labels: first, middle, last date
  const labelIdx = [0, Math.floor((values.length - 1) / 2), values.length - 1];
  const fmtDate = (ds: string) => {
    const d = new Date(ds + 'T12:00:00');
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const fmtFull = (ds: string) => {
    const d = new Date(ds + 'T12:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // ── Scrubber ──────────────────────────────────────────────────────────────
  const [active, setActive] = useState<number | null>(null);
  const pickNearest = (touchX: number) => {
    if (!idxPts.length) return;
    let best = idxPts[0];
    let bestD = Infinity;
    for (const p of idxPts) {
      const d = Math.abs(p.x - touchX);
      if (d < bestD) { bestD = d; best = p; }
    }
    setActive(best.i);
  };
  const pan = useRef(
    PanResponder.create({
      // Don't claim taps/vertical drags — let the page scroll. Scrub on horizontal drag.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 4,
      onPanResponderGrant: (e) => pickNearest(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pickNearest(e.nativeEvent.locationX),
      onPanResponderRelease: () => setActive(null),
      onPanResponderTerminate: () => setActive(null),
    }),
  ).current;

  const activePt = active != null ? idxPts.find((p) => p.i === active) : undefined;
  const tipW = 96;
  const tipX = activePt ? Math.min(Math.max(activePt.x - tipW / 2, 0), width - tipW) : 0;

  return (
    <View style={{ width, height: CHART_H }}>
      <Svg width={width} height={CHART_H}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.25} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Y grid + labels */}
        {ticks.map((t, i) => (
          <SvgLine key={`g${i}`} x1={ml} y1={Y(t)} x2={ml + plotW} y2={Y(t)} stroke={tc(0.06)} strokeWidth={1} />
        ))}
        {ticks.map((t, i) => (
          <SvgText key={`t${i}`} x={ml - 6} y={Y(t) + 3} fontSize={10} fill={tc(0.35)} textAnchor="end" fontFamily={FF}>
            {Math.round(t)}
          </SvgText>
        ))}

        {/* Goal line */}
        {target > 0 && (
          <SvgLine x1={ml} y1={goalY} x2={ml + plotW} y2={goalY} stroke={tc(0.28)} strokeWidth={1} strokeDasharray="4 4" />
        )}

        {/* Area + line */}
        {pts.length > 1 && <Path d={area} fill={`url(#${gid})`} />}
        {pts.length > 1 && (
          <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {last && active == null && <Circle cx={last.x} cy={last.y} r={3.5} fill={color} />}

        {/* Scrub indicator */}
        {activePt && (
          <>
            <SvgLine x1={activePt.x} y1={mt} x2={activePt.x} y2={mt + plotH} stroke={tc(0.22)} strokeWidth={1} />
            <Circle cx={activePt.x} cy={activePt.y} r={6} fill={color} opacity={0.18} />
            <Circle cx={activePt.x} cy={activePt.y} r={4} fill={color} stroke={colors.surface} strokeWidth={1.5} />
          </>
        )}

        {/* X labels */}
        {labelIdx.map((idx, i) => (
          <SvgText
            key={`x${i}`}
            x={X(idx)}
            y={CHART_H - 6}
            fontSize={10}
            fill={tc(0.35)}
            textAnchor={i === 0 ? 'start' : i === labelIdx.length - 1 ? 'end' : 'middle'}
            fontFamily={FF}
          >
            {dates[idx] ? fmtDate(dates[idx]) : ''}
          </SvgText>
        ))}
      </Svg>

      {/* Scrub tooltip (RN view for crisp text) */}
      {activePt && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: tipX,
            width: tipW,
            borderRadius: 12,
            paddingVertical: 6,
            paddingHorizontal: 8,
            backgroundColor: colors.isDark ? 'rgba(40,40,42,0.96)' : 'rgba(255,255,255,0.98)',
            alignItems: 'center',
            ...cardElevation(colors.isDark),
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3, fontFamily: FF }}>
            {fmtNum(metricId, activePt.v)}{unit === 'steps' ? '' : ` ${unit}`}
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 1, fontFamily: FF }}>
            {dates[activePt.i] ? fmtFull(dates[activePt.i]) : ''}
          </Text>
        </View>
      )}

      {/* Gesture capture overlay */}
      <View {...pan.panHandlers} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** Pastel illustration tile — same design as the Education page horizontal rows. */
function ArticleCard({ article, colors }: { article: Article; colors: AppColors }) {
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      style={({ pressed }) => [s.articleCard, { backgroundColor: article.bgColor }, pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] }]}
      onPress={() => router.push(`/articles/${article.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={article.title}
    >
      <View style={s.articleImageWrap}>
        <Image source={article.coverImage} style={s.articleImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
      <View style={s.articleTextArea}>
        <Text style={s.articleHeadline} numberOfLines={3}>{article.title}</Text>
      </View>
    </Pressable>
  );
}

function Stat({
  label, value, sub, valueColor, colors, onInfo,
}: {
  label: string; value: string; sub?: string; valueColor?: string; colors: AppColors; onInfo?: () => void;
}) {
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={s.statCell}>
      {!!onInfo && (
        <Pressable onPress={onInfo} style={s.statInfoBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel={`What does ${label} mean?`}>
          <Info size={14} color={colors.textMuted} />
        </Pressable>
      )}
      <Text style={s.statLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        <Text style={[s.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
        {!!sub && <Text style={s.statSub}>{sub}</Text>}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      alignItems: 'center', justifyContent: 'center',
    },
    navTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, justifyContent: 'center' },
    navImage: { width: 26, height: 26 },
    navTitle: { fontSize: 19, fontWeight: '700', color: c.textPrimary, letterSpacing: -0.3, fontFamily: FF },

    content: { paddingHorizontal: 16, paddingBottom: 40 },

    lead: { fontSize: 15, fontWeight: '400', color: w(0.6), lineHeight: 22, fontFamily: FF, marginTop: 2, marginBottom: 22 },

    headlineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 4 },
    bigValue: { fontSize: 44, fontWeight: '800', color: c.textPrimary, letterSpacing: -1.2, fontFamily: FF },
    bigUnit: { fontSize: 18, fontWeight: '600', color: c.textSecondary, marginBottom: 8, fontFamily: FF },
    descriptor: { fontSize: 14, fontWeight: '600', fontFamily: FF, marginTop: 5 },

    periodRow: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 12 },
    periodPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: w(0.05) },
    periodText: { fontSize: 13, fontWeight: '700', color: w(0.45), fontFamily: FF },

    chartCard: {
      borderRadius: 24,
      backgroundColor: c.surface,
      paddingVertical: 14,
      paddingHorizontal: 12,
      minHeight: CHART_H + 24,
      justifyContent: 'center',
      ...cardElevation(c.isDark),
    },
    emptyChart: { textAlign: 'center', color: c.textMuted, fontSize: 14, fontFamily: FF, paddingVertical: 40 },

    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 14,
    },
    statCell: {
      position: 'relative',
      flexGrow: 1,
      flexBasis: '47%',
      borderRadius: 18,
      backgroundColor: c.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
      ...cardElevation(c.isDark),
    },
    statInfoBtn: { position: 'absolute', top: 10, right: 10, padding: 4, zIndex: 2 },
    statLabel: { fontSize: 12, fontWeight: '600', color: c.textMuted, marginBottom: 4, fontFamily: FF, paddingRight: 18 },
    statValue: { fontSize: 22, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.4, fontFamily: FF },
    statSub: { fontSize: 12, fontWeight: '600', color: c.textSecondary, marginBottom: 3, fontFamily: FF },

    // Stat explainer modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    infoSheet: {
      width: '100%',
      maxWidth: 340,
      borderRadius: 24,
      padding: 20,
      overflow: 'hidden',
      borderWidth: 0.5,
      borderColor: c.border,
      ...cardElevation(c.isDark),
    },
    infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    infoIconBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    infoTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: c.textPrimary, letterSpacing: -0.3, fontFamily: FF },
    infoClose: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: w(0.06),
      alignItems: 'center', justifyContent: 'center',
    },
    infoBody: { fontSize: 14.5, color: w(0.66), lineHeight: 22, fontFamily: FF },

    relatedTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary, letterSpacing: -0.3, marginTop: 24, marginBottom: 12, fontFamily: FF },
    // Horizontal carousel — bleeds to the screen edges past the page padding.
    relatedScroll: { marginHorizontal: -16 },
    relatedRow: { paddingHorizontal: 16 },
    // Pastel tile (colors fixed — dark text on pastel, like the Education page).
    articleCard: {
      width: 172,
      borderRadius: 22,
      overflow: 'hidden',
      marginRight: 14,
    },
    articleImageWrap: { width: 172, height: 172 },
    articleImage: { width: '100%', height: '100%' },
    articleReadPill: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 11,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    articleReadPillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.3, fontFamily: FF },
    articleTextArea: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 },
    articleHeadline: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.3, lineHeight: 20, fontFamily: FF },
  });
};
