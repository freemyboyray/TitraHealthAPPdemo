import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MACRO_COLORS } from '@/lib/food-macros';

// Static multi-segment calorie ring: protein / carbs / fat arcs sized by their
// kcal contribution, with total kcal in the center. Used by the edit-food and
// edit-ingredient screens.
export function MacroRing({
  protein,
  carbs,
  fat,
  calories,
  size = 92,
  strokeWidth = 9,
  trackColor,
  textColor,
}: {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  size?: number;
  strokeWidth?: number;
  trackColor: string;
  textColor: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  const segs = [
    { v: Math.max(0, protein) * 4, color: MACRO_COLORS.protein },
    { v: Math.max(0, carbs) * 4, color: MACRO_COLORS.carbs },
    { v: Math.max(0, fat) * 9, color: MACRO_COLORS.fat },
  ];
  const tot = segs.reduce((a, b) => a + b.v, 0);

  let acc = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {tot > 0 &&
          segs.map((seg, i) => {
            const frac = seg.v / tot;
            if (frac <= 0) return null;
            const segLen = frac * circ;
            const rot = -90 + (acc / tot) * 360;
            acc += seg.v;
            return (
              <Circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${segLen} ${circ}`}
                rotation={rot}
                origin={`${cx}, ${cy}`}
              />
            );
          })}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        <Text style={[styles.cal, { color: textColor }]}>{Math.round(calories)}</Text>
        <Text style={[styles.unit, { color: textColor }]}>calories</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  cal: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  unit: { fontSize: 11, fontWeight: '600', opacity: 0.7, marginTop: -2 },
});
