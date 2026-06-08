import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';

/**
 * Seven vertical bars over a day axis, with an optional dashed goal line.
 * Each value is one day, oldest → newest (slot 0 = window start). A null value
 * renders an empty column (faint track only) so unlogged days stay visible and
 * evenly spaced — we never fake a zero. Apple-Health-style: faint capacity track
 * behind each bar, the bar itself in the metric's identity color.
 */
export function WeekBarChart({
  values,
  labels,
  color,
  goal,
  height = 116,
}: {
  values: (number | null)[];
  labels: string[];
  color: string;
  goal?: number | null;
  height?: number;
}) {
  const { colors } = useAppTheme();
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  const { scale, goalY } = useMemo(() => {
    const nums = values.filter((v): v is number => v != null);
    const max = Math.max(1, ...nums, goal ?? 0);
    const sc = max * 1.18; // headroom above the tallest bar / goal line
    return { scale: sc, goalY: goal && goal > 0 ? (1 - goal / sc) * height : null };
  }, [values, goal, height]);

  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 7 }}>
        {values.map((v, i) => {
          const h = v == null ? 0 : Math.max(5, (v / scale) * height);
          return (
            <View key={i} style={{ flex: 1, height, justifyContent: 'flex-end' }}>
              {/* faint full-height capacity track */}
              <View
                style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
                  borderRadius: 7, backgroundColor: w(0.045),
                }}
              />
              {v != null && (
                <View style={{ height: h, borderRadius: 7, backgroundColor: color }} />
              )}
            </View>
          );
        })}

        {/* dashed goal line — rendered last so it sits above the bars */}
        {goalY != null && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', left: 0, right: 0, top: goalY,
              borderTopWidth: 1.5, borderColor: w(0.3), borderStyle: 'dashed',
            }}
          />
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 7, marginTop: 8 }}>
        {labels.map((l, i) => (
          <Text
            key={i}
            style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: w(0.38) }}
          >
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}
