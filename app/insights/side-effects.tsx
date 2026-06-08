import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, TriangleAlert } from 'lucide-react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { useLogStore } from '@/stores/log-store';
import {
  computeCoOccurrence,
  computeCycleVolume,
  computeOverallDailySeries,
  computeSymptomTrends,
  detectInjectionWeekday,
  detectRecentSpike,
  type SpikeAlert,
} from '@/lib/side-effect-insights';
import { buildSideEffectDigest } from '@/lib/side-effect-insights-ai';
import { cardElevation, type AppColors } from '@/constants/theme';
import { severityLabel } from '@/constants/side-effects';
import { isOralDrug, hasMeaningfulCycle } from '@/constants/drug-pk';
import { useSideEffectInsightsAi } from '@/hooks/use-side-effect-insights-ai';
import { effectLabel } from '@/components/insights/effect-icon';
import { SideEffectAiCard } from '@/components/insights/side-effect-ai-card';
import { CyclePatternCard } from '@/components/insights/cycle-pattern-card';
import { SymptomChangesCard } from '@/components/insights/symptom-changes-card';
import { ClusterCard } from '@/components/insights/cluster-card';

const FF = 'System';

export default function SideEffectsInsightsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile } = useProfile();
  const s = useMemo(() => createStyles(colors), [colors]);

  const sideEffectLogs = useLogStore(st => st.sideEffectLogs);
  const injectionLogs = useLogStore(st => st.injectionLogs);

  const freqDays = profile?.injectionFrequencyDays ?? 7;
  const oral = isOralDrug(profile?.glp1Type);
  const meaningfulCycle = hasMeaningfulCycle(profile?.glp1Type, freqDays);
  const weekday = useMemo(() => detectInjectionWeekday(injectionLogs), [injectionLogs]);

  const volume = useMemo(
    () => computeCycleVolume(sideEffectLogs, injectionLogs, freqDays, weekday),
    [sideEffectLogs, injectionLogs, freqDays, weekday],
  );
  const trends = useMemo(() => computeSymptomTrends(sideEffectLogs), [sideEffectLogs]);
  const pairs = useMemo(() => computeCoOccurrence(sideEffectLogs), [sideEffectLogs]);
  const spike = useMemo(() => detectRecentSpike(sideEffectLogs), [sideEffectLogs]);
  const overallBars = useMemo(
    () => computeOverallDailySeries(sideEffectLogs, 30).map(p => p.worst),
    [sideEffectLogs],
  );

  // AI digest (also pre-warmed from the Lifestyle tab, so this is usually instant).
  const digest = useMemo(
    () => buildSideEffectDigest(sideEffectLogs, injectionLogs, profile),
    [sideEffectLogs, injectionLogs, profile],
  );
  const ai = useSideEffectInsightsAi(digest.symptoms.length > 0 ? digest : null);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Side Effect Insights</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {spike && <SpikeCard spike={spike} colors={colors} />}

        <SideEffectAiCard text={ai.overall} loading={ai.loading} />

        <View style={s.section}>
          <Text style={s.sectionHeader}>Cycle Pattern</Text>
          <CyclePatternCard
            volume={volume}
            freqDays={freqDays}
            oral={oral}
            weekday={weekday}
            hasInjections={injectionLogs.length > 0}
            meaningfulCycle={meaningfulCycle}
          />
        </View>

        <View style={s.section}>
          <Text style={s.sectionHeader}>Symptom Changes</Text>
          <SymptomChangesCard
            trends={trends}
            bars={overallBars}
            onPress={() => router.push('/insights/symptom-changes')}
          />
        </View>

        <View style={s.section}>
          <Text style={s.sectionHeader}>Symptom Clusters</Text>
          <ClusterCard pairs={pairs} logs={sideEffectLogs} totalLogs={sideEffectLogs.length} />
        </View>

        <Text style={s.footnote}>
          Based on the last 30 days of logs. Patterns sharpen as you log more.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Spike alert ────────────────────────────────────────────────────────────

function SpikeCard({ spike, colors }: { spike: SpikeAlert; colors: AppColors }) {
  const s = useMemo(() => createStyles(colors), [colors]);
  const label = effectLabel(spike.type);
  const recentTier = severityLabel(spike.recentSev);
  const baseTier = severityLabel(spike.baselineSev);
  const title = baseTier === recentTier
    ? `${label} spiked to ${recentTier}`
    : `${label} spiked to ${recentTier}, usually ${baseTier}`;
  return (
    <View style={s.alertCard}>
      <View style={s.alertIconWrap}>
        <TriangleAlert size={18} color="#E74C3C" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.alertTitle}>{title}</Text>
        <Text style={s.alertBody}>
          Common triggers: a high-fat meal, missed hydration, or a recent dose change.
        </Text>
      </View>
    </View>
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
    headerTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '700', fontFamily: FF, letterSpacing: -0.2 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 18 },
    section: { gap: 10 },
    sectionHeader: { fontSize: 21, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.4, marginLeft: 2 },
    alertCard: {
      flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18,
      backgroundColor: '#E74C3C' + '14',
      ...cardElevation(c.isDark),
    },
    alertIconWrap: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: '#E74C3C' + '22',
      alignItems: 'center', justifyContent: 'center',
    },
    alertTitle: { fontSize: 14.5, fontWeight: '800', color: c.textPrimary, fontFamily: FF },
    alertBody: { fontSize: 12.5, color: w(0.6), fontFamily: FF, marginTop: 3, lineHeight: 17 },
    footnote: {
      fontSize: 11.5, color: w(0.4), textAlign: 'center',
      fontFamily: FF, marginTop: 2, paddingHorizontal: 12, lineHeight: 15,
    },
  });
};
