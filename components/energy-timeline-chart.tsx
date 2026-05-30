import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Path, Circle, Line, Rect, Text as SvgText,
  Defs, LinearGradient, Stop,
} from 'react-native-svg';
import { GestureDetector } from 'react-native-gesture-handler';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { useChartScrub } from '@/hooks/useChartScrub';
import { ChartScrubOverlay } from '@/components/chart-scrub-overlay';
import { smoothPath } from '@/lib/chart-utils';
import type { EnergyTimelinePoint } from '@/lib/energy-timeline';

const FF = 'System';
const CHART_HEIGHT = 150;
const ML = 32;   // left margin (y-axis labels)
const MR = 12;   // right margin
const MT = 8;    // top margin
const MB = 22;   // bottom margin (x-axis labels)

// Energy color zones matching energyColor() thresholds
const ZONE_GOOD = '#27AE60';
const ZONE_FAIR = '#F6CB45';
const ZONE_LOW = '#E8960C';
const ZONE_CRIT = '#E53E3E';

function energyColor(pct: number): string {
  if (pct >= 70) return ZONE_GOOD;
  if (pct >= 45) return ZONE_FAIR;
  if (pct >= 20) return ZONE_LOW;
  return ZONE_CRIT;
}

type Props = {
  data: EnergyTimelinePoint[];
};

export function EnergyTimelineChart({ data }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [svgWidth, setSvgWidth] = useState(0);

  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  // Map data to SVG coordinates
  const plotW = Math.max(0, svgWidth - ML - MR);
  const plotH = CHART_HEIGHT;

  const toX = (i: number) => ML + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
  const toY = (score: number) => MT + plotH - (score / 100) * plotH;

  const svgPts = useMemo(() => {
    if (svgWidth <= 0 || data.length === 0) return [];
    return data.map((d, i) => ({ x: toX(i), y: toY(d.score) }));
  }, [svgWidth, data]);

  const tooltipFormatter = useCallback((idx: number) => {
    if (idx < 0 || idx >= data.length) return { title: '', subtitle: '' };
    const pt = data[idx];
    return {
      title: `${pt.score}%`,
      subtitle: pt.hourLabel,
      badge: { text: pt.label, color: energyColor(pt.score) },
    };
  }, [data]);

  const scrub = useChartScrub({
    points: svgPts,
    chartWidth: svgWidth,
    marginLeft: ML,
    marginRight: MR,
    mode: 'longpress-only',
    enabled: svgPts.length > 1 && svgWidth > 0,
  });

  const onLayout = (e: LayoutChangeEvent) => setSvgWidth(e.nativeEvent.layout.width);

  const svgH = CHART_HEIGHT + MT + MB;
  const lastPt = svgPts[svgPts.length - 1];
  const curveColor = data.length > 0 ? energyColor(data[data.length - 1].score) : ZONE_GOOD;

  // Build curve + area paths
  const curvePath = svgPts.length >= 2 ? smoothPath(svgPts) : '';
  const areaPath = svgPts.length >= 2
    ? `${curvePath} L ${svgPts[svgPts.length - 1].x} ${toY(0)} L ${svgPts[0].x} ${toY(0)} Z`
    : '';

  // Y-axis ticks
  const yTicks = [0, 25, 50, 75, 100];

  // X-axis labels: show ~5 evenly spaced labels
  const xLabels: { label: string; x: number }[] = useMemo(() => {
    if (data.length <= 1) return data.map((d, i) => ({ label: d.hourLabel, x: toX(i) }));
    const maxLabels = 5;
    const step = Math.max(1, Math.floor((data.length - 1) / (maxLabels - 1)));
    const labels: { label: string; x: number }[] = [];
    for (let i = 0; i < data.length; i += step) {
      labels.push({ label: data[i].hourLabel, x: toX(i) });
    }
    // Always include the last point
    const lastIdx = data.length - 1;
    if (labels[labels.length - 1]?.label !== data[lastIdx].hourLabel) {
      labels.push({ label: data[lastIdx].hourLabel, x: toX(lastIdx) });
    }
    return labels;
  }, [data, svgWidth]);

  // Empty state — nothing to render
  if (data.length < 2) {
    return null;
  }

  // Zone bands (subtle horizontal rects)
  const zones = [
    { min: 0, max: 20, color: ZONE_CRIT },
    { min: 20, max: 45, color: ZONE_LOW },
    { min: 45, max: 70, color: ZONE_FAIR },
    { min: 70, max: 100, color: ZONE_GOOD },
  ];

  return (
    <View style={s.card}>
      <GestureDetector gesture={scrub.gesture}>
        <View onLayout={onLayout} style={{ height: svgH, marginTop: 8 }}>
          {svgWidth > 0 && (
            <>
              <Svg width={svgWidth} height={svgH}>
                <Defs>
                  <LinearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={curveColor} stopOpacity={colors.isDark ? '0.25' : '0.4'} />
                    <Stop offset="1" stopColor={curveColor} stopOpacity={colors.isDark ? '0.02' : '0.05'} />
                  </LinearGradient>
                </Defs>

                {/* Color zone bands */}
                {zones.map(z => (
                  <Rect
                    key={z.min}
                    x={ML}
                    y={toY(z.max)}
                    width={plotW}
                    height={toY(z.min) - toY(z.max)}
                    fill={z.color}
                    opacity={colors.isDark ? 0.06 : 0.12}
                  />
                ))}

                {/* Horizontal grid lines */}
                {yTicks.filter(v => v > 0 && v < 100).map(v => (
                  <Line
                    key={v}
                    x1={ML}
                    y1={toY(v)}
                    x2={ML + plotW}
                    y2={toY(v)}
                    stroke={w(colors.isDark ? 0.08 : 0.15)}
                    strokeWidth={colors.isDark ? 0.5 : 1}
                    strokeDasharray="4,4"
                  />
                ))}

                {/* Y-axis labels */}
                {yTicks.map(v => (
                  <SvgText
                    key={v}
                    x={ML - 6}
                    y={toY(v) + 4}
                    textAnchor="end"
                    fontSize={10}
                    fontFamily={FF}
                    fill={w(colors.isDark ? 0.3 : 0.45)}
                  >
                    {v}
                  </SvgText>
                ))}

                {/* X-axis labels */}
                {xLabels.map((xl, i) => (
                  <SvgText
                    key={i}
                    x={xl.x}
                    y={MT + plotH + MB - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily={FF}
                    fill={w(colors.isDark ? 0.3 : 0.45)}
                  >
                    {xl.label}
                  </SvgText>
                ))}

                {/* Gradient area fill */}
                {areaPath ? (
                  <Path d={areaPath} fill="url(#energyFill)" />
                ) : null}

                {/* Smooth curve */}
                {curvePath ? (
                  <Path
                    d={curvePath}
                    stroke={curveColor}
                    strokeWidth={colors.isDark ? 2.5 : 3}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}

                {/* Current score dot with glow */}
                {lastPt && (
                  <>
                    <Circle cx={lastPt.x} cy={lastPt.y} r={8} fill={curveColor} opacity={0.2} />
                    <Circle cx={lastPt.x} cy={lastPt.y} r={4.5} fill={curveColor} />
                    <Circle
                      cx={lastPt.x}
                      cy={lastPt.y}
                      r={3}
                      fill={colors.isDark ? '#1C1C1E' : '#FFFFFF'}
                    />
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
                color={curveColor}
                formatTooltip={tooltipFormatter}
              />
            </>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    card: {
      borderRadius: 20,
      padding: 20,
      backgroundColor: c.surface,
      ...cardElevation(c.isDark),
      marginBottom: 20,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: w(0.5),
      fontFamily: FF,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    emptyText: {
      fontSize: 14,
      color: w(0.4),
      fontFamily: FF,
      lineHeight: 20,
      marginTop: 8,
    },
  });
};
