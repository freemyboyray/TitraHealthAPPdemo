import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAppTheme } from '@/contexts/theme-context';

const RED = '#E74C3C';
const GREEN = '#27AE60';

type RingProps = {
  pct: number;
  color: string;
  size: number;
  strokeWidth: number;
  label: string;
  sub: string;
};

function Ring({ pct, color, size, strokeWidth, label, sub }: RingProps) {
  const { colors } = useAppTheme();
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(Math.max(pct, 0), 1));
  const trackColor = colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={`${c}`} strokeDashoffset={offset} strokeLinecap="round"
          />
        </Svg>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary, fontFamily: 'System', letterSpacing: -0.5 }}>
          {Math.round(pct * 100)}%
        </Text>
      </View>
      <Text
        style={{
          fontSize: 12, fontWeight: '700', color: colors.textPrimary,
          fontFamily: 'System', textTransform: 'uppercase', letterSpacing: 1.5,
          marginTop: 10, textAlign: 'center',
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textPrimary, opacity: 0.45, fontFamily: 'System', marginTop: 3, textAlign: 'center' }}>
        {sub}
      </Text>
    </View>
  );
}

type Props = {
  size?: number;
  strokeWidth?: number;
  pctWith: number;
  pctWithout: number;
  daysWith: number;
  daysWithEffect: number;
  daysWithout: number;
  daysWithoutEffect: number;
  triggerLabel: string;
  effectLabel: string;
};

/**
 * Two side-by-side donut rings comparing a side-effect's incidence rate
 * on days a trigger food/macro was eaten vs days it wasn't. The higher rate
 * is colored red, the lower green — visual delta tells the story before
 * the user reads any numbers.
 */
export function ComparisonRings({
  size = 96,
  strokeWidth = 8,
  pctWith,
  pctWithout,
  daysWith,
  daysWithEffect,
  daysWithout,
  daysWithoutEffect,
  triggerLabel,
  effectLabel,
}: Props) {
  const { colors } = useAppTheme();
  // Color the larger arc red, smaller green — visual delta tells the story
  // before the user reads any numbers. Keeps the framing observational.
  const triggerLower = triggerLabel.toLowerCase();
  const withColor = pctWith >= pctWithout ? RED : GREEN;
  const withoutColor = pctWithout > pctWith ? RED : GREEN;
  const effectLower = effectLabel.toLowerCase();
  const moreCommon = pctWith >= pctWithout;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 16 }}>
        <Ring
          pct={pctWith} color={withColor} size={size} strokeWidth={strokeWidth}
          label={`With ${triggerLabel}`}
          sub={`${daysWithEffect}/${daysWith} days had ${effectLower}`}
        />
        <Ring
          pct={pctWithout} color={withoutColor} size={size} strokeWidth={strokeWidth}
          label={`Without ${triggerLabel}`}
          sub={`${daysWithoutEffect}/${daysWithout} days had ${effectLower}`}
        />
      </View>
      <Text
        style={{
          fontSize: 14, fontWeight: '600', color: colors.textPrimary,
          opacity: 0.7, textAlign: 'center', marginTop: 10,
          fontFamily: 'System',
        }}
      >
        You logged {effectLower} {moreCommon ? 'more often' : 'less often'} on {triggerLower} days
      </Text>
      <Text
        style={{
          fontSize: 11, color: colors.textPrimary, opacity: 0.35,
          textAlign: 'center', marginTop: 8, fontFamily: 'System',
          letterSpacing: 0.2, lineHeight: 15,
        }}
      >
        Based on your logs, not medical advice. Side effects can also follow your dose cycle.
      </Text>
    </View>
  );
}
