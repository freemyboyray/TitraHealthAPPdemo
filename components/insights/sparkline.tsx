import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { smoothPath } from '@/lib/chart-utils';

/**
 * Tiny line + area sparkline for the right side of a HealthSummaryCard.
 * Mirrors the metric's full detail graph. Renders nothing meaningful when
 * there are fewer than two data points.
 */
export function Sparkline({
  values,
  color,
  width = 88,
  height = 44,
}: {
  values: (number | null)[];
  color: string;
  width?: number;
  height?: number;
}) {
  const pad = 3;
  const pts = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v != null);

  if (pts.length < 2) {
    return <View style={{ width, height }} />;
  }

  const xSpan = values.length - 1 || 1;
  const vals = pts.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;

  const X = (i: number) => pad + (i / xSpan) * (width - pad * 2);
  const Y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);

  const coords = pts.map((p) => ({ x: X(p.i), y: Y(p.v) }));
  const line = smoothPath(coords);
  const last = coords[coords.length - 1];
  const first = coords[0];
  const area = `${line} L ${last.x} ${height - pad} L ${first.x} ${height - pad} Z`;
  const gid = `spark-${color.replace('#', '')}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#${gid})`} />
      <Path
        d={line}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={last.x} cy={last.y} r={2.8} fill={color} />
    </Svg>
  );
}
