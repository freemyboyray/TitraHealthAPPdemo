import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHealthData } from '@/contexts/health-data';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { computeBaseTargets, applyAdjustments } from '@/lib/targets';
import { useUiStore } from '@/stores/ui-store';

const ORANGE  = '#FF742A';
const GREEN   = '#34C759';
const RED     = '#FF3B30';
const BLUE    = '#5AC8FA';
const FF     = 'System';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mlToOz(ml: number) { return Math.round(ml / 29.5735); }

function capitalize(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassBorder({ r = 20 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, {
        borderRadius: r, borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.13)',
        borderLeftColor: 'rgba(255,255,255,0.08)',
        borderRightColor: 'rgba(255,255,255,0.03)',
        borderBottomColor: 'rgba(255,255,255,0.02)',
      }]}
    />
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
    <View style={{
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: w(0.07),
    }}>
      {/* Label + delta badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon}
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, fontFamily: FF }}>{label}</Text>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
          backgroundColor: increased ? 'rgba(255,116,42,0.12)' : 'rgba(90,200,250,0.12)',
        }}>
          <Ionicons
            name={increased ? 'arrow-up' : 'arrow-down'}
            size={11}
            color={arrowColor}
          />
          <Text style={{ fontSize: 14, fontWeight: '800', color: deltaColor, fontFamily: FF }}>{delta}</Text>
        </View>
      </View>

      {/* Before → After */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: '300', color: w(0.35), fontFamily: FF }}>{before}</Text>
        <Ionicons name="arrow-forward" size={14} color={w(0.25)} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, fontFamily: FF }}>{after}</Text>
      </View>

      {/* Reason */}
      <Text style={{ fontSize: 14, color: w(0.40), fontFamily: FF, marginTop: 5, lineHeight: 17 }}>{reason}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SideEffectImpactScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const { openAiChat } = useUiStore();

  const { effects: effectsParam } = useLocalSearchParams<{ effects: string }>();
  const { profile } = useHealthData();

  // Parse logged effects from route params
  const loggedEffects: { type: string; severity: number }[] = useMemo(() => {
    try { return JSON.parse(effectsParam ?? '[]'); } catch { return []; }
  }, [effectsParam]);

  // Build RecentSideEffectLogs stamped to now (weight = 1.0, today)
  const now = new Date().toISOString();
  const recentLogs = loggedEffects.map(e => ({
    effect_type: e.type,
    severity: e.severity,
    logged_at: now,
  }));

  // Compute base and adjusted targets
  const base = useMemo(() => computeBaseTargets(profile), [profile]);
  const baseWithActive = useMemo(() => ({
    ...base,
    activeCaloriesTarget: base.activeMinutes * 3,
  }), [base]);
  const adjusted = useMemo(() => applyAdjustments(baseWithActive, recentLogs), [baseWithActive, recentLogs]);

  // Build metric change rows (only show metrics that actually changed)
  const metricRows = useMemo(() => {
    const rows: MetricRowProps[] = [];
    const c = colors;

    const proteinDiff = adjusted.proteinG - base.proteinG;
    if (Math.abs(proteinDiff) >= 1) {
      rows.push({
        icon: <MaterialIcons name="restaurant" size={18} color={ORANGE} />,
        label: 'Daily Protein',
        before: `${base.proteinG}g`,
        after: `${adjusted.proteinG}g`,
        delta: `${proteinDiff > 0 ? '+' : ''}${proteinDiff}g`,
        increased: proteinDiff > 0,
        reason: proteinDiff > 0
          ? 'Higher protein preserves lean muscle when GLP-1 suppresses appetite. Try adding protein shakes, eggs, or Greek yogurt.'
          : 'Protein target slightly reduced to ease digestion.',
        colors: c,
      });
    }

    const waterDiffMl = adjusted.waterMl - base.waterMl;
    const waterDiffOz = mlToOz(Math.abs(waterDiffMl));
    if (waterDiffOz >= 1) {
      rows.push({
        icon: <Ionicons name="water-outline" size={18} color={BLUE} />,
        label: 'Daily Water',
        before: `${mlToOz(base.waterMl)}oz`,
        after: `${mlToOz(adjusted.waterMl)}oz`,
        delta: `${waterDiffMl > 0 ? '+' : '-'}${waterDiffOz}oz`,
        increased: waterDiffMl > 0,
        reason: waterDiffMl > 0
          ? 'Increased hydration helps manage GI symptoms and supports medication absorption. Sip steadily throughout the day.'
          : 'Water target unchanged.',
        colors: c,
      });
    }

    const fiberDiff = adjusted.fiberG - base.fiberG;
    if (Math.abs(fiberDiff) >= 1) {
      rows.push({
        icon: <MaterialIcons name="eco" size={18} color={GREEN} />,
        label: 'Daily Fiber',
        before: `${base.fiberG}g`,
        after: `${adjusted.fiberG}g`,
        delta: `${fiberDiff > 0 ? '+' : ''}${fiberDiff}g`,
        increased: fiberDiff > 0,
        reason: fiberDiff > 0
          ? 'Soluble fiber (oats, legumes) supports digestion and softens stool. Add gradually to avoid gas.'
          : 'Fiber reduced to ease GI distress. Focus on easy-to-digest foods until symptoms settle.',
        colors: c,
      });
    }

    const carbsDiff = adjusted.carbsG - base.carbsG;
    if (Math.abs(carbsDiff) >= 3) {
      rows.push({
        icon: <MaterialIcons name="grain" size={18} color="#F6CB45" />,
        label: 'Daily Carbs',
        before: `${base.carbsG}g`,
        after: `${adjusted.carbsG}g`,
        delta: `${carbsDiff > 0 ? '+' : ''}${carbsDiff}g`,
        increased: carbsDiff > 0,
        reason: carbsDiff > 0
          ? 'Complex carbs (whole grains, oats) provide steady energy. Avoid high-sugar foods that cause energy crashes.'
          : 'Carbs reduced to limit GI load. Stick to plain, easy-to-digest carbs like white rice and toast.',
        colors: c,
      });
    }

    const fatDiff = adjusted.fatG - base.fatG;
    if (Math.abs(fatDiff) >= 2) {
      rows.push({
        icon: <MaterialIcons name="opacity" size={18} color="#FF9F0A" />,
        label: 'Daily Fat',
        before: `${base.fatG}g`,
        after: `${adjusted.fatG}g`,
        delta: `${fatDiff > 0 ? '+' : ''}${fatDiff}g`,
        increased: fatDiff > 0,
        reason: fatDiff < 0
          ? 'Reducing fat slows gastric emptying less aggressively and relieves GI symptoms. Avoid greasy and fried foods.'
          : 'Fat target unchanged.',
        colors: c,
      });
    }

    const stepsDiff = adjusted.steps - base.steps;
    if (Math.abs(stepsDiff) >= 100) {
      rows.push({
        icon: <MaterialIcons name="directions-walk" size={18} color={GREEN} />,
        label: 'Daily Steps',
        before: `${base.steps.toLocaleString()}`,
        after: `${adjusted.steps.toLocaleString()}`,
        delta: `${stepsDiff > 0 ? '+' : ''}${stepsDiff.toLocaleString()}`,
        increased: stepsDiff > 0,
        reason: stepsDiff > 0
          ? 'Light walking helps GI motility and reduces constipation and bloating. Short walks after meals are ideal.'
          : 'Rest is prioritized - avoid intense activity until symptoms improve.',
        colors: c,
      });
    }

    return rows;
  }, [base, adjusted, colors]);

  // Effect name pills to show at top
  const effectNames = loggedEffects.map(e => capitalize(e.type));

  // AI context string summarising logged effects + changes
  const aiContext = useMemo(() => {
    const effectList = effectNames.join(', ') || 'side effects';
    const changes = metricRows.map(r => `${r.label}: ${r.before} → ${r.after}`).join(', ');
    return `Logged: ${effectList}. Target changes: ${changes || 'none'}.`;
  }, [effectNames, metricRows]);

  // Contextual quick-question chips
  const aiChips = useMemo(() => {
    const chips: string[] = [];
    if (metricRows.some(r => r.label === 'Daily Protein'))
      chips.push('Why was my protein target changed?');
    if (metricRows.some(r => r.label === 'Daily Water'))
      chips.push('Why do I need more water?');
    if (metricRows.some(r => r.label === 'Daily Fiber'))
      chips.push('How should I adjust my fiber intake?');
    if (metricRows.some(r => r.label === 'Daily Fat'))
      chips.push('Why should I reduce fat right now?');
    if (metricRows.some(r => r.label === 'Daily Steps'))
      chips.push('Should I rest or stay active?');
    if (loggedEffects.some(e => e.type === 'nausea' || e.type === 'vomiting'))
      chips.push('How can I manage nausea on GLP-1?');
    if (loggedEffects.some(e => e.type === 'constipation' || e.type === 'diarrhea'))
      chips.push('What helps with GI side effects?');
    chips.push('How long do these side effects typically last?');
    chips.push('Should I contact my doctor about this?');
    return chips.slice(0, 5);
  }, [metricRows, loggedEffects]);

  const hasFoodGuidance = adjusted.foodsToPrioritize.length > 0 || adjusted.foodsToAvoid.length > 0;
  const hasMealFreq = adjusted.mealFrequency > 3;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.dismissAll()}
          activeOpacity={0.7}
        >
          <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.borderSubtle }]} />
          <GlassBorder r={20} />
          <Ionicons name="close" size={20} color={w(0.6)} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Target Adjustments</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Success banner */}
        <View style={s.banner}>
          <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={20} />
          <View style={{ padding: 20, alignItems: 'center' }}>
            <View style={s.checkCircle}>
              <Ionicons name="checkmark" size={22} color="#FFF" />
            </View>
            <Text style={s.bannerTitle}>Side effects logged</Text>
            <Text style={s.bannerSub}>
              Your daily targets have been adjusted based on what you're experiencing.
            </Text>
            {/* Effect pills */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 }}>
              {effectNames.map(name => (
                <View key={name} style={s.effectPill}>
                  <Text style={s.effectPillText}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Metric changes */}
        {metricRows.length > 0 && (
          <View style={s.card}>
            <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
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
        )}

        {/* Meal frequency */}
        {hasMealFreq && (
          <View style={s.card}>
            <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
            <GlassBorder r={20} />
            <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={[s.iconCircle, { backgroundColor: 'rgba(255,116,42,0.12)' }]}>
                <Ionicons name="time-outline" size={20} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionTitle}>MEAL TIMING</Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, fontFamily: FF, marginTop: 2 }}>
                  {adjusted.mealFrequency} small meals/day
                </Text>
                <Text style={{ fontSize: 14, color: w(0.40), fontFamily: FF, marginTop: 4, lineHeight: 17 }}>
                  Smaller, more frequent meals reduce GI load and help GLP-1 manage gastric emptying more comfortably.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Resistance training */}
        {adjusted.resistanceTrainingRecommended && (
          <View style={s.card}>
            <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
            <GlassBorder r={20} />
            <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={[s.iconCircle, { backgroundColor: 'rgba(52,199,89,0.12)' }]}>
                <MaterialIcons name="fitness-center" size={20} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionTitle}>STRENGTH TRAINING</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, fontFamily: FF, marginTop: 2 }}>
                  Recommended 2–3×/week
                </Text>
                <Text style={{ fontSize: 14, color: w(0.40), fontFamily: FF, marginTop: 4, lineHeight: 17 }}>
                  Resistance training is the most effective way to prevent lean muscle loss on GLP-1. Even bodyweight squats and rows count.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Food guidance */}
        {hasFoodGuidance && (
          <View style={s.card}>
            <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
            <GlassBorder r={20} />
            <View style={{ padding: 20 }}>
              <Text style={s.sectionTitle}>FOOD GUIDANCE</Text>

              {adjusted.foodsToPrioritize.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: GREEN, fontFamily: FF, letterSpacing: 0.5 }}>
                      PRIORITIZE
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {adjusted.foodsToPrioritize.map(food => (
                      <View key={food} style={[s.foodChip, { backgroundColor: 'rgba(52,199,89,0.10)', borderColor: 'rgba(52,199,89,0.25)' }]}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: GREEN, fontFamily: FF }}>{food}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {adjusted.foodsToAvoid.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="close-circle" size={16} color={RED} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: RED, fontFamily: FF, letterSpacing: 0.5 }}>
                      AVOID
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {adjusted.foodsToAvoid.map(food => (
                      <View key={food} style={[s.foodChip, { backgroundColor: 'rgba(255,59,48,0.08)', borderColor: 'rgba(255,59,48,0.20)' }]}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: RED, fontFamily: FF }}>{food}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* No changes fallback */}
        {metricRows.length === 0 && !hasMealFreq && !hasFoodGuidance && (
          <View style={s.card}>
            <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
            <GlassBorder r={20} />
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: w(0.40), textAlign: 'center', fontFamily: FF, lineHeight: 20 }}>
                No target adjustments for these effects. Continue with your regular targets.
              </Text>
            </View>
          </View>
        )}

        {/* AI Coach card */}
        <View style={s.aiCard}>
          <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={20} />
          <View style={{ padding: 20 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <View style={s.aiIconWrap}>
                <MaterialIcons name="auto-awesome" size={16} color={ORANGE} />
              </View>
              <Text style={s.aiCardLabel}>AI COACH</Text>
            </View>
            <Text style={s.aiCardTitle}>Have questions about your adjustments?</Text>
            <Text style={[s.aiCardSub, { color: w(0.40) }]}>
              Ask why targets changed, what to eat, or anything about managing your side effects.
            </Text>

            {/* Quick-question chips */}
            <View style={s.chipsWrap}>
              {aiChips.map(chip => (
                <TouchableOpacity
                  key={chip}
                  activeOpacity={0.75}
                  style={s.chip}
                  onPress={() => openAiChat({
                    type: 'focus',
                    contextLabel: 'Side Effect Adjustments',
                    contextValue: aiContext,
                    seedMessage: chip,
                    chips: JSON.stringify([
                      'What can I eat right now?',
                      'How long will this last?',
                      'Should I contact my doctor?',
                      'What helps most right now?',
                    ]),
                  })}
                >
                  <Text style={s.chipText}>{chip}</Text>
                  <Ionicons name="arrow-forward" size={13} color={ORANGE} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Ask anything button */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={s.askBtn}
              onPress={() => openAiChat({
                type: 'focus',
                contextLabel: 'Side Effect Adjustments',
                contextValue: aiContext,
                chips: JSON.stringify([
                  'What can I eat right now?',
                  'How long will this last?',
                  'Should I contact my doctor?',
                  'What helps most right now?',
                  'Why did my targets change?',
                ]),
              })}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFF" />
              <Text style={s.askBtnText}>Ask anything</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Done CTA */}
      <View style={[s.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <TouchableOpacity
          style={s.doneBtn}
          onPress={() => router.dismissAll()}
          activeOpacity={0.85}
        >
          <Text style={s.doneBtnText}>Got it</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 12,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20, fontWeight: '800', color: c.textPrimary, fontFamily: 'System', letterSpacing: -0.3,
    },

    content: { paddingHorizontal: 20, paddingTop: 4, gap: 14 },

    banner: {
      borderRadius: 20, overflow: 'hidden', backgroundColor: c.surface,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
    },
    checkCircle: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
      marginBottom: 12,
      shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 12,
    },
    bannerTitle: {
      fontSize: 20, fontWeight: '800', color: c.textPrimary, fontFamily: 'System',
      letterSpacing: -0.3, marginBottom: 6,
    },
    bannerSub: {
      fontSize: 15, color: w(0.45), fontFamily: FF, textAlign: 'center', lineHeight: 19,
    },
    effectPill: {
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
      backgroundColor: 'rgba(255,116,42,0.12)', borderWidth: 1, borderColor: 'rgba(255,116,42,0.25)',
    },
    effectPillText: {
      fontSize: 14, fontWeight: '700', color: ORANGE, fontFamily: FF,
    },

    card: {
      borderRadius: 20, overflow: 'hidden', backgroundColor: c.surface,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
    },

    sectionTitle: {
      fontSize: 12, fontWeight: '800', color: w(0.35), fontFamily: FF,
      letterSpacing: 1.5, marginBottom: 2,
    },

    iconCircle: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },

    foodChip: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
    },

    aiCard: {
      borderRadius: 20, overflow: 'hidden', backgroundColor: c.surface,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
      borderWidth: 1, borderColor: 'rgba(255,116,42,0.15)',
    },
    aiIconWrap: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: 'rgba(255,116,42,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    aiCardLabel: {
      fontSize: 12, fontWeight: '800', color: ORANGE,
      fontFamily: FF, letterSpacing: 1.5,
    },
    aiCardTitle: {
      fontSize: 18, fontWeight: '800', color: c.textPrimary,
      fontFamily: 'System', letterSpacing: -0.2, marginTop: 6, marginBottom: 4,
    },
    aiCardSub: {
      fontSize: 14, fontFamily: FF, lineHeight: 17, marginBottom: 16,
    },
    chipsWrap: {
      gap: 8, marginBottom: 14,
    },
    chip: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 11,
      borderRadius: 14, borderWidth: 1,
      borderColor: 'rgba(255,116,42,0.25)',
      backgroundColor: 'rgba(255,116,42,0.07)',
    },
    chipText: {
      flex: 1, fontSize: 15, fontWeight: '600',
      color: c.textPrimary, fontFamily: FF,
    },
    askBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, height: 48, borderRadius: 24,
      backgroundColor: ORANGE,
      shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    },
    askBtnText: {
      fontSize: 17, fontWeight: '800', color: '#FFF', fontFamily: FF,
    },

    ctaWrap: {
      paddingHorizontal: 20, paddingTop: 12,
      backgroundColor: c.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: w(0.07),
    },
    doneBtn: {
      height: 54, borderRadius: 27, backgroundColor: ORANGE,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 18, elevation: 8,
    },
    doneBtnText: {
      fontSize: 18, fontWeight: '800', color: '#FFF', fontFamily: FF, letterSpacing: 0.3,
    },
  });
};
