import React from 'react';
import { Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';

export type CompareRow = {
  label: string;
  current: number | null;   // 0–100
  previous: number | null;  // 0–100, null when there was no prior week
};

/**
 * Horizontal this-week-vs-last-week comparison, one domain per row. The top
 * (filled, metric color) bar is this week; the lower (muted) bar is last week.
 * When `previous` is null — no prior week on record — that bar reads grayed with
 * an em dash, exactly the "leave the other week grayed out" behavior.
 */
export function CompareBars({
  rows,
  color,
  hasPrevious,
}: {
  rows: CompareRow[];
  color: string;
  hasPrevious: boolean;
}) {
  const { colors } = useAppTheme();
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const muted = w(0.22);

  const Bar = ({ value, fill }: { value: number | null; fill: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: w(0.06), overflow: 'hidden' }}>
        {value != null && (
          <View style={{ width: `${Math.max(2, value)}%`, height: 8, borderRadius: 4, backgroundColor: fill }} />
        )}
      </View>
      <Text style={{ width: 30, textAlign: 'right', fontSize: 13, fontWeight: '700', color: value != null ? colors.textPrimary : w(0.3) }}>
        {value != null ? value : '—'}
      </Text>
    </View>
  );

  return (
    <View>
      {/* legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>This week</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: muted }} />
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textSecondary }}>
            {hasPrevious ? 'Last week' : 'No prior week'}
          </Text>
        </View>
      </View>

      {rows.map((r) => (
        <View key={r.label} style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 7 }}>
            {r.label}
          </Text>
          <View style={{ gap: 6 }}>
            <Bar value={r.current} fill={color} />
            <Bar value={r.previous} fill={muted} />
          </View>
        </View>
      ))}
    </View>
  );
}
