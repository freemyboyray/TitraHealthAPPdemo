import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ArrowDown, ArrowUp } from 'lucide-react-native';

import { SolidCard } from '@/components/ui/solid-card';
import type { AppColors } from '@/constants/theme';
import { ADJUSTMENT_IMAGE, type AdjustmentRow } from '@/lib/checkin-target-rows';

const BLUE = '#5AC8FA';
const FF = 'System';

/**
 * One combined card for all of a week's target changes. Each metric shows two
 * bars — a muted "Before" and a solid orange "After" (a small grouped bar chart),
 * normalized to that metric's own max. A legend up top maps the two colors.
 */
export function CheckinTargetsCard({ rows, colors }: { rows: AdjustmentRow[]; colors: AppColors }) {
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const s = styles(colors);
  const beforeColor = w(0.18);

  return (
    <SolidCard radius={24}>
      <View style={{ padding: 18 }}>
        {/* Legend */}
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: beforeColor }]} />
            <Text style={s.legendText}>Before</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: colors.orange }]} />
            <Text style={s.legendText}>After</Text>
          </View>
        </View>

        {rows.map((row, i) => {
          const max = Math.max(row.before, row.after, 1);
          const beforePct = (row.before / max) * 100;
          const afterPct = (row.after / max) * 100;
          const chipColor = row.increased ? colors.orange : BLUE;
          const isLast = i === rows.length - 1;

          return (
            <View key={row.key} style={[s.row, { borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth, borderBottomColor: w(0.07) }]}>
              <View style={s.rowHead}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Image source={ADJUSTMENT_IMAGE[row.imageKey]} style={s.asset} resizeMode="contain" accessibilityIgnoresInvertColors />
                  <Text style={s.label}>{row.label}</Text>
                </View>
                <View style={[s.deltaPill, { backgroundColor: row.increased ? 'rgba(255,116,42,0.12)' : 'rgba(90,200,250,0.12)' }]}>
                  {row.increased ? <ArrowUp size={11} color={chipColor} /> : <ArrowDown size={11} color={chipColor} />}
                  <Text style={[s.deltaText, { color: chipColor }]}>{row.delta}</Text>
                </View>
              </View>

              {/* Two bars: before + after */}
              <View style={s.barRow}>
                <View style={[s.track, { backgroundColor: w(0.06) }]}>
                  <View style={[s.fill, { width: `${beforePct}%`, backgroundColor: beforeColor }]} />
                </View>
                <Text style={[s.barVal, { color: w(0.45) }]}>{row.beforeStr}</Text>
              </View>
              <View style={s.barRow}>
                <View style={[s.track, { backgroundColor: w(0.06) }]}>
                  <View style={[s.fill, { width: `${afterPct}%`, backgroundColor: colors.orange }]} />
                </View>
                <Text style={[s.barVal, { color: colors.textPrimary, fontWeight: '800' }]}>{row.afterStr}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </SolidCard>
  );
}

const styles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    legend: { flexDirection: 'row', gap: 18, marginBottom: 6 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 18, height: 10, borderRadius: 4 },
    legendText: { fontSize: 12.5, fontWeight: '600', color: w(0.45), fontFamily: FF },

    row: { paddingVertical: 16 },
    rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    asset: { width: 28, height: 28 },
    label: { fontSize: 16, fontWeight: '700', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.2, flexShrink: 1 },
    deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    deltaText: { fontSize: 14, fontWeight: '800', fontFamily: FF },

    barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    track: { flex: 1, height: 12, borderRadius: 999, overflow: 'hidden' },
    fill: { height: 12, borderRadius: 999 },
    barVal: { width: 70, textAlign: 'right', fontSize: 13.5, fontWeight: '600', fontFamily: FF },
  });
};
