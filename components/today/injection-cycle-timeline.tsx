import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText, type TextAnchor } from 'react-native-svg';

import type { AppColors } from '@/constants/theme';
import { cycleDisplayDay, type ShotPhase } from '@/constants/scoring';

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

// The arc spans 180° (left, 9 o'clock) → 0° (right, 3 o'clock) across the top.
// Position along the arc is a cycle *fraction* (0 = shot day, 1 = next dose due),
// so both the phase segments and the progress dot scale with the real cycle length.
function fracToAngle(frac: number): number {
  const f = Math.max(0, Math.min(1, frac));
  return 180 - f * 180;
}

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

// Phase boundaries as cumulative cycle fractions, scaled to the cycle length.
// Mirrors getShotPhase() in constants/scoring.ts so the colored segments line up
// with where the phase label actually flips (shot ≈15%, peak ≈50%, balance ≈85%,
// reset = remainder). Returns [shotStart, peakStart, balanceStart, resetStart, end].
function phaseBoundaryFracs(freq: number): number[] {
  if (freq <= 0) return [0, 0.15, 0.5, 0.85, 1];
  const shotEnd = Math.max(1, Math.round(freq * 0.15));
  const peakEnd = Math.max(2, Math.round(freq * 0.5));
  const balanceEnd = Math.max(3, Math.round(freq * 0.85));
  return [0, shotEnd / freq, peakEnd / freq, balanceEnd / freq, 1];
}

// Text anchor per phase so side labels extend away from the arc
const LABEL_ANCHORS: Record<ShotPhase, TextAnchor> = {
  shot: 'end', peak: 'middle', balance: 'middle', reset: 'start',
};

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
  // Cycle-day label — shared helper so the gauge, vertical timeline, and
  // cycle-phase hero never drift. See cycleDisplayDay in constants/scoring.ts.
  const displayDay = cycleDisplayDay(todayDayNum, freq);
  const currentIdx = getPhaseIndex(shotPhase);
  const phaseColor = PHASE_COLORS[shotPhase];
  const s = useMemo(() => createStyles(colors), [colors]);

  // Phase segment boundaries (cycle fractions), scaled to the real cycle length.
  const boundaries = useMemo(() => phaseBoundaryFracs(freq), [freq]);

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

  // Progress dot — continuous along the arc based on the real day in the cycle
  // (0 = shot day at far left, 1 = next dose due at far right), not snapped to
  // phase boundaries. todayDayNum is days elapsed since the shot.
  const progress = freq > 0 ? Math.max(0, Math.min(1, todayDayNum / freq)) : 0;
  const dot = polarToXY(ARC_CX, ARC_CY, ARC_R, fracToAngle(progress));

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

          {/* Phase segments — widths scale with the cycle length */}
          {PHASE_ORDER.map((phase, i) => {
            const startAngle = fracToAngle(boundaries[i]);
            const endAngle = fracToAngle(boundaries[i + 1]);
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
            const midFrac = (boundaries[i] + boundaries[i + 1]) / 2;
            const pos = polarToXY(ARC_CX, ARC_CY, ARC_R + 22, fracToAngle(midFrac));
            return (
              <SvgText
                key={phase}
                x={pos.x}
                y={pos.y}
                fill={isCurrent ? PHASE_COLORS[phase] : mutedText}
                fontSize={9}
                fontWeight={isCurrent ? '700' : '400'}
                fontFamily={FF}
                textAnchor={LABEL_ANCHORS[phase]}
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
