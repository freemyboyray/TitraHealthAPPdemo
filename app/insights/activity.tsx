import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActivityDailyCard,
  HealthDataConnectPrompt,
  HealthMonitorCard,
} from '@/app/(tabs)/log';
import type { AppColors } from '@/constants/theme';
import { categoryColor } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { useLifestyleMetrics } from '@/hooks/use-lifestyle-metrics';
import { ChevronLeft } from 'lucide-react-native';

export default function ActivityDetailScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const {
    todayActiveCalories, todaySteps,
    targets,
    adjustMetric,
    appleHealthEnabled,
    routedHealthGroups,
  } = useLifestyleMetrics();

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Activity</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.dailyGrid}>
          <ActivityDailyCard
            value={todayActiveCalories > 0 ? todayActiveCalories.toLocaleString() : '-'}
            label="Calories Burned"
            ringColor={categoryColor(colors.isDark, 'activity')}
            current={todayActiveCalories}
            target={targets.activeCaloriesTarget}
            unit=" cal"
            emptyCtaLabel="Log Activity"
            onEmptyCta={() => router.push('/entry/log-activity')}
            onIncrement={() => adjustMetric('activeCal', 50)}
            onDecrement={() => adjustMetric('activeCal', -50)}
          />
          <ActivityDailyCard
            value={todaySteps > 0 ? todaySteps.toLocaleString() : '-'}
            label="Daily Steps"
            ringColor={colors.textPrimary}
            current={todaySteps}
            target={targets.steps}
            unit=" steps"
            emptyCtaLabel="Log Activity"
            onEmptyCta={() => router.push('/entry/log-activity')}
            onIncrement={() => adjustMetric('steps', 1000)}
            onDecrement={() => adjustMetric('steps', -1000)}
          />
        </View>

        {!appleHealthEnabled ? (
          <View style={{ marginTop: 16 }}>
            <HealthDataConnectPrompt />
          </View>
        ) : routedHealthGroups.activity.length === 0 ? (
          <Text style={s.emptyText}>
            No Apple Health activity data yet. Workouts, exercise minutes, and distance will populate here as Apple Health collects them.
          </Text>
        ) : (
          (() => {
            // Flat grid under the nav title — Activity + Workouts merged, no group labels.
            const allMetrics = routedHealthGroups.activity.flatMap((g) => g.metrics);
            const isOdd = allMetrics.length % 2 !== 0;
            return (
              <View style={[s.hmGrid, { marginTop: 16 }]}>
                {allMetrics.map((m, i) => (
                  <HealthMonitorCard key={m.id} metric={m} fullWidth={isOdd && i === allMetrics.length - 1} />
                ))}
              </View>
            );
          })()
        )}
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
      paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '700', fontFamily: 'System', letterSpacing: -0.2 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 36 },
    dailyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    hmGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 8 },
    emptyText: { fontSize: 15, color: w(0.4), fontFamily: 'System', paddingVertical: 8, marginTop: 12 },
  });
};
