import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import type { AppColors } from '@/constants/theme';
import type { ShotPhase } from '@/constants/scoring';

const FF = 'System';

const PHASE_COLORS: Record<ShotPhase, string> = {
  shot: '#FF742A', peak: '#27AE60', balance: '#3B9AE1', reset: '#F5A623',
};

const PHASE_LABELS: Record<ShotPhase, string> = {
  shot: 'Shot Day', peak: 'Peak', balance: 'Balance', reset: 'Reset',
};

const PHASE_ORDER: ShotPhase[] = ['shot', 'peak', 'balance', 'reset'];

// ── Semicircle geometry ──
// Arc goes from left (9 o'clock) to right (3 o'clock) across the top.
// SVG viewBox is 280 x 160.
const ARC_CX = 170;
const ARC_CY = 140;
const ARC_R = 110;
const ARC_STROKE = 12;

// Phase angles (in degrees, 0 = 3 o'clock, going counter-clockwise for the top arc)
// We define the arc from 180° (left) to 0° (right) = 180° total
// Phase spans: Shot 30°, Peak 60°, Balance 60°, Reset 30°
const PHASE_SPANS = [30, 60, 60, 30]; // degrees per phase
const PHASE_START_ANGLES = [180, 150, 90, 30]; // start angle for each phase

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToXY(cx, cy, r, startDeg);
  const end = polarToXY(cx, cy, r, endDeg);
  const sweep = startDeg - endDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${sweep} 1 ${end.x} ${end.y}`;
}

// Label positions — midpoint of each arc segment, offset outward slightly
function labelPos(phaseIdx: number) {
  const midAngle = PHASE_START_ANGLES[phaseIdx] - PHASE_SPANS[phaseIdx] / 2;
  return polarToXY(ARC_CX, ARC_CY, ARC_R + 18, midAngle);
}

// Dot position — at the boundary between current phase and the next
function currentDotPos(phaseIdx: number) {
  const endAngle = PHASE_START_ANGLES[phaseIdx] - PHASE_SPANS[phaseIdx];
  return polarToXY(ARC_CX, ARC_CY, ARC_R, endAngle);
}

type Props = {
  todayDayNum: number;
  freq: number;
  shotPhase: ShotPhase;
  rawDaysUntil: number | null;
  todayInjLogged: boolean;
  oral: boolean;
  colors: AppColors;
  treatmentDisplayVal: string | null;
  treatmentDisplayLbl: string;
  weightDelta: number | null;
  stat3Val: string;
  stat3Lbl: string;
  /** Hide the shot-phase semicircle arc — used for daily/oral drugs that have no
   *  injection cycle, while still showing the progress stats row below. */
  hideArc?: boolean;
};

function getPhaseIndex(phase: ShotPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function InjectionCycleTimeline({
  todayDayNum,
  freq,
  shotPhase,
  rawDaysUntil,
  todayInjLogged,
  oral,
  colors,
  treatmentDisplayVal,
  treatmentDisplayLbl,
  weightDelta,
  stat3Val,
  stat3Lbl,
  hideArc = false,
}: Props) {
  const displayDay = todayDayNum === 0 ? 1 : todayDayNum;
  const currentIdx = getPhaseIndex(shotPhase);
  const phaseColor = PHASE_COLORS[shotPhase];
  const s = useMemo(() => createStyles(colors), [colors]);

  const isOverdue = !todayInjLogged && rawDaysUntil != null && rawDaysUntil < 0;
  const isShotDay = !todayInjLogged && rawDaysUntil === 0;

  const nextDoseText = todayInjLogged
    ? (oral ? 'Dosed today' : 'Injected today')
    : rawDaysUntil == null
      ? ''
      : rawDaysUntil < 0
        ? 'Overdue'
        : rawDaysUntil === 0
          ? (oral ? 'Dose day' : 'Shot day')
          : rawDaysUntil === 1
            ? 'Tomorrow'
            : `In ${rawDaysUntil} days`;

  const nextDoseColor = isOverdue
    ? '#E74C3C'
    : isShotDay ? '#FF742A'
    : todayInjLogged ? '#27AE60'
    : colors.textSecondary;

  // ── Stats ──
  const weightVal = weightDelta != null
    ? `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)}`
    : '—';
  const weightColor = weightDelta != null
    ? (weightDelta <= 0 ? '#27AE60' : '#E53E3E')
    : colors.textPrimary;

  const trackColor = colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const mutedText = colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
  const dividerColor = colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  // Current phase dot position
  const dot = currentDotPos(currentIdx);

  return (
    <View style={s.container}>
      {/* Semicircle arc gauge — hidden for daily/oral drugs (no injection cycle) */}
      {!hideArc && (
      <View style={s.arcContainer}>
        <Svg width="100%" height={160} viewBox="0 0 340 160">
          {/* Background track */}
          <Path
            d={arcPath(ARC_CX, ARC_CY, ARC_R, 180, 0)}
            fill="none"
            stroke={trackColor}
            strokeWidth={ARC_STROKE}
            strokeLinecap="round"
          />

          {/* Phase segments */}
          {PHASE_ORDER.map((phase, i) => {
            const startAngle = PHASE_START_ANGLES[i];
            const endAngle = startAngle - PHASE_SPANS[i];
            const isPast = i < currentIdx;
            const isCurrent = i === currentIdx;
            const opacity = isPast || isCurrent ? 0.85 : 0.15;

            return (
              <Path
                key={phase}
                d={arcPath(ARC_CX, ARC_CY, ARC_R, startAngle, endAngle)}
                fill="none"
                stroke={PHASE_COLORS[phase]}
                strokeWidth={ARC_STROKE}
                strokeLinecap="round"
                opacity={opacity}
              />
            );
          })}

          {/* Current position dot with glow */}
          <Circle cx={dot.x} cy={dot.y} r={14} fill={phaseColor} opacity={0.2} />
          <Circle cx={dot.x} cy={dot.y} r={8} fill={phaseColor} />

          {/* Phase labels along the arc */}
          {PHASE_ORDER.map((phase, i) => {
            const isCurrent = i === currentIdx;
            const pos = labelPos(i);
            return (
              <SvgText
                key={phase}
                x={pos.x}
                y={pos.y}
                fill={isCurrent ? PHASE_COLORS[phase] : mutedText}
                fontSize={9}
                fontWeight={isCurrent ? '700' : '400'}
                fontFamily={FF}
                textAnchor="middle"
              >
                {PHASE_LABELS[phase]}
              </SvgText>
            );
          })}
        </Svg>

        {/* Phase name + day count centered below arc */}
        <View style={s.centerContent}>
          <Text style={[s.phaseNameLarge, { color: phaseColor }]}>
            {PHASE_LABELS[shotPhase]}
          </Text>
          <Text style={s.dayCountText}>
            Day {displayDay} of {freq}
            {nextDoseText ? (
              <Text style={{ color: nextDoseColor }}>{' · '}{nextDoseText}</Text>
            ) : null}
          </Text>
        </View>
      </View>
      )}

      {/* Stats row */}
      <View style={[s.statsRow, hideArc ? { borderTopWidth: 0, paddingTop: 4 } : { borderTopColor: dividerColor }]}>
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: colors.textPrimary }]}>
            {treatmentDisplayVal ?? '—'}
          </Text>
          <Text style={[s.statLabel, { color: mutedText }]}>{treatmentDisplayLbl}</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: dividerColor }]} />
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: weightColor }]}>
            {weightVal}
          </Text>
          <Text style={[s.statLabel, { color: mutedText }]}>lbs</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: dividerColor }]} />
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: colors.textPrimary }]}>
            {stat3Val}
          </Text>
          <Text style={[s.statLabel, { color: mutedText }]}>{stat3Lbl}</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    container: {
      paddingTop: 8,
      paddingBottom: 12,
      paddingHorizontal: 16,
    },
    arcContainer: {
      alignItems: 'center',
      marginBottom: 4,
    },
    centerContent: {
      alignItems: 'center',
      marginTop: -40,
      marginBottom: 8,
    },
    phaseNameLarge: {
      fontSize: 22,
      fontWeight: '800',
      fontFamily: FF,
      letterSpacing: -0.3,
    },
    dayCountText: {
      fontSize: 12,
      fontWeight: '500',
      color: c.textSecondary,
      fontFamily: FF,
      marginTop: 3,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 4,
      borderTopWidth: 1,
      marginHorizontal: 4,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statDivider: {
      width: 1,
      height: 28,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
      fontFamily: FF,
      lineHeight: 24,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '400',
      fontFamily: FF,
      marginTop: 3,
      textAlign: 'center',
    },
  });
