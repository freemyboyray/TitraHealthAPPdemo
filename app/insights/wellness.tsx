import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { GaugeBar, HealthDataConnectPrompt, hmStatusStyle } from '@/app/(tabs)/log';
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

const WELLNESS_IMAGES: Record<string, any> = {
  steps: require('@/assets/images/cards/steps.png'),
  active_cal: require('@/assets/images/cards/active-calories.png'),
};

const fmtVal = (v: number) => Math.round(v).toLocaleString();

export default function WellnessDetailScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const {
    todaySteps, todayActiveCalories, targets,
    routedHealthGroups, appleHealthEnabled,
  } = useLifestyleMetrics();
  const { foodLogs, activityLogs } = useLogStore();

  const todayStr = localDateStr();
  const foodByDate = useMemo(() => buildFoodByDate(foodLogs), [foodLogs]);
  const activityByDate = useMemo(() => buildActivityByDate(activityLogs), [activityLogs]);

  const today: Record<string, { value: number; target: number; pct: number }> = {
    steps:      { value: todaySteps,          target: targets.steps,                 pct: targets.steps ? (todaySteps / targets.steps) * 100 : 0 },
    active_cal: { value: todayActiveCalories,  target: targets.activeCaloriesTarget,  pct: targets.activeCaloriesTarget ? (todayActiveCalories / targets.activeCaloriesTarget) * 100 : 0 },
  };

  const baseMetrics = SUMMARY_METRICS.filter((m) => m.group === 'wellness');
  const hkMetrics = [...routedHealthGroups.activity, ...routedHealthGroups.vitals].flatMap((g) => g.metrics);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Wellness</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 12 }}>
          {/* Activity basics with sparklines */}
          {baseMetrics.map((m) => {
            const t = today[m.id];
            const hasVal = t.value > 0;
            const st = goalStatus(t.pct);
            return (
              <HealthSummaryCard
                key={m.id}
                image={WELLNESS_IMAGES[m.id]}
                iconName={m.icon}
                iconColor={m.color}
                label={m.label}
                value={hasVal ? fmtVal(t.value) : 'No Data'}
                unit={hasVal ? `/ ${fmtVal(t.target)}${m.unit === 'steps' ? '' : ' ' + m.unit}` : undefined}
                descriptor={hasVal ? { text: st.label, color: st.color } : undefined}
                sparkline={{ values: buildSeries(m, foodByDate, activityByDate, todayStr, SPARK_DAYS).values, color: m.color }}
                noData={!hasVal}
                onPress={() => router.push(`/insights/metric/${m.id}` as any)}
              />
            );
          })}

          {/* HealthKit vitals + activity extras: value + status + gauge */}
          {hkMetrics.map((hm) => {
            const ss = hmStatusStyle[hm.status];
            return (
              <HealthSummaryCard
                key={hm.id}
                iconName={hm.lucideIcon}
                iconColor={hm.noData ? colors.textMuted : ss.text}
                label={hm.label}
                value={hm.noData ? 'No Data' : hm.value}
                unit={hm.noData ? undefined : hm.unit}
                descriptor={{ text: hm.rangeLabel, color: hm.noData ? colors.textMuted : ss.text }}
                rightSlot={hm.gaugePosition != null ? <GaugeBar position={hm.gaugePosition} color={ss.text} /> : undefined}
                noData={hm.noData}
              />
            );
          })}

          {!appleHealthEnabled && <HealthDataConnectPrompt />}
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
