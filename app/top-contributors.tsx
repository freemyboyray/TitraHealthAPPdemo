import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/contexts/theme-context';
import { useLogStore, type FoodLog } from '@/stores/log-store';
import type { AppColors } from '@/constants/theme';
import { cleanFoodLabel, normalizeIngredient, titleCase } from '@/lib/food-taxonomy';
import { ChevronLeft } from 'lucide-react-native';

const FF = 'System';

type NutrientKey =
  | 'protein' | 'carbs' | 'fat' | 'calories' | 'fiber'
  | 'sodium' | 'sat_fat' | 'sugar' | 'added_sugars' | 'cholesterol'
  | 'potassium' | 'calcium' | 'iron'
  | 'trans_fat' | 'mono_fat' | 'poly_fat'
  | 'vitamin_a' | 'vitamin_c' | 'vitamin_d';
type PeriodKey = '7D' | '30D' | '90D';

// A single ingredient's contribution to one log, with every tracked nutrient.
// Composite dishes expand into one Contribution per component; non-composite
// logs collapse to a single contribution keyed on the food name.
type Contribution = { ingredientKey: string; display: string } & Record<NutrientKey, number>;

// label → display column on each metric pill / bar list.
const METRICS: { key: NutrientKey; label: string; unit: string; src: string }[] = [
  { key: 'protein',      label: 'Protein',      unit: 'g',   src: 'protein_g' },
  { key: 'carbs',        label: 'Carbs',        unit: 'g',   src: 'carbs_g' },
  { key: 'fat',          label: 'Fat',          unit: 'g',   src: 'fat_g' },
  { key: 'calories',     label: 'Calories',     unit: 'cal', src: 'calories' },
  { key: 'fiber',        label: 'Fiber',        unit: 'g',   src: 'fiber_g' },
  { key: 'sodium',       label: 'Sodium',       unit: 'mg',  src: 'sodium_mg' },
  { key: 'sat_fat',      label: 'Sat Fat',      unit: 'g',   src: 'saturated_fat_g' },
  { key: 'sugar',        label: 'Sugar',        unit: 'g',   src: 'sugar_g' },
  { key: 'added_sugars', label: 'Added Sugars', unit: 'g',   src: 'added_sugars_g' },
  { key: 'cholesterol',  label: 'Cholesterol',  unit: 'mg',  src: 'cholesterol_mg' },
  { key: 'potassium',    label: 'Potassium',    unit: 'mg',  src: 'potassium_mg' },
  { key: 'calcium',      label: 'Calcium',      unit: 'mg',  src: 'calcium_mg' },
  { key: 'iron',         label: 'Iron',         unit: 'mg',  src: 'iron_mg' },
  { key: 'trans_fat',    label: 'Trans Fat',    unit: 'g',   src: 'trans_fat_g' },
  { key: 'mono_fat',     label: 'Mono Fat',     unit: 'g',   src: 'monounsaturated_fat_g' },
  { key: 'poly_fat',     label: 'Poly Fat',     unit: 'g',   src: 'polyunsaturated_fat_g' },
  { key: 'vitamin_a',    label: 'Vitamin A',    unit: 'mcg', src: 'vitamin_a_mcg' },
  { key: 'vitamin_c',    label: 'Vitamin C',    unit: 'mg',  src: 'vitamin_c_mg' },
  { key: 'vitamin_d',    label: 'Vitamin D',    unit: 'mcg', src: 'vitamin_d_mcg' },
];

const PERIODS: { key: PeriodKey; days: number }[] = [
  { key: '7D',  days: 7 },
  { key: '30D', days: 30 },
  { key: '90D', days: 90 },
];

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// Pull every nutrient off a source object (a composite component or a food_logs
// row — they share field names) into the metric-keyed Contribution shape.
function contribFrom(src: any, label: string): Contribution {
  const key = normalizeIngredient(label);
  const out = { ingredientKey: key, display: titleCase(key) } as Contribution;
  for (const m of METRICS) out[m.key] = num(src?.[m.src]);
  return out;
}

// Expand a food log into per-ingredient contributions. Composite dishes (logged
// through the describe/photo flow) carry a component breakdown in
// raw_ai_response; everything else (single-item tray logs, legacy rows) folds
// into a single contribution keyed on the food name.
function logContributions(f: FoodLog): Contribution[] {
  const raw = f.raw_ai_response as any;
  const comps = raw?.kind === 'composite' && Array.isArray(raw.components) ? raw.components : null;
  if (comps && comps.length > 0) {
    return comps.map((c: any) => contribFrom(c, cleanFoodLabel(c.item, c.matched_name)));
  }
  return [contribFrom(f, f.food_name || 'Unknown')];
}

export default function TopContributorsScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const foodLogs = useLogStore(state => state.foodLogs);

  const [period, setPeriod] = useState<PeriodKey>('30D');
  const [metric, setMetric] = useState<NutrientKey>('protein');

  const days = PERIODS.find(p => p.key === period)?.days ?? 30;
  const metricCfg = METRICS.find(m => m.key === metric)!;

  const aggregates = useMemo(() => {
    const cutoff = Date.now() - days * 86400000;
    const recent = foodLogs.filter(f => f.logged_at && new Date(f.logged_at).getTime() > cutoff);
    // Aggregate by normalized ingredient key; keep a human display label.
    const groups = new Map<string, { value: number; display: string }>();
    let total = 0;
    for (const f of recent) {
      for (const c of logContributions(f)) {
        const v = c[metricCfg.key];
        if (v <= 0) continue;
        const prev = groups.get(c.ingredientKey);
        groups.set(c.ingredientKey, { value: (prev?.value ?? 0) + v, display: c.display });
        total += v;
      }
    }
    if (total <= 0) return { entries: [] as { name: string; value: number; pct: number }[], total: 0 };
    const sorted = Array.from(groups.values()).sort((a, b) => b.value - a.value);
    return {
      entries: sorted.slice(0, 10).map(({ display, value }) => ({ name: display, value, pct: value / total })),
      total,
    };
  }, [foodLogs, days, metricCfg]);

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Minimal back-button-only header, no title bar */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backButton}>
            <ChevronLeft size={26} color={colors.textPrimary} />
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
    chipActive: { backgroundColor: c.orange },
    chipLabel: { fontSize: 13, fontWeight: '600', color: muted, fontFamily: FF },
    chipLabelActive: { color: '#FFFFFF' },

    // Metric pills (horizontal scroll)
    pill: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
      backgroundColor: inactivePillBg,
    },
    pillActive: { backgroundColor: c.orange },
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
    barFill: { height: 8, borderRadius: 4, backgroundColor: c.orange },

    // Empty state
    emptyWrap: { paddingVertical: 36, alignItems: 'center' },
    emptyText: { fontSize: 14, color: subtle, textAlign: 'center', lineHeight: 21, fontFamily: FF },
  });
};
