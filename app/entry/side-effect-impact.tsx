import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
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
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, CircleCheck, Clock, Dumbbell, ExternalLink, ShieldCheck, X, XCircle } from 'lucide-react-native';

import { CircleIconButton } from '@/components/ui/circle-icon-button';
import { SolidCard } from '@/components/ui/solid-card';
import { useHealthData } from '@/contexts/health-data';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { computeBaseTargets, applyAdjustments, SIDE_EFFECT_RULES } from '@/lib/targets';
import { severityTier } from '@/constants/side-effects';
import { useUiStore } from '@/stores/ui-store';

const GREEN = '#27AE60';
const RED   = '#E53E3E';
const BLUE  = '#5AC8FA';
const FF    = 'System';

// Same hand-illustrated card assets the weekly check-in targets card uses, so
// the two "adjusted targets" surfaces never drift visually.
const METRIC_IMAGE = {
  protein: require('@/assets/images/cards/protein.png'),
  water:   require('@/assets/images/cards/hydration.png'),
  fiber:   require('@/assets/images/cards/fiber.png'),
  carbs:   require('@/assets/images/cards/carbs.png'),
  fat:     require('@/assets/images/cards/fat.png'),
  steps:   require('@/assets/images/cards/steps.png'),
} as const;

type MetricImageKey = keyof typeof METRIC_IMAGE;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mlToOz(ml: number) { return Math.round(ml / 29.5735); }

function capitalize(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

type Citation = { label: string; shortDesc: string };

type Row = {
  imageKey: MetricImageKey;
  label: string;
  before: number;
  after: number;
  beforeStr: string;
  afterStr: string;
  delta: string;
  increased: boolean;
  reason: string;
  citations?: Citation[];
};

// ─── Metric row (before/after bars + expandable reason) ─────────────────────────

function MetricRow({
  row, colors, isLast, expanded, onToggle, openAiChat, aiContext,
}: {
  row: Row;
  colors: AppColors;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
  openAiChat: (opts: any) => void;
  aiContext: string;
}) {
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const beforeColor = w(0.18);
  const chipColor = row.increased ? colors.orange : BLUE;
  const max = Math.max(row.before, row.after, 1);
  const beforePct = (row.before / max) * 100;
  const afterPct = (row.after / max) * 100;

  return (
    <Pressable
      onPress={onToggle}
      style={{ paddingVertical: 16, borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth, borderBottomColor: w(0.07) }}
    >
      {/* Head: asset + label + delta pill + chevron */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <Image source={METRIC_IMAGE[row.imageKey]} style={{ width: 28, height: 28 }} resizeMode="contain" accessibilityIgnoresInvertColors />
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, fontFamily: FF, letterSpacing: -0.2, flexShrink: 1 }}>{row.label}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: row.increased ? 'rgba(255,116,42,0.12)' : 'rgba(90,200,250,0.12)' }}>
            {row.increased ? <ArrowUp size={11} color={chipColor} /> : <ArrowDown size={11} color={chipColor} />}
            <Text style={{ fontSize: 14, fontWeight: '800', color: chipColor, fontFamily: FF }}>{row.delta}</Text>
          </View>
          {expanded ? <ChevronUp size={14} color={w(0.25)} /> : <ChevronDown size={14} color={w(0.25)} />}
        </View>
      </View>

      {/* Two bars: before (muted) + after (orange) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <View style={{ flex: 1, height: 12, borderRadius: 999, overflow: 'hidden', backgroundColor: w(0.06) }}>
          <View style={{ height: 12, borderRadius: 999, width: `${beforePct}%`, backgroundColor: beforeColor }} />
        </View>
        <Text style={{ width: 70, textAlign: 'right', fontSize: 13.5, fontWeight: '600', color: w(0.45), fontFamily: FF }}>{row.beforeStr}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, height: 12, borderRadius: 999, overflow: 'hidden', backgroundColor: w(0.06) }}>
          <View style={{ height: 12, borderRadius: 999, width: `${afterPct}%`, backgroundColor: colors.orange }} />
        </View>
        <Text style={{ width: 70, textAlign: 'right', fontSize: 13.5, fontWeight: '800', color: colors.textPrimary, fontFamily: FF }}>{row.afterStr}</Text>
      </View>

      {/* Expanded: reason + citations */}
      {expanded && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 14, color: w(0.45), fontFamily: FF, lineHeight: 19 }}>{row.reason}</Text>

          {row.citations && row.citations.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <ShieldCheck size={14} color={w(0.35)} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: w(0.4), fontFamily: FF }}>Informed by</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {row.citations.map(c => (
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
                    style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: w(0.05), flexDirection: 'row', alignItems: 'center', gap: 5 }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: '600', color: w(0.5), fontFamily: FF }}>{c.label}</Text>
                    <ExternalLink size={11} color={w(0.35)} />
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
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const { openAiChat } = useUiStore();

  const { effects: effectsParam } = useLocalSearchParams<{ effects: string }>();
  const { profile } = useHealthData();

  // Parse logged effects from route params
  const loggedEffects: { type: string; severity: number; label?: string }[] = useMemo(() => {
    try { return JSON.parse(effectsParam ?? '[]'); } catch { return []; }
  }, [effectsParam]);

  // Display name: prefer the effect's real label (many distinct effects share
  // dbType 'other', so `type` alone collapses them to a generic "Other").
  const displayName = (e: { type: string; label?: string }) => e.label ?? capitalize(e.type);

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

  // Collect all triggered citations for metric rows
  const triggeredCitations = useMemo(() => {
    const map = new Map<string, Citation[]>();
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
    for (const [key, cites] of map) {
      const unique = cites.filter((c, i, arr) => arr.findIndex(x => x.label === c.label) === i);
      map.set(key, unique);
    }
    return map;
  }, [loggedEffects]);

  // Build metric change rows (only show metrics that actually changed)
  const metricRows = useMemo(() => {
    const rows: Row[] = [];

    const proteinDiff = adjusted.proteinG - base.proteinG;
    if (Math.abs(proteinDiff) >= 1) rows.push({
      imageKey: 'protein', label: 'Daily Protein',
      before: base.proteinG, after: adjusted.proteinG,
      beforeStr: `${base.proteinG} g`, afterStr: `${adjusted.proteinG} g`,
      delta: `${proteinDiff > 0 ? '+' : ''}${proteinDiff} g`, increased: proteinDiff > 0,
      reason: proteinDiff > 0
        ? 'Higher protein preserves lean muscle when GLP-1 suppresses appetite. Try adding protein shakes, eggs, or Greek yogurt.'
        : 'Protein target slightly reduced to ease digestion.',
      citations: triggeredCitations.get('Daily Protein'),
    });

    const waterDiffMl = adjusted.waterMl - base.waterMl;
    const waterDiffOz = mlToOz(Math.abs(waterDiffMl));
    if (waterDiffOz >= 1) rows.push({
      imageKey: 'water', label: 'Daily Water',
      before: mlToOz(base.waterMl), after: mlToOz(adjusted.waterMl),
      beforeStr: `${mlToOz(base.waterMl)} oz`, afterStr: `${mlToOz(adjusted.waterMl)} oz`,
      delta: `${waterDiffMl > 0 ? '+' : '-'}${waterDiffOz} oz`, increased: waterDiffMl > 0,
      reason: waterDiffMl > 0
        ? 'Increased hydration helps manage GI symptoms and supports medication absorption. Sip steadily throughout the day.'
        : 'Water target unchanged.',
      citations: triggeredCitations.get('Daily Water'),
    });

    const fiberDiff = adjusted.fiberG - base.fiberG;
    if (Math.abs(fiberDiff) >= 1) rows.push({
      imageKey: 'fiber', label: 'Daily Fiber',
      before: base.fiberG, after: adjusted.fiberG,
      beforeStr: `${base.fiberG} g`, afterStr: `${adjusted.fiberG} g`,
      delta: `${fiberDiff > 0 ? '+' : ''}${fiberDiff} g`, increased: fiberDiff > 0,
      reason: fiberDiff > 0
        ? 'Soluble fiber (oats, legumes) supports digestion and softens stool. Add gradually to avoid gas.'
        : 'Fiber reduced to ease GI distress. Focus on easy-to-digest foods until symptoms settle.',
      citations: triggeredCitations.get('Daily Fiber'),
    });

    const carbsDiff = adjusted.carbsG - base.carbsG;
    if (Math.abs(carbsDiff) >= 3) rows.push({
      imageKey: 'carbs', label: 'Daily Carbs',
      before: base.carbsG, after: adjusted.carbsG,
      beforeStr: `${base.carbsG} g`, afterStr: `${adjusted.carbsG} g`,
      delta: `${carbsDiff > 0 ? '+' : ''}${carbsDiff} g`, increased: carbsDiff > 0,
      reason: carbsDiff > 0
        ? 'Complex carbs (whole grains, oats) provide steady energy. Avoid high-sugar foods that cause energy crashes.'
        : 'Carbs reduced to limit GI load. Stick to plain, easy-to-digest carbs like white rice and toast.',
      citations: triggeredCitations.get('Daily Carbs'),
    });

    const fatDiff = adjusted.fatG - base.fatG;
    if (Math.abs(fatDiff) >= 2) rows.push({
      imageKey: 'fat', label: 'Daily Fat',
      before: base.fatG, after: adjusted.fatG,
      beforeStr: `${base.fatG} g`, afterStr: `${adjusted.fatG} g`,
      delta: `${fatDiff > 0 ? '+' : ''}${fatDiff} g`, increased: fatDiff > 0,
      reason: fatDiff < 0
        ? 'Reducing fat eases GI symptoms and slows gastric emptying less aggressively. Avoid greasy and fried foods.'
        : 'Fat target unchanged.',
      citations: triggeredCitations.get('Daily Fat'),
    });

    const stepsDiff = adjusted.steps - base.steps;
    if (Math.abs(stepsDiff) >= 100) rows.push({
      imageKey: 'steps', label: 'Daily Steps',
      before: base.steps, after: adjusted.steps,
      beforeStr: base.steps.toLocaleString(), afterStr: adjusted.steps.toLocaleString(),
      delta: `${stepsDiff > 0 ? '+' : ''}${stepsDiff.toLocaleString()}`, increased: stepsDiff > 0,
      reason: stepsDiff > 0
        ? 'Light walking helps GI motility and reduces constipation and bloating. Short walks after meals are ideal.'
        : 'Rest is prioritized — avoid intense activity until symptoms improve.',
      citations: triggeredCitations.get('Daily Steps'),
    });

    return rows;
  }, [base, adjusted, triggeredCitations]);

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
  const effectNames = loggedEffects.map(displayName);

  // AI context string summarising logged effects + changes
  const aiContext = useMemo(() => {
    const effectList = effectNames.join(', ') || 'side effects';
    const changes = metricRows.map(r => `${r.label}: ${r.beforeStr} → ${r.afterStr}`).join(', ');
    return `Logged: ${effectList}. Target changes: ${changes || 'none'}.`;
  }, [effectNames, metricRows]);

  const hasFoodGuidance = adjusted.foodsToPrioritize.length > 0 || adjusted.foodsToAvoid.length > 0;
  const hasMealFreq = adjusted.mealFrequency > 3;
  const hasAdjustments = metricRows.length > 0 || hasMealFreq || hasFoodGuidance || adjusted.resistanceTrainingRecommended;

  // ── Entrance animations ─────────────────────────────────────────────────────
  const headOpacity = useSharedValue(0);
  const headY = useSharedValue(10);
  const contentOpacity = useSharedValue(0);
  const contentY = useSharedValue(12);

  useEffect(() => {
    const ease = { duration: 280, easing: Easing.out(Easing.quad) };
    headOpacity.value = withTiming(1, ease);
    headY.value = withTiming(0, ease);
    contentOpacity.value = withDelay(120, withTiming(1, ease));
    contentY.value = withDelay(120, withTiming(0, ease));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const headAnim = useAnimatedStyle(() => ({ opacity: headOpacity.value, transform: [{ translateY: headY.value }] }));
  const contentAnim = useAnimatedStyle(() => ({ opacity: contentOpacity.value, transform: [{ translateY: contentY.value }] }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <CircleIconButton icon={X} onPress={() => router.dismissAll()} accessibilityLabel="Close" />
        <Text style={s.headerTitle}>Target Adjustments</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* What was logged */}
        <Animated.View style={[{ marginBottom: 24 }, headAnim]}>
          <Text style={s.sectionHeader}>What was logged</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {loggedEffects.map((e, i) => {
              const t = severityTier(e.severity);
              const pillColor = t === 'severe' ? RED : t === 'moderate' ? colors.orange : GREEN;
              return (
                <View key={`${e.type}-${i}`} style={[s.effectPill, { backgroundColor: `${pillColor}14` }]}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: pillColor }} />
                  <Text style={[s.effectPillText, { color: colors.textPrimary }]}>{displayName(e)}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View style={[{ gap: 16 }, contentAnim]}>
          {/* What changed */}
          {metricRows.length > 0 && (
            <View>
              <Text style={s.sectionHeader}>What changed</Text>
              <SolidCard radius={24}>
                <View style={{ padding: 18 }}>
                  {/* Legend */}
                  <View style={s.legend}>
                    <View style={s.legendItem}>
                      <View style={[s.swatch, { backgroundColor: w(0.18) }]} />
                      <Text style={s.legendText}>Before</Text>
                    </View>
                    <View style={s.legendItem}>
                      <View style={[s.swatch, { backgroundColor: colors.orange }]} />
                      <Text style={s.legendText}>After</Text>
                    </View>
                    <Text style={[s.legendText, { marginLeft: 'auto' }]}>Tap a row for why</Text>
                  </View>

                  {metricRows.map((row, i) => (
                    <MetricRow
                      key={row.label}
                      row={row}
                      colors={colors}
                      isLast={i === metricRows.length - 1}
                      expanded={expandedRows.has(i)}
                      onToggle={() => toggleRow(i)}
                      openAiChat={openAiChat}
                      aiContext={aiContext}
                    />
                  ))}
                </View>
              </SolidCard>
            </View>
          )}

          {/* Meal timing */}
          {hasMealFreq && (
            <SolidCard radius={24}>
              <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Clock size={24} color={colors.textPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Meal timing</Text>
                  <Text style={s.cardBigValue}>{adjusted.mealFrequency} small meals a day</Text>
                  <Text style={s.cardBody}>
                    Smaller, more frequent meals reduce GI load and help manage gastric emptying more comfortably.
                  </Text>
                </View>
              </View>
            </SolidCard>
          )}

          {/* Strength training */}
          {adjusted.resistanceTrainingRecommended && (
            <SolidCard radius={24}>
              <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Dumbbell size={24} color={colors.textPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Strength training</Text>
                  <Text style={[s.cardBigValue, { fontSize: 17 }]}>Recommended 2–3× a week</Text>
                  <Text style={s.cardBody}>
                    Resistance training is the most effective way to prevent lean muscle loss on GLP-1. Even bodyweight squats and rows count.
                  </Text>
                </View>
              </View>
            </SolidCard>
          )}

          {/* Food guidance */}
          {hasFoodGuidance && (
            <SolidCard radius={24}>
              <View style={{ padding: 20 }}>
                <Text style={s.cardTitle}>Food guidance</Text>

                {adjusted.foodsToPrioritize.length > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <CircleCheck size={16} color={GREEN} />
                      <Text style={[s.guidanceLabel, { color: GREEN }]}>Prioritize</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {adjusted.foodsToPrioritize.map(food => (
                        <View key={food} style={[s.foodChip, { backgroundColor: 'rgba(39,174,96,0.10)' }]}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: GREEN, fontFamily: FF }}>{food}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {adjusted.foodsToAvoid.length > 0 && (
                  <View style={{ marginTop: 18 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <XCircle size={16} color={RED} />
                      <Text style={[s.guidanceLabel, { color: RED }]}>Go easy on</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {adjusted.foodsToAvoid.map(food => (
                        <View key={food} style={[s.foodChip, { backgroundColor: 'rgba(229,62,62,0.08)' }]}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: RED, fontFamily: FF }}>{food}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </SolidCard>
          )}

          {/* No changes fallback */}
          {!hasAdjustments && (
            <SolidCard radius={24}>
              <View style={{ padding: 24, alignItems: 'center' }}>
                <CircleCheck size={30} color={GREEN} style={{ marginBottom: 10 }} />
                <Text style={s.noAdjTitle}>No adjustments needed</Text>
                <Text style={s.noAdjBody}>
                  These effects don't call for target changes. Continue with your regular targets.
                </Text>
              </View>
            </SolidCard>
          )}

          {/* Disclaimer */}
          <Text style={s.disclaimer}>
            Not medical advice. For informational purposes only.{'\n'}Always consult your healthcare provider.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Fixed Done CTA */}
      <View style={[s.ctaWrap, { paddingBottom: insets.bottom + 16, borderTopColor: w(0.06) }]}>
        <TouchableOpacity
          style={s.doneBtn}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            useUiStore.getState().showLogSuccess({ title: 'Side effects logged' });
            router.dismissAll();
          }}
          activeOpacity={0.85}
        >
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 12,
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.4 },

    effectPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
    effectPillText: { fontSize: 14, fontWeight: '700', fontFamily: FF },

    sectionHeader: { fontSize: 18, fontWeight: '700', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.2, marginBottom: 12, marginLeft: 2 },

    // Legend (matches CheckinTargetsCard)
    legend: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 6 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 18, height: 10, borderRadius: 4 },
    legendText: { fontSize: 12.5, fontWeight: '600', color: w(0.45), fontFamily: FF },

    // Generic card text
    cardTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.2 },
    cardBigValue: { fontSize: 21, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.4, marginTop: 4 },
    cardBody: { fontSize: 14, color: w(0.45), fontFamily: FF, lineHeight: 19, marginTop: 6 },

    guidanceLabel: { fontSize: 15, fontWeight: '700', fontFamily: FF, letterSpacing: -0.2 },
    foodChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999 },

    // No-adjustments fallback
    noAdjTitle: { fontSize: 17, fontWeight: '800', color: c.textPrimary, fontFamily: FF },
    noAdjBody: { fontSize: 15, color: w(0.45), fontFamily: FF, marginTop: 6, textAlign: 'center', lineHeight: 19 },

    disclaimer: { fontSize: 12, color: w(0.3), fontFamily: FF, textAlign: 'center', lineHeight: 16, marginTop: 4 },

    // Fixed CTA
    ctaWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth },
    doneBtn: {
      backgroundColor: c.orange, borderRadius: 999, paddingVertical: 17, alignItems: 'center', justifyContent: 'center',
      shadowColor: c.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
    },
    doneBtnText: { fontSize: 18, fontWeight: '800', color: '#FFF', fontFamily: FF, letterSpacing: 0.4 },
  });
};
