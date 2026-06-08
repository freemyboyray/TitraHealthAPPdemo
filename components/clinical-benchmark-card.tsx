import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { GestureDetector } from 'react-native-gesture-handler';
import { Maximize2, X } from 'lucide-react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { useUiStore } from '@/stores/ui-store';
import { useChartScrub } from '@/hooks/useChartScrub';
import { ChartScrubOverlay } from '@/components/chart-scrub-overlay';
import { smoothPath } from '@/lib/chart-utils';
import { interpolateBenchmarkBand } from '@/constants/scoring';
import { BRAND_DISPLAY_NAMES, type MedicationBrand } from '@/constants/user-profile';
import type { ClinicalBenchmarkResult, BenchmarkStatus } from '@/stores/insights-store';
import { useExpandToFullscreen, ExpandOverlay } from '@/components/ui/expand-in-place';

const TRIAL_BLUE = '#64B4FF';
const CHART_HEIGHT = 150;
const ML = 40;
const MR = 12;
const MT = 10;
const MB = 24;

const STATUS_CONFIG: Record<BenchmarkStatus, { color: string; label: string }> = {
  ahead:    { color: '#27AE60', label: 'Ahead' },
  on_track: { color: '#F39C12', label: 'On track' },
  behind:   { color: '#E74C3C', label: 'Behind' },
};

const DESCRIPTION = "See how you're tracking against your medication's clinical trial.";

type Props = {
  result: ClinicalBenchmarkResult;
  medicationBrand?: MedicationBrand;
};

export function ClinicalBenchmarkCard({ result, medicationBrand }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { openAiChat } = useUiStore();
  const [svgWidth, setSvgWidth] = useState(0);
  // Tap to expand into a centered card over a blurred backdrop (like the PK graph).
  const exp = useExpandToFullscreen({ mode: 'card', cardHeight: 580 });

  // All hooks must be called unconditionally (before any early returns).
  const isFullChart = result.hasEnoughData && !result.unknownMedication && !result.noTrialData && !result.tooEarly;
  const _userPts: { x: number; y: number }[] = useMemo(() => {
    if (!isFullChart || svgWidth <= 0) return [];
    const ut = result.userTrajectory ?? [];
    const maxW = Math.max(result.trialMaxWeek ?? 12, result.treatmentWeek ?? 0, 12);
    const pw = Math.max(0, svgWidth - ML - MR);
    const allP = [...(result.trialTrajectory ?? []).map((p: any) => p.high), ...ut.map((p: any) => p.lossPct), 0];
    const yR = (Math.max(...allP) * 1.15) || 25;
    return ut.map((p: any) => ({ x: ML + (p.week / maxW) * pw, y: MT + CHART_HEIGHT - (p.lossPct / yR) * CHART_HEIGHT }));
  }, [isFullChart, svgWidth, result.userTrajectory, result.trialTrajectory, result.trialMaxWeek, result.treatmentWeek]);

  const tooltipFormatter = useCallback((idx: number) => {
    const ut = result.userTrajectory;
    if (!ut || idx < 0 || idx >= ut.length) return { title: '', subtitle: '' };
    const pt = ut[idx];
    const trialAtWeek = result.trialTrajectory ? interpolateBenchmarkBand(result.trialTrajectory as any, pt.week) : null;
    const trialStr = trialAtWeek ? `Trial ${trialAtWeek.mean}%` : '';
    return {
      title: `${pt.lossPct}% lost`,
      subtitle: `Week ${pt.week}${trialStr ? `, ${trialStr}` : ''}`,
    };
  }, [result.userTrajectory, result.trialTrajectory]);

  const scrub = useChartScrub({
    points: _userPts,
    chartWidth: svgWidth,
    marginLeft: ML,
    marginRight: MR,
    mode: 'longpress-only',
    enabled: _userPts.length > 0 && svgWidth > 0,
  });

  const onLayout = (e: LayoutChangeEvent) => setSvgWidth(e.nativeEvent.layout.width);

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const context = result.status
      ? `At treatment week ${result.treatmentWeek}, user has lost ${result.userLossPct}% body weight. ${result.trialName} participants lost ${result.trialLossPct}% at the same point (${result.deltaVsTrial! > 0 ? '+' : ''}${result.deltaVsTrial}% vs trial). Status: ${result.status}.`
      : 'Clinical benchmarking is active but not enough data yet.';
    openAiChat({
      contextLabel: 'Clinical Benchmark',
      contextValue: context,
      seedMessage: context,
      chips: JSON.stringify([
        'Am I on track with my medication?',
        'How does my progress compare to trials?',
        'What can I do to improve my results?',
      ]),
    });
  };

  // ── Empty states — a simple (non-expandable) entry card with the message ──────
  const emptyMessage =
    !result.hasEnoughData ? 'Log 2 or more weight entries to compare your progress against clinical trial data.'
    : result.unknownMedication ? 'Set your medication in Settings to see how you compare to clinical trial participants.'
    : result.noTrialData ? "Clinical trial benchmarks are not yet available for your medication. We'll add them as published data becomes available."
    : result.tooEarly ? `It is week ${result.treatmentWeek}. Check back at week 4 for your first comparison against ${result.trialName}.`
    : null;

  if (emptyMessage) {
    return (
      <View style={s.entryCard}>
        <View style={s.topRow}>
          <Text style={s.entryTitle}>Clinical Benchmark</Text>
        </View>
        <Text style={s.entryDesc}>{emptyMessage}</Text>
      </View>
    );
  }

  const status = result.status ? STATUS_CONFIG[result.status] : null;

  // ── Chart geometry ──────────────────────────────────────────────────────────
  const svgH = CHART_HEIGHT + MT + MB;
  const plotW = Math.max(0, svgWidth - ML - MR);
  const plotH = CHART_HEIGHT;

  const { trialTrajectory, userTrajectory, trialMaxWeek, treatmentWeek } = result;
  const maxWeek = Math.max(trialMaxWeek, treatmentWeek, 12);

  const allPcts = [
    ...trialTrajectory.map(p => p.high),
    ...userTrajectory.map(p => p.lossPct),
    0,
  ];
  const maxPct = Math.max(...allPcts) * 1.15;
  const yRange = maxPct || 25;

  const toX = (week: number) => ML + (week / maxWeek) * plotW;
  const toY = (pct: number) => MT + plotH - (pct / yRange) * plotH;

  // Trial band
  const trialHighPts = trialTrajectory.map(p => ({ x: toX(p.week), y: toY(p.high) }));
  const trialLowPts = trialTrajectory.map(p => ({ x: toX(p.week), y: toY(p.low) }));
  const trialMeanPts = trialTrajectory.map(p => ({ x: toX(p.week), y: toY(p.mean) }));

  let bandPath = '';
  if (trialHighPts.length >= 2) {
    const upperPath = smoothPath(trialHighPts);
    const lowerReversed = [...trialLowPts].reverse();
    const lowerPath = smoothPath(lowerReversed);
    bandPath = `${upperPath} L ${lowerReversed[0].x} ${lowerReversed[0].y} ${lowerPath.slice(lowerPath.indexOf('C'))} Z`;
  }

  const trialMeanPath = smoothPath(trialMeanPts);

  // User trajectory
  const userPts = userTrajectory.map(p => ({ x: toX(p.week), y: toY(p.lossPct) }));
  const userLinePath = smoothPath(userPts);
  const userAreaPath = userPts.length >= 2
    ? `${userLinePath} L ${userPts[userPts.length - 1].x} ${toY(0)} L ${userPts[0].x} ${toY(0)} Z`
    : '';
  const lastUserPt = userPts[userPts.length - 1];

  // Axis ticks
  const yStep = yRange <= 15 ? 5 : 10;
  const yTicks: number[] = [];
  for (let v = 0; v <= yRange; v += yStep) yTicks.push(v);

  const xLabelWeeks = trialTrajectory.length > 0
    ? trialTrajectory
        .filter((_, i) => i % 2 === 0 || i === trialTrajectory.length - 1)
        .map(p => p.week)
    : [4, 12, 20, 28, 52];

  // Friendly trial label
  const brandLabel = medicationBrand && medicationBrand !== 'other'
    ? BRAND_DISPLAY_NAMES[medicationBrand].replace('®', '')
    : null;
  const trialDisplayName = brandLabel ? `${brandLabel} Trial` : `${result.trialName} Trial`;

  // After-graph interpretation (no dot separators / em dashes).
  const statusSentence =
    result.status === 'ahead' ? 'You are ahead of the trial pace, so whatever you are doing is working well.'
    : result.status === 'on_track' ? 'You are tracking right around the trial average.'
    : 'You are a little behind the trial pace right now. Early differences are common and often even out as treatment continues.';
  const afterText = status
    ? `At week ${treatmentWeek} you have lost ${result.userLossPct}% of your body weight, compared with the trial average of ${result.trialLossPct}%. ${statusSentence}`
    : '';

  const chart = (
    <GestureDetector gesture={scrub.gesture}>
      <View style={{ height: svgH, position: 'relative', marginTop: 16 }} onLayout={onLayout}>
        {svgWidth > 0 && (
          <>
            <Svg width={svgWidth} height={svgH}>
              <Defs>
                <LinearGradient id="trialBandGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={TRIAL_BLUE} stopOpacity="0.18" />
                  <Stop offset="1" stopColor={TRIAL_BLUE} stopOpacity="0.04" />
                </LinearGradient>
                <LinearGradient id="userAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.orange} stopOpacity="0.25" />
                  <Stop offset="1" stopColor={colors.orange} stopOpacity="0" />
                </LinearGradient>
              </Defs>

              {/* Y-axis gridlines + labels */}
              {yTicks.map(tick => {
                const y = toY(tick);
                return (
                  <React.Fragment key={`y-${tick}`}>
                    <Line
                      x1={ML} y1={y} x2={ML + plotW} y2={y}
                      stroke={colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} strokeWidth={1} strokeDasharray="4,4"
                    />
                    <SvgText
                      x={ML - 6} y={y + 4}
                      fontSize={12} fill={colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                      textAnchor="end" fontFamily="System"
                    >
                      {tick}%
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* X-axis labels */}
              {xLabelWeeks.map(week => {
                const x = toX(week);
                return (
                  <React.Fragment key={`x-${week}`}>
                    <Line
                      x1={x} y1={MT} x2={x} y2={MT + plotH}
                      stroke={colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} strokeWidth={1}
                    />
                    <SvgText
                      x={x} y={MT + plotH + 16}
                      fontSize={11} fill={colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                      textAnchor="middle" fontFamily="System"
                    >
                      Wk {week}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* Trial band */}
              {bandPath ? <Path d={bandPath} fill="url(#trialBandGrad)" /> : null}

              {/* Trial mean line */}
              {trialMeanPath ? (
                <Path
                  d={trialMeanPath}
                  stroke="rgba(100,180,255,0.5)"
                  strokeWidth={1.5}
                  fill="none"
                  strokeDasharray="4,3"
                  strokeLinecap="round"
                />
              ) : null}

              {/* User area fill */}
              {userAreaPath ? <Path d={userAreaPath} fill="url(#userAreaGrad)" /> : null}

              {/* User line */}
              {userLinePath ? (
                <Path
                  d={userLinePath}
                  stroke={colors.orange}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {/* User dots */}
              {userPts.slice(0, -1).map((pt, i) => (
                <Circle key={`dot-${i}`} cx={pt.x} cy={pt.y} r={3} fill={colors.orange} />
              ))}

              {/* Last point — double ring */}
              {lastUserPt && (
                <>
                  <Circle cx={lastUserPt.x} cy={lastUserPt.y} r={8} fill="rgba(255,116,42,0.2)" />
                  <Circle cx={lastUserPt.x} cy={lastUserPt.y} r={4.5} fill={colors.orange} />
                </>
              )}
            </Svg>
            <ChartScrubOverlay
              activeIndex={scrub.activeIndex}
              isActive={scrub.isActive}
              crosshairX={scrub.crosshairX}
              crosshairY={scrub.crosshairY}
              chartHeight={svgH}
              chartWidth={svgWidth}
              color={colors.orange}
              formatTooltip={tooltipFormatter}
            />
          </>
        )}
      </View>
    </GestureDetector>
  );

  return (
    <>
      {/* Collapsed entry card — title, tap-to-expand (top-right), big asset, caption */}
      <Pressable
        ref={exp.cardRef}
        style={s.entryCard}
        onPress={exp.open}
        onLongPress={handleLongPress}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel="Clinical Benchmark. Tap to expand"
      >
        <View style={s.topRow}>
          <Text style={s.entryTitle}>Clinical Benchmark</Text>
          <View style={s.tapRow}>
            <Maximize2 size={12} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
            <Text style={s.tapText}>Tap to expand</Text>
          </View>
        </View>
        <Text style={s.entryDesc}>{DESCRIPTION}</Text>
      </Pressable>

      {/* Expanded — description, your-loss/trial numbers, interactive graph, text */}
      <ExpandOverlay exp={exp}>
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={s.expHeader}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.expTitle}>Clinical Benchmark</Text>
              <Text style={s.weekLabel}>Week {treatmentWeek}</Text>
            </View>
            <Pressable onPress={exp.close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <X size={24} color={colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            <Text style={s.expBody}>{DESCRIPTION}</Text>

            {/* Your loss vs trial average */}
            <View style={s.statsRow}>
              <View style={s.statBlock}>
                <Text style={s.statValue}>{result.userLossPct}%</Text>
                <Text style={s.statLabel}>Your loss</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBlock}>
                <Text style={[s.statValue, { color: TRIAL_BLUE }]}>{result.trialLossPct}%</Text>
                <Text style={s.statLabel}>Trial avg</Text>
              </View>
            </View>

            {chart}

            {/* Legend */}
            <View style={s.legendRow}>
              <View style={s.legendItem}>
                <View style={[s.legendLine, { backgroundColor: colors.orange }]} />
                <Text style={s.legendLabel}>You</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendSwatch, { backgroundColor: TRIAL_BLUE, opacity: 0.3 }]} />
                <Text style={s.legendLabel}>{trialDisplayName}</Text>
              </View>
            </View>

            {!!afterText && <Text style={[s.expBody, { marginTop: 18 }]}>{afterText}</Text>}
            <Text style={s.hint}>Hold the graph to scrub through your weeks.</Text>
          </ScrollView>
        </View>
      </ExpandOverlay>
    </>
  );
}

const createStyles = (c: AppColors) => {
  const dim = c.isDark ? 'rgba(255,255,255,' : 'rgba(0,0,0,';
  return StyleSheet.create({
    // Collapsed entry card
    entryCard: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 16,
      overflow: 'hidden',
      marginBottom: 16,
      ...cardElevation(c.isDark),
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    entryTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.textPrimary,
      letterSpacing: -0.3,
      fontFamily: 'System',
    },
    tapRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    tapText: { fontSize: 12, color: `${dim}0.4)`, fontWeight: '600', fontFamily: 'System' },
    entryDesc: {
      fontSize: 14,
      color: `${dim}0.55)`,
      lineHeight: 20,
      marginTop: 10,
      fontFamily: 'System',
    },

    // Expanded view (restores the original benchmark detail)
    expHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 8,
    },
    expTitle: { fontSize: 20, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.4, fontFamily: 'System' },
    weekLabel: { fontSize: 14, fontWeight: '600', color: `${dim}0.4)`, marginTop: 3, fontFamily: 'System' },
    expBody: { fontSize: 14, color: `${dim}0.6)`, lineHeight: 21, fontFamily: 'System' },

    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 4 },
    statBlock: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 32, fontWeight: '800', color: c.orange, letterSpacing: -1, fontFamily: 'System' },
    statLabel: { fontSize: 13, fontWeight: '600', color: `${dim}0.45)`, marginTop: 4, fontFamily: 'System' },
    statDivider: { width: 1, height: 40, backgroundColor: `${dim}0.1)` },

    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendLine: { width: 14, height: 3, borderRadius: 1.5 },
    legendSwatch: { width: 12, height: 8, borderRadius: 2 },
    legendLabel: { fontSize: 13, color: `${dim}0.4)`, fontFamily: 'System' },

    hint: { fontSize: 13, color: `${dim}0.25)`, textAlign: 'center', marginTop: 10, fontFamily: 'System' },
  });
};
