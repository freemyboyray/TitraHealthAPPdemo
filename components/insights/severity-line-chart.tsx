import React from 'react';
import Svg, { Circle, Line, Path, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

import type { AppColors } from '@/constants/theme';
import { SEVERITY_TIERS, severityTier, type SeverityTier } from '@/constants/side-effects';
import { smoothPath } from '@/lib/chart-utils';
import type { DailyPoint } from '@/lib/side-effect-insights';

const FF = 'System';
const PAD_L = 74;   // room for the longest y-axis label ("Moderate") without clipping
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 22;

// Severity is a 3-tier scale, so the y-axis is three discrete rows rather than a
// continuous 0–10. Every logged point snaps to its tier's row — severe logs all
// sit on the same line, etc. — which is exactly what the axis labels promise.
const TIER_FRAC: Record<SeverityTier, number> = { severe: 0.16, moderate: 0.5, mild: 0.84 };
const TIER_ROWS: { tier: SeverityTier; label: string }[] = [
  { tier: 'severe', label: 'Severe' },
  { tier: 'moderate', label: 'Moderate' },
  { tier: 'mild', label: 'Mild' },
];

export type ChartSeries = { points: DailyPoint[]; color: string };

function shortDate(key: string): string {
  const [, m, d] = key.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

/**
 * 30-day severity-over-time chart on a discrete Mild/Moderate/Severe y-axis.
 * Renders one or two series (the second is for cluster overlap). Logged days are
 * dots snapped to their tier row; the line links them in order.
 */
export function SeverityLineChart({
  series, width, height, colors, showArea = false, compact = false,
}: {
  series: ChartSeries[];
  width: number;
  height: number;
  colors: AppColors;
  showArea?: boolean;
  /** Tiny preview: no axis labels/gridlines, minimal padding (for mini overlap). */
  compact?: boolean;
}) {
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  if (width <= 0) return null;

  const padL = compact ? 2 : PAD_L;
  const padR = compact ? 2 : PAD_R;
  const padT = compact ? 3 : PAD_T;
  const padB = compact ? 3 : PAD_B;
  const showAxis = !compact;

  const n = Math.max(2, series[0]?.points.length ?? 2);
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const toX = (i: number) => padL + (i / (n - 1)) * plotW;
  const tierY = (tier: SeverityTier) => padT + TIER_FRAC[tier] * plotH;
  const toY = (worst: number) => tierY(severityTier(worst));
  const baseY = padT + plotH;

  const dateKeys = series[0]?.points.map(p => p.date) ?? [];
  const xLabelIdx = [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <Svg width={width} height={height}>
      <Defs>
        {series.map((s, si) => (
          <LinearGradient key={si} id={`seArea${si}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={s.color} stopOpacity="0.22" />
            <Stop offset="1" stopColor={s.color} stopOpacity="0" />
          </LinearGradient>
        ))}
      </Defs>

      {/* Y-axis: three tier rows with gridline + colored label */}
      {showAxis && TIER_ROWS.map(({ tier, label }) => {
        const y = tierY(tier);
        return (
          <React.Fragment key={tier}>
            <Line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke={w(0.07)} strokeWidth={1} strokeDasharray="3,4" />
            <SvgText
              x={padL - 10} y={y + 3.5}
              fontSize={10.5} fontWeight="600" fill={SEVERITY_TIERS[tier].color}
              textAnchor="end" fontFamily={FF}
            >
              {label}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Series */}
      {series.map((s, si) => {
        const pts = s.points
          .map((p, i) => (p.worst != null ? { x: toX(i), y: toY(p.worst) } : null))
          .filter((p): p is { x: number; y: number } => p != null);
        if (pts.length === 0) return null;
        const line = pts.length >= 2 ? smoothPath(pts) : '';
        const area = showArea && !compact && pts.length >= 2
          ? `${line} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`
          : '';
        const stroke = compact ? 1.8 : 2.4;
        return (
          <React.Fragment key={si}>
            {area ? <Path d={area} fill={`url(#seArea${si})`} /> : null}
            {line ? <Path d={line} stroke={s.color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
            {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={compact ? 1.8 : 3} fill={s.color} />)}
          </React.Fragment>
        );
      })}

      {/* X date labels */}
      {showAxis && xLabelIdx.map((i, k) => (
        dateKeys[i] ? (
          <SvgText
            key={i}
            x={toX(i)} y={height - 6}
            fontSize={10} fill={w(0.4)} fontFamily={FF}
            textAnchor={k === 0 ? 'start' : k === xLabelIdx.length - 1 ? 'end' : 'middle'}
          >
            {shortDate(dateKeys[i])}
          </SvgText>
        ) : null
      ))}
    </Svg>
  );
}
