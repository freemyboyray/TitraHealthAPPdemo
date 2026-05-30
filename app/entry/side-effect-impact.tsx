import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useHealthData } from '@/contexts/health-data';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { computeBaseTargets, applyAdjustments, SIDE_EFFECT_RULES } from '@/lib/targets';
import { useUiStore } from '@/stores/ui-store';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, ChevronUp, CircleCheck, Clock, Droplet, Dumbbell, ExternalLink, Footprints, Grip, Leaf, MessageCircle, ShieldCheck, Sparkles, Utensils, X, XCircle } from 'lucide-react-native';
import { LucideIconByName } from '@/lib/lucide-icon-map';

const GREEN  = '#34C759';
const RED    = '#FF3B30';
const BLUE   = '#5AC8FA';
const FF     = 'System';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mlToOz(ml: number) { return Math.round(ml / 29.5735); }

function capitalize(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function severityTier(severity: number): 'mild' | 'moderate' | 'severe' {
  if (severity >= 7) return 'severe';
  if (severity >= 4) return 'moderate';
  return 'mild';
}

function buildSummary(rows: { label: string; increased: boolean }[]): string {
  const increased = rows.filter(r => r.increased).map(r => r.label.replace('Daily ', '').toLowerCase());
  const decreased = rows.filter(r => !r.increased).map(r => r.label.replace('Daily ', '').toLowerCase());
  const parts: string[] = [];
  if (increased.length > 0) parts.push(`Increased ${increased.join(' and ')}`);
  if (decreased.length > 0) parts.push(`reduced ${decreased.join(' and ')}`);
  if (parts.length === 0) return '';
  return parts.join(', ') + ' for today.';
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
  citations?: { label: string; shortDesc: string }[];
  expanded: boolean;
  onToggle: () => void;
  openAiChat: (opts: any) => void;
  aiContext: string;
};

function MetricRow({ icon, label, before, after, delta, increased, reason, colors, citations, expanded, onToggle, openAiChat, aiContext }: MetricRowProps) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const arrowColor = increased ? colors.orange : BLUE;
  const deltaColor = increased ? colors.orange : BLUE;

  return (
    <Pressable
      onPress={onToggle}
      style={{
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: w(0.07),
      }}
    >
      {/* Label + delta badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon}
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, fontFamily: FF }}>{label}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
            backgroundColor: increased ? 'rgba(255,116,42,0.12)' : 'rgba(90,200,250,0.12)',
          }}>
            {increased ? <ArrowUp size={11} color={arrowColor} /> : <ArrowDown size={11} color={arrowColor} />}
            <Text style={{ fontSize: 14, fontWeight: '800', color: deltaColor, fontFamily: FF }}>{delta}</Text>
          </View>
          {expanded ? <ChevronUp size={14} color={w(0.25)} /> : <ChevronDown size={14} color={w(0.25)} />}
        </View>
      </View>

      {/* Before → After */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: '300', color: w(0.35), fontFamily: FF }}>{before}</Text>
        <ArrowRight size={14} color={w(0.25)} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, fontFamily: FF }}>{after}</Text>
      </View>

      {/* Expanded: reason + citations */}
      {expanded && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 14, color: w(0.40), fontFamily: FF, lineHeight: 17 }}>{reason}</Text>

          {citations && citations.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <ShieldCheck size={13} color={w(0.30)} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: w(0.30), fontFamily: FF, letterSpacing: 0.5 }}>
                  INFORMED BY
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {citations.map(c => (
                  <Pressable
                    key={c.label}
                    onPress={() => openAiChat({
                      type: 'focus',
                      contextLabel: 'Clinical Evidence',
                      contextValue: `${c.label}: ${c.shortDesc}. ${aiContext}`,
                      seedMessage: `Tell me more about the research behind this adjustment: ${c.shortDesc}`,
                      chips: JSON.stringify([
                        'Is this recommendation evidence-based?',
                        'What does the research say?',
                        'Should I talk to my doctor about this?',
                      ]),
                    })}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
                      backgroundColor: w(0.04), borderWidth: 1, borderColor: w(0.08),
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: w(0.45), fontFamily: FF }}>{c.label}</Text>
                    <ExternalLink size={10} color={w(0.30)} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </Pressable>
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

  // Severity-adaptive banner
  const maxSeverity = useMemo(() => Math.max(...loggedEffects.map(e => e.severity), 0), [loggedEffects]);
  const tier = severityTier(maxSeverity);
  const bannerTitle = tier === 'severe' ? "We've got you" : tier === 'moderate' ? 'Adjusting for you' : 'Small tweaks made';
  const bannerSub = tier === 'severe'
    ? "We know this is rough. Here's how we're helping you get through today."
    : tier === 'moderate'
      ? "Your targets are adjusted to work with your body right now."
      : "Minor adjustments to keep you on track while this passes.";

  // Collect all triggered citations for metric rows
  const triggeredCitations = useMemo(() => {
    const map = new Map<string, { label: string; shortDesc: string }[]>();
    for (const e of loggedEffects) {
      const rule = SIDE_EFFECT_RULES[e.type];
      if (rule?.citations) {
        if (rule.proteinPct > 0) map.set('Daily Protein', [...(map.get('Daily Protein') ?? []), ...rule.citations]);
        if (rule.waterMlDelta > 0) map.set('Daily Water', [...(map.get('Daily Water') ?? []), ...rule.citations]);
        if (rule.fiberGDelta !== 0) map.set('Daily Fiber', [...(map.get('Daily Fiber') ?? []), ...rule.citations]);
        if (rule.fatPct !== 0) map.set('Daily Fat', [...(map.get('Daily Fat') ?? []), ...rule.citations]);
        if (rule.carbsPct !== 0) map.set('Daily Carbs', [...(map.get('Daily Carbs') ?? []), ...rule.citations]);
        if (rule.stepsDelta !== 0) map.set('Daily Steps', [...(map.get('Daily Steps') ?? []), ...rule.citations]);
      }
    }
    // Deduplicate per metric
    for (const [key, cites] of map) {
      const unique = cites.filter((c, i, arr) => arr.findIndex(x => x.label === c.label) === i);
      map.set(key, unique);
    }
    return map;
  }, [loggedEffects]);

  // Build metric change rows (only show metrics that actually changed)
  const metricRows = useMemo(() => {
    const rows: Omit<MetricRowProps, 'expanded' | 'onToggle' | 'openAiChat' | 'aiContext'>[] = [];
    const c = colors;

    const proteinDiff = adjusted.proteinG - base.proteinG;
    if (Math.abs(proteinDiff) >= 1) {
      rows.push({
        icon: <Utensils size={18} color={colors.orange} />,
        label: 'Daily Protein',
        before: `${base.proteinG}g`,
        after: `${adjusted.proteinG}g`,
        delta: `${proteinDiff > 0 ? '+' : ''}${proteinDiff}g`,
        increased: proteinDiff > 0,
        reason: proteinDiff > 0
          ? 'Higher protein preserves lean muscle when GLP-1 suppresses appetite. Try adding protein shakes, eggs, or Greek yogurt.'
          : 'Protein target slightly reduced to ease digestion.',
        colors: c,
        citations: triggeredCitations.get('Daily Protein'),
      });
    }

    const waterDiffMl = adjusted.waterMl - base.waterMl;
    const waterDiffOz = mlToOz(Math.abs(waterDiffMl));
    if (waterDiffOz >= 1) {
      rows.push({
        icon: <Droplet size={18} color={BLUE} />,
        label: 'Daily Water',
        before: `${mlToOz(base.waterMl)}oz`,
        after: `${mlToOz(adjusted.waterMl)}oz`,
        delta: `${waterDiffMl > 0 ? '+' : '-'}${waterDiffOz}oz`,
        increased: waterDiffMl > 0,
        reason: waterDiffMl > 0
          ? 'Increased hydration helps manage GI symptoms and supports medication absorption. Sip steadily throughout the day.'
          : 'Water target unchanged.',
        colors: c,
        citations: triggeredCitations.get('Daily Water'),
      });
    }

    const fiberDiff = adjusted.fiberG - base.fiberG;
    if (Math.abs(fiberDiff) >= 1) {
      rows.push({
        icon: <Leaf size={18} color={GREEN} />,
        label: 'Daily Fiber',
        before: `${base.fiberG}g`,
        after: `${adjusted.fiberG}g`,
        delta: `${fiberDiff > 0 ? '+' : ''}${fiberDiff}g`,
        increased: fiberDiff > 0,
        reason: fiberDiff > 0
          ? 'Soluble fiber (oats, legumes) supports digestion and softens stool. Add gradually to avoid gas.'
          : 'Fiber reduced to ease GI distress. Focus on easy-to-digest foods until symptoms settle.',
        colors: c,
        citations: triggeredCitations.get('Daily Fiber'),
      });
    }

    const carbsDiff = adjusted.carbsG - base.carbsG;
    if (Math.abs(carbsDiff) >= 3) {
      rows.push({
        icon: <Grip size={18} color="#F6CB45" />,
        label: 'Daily Carbs',
        before: `${base.carbsG}g`,
        after: `${adjusted.carbsG}g`,
        delta: `${carbsDiff > 0 ? '+' : ''}${carbsDiff}g`,
        increased: carbsDiff > 0,
        reason: carbsDiff > 0
          ? 'Complex carbs (whole grains, oats) provide steady energy. Avoid high-sugar foods that cause energy crashes.'
          : 'Carbs reduced to limit GI load. Stick to plain, easy-to-digest carbs like white rice and toast.',
        colors: c,
        citations: triggeredCitations.get('Daily Carbs'),
      });
    }

    const fatDiff = adjusted.fatG - base.fatG;
    if (Math.abs(fatDiff) >= 2) {
      rows.push({
        icon: <Droplet size={18} color="#FF9F0A" />,
        label: 'Daily Fat',
        before: `${base.fatG}g`,
        after: `${adjusted.fatG}g`,
        delta: `${fatDiff > 0 ? '+' : ''}${fatDiff}g`,
        increased: fatDiff > 0,
        reason: fatDiff < 0
          ? 'Reducing fat slows gastric emptying less aggressively and relieves GI symptoms. Avoid greasy and fried foods.'
          : 'Fat target unchanged.',
        colors: c,
        citations: triggeredCitations.get('Daily Fat'),
      });
    }

    const stepsDiff = adjusted.steps - base.steps;
    if (Math.abs(stepsDiff) >= 100) {
      rows.push({
        icon: <Footprints size={18} color={GREEN} />,
        label: 'Daily Steps',
        before: `${base.steps.toLocaleString()}`,
        after: `${adjusted.steps.toLocaleString()}`,
        delta: `${stepsDiff > 0 ? '+' : ''}${stepsDiff.toLocaleString()}`,
        increased: stepsDiff > 0,
        reason: stepsDiff > 0
          ? 'Light walking helps GI motility and reduces constipation and bloating. Short walks after meals are ideal.'
          : 'Rest is prioritized - avoid intense activity until symptoms improve.',
        colors: c,
        citations: triggeredCitations.get('Daily Steps'),
      });
    }

    return rows;
  }, [base, adjusted, colors, triggeredCitations]);

  // Progressive disclosure — track which rows are expanded
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set([0]));
  const toggleRow = useCallback((index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

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

  // Summary sentence
  const summary = useMemo(() => buildSummary(metricRows), [metricRows]);

  // Total adjustments count
  const adjustmentCount = metricRows.length + (hasMealFreq ? 1 : 0) + (hasFoodGuidance ? 1 : 0) + (adjusted.resistanceTrainingRecommended ? 1 : 0);

  // Contextual next actions (max 2)
  const nextActions = useMemo(() => {
    const actions: { label: string; icon: string; onPress: () => void }[] = [];
    if (metricRows.some(r => r.label === 'Daily Water' && r.increased)) {
      actions.push({
        label: 'Set hydration reminders',
        icon: 'Bell',
        onPress: () => { router.dismissAll(); setTimeout(() => router.push('/settings/reminders'), 300); },
      });
    }
    if (metricRows.some(r => r.label === 'Daily Protein' && r.increased)) {
      actions.push({
        label: 'Find high-protein meals',
        icon: 'Utensils',
        onPress: () => openAiChat({
          type: 'focus',
          contextLabel: 'Side Effect Adjustments',
          contextValue: aiContext,
          seedMessage: 'What high-protein meals can I eat right now given my side effects?',
          chips: JSON.stringify(['Quick protein snacks', 'Easy-to-digest protein options', 'Protein shake recipes']),
        }),
      });
    }
    if (hasMealFreq) {
      actions.push({
        label: "See today's meal schedule",
        icon: 'Clock',
        onPress: () => openAiChat({
          type: 'focus',
          contextLabel: 'Side Effect Adjustments',
          contextValue: aiContext,
          seedMessage: `Help me plan ${adjusted.mealFrequency} small meals for today that are easy on my stomach`,
          chips: JSON.stringify(['Simple meal ideas', 'What to eat first', 'Snack suggestions']),
        }),
      });
    }
    if (adjusted.resistanceTrainingRecommended) {
      actions.push({
        label: 'See exercise suggestions',
        icon: 'Dumbbell',
        onPress: () => openAiChat({
          type: 'focus',
          contextLabel: 'Side Effect Adjustments',
          contextValue: aiContext,
          seedMessage: 'What resistance exercises can I do to preserve muscle while on GLP-1?',
          chips: JSON.stringify(['Bodyweight exercises', 'Gym routine for beginners', 'How often should I train?']),
        }),
      });
    }
    return actions.slice(0, 2);
  }, [metricRows, hasMealFreq, adjusted, aiContext, openAiChat]);

  // ── Entrance animations ─────────────────────────────────────────────────────
  const bannerOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentY = useSharedValue(10);
  const ctaOpacity = useSharedValue(0);

  useEffect(() => {
    const ease = { duration: 250, easing: Easing.out(Easing.quad) };
    bannerOpacity.value = withTiming(1, ease);
    contentOpacity.value = withDelay(150, withTiming(1, ease));
    contentY.value = withDelay(150, withTiming(0, ease));
    ctaOpacity.value = withDelay(300, withTiming(1, ease));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const bannerAnim = useAnimatedStyle(() => ({ opacity: bannerOpacity.value }));
  const contentAnim = useAnimatedStyle(() => ({ opacity: contentOpacity.value, transform: [{ translateY: contentY.value }] }));
  const ctaAnim = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

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
          <X size={20} color={w(0.6)} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Target Adjustments</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Success banner */}
        <Animated.View style={[s.banner, bannerAnim]}>
          <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={20} />
          <View style={{ padding: 20, alignItems: 'center' }}>
            <View style={s.checkCircle}>
              <Check size={22} color="#FFF" />
            </View>
            <Text style={s.bannerTitle}>{bannerTitle}</Text>
            <Text style={s.bannerSub}>{bannerSub}</Text>
            {/* Effect pills with severity coloring */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 }}>
              {loggedEffects.map(e => {
                const t = severityTier(e.severity);
                const pillColor = t === 'severe' ? RED : t === 'moderate' ? colors.orange : GREEN;
                return (
                  <View key={e.type} style={[s.effectPill, {
                    backgroundColor: `${pillColor}15`,
                    borderColor: `${pillColor}40`,
                  }]}>
                    <Text style={[s.effectPillText, { color: pillColor }]}>{capitalize(e.type)}</Text>
                  </View>
                );
              })}
            </View>
            {/* Adjustment count */}
            {adjustmentCount > 0 && (
              <Text style={{ fontSize: 13, fontWeight: '600', color: w(0.35), fontFamily: FF, marginTop: 10 }}>
                {adjustmentCount} target{adjustmentCount !== 1 ? 's' : ''} adjusted
              </Text>
            )}
          </View>
        </Animated.View>

        <Animated.View style={contentAnim}>
          {/* Summary sentence */}
          {summary.length > 0 && (
            <Text style={{ fontSize: 15, fontWeight: '600', color: w(0.45), fontFamily: FF, marginBottom: -4, marginTop: 2 }}>
              {summary}
            </Text>
          )}

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
                    <MetricRow
                      {...row}
                      expanded={expandedRows.has(i)}
                      onToggle={() => toggleRow(i)}
                      openAiChat={openAiChat}
                      aiContext={aiContext}
                    />
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
                  <Clock size={20} color={colors.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionTitle}>MEAL TIMING</Text>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, fontFamily: FF, marginTop: 2 }}>
                    {adjusted.mealFrequency} small meals/day
                  </Text>
                  <Text style={{ fontSize: 14, color: w(0.40), fontFamily: FF, marginTop: 4, lineHeight: 17 }}>
                    Smaller, more frequent meals reduce GI load and help manage gastric emptying more comfortably.
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
                  <Dumbbell size={20} color={GREEN} />
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
                      <CircleCheck size={16} color={GREEN} />
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
                      <XCircle size={16} color={RED} />
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
                  <Sparkles size={16} color={colors.orange} />
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
                    <ArrowRight size={13} color={colors.orange} style={{ marginLeft: 2 }} />
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
                <MessageCircle size={18} color="#FFF" />
                <Text style={s.askBtnText}>Ask anything</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Disclaimer */}
          <Text style={{ fontSize: 12, color: w(0.25), fontFamily: FF, textAlign: 'center', lineHeight: 15, marginTop: 4 }}>
            Not medical advice. For informational purposes only.{'\n'}Always consult your healthcare provider.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Bottom CTA area */}
      <Animated.View style={[s.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) + 8 }, ctaAnim]}>
        {/* Contextual next actions */}
        {nextActions.length > 0 && (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {nextActions.map(action => (
              <TouchableOpacity
                key={action.label}
                style={s.secondaryBtn}
                activeOpacity={0.75}
                onPress={action.onPress}
              >
                <LucideIconByName name={action.icon as any} size={18} color={colors.orange} />
                <Text style={s.secondaryBtnText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity
          style={s.doneBtn}
          onPress={() => router.dismissAll()}
          activeOpacity={0.85}
        >
          <Text style={s.doneBtnText}>Got it</Text>
        </TouchableOpacity>
      </Animated.View>

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
      backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center',
      marginBottom: 12,
      shadowColor: c.orange, shadowOffset: { width: 0, height: 4 },
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
      borderWidth: 1,
    },
    effectPillText: {
      fontSize: 14, fontWeight: '700', fontFamily: FF,
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
      fontSize: 12, fontWeight: '800', color: c.orange,
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
      backgroundColor: c.orange,
      shadowColor: c.orange, shadowOffset: { width: 0, height: 4 },
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
    secondaryBtn: {
      height: 48, borderRadius: 24,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderWidth: 1.5, borderColor: `${c.orange}40`,
      backgroundColor: `${c.orange}08`,
    },
    secondaryBtnText: {
      fontSize: 16, fontWeight: '700', color: c.orange, fontFamily: FF,
    },
    doneBtn: {
      height: 54, borderRadius: 27, backgroundColor: c.orange,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: c.orange, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 18, elevation: 8,
    },
    doneBtnText: {
      fontSize: 18, fontWeight: '800', color: '#FFF', fontFamily: FF, letterSpacing: 0.3,
    },
  });
};
