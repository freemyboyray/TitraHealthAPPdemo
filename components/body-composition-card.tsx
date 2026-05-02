import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import {
  type FatToLeanResult,
  type BodyCompTrendPoint,
  BODY_COMP_STATUS_COLORS,
  BODY_COMP_STATUS_LABELS,
} from '@/lib/body-composition';
import { smoothPath } from '@/lib/chart-utils';

const ORANGE = '#FF742A';
const CHART_H = 120;
const ML = 36;
const MR = 12;
const MT = 8;
const MB = 20;

type Props = {
  result: FatToLeanResult;
  trend: BodyCompTrendPoint[];
};

export function BodyCompositionCard({ result, trend }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const statusColor = BODY_COMP_STATUS_COLORS[result.status];
  const statusLabel = BODY_COMP_STATUS_LABELS[result.status];

  // Chart dimensions
  const chartW = 320;
  const plotW = chartW - ML - MR;
  const plotH = CHART_H - MT - MB;

  // Build chart paths
  const fatPts = trend.filter(p => p.bodyFatPct != null);
  const leanPts = trend.filter(p => p.leanMassLbs != null);

  const fatPath = useMemo(() => {
    if (fatPts.length < 2) return '';
    const minT = new Date(fatPts[0].date).getTime();
    const maxT = new Date(fatPts[fatPts.length - 1].date).getTime();
    const tRange = maxT - minT || 1;
    const vals = fatPts.map(p => p.bodyFatPct!);
    const minV = Math.min(...vals) - 1;
    const maxV = Math.max(...vals) + 1;
    const vRange = maxV - minV || 1;
    const pts = fatPts.map(p => ({
      x: ML + ((new Date(p.date).getTime() - minT) / tRange) * plotW,
      y: MT + plotH - ((p.bodyFatPct! - minV) / vRange) * plotH,
    }));
    return smoothPath(pts);
  }, [fatPts, plotW, plotH]);

  const leanPath = useMemo(() => {
    if (leanPts.length < 2) return '';
    const minT = new Date(leanPts[0].date).getTime();
    const maxT = new Date(leanPts[leanPts.length - 1].date).getTime();
    const tRange = maxT - minT || 1;
    const vals = leanPts.map(p => p.leanMassLbs!);
    const minV = Math.min(...vals) - 2;
    const maxV = Math.max(...vals) + 2;
    const vRange = maxV - minV || 1;
    const pts = leanPts.map(p => ({
      x: ML + ((new Date(p.date).getTime() - minT) / tRange) * plotW,
      y: MT + plotH - ((p.leanMassLbs! - minV) / vRange) * plotH,
    }));
    return smoothPath(pts);
  }, [leanPts, plotW, plotH]);

  const hasTrendChart = fatPts.length >= 2 || leanPts.length >= 2;

  return (
    <View style={s.card}>
      {/* Header */}
      <Text style={s.title}>Body Composition</Text>

      {/* Hero metric */}
      <View style={s.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroValue}>{Math.round(result.fatLossRatio * 100)}%</Text>
          <Text style={s.heroLabel}>of weight lost was fat</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Breakdown */}
      <View style={s.breakdownRow}>
        <View style={s.breakdownItem}>
          <Text style={[s.breakdownValue, { color: '#34C759' }]}>-{result.fatLossLbs.toFixed(1)}</Text>
          <Text style={s.breakdownLabel}>Fat lost (lbs)</Text>
        </View>
        <View style={[s.breakdownDivider, { backgroundColor: w(0.08) }]} />
        <View style={s.breakdownItem}>
          <Text style={[s.breakdownValue, { color: result.leanLossLbs > 0 ? '#FF9500' : '#34C759' }]}>
            {result.leanLossLbs > 0 ? '-' : '+'}{Math.abs(result.leanLossLbs).toFixed(1)}
          </Text>
          <Text style={s.breakdownLabel}>Lean change (lbs)</Text>
        </View>
      </View>

      {/* Trend chart */}
      {hasTrendChart && (
        <View style={{ marginTop: 12 }}>
          <Svg width={chartW} height={CHART_H} viewBox={`0 0 ${chartW} ${CHART_H}`}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
              <Line key={i} x1={ML} y1={MT + f * plotH} x2={ML + plotW} y2={MT + f * plotH}
                stroke={w(0.06)} strokeWidth={1} strokeDasharray="4,4" />
            ))}
            {/* Body fat line */}
            {fatPath ? <Path d={fatPath} stroke={ORANGE} strokeWidth={2} fill="none" /> : null}
            {/* Lean mass line */}
            {leanPath ? <Path d={leanPath} stroke="#64B4FF" strokeWidth={2} fill="none" /> : null}
          </Svg>
          {/* Legend */}
          <View style={s.legendRow}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: ORANGE }]} />
              <Text style={s.legendText}>Body Fat %</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#64B4FF' }]} />
              <Text style={s.legendText}>Lean Mass</Text>
            </View>
          </View>
        </View>
      )}

      {/* Context */}
      <Text style={s.contextText}>
        On GLP-1 medications, 26-40% of weight lost is typically lean mass. Resistance training and adequate protein can improve this ratio.
      </Text>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    card: {
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 20,
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.3,
      marginBottom: 16,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    heroValue: {
      fontSize: 40,
      fontWeight: '800',
      color: ORANGE,
      letterSpacing: -2,
      lineHeight: 44,
    },
    heroLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: w(0.5),
      marginTop: 2,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '700',
    },
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    breakdownItem: {
      flex: 1,
      alignItems: 'center',
    },
    breakdownDivider: {
      width: 1,
      height: 32,
    },
    breakdownValue: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    breakdownLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: w(0.4),
      marginTop: 2,
    },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      marginTop: 6,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 12,
      fontWeight: '500',
      color: w(0.45),
    },
    contextText: {
      fontSize: 13,
      fontWeight: '400',
      color: w(0.4),
      lineHeight: 18,
      marginTop: 14,
    },
  });
};
