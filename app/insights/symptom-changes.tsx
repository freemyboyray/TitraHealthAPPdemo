import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { useLogStore } from '@/stores/log-store';
import type { AppColors } from '@/constants/theme';
import { computeSymptomTrends } from '@/lib/side-effect-insights';
import { buildSideEffectDigest } from '@/lib/side-effect-insights-ai';
import { useSideEffectInsightsAi } from '@/hooks/use-side-effect-insights-ai';
import { SymptomDetailRow } from '@/components/insights/symptom-detail-row';

const FF = 'System';

export default function SymptomChangesScreen() {
  const { colors } = useAppTheme();
  const { profile } = useProfile();
  const s = useMemo(() => createStyles(colors), [colors]);

  const sideEffectLogs = useLogStore(st => st.sideEffectLogs);
  const injectionLogs = useLogStore(st => st.injectionLogs);

  const trends = useMemo(() => computeSymptomTrends(sideEffectLogs), [sideEffectLogs]);
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
        <Text style={s.headerTitle}>Symptom Changes</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          How each symptom has trended over the last 30 days. Tap any one for its full pattern.
        </Text>

        {trends.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>No symptoms logged in the last 30 days yet.</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {trends.map(t => (
              <SymptomDetailRow key={t.type} trend={t} logs={sideEffectLogs} aiText={ai.perSymptom[t.type] ?? ''} />
            ))}
          </View>
        )}

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
      paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '700', fontFamily: FF, letterSpacing: -0.2 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 36 },
    intro: { fontSize: 14, color: w(0.5), fontFamily: FF, lineHeight: 20, marginBottom: 16 },
    empty: { padding: 24, borderRadius: 18, backgroundColor: w(0.04), alignItems: 'center' },
    emptyText: { fontSize: 14, color: w(0.5), fontFamily: FF, textAlign: 'center' },
  });
};
