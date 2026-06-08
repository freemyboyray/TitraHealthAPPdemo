import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { CircleIconButton } from '@/components/ui/circle-icon-button';
import { SolidCard } from '@/components/ui/solid-card';
import { BarGroup, type Bar } from '@/components/insights/bar-group';
import { useAppTheme } from '@/contexts/theme-context';
import { useHealthData } from '@/contexts/health-data';
import type { AppColors } from '@/constants/theme';
import { buildAdjustmentRows, ADJUSTMENT_IMAGE } from '@/lib/checkin-target-rows';
import { ArrowDown, ArrowUp, CircleCheck } from 'lucide-react-native';

const BLUE = '#5AC8FA';
const GREEN = '#27AE60';
const FF = 'System';

export default function WeeklyCheckinTargetsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  const params = useLocalSearchParams<{ scores: string }>();
  const scores: Record<string, number> = useMemo(() => {
    try { return JSON.parse(params.scores ?? '{}'); } catch { return {}; }
  }, [params.scores]);

  const { profile } = useHealthData();
  const rows = useMemo(() => buildAdjustmentRows(profile, scores), [profile, scores]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <CircleIconButton icon={ChevronLeft} onPress={() => router.back()} accessibilityLabel="Go back" />
        <Text style={s.headerTitle}>Your New Targets</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.intro}>
          Based on how your week went, we've tuned this week's daily targets. They'll show up across your dashboard.
        </Text>

        {rows.length > 0 ? (
          rows.map((row) => {
            const accent = row.increased ? colors.orange : BLUE;
            const max = Math.max(row.before, row.after, 1);
            const bars: Bar[] = [
              { label: 'Before', pct: (row.before / max) * 100, display: row.beforeStr, color: w(0.22) },
              { label: 'After', pct: (row.after / max) * 100, display: row.afterStr, color: accent, bold: true },
            ];
            return (
              <SolidCard key={row.key} radius={24} style={{ marginBottom: 12 }}>
                <View style={{ padding: 18 }}>
                  <View style={s.rowTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={[s.assetWrap, { backgroundColor: w(0.05) }]}>
                        <Image source={ADJUSTMENT_IMAGE[row.imageKey]} style={s.assetImg} resizeMode="contain" accessibilityIgnoresInvertColors />
                      </View>
                      <Text style={s.label}>{row.label}</Text>
                    </View>
                    <View style={[s.deltaPill, { backgroundColor: row.increased ? 'rgba(255,116,42,0.12)' : 'rgba(90,200,250,0.12)' }]}>
                      {row.increased ? <ArrowUp size={11} color={accent} /> : <ArrowDown size={11} color={accent} />}
                      <Text style={[s.deltaText, { color: accent }]}>{row.delta}</Text>
                    </View>
                  </View>

                  <BarGroup bars={bars} colors={colors} />

                  <Text style={s.reason}>{row.reason}</Text>
                </View>
              </SolidCard>
            );
          })
        ) : (
          <SolidCard radius={24}>
            <View style={{ padding: 24, alignItems: 'center' }}>
              <CircleCheck size={30} color={GREEN} style={{ marginBottom: 10 }} />
              <Text style={s.noAdjTitle}>No adjustments needed</Text>
              <Text style={s.noAdjBody}>Your scores are in a healthy range. Continue with your regular targets.</Text>
            </View>
          </SolidCard>
        )}
      </ScrollView>

      {/* Done CTA */}
      <View style={[s.ctaWrap, { paddingBottom: insets.bottom + 16, borderTopColor: w(0.06) }]}>
        <TouchableOpacity style={s.doneBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.4 },

    intro: { fontSize: 15.5, color: w(0.5), fontFamily: FF, lineHeight: 21, marginBottom: 18, marginTop: 4 },

    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    assetWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    assetImg: { width: 38, height: 38 },
    label: { fontSize: 17, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.3, flexShrink: 1 },
    deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    deltaText: { fontSize: 14, fontWeight: '800', fontFamily: FF },
    reason: { fontSize: 14.5, color: w(0.5), fontFamily: FF, lineHeight: 19, marginTop: 12 },

    noAdjTitle: { fontSize: 17, fontWeight: '800', color: c.textPrimary, fontFamily: FF },
    noAdjBody: { fontSize: 15, color: w(0.45), fontFamily: FF, marginTop: 6, textAlign: 'center', lineHeight: 19 },

    ctaWrap: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth },
    doneBtn: { backgroundColor: c.orange, borderRadius: 999, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', shadowColor: c.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 10 },
    doneBtnText: { fontSize: 18, fontWeight: '800', color: '#FFF', fontFamily: FF, letterSpacing: 0.4 },
  });
};
