import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  HealthDataConnectPrompt,
  HealthMonitorCard,
} from '@/app/(tabs)/log';
import type { AppColors } from '@/constants/theme';
import { HEALTH_SERVICE_NAME } from '@/lib/health-service';
import { useAppTheme } from '@/contexts/theme-context';
import { useLifestyleMetrics } from '@/hooks/use-lifestyle-metrics';
import { ChevronLeft } from 'lucide-react-native';

export default function VitalsDetailScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const { appleHealthEnabled, routedHealthGroups } = useLifestyleMetrics();

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Vitals</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {!appleHealthEnabled ? (
          <HealthDataConnectPrompt />
        ) : routedHealthGroups.vitals.length === 0 ? (
          <Text style={s.emptyText}>
            No vitals data yet. {HEALTH_SERVICE_NAME} will populate this as it collects readings.
          </Text>
        ) : (
          (() => {
            // Flat grid under the nav title — all vitals categories merged, no group labels.
            const allMetrics = routedHealthGroups.vitals.flatMap((g) => g.metrics);
            const isOdd = allMetrics.length % 2 !== 0;
            return (
              <View style={s.hmGrid}>
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
    hmGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 8 },
    emptyText: { fontSize: 15, color: w(0.4), fontFamily: 'System', paddingVertical: 8 },
  });
};
