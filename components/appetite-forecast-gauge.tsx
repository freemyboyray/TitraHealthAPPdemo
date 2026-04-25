/**
 * OPTION B — "Appetite Gauge" Mockup
 * Single-focus card: bold arc meter showing today's estimated appetite level.
 * Advisory language throughout — "may", "estimated", "based on your medication".
 */
import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import type { ForecastDay, HourBlock } from '@/lib/cycle-intelligence';

// ─── Advisory language ───────────────────────────────────────────────────────

function advisoryHeadline(state: ForecastDay['state']): string {
  switch (state) {
    case 'peak_suppression':     return 'Appetite may be significantly reduced';
    case 'moderate_suppression': return 'Appetite may be lower than usual';
    case 'returning':            return 'Appetite is likely increasing';
    case 'near_baseline':        return 'Appetite may feel close to normal';
  }
}

function advisoryTip(state: ForecastDay['state']): string {
  switch (state) {
    case 'peak_suppression':
      return 'Even without hunger cues, aim for protein-rich meals to protect lean mass.';
    case 'moderate_suppression':
      return 'Good window for your most nutrient-dense meal of the day.';
    case 'returning':
      return 'Hunger signals may be coming back — having balanced meals planned can help.';
    case 'near_baseline':
      return 'Lean on the healthy habits you\'ve built. Your next dose will restart the cycle.';
  }
}

function riskLabel(state: ForecastDay['state']): string {
  switch (state) {
    case 'peak_suppression':     return 'Lower risk of overeating';
    case 'moderate_suppression': return 'Moderate risk of overeating';
    case 'returning':            return 'Higher risk of overeating';
    case 'near_baseline':        return 'Highest risk of overeating';
  }
}

function riskColor(state: ForecastDay['state']): string {
  switch (state) {
    case 'peak_suppression':     return '#27AE60';
    case 'moderate_suppression': return '#D4850A';
    case 'returning':            return '#E67E22';
    case 'near_baseline':        return '#E74C3C';
  }
}

// ─── Arc gauge SVG ───────────────────────────────────────────────────────────

const ARC_SIZE = 180;
const ARC_CX = ARC_SIZE / 2;
const ARC_CY = ARC_SIZE / 2 + 10;
const ARC_R = 72;
const ARC_STROKE = 10;

/** Converts an angle (0 = leftmost, 180 = rightmost) to SVG coords on the arc */
function arcPoint(angleDeg: number): { x: number; y: number } {
  const rad = ((180 + angleDeg) * Math.PI) / 180;
  return {
    x: ARC_CX + ARC_R * Math.cos(rad),
    y: ARC_CY + ARC_R * Math.sin(rad),
  };
}

/** Semi-circle arc path from startAngle to endAngle (0–180) */
function arcPath(startAngle: number, endAngle: number): string {
  const start = arcPoint(startAngle);
  const end = arcPoint(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M${start.x},${start.y} A${ARC_R},${ARC_R} 0 ${largeArc} 1 ${end.x},${end.y}`;
}

type GaugeProps = {
  /** 0 = full suppression (left), 100 = normal appetite (right) */
  appetiteLevel: number;
  stateColor: string;
  isDark: boolean;
};

function GaugeArc({ appetiteLevel, stateColor, isDark }: GaugeProps) {
  // Clamp to 0–100, map to 0–180 degrees
  const clamped = Math.max(0, Math.min(100, appetiteLevel));
  const needleAngle = (clamped / 100) * 180;
  const needlePt = arcPoint(needleAngle);

  const trackColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const labelColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

  return (
    <Svg width={ARC_SIZE} height={ARC_SIZE / 2 + 24} viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE / 2 + 24}`}>
      {/* Track */}
      <Path d={arcPath(0, 180)} fill="none" stroke={trackColor} strokeWidth={ARC_STROKE} strokeLinecap="round" />

      {/* Color segments — green → amber → red */}
      <Path d={arcPath(0, 60)} fill="none" stroke="#27AE60" strokeWidth={ARC_STROKE} strokeLinecap="round" opacity={0.3} />
      <Path d={arcPath(60, 120)} fill="none" stroke="#D4850A" strokeWidth={ARC_STROKE} opacity={0.3} />
      <Path d={arcPath(120, 180)} fill="none" stroke="#E74C3C" strokeWidth={ARC_STROKE} strokeLinecap="round" opacity={0.3} />

      {/* Active fill up to needle */}
      <Path d={arcPath(0, needleAngle)} fill="none" stroke={stateColor} strokeWidth={ARC_STROKE} strokeLinecap="round" />

      {/* Needle dot */}
      <Circle cx={needlePt.x} cy={needlePt.y} r={8} fill={stateColor} />
      <Circle cx={needlePt.x} cy={needlePt.y} r={4} fill={colors.isDark ? '#FFFFFF' : '#1A1D26'} />

      {/* Labels */}
      <SvgText x={ARC_CX - ARC_R - 2} y={ARC_CY + 16} fill={labelColor} fontSize={9} fontFamily="Inter_400Regular" textAnchor="middle">
        Suppressed
      </SvgText>
      <SvgText x={ARC_CX + ARC_R + 2} y={ARC_CY + 16} fill={labelColor} fontSize={9} fontFamily="Inter_400Regular" textAnchor="middle">
        Normal
      </SvgText>
    </Svg>
  );
}

// ─── Mini cycle strip (collapsed) ────────────────────────────────────────────

function MiniCycleStrip({
  forecastDays,
  isDark,
}: { forecastDays: ForecastDay[]; isDark: boolean }) {
  const trackColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const todayIdx = forecastDays.findIndex(d => d.isToday);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8 }}>
      {forecastDays.map((d, i) => {
        const color = riskColor(d.state);
        const isActive = i === todayIdx;
        return (
          <View
            key={d.cycleDay}
            style={{
              flex: 1,
              height: isActive ? 8 : 5,
              borderRadius: 4,
              backgroundColor: isActive ? color : trackColor,
              opacity: isActive ? 1 : 0.6,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type Props = {
  forecastDays: ForecastDay[];
  drugName: string;
  hourBlocks?: HourBlock[];
  injFreqDays?: number;
};

export function AppetiteForecastGauge({
  forecastDays,
  drugName,
  hourBlocks,
  injFreqDays = 7,
}: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [showCycle, setShowCycle] = useState(false);

  const todayDay = forecastDays.find(d => d.isToday) ?? null;

  // For intraday mode, use current hour block
  const currentBlock = hourBlocks?.find(b => b.isCurrent) ?? null;

  // Determine appetite level 0–100 (0 = fully suppressed, 100 = normal)
  const appetiteLevel = currentBlock
    ? 100 - currentBlock.appetiteSuppressionPct
    : todayDay
      ? 100 - todayDay.appetiteSuppressionPct
      : 50;

  const state: ForecastDay['state'] = todayDay?.state ?? 'moderate_suppression';
  const color = riskColor(state);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (forecastDays.length === 0 && (!hourBlocks || hourBlocks.length === 0)) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Estimated Appetite</Text>
        </View>
        <Text style={s.emptyBody}>
          Log your first injection to see your estimated appetite gauge.
        </Text>
        <Text style={s.disclaimer}>
          Based on {drugName}'s pharmacokinetic profile. Individual experience may vary.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Estimated Appetite</Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>DAY {todayDay?.cycleDay ?? '—'}</Text>
        </View>
      </View>

      {/* Gauge */}
      <View style={s.gaugeWrap}>
        <GaugeArc
          appetiteLevel={appetiteLevel}
          stateColor={color}
          isDark={colors.isDark}
        />
        {/* Center value */}
        <View style={s.gaugeCenter}>
          <Text style={[s.gaugeValue, { color }]}>
            {todayDay?.appetiteSuppressionPct ?? currentBlock?.appetiteSuppressionPct ?? '—'}%
          </Text>
          <Text style={s.gaugeLabel}>estimated{'\n'}suppression</Text>
        </View>
      </View>

      {/* Risk label */}
      <View style={[s.riskPill, { backgroundColor: color + '18' }]}>
        <View style={[s.riskDot, { backgroundColor: color }]} />
        <Text style={[s.riskText, { color }]}>{riskLabel(state)}</Text>
      </View>

      {/* Advisory tip */}
      <Text style={s.advisoryHeadline}>{advisoryHeadline(state)}</Text>
      <Text style={s.advisoryTip}>{advisoryTip(state)}</Text>

      {/* Mini cycle strip */}
      {forecastDays.length > 0 && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowCycle(e => !e);
          }}
        >
          <View style={s.cycleToggle}>
            <Text style={s.cycleToggleText}>
              {showCycle ? 'Hide full cycle' : `See full ${injFreqDays}-day cycle`}
            </Text>
          </View>
          {showCycle && (
            <View style={s.cycleDetail}>
              <MiniCycleStrip forecastDays={forecastDays} isDark={colors.isDark} />
              <View style={s.cycleLabels}>
                <Text style={s.cycleLabelText}>💉 Shot day</Text>
                <Text style={s.cycleLabelText}>Day {forecastDays.length}</Text>
              </View>
              {forecastDays.filter(d => !d.isToday).map(d => (
                <View key={d.cycleDay} style={s.cycleDayRow}>
                  <Text style={s.cycleDayNum}>D{d.cycleDay}</Text>
                  <View style={[s.cycleDayBar, { backgroundColor: riskColor(d.state) + '30', width: `${Math.max(20, d.appetiteSuppressionPct)}%` }]}>
                    <Text style={s.cycleDayBarText}>{advisoryHeadline(d.state).replace('Appetite ', '')}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Pressable>
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: 'Inter_700Bold',
    },
    badge: {
      backgroundColor: 'rgba(255,116,42,0.12)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FF742A',
      fontFamily: 'Inter_400Regular',
      letterSpacing: 0.5,
    },
    gaugeWrap: {
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 4,
    },
    gaugeCenter: {
      position: 'absolute',
      bottom: 8,
      alignItems: 'center',
    },
    gaugeValue: {
      fontSize: 28,
      fontWeight: '800',
      fontFamily: 'Inter_400Regular',
    },
    gaugeLabel: {
      fontSize: 10,
      color: w(0.35),
      fontFamily: 'Inter_400Regular',
      textAlign: 'center',
      lineHeight: 13,
    },
    riskPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
      marginBottom: 12,
    },
    riskDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    riskText: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: 'Inter_400Regular',
    },
    advisoryHeadline: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textPrimary,
      fontFamily: 'Inter_400Regular',
      textAlign: 'center',
      marginBottom: 4,
    },
    advisoryTip: {
      fontSize: 13,
      color: c.textSecondary,
      fontFamily: 'Inter_400Regular',
      textAlign: 'center',
      lineHeight: 18,
    },
    cycleToggle: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      alignItems: 'center',
    },
    cycleToggleText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FF742A',
      fontFamily: 'Inter_400Regular',
    },
    cycleDetail: {
      marginTop: 8,
      gap: 6,
    },
    cycleLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    cycleLabelText: {
      fontSize: 9,
      color: w(0.3),
      fontFamily: 'Inter_400Regular',
    },
    cycleDayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cycleDayNum: {
      fontSize: 10,
      fontWeight: '700',
      color: w(0.4),
      fontFamily: 'Inter_400Regular',
      width: 22,
    },
    cycleDayBar: {
      height: 22,
      borderRadius: 6,
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    cycleDayBarText: {
      fontSize: 10,
      color: c.textPrimary,
      fontFamily: 'Inter_400Regular',
      fontWeight: '500',
    },
    disclaimer: {
      fontSize: 10,
      color: w(0.25),
      fontFamily: 'Inter_400Regular',
      textAlign: 'center',
      marginTop: 14,
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
