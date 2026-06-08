import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FF = 'System';

export type Bar = {
  label: string;
  /** Fill percentage, 0–100. */
  pct: number;
  /** Right-aligned value text. */
  display: string;
  color: string;
  bold?: boolean;
};

/**
 * A small stack of labeled horizontal bars — used on the check-in result and
 * targets screens to compare two values (this week vs average, before vs after).
 */
export function BarGroup({ bars, colors: c }: { bars: Bar[]; colors?: AppColors }) {
  const theme = useAppTheme();
  const colors = c ?? theme.colors;
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return (
    <View style={styles.group}>
      {bars.map((b, i) => (
        <View key={i} style={styles.row}>
          <Text style={[styles.label, { color: w(0.4) }]}>{b.label}</Text>
          <View style={[styles.track, { backgroundColor: w(0.08) }]}>
            <View style={[styles.fill, { width: `${Math.max(2, Math.min(100, b.pct))}%`, backgroundColor: b.color }]} />
          </View>
          <Text style={[styles.value, { color: b.bold ? colors.textPrimary : w(0.5), fontWeight: b.bold ? '800' : '600' }]}>
            {b.display}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { width: 58, fontSize: 12.5, fontWeight: '600', fontFamily: FF },
  track: { flex: 1, height: 10, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 999 },
  value: { width: 62, textAlign: 'right', fontSize: 14, fontFamily: FF },
});
