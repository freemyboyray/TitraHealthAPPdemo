import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DailyMetricCard,
  PremierNutritionCard,
} from '@/app/(tabs)/log';
import { NutrientLogSheet, type NutrientKey } from '@/components/nutrient-log-sheet';
import { TopContributorsRow } from '@/components/top-contributors-row';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { categoryColor } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { useLifestyleMetrics } from '@/hooks/use-lifestyle-metrics';

export default function NutritionDetailScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [nutrientSheet, setNutrientSheet] = useState<NutrientKey | null>(null);

  const {
    todayProteinG, todayFiberG, todayCarbsG, todayFatG, todayCalories,
    todaySodiumMg, todaySugarG, todaySaturatedFatG, todayCholesterolMg,
    waterOz, waterTargetOz,
    targets,
    sodiumTargetMg, sugarTargetG, satFatTargetG, cholesterolTargetMg,
    proteinPct, fiberPct, carbsPct, fatPct, caloriesPct, waterPct,
    adjustMetric,
    health,
  } = useLifestyleMetrics();

  const status = (pct: number) =>
    pct >= 80 ? ('positive' as const) : pct >= 40 ? ('neutral' as const) : ('negative' as const);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nutrition</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.dailyGrid}>
          <DailyMetricCard
            icon={<IconSymbol name="fork.knife" size={20} color={categoryColor(colors.isDark, 'nutrition')} />}
            label="Protein" value={`${todayProteinG}/${targets.proteinG}g`}
            change={`${proteinPct}%`}
            status={status(proteinPct)}
            pct={proteinPct / 100}
            onPress={() => setNutrientSheet('protein')}
            onIncrement={() => adjustMetric('proteinG', 1)}
            onDecrement={() => adjustMetric('proteinG', -1)}
          />
          <DailyMetricCard
            icon={<IconSymbol name="leaf.fill" size={20} color={categoryColor(colors.isDark, 'nutrition')} />}
            label="Fiber" value={`${todayFiberG}/${targets.fiberG}g`}
            change={`${fiberPct}%`}
            status={status(fiberPct)}
            pct={fiberPct / 100}
            onPress={() => setNutrientSheet('fiber')}
            onIncrement={() => adjustMetric('fiberG', 1)}
            onDecrement={() => adjustMetric('fiberG', -1)}
          />
          <DailyMetricCard
            icon={<IconSymbol name="drop.fill" size={20} color={categoryColor(colors.isDark, 'hydration')} />}
            label="Hydration" value={`${waterOz}/${waterTargetOz}oz`}
            change={`${waterPct}%`}
            status={status(waterPct)}
            pct={waterPct / 100}
            onPress={() => setNutrientSheet('hydration')}
            onIncrement={() => health.dispatch({ type: 'LOG_WATER', ml: 30 })}
            onDecrement={() => { if (health.actuals.waterMl >= 30) health.dispatch({ type: 'LOG_WATER', ml: -30 }); }}
          />
          <DailyMetricCard
            icon={<IconSymbol name="bolt.fill" size={20} color={categoryColor(colors.isDark, 'activity')} />}
            label="Carbs" value={`${todayCarbsG}/${targets.carbsG}g`}
            change={`${carbsPct}%`}
            status={status(carbsPct)}
            pct={carbsPct / 100}
            onPress={() => setNutrientSheet('carbs')}
            onIncrement={() => adjustMetric('carbsG', 1)}
            onDecrement={() => adjustMetric('carbsG', -1)}
          />
          <DailyMetricCard
            icon={<IconSymbol name="circle.dotted" size={20} color="#F6CB45" />}
            label="Fat" value={`${todayFatG}/${targets.fatG}g`}
            change={`${fatPct}%`}
            status={status(fatPct)}
            pct={fatPct / 100}
            onPress={() => setNutrientSheet('fat')}
            onIncrement={() => adjustMetric('fatG', 1)}
            onDecrement={() => adjustMetric('fatG', -1)}
          />
          <DailyMetricCard
            icon={<IconSymbol name="flame.fill" size={20} color="#C084FC" />}
            label="Calories" value={`${todayCalories}/${targets.caloriesTarget} cal`}
            change={`${caloriesPct}%`}
            status={status(caloriesPct)}
            pct={caloriesPct / 100}
            onPress={() => setNutrientSheet('calories')}
            onIncrement={() => adjustMetric('calories', 1)}
            onDecrement={() => adjustMetric('calories', -1)}
          />
          <PremierNutritionCard metrics={[
            { label: 'Sodium', current: todaySodiumMg, target: sodiumTargetMg, unit: 'mg', color: '#FF6B6B', onIncrement: () => adjustMetric('sodiumMg', 50), onDecrement: () => adjustMetric('sodiumMg', -50) },
            { label: 'Sugar', current: todaySugarG, target: sugarTargetG, unit: 'g', color: '#E879F9', onIncrement: () => adjustMetric('sugarG', 1), onDecrement: () => adjustMetric('sugarG', -1) },
            { label: 'Sat Fat', current: todaySaturatedFatG, target: satFatTargetG, unit: 'g', color: '#F59E0B', onIncrement: () => adjustMetric('satFatG', 1), onDecrement: () => adjustMetric('satFatG', -1) },
            { label: 'Cholesterol', current: todayCholesterolMg, target: cholesterolTargetMg, unit: 'mg', color: '#A78BFA', onIncrement: () => adjustMetric('cholesterolMg', 10), onDecrement: () => adjustMetric('cholesterolMg', -10) },
          ]} />
        </View>

        <View style={{ height: 8 }} />
        <TopContributorsRow />
      </ScrollView>

      <NutrientLogSheet
        visible={nutrientSheet != null}
        onClose={() => setNutrientSheet(null)}
        nutrient={nutrientSheet ?? 'protein'}
        currentValue={
          nutrientSheet === 'protein' ? todayProteinG
          : nutrientSheet === 'fiber' ? todayFiberG
          : nutrientSheet === 'hydration' ? waterOz
          : nutrientSheet === 'carbs' ? todayCarbsG
          : nutrientSheet === 'fat' ? todayFatG
          : nutrientSheet === 'calories' ? todayCalories
          : 0
        }
        targetValue={
          nutrientSheet === 'protein' ? targets.proteinG
          : nutrientSheet === 'fiber' ? targets.fiberG
          : nutrientSheet === 'hydration' ? waterTargetOz
          : nutrientSheet === 'carbs' ? targets.carbsG
          : nutrientSheet === 'fat' ? targets.fatG
          : nutrientSheet === 'calories' ? targets.caloriesTarget
          : 0
        }
        onUpdate={(delta) => {
          if (nutrientSheet === 'hydration') {
            health.dispatch({ type: 'LOG_WATER', ml: Math.round(delta * 29.5735) });
          } else {
            const fieldMap: Record<string, 'proteinG' | 'fiberG' | 'carbsG' | 'fatG' | 'calories'> = {
              protein: 'proteinG', fiber: 'fiberG', carbs: 'carbsG', fat: 'fatG', calories: 'calories',
            };
            if (nutrientSheet) adjustMetric(fieldMap[nutrientSheet], delta);
          }
        }}
      />
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
    headerTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '700', fontFamily: 'System', letterSpacing: -0.2 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 36 },
    dailyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  });
