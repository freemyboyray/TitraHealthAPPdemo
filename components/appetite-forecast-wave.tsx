/**
 * OPTION A — "Appetite Wave" Mockup
 * Smooth SVG area chart showing estimated appetite across the injection cycle.
 * Advisory language: "may", "estimated", "based on your medication schedule".
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Line, Circle, Rect, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import type { ForecastDay, HourBlock } from '@/lib/cycle-intelligence';

// ─── Advisory language helpers ───────────────────────────────────────────────

function advisoryLabel(state: ForecastDay['state']): string {
  switch (state) {
    case 'peak_suppression':     return 'Appetite may be noticeably reduced';
    case 'moderate_suppression': return 'Appetite may be lower than usual';
    case 'returning':            return 'Appetite is likely returning';
    case 'near_baseline':        return 'Appetite may feel closer to normal';
  }
}

function advisoryTip(state: ForecastDay['state']): string {
  switch (state) {
    case 'peak_suppression':
      return 'Even if you don\'t feel hungry, try to get protein in. Small, frequent meals can help.';
    case 'moderate_suppression':
      return 'Good window for your highest-protein meal of the day.';
    case 'returning':
      return 'You may notice hunger returning — plan satisfying, balanced meals.';
    case 'near_baseline':
      return 'Hunger may feel normal today. Lean on the habits you\'ve been building.';
  }
}

function advisoryPhaseLabel(phase: HourBlock['phase']): string {
  switch (phase) {
    case 'peak':      return 'Appetite may be at its lowest right now';
    case 'post_dose': return 'Medication absorbing — appetite may start to decrease';
    case 'trough':    return 'Medication levels are lower — appetite may feel more normal';
  }
}

// ─── SVG Wave helpers ────────────────────────────────────────────────────────

const CHART_W = 320;
const CHART_H = 100;
const CHART_PAD_L = 0;
const CHART_PAD_R = 0;
const CHART_PAD_T = 10;
const CHART_PAD_B = 20;
const PLOT_W = CHART_W - CHART_PAD_L - CHART_PAD_R;
const PLOT_H = CHART_H - CHART_PAD_T - CHART_PAD_B;

/** Monotone cubic interpolation — produces a smooth path through points */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;
  }

  const n = points.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];
  const tangents: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    dy.push(points[i + 1].y - points[i].y);
    m.push(dy[i] / dx[i]);
  }

  tangents.push(m[0]);
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents.push(0);
    } else {
      tangents.push((m[i - 1] + m[i]) / 2);
    }
  }
  tangents.push(m[n - 2]);

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + dx[i] / 3;
    const cp1y = p0.y + tangents[i] * dx[i] / 3;
    const cp2x = p1.x - dx[i] / 3;
    const cp2y = p1.y - tangents[i + 1] * dx[i] / 3;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }
  return d;
}

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  forecastDays: ForecastDay[];
  drugName: string;
  hourBlocks?: HourBlock[];
  injFreqDays?: number;
};

export function AppetiteForecastWave({
  forecastDays,
  drugName,
  hourBlocks,
  injFreqDays = 7,
}: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // ── Intraday mode ──────────────────────────────────────────────────────────
  if (hourBlocks && hourBlocks.length > 0) {
    const currentIdx = hourBlocks.findIndex(b => b.isCurrent);
    const activeIdx = selectedIdx ?? currentIdx;
    const activeBlock = hourBlocks[activeIdx] ?? hourBlocks[currentIdx];

    const points = hourBlocks.map((b, i) => ({
      x: CHART_PAD_L + (i / (hourBlocks.length - 1)) * PLOT_W,
      y: CHART_PAD_T + PLOT_H - (b.appetiteSuppressionPct / 70) * PLOT_H,
    }));
    const linePath = smoothPath(points);
    const areaPath = linePath
      + ` L${points[points.length - 1].x},${CHART_PAD_T + PLOT_H}`
      + ` L${points[0].x},${CHART_PAD_T + PLOT_H} Z`;

    const markerPt = points[activeIdx] ?? points[currentIdx];

    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Estimated Appetite</Text>
          <Text style={s.subtitle}>Today's estimate based on {drugName}</Text>
        </View>

        {/* Wave chart */}
        <View style={s.chartWrap}>
          <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#FF742A" stopOpacity={0.35} />
                <Stop offset="100%" stopColor="#FF742A" stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            <Path d={areaPath} fill="url(#waveGrad)" />
            <Path d={linePath} fill="none" stroke="#FF742A" strokeWidth={2.5} strokeLinecap="round" />

            {/* Today marker */}
            {markerPt && (
              <>
                <Line
                  x1={markerPt.x} y1={CHART_PAD_T}
                  x2={markerPt.x} y2={CHART_PAD_T + PLOT_H}
                  stroke={colors.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'} strokeWidth={1} strokeDasharray="3,3"
                />
                <Circle cx={markerPt.x} cy={markerPt.y} r={6} fill="#FF742A" />
                <Circle cx={markerPt.x} cy={markerPt.y} r={3} fill={colors.isDark ? '#FFFFFF' : '#1A1D26'} />
              </>
            )}

            {/* X-axis labels */}
            {hourBlocks.map((b, i) => (
              <SvgText
                key={i}
                x={CHART_PAD_L + (i / (hourBlocks.length - 1)) * PLOT_W}
                y={CHART_H - 2}
                fill={colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                fontSize={9}
                fontFamily="Inter_400Regular"
                textAnchor="middle"
              >
                {b.label}
              </SvgText>
            ))}
          </Svg>

          {/* Invisible touch targets */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-only">
            {hourBlocks.map((b, i) => (
              <Pressable
                key={i}
                style={{
                  position: 'absolute',
                  left: `${(i / hourBlocks.length) * 100}%`,
                  width: `${100 / hourBlocks.length}%`,
                  top: 0,
                  bottom: 0,
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedIdx(prev => prev === i ? null : i);
                }}
              />
            ))}
          </View>
        </View>

        {/* Advisory card */}
        {activeBlock && (
          <View style={s.advisoryCard}>
            <View style={s.advisoryRow}>
              <View style={[s.advisoryDot, { backgroundColor: '#FF742A' }]} />
              <Text style={s.advisoryLabel}>
                {activeBlock.isCurrent ? 'Right now' : activeBlock.label}
              </Text>
            </View>
            <Text style={s.advisoryHeadline}>{advisoryPhaseLabel(activeBlock.phase)}</Text>
            <Text style={s.advisoryDetail}>
              Estimated ~{activeBlock.appetiteSuppressionPct}% below your usual appetite
            </Text>
          </View>
        )}

        <Text style={s.disclaimer}>
          Estimates based on {drugName}'s pharmacokinetic profile. Individual experience may vary.
        </Text>
      </View>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (forecastDays.length === 0) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Estimated Appetite</Text>
          <Text style={s.subtitle}>{injFreqDays}-day cycle</Text>
        </View>
        <Text style={s.emptyBody}>
          Log your first injection to see your estimated appetite curve.
        </Text>
        <Text style={s.disclaimer}>
          Based on {drugName}'s pharmacokinetic profile. Individual experience may vary.
        </Text>
      </View>
    );
  }

  // ── Multi-day cycle mode ───────────────────────────────────────────────────
  const todayIdx = forecastDays.findIndex(d => d.isToday);
  const activeIdx = selectedIdx ?? todayIdx;
  const activeDay = forecastDays[activeIdx] ?? forecastDays[todayIdx];

  // Build smooth curve points (appetite suppression → inverted for "appetite level")
  const maxSupp = 70; // normalization ceiling
  const points = forecastDays.map((d, i) => ({
    x: CHART_PAD_L + (i / (forecastDays.length - 1)) * PLOT_W,
    // Higher suppression → lower Y → lower on chart → visually "less appetite"
    y: CHART_PAD_T + PLOT_H - (d.appetiteSuppressionPct / maxSupp) * PLOT_H,
  }));
  const linePath = smoothPath(points);
  const areaPath = linePath
    + ` L${points[points.length - 1].x},${CHART_PAD_T + PLOT_H}`
    + ` L${points[0].x},${CHART_PAD_T + PLOT_H} Z`;

  const markerPt = points[activeIdx] ?? points[todayIdx];

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Estimated Appetite</Text>
        <Text style={s.subtitle}>{injFreqDays}-day cycle estimate</Text>
      </View>

      {/* Wave chart */}
      <View style={s.chartWrap}>
        <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FF742A" stopOpacity={0.35} />
              <Stop offset="100%" stopColor="#FF742A" stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          {/* Area fill */}
          <Path d={areaPath} fill="url(#waveGrad)" />
          {/* Curve line */}
          <Path d={linePath} fill="none" stroke="#FF742A" strokeWidth={2.5} strokeLinecap="round" />

          {/* Y-axis hints */}
          <SvgText x={4} y={CHART_PAD_T + 10} fill={colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'} fontSize={8} fontFamily="Inter_400Regular">
            More suppressed
          </SvgText>
          <SvgText x={4} y={CHART_PAD_T + PLOT_H - 4} fill={colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'} fontSize={8} fontFamily="Inter_400Regular">
            Less suppressed
          </SvgText>

          {/* Today vertical marker */}
          {markerPt && (
            <>
              <Line
                x1={markerPt.x} y1={CHART_PAD_T}
                x2={markerPt.x} y2={CHART_PAD_T + PLOT_H}
                stroke={colors.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'} strokeWidth={1} strokeDasharray="3,3"
              />
              <Circle cx={markerPt.x} cy={markerPt.y} r={6} fill="#FF742A" />
              <Circle cx={markerPt.x} cy={markerPt.y} r={3} fill={colors.isDark ? '#FFFFFF' : '#1A1D26'} />
            </>
          )}

          {/* Shot day marker */}
          {forecastDays[0] && (
            <SvgText
              x={CHART_PAD_L + 2}
              y={CHART_H - 2}
              fill="#FF742A"
              fontSize={9}
              fontWeight="700"
              fontFamily="Inter_400Regular"
            >
              💉
            </SvgText>
          )}

          {/* X-axis day labels */}
          {forecastDays.map((d, i) => (
            <SvgText
              key={d.cycleDay}
              x={CHART_PAD_L + (i / (forecastDays.length - 1)) * PLOT_W}
              y={CHART_H - 2}
              fill={d.isToday
                ? '#FF742A'
                : colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              fontSize={9}
              fontWeight={d.isToday ? '700' : '400'}
              fontFamily="Inter_400Regular"
              textAnchor="middle"
            >
              {d.isToday ? 'TODAY' : `D${d.cycleDay}`}
            </SvgText>
          ))}
        </Svg>

        {/* Invisible touch targets for each day */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-only">
          {forecastDays.map((d, i) => (
            <Pressable
              key={d.cycleDay}
              style={{
                position: 'absolute',
                left: `${(i / forecastDays.length) * 100}%`,
                width: `${100 / forecastDays.length}%`,
                top: 0,
                bottom: 0,
              }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedIdx(prev => prev === i ? null : i);
              }}
            />
          ))}
        </View>
      </View>

      {/* Advisory card below chart */}
      {activeDay && (
        <View style={s.advisoryCard}>
          <View style={s.advisoryRow}>
            <View style={[s.advisoryDot, { backgroundColor: '#FF742A' }]} />
            <Text style={s.advisoryLabel}>
              {activeDay.isToday ? 'Today — Day ' + activeDay.cycleDay : 'Day ' + activeDay.cycleDay}
            </Text>
            {activeDay.isProjected && (
              <Text style={s.projectedBadge}>ESTIMATE</Text>
            )}
          </View>
          <Text style={s.advisoryHeadline}>{advisoryLabel(activeDay.state)}</Text>
          <Text style={s.advisoryDetail}>
            Estimated ~{activeDay.appetiteSuppressionPct}% below your usual appetite
          </Text>
          <Text style={s.advisoryTip}>{advisoryTip(activeDay.state)}</Text>
        </View>
      )}

      <Text style={s.disclaimer}>
        Estimates based on {drugName}'s pharmacokinetic profile. Individual experience may vary.
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    container: {
      marginBottom: 16,
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 18,
      ...cardElevation(c.isDark),
    },
    header: {
      marginBottom: 14,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: 'Inter_700Bold',
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 12,
      color: w(0.4),
      fontFamily: 'Inter_400Regular',
    },
    chartWrap: {
      height: CHART_H,
      marginBottom: 12,
      marginHorizontal: -4,
    },
    advisoryCard: {
      backgroundColor: c.isDark ? 'rgba(255,116,42,0.08)' : 'rgba(255,116,42,0.06)',
      borderRadius: 16,
      padding: 14,
      gap: 6,
    },
    advisoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    advisoryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    advisoryLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: 'Inter_400Regular',
    },
    projectedBadge: {
      fontSize: 9,
      fontWeight: '700',
      color: '#FF742A',
      backgroundColor: 'rgba(255,116,42,0.15)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      overflow: 'hidden',
      letterSpacing: 0.5,
      fontFamily: 'Inter_400Regular',
    },
    advisoryHeadline: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textPrimary,
      fontFamily: 'Inter_400Regular',
    },
    advisoryDetail: {
      fontSize: 12,
      color: w(0.5),
      fontFamily: 'Inter_400Regular',
      fontStyle: 'italic',
    },
    advisoryTip: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 18,
      fontFamily: 'Inter_400Regular',
      marginTop: 2,
    },
    disclaimer: {
      fontSize: 10,
      color: w(0.25),
      fontFamily: 'Inter_400Regular',
      textAlign: 'center',
      marginTop: 12,
      lineHeight: 14,
    },
    emptyBody: {
      fontSize: 13,
      color: w(0.6),
      fontFamily: 'Inter_400Regular',
      lineHeight: 19,
      marginBottom: 8,
    },
  });
};
