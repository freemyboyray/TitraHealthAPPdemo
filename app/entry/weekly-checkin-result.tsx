import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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

import { useAppTheme } from '@/contexts/theme-context';
import { useHealthData } from '@/contexts/health-data';
import type { AppColors } from '@/constants/theme';
import { applyCheckinAdjustments, type CheckinScores } from '@/lib/checkin-adjustments';
import { computeBaseTargets } from '@/lib/targets';
import { useUiStore } from '@/stores/ui-store';

const ORANGE = '#FF742A';
const GREEN  = '#34C759';
const BLUE   = '#5AC8FA';
const FF     = 'Helvetica Neue';

// ─── Domain metadata ──────────────────────────────────────────────────────────

type DomainKey =
  | 'gi_burden' | 'energy_mood' | 'appetite' | 'food_noise'
  | 'sleep_quality' | 'activity_quality' | 'mental_health';

const DOMAIN_ORDER: DomainKey[] = [
  'gi_burden', 'energy_mood', 'appetite', 'food_noise',
  'sleep_quality', 'activity_quality', 'mental_health',
];

const DOMAIN_META: Record<DomainKey, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  gi_burden:        { label: 'GI Symptoms',   icon: 'medical-outline' },
  energy_mood:      { label: 'Energy & Mood', icon: 'flash-outline' },
  appetite:         { label: 'Appetite',       icon: 'restaurant-outline' },
  food_noise:       { label: 'Food Noise',     icon: 'volume-medium-outline' },
  sleep_quality:    { label: 'Sleep',          icon: 'moon-outline' },
  activity_quality: { label: 'Activity',       icon: 'barbell-outline' },
  mental_health:    { label: 'Mental Health',  icon: 'heart-outline' },
};

// ─── Explanation copy (GLP-1 specific, score-bucketed) ────────────────────────

function getExplanation(key: DomainKey, score: number): string {
  switch (key) {
    case 'gi_burden':
      if (score >= 80) return 'Minimal GI symptoms. Your body is tolerating the medication well. Continue with your normal targets.';
      if (score >= 55) return 'Mild GI symptoms are very common on GLP-1, especially after dose increases. Smaller meals, more water, and bland foods help significantly.';
      if (score >= 30) return 'Moderate GI burden. Targets have been adjusted to ease your system. Focus on hydration and light, frequent meals.';
      return 'Significant GI symptoms are affecting your daily routine. Targets have been reduced. Contact your prescriber if symptoms persist beyond a week.';

    case 'energy_mood':
      if (score >= 75) return 'Energy and mood are strong this week. Consistent sleep and protein intake help maintain this through treatment.';
      if (score >= 50) return 'Energy is in a typical range for GLP-1 therapy. Sleep quality and protein are the biggest levers to improve this.';
      if (score >= 25) return 'Low energy is common during dose-escalation. Prioritize sleep and protein. Both directly affect GLP-1 outcomes.';
      return 'Very low energy or mood for multiple weeks warrants a conversation with your care team.';

    case 'appetite':
      if (score >= 75) return 'Excellent appetite control. Stay consistent with protein targets to protect lean mass.';
      if (score >= 50) return 'Appetite is moderately controlled. Normal for early treatment weeks.';
      if (score >= 25) return "Smaller, more frequent meals help GLP-1's gastric emptying mechanism work better.";
      return "Very low appetite may reflect early treatment. Note your injection timing and discuss with your prescriber if it persists.";

    case 'food_noise':
      if (score >= 80) return 'Food noise is minimal. GLP-1 is effectively quieting cravings. This is your prime window to build lasting habits.';
      if (score >= 55) return 'Mild food thoughts are present. Common in early weeks as the medication builds up.';
      if (score >= 30) return 'Moderate food noise may mean the medication is still titrating. Protein and fiber both help reduce cravings.';
      return "High food noise can indicate the medication hasn't fully taken effect. Discuss with your prescriber if this persists.";

    case 'sleep_quality':
      if (score >= 80) return 'Excellent sleep this week. Quality rest amplifies GLP-1\'s metabolic effects and supports lean mass preservation.';
      if (score >= 55) return 'Decent sleep with some disruption. Even small improvements like a consistent bedtime and cool room can meaningfully improve outcomes.';
      if (score >= 30) return 'Disrupted sleep reduces satiety hormone effectiveness. Activity targets have been eased to account for lower energy.';
      return "Poor sleep significantly affects weight loss and recovery. If side effects are disturbing your sleep, discuss timing adjustments with your prescriber.";

    case 'activity_quality':
      if (score >= 80) return 'Strong activity week. Resistance training and consistent steps are the best way to preserve lean mass on GLP-1. Keep it up.';
      if (score >= 50) return 'Moderate activity is a solid foundation. Adding even one resistance session per week makes a meaningful difference for lean mass.';
      if (score >= 25) return 'Low activity this week. Targets have been adjusted down to stay achievable. Light walks are still beneficial.';
      return 'Very low activity reported. Rest is appropriate if symptomatic, but try to include short walks when possible.';

    case 'mental_health':
      if (score >= 80) return 'Good mental health this week. Stable mood supports consistent habits, the foundation of long-term GLP-1 success.';
      if (score >= 55) return 'Mild mood fluctuations are common during treatment. Protein, exercise, and social connection are evidence-based supports.';
      if (score >= 30) return 'Moderate mood concerns noted. Targets have been gently adjusted. Speaking with a mental health provider is recommended if this continues.';
      return 'Significant mood or anxiety this week. Please consider discussing these results with your healthcare provider. Your targets have been adjusted to reduce pressure.';
  }
}

function scoreColor(score: number): string {
  if (score >= 70) return '#27AE60';
  if (score >= 50) return '#F6CB45';
  if (score >= 30) return '#E8960C';
  return '#E53E3E';
}

function mlToOz(ml: number) { return Math.round(ml / 29.5735); }

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassBorder({ r = 20 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: r, borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.13)',
        borderLeftColor: 'rgba(255,255,255,0.08)',
        borderRightColor: 'rgba(255,255,255,0.03)',
        borderBottomColor: 'rgba(255,255,255,0.02)',
      }}
    />
  );
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[{
      borderRadius: 20, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
    }, style]}>
      <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
      <GlassBorder r={20} />
      {children}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklyCheckinResultScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => `rgba(255,255,255,${a})`;

  const params = useLocalSearchParams<{ scores: string; labels: string }>();

  const scores: Record<string, number> = useMemo(() => {
    try { return JSON.parse(params.scores ?? '{}'); } catch { return {}; }
  }, [params.scores]);

  const labels: Record<string, string> = useMemo(() => {
    try { return JSON.parse(params.labels ?? '{}'); } catch { return {}; }
  }, [params.labels]);

  const { profile } = useHealthData();
  const { openAiChat } = useUiStore();

  const showProviderBanner = (scores['mental_health'] ?? 100) < 30;

  // ── Target adjustments ───────────────────────────────────────────────────────

  const metricRows = useMemo(() => {
    const base = computeBaseTargets(profile);
    const baseWithActive = { ...base, activeCaloriesTarget: base.activeMinutes * 3 };

    const checkinScores: CheckinScores = {
      foodNoise:       scores['food_noise']       ?? null,
      energyMood:      scores['energy_mood']      ?? null,
      appetite:        scores['appetite']          ?? null,
      giBurden:        scores['gi_burden']         ?? null,
      activityQuality: scores['activity_quality'] ?? null,
      sleepQuality:    scores['sleep_quality']    ?? null,
      mentalHealth:    scores['mental_health']    ?? null,
    };

    const adjusted = applyCheckinAdjustments(baseWithActive, checkinScores);
    const rows: Array<{
      icon: React.ReactNode;
      label: string;
      before: string;
      after: string;
      delta: string;
      increased: boolean;
      reason: string;
    }> = [];

    const calDiff = adjusted.caloriesTarget - baseWithActive.caloriesTarget;
    if (Math.abs(calDiff) >= 50) rows.push({
      icon: <MaterialIcons name="local-fire-department" size={18} color={ORANGE} />,
      label: 'Daily Calories',
      before: `${baseWithActive.caloriesTarget} kcal`,
      after:  `${adjusted.caloriesTarget} kcal`,
      delta:  `${calDiff > 0 ? '+' : ''}${calDiff} kcal`,
      increased: calDiff > 0,
      reason: calDiff < 0
        ? 'Calorie target eased to reduce the burden on your body this week.'
        : 'Calorie target increased to support your energy needs.',
    });

    const stepsDiff = adjusted.steps - baseWithActive.steps;
    if (Math.abs(stepsDiff) >= 200) rows.push({
      icon: <MaterialIcons name="directions-walk" size={18} color={GREEN} />,
      label: 'Daily Steps',
      before: `${baseWithActive.steps.toLocaleString()}`,
      after:  `${adjusted.steps.toLocaleString()}`,
      delta:  `${stepsDiff > 0 ? '+' : ''}${stepsDiff.toLocaleString()}`,
      increased: stepsDiff > 0,
      reason: stepsDiff > 0
        ? 'Higher activity target reflects your strong weekly performance. Keep building.'
        : 'Step target reduced to keep goals realistic given what you reported this week.',
    });

    const proteinDiff = adjusted.proteinG - baseWithActive.proteinG;
    if (Math.abs(proteinDiff) >= 1) rows.push({
      icon: <MaterialIcons name="restaurant" size={18} color={ORANGE} />,
      label: 'Daily Protein',
      before: `${baseWithActive.proteinG}g`,
      after:  `${adjusted.proteinG}g`,
      delta:  `${proteinDiff > 0 ? '+' : ''}${proteinDiff}g`,
      increased: proteinDiff > 0,
      reason: 'Protein is the single most important nutrient for preserving lean mass on GLP-1. Try eggs, Greek yogurt, or a protein shake.',
    });

    const waterDiffMl = adjusted.waterMl - baseWithActive.waterMl;
    const waterDiffOz = mlToOz(Math.abs(waterDiffMl));
    if (waterDiffOz >= 2) rows.push({
      icon: <Ionicons name="water-outline" size={18} color={BLUE} />,
      label: 'Daily Water',
      before: `${mlToOz(baseWithActive.waterMl)} oz`,
      after:  `${mlToOz(adjusted.waterMl)} oz`,
      delta:  `${waterDiffMl > 0 ? '+' : '-'}${waterDiffOz} oz`,
      increased: waterDiffMl > 0,
      reason: 'Extra hydration helps manage GI symptoms and supports medication absorption. Sip steadily throughout the day.',
    });

    const carbsDiff = adjusted.carbsG - baseWithActive.carbsG;
    if (Math.abs(carbsDiff) >= 3) rows.push({
      icon: <MaterialIcons name="grain" size={18} color="#F6CB45" />,
      label: 'Daily Carbs',
      before: `${baseWithActive.carbsG}g`,
      after:  `${adjusted.carbsG}g`,
      delta:  `${carbsDiff > 0 ? '+' : ''}${carbsDiff}g`,
      increased: carbsDiff > 0,
      reason: carbsDiff > 0
        ? 'A modest carb boost provides steady fuel. Focus on complex sources: oats, sweet potato, whole grains.'
        : 'Carb target reduced to lower GI load.',
    });

    return rows;
  }, [profile, scores]);

  const aiContext = useMemo(() =>
    DOMAIN_ORDER
      .filter((key) => scores[key] != null)
      .map((key) => `${DOMAIN_META[key].label}: ${labels[key] ?? scores[key]}`)
      .join(', '),
    [scores, labels],
  );

  const aiChips = [
    'What should I focus on most this week?',
    'How do my results compare to what is typical on GLP-1?',
    'What can I do to improve my GI symptoms?',
    'How does sleep affect my weight loss results?',
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 20, paddingTop: insets.top + 14, paddingBottom: 14,
      }}>
        <View style={s.pill}>
          <Ionicons name="checkmark-circle" size={13} color={ORANGE} style={{ marginRight: 4 }} />
          <Text style={s.pillText}>Check-In Complete</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >

        {/* Provider banner for high mental health concerns */}
        {showProviderBanner && (
          <View style={[s.card, {
            marginBottom: 12, borderWidth: 1,
            borderColor: 'rgba(246,203,69,0.4)',
            backgroundColor: 'rgba(246,203,69,0.08)',
            overflow: 'hidden',
          }]}>
            <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="alert-circle" size={22} color="#F6CB45" />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: '#FFF', fontFamily: FF, lineHeight: 18 }}>
                Your mental health responses suggest it may be helpful to speak with your healthcare provider this week.
              </Text>
            </View>
          </View>
        )}

        {/* ── THIS WEEK — domain status + explanations (FIRST) ─────────────── */}
        <GlassCard style={{ marginBottom: 14 }}>
          <View style={{ padding: 20 }}>
            <Text style={s.sectionTitle}>THIS WEEK</Text>

            {DOMAIN_ORDER.map((key, i) => {
              const score  = scores[key];
              const label  = labels[key];
              if (score == null) return null;

              const meta        = DOMAIN_META[key];
              const color       = scoreColor(score);
              const explanation = getExplanation(key, score);
              const isLast      = i === DOMAIN_ORDER.length - 1;

              return (
                <View
                  key={key}
                  style={{
                    paddingVertical: 14,
                    borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                    borderBottomColor: 'rgba(255,255,255,0.07)',
                  }}
                >
                  {/* Label row */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: 6,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{
                        width: 28, height: 28, borderRadius: 14,
                        backgroundColor: 'rgba(255,116,42,0.12)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name={meta.icon} size={15} color={ORANGE} />
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF', fontFamily: FF }}>
                        {meta.label}
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: `${color}22`,
                      borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3,
                    }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color, fontFamily: FF }}>
                        {label}
                      </Text>
                    </View>
                  </View>

                  {/* Explanation */}
                  <Text style={{ fontSize: 13, color: w(0.5), fontFamily: FF, lineHeight: 18 }}>
                    {explanation}
                  </Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* ── ADJUSTMENTS ────────────────────────────────────────────────────── */}
        {metricRows.length > 0 ? (
          <GlassCard style={{ marginBottom: 14 }}>
            <View style={{ padding: 20 }}>
              <Text style={s.sectionTitle}>THIS WEEK'S ADJUSTMENTS</Text>

              {metricRows.map((row, i) => {
                const arrowColor = row.increased ? ORANGE : BLUE;
                const isLast     = i === metricRows.length - 1;
                return (
                  <View
                    key={row.label}
                    style={{
                      paddingVertical: 14,
                      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                      borderBottomColor: 'rgba(255,255,255,0.07)',
                    }}
                  >
                    <View style={{
                      flexDirection: 'row', alignItems: 'center',
                      justifyContent: 'space-between', marginBottom: 8,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {row.icon}
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF', fontFamily: FF }}>
                          {row.label}
                        </Text>
                      </View>
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
                        backgroundColor: row.increased ? 'rgba(255,116,42,0.12)' : 'rgba(90,200,250,0.12)',
                      }}>
                        <Ionicons
                          name={row.increased ? 'arrow-up' : 'arrow-down'}
                          size={11}
                          color={arrowColor}
                        />
                        <Text style={{ fontSize: 12, fontWeight: '800', color: arrowColor, fontFamily: FF }}>
                          {row.delta}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 20, fontWeight: '300', color: w(0.35), fontFamily: FF }}>
                        {row.before}
                      </Text>
                      <Ionicons name="arrow-forward" size={14} color={w(0.25)} />
                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFF', fontFamily: FF }}>
                        {row.after}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: w(0.4), fontFamily: FF, marginTop: 5, lineHeight: 17 }}>
                      {row.reason}
                    </Text>
                  </View>
                );
              })}
            </View>
          </GlassCard>
        ) : (
          <GlassCard style={{ marginBottom: 14 }}>
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={28} color={GREEN} style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF', fontFamily: FF }}>
                No adjustments needed
              </Text>
              <Text style={{ fontSize: 13, color: w(0.45), fontFamily: FF, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                Your scores are in a healthy range. Continue with your regular targets.
              </Text>
            </View>
          </GlassCard>
        )}

        {/* ── AI COACH ────────────────────────────────────────────────────────── */}
        <GlassCard style={{ borderWidth: 1, borderColor: 'rgba(255,116,42,0.15)' }}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: 'rgba(255,116,42,0.12)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <MaterialIcons name="auto-awesome" size={16} color={ORANGE} />
              </View>
              <Text style={{ fontSize: 10, fontWeight: '800', color: ORANGE, fontFamily: FF, letterSpacing: 1.5 }}>
                AI COACH
              </Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF', fontFamily: FF, letterSpacing: -0.2, marginTop: 6, marginBottom: 4 }}>
              Questions about your results?
            </Text>
            <Text style={{ fontSize: 12, color: w(0.4), fontFamily: FF, lineHeight: 17, marginBottom: 16 }}>
              Ask why your targets changed, what to focus on, or anything about this week.
            </Text>

            <View style={{ gap: 8, marginBottom: 14 }}>
              {aiChips.map((chip) => (
                <TouchableOpacity
                  key={chip}
                  activeOpacity={0.75}
                  style={s.chip}
                  onPress={() => openAiChat({
                    type: 'focus',
                    contextLabel: 'Weekly Check-In',
                    contextValue: aiContext,
                    seedMessage: chip,
                    chips: JSON.stringify(aiChips),
                  })}
                >
                  <Text style={s.chipText}>{chip}</Text>
                  <Ionicons name="arrow-forward" size={13} color={ORANGE} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              style={s.askBtn}
              onPress={() => openAiChat({
                type: 'focus',
                contextLabel: 'Weekly Check-In',
                contextValue: aiContext,
                chips: JSON.stringify(aiChips),
              })}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFF" />
              <Text style={s.askBtnText}>Ask anything</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

      </ScrollView>

      {/* Done CTA */}
      <View style={{
        paddingHorizontal: 20, paddingTop: 12,
        paddingBottom: insets.bottom + 16,
        backgroundColor: '#000',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
      }}>
        <TouchableOpacity style={s.doneBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (_c: AppColors) => StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,116,42,0.15)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  pillText: { fontSize: 13, fontWeight: '700', color: ORANGE, fontFamily: FF },

  card: {
    borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
  },

  sectionTitle: {
    fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.35)',
    fontFamily: FF, letterSpacing: 1.5, marginBottom: 2,
  },

  chip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,116,42,0.25)',
    backgroundColor: 'rgba(255,116,42,0.07)',
  },
  chipText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#FFF', fontFamily: FF },

  askBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 48, borderRadius: 24, backgroundColor: ORANGE,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  askBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF', fontFamily: FF },

  doneBtn: {
    backgroundColor: ORANGE, borderRadius: 28, paddingVertical: 17,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
  },
  doneBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF', fontFamily: FF, letterSpacing: 0.4 },
});
