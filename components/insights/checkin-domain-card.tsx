import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react-native';

import { SolidCard } from '@/components/ui/solid-card';
import { BarGroup, type Bar } from '@/components/insights/bar-group';
import type { AppColors } from '@/constants/theme';
import {
  CHECKIN_ASSETS, DOMAIN_BY_KEY, scoreColor, type CheckinDomainKey,
} from '@/constants/checkin-domains';

const GREEN = '#27AE60';
const AMBER = '#E8960C';
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

/**
 * One domain's result card: section asset + status badge, a "this week vs your
 * average" bar comparison, a trend line, and the GLP-1 explanation. Shared by the
 * check-in result screen and the past-check-in detail screen.
 */
export function CheckinDomainCard({
  domainKey, score, avg, statusLabel, currentLabel = 'This week', colors,
}: {
  domainKey: CheckinDomainKey;
  score: number;
  avg: number | null;
  statusLabel: string;
  currentLabel?: string;
  colors: AppColors;
}) {
  const meta = DOMAIN_BY_KEY[domainKey];
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const s = styles(colors);
  const color = scoreColor(score);
  const explanation = getExplanation(domainKey, statusLabel);

  const bars: Bar[] = [{ label: currentLabel, pct: score, display: String(score), color, bold: true }];
  if (avg != null) bars.push({ label: 'Average', pct: avg, display: String(avg), color: w(0.3) });
  const delta = avg != null ? score - avg : null;

  return (
    <SolidCard radius={24} style={{ marginBottom: 12 }}>
      <View style={{ padding: 18 }}>
        <View style={s.top}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Image source={CHECKIN_ASSETS[domainKey]} style={s.assetImg} resizeMode="contain" accessibilityIgnoresInvertColors />
            <Text style={s.label}>{meta.label}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: `${color}22` }]}>
            <Text style={[s.statusText, { color }]}>{statusLabel}</Text>
          </View>
        </View>

        <BarGroup bars={bars} colors={colors} />

        <View style={s.trendRow}>
          {delta == null ? (
            <Text style={[s.trendText, { color: w(0.4) }]}>First check-in. No past weeks to compare yet.</Text>
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
              <ArrowDown size={13} color={AMBER} />
              <Text style={[s.trendText, { color: AMBER }]}>{Math.abs(delta)} below your average.</Text>
            </>
          )}
        </View>

        <Text style={s.explanation}>{explanation}</Text>
      </View>
    </SolidCard>
  );
}

const styles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    assetImg: { width: 44, height: 44 },
    label: { fontSize: 17, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.3, flexShrink: 1 },
    statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    statusText: { fontSize: 14, fontWeight: '700', fontFamily: FF },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
    trendText: { fontSize: 13.5, fontWeight: '600', fontFamily: FF },
    explanation: { fontSize: 14.5, color: w(0.5), fontFamily: FF, lineHeight: 19, marginTop: 12 },
  });
};
