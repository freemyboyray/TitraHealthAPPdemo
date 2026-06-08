import React, { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useAppTheme } from '@/contexts/theme-context';
import { smoothPath } from '@/lib/chart-utils';

/**
 * Two 7-day series overlaid on one axis: this week (solid, filled, metric color)
 * and last week (dashed, muted). Built for low-integer counts (side effects per
 * day). Last week is omitted entirely when `previous` is null/absent. Y-axis is
 * shared so the two weeks are directly comparable.
 */
export function DualLineChart({
  current,
  previous,
  labels,
  color,
  height = 132,
}: {
  current: number[];
  previous?: number[] | null;
  labels: string[];
  color: string;
  height?: number;
}) {
  const { colors } = useAppTheme();
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const padX = 6;
  const padTop = 12;
  const padBottom = 8;
  const hasPrev = !!previous && previous.length === 7;

  const maxY = Math.max(1, ...current, ...(hasPrev ? previous! : []));
  const X = (i: number) => padX + (i / 6) * (width - 2 * padX);
  const Y = (v: number) => padTop + (1 - v / maxY) * (height - padTop - padBottom);

  const toPts = (vals: number[]) => vals.map((v, i) => ({ x: X(i), y: Y(v) }));
  const curPts = toPts(current);
  const curLine = smoothPath(curPts);
  const curArea = curLine
    ? `${curLine} L ${X(6)} ${height - padBottom} L ${X(0)} ${height - padBottom} Z`
    : '';
  const prevLine = hasPrev ? smoothPath(toPts(previous!)) : '';
  const gid = `dl-${color.replace('#', '')}`;

  return (
    <View>
      {/* legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: color }} />
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>This week</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: hasPrev ? w(0.3) : w(0.15) }} />
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>
            {hasPrev ? 'Last week' : 'No prior week'}
          </Text>
        </View>
      </View>

      <View onLayout={onLayout} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.2} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {curArea ? <Path d={curArea} fill={`url(#${gid})`} /> : null}
            {prevLine ? (
              <Path d={prevLine} stroke={w(0.3)} strokeWidth={2} fill="none" strokeDasharray="5 5" strokeLinecap="round" />
            ) : null}
            {curLine ? (
              <Path d={curLine} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            {curPts.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={current[i] > 0 ? 3 : 2} fill={current[i] > 0 ? color : w(0.2)} />
            ))}
          </Svg>
        )}
      </View>

      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {labels.map((l, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: w(0.38) }}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}
