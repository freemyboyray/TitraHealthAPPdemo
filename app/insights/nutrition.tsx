import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { HealthSummaryCard } from '@/components/insights/health-summary-card';
import type { AppColors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { useLifestyleMetrics } from '@/hooks/use-lifestyle-metrics';
import { useLogStore } from '@/stores/log-store';
import { localDateStr } from '@/lib/date-utils';
import {
  SUMMARY_METRICS, buildActivityByDate, buildFoodByDate, buildSeries, goalStatus,
} from '@/lib/metric-history';

const FF = 'System';
const SPARK_DAYS = 14;
const HYDRATION_COLOR = '#2BA7E0';
const MICRO_COLOR = '#A78BFA';

const MACRO_IMAGES: Record<string, any> = {
  protein: require('@/assets/images/cards/protein.png'),
  carbs: require('@/assets/images/cards/carbs.png'),
  fat: require('@/assets/images/cards/fat.png'),
  calories: require('@/assets/images/cards/calories.png'),
  fiber: require('@/assets/images/cards/fiber.png'),
};
const HYDRATION_IMAGE = require('@/assets/images/cards/hydration.png');
const MICRO_IMAGE = require('@/assets/images/cards/micronutrients.png');

const shortUnit = (u: string) => (u === 'steps' ? '' : u);

export default function NutritionDetailScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const {
    todayProteinG, todayCarbsG, todayFatG, todayCalories, todayFiberG,
    waterOz, waterTargetOz, waterPct,
    targets,
    proteinPct, carbsPct, fatPct, caloriesPct, fiberPct,
  } = useLifestyleMetrics();
  const { foodLogs, activityLogs } = useLogStore();

  const todayStr = localDateStr();
  const foodByDate = useMemo(() => buildFoodByDate(foodLogs), [foodLogs]);
  const activityByDate = useMemo(() => buildActivityByDate(activityLogs), [activityLogs]);

  const today: Record<string, { value: number; target: number; pct: number }> = {
    protein:  { value: todayProteinG, target: targets.proteinG,       pct: proteinPct },
    carbs:    { value: todayCarbsG,   target: targets.carbsG,         pct: carbsPct },
    fat:      { value: todayFatG,     target: targets.fatG,           pct: fatPct },
    calories: { value: todayCalories, target: targets.caloriesTarget, pct: caloriesPct },
    fiber:    { value: todayFiberG,   target: targets.fiberG,         pct: fiberPct },
  };

  const macros = SUMMARY_METRICS.filter((m) => m.group === 'nutrition');

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nutrition</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 12 }}>
          {macros.map((m) => {
            const t = today[m.id];
            const st = goalStatus(t.pct, m.inverseGoal);
            const u = shortUnit(m.unit);
            return (
              <HealthSummaryCard
                key={m.id}
                image={MACRO_IMAGES[m.id]}
                iconName={m.icon}
                iconColor={m.color}
                label={m.label}
                value={Math.round(t.value).toLocaleString()}
                unit={`/ ${Math.round(t.target).toLocaleString()}${u ? ' ' + u : ''}`}
                descriptor={{ text: st.label, color: st.color }}
                sparkline={{ values: buildSeries(m, foodByDate, activityByDate, todayStr, SPARK_DAYS).values, color: m.color }}
                onPress={() => router.push(`/insights/metric/${m.id}` as any)}
              />
            );
          })}

          {/* Hydration — no daily-history sparkline source yet */}
          {(() => {
            const st = goalStatus(waterPct);
            return (
              <HealthSummaryCard
                image={HYDRATION_IMAGE}
                iconName="Droplets"
                iconColor={HYDRATION_COLOR}
                label="Hydration"
                value={Math.round(waterOz).toLocaleString()}
                unit={`/ ${Math.round(waterTargetOz)} oz`}
                descriptor={{ text: st.label, color: st.color }}
              />
            );
          })()}

          {/* Micronutrients → full breakdown */}
          <HealthSummaryCard
            image={MICRO_IMAGE}
            iconName="Pill"
            iconColor={MICRO_COLOR}
            label="Micronutrients"
            value="14"
            unit="tracked"
            descriptor={{ text: 'Sodium, potassium, iron,\nand 11+ more', color: colors.textSecondary }}
            descriptorLines={2}
            onPress={() => router.push('/insights/micros' as any)}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '700', fontFamily: FF, letterSpacing: -0.2 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 36 },
  });
