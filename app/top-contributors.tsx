import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/contexts/theme-context';
import { useLogStore, type FoodLog } from '@/stores/log-store';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
const ORANGE = '#FF742A';

type MetricKey = 'protein' | 'carbs' | 'fat' | 'calories' | 'sodium' | 'sat_fat';
type PeriodKey = '7D' | '30D' | '90D';
type GroupKey = 'category' | 'food';

const METRICS: { key: MetricKey; label: string; unit: string; getValue: (f: FoodLog) => number }[] = [
  { key: 'protein',  label: 'Protein',  unit: 'g',   getValue: f => f.protein_g ?? 0 },
  { key: 'carbs',    label: 'Carbs',    unit: 'g',   getValue: f => f.carbs_g ?? 0 },
  { key: 'fat',      label: 'Fat',      unit: 'g',   getValue: f => f.fat_g ?? 0 },
  { key: 'calories', label: 'Calories', unit: 'cal', getValue: f => f.calories ?? 0 },
  { key: 'sodium',   label: 'Sodium',   unit: 'mg',  getValue: f => f.sodium_mg ?? 0 },
  { key: 'sat_fat',  label: 'Sat Fat',  unit: 'g',   getValue: f => f.saturated_fat_g ?? 0 },
];

const PERIODS: { key: PeriodKey; days: number }[] = [
  { key: '7D',  days: 7 },
  { key: '30D', days: 30 },
  { key: '90D', days: 90 },
];

export default function TopContributorsScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const foodLogs = useLogStore(state => state.foodLogs);

  const [period, setPeriod] = useState<PeriodKey>('30D');
  const [metric, setMetric] = useState<MetricKey>('protein');
  const [groupBy, setGroupBy] = useState<GroupKey>('category');

  const days = PERIODS.find(p => p.key === period)?.days ?? 30;
  const metricCfg = METRICS.find(m => m.key === metric)!;

  const aggregates = useMemo(() => {
    const cutoff = Date.now() - days * 86400000;
    const recent = foodLogs.filter(f => f.logged_at && new Date(f.logged_at).getTime() > cutoff);
    const groups = new Map<string, number>();
    let total = 0;
    for (const f of recent) {
      const key = groupBy === 'category' ? (f.fatsecret_category_name ?? 'Uncategorized') : f.food_name;
      const v = metricCfg.getValue(f);
      if (v <= 0) continue;
      groups.set(key, (groups.get(key) ?? 0) + v);
      total += v;
    }
    if (total <= 0) return { entries: [] as { name: string; value: number; pct: number }[], total: 0 };
    const sorted = Array.from(groups.entries()).sort((a, b) => b[1] - a[1]);
    return {
      entries: sorted.slice(0, 10).map(([name, value]) => ({ name, value, pct: value / total })),
      total,
    };
  }, [foodLogs, days, groupBy, metricCfg]);

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Minimal back-button-only header, no title bar */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backButton}>
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Single unified card — covers the gradient, hosts filters and the bar list */}
            <View style={s.card}>
              {/* Period switcher */}
              <View style={s.controlRow}>
                {PERIODS.map(({ key }) => {
                  const active = period === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setPeriod(key)}
                      activeOpacity={0.7}
                      style={[s.chip, active && s.chipActive]}
                    >
                      <Text style={[s.chipLabel, active && s.chipLabelActive]}>{key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Metric pills (horizontal scroll) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingRight: 4 }}
                style={{ marginTop: 12, marginHorizontal: -4, paddingHorizontal: 4 }}
              >
                {METRICS.map(m => {
                  const active = metric === m.key;
                  return (
                    <TouchableOpacity
                      key={m.key}
                      onPress={() => setMetric(m.key)}
                      activeOpacity={0.7}
                      style={[s.pill, active && s.pillActive]}
                    >
                      <Text style={[s.pillLabel, active && s.pillLabelActive]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Group toggle: segmented two-button control */}
              <View style={s.segmented}>
                {(['category', 'food'] as GroupKey[]).map(g => {
                  const active = groupBy === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setGroupBy(g)}
                      activeOpacity={0.7}
                      style={[s.segment, active && s.segmentActive]}
                    >
                      <Text style={[s.segmentLabel, active && s.segmentLabelActive]}>
                        By {g === 'category' ? 'Category' : 'Food'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Bar list */}
              {aggregates.entries.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Text style={s.emptyText}>
                    No data for this period yet.{'\n'}Log a few meals to see where your {metricCfg.label.toLowerCase()} comes from.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={s.divider} />
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Total {metricCfg.label.toLowerCase()}</Text>
                    <Text style={s.totalValue}>
                      {Math.round(aggregates.total).toLocaleString()} {metricCfg.unit}
                    </Text>
                  </View>
                  {aggregates.entries.map((entry, i) => (
                    <View key={`${entry.name}-${i}`} style={{ marginBottom: i === aggregates.entries.length - 1 ? 0 : 14 }}>
                      <View style={s.barRow}>
                        <Text style={s.barName} numberOfLines={1}>{entry.name}</Text>
                        <Text style={s.barValue}>
                          {Math.round(entry.value).toLocaleString()} {metricCfg.unit} · {Math.round(entry.pct * 100)}%
                        </Text>
                      </View>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { width: `${Math.max(2, entry.pct * 100)}%`, opacity: Math.max(0.4, 1 - i * 0.07) }]} />
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const muted = c.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const subtle = c.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  const inactivePillBg = c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const trackBg = c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const segmentTrackBg = c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },

    header: {
      paddingHorizontal: 12, paddingTop: 4, paddingBottom: 6,
    },
    backButton: {
      width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center',
    },

    scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 },

    // The unified surface card that covers the orange gradient and houses
    // both the filters and the bar list.
    card: {
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 18,
    },

    // Period chips row
    controlRow: { flexDirection: 'row', gap: 8 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
      backgroundColor: inactivePillBg,
    },
    chipActive: { backgroundColor: ORANGE },
    chipLabel: { fontSize: 13, fontWeight: '600', color: muted, fontFamily: FF },
    chipLabelActive: { color: '#FFFFFF' },

    // Metric pills (horizontal scroll)
    pill: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
      backgroundColor: inactivePillBg,
    },
    pillActive: { backgroundColor: ORANGE },
    pillLabel: { fontSize: 13, fontWeight: '600', color: muted, fontFamily: FF },
    pillLabelActive: { color: '#FFFFFF' },

    // Segmented control for category / food toggle
    segmented: {
      flexDirection: 'row',
      marginTop: 14,
      borderRadius: 12,
      backgroundColor: segmentTrackBg,
      padding: 3,
    },
    segment: {
      flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: c.surface,
      shadowColor: '#000',
      shadowOpacity: c.isDark ? 0 : 0.06,
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 2,
      elevation: 1,
    },
    segmentLabel: { fontSize: 13, fontWeight: '600', color: muted, fontFamily: FF },
    segmentLabelActive: { color: c.textPrimary },

    // Divider between filters and bar list
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      marginTop: 18,
      marginBottom: 16,
    },

    // Total row
    totalRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
      marginBottom: 16,
    },
    totalLabel: { fontSize: 13, color: muted, fontFamily: FF },
    totalValue: { fontSize: 15, fontWeight: '700', color: c.textPrimary, fontFamily: FF, fontVariant: ['tabular-nums'] },

    // Bar rows
    barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 },
    barName: { fontSize: 14, fontWeight: '600', color: c.textPrimary, flex: 1, fontFamily: FF },
    barValue: { fontSize: 12, color: muted, fontFamily: FF, marginLeft: 10, fontVariant: ['tabular-nums'] },
    barTrack: { height: 8, borderRadius: 4, backgroundColor: trackBg, overflow: 'hidden' },
    barFill: { height: 8, borderRadius: 4, backgroundColor: ORANGE },

    // Empty state
    emptyWrap: { paddingVertical: 36, alignItems: 'center' },
    emptyText: { fontSize: 14, color: subtle, textAlign: 'center', lineHeight: 21, fontFamily: FF },
  });
};
