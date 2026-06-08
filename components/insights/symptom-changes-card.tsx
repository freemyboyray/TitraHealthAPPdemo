import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation, type AppColors } from '@/constants/theme';
import type { SymptomTrend } from '@/lib/side-effect-insights';
import { SeverityBars } from '@/components/insights/severity-bars';
import { effectLabel } from '@/components/insights/effect-icon';

const FF = 'System';

function namesLine(trends: SymptomTrend[]): string {
  const names = trends.slice(0, 3).map(t => effectLabel(t.type));
  const extra = trends.length - names.length;
  return extra > 0 ? `${names.join(', ')} +${extra} more` : names.join(', ');
}

/**
 * Compact, graph-focused summary of symptom changes (mirrors the Lifestyle
 * nutrition card but without an illustration): distinct-symptom count, the names
 * logged, and a 30-day severity strip. Tapping opens the per-symptom detail page.
 */
export function SymptomChangesCard({
  trends, bars, onPress,
}: {
  trends: SymptomTrend[];
  bars: (number | null)[];
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [graphW, setGraphW] = useState(0);

  const distinct = trends.length;
  const totalLogs = trends.reduce((sum, t) => sum + t.count, 0);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Symptom Changes. ${distinct} symptoms tracked. Tap for details`}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
    >
      <View style={s.topRow}>
        <View style={s.valueRow}>
          <Text style={s.value}>{totalLogs}</Text>
          <Text style={s.unit}>{totalLogs === 1 ? 'log in 30 days' : 'logs in 30 days'}</Text>
        </View>
        <ChevronRight size={18} color={colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
      </View>
      <Text style={s.descriptor} numberOfLines={1}>
        {distinct > 0 ? namesLine(trends) : 'Nothing logged in the last 30 days'}
      </Text>

      {distinct > 0 && (
        <View style={s.barsWrap} onLayout={e => setGraphW(e.nativeEvent.layout.width)}>
          <SeverityBars values={bars} width={graphW} height={42} />
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    card: {
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: c.isDark ? 0 : 0.5,
      borderColor: c.border,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 10,
      overflow: 'hidden',
      ...cardElevation(c.isDark),
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    value: { fontSize: 30, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.8, fontFamily: FF },
    unit: { fontSize: 14, fontWeight: '600', color: c.textSecondary, marginBottom: 4, fontFamily: FF },
    descriptor: { fontSize: 13, fontWeight: '500', color: w(0.5), fontFamily: FF, marginTop: 5 },
    barsWrap: { marginTop: 12, transform: [{ translateY: 12 }] },
  });
};
