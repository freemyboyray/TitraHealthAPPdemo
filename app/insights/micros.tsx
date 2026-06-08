import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import type { AppColors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { useLifestyleMetrics } from '@/hooks/use-lifestyle-metrics';
import { useLogStore } from '@/stores/log-store';
import { LucideIconByName } from '@/lib/lucide-icon-map';
import { localDateStr } from '@/lib/date-utils';
import { SUMMARY_METRICS, buildFoodByDate, goalStatus } from '@/lib/metric-history';

const FF = 'System';

const fmt = (v: number, unit: string) => (unit === 'mcg' ? v.toFixed(0) : Math.round(v).toLocaleString());

export default function MicrosDetailScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { foodLogs } = useLogStore();
  const lm = useLifestyleMetrics();

  const foodByDate = useMemo(() => buildFoodByDate(foodLogs), [foodLogs]);
  const todayStr = localDateStr();

  const targets: Record<string, number> = {
    sodium: lm.sodiumTargetMg, sugar: lm.sugarTargetG, added_sugars: lm.addedSugarsTargetG,
    sat_fat: lm.satFatTargetG, trans_fat: lm.transFatTargetG, mono_fat: lm.monoFatTargetG,
    poly_fat: lm.polyFatTargetG, cholesterol: lm.cholesterolTargetMg, potassium: lm.potassiumTargetMg,
    calcium: lm.calciumTargetMg, iron: lm.ironTargetMg, vitamin_a: lm.vitaminATargetMcg,
    vitamin_c: lm.vitaminCTargetMg, vitamin_d: lm.vitaminDTargetMcg,
  };

  const micros = SUMMARY_METRICS.filter((m) => m.group === 'micro');

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Micronutrients</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Vitamins, minerals and extended fats from what you've logged. Tap any to see its trend.</Text>

        <View style={s.list}>
          {micros.map((m) => {
            const value = m.getValue(foodByDate, {}, todayStr) ?? 0;
            const target = Math.round(targets[m.id] ?? 0);
            const pct = target > 0 ? (value / target) * 100 : 0;
            const st = goalStatus(pct, m.inverseGoal);
            return (
              <Pressable
                key={m.id}
                style={s.row}
                onPress={() => router.push(`/insights/metric/${m.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`${m.label}, ${st.label}`}
              >
                <View style={s.iconWrap}>
                  <LucideIconByName name={m.icon} size={22} color={colors.textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{m.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <View style={[s.dot, { backgroundColor: st.color }]} />
                    <Text style={[s.rowStatus, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <Text style={s.rowValue}>
                  {fmt(value, m.unit)}<Text style={s.rowUnit}> / {fmt(target, m.unit)} {m.unit}</Text>
                </Text>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '700', fontFamily: FF, letterSpacing: -0.2 },
    content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 36 },
    intro: { color: c.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 18, fontFamily: FF },
    list: { gap: 2 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w(0.07),
    },
    iconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { fontSize: 16, fontWeight: '700', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.2 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    rowStatus: { fontSize: 13, fontWeight: '600', fontFamily: FF },
    rowValue: { fontSize: 14, fontWeight: '700', color: c.textPrimary, fontFamily: FF },
    rowUnit: { fontSize: 12, fontWeight: '500', color: w(0.4), fontFamily: FF },
  });
};
