import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckinDomainCard } from '@/components/insights/checkin-domain-card';
import { useAppTheme } from '@/contexts/theme-context';
import { useHealthData } from '@/contexts/health-data';
import type { AppColors } from '@/constants/theme';
import { buildAdjustmentRows } from '@/lib/checkin-target-rows';
import { useLogStore } from '@/stores/log-store';
import { DOMAIN_ORDER, type CheckinDomainKey } from '@/constants/checkin-domains';
import { AlertCircle, ArrowRight } from 'lucide-react-native';

const FF = 'System';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklyCheckinResultScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  const params = useLocalSearchParams<{ scores: string; labels: string }>();
  const scores: Record<string, number> = useMemo(() => {
    try { return JSON.parse(params.scores ?? '{}'); } catch { return {}; }
  }, [params.scores]);
  const labels: Record<string, string> = useMemo(() => {
    try { return JSON.parse(params.labels ?? '{}'); } catch { return {}; }
  }, [params.labels]);

  const { profile } = useHealthData();
  const history = useLogStore((st) => st.weeklyCheckins);

  // Average of prior check-ins per domain (rows[0] is this week's, just saved).
  const avgScores = useMemo(() => {
    const out: Partial<Record<CheckinDomainKey, number>> = {};
    for (const key of DOMAIN_ORDER) {
      const prior = (history[key] ?? []).slice(1);
      if (!prior.length) continue;
      out[key] = Math.round(prior.reduce((a, r) => a + (r.score ?? 0), 0) / prior.length);
    }
    return out;
  }, [history]);

  const showProviderBanner = (scores['mental_health'] ?? 100) < 30;

  const hasAdjustments = useMemo(
    () => buildAdjustmentRows(profile, scores).length > 0,
    [profile, scores],
  );

  function handleContinue() {
    if (hasAdjustments) {
      router.push({ pathname: '/entry/weekly-checkin-targets', params: { scores: params.scores } });
    } else {
      router.replace('/(tabs)');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={[s.headerWrap, { paddingTop: insets.top + 14 }]}>
        <View style={s.pill}>
          <Text style={s.pillText}>Check-In Complete</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.screenTitle}>Your week, recapped</Text>

        {/* Provider banner */}
        {showProviderBanner && (
          <View style={[s.banner, { backgroundColor: 'rgba(246,203,69,0.10)', borderColor: 'rgba(246,203,69,0.35)' }]}>
            <AlertCircle size={22} color="#E8960C" />
            <Text style={s.bannerText}>
              Your mental health responses suggest it may be helpful to speak with your healthcare provider this week.
            </Text>
          </View>
        )}

        {/* THIS WEEK vs your average */}
        <Text style={s.sectionHeader}>How this week compared</Text>
        {DOMAIN_ORDER.map((key) => {
          const score = scores[key];
          if (score == null) return null;
          return (
            <CheckinDomainCard
              key={key}
              domainKey={key}
              score={score}
              avg={avgScores[key] ?? null}
              statusLabel={labels[key] ?? ''}
              colors={colors}
            />
          );
        })}
      </ScrollView>

      {/* CTA */}
      <View style={[s.ctaWrap, { paddingBottom: insets.bottom + 16, borderTopColor: w(0.06) }]}>
        <TouchableOpacity style={s.doneBtn} onPress={handleContinue} activeOpacity={0.85}>
          <Text style={s.doneBtnText}>{hasAdjustments ? 'See your new targets' : 'Done'}</Text>
          {hasAdjustments && <ArrowRight size={18} color="#FFF" style={{ marginLeft: 6 }} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    headerWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 10 },
    pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.orangeDim, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
    pillText: { fontSize: 15, fontWeight: '700', color: c.orange, fontFamily: FF },

    screenTitle: { fontSize: 28, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.6, textAlign: 'center', marginTop: 6, marginBottom: 20 },

    sectionHeader: { fontSize: 18, fontWeight: '700', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.2, marginBottom: 12, marginLeft: 2 },

    banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 18 },
    bannerText: { flex: 1, fontSize: 15, fontWeight: '600', color: c.textPrimary, fontFamily: FF, lineHeight: 19 },

    ctaWrap: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth },
    doneBtn: { flexDirection: 'row', backgroundColor: c.orange, borderRadius: 999, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', shadowColor: c.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 10 },
    doneBtnText: { fontSize: 18, fontWeight: '800', color: '#FFF', fontFamily: FF, letterSpacing: 0.4 },
  });
};
