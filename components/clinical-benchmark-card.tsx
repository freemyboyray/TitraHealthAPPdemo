import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { GestureDetector } from 'react-native-gesture-handler';

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

const ORANGE = '#FF742A';
const TRIAL_BLUE = '#64B4FF';
const CHART_HEIGHT = 150;
const ML = 40;
const MR = 12;
const MT = 10;
const MB = 24;

const STATUS_CONFIG: Record<BenchmarkStatus, { color: string; label: string }> = {
  ahead:    { color: '#27AE60', label: 'Ahead' },
  on_track: { color: '#F39C12', label: 'On Track' },
  behind:   { color: '#E74C3C', label: 'Behind' },
};

type Props = {
  result: ClinicalBenchmarkResult;
  medicationBrand?: MedicationBrand;
};

export function ClinicalBenchmarkCard({ result, medicationBrand }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { openAiChat } = useUiStore();
  const [svgWidth, setSvgWidth] = useState(0);

  // All hooks must be called unconditionally (before any early returns).
  // We compute userPts here so the hook always receives consistent data.
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
    const trialStr = trialAtWeek ? `Trial: ${trialAtWeek.mean}%` : '';
    return {
      title: `${pt.lossPct}% lost`,
      subtitle: `Week ${pt.week}${trialStr ? ` · ${trialStr}` : ''}`,
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

  // ── Empty states ────────────────────────────────────────────────────────────
  if (!result.hasEnoughData) {
    return (
      <View style={s.card}>
        <Text style={s.title}>Clinical Benchmark</Text>
        <Text style={s.emptyText}>
          Log 2+ weight entries to compare your progress against clinical trial data.
        </Text>
      </View>
    );
  }

  if (result.unknownMedication) {
    return (
      <View style={s.card}>
        <Text style={s.title}>Clinical Benchmark</Text>
        <Text style={s.emptyText}>
          Set your medication in Settings to see how you compare to clinical trial participants.
        </Text>
      </View>
    );
  }

  if (result.noTrialData) {
    return (
      <View style={s.card}>
        <Text style={s.title}>Clinical Benchmark</Text>
        <Text style={s.emptyText}>
          Clinical trial benchmarks are not yet available for your medication. We'll add them as published data becomes available.
        </Text>
      </View>
    );
  }

  if (result.tooEarly) {
    return (
      <View style={s.card}>
        <Text style={s.title}>Clinical Benchmark</Text>
        <Text style={s.emptyText}>
          Week {result.treatmentWeek} — check back at week 4 for your first comparison against {result.trialName}.
        </Text>
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

  // ── Scrub ───────────────────────────────────────────────────────────────────
  const trialTierData = trialTrajectory.length > 0
    ? (() => {
        const medKey = result.trialLabel.toLowerCase().includes('step') ? 'semaglutide'
          : result.trialLabel.toLowerCase().includes('surmount') ? 'tirzepatide'
          : 'liraglutide';
        const tiers = require('@/constants/scoring').TRIAL_BENCHMARKS[medKey];
        return tiers?.[0]?.data ?? [];
      })()
    : [];

  // userPts for rendering (same as _userPts computed above for the hook)

  // Friendly trial label: use brand name if available, otherwise trial name
  const brandLabel = medicationBrand && medicationBrand !== 'other'
    ? BRAND_DISPLAY_NAMES[medicationBrand].replace('®', '')
    : null;
  const trialDisplayName = brandLabel ? `${brandLabel} Trial` : `${result.trialName} Trial`;

  return (
    <Pressable style={s.card} onLongPress={handleLongPress}>
      {/* Title + week */}
      <View style={s.header}>
        <Text style={s.title}>Clinical Benchmark</Text>
        <Text style={s.weekLabel}>Week {treatmentWeek}</Text>
      </View>

      {/* Two big numbers with divider */}
      <View style={s.statsRow}>
        <View style={s.statBlock}>
          <Text style={s.statValue}>{result.userLossPct}%</Text>
          <Text style={s.statLabel}>YOUR LOSS</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBlock}>
          <Text style={[s.statValue, { color: TRIAL_BLUE }]}>{result.trialLossPct}%</Text>
          <Text style={s.statLabel}>TRIAL AVG</Text>
        </View>
      </View>
      <Text style={s.contextLabel}>% body weight lost at week {treatmentWeek}</Text>

      {/* Status indicator */}
      {status && (
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: status.color }]} />
          <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      )}

      {/* SVG Chart */}
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
                    <Stop offset="0" stopColor={ORANGE} stopOpacity="0.25" />
                    <Stop offset="1" stopColor={ORANGE} stopOpacity="0" />
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
                    stroke={ORANGE}
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}

                {/* User dots */}
                {userPts.slice(0, -1).map((pt, i) => (
                  <Circle key={`dot-${i}`} cx={pt.x} cy={pt.y} r={3} fill={ORANGE} />
                ))}

                {/* Last point — double ring */}
                {lastUserPt && (
                  <>
                    <Circle cx={lastUserPt.x} cy={lastUserPt.y} r={8} fill="rgba(255,116,42,0.2)" />
                    <Circle cx={lastUserPt.x} cy={lastUserPt.y} r={4.5} fill={ORANGE} />
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
                color={ORANGE}
                formatTooltip={tooltipFormatter}
              />
            </>
          )}
        </View>
      </GestureDetector>

      {/* Legend */}
      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={[s.legendLine, { backgroundColor: ORANGE }]} />
          <Text style={s.legendLabel}>You</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendSwatch, { backgroundColor: TRIAL_BLUE, opacity: 0.3 }]} />
          <Text style={s.legendLabel}>{trialDisplayName}</Text>
        </View>
      </View>

      <Text style={s.hint}>Hold to scrub</Text>
    </Pressable>
  );
}

const createStyles = (c: AppColors) => {
  const dim = c.isDark ? 'rgba(255,255,255,' : 'rgba(0,0,0,';
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 20,
      marginBottom: 16,
      ...cardElevation(c.isDark),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
      letterSpacing: 0.3,
      fontFamily: 'System',
    },
    weekLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: `${dim}0.4)`,
      fontFamily: 'System',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    statBlock: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 32,
      fontWeight: '800',
      color: ORANGE,
      letterSpacing: -1,
      fontFamily: 'System',
    },
    statLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: `${dim}0.4)`,
      letterSpacing: 1.5,
      marginTop: 4,
      textTransform: 'uppercase',
      fontFamily: 'System',
    },
    statDivider: {
      width: 1,
      height: 40,
      backgroundColor: `${dim}0.1)`,
    },
    contextLabel: {
      fontSize: 13,
      color: `${dim}0.35)`,
      textAlign: 'center',
      marginBottom: 8,
      fontFamily: 'System',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 15,
      fontWeight: '700',
      fontFamily: 'System',
    },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      marginTop: 10,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendLine: {
      width: 14,
      height: 3,
      borderRadius: 1.5,
    },
    legendSwatch: {
      width: 12,
      height: 8,
      borderRadius: 2,
    },
    legendLabel: {
      fontSize: 13,
      color: `${dim}0.4)`,
      fontFamily: 'System',
    },
    emptyText: {
      fontSize: 15,
      color: `${dim}0.4)`,
      lineHeight: 19,
      marginTop: 8,
      fontFamily: 'System',
    },
    hint: {
      fontSize: 13,
      color: `${dim}0.25)`,
      textAlign: 'center',
      marginTop: 8,
      fontFamily: 'System',
    },
  });
};
