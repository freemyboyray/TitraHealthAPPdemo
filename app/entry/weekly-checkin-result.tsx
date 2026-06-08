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

import { SolidCard } from '@/components/ui/solid-card';
import { BarGroup, type Bar } from '@/components/insights/bar-group';
import { useAppTheme } from '@/contexts/theme-context';
import { useHealthData } from '@/contexts/health-data';
import type { AppColors } from '@/constants/theme';
import { buildAdjustmentRows } from '@/lib/checkin-target-rows';
import { useLogStore } from '@/stores/log-store';
import {
  CHECKIN_ASSETS, DOMAIN_BY_KEY, DOMAIN_ORDER, scoreColor, type CheckinDomainKey,
} from '@/constants/checkin-domains';
import { AlertCircle, ArrowDown, ArrowRight, ArrowUp, Minus } from 'lucide-react-native';

const GREEN = '#27AE60';
const FF = 'System';

// ─── Explanation copy (GLP-1 specific, label-bucketed) ────────────────────────

function getExplanation(key: CheckinDomainKey, label: string): string {
  switch (key) {
    case 'gi_burden':
      switch (label) {
        case 'Minimal': return 'Minimal GI symptoms. Your body is tolerating the medication well. Continue with your normal targets.';
        case 'Mild':    return 'Mild GI symptoms are very common on GLP-1, especially after dose increases. Smaller meals, more water, and bland foods help significantly.';
        case 'Moderate': return 'Moderate GI burden. Targets have been adjusted to ease your system. Focus on hydration and light, frequent meals.';
        default:        return 'Significant GI symptoms are affecting your daily routine. Targets have been reduced. Contact your prescriber if symptoms persist beyond a week.';
      }
    case 'energy_mood':
      switch (label) {
        case 'Excellent': return 'Energy and mood are strong this week. Consistent sleep and protein intake help maintain this through treatment.';
        case 'Good':      return 'Energy is in a typical range for GLP-1 therapy. Sleep quality and protein are the biggest levers to improve this.';
        case 'Fair':      return 'Low energy is common during dose-escalation. Prioritize sleep and protein. Both directly affect GLP-1 outcomes.';
        default:          return 'Very low energy or mood for multiple weeks warrants a conversation with your care team.';
      }
    case 'appetite':
      switch (label) {
        case 'Excellent': return 'Excellent appetite control. Stay consistent with protein targets to protect lean mass.';
        case 'Good':      return 'Appetite is moderately controlled. Normal for early treatment weeks.';
        case 'Fair':      return "Smaller, more frequent meals help GLP-1's gastric emptying mechanism work better.";
        default:          return "Very low appetite may reflect early treatment. Note your injection timing and discuss with your prescriber if it persists.";
      }
    case 'food_noise':
      switch (label) {
        case 'Quiet':    return 'Food noise is minimal. GLP-1 is effectively quieting cravings. This is your prime window to build lasting habits.';
        case 'Mild':     return 'Mild food thoughts are present. Common in early weeks as the medication builds up.';
        case 'Moderate': return 'Moderate food noise may mean the medication is still titrating. Protein and fiber both help reduce cravings.';
        default:         return "High food noise can indicate the medication hasn't fully taken effect. Discuss with your prescriber if this persists.";
      }
    case 'sleep_quality':
      switch (label) {
        case 'Excellent': return "Excellent sleep this week. Quality rest amplifies GLP-1's metabolic effects and supports lean mass preservation.";
        case 'Good':      return 'Decent sleep with some disruption. Even small improvements like a consistent bedtime and cool room can meaningfully improve outcomes.';
        case 'Fair':      return 'Disrupted sleep reduces satiety hormone effectiveness. Activity targets have been eased to account for lower energy.';
        default:          return 'Poor sleep significantly affects weight loss and recovery. If side effects are disturbing your sleep, discuss timing adjustments with your prescriber.';
      }
    case 'activity_quality':
      switch (label) {
        case 'Excellent': return 'Strong activity week. Resistance training and consistent steps are the best way to preserve lean mass on GLP-1. Keep it up.';
        case 'Good':      return 'Moderate activity is a solid foundation. Adding even one resistance session per week makes a meaningful difference for lean mass.';
        case 'Fair':      return 'Low activity this week. Targets have been adjusted down to stay achievable. Light walks are still beneficial.';
        default:          return 'Very low activity reported. Rest is appropriate if symptomatic, but try to include short walks when possible.';
      }
    case 'mental_health':
      switch (label) {
        case 'Stable':   return 'Good mental health this week. Stable mood supports consistent habits, the foundation of long-term GLP-1 success.';
        case 'Mild':     return 'Mild mood fluctuations are common during treatment. Protein, exercise, and social connection are evidence-based supports.';
        case 'Moderate': return 'Moderate mood concerns noted. Targets have been gently adjusted. Speaking with a mental health provider is recommended if this continues.';
        default:         return 'Significant mood or anxiety this week. Please consider discussing these results with your healthcare provider. Your targets have been adjusted to reduce pressure.';
      }
  }
}

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
          const meta = DOMAIN_BY_KEY[key];
          const label = labels[key];
          const color = scoreColor(score);
          const avg = avgScores[key];
          const explanation = getExplanation(key, label ?? '');

          const bars: Bar[] = [
            { label: 'This week', pct: score, display: String(score), color, bold: true },
          ];
          if (avg != null) bars.push({ label: 'Average', pct: avg, display: String(avg), color: w(0.3) });

          const delta = avg != null ? score - avg : null;

          return (
            <SolidCard key={key} radius={24} style={{ marginBottom: 12 }}>
              <View style={{ padding: 18 }}>
                <View style={s.domainTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={[s.assetWrap, { backgroundColor: meta.color + '1A' }]}>
                      <Image source={CHECKIN_ASSETS[key]} style={s.assetImg} resizeMode="contain" accessibilityIgnoresInvertColors />
                    </View>
                    <Text style={s.domainLabel}>{meta.label}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: `${color}22` }]}>
                    <Text style={[s.statusText, { color }]}>{label}</Text>
                  </View>
                </View>

                <BarGroup bars={bars} colors={colors} />

                {/* Trend vs average */}
                <View style={s.trendRow}>
                  {delta == null ? (
                    <Text style={[s.trendText, { color: w(0.4) }]}>First check-in — no past weeks to compare yet.</Text>
                  ) : delta === 0 ? (
                    <>
                      <Minus size={13} color={w(0.4)} />
                      <Text style={[s.trendText, { color: w(0.4) }]}>Right in line with your average.</Text>
                    </>
                  ) : delta > 0 ? (
                    <>
                      <ArrowUp size={13} color={GREEN} />
                      <Text style={[s.trendText, { color: GREEN }]}>{delta} better than your average.</Text>
                    </>
                  ) : (
                    <>
                      <ArrowDown size={13} color="#E8960C" />
                      <Text style={[s.trendText, { color: '#E8960C' }]}>{Math.abs(delta)} below your average.</Text>
                    </>
                  )}
                </View>

                <Text style={s.explanation}>{explanation}</Text>
              </View>
            </SolidCard>
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

    sectionHeader: { fontSize: 13, fontWeight: '800', color: w(0.4), fontFamily: FF, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },

    banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 18 },
    bannerText: { flex: 1, fontSize: 15, fontWeight: '600', color: c.textPrimary, fontFamily: FF, lineHeight: 19 },

    domainTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    assetWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    assetImg: { width: 38, height: 38 },
    domainLabel: { fontSize: 17, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.3, flexShrink: 1 },
    statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    statusText: { fontSize: 14, fontWeight: '700', fontFamily: FF },

    trendRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
    trendText: { fontSize: 13.5, fontWeight: '600', fontFamily: FF },

    explanation: { fontSize: 14.5, color: w(0.5), fontFamily: FF, lineHeight: 19, marginTop: 12 },

    ctaWrap: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth },
    doneBtn: { flexDirection: 'row', backgroundColor: c.orange, borderRadius: 999, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', shadowColor: c.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 10 },
    doneBtnText: { fontSize: 18, fontWeight: '800', color: '#FFF', fontFamily: FF, letterSpacing: 0.4 },
  });
};
