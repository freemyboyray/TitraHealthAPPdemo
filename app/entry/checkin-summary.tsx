import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHealthData } from '@/contexts/health-data';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { applyCheckinAdjustments, type CheckinScores } from '@/lib/checkin-adjustments';
import { computeBaseTargets } from '@/lib/targets';
import { useLogStore } from '@/stores/log-store';
import { useUiStore } from '@/stores/ui-store';

const ORANGE = '#FF742A';
const GREEN  = '#34C759';
const BLUE   = '#5AC8FA';
const FF     = 'Helvetica Neue';

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckinType =
  | 'food_noise' | 'energy_mood' | 'appetite'
  | 'gi_burden' | 'activity_quality' | 'sleep_quality' | 'mental_health';

const TYPE_LABELS: Record<CheckinType, string> = {
  food_noise:       'Food Noise',
  energy_mood:      'Energy & Mood',
  appetite:         'Appetite & Satiety',
  gi_burden:        'GI Symptoms',
  activity_quality: 'Activity & Strength',
  sleep_quality:    'Sleep Quality',
  mental_health:    'Mental Health',
};

// Maps checkin type to the CheckinScores field name
const SCORE_KEY: Record<CheckinType, keyof CheckinScores> = {
  food_noise:       'foodNoise',
  energy_mood:      'energyMood',
  appetite:         'appetite',
  gi_burden:        'giBurden',
  activity_quality: 'activityQuality',
  sleep_quality:    'sleepQuality',
  mental_health:    'mentalHealth',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mlToOz(ml: number) { return Math.round(ml / 29.5735); }

function scoreColor(score: number): string {
  if (score >= 70) return '#27AE60';
  if (score >= 50) return '#F6CB45';
  if (score >= 30) return '#E8960C';
  return '#E53E3E';
}

function getExplanation(type: CheckinType, score: number): string {
  switch (type) {
    case 'food_noise':
      if (score >= 80) return 'Your food noise is at its lowest - GLP-1 is effectively quieting food cravings. This is your prime window to build lasting habits.';
      if (score >= 55) return 'Mild food thoughts are present. This is common in early weeks as the medication builds up.';
      if (score >= 30) return 'Moderate food noise suggests the medication may still be titrating, or a dose adjustment may help.';
      return 'High food noise can indicate the medication hasn\'t fully taken effect yet. Discuss with your prescriber if this persists.';

    case 'energy_mood':
      if (score >= 75) return 'Your energy and mood are strong this week. Consistent sleep and protein intake help maintain this through GLP-1 treatment.';
      if (score >= 50) return 'Energy and mood are in a typical range for GLP-1 therapy. Sleep quality and protein intake are the biggest levers.';
      if (score >= 25) return 'Low energy is common during dose-escalation. Prioritize sleep and protein - both directly affect GLP-1 outcomes.';
      return 'Very low energy or mood for multiple weeks warrants a conversation with your care team.';

    case 'appetite':
      if (score >= 75) return 'Excellent appetite control this week. GLP-1 is working well - stay consistent with protein targets to protect lean mass.';
      if (score >= 50) return 'Appetite is moderately controlled - normal for early treatment weeks.';
      if (score >= 25) return 'Smaller, more frequent meals help GLP-1\'s gastric emptying mechanism work better.';
      return 'Low appetite control may reflect early treatment. Note your injection timing and discuss with your prescriber if persistent.';

    case 'gi_burden':
      if (score >= 80) return 'Minimal GI symptoms this week - your body is tolerating the medication well. Continue with your normal targets.';
      if (score >= 55) return 'Mild GI symptoms are very common on GLP-1, especially after dose increases. Smaller meals, more water, and bland foods help significantly.';
      if (score >= 30) return 'Moderate GI burden - your targets have been adjusted to ease your system. Focus on hydration and light, frequent meals.';
      return 'Significant GI symptoms are affecting your daily routine. Targets have been reduced. Contact your prescriber if symptoms persist beyond a week.';

    case 'activity_quality':
      if (score >= 80) return 'Strong activity week - resistance training and consistent steps are the best way to preserve lean mass on GLP-1. Keep it up.';
      if (score >= 50) return 'Moderate activity is a solid foundation. Adding even one resistance session per week makes a meaningful difference for lean mass.';
      if (score >= 25) return 'Low activity this week - your targets have been adjusted down so they stay achievable. Light walks are still beneficial.';
      return 'Very low activity reported. Rest is appropriate if you\'re symptomatic, but try to include short walks when possible.';

    case 'sleep_quality':
      if (score >= 80) return 'Excellent sleep this week. Quality sleep amplifies GLP-1\'s metabolic effects and supports lean mass preservation.';
      if (score >= 55) return 'Decent sleep, with some disruption. Even small improvements - consistent bedtime, cool room - meaningfully improve GLP-1 outcomes.';
      if (score >= 30) return 'Disrupted sleep reduces satiety hormone effectiveness. Your activity targets have been eased to account for lower energy.';
      return 'Poor sleep significantly affects weight loss and recovery. If GLP-1 side effects are disturbing your sleep, discuss timing adjustments with your prescriber.';

    case 'mental_health':
      if (score >= 80) return 'Good mental health this week. Stable mood supports consistent habits - the foundation of long-term GLP-1 success.';
      if (score >= 55) return 'Mild mood fluctuations are common during treatment, especially in early weeks. Protein, exercise, and social connection are evidence-based supports.';
      if (score >= 30) return 'Moderate mood concerns noted. Targets have been gently adjusted. If symptoms persist, speaking with a mental health provider is recommended.';
      return 'Significant mood or anxiety this week. Please consider discussing these results with your healthcare provider. Your targets have been adjusted to reduce pressure.';
  }
}

function getAiChips(type: CheckinType): string[] {
  switch (type) {
    case 'food_noise':      return ['Why was my protein target increased?', 'What foods reduce food cravings?', 'Will food noise improve over time?', 'How does GLP-1 affect hunger signals?'];
    case 'energy_mood':     return ['What helps with energy on GLP-1?', 'Why are my activity targets lower?', 'Does low energy affect my weight loss?', 'How does protein affect mood?'];
    case 'appetite':        return ['Why was my calorie target changed?', 'How should I structure my meals?', 'What happens if I eat too little?', 'How does appetite suppression affect lean mass?'];
    case 'gi_burden':       return ['How can I reduce GI symptoms?', 'Why do I need more water?', 'What should I eat right now?', 'How long do GI side effects typically last?'];
    case 'activity_quality':return ['How does activity preserve lean mass on GLP-1?', 'Why did my step target change?', 'What exercises are best for my situation?', 'How much activity is enough?'];
    case 'sleep_quality':   return ['How does poor sleep affect GLP-1 outcomes?', 'Why were carbs increased?', 'What helps improve sleep during treatment?', 'How does sleep affect my weight?'];
    case 'mental_health':   return ['How does mood affect weight loss?', 'Why was protein boosted?', 'What can I do to support my mental health?', 'Should I talk to my doctor about this?'];
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassBorder({ r = 20 }: { r?: number }) {
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      borderRadius: r, borderWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.13)',
      borderLeftColor: 'rgba(255,255,255,0.08)',
      borderRightColor: 'rgba(255,255,255,0.03)',
      borderBottomColor: 'rgba(255,255,255,0.02)',
    }} />
  );
}

function SparkDot({ score, isLatest }: { score: number; isLatest: boolean }) {
  const color = scoreColor(score);
  const size  = isLatest ? 10 : 7;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity: isLatest ? 1 : 0.55,
    }} />
  );
}

type MetricRowProps = {
  icon: React.ReactNode;
  label: string;
  before: string;
  after: string;
  delta: string;
  increased: boolean;
  reason: string;
  colors: AppColors;
};

function MetricRow({ icon, label, before, after, delta, increased, reason, colors }: MetricRowProps) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const arrowColor = increased ? ORANGE : BLUE;
  const deltaColor = increased ? ORANGE : BLUE;
  return (
    <View style={{ paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w(0.07) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon}
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, fontFamily: FF }}>{label}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, backgroundColor: increased ? 'rgba(255,116,42,0.12)' : 'rgba(90,200,250,0.12)' }}>
          <Ionicons name={increased ? 'arrow-up' : 'arrow-down'} size={11} color={arrowColor} />
          <Text style={{ fontSize: 12, fontWeight: '800', color: deltaColor, fontFamily: FF }}>{delta}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: '300', color: w(0.35), fontFamily: FF }}>{before}</Text>
        <Ionicons name="arrow-forward" size={14} color={w(0.25)} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, fontFamily: FF }}>{after}</Text>
      </View>
      <Text style={{ fontSize: 12, color: w(0.40), fontFamily: FF, marginTop: 5, lineHeight: 17 }}>{reason}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CheckinSummaryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    type: string;
    score: string;
    rawScore: string;
    label: string;
  }>();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const logStore = useLogStore();
  const { profile } = useHealthData();
  const { openAiChat } = useUiStore();

  const type     = (params.type ?? 'food_noise') as CheckinType;
  const score    = parseInt(params.score ?? '0', 10);
  const rawScore = parseInt(params.rawScore ?? '0', 10);
  const label    = params.label ?? '';

  const typeLabel   = TYPE_LABELS[type] ?? type;
  const color       = scoreColor(score);
  const explanation = getExplanation(type, score);
  const aiChips     = getAiChips(type);

  // Show provider prompt banner for mental health with high raw score
  const showProviderBanner = type === 'mental_health' && rawScore >= 15;

  // ── Target impact computation ──────────────────────────────────────────────
  const { base, adjusted, metricRows } = useMemo(() => {
    const base = computeBaseTargets(profile);
    const baseWithActive = { ...base, activeCaloriesTarget: base.activeMinutes * 3 };

    // Build CheckinScores with only this checkin's score set
    const checkinScores: CheckinScores = {
      foodNoise: null, energyMood: null, appetite: null,
      giBurden: null, activityQuality: null, sleepQuality: null, mentalHealth: null,
      [SCORE_KEY[type]]: score,
    };

    const adjusted = applyCheckinAdjustments(baseWithActive, checkinScores);
    const rows: MetricRowProps[] = [];

    const calDiff = adjusted.caloriesTarget - baseWithActive.caloriesTarget;
    if (Math.abs(calDiff) >= 50) {
      rows.push({
        icon: <MaterialIcons name="local-fire-department" size={18} color={ORANGE} />,
        label: 'Daily Calories',
        before: `${baseWithActive.caloriesTarget} cal`,
        after:  `${adjusted.caloriesTarget} cal`,
        delta:  `${calDiff > 0 ? '+' : ''}${calDiff} cal`,
        increased: calDiff > 0,
        reason: calDiff < 0
          ? 'Calorie target eased to reduce the burden on your body this week.'
          : 'Calorie target increased to support your energy needs.',
        colors,
      });
    }

    const stepsDiff = adjusted.steps - baseWithActive.steps;
    if (Math.abs(stepsDiff) >= 200) {
      rows.push({
        icon: <MaterialIcons name="directions-walk" size={18} color={GREEN} />,
        label: 'Daily Steps',
        before: `${baseWithActive.steps.toLocaleString()}`,
        after:  `${adjusted.steps.toLocaleString()}`,
        delta:  `${stepsDiff > 0 ? '+' : ''}${stepsDiff.toLocaleString()}`,
        increased: stepsDiff > 0,
        reason: stepsDiff > 0
          ? 'Higher activity target reflects your strong weekly performance - keep building.'
          : 'Step target reduced to keep goals realistic given what you reported this week.',
        colors,
      });
    }

    const activeCalDiff = adjusted.activeCaloriesTarget - baseWithActive.activeCaloriesTarget;
    if (Math.abs(activeCalDiff) >= 15) {
      rows.push({
        icon: <MaterialIcons name="flash-on" size={18} color="#F6CB45" />,
        label: 'Active Calories',
        before: `${baseWithActive.activeCaloriesTarget} cal`,
        after:  `${adjusted.activeCaloriesTarget} cal`,
        delta:  `${activeCalDiff > 0 ? '+' : ''}${activeCalDiff} cal`,
        increased: activeCalDiff > 0,
        reason: activeCalDiff < 0
          ? 'Active calorie target adjusted down so recovery is prioritized.'
          : 'Burn target raised to match your active week.',
        colors,
      });
    }

    const proteinDiff = adjusted.proteinG - baseWithActive.proteinG;
    if (Math.abs(proteinDiff) >= 1) {
      rows.push({
        icon: <MaterialIcons name="restaurant" size={18} color={ORANGE} />,
        label: 'Daily Protein',
        before: `${baseWithActive.proteinG}g`,
        after:  `${adjusted.proteinG}g`,
        delta:  `${proteinDiff > 0 ? '+' : ''}${proteinDiff}g`,
        increased: proteinDiff > 0,
        reason: proteinDiff > 0
          ? 'Protein is the single most important nutrient for preserving lean mass on GLP-1. Try eggs, Greek yogurt, or a protein shake.'
          : 'Protein target adjusted.',
        colors,
      });
    }

    const waterDiffMl = adjusted.waterMl - baseWithActive.waterMl;
    const waterDiffOz = mlToOz(Math.abs(waterDiffMl));
    if (waterDiffOz >= 2) {
      rows.push({
        icon: <Ionicons name="water-outline" size={18} color={BLUE} />,
        label: 'Daily Water',
        before: `${mlToOz(baseWithActive.waterMl)} oz`,
        after:  `${mlToOz(adjusted.waterMl)} oz`,
        delta:  `${waterDiffMl > 0 ? '+' : '-'}${waterDiffOz} oz`,
        increased: waterDiffMl > 0,
        reason: waterDiffMl > 0
          ? 'Extra hydration helps manage GI symptoms and supports medication absorption. Sip steadily throughout the day.'
          : 'Water target unchanged.',
        colors,
      });
    }

    const carbsDiff = adjusted.carbsG - baseWithActive.carbsG;
    if (Math.abs(carbsDiff) >= 3) {
      rows.push({
        icon: <MaterialIcons name="grain" size={18} color="#F6CB45" />,
        label: 'Daily Carbs',
        before: `${baseWithActive.carbsG}g`,
        after:  `${adjusted.carbsG}g`,
        delta:  `${carbsDiff > 0 ? '+' : ''}${carbsDiff}g`,
        increased: carbsDiff > 0,
        reason: carbsDiff > 0
          ? 'A modest carb boost provides steady fuel. Focus on complex sources - oats, sweet potato, whole grains.'
          : 'Carb target reduced to lower GI load.',
        colors,
      });
    }

    return { base: baseWithActive, adjusted, metricRows: rows };
  }, [profile, type, score, colors]);

  // ── Sparkline ─────────────────────────────────────────────────────────────
  const sparkScores = useMemo(() => {
    let logs: { score: number }[] = [];
    if (type === 'food_noise') {
      logs = (logStore.foodNoiseLogs ?? []).slice(0, 3).map(l => ({ score: Math.round((1 - l.score / 20) * 100) }));
    } else {
      logs = (logStore.weeklyCheckins?.[type] ?? []).slice(0, 3) as { score: number }[];
    }
    const arr = logs.map(l => l.score).reverse();
    if (arr.length === 0 || arr[arr.length - 1] !== score) {
      return [...arr.slice(-2), score];
    }
    return arr;
  }, [logStore, type, score]);

  const showTrend = sparkScores.length >= 2;

  useEffect(() => {
    if (type !== 'food_noise') {
      logStore.fetchWeeklyCheckins(type as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // ── AI context ────────────────────────────────────────────────────────────
  const aiContext = useMemo(() => {
    const changes = metricRows.map(r => `${r.label}: ${r.before} → ${r.after}`).join(', ');
    return `${typeLabel} check-in score: ${score}/100 (${label}). Target changes: ${changes || 'none'}.`;
  }, [metricRows, typeLabel, score, label]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14,
      }}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.7}>
          <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.borderSubtle }]} />
          <GlassBorder r={20} />
          <Ionicons name="chevron-back" size={22} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
        </TouchableOpacity>

        <View style={s.pill}>
          <Text style={s.pillText}>Weekly Check-In  ·  {typeLabel}</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >

        {/* Provider banner - mental health ≥ 15 raw */}
        {showProviderBanner && (
          <View style={[s.card, { marginBottom: 12, borderWidth: 1, borderColor: 'rgba(246,203,69,0.4)', backgroundColor: 'rgba(246,203,69,0.08)' }]}>
            <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="alert-circle" size={22} color="#F6CB45" />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.textPrimary, fontFamily: FF, lineHeight: 18 }}>
                Consider discussing these results with your healthcare provider.
              </Text>
            </View>
          </View>
        )}

        {/* Score card */}
        <View style={[s.card, { marginBottom: 14 }]}>
          <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={20} />
          <View style={{ padding: 28, alignItems: 'center' }}>
            <Text style={[s.scoreLarge, { color }]}>{score}</Text>
            <Text style={s.scoreDenom}>/100</Text>
            <View style={[s.badge, { backgroundColor: `${color}22`, marginTop: 12 }]}>
              <Text style={[s.badgeText, { color }]}>{label}</Text>
            </View>
            {showTrend && (
              <View style={s.sparkRow}>
                {sparkScores.map((v, i) => (
                  <SparkDot key={i} score={v} isLatest={i === sparkScores.length - 1} />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── What Changed ── */}
        {metricRows.length > 0 ? (
          <View style={[s.card, { marginBottom: 14 }]}>
            <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
            <GlassBorder r={20} />
            <View style={{ padding: 20 }}>
              <Text style={s.sectionTitle}>WHAT CHANGED</Text>
              {metricRows.map((row, i) => (
                <View key={row.label} style={i === metricRows.length - 1 ? { borderBottomWidth: 0 } : {}}>
                  <MetricRow {...row} />
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={[s.card, { marginBottom: 14 }]}>
            <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
            <GlassBorder r={20} />
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={28} color={GREEN} style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, fontFamily: FF }}>No adjustments needed</Text>
              <Text style={{ fontSize: 13, color: w(0.45), fontFamily: FF, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                Your score is in a healthy range - continue with your regular targets.
              </Text>
            </View>
          </View>
        )}

        {/* ── What This Means ── */}
        <View style={[s.card, { marginBottom: 14 }]}>
          <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={20} />
          <View style={{ padding: 20 }}>
            <Text style={s.sectionTitle}>WHAT THIS MEANS</Text>
            <Text style={s.explanationBody}>{explanation}</Text>
          </View>
        </View>

        {/* ── AI Coach card ── */}
        <View style={[s.card, { borderWidth: 1, borderColor: 'rgba(255,116,42,0.15)' }]}>
          <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={20} />
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <View style={s.aiIconWrap}>
                <MaterialIcons name="auto-awesome" size={16} color={ORANGE} />
              </View>
              <Text style={s.aiCardLabel}>AI COACH</Text>
            </View>
            <Text style={s.aiCardTitle}>Questions about your results?</Text>
            <Text style={[s.aiCardSub, { color: w(0.40) }]}>
              Ask why your targets changed, what to focus on, or anything about this week.
            </Text>

            <View style={{ gap: 8, marginBottom: 14 }}>
              {aiChips.map(chip => (
                <TouchableOpacity
                  key={chip}
                  activeOpacity={0.75}
                  style={s.chip}
                  onPress={() => openAiChat({
                    type: 'focus',
                    contextLabel: `${typeLabel} Check-In`,
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
                contextLabel: `${typeLabel} Check-In`,
                contextValue: aiContext,
                chips: JSON.stringify(aiChips),
              })}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFF" />
              <Text style={s.askBtnText}>Ask anything</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* Done CTA */}
      <View style={{
        paddingHorizontal: 20, paddingTop: 12,
        paddingBottom: insets.bottom + 16,
        backgroundColor: colors.bg,
        borderTopWidth: 1,
        borderTopColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }}>
        <TouchableOpacity style={s.doneBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    headerBtn: {
      width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center',
      shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
    },
    pill: {
      backgroundColor: 'rgba(255,116,42,0.15)', borderRadius: 20,
      paddingHorizontal: 14, paddingVertical: 6,
    },
    pillText: { fontSize: 12, fontWeight: '700', color: ORANGE, fontFamily: FF },

    card: {
      borderRadius: 20, overflow: 'hidden', backgroundColor: c.surface,
      shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
    },

    sectionTitle: {
      fontSize: 10, fontWeight: '800', color: w(0.35),
      fontFamily: FF, letterSpacing: 1.5, marginBottom: 2,
    },

    scoreLarge: { fontSize: 72, fontWeight: '800', lineHeight: 76, fontFamily: FF },
    scoreDenom: { fontSize: 13, color: c.textMuted, fontFamily: FF, marginTop: 2 },
    badge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
    badgeText: { fontSize: 14, fontWeight: '700', fontFamily: FF, letterSpacing: 0.5 },
    sparkRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 14 },

    explanationBody: {
      fontSize: 15, fontWeight: '500', color: c.textPrimary,
      fontFamily: FF, lineHeight: 22, marginTop: 10,
    },

    aiIconWrap: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: 'rgba(255,116,42,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    aiCardLabel: { fontSize: 10, fontWeight: '800', color: ORANGE, fontFamily: FF, letterSpacing: 1.5 },
    aiCardTitle: {
      fontSize: 16, fontWeight: '800', color: c.textPrimary,
      fontFamily: FF, letterSpacing: -0.2, marginTop: 6, marginBottom: 4,
    },
    aiCardSub: { fontSize: 12, fontFamily: FF, lineHeight: 17, marginBottom: 16 },

    chip: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 11,
      borderRadius: 14, borderWidth: 1,
      borderColor: 'rgba(255,116,42,0.25)',
      backgroundColor: 'rgba(255,116,42,0.07)',
    },
    chipText: { flex: 1, fontSize: 13, fontWeight: '600', color: c.textPrimary, fontFamily: FF },

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
};
