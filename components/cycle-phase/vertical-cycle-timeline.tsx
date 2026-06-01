import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { AppColors } from '@/constants/theme';
import type { ShotPhase } from '@/constants/scoring';

const FF = 'System';

const PHASE_COLORS: Record<ShotPhase, string> = {
  shot: '#FF742A', peak: '#27AE60', balance: '#3B9AE1', reset: '#F5A623',
};

const PHASE_LABELS: Record<ShotPhase, string> = {
  shot: 'Shot Day', peak: 'Peak', balance: 'Balance', reset: 'Reset',
};

const PHASE_DESCRIPTIONS: Record<ShotPhase, string> = {
  shot: 'Medication absorbing',
  peak: 'Strongest appetite suppression',
  balance: 'Stable medication levels',
  reset: 'Levels tapering off',
};

const PHASE_ORDER: ShotPhase[] = ['shot', 'peak', 'balance', 'reset'];

// ── Vertical S-curve geometry ──
// The SVG is 120px wide × TIMELINE_H tall.
// The curved line snakes left→right with 5 nodes (4 phases + New Cycle).
const SVG_W = 120;
const TIMELINE_H = 480;
const NODE_SPACING = TIMELINE_H / 5; // ~96px between nodes
const LINE_X_LEFT = 40;
const LINE_X_RIGHT = 80;

type NodeDef = {
  key: string;
  label: string;
  description: string;
  color: string;
  y: number;
  x: number;
};

function buildNodes(): NodeDef[] {
  const nodes: NodeDef[] = PHASE_ORDER.map((phase, i) => ({
    key: phase,
    label: PHASE_LABELS[phase],
    description: PHASE_DESCRIPTIONS[phase],
    color: PHASE_COLORS[phase],
    y: 48 + i * NODE_SPACING,
    // Alternate left/right for the S-curve
    x: i % 2 === 0 ? LINE_X_RIGHT : LINE_X_LEFT,
  }));
  // "New Cycle" node at the bottom
  nodes.push({
    key: 'newCycle',
    label: 'New Cycle',
    description: 'Next injection',
    color: PHASE_COLORS.shot,
    y: 48 + 4 * NODE_SPACING,
    x: 4 % 2 === 0 ? LINE_X_RIGHT : LINE_X_LEFT,
  });
  return nodes;
}

function buildCurvePath(nodes: NodeDef[]): string {
  if (nodes.length < 2) return '';
  let d = `M ${nodes[0].x} ${nodes[0].y}`;
  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];
    const midY = (prev.y + curr.y) / 2;
    // Cubic bezier: control points pull the curve vertically before bending horizontally
    d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
  }
  return d;
}

type Props = {
  currentPhase: ShotPhase;
  todayDayNum: number;
  freq: number;
  rawDaysUntil: number | null;
  todayInjLogged: boolean;
  oral: boolean;
  colors: AppColors;
};

export function VerticalCycleTimeline({
  currentPhase,
  todayDayNum,
  freq,
  rawDaysUntil,
  todayInjLogged,
  oral,
  colors,
}: Props) {
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  const nodes = buildNodes();
  const curvePath = buildCurvePath(nodes);

  const mutedLine = colors.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const mutedText = colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)';

  // Next dose text for current phase subtitle
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

  return (
    <View style={styles.container}>
      {/* SVG curved line + dots */}
      <View style={[styles.svgWrap, { height: TIMELINE_H }]}>
        <Svg width={SVG_W} height={TIMELINE_H}>
          <Defs>
            {nodes.map((node, i) => {
              if (i === 0) return null;
              const prev = nodes[i - 1];
              return (
                <LinearGradient key={`grad-${i}`} id={`seg-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={prev.color} />
                  <Stop offset="1" stopColor={node.color} />
                </LinearGradient>
              );
            })}
          </Defs>

          {/* Background track (full curve, muted) */}
          <Path
            d={curvePath}
            fill="none"
            stroke={mutedLine}
            strokeWidth={3}
            strokeLinecap="round"
          />

          {/* Colored segments up to and including current phase */}
          {nodes.map((node, i) => {
            if (i === 0) return null;
            const prev = nodes[i - 1];
            const segIdx = i - 1; // phase index for this segment
            // Only color segments fully before the current phase (up TO the current dot)
            if (segIdx >= currentIdx) return null;

            const midY = (prev.y + node.y) / 2;
            const segPath = `M ${prev.x} ${prev.y} C ${prev.x} ${midY}, ${node.x} ${midY}, ${node.x} ${node.y}`;

            return (
              <Path
                key={`seg-${i}`}
                d={segPath}
                fill="none"
                stroke={`url(#seg-${i})`}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={segIdx < currentIdx ? 0.6 : 0.9}
              />
            );
          })}

          {/* Node dots */}
          {nodes.map((node, i) => {
            const phaseIdx = i < 4 ? i : -1;
            const isCurrent = phaseIdx === currentIdx;
            const isPast = phaseIdx >= 0 && phaseIdx < currentIdx;

            if (isCurrent) {
              return (
                <React.Fragment key={node.key}>
                  {/* Outer glow */}
                  <Circle cx={node.x} cy={node.y} r={18} fill={node.color} opacity={0.15} />
                  <Circle cx={node.x} cy={node.y} r={12} fill={node.color} opacity={0.3} />
                  {/* Inner dot */}
                  <Circle cx={node.x} cy={node.y} r={7} fill={node.color} />
                </React.Fragment>
              );
            }

            return (
              <Circle
                key={node.key}
                cx={node.x}
                cy={node.y}
                r={isPast ? 5 : 4}
                fill={isPast ? node.color : mutedLine}
                opacity={isPast ? 0.7 : 1}
              />
            );
          })}
        </Svg>
      </View>

      {/* Phase labels — positioned absolutely alongside the SVG */}
      <View style={[styles.labelsWrap, { height: TIMELINE_H }]} pointerEvents="none">
        {nodes.map((node, i) => {
          const phaseIdx = i < 4 ? i : -1;
          const isCurrent = phaseIdx === currentIdx;
          const isPast = phaseIdx >= 0 && phaseIdx < currentIdx;

          // Place label on the opposite side of the node's X position
          const labelOnLeft = node.x > SVG_W / 2;

          const subtitle = isCurrent
            ? `Day ${Math.max(1, todayDayNum)} of ${freq}${nextDoseText ? ` \u00b7 ${nextDoseText}` : ''}`
            : isPast
              ? 'Complete'
              : i === 4
                ? (rawDaysUntil != null && rawDaysUntil > 0 ? `In ${rawDaysUntil} days` : oral ? 'Next dose' : 'Next injection')
                : node.description;

          return (
            <View
              key={node.key}
              style={[
                styles.labelRow,
                {
                  top: node.y - 20,
                },
                labelOnLeft
                  ? { right: SVG_W + 8, alignItems: 'flex-end' }
                  : { left: SVG_W + 8 },
              ]}
            >
              <Text
                style={[
                  styles.labelTitle,
                  {
                    color: isCurrent ? node.color : isPast ? colors.textSecondary : mutedText,
                    fontSize: isCurrent ? 22 : 16,
                    fontWeight: isCurrent ? '800' : isPast ? '600' : '500',
                  },
                ]}
              >
                {node.label}
              </Text>
              <Text
                style={[
                  styles.labelSub,
                  {
                    color: isCurrent ? colors.textSecondary : mutedText,
                    fontWeight: isCurrent ? '500' : '400',
                  },
                ]}
              >
                {subtitle}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    flexDirection: 'row',
  },
  svgWrap: {
    width: SVG_W,
  },
  labelsWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  labelRow: {
    position: 'absolute',
  },
  labelTitle: {
    fontFamily: FF,
    letterSpacing: -0.3,
  },
  labelSub: {
    fontFamily: FF,
    fontSize: 13,
    marginTop: 2,
  },
});
