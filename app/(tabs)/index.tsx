import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, LayoutChangeEvent, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassBorder } from '@/components/ui/glass-border';
import { fetchDailySnapshot, useHealthData, type DailySnapshot } from '@/contexts/health-data';
import { localDateStr } from '@/lib/date-utils';
import { useHealthKitStore } from '@/stores/healthkit-store';
import {
  daysSinceInjection,
  generateFocuses,
  generateInsights,
  type DailyActuals,
  type DailyTargets,
  type FocusItem,
  type ShotPhase,
} from '@/constants/scoring';
import { BRAND_DISPLAY_NAMES } from '@/constants/user-profile';
import { useFocusEffect } from 'expo-router';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';
import { generateDynamicInsights } from '@/lib/openai';
import { WeeklyCheckinCard } from '@/components/weekly-checkin-card';
import { ClinicalAlertCard, getDismissedFlags } from '@/components/clinical-alert-card';
import { buildClinicalFlags } from '@/lib/clinical-alerts';
import { usePersonalizationStore } from '@/stores/personalization-store';
import type { PersonalizedPlan } from '@/lib/personalization';
import { useLogStore } from '@/stores/log-store';
import { useUiStore } from '@/stores/ui-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { usePreferencesStore } from '@/stores/preferences-store';
import { supabase } from '@/lib/supabase';
import { useBiometricStore } from '@/stores/biometric-store';
import { generateForecastStrip } from '@/lib/cycle-intelligence';
import { AppetiteForecastStrip } from '@/components/appetite-forecast-strip';

const ORANGE = '#FF742A';

const INJECTION_SITES = [
  'Left Abdomen', 'Right Abdomen',
  'Left Thigh', 'Right Thigh',
  'Left Upper Arm', 'Right Upper Arm',
];
const FF = 'Helvetica Neue';

const MED_BRAND: Record<string, string> = {
  semaglutide: 'Ozempic',
  tirzepatide: 'Zepbound',
  dulaglutide: 'Trulicity',
};

// ─── Medication Banner ────────────────────────────────────────────────────────

function MedicationBanner({
  glp1Type,
  doseMg,
  medicationName,
  programWeek,
  startDate,
}: {
  glp1Type: string;
  doseMg: number;
  medicationName?: string | null;
  programWeek: number;
  startDate: string;
}) {
  const { colors } = useAppTheme();
  const mb = useMemo(() => createMbStyles(colors), [colors]);
  const displayName = medicationName ?? MED_BRAND[glp1Type] ?? glp1Type;
  const dayCount = Math.max(1, Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000) + 1);
  return (
    <View style={mb.row}>
      <View style={mb.chip}>
        <Text style={mb.chipText}>{displayName}  {doseMg} mg</Text>
      </View>
      <View style={mb.chip}>
        <Text style={mb.chipText}>Week {programWeek}  ·  Day {dayCount}</Text>
      </View>
    </View>
  );
}

const createMbStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
    chip: {
      backgroundColor: c.borderSubtle,
      borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 5,
    },
    chipText: {
      fontSize: 12, fontWeight: '600',
      color: w(0.7),
      fontFamily: FF,
    },
  });
};

const glassShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 24,
  elevation: 8,
};

// ─── Phase Label Builder ──────────────────────────────────────────────────────

function buildPhaseLabel(phase: ShotPhase, daysSinceShot: number, medType: string): string {
  if (daysSinceShot === 0) return 'Shot Day · Injection logged';
  if (daysSinceShot === 1) return 'Peak Phase · Day 2 since last shot';
  if (daysSinceShot === 2) return 'Peak Phase · Day 3 since last shot';
  if (daysSinceShot === 3) return 'Peak Phase · Day 4 since last shot';
  if (daysSinceShot <= 5)  return `Balance Phase · Day ${daysSinceShot} since last shot`;
  if (daysSinceShot === 6) return 'Reset Phase · Day 7 - Injection due tomorrow';
  if (daysSinceShot >= 7)  return 'Injection Overdue - Consider logging your dose';
  return 'Balance Phase';
}

function buildDynamicFocusHint(plan: PersonalizedPlan | null): string {
  if (!plan) return '';
  if (!plan.actuals.injectionLogged) return 'Log your injection to complete today\'s cycle';
  const proteinPct = plan.targets.proteinG > 0 ? plan.actuals.proteinG / plan.targets.proteinG : 1;
  if (proteinPct < 0.5) return 'Protein is well below target - prioritize it today to protect muscle';
  if (proteinPct < 0.8) return 'You\'re partway to your protein target - keep going';
  const stepsPct = plan.targets.steps > 0 ? plan.actuals.steps / plan.targets.steps : 1;
  if (stepsPct < 0.4) return 'Movement is low today - even a short walk counts';
  if (plan.sideEffectBurden > 60) return 'High side effect burden - focus on hydration and rest';
  if (plan.adherenceScore >= 85) return 'Strong day - you\'re ahead on all fronts';
  return 'Keep your current habits going - consistency is what drives results';
}


// ─── Local date helpers ───────────────────────────────────────────────────────

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function isProjectedShot(lastDate: string | null, freqDays: number, target: Date): boolean {
  if (!lastDate) return false;
  const diff = Math.round((target.getTime() - new Date(lastDate).getTime()) / 86400000);
  return diff > 0 && diff % freqDays === 0;
}

// ─── Calendar Dropdown ────────────────────────────────────────────────────────

type CalendarDropdownProps = {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  top: number;
  minDate: Date;
  lastInjectionDate?: string | null;
  injectionFrequencyDays?: number;
  datesWithLogs?: Set<string>;
  datesWithInjections?: Set<string>;
};

function CalendarDropdown({ selectedDate, onSelect, top, minDate, lastInjectionDate, injectionFrequencyDays = 7, datesWithLogs, datesWithInjections }: CalendarDropdownProps) {
  const { colors } = useAppTheme();
  const cal = useMemo(() => createCalStyles(colors), [colors]);
  const today = new Date();
  const [viewYear, setViewYear]   = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  return (
    <View style={[cal.container, glassShadow, { top }]}>
      <BlurView intensity={40} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
      <GlassBorder r={20} />
      <View style={cal.inner}>
        {/* Month nav */}
        <View style={cal.monthRow}>
          <Pressable onPress={prevMonth} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={cal.monthLabel}>{monthLabel}</Text>
          <Pressable onPress={nextMonth} hitSlop={10}>
            <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
        {/* Day headers */}
        <View style={cal.weekRow}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <Text key={d} style={cal.dayHeader}>{d}</Text>
          ))}
        </View>
        {/* Day grid */}
        {chunk(cells, 7).map((week, wi) => (
          <View key={wi} style={cal.weekRow}>
            {week.map((day, di) => {
              if (!day) return <View key={di} style={cal.cell} />;
              const date  = new Date(viewYear, viewMonth, day);
              const isSel = sameDay(date, selectedDate);
              const isTod = sameDay(date, today);
              // Block dates before program start (not today)
              const isPre = !isTod && date < minDate;
              // Injection day: confirmed past log OR projected from last injection + frequency
              const hasInjLog = datesWithInjections?.has(localDateStr(date)) === true;
              const isInjDay = hasInjLog || (lastInjectionDate
                ? (() => {
                    const diff = Math.round((date.getTime() - new Date(lastInjectionDate).getTime()) / 86400000);
                    return diff >= 0 && diff % injectionFrequencyDays === 0;
                  })()
                : false);
              const hasOtherLog = !isTod && datesWithLogs?.has(localDateStr(date)) === true;
              return (
                <Pressable key={di} style={cal.cell} onPress={() => { if (!isPre) onSelect(date); }}>
                  <View style={[cal.dayCircle, isSel && cal.daySelected]}>
                    <Text style={[cal.dayNum, isSel && cal.dayNumSel, isPre && cal.dayFuture]}>
                      {day}
                    </Text>
                  </View>
                  {isTod && !isSel && <View style={cal.todayDot} />}
                  {!isTod && isInjDay && !isSel && <View style={cal.injDot} />}
                  {!isTod && !isInjDay && hasOtherLog && !isSel && <View style={cal.logDot} />}
                </Pressable>
              );
            })}
          </View>
        ))}
        {/* Legend */}
        <View style={cal.legend}>
          <View style={cal.legendItem}>
            <View style={[cal.legendDot, { backgroundColor: '#FF742A' }]} />
            <Text style={cal.legendLabel}>Shot day</Text>
          </View>
          <View style={cal.legendItem}>
            <View style={[cal.legendDot, { backgroundColor: '#34C759' }]} />
            <Text style={cal.legendLabel}>Logged</Text>
          </View>
          <View style={cal.legendItem}>
            <View style={[cal.legendDot, { backgroundColor: '#5AC8FA' }]} />
            <Text style={cal.legendLabel}>Today</Text>
          </View>
        </View>
      </View>
    </View>
  );
}


// ─── Focus Timeline Sub-components ───────────────────────────────────────────

function PulsingDot() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.3, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false,
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[s.pulsingDot, animStyle]} />;
}

function StatusIndicator({ status }: { status: 'completed' | 'active' | 'pending' }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  if (status === 'completed') {
    return (
      <View style={s.indicatorFilled}>
        <Ionicons name="checkmark" size={14} color="#FFF" />
      </View>
    );
  }
  return <View style={s.indicatorEmpty} />;
}

function TimelineLine({ status }: { status: 'completed' | 'active' | 'pending' }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  if (status === 'completed') {
    return <View style={[s.timelineLine, { backgroundColor: ORANGE }]} />;
  }
  if (status === 'active') {
    return <View style={[s.timelineLine, { borderLeftWidth: 2, borderStyle: 'dashed', borderLeftColor: ORANGE }]} />;
  }
  return <View style={[s.timelineLine, { borderLeftWidth: 2, borderStyle: 'dashed', borderLeftColor: colors.borderSubtle }]} />;
}

// ─── Daily Log Summary Card ───────────────────────────────────────────────────

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch:     'Lunch',
  dinner:    'Dinner',
  snack:     'Snack',
};

const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🌅',
  lunch:     '☀️',
  dinner:    '🌙',
  snack:     '🍎',
};

function activityEmojiDL(exerciseType: string | null | undefined): string {
  const t = (exerciseType ?? '').toLowerCase();
  if (t.includes('run') || t.includes('jog'))      return '🏃';
  if (t.includes('walk'))                           return '🚶';
  if (t.includes('cycl') || t.includes('bike'))    return '🚴';
  if (t.includes('swim'))                           return '🏊';
  if (t.includes('yoga') || t.includes('stretch'))  return '🧘';
  if (t.includes('strength') || t.includes('weight') || t.includes('lift')) return '🏋️';
  if (t.includes('hike'))                           return '🥾';
  if (t.includes('dance'))                          return '💃';
  if (t.includes('sport') || t.includes('tennis') || t.includes('basketball') || t.includes('soccer')) return '🏅';
  return '⚡';
}

// ── Style helpers (outside component to avoid recreation) ──────────────────
function dlSectionLabel(w: (a: number) => string) {
  return { fontSize: 11, fontWeight: '700' as const, color: w(0.35), letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 6, fontFamily: FF };
}
function dlEditLabel(w: (a: number) => string) {
  return { fontSize: 12, fontWeight: '600' as const, color: w(0.45), marginBottom: 6, fontFamily: FF };
}
function dlInput(colors: AppColors, w: (a: number) => string) {
  return {
    backgroundColor: w(0.05),
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: w(0.85),
    fontFamily: FF,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: w(0.1),
    marginBottom: 14,
  };
}

// ── MetricBar sub-component ────────────────────────────────────────────────
function MetricBar({ label, current, target, unit, colors, color }: {
  label: string; current: number; target: number; unit: string; colors: AppColors; color: string;
}) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const pct  = target > 0 ? Math.min(current / target, 1) : 0;
  const over = current > target && target > 0;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ fontSize: 12, color: w(0.5), fontFamily: FF }}>{label}</Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: over ? ORANGE : w(0.65), fontFamily: FF }}>
          {current}{unit} / {target}{unit}
        </Text>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: w(0.08), overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: 4, borderRadius: 2, backgroundColor: over ? ORANGE : color }} />
      </View>
    </View>
  );
}

type EditTarget =
  | { kind: 'food';     item: DailySnapshot['foodLogs'][0] }
  | { kind: 'activity'; item: DailySnapshot['activityLogs'][0] }
  | { kind: 'weight';   item: NonNullable<DailySnapshot['weightLog']> }
  | null;

type DailyLogSummaryCardProps = {
  foodLogs:       DailySnapshot['foodLogs'];
  activityLogs:   DailySnapshot['activityLogs'];
  weightLog:      DailySnapshot['weightLog'] | null;
  injectionLog:   DailySnapshot['injectionLog'] | null;
  sideEffectLogs: DailySnapshot['sideEffectLogs'];
  waterOz:        number;
  isLoading:      boolean;
  isFuture:       boolean;
  targets:        DailyTargets;
  onRefresh:      () => void;
};

function DailyLogSummaryCard({
  foodLogs, activityLogs, weightLog, injectionLog, sideEffectLogs, waterOz,
  isLoading, isFuture, targets, onRefresh,
}: DailyLogSummaryCardProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const [expanded,   setExpanded]   = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editForm,   setEditForm]   = useState<Record<string, string>>({});
  const [saving,     setSaving]     = useState(false);

  const totalCals    = foodLogs.reduce((sum, f) => sum + (f.calories  ?? 0), 0);
  const totalProtein = foodLogs.reduce((sum, f) => sum + (f.protein_g ?? 0), 0);
  const totalFiber   = foodLogs.reduce((sum, f) => sum + (f.fiber_g   ?? 0), 0);
  const isEmpty = foodLogs.length === 0 && activityLogs.length === 0 && !weightLog && !injectionLog && sideEffectLogs.length === 0 && waterOz === 0;

  function openEdit(target: EditTarget) {
    if (!target) return;
    let form: Record<string, string> = {};
    if (target.kind === 'food') {
      const i = target.item;
      form = { food_name: i.food_name, calories: String(i.calories), protein_g: String(i.protein_g), carbs_g: String(i.carbs_g), fat_g: String(i.fat_g), meal_type: i.meal_type };
    } else if (target.kind === 'activity') {
      const i = target.item;
      form = { exercise_type: i.exercise_type, duration_min: String(i.duration_min), steps: String(i.steps), active_calories: String(i.active_calories) };
    } else {
      form = { weight_lbs: String(target.item.weight_lbs) };
    }
    setEditForm(form);
    setEditTarget(target);
  }

  async function saveEdit() {
    if (!editTarget) return;
    setSaving(true);
    try {
      if (editTarget.kind === 'food') {
        await supabase.from('food_logs').update({
          food_name: editForm.food_name,
          calories:  Number(editForm.calories)  || 0,
          protein_g: Number(editForm.protein_g) || 0,
          carbs_g:   Number(editForm.carbs_g)   || 0,
          fat_g:     Number(editForm.fat_g)     || 0,
          meal_type: editForm.meal_type as any,
        }).eq('id', editTarget.item.id);
      } else if (editTarget.kind === 'activity') {
        await supabase.from('activity_logs').update({
          exercise_type:   editForm.exercise_type,
          duration_min:    Number(editForm.duration_min)    || 0,
          steps:           Number(editForm.steps)           || 0,
          active_calories: Number(editForm.active_calories) || 0,
        }).eq('id', editTarget.item.id);
      } else {
        await supabase.from('weight_logs').update({
          weight_lbs: Number(editForm.weight_lbs) || 0,
        }).eq('id', editTarget.item.id);
      }
      setEditTarget(null);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(table: string, id: string, label: string) {
    Alert.alert('Remove Entry', `Delete "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from(table as any).delete().eq('id', id);
          onRefresh();
        }
      },
    ]);
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[s.cardWrap, { marginBottom: 24, marginTop: 8 }]}>
        <View style={[s.cardBody, { backgroundColor: colors.surface, padding: 20 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ height: 17, width: 80, borderRadius: 8, backgroundColor: colors.borderSubtle }} />
            <View style={{ height: 17, width: 60, borderRadius: 8, backgroundColor: colors.borderSubtle }} />
          </View>
          {[0.9, 0.7, 0.8].map((pct, i) => (
            <View key={i} style={{ height: 14, borderRadius: 7, backgroundColor: colors.borderSubtle, marginBottom: 12, width: `${pct * 100}%` as any }} />
          ))}
        </View>
      </View>
    );
  }

  const canExpand = !isEmpty && !isFuture;

  // ── Compact summary lines ─────────────────────────────────────────────────
  const summaryParts: string[] = [];
  if (injectionLog) summaryParts.push(`💉  ${injectionLog.medication_name ?? 'Injection'} ${injectionLog.dose_mg}mg logged`);
  if (foodLogs.length > 0) summaryParts.push(`🍽️  ${foodLogs.length} meal${foodLogs.length > 1 ? 's' : ''} · ${totalCals} cal`);
  if (activityLogs.length > 0) summaryParts.push(`${activityEmojiDL(activityLogs[0]?.exercise_type)}  ${activityLogs.length} activit${activityLogs.length > 1 ? 'ies' : 'y'}`);
  if (weightLog) summaryParts.push(`⚖️  ${weightLog.weight_lbs} lbs`);
  if (waterOz > 0) summaryParts.push(`💧  ${waterOz} oz water`);
  if (sideEffectLogs.length > 0) summaryParts.push(`🤢  ${sideEffectLogs.length} side effect${sideEffectLogs.length > 1 ? 's' : ''}`);

  return (
    <View style={[s.cardWrap, { marginBottom: 24, marginTop: 8 }]}>
      <View style={[s.cardBody, { backgroundColor: colors.surface }]}>

        {/* ── Header - always tappable ── */}
        <Pressable
          style={{ padding: 20, paddingBottom: expanded ? 12 : 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          onPress={() => canExpand && setExpanded(v => !v)}
        >
          <Text style={s.insightsTitle}>Day Log</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {totalCals > 0 && (
              <View style={{ backgroundColor: colors.borderSubtle, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: w(0.55), fontFamily: FF }}>{totalCals} cal</Text>
              </View>
            )}
            {canExpand && (
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={w(0.35)} />
            )}
          </View>
        </Pressable>

        {/* ── Collapsed state ── */}
        {!expanded && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
            {isFuture ? (
              <Text style={{ fontSize: 14, color: w(0.4), fontFamily: FF }}>Nothing logged yet - this is a future date.</Text>
            ) : isEmpty ? (
              <Text style={{ fontSize: 14, color: w(0.4), fontFamily: FF }}>No entries logged for this day.</Text>
            ) : (
              <View style={{ gap: 5 }}>
                {summaryParts.map((part, i) => (
                  <Text key={i} style={{ fontSize: 14, color: w(0.65), fontFamily: FF }}>{part}</Text>
                ))}
                <Text style={{ fontSize: 12, color: w(0.28), marginTop: 4, fontFamily: FF }}>Tap to view details & edit</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Expanded state ── */}
        {expanded && canExpand && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>

            {/* ── Metrics Impact ── */}
            <View style={{ marginBottom: 18, padding: 14, borderRadius: 16, backgroundColor: w(0.04) }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: w(0.35), letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12, fontFamily: FF }}>Metrics Impact</Text>
              {targets.caloriesTarget > 0 && (
                <MetricBar label="Calories" current={totalCals}    target={targets.caloriesTarget} unit=" cal" colors={colors} color={ORANGE} />
              )}
              {targets.proteinG > 0 && (
                <MetricBar label="Protein"  current={totalProtein} target={targets.proteinG}       unit="g"   colors={colors} color="#34C759" />
              )}
              {targets.fiberG > 0 && (
                <MetricBar label="Fiber"    current={totalFiber}   target={targets.fiberG}         unit="g"   colors={colors} color="#5AC8FA" />
              )}
              {targets.waterMl > 0 && waterOz > 0 && (
                <MetricBar label="Water" current={waterOz} target={Math.round(targets.waterMl / 29.5735)} unit=" oz" colors={colors} color="#5B8BF5" />
              )}
            </View>

            {/* ── Injection ── */}
            {injectionLog && (
              <View style={{ marginBottom: 16 }}>
                <Text style={dlSectionLabel(w)}>Injection</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w(0.07), gap: 10 }}>
                  <Text style={{ fontSize: 16 }}>💉</Text>
                  <Text style={{ fontSize: 14, color: w(0.82), flex: 1, fontFamily: FF }}>
                    {injectionLog.medication_name ?? 'Injection'} · {injectionLog.dose_mg}mg
                  </Text>
                  <Pressable hitSlop={10} onPress={() => confirmDelete('injection_logs', injectionLog.id, `${injectionLog.medication_name ?? 'Injection'} ${injectionLog.dose_mg}mg`)}>
                    <Ionicons name="trash-outline" size={15} color={w(0.28)} />
                  </Pressable>
                </View>
              </View>
            )}

            {/* ── Food ── */}
            {foodLogs.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={dlSectionLabel(w)}>Food</Text>
                {foodLogs.map(f => (
                  <View key={f.id} style={{ paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w(0.07) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <Text style={{ fontSize: 14, marginTop: 1 }}>{MEAL_EMOJI[(f.meal_type ?? 'snack').toLowerCase()] ?? '🍽️'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: w(0.82), fontFamily: FF }} numberOfLines={1}>{f.food_name}</Text>
                        <Text style={{ fontSize: 11, color: w(0.38), marginTop: 2, fontFamily: FF }}>
                          {f.calories} cal · P {f.protein_g}g · C {f.carbs_g}g · F {f.fat_g}g
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingTop: 2 }}>
                        <Pressable hitSlop={10} onPress={() => openEdit({ kind: 'food', item: f })}>
                          <Ionicons name="pencil-outline" size={15} color={w(0.35)} />
                        </Pressable>
                        <Pressable hitSlop={10} onPress={() => confirmDelete('food_logs', f.id, f.food_name)}>
                          <Ionicons name="trash-outline" size={15} color={w(0.28)} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Activity ── */}
            {activityLogs.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={dlSectionLabel(w)}>Activity</Text>
                {activityLogs.map(a => (
                  <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w(0.07), gap: 8 }}>
                    <Text style={{ fontSize: 16 }}>{activityEmojiDL(a.exercise_type)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: w(0.82), fontFamily: FF }}>{a.exercise_type || 'Activity'}</Text>
                      <Text style={{ fontSize: 11, color: w(0.38), marginTop: 2, fontFamily: FF }}>
                        {[
                          a.duration_min > 0 ? `${a.duration_min} min` : null,
                          a.steps > 0 ? `${a.steps.toLocaleString()} steps` : null,
                          a.active_calories > 0 ? `${a.active_calories} cal burned` : null,
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                      <Pressable hitSlop={10} onPress={() => openEdit({ kind: 'activity', item: a })}>
                        <Ionicons name="pencil-outline" size={15} color={w(0.35)} />
                      </Pressable>
                      <Pressable hitSlop={10} onPress={() => confirmDelete('activity_logs', a.id, a.exercise_type || 'Activity')}>
                        <Ionicons name="trash-outline" size={15} color={w(0.28)} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Weight ── */}
            {weightLog && (
              <View style={{ marginBottom: 16 }}>
                <Text style={dlSectionLabel(w)}>Weight</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w(0.07), gap: 8 }}>
                  <Text style={{ fontSize: 16 }}>⚖️</Text>
                  <Text style={{ fontSize: 14, color: w(0.82), flex: 1, fontFamily: FF }}>{weightLog.weight_lbs} lbs</Text>
                  <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                    <Pressable hitSlop={10} onPress={() => openEdit({ kind: 'weight', item: weightLog })}>
                      <Ionicons name="pencil-outline" size={15} color={w(0.35)} />
                    </Pressable>
                    <Pressable hitSlop={10} onPress={() => confirmDelete('weight_logs', weightLog.id, `${weightLog.weight_lbs} lbs`)}>
                      <Ionicons name="trash-outline" size={15} color={w(0.28)} />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {/* ── Water ── */}
            {waterOz > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={dlSectionLabel(w)}>Water</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w(0.07), gap: 8 }}>
                  <Text style={{ fontSize: 16 }}>💧</Text>
                  <Text style={{ fontSize: 14, color: w(0.82), flex: 1, fontFamily: FF }}>{waterOz} oz</Text>
                </View>
              </View>
            )}

            {/* ── Side Effects ── */}
            {sideEffectLogs.length > 0 && (
              <View>
                <Text style={dlSectionLabel(w)}>Side Effects</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {sideEffectLogs.map(se => (
                    <View key={se.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(231,76,60,0.1)', borderRadius: 20, paddingLeft: 10, paddingRight: 6, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#E74C3C', fontFamily: FF }}>
                        🤢 {se.effect_type.replace(/_/g, ' ')} · {se.severity}/10
                      </Text>
                      <Pressable hitSlop={6} onPress={() => confirmDelete('side_effect_logs', se.id, se.effect_type.replace(/_/g, ' '))}>
                        <Ionicons name="close-circle" size={14} color="#E74C3C" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}

          </View>
        )}
      </View>

      {/* ── Edit Modal ── */}
      <Modal visible={editTarget !== null} transparent animationType="slide" onRequestClose={() => setEditTarget(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={() => setEditTarget(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable onPress={() => {}}>
              <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
                {/* Drag handle */}
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: w(0.18), alignSelf: 'center', marginBottom: 20 }} />

                {/* ── Food edit form ── */}
                {editTarget?.kind === 'food' && (
                  <>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: w(0.9), fontFamily: FF, marginBottom: 18 }}>Edit Food Entry</Text>
                    <Text style={dlEditLabel(w)}>Food Name</Text>
                    <TextInput
                      style={dlInput(colors, w)}
                      value={editForm.food_name}
                      onChangeText={t => setEditForm(f => ({ ...f, food_name: t }))}
                      placeholder="Food name"
                      placeholderTextColor={w(0.3)}
                      returnKeyType="done"
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {(['calories', 'protein_g', 'carbs_g', 'fat_g'] as const).map(field => (
                        <View key={field} style={{ flex: 1 }}>
                          <Text style={dlEditLabel(w)}>{field === 'calories' ? 'Cal' : field === 'protein_g' ? 'Pro' : field === 'carbs_g' ? 'Carb' : 'Fat'}</Text>
                          <TextInput
                            style={dlInput(colors, w)}
                            value={editForm[field]}
                            onChangeText={t => setEditForm(f => ({ ...f, [field]: t }))}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={w(0.3)}
                          />
                        </View>
                      ))}
                    </View>
                    <Text style={dlEditLabel(w)}>Meal Type</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 22 }}>
                      {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(mt => (
                        <Pressable
                          key={mt}
                          onPress={() => setEditForm(f => ({ ...f, meal_type: mt }))}
                          style={{ flex: 1, padding: 9, borderRadius: 10, backgroundColor: editForm.meal_type === mt ? ORANGE : w(0.07), alignItems: 'center' }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: editForm.meal_type === mt ? '#fff' : w(0.55), fontFamily: FF }}>
                            {MEAL_LABELS[mt]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                {/* ── Activity edit form ── */}
                {editTarget?.kind === 'activity' && (
                  <>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: w(0.9), fontFamily: FF, marginBottom: 18 }}>Edit Activity</Text>
                    <Text style={dlEditLabel(w)}>Exercise Type</Text>
                    <TextInput
                      style={dlInput(colors, w)}
                      value={editForm.exercise_type}
                      onChangeText={t => setEditForm(f => ({ ...f, exercise_type: t }))}
                      placeholder="e.g. Walking"
                      placeholderTextColor={w(0.3)}
                      returnKeyType="done"
                    />
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 22 }}>
                      {(['duration_min', 'steps', 'active_calories'] as const).map(field => (
                        <View key={field} style={{ flex: 1 }}>
                          <Text style={dlEditLabel(w)}>{field === 'duration_min' ? 'Min' : field === 'steps' ? 'Steps' : 'Cal burned'}</Text>
                          <TextInput
                            style={dlInput(colors, w)}
                            value={editForm[field]}
                            onChangeText={t => setEditForm(f => ({ ...f, [field]: t }))}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor={w(0.3)}
                          />
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {/* ── Weight edit form ── */}
                {editTarget?.kind === 'weight' && (
                  <>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: w(0.9), fontFamily: FF, marginBottom: 18 }}>Edit Weight</Text>
                    <Text style={dlEditLabel(w)}>Weight (lbs)</Text>
                    <TextInput
                      style={dlInput(colors, w)}
                      value={editForm.weight_lbs}
                      onChangeText={t => setEditForm(f => ({ ...f, weight_lbs: t }))}
                      keyboardType="decimal-pad"
                      placeholder="0.0"
                      placeholderTextColor={w(0.3)}
                      returnKeyType="done"
                    />
                    <View style={{ marginBottom: 22 }} />
                  </>
                )}

                {/* ── Buttons ── */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Pressable
                    style={{ flex: 1, padding: 15, borderRadius: 14, backgroundColor: w(0.07), alignItems: 'center' }}
                    onPress={() => setEditTarget(null)}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: w(0.6), fontFamily: FF }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={{ flex: 2, padding: 15, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', opacity: saving ? 0.65 : 1 }}
                    onPress={saveEdit}
                    disabled={saving}
                  >
                    {saving
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: FF }}>Save Changes</Text>
                    }
                  </Pressable>
                </View>

              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { onScroll, onScrollEnd } = useTabBarVisibility();
  const healthData = useHealthData();
  const { recoveryScore, supportScore, lastLogAction, wearable, actuals, targets, profile, focuses } = healthData;
  const hkStore = useHealthKitStore();
  const { appleHealthEnabled } = usePreferencesStore();

  const personalizationStore = usePersonalizationStore();
  const logStore = useLogStore();
  const plan = personalizationStore.plan;
  const { openAiChat } = useUiStore();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [dismissedFlags, setDismissedFlags] = useState<string[]>([]);
  const [historicalSnapshot, setHistoricalSnapshot] = useState<DailySnapshot | null>(null);
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const [datesWithLogs, setDatesWithLogs] = useState<Set<string>>(new Set());
  const [datesWithInjections, setDatesWithInjections] = useState<Set<string>>(new Set());

  const biometricStore = useBiometricStore();

  useFocusEffect(useCallback(() => {
    hkStore.fetchAll();
    personalizationStore.fetchAndRecompute();
    logStore.fetchInsightsData();
    getDismissedFlags().then(setDismissedFlags);

    // Fetch dates that have logged data (last 90 days) for calendar dot indicators
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cutoffStr = localDateStr(cutoff);
      Promise.all([
        supabase.from('injection_logs').select('injection_date').eq('user_id', user.id).gte('injection_date', cutoffStr),
        supabase.from('food_logs').select('logged_at').eq('user_id', user.id).gte('logged_at', cutoff.toISOString()),
        supabase.from('activity_logs').select('date').eq('user_id', user.id).gte('date', cutoffStr),
      ]).then(([injR, foodR, actR]) => {
        const injDates = new Set<string>();
        const logDates = new Set<string>();
        (injR.data ?? []).forEach(r => {
          injDates.add(r.injection_date);
          logDates.add(r.injection_date);
        });
        (foodR.data ?? []).forEach(r => logDates.add(localDateStr(new Date(r.logged_at))));
        (actR.data ?? []).forEach(r => logDates.add(r.date));
        setDatesWithInjections(injDates);
        setDatesWithLogs(logDates);
      });
    });
  }, []));

  const foodNoiseLogs = (logStore.foodNoiseLogs ?? []) as { score: number; logged_at: string }[];

  // Clinical flags
  const clinicalFlags = plan
    ? buildClinicalFlags({
        programWeek:          plan.programWeek,
        sideEffectLogs:       (logStore.sideEffectLogs ?? []) as any,
        activityLevel:        (logStore.profile as any)?.activity_level ?? 'light',
        proteinCompliancePct: plan.targets.proteinG > 0
          ? Math.min(plan.actuals.proteinG / plan.targets.proteinG, 1)
          : 0,
        plateauDetected:      plan.weightProjection?.plateauRisk === 'detected',
        hasSideEffectHairLoss: (logStore.sideEffectLogs ?? []).some(s => s.effect_type === 'hair_loss'),
        daysSinceLastLog:     logStore.sideEffectLogs?.[0]
          ? Math.floor((Date.now() - new Date(logStore.sideEffectLogs[0].logged_at).getTime()) / 86400000)
          : 0,
      }).filter(f => !dismissedFlags.includes(f.type))
    : [];

  const staticInsights = generateInsights(recoveryScore, supportScore, wearable, actuals, targets);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled && aiInsights === null && !insightsLoading) {
        setInsightsLoading(true);
        generateDynamicInsights(healthData)
          .then(results => { if (!cancelled) setAiInsights(results); })
          .catch(() => { /* fall back to static */ })
          .finally(() => { if (!cancelled) setInsightsLoading(false); });
      }
    }, 5000); // fallback: give up after 5s via the callOpenAI timeout
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // Fetch historical snapshot when user navigates to a past date
  useEffect(() => {
    const now = new Date();
    const todayQ = sameDay(selectedDate, now);
    const futureQ = !todayQ && selectedDate > now;
    if (todayQ || futureQ) {
      setHistoricalSnapshot(null);
      setIsLoadingDate(false);
      return;
    }
    setIsLoadingDate(true);
    fetchDailySnapshot(localDateStr(selectedDate))
      .then(setHistoricalSnapshot)
      .catch(() => setHistoricalSnapshot(null))
      .finally(() => setIsLoadingDate(false));
  }, [selectedDate]);

  const today   = new Date();
  const isToday = sameDay(selectedDate, today);
  const isFuture = !isToday && selectedDate > today;
  const isPast = !isToday && !isFuture;

  const dateLabel = `${selectedDate.toLocaleDateString('en-US', { month: 'long' })} ${ordinal(selectedDate.getDate())}`;
  const weekday = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });

  const dayNum = daysSinceInjection(profile.lastInjectionDate, selectedDate);
  const freq = profile.injectionFrequencyDays;

  // Medication strip - always relative to today
  const todayDayNum = daysSinceInjection(profile.lastInjectionDate, today);
  const daysUntil = (freq ?? 7) - todayDayNum;
  // Use actuals as source of truth for whether today's injection is already logged.
  // daysSinceInjection is capped at 7 so daysUntil can't go negative — we must
  // distinguish "due and not yet logged" from "due and already logged".
  const todayInjLogged = actuals.injectionLogged;
  const nextShotLabel = todayInjLogged
    ? 'Logged today'
    : daysUntil <= 0
      ? 'Due today'
      : daysUntil === 1
        ? 'Due tomorrow'
        : `In ${daysUntil} days`;
  const medName = BRAND_DISPLAY_NAMES[profile.medicationBrand ?? ''] ?? profile.medicationBrand ?? 'GLP-1';
  const medDose = profile.doseMg != null ? `${profile.doseMg}mg` : null;
  const shotPhaseForLabel: ShotPhase =
    dayNum <= 2 ? 'shot' : dayNum <= 4 ? 'peak' : dayNum <= 6 ? 'balance' : 'reset';
  const phaseLabel = buildPhaseLabel(
    shotPhaseForLabel,
    dayNum - 1,
    profile.glp1Type ?? 'semaglutide',
  );
  const phaseOverdue = dayNum > freq;

  // ── Date-scoped display values ──────────────────────────────────────────────
  const ZERO_ACTUALS: DailyActuals = { proteinG: 0, waterMl: 0, fiberG: 0, steps: 0, injectionLogged: false };

  const displayActuals: DailyActuals = isToday
    ? actuals
    : (historicalSnapshot?.actuals ?? ZERO_ACTUALS);

  const baseFocuses: FocusItem[] = isToday
    ? focuses
    : generateFocuses(displayActuals, targets, {}, dayNum);

  // ── Shot-day injection reminder ──────────────────────────────────────────────
  // Shown on any date that is a confirmed or projected injection day.
  const isShotDay =
    localDateStr(selectedDate) === profile.lastInjectionDate ||
    isProjectedShot(profile.lastInjectionDate, profile.injectionFrequencyDays ?? 7, selectedDate);

  const displayFocuses: FocusItem[] = (() => {
    if (!isShotDay) return baseFocuses;

    const brandName = BRAND_DISPLAY_NAMES[profile.medicationBrand] ?? profile.medicationBrand;
    const doseMg    = profile.doseMg;

    // Next suggested rotation site based on most recent injection log
    const lastSite  = logStore.injectionLogs[0]?.site ?? null;
    const lastIdx   = lastSite ? INJECTION_SITES.indexOf(lastSite) : -1;
    const nextSite  = INJECTION_SITES[(lastIdx + 1) % INJECTION_SITES.length];

    // Injection is logged for selected date when:
    // - today: actuals.injectionLogged
    // - past:  historicalSnapshot has an injection log
    // - future: never logged yet
    const injLogged = isToday
      ? displayActuals.injectionLogged
      : isPast
        ? historicalSnapshot?.injectionLog != null
        : false;

    const reminder: FocusItem = {
      id: 'injection',
      label: injLogged ? 'Injection logged' : 'Take your injection',
      subtitle: `${brandName} · ${doseMg}mg · ${nextSite}`,
      status: injLogged ? 'completed' : 'pending',
      iconName: 'colorize',
      iconSet: 'MaterialIcons',
    };

    // Replace any existing injection item and put reminder first
    return [reminder, ...baseFocuses.filter(f => f.id !== 'injection')];
  })();

  const isProjectedInjectionDay = isFuture
    ? isProjectedShot(profile.lastInjectionDate, profile.injectionFrequencyDays ?? 7, selectedDate)
    : displayActuals.injectionLogged;

  const focusSectionLabel = isToday
    ? "Daily Focuses"
    : isFuture
      ? `Planned for ${weekday}`
      : `${weekday}'s Focuses`;

  // ── Appetite forecast strip ────────────────────────────────────────────────
  // Use the actual logged injection date — not the profile/mock fallback
  const lastLoggedInjectionDate = logStore.injectionLogs[0]?.injection_date ?? null;
  const drugName = BRAND_DISPLAY_NAMES[profile.medicationBrand] ?? profile.glp1Type ?? 'your medication';
  const forecastDays = useMemo(
    () => lastLoggedInjectionDate
      ? generateForecastStrip(
          lastLoggedInjectionDate,
          profile.injectionFrequencyDays ?? 7,
          profile.glp1Type,
          profile.glp1Status,
        )
      : [],
    [lastLoggedInjectionDate, profile.injectionFrequencyDays, profile.glp1Type, profile.glp1Status],
  );

  // ── Today's individual log entries (from logStore) ──────────────────────────
  const todayStr = localDateStr();
  const todayFoodLogs = (logStore.foodLogs ?? []).filter(f =>
    localDateStr(new Date(f.logged_at)) === todayStr
  );
  const todayActivityLogs = (logStore.activityLogs ?? []).filter(a =>
    (a as any).date === todayStr
  );
  const todayWeightLog = (logStore.weightLogs ?? []).find(w =>
    localDateStr(new Date(w.logged_at)) === todayStr
  ) ?? null;
  const todayInjectionLog = (logStore.injectionLogs ?? []).find(i =>
    i.injection_date === todayStr
  ) ?? null;
  const todaySideEffects = (logStore.sideEffectLogs ?? []).filter(s =>
    localDateStr(new Date(s.logged_at)) === todayStr
  );

  const displaySnapshot = isToday
    ? {
        foodLogs:       todayFoodLogs.map(f => ({ id: f.id, food_name: f.food_name, calories: f.calories ?? 0, protein_g: f.protein_g ?? 0, carbs_g: (f as any).carbs_g ?? 0, fat_g: (f as any).fat_g ?? 0, fiber_g: (f as any).fiber_g ?? 0, meal_type: f.meal_type ?? 'snack', logged_at: f.logged_at })),
        activityLogs:   todayActivityLogs.map(a => ({ id: a.id, exercise_type: a.exercise_type ?? '', duration_min: a.duration_min ?? 0, steps: a.steps ?? 0, active_calories: a.active_calories ?? 0 })),
        weightLog:      todayWeightLog    ? { id: todayWeightLog.id,    weight_lbs: todayWeightLog.weight_lbs ?? 0, logged_at: todayWeightLog.logged_at } : null,
        injectionLog:   todayInjectionLog ? { id: todayInjectionLog.id, dose_mg: todayInjectionLog.dose_mg ?? 0, injection_date: todayInjectionLog.injection_date, medication_name: (todayInjectionLog as any).medication_name ?? null } : null,
        sideEffectLogs: todaySideEffects.map(s => ({ id: s.id, effect_type: s.effect_type, severity: s.severity ?? 0, logged_at: s.logged_at })),
      }
    : (historicalSnapshot ?? { foodLogs: [], activityLogs: [], weightLog: null, injectionLog: null, sideEffectLogs: [] });

  // Block all past dates until the user has at least one logged entry.
  // A fresh user has no reason to navigate back - there's nothing there.
  const hasAnyLogs = logStore.injectionLogs.length > 0 || logStore.foodLogs.length > 0;
  const calMinDate = hasAnyLogs
    ? (profile.startDate ? new Date(profile.startDate + 'T00:00:00') : today)
    : today;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* ── Fixed header ── */}
        <View
          style={s.headerArea}
          onLayout={(e: LayoutChangeEvent) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          <View style={s.headerTopRow}>
            <Pressable style={s.dateTitleRow} onPress={() => setCalendarOpen(v => !v)}>
              <Text style={s.dateTitle}>{dateLabel}</Text>
              <Ionicons
                name={calendarOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textPrimary}
                style={{ marginLeft: 6, marginTop: 2 }}
              />
            </Pressable>
          </View>
          <Text style={s.weekday}>{weekday}</Text>

          {/* ── Medication strip ── */}
          <View style={s.medStrip}>
            <View style={s.medPill}>
              <Text style={s.medPillText}>{medName}{medDose ? ` · ${medDose}` : ''}</Text>
            </View>
            <View style={[s.medPill, {
              backgroundColor: todayInjLogged
                ? 'rgba(39,174,96,0.15)'
                : daysUntil <= 0
                  ? 'rgba(255,116,42,0.15)'
                  : 'transparent',
            }]}>
              <Ionicons
                name={todayInjLogged ? 'checkmark-circle' : 'calendar-outline'}
                size={11}
                color={todayInjLogged ? '#27AE60' : daysUntil <= 0 ? ORANGE : colors.textMuted}
                style={{ marginRight: 4 }}
              />
              <Text style={[s.medPillText, todayInjLogged
                ? { color: '#27AE60', fontWeight: '700' }
                : daysUntil <= 0
                  ? { color: ORANGE, fontWeight: '700' }
                  : {},
              ]}>
                {nextShotLabel}
              </Text>
            </View>
          </View>

          {isFuture && <Text style={s.futureNote}>Projected plan - nothing logged yet</Text>}
          {isPast && isLoadingDate && <ActivityIndicator size="small" color={ORANGE} style={{ marginTop: 6 }} />}
          {isPast && !isLoadingDate && historicalSnapshot !== null &&
            historicalSnapshot.actuals.proteinG === 0 && historicalSnapshot.actuals.fiberG === 0 &&
            historicalSnapshot.actuals.steps === 0 && !historicalSnapshot.actuals.injectionLogged &&
            historicalSnapshot.actuals.waterMl === 0 && historicalSnapshot.foodLogs.length === 0 &&
            <Text style={s.futureNote}>No entries logged for this day</Text>
          }
        </View>

        {/* ── Calendar dropdown overlay ── */}
        {calendarOpen && (
          <CalendarDropdown
            selectedDate={selectedDate}
            onSelect={(d) => { setSelectedDate(d); setCalendarOpen(false); }}
            top={headerHeight}
            minDate={calMinDate}
            lastInjectionDate={profile.lastInjectionDate}
            injectionFrequencyDays={profile.injectionFrequencyDays}
            datesWithLogs={datesWithLogs}
            datesWithInjections={datesWithInjections}
          />
        )}

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          onScrollEndDrag={onScrollEnd}
          onMomentumScrollEnd={onScrollEnd}
          scrollEventThrottle={16}
        >

          {/* ── Daily Focuses ── */}
          <View style={s.focusCard}>
            <View style={s.focusCardInner}>
              {/* Header */}
              <View style={s.focusCardHeader}>
                <Text style={[s.sectionTitle, { marginBottom: 0 }]}>{focusSectionLabel}</Text>
                <View style={s.focusCountBadge}>
                  <Text style={s.focusCountText}>{(displayFocuses ?? []).length} Tasks</Text>
                </View>
              </View>

              {/* Timeline items - tap any to open AI chat with context */}
              {(displayFocuses ?? []).map((item, index) => {
                const isLast = index === (displayFocuses ?? []).length - 1;
                const handleFocusPress = () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  openAiChat({ type: 'focus', contextLabel: item.label, contextValue: item.subtitle, chips: JSON.stringify(['What should I eat now?', 'Give me a specific plan', 'How close am I to my goal?', 'What has the biggest impact?']) });
                };
                return (
                  <Pressable key={item.id} style={s.focusTimelineItem} onLongPress={handleFocusPress}>
                    {/* Left: indicator + connector */}
                    <View style={s.focusIndicatorCol}>
                      <StatusIndicator status={item.status} />
                      {!isLast && <TimelineLine status={item.status} />}
                    </View>
                    {/* Right: label + subtitle */}
                    <View style={[s.focusContent, !isLast && s.focusContentSpaced]}>
                      <Text style={[
                        s.focusLabel,
                        item.status === 'completed' && s.focusLabelDone,
                      ]}>
                        {item.label}
                      </Text>
                      <Text style={s.focusSubtitle}>{item.subtitle}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Appetite & Energy Forecast Strip ── */}
          <AppetiteForecastStrip
            forecastDays={forecastDays}
            appleHealthEnabled={appleHealthEnabled}
            drugName={drugName}
          />

          {/* ── AI Insights ── */}
          <Pressable
            style={[s.cardWrap, { marginBottom: 24 }]}
            onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openAiChat(aiInsights ? { contextLabel: 'Today\'s Insight', contextValue: aiInsights.slice(0, 80), seedMessage: aiInsights, chips: JSON.stringify(['Tell me more', 'What should I do?', 'How does this affect my goals?']) } : { contextLabel: 'Daily Insights', contextValue: 'Ask me anything about your health progress today', chips: JSON.stringify(['How am I doing today?', 'What should I focus on?', 'Any tips for my phase?']) }); }}
          >
            <View style={[s.cardBody, { backgroundColor: colors.surface }]}>
              <View style={{ padding: 20 }}>
                <View style={s.insightsHead}>
                  <Text style={s.insightsTitle}>Insights</Text>
                </View>
                {insightsLoading && !aiInsights ? (
                  <View style={{ gap: 10 }}>
                    {[0.95, 0.80, 0.65].map((w, i) => (
                      <View key={i} style={{ height: 14, borderRadius: 7, backgroundColor: colors.borderSubtle, width: `${w * 100}%` as any }} />
                    ))}
                  </View>
                ) : aiInsights ? (
                  <Text style={s.insightsParagraph}>{aiInsights}</Text>
                ) : (
                  <Text style={s.insightsParagraph}>
                    {staticInsights.map(b => b.text).join(' ')}
                  </Text>
                )}
              </View>
            </View>
          </Pressable>

          {/* ── Weekly Check-Ins Carousel ── */}
          {(() => {
            const wc = plan?.weeklyCheckins;
            const programDay = dayNum;

            // Food Noise: raw 0–20 lower=better → normalized inverted to 0–100
            const rawFoodNoise = wc?.foodNoise.score ?? null;
            const foodNoiseDisplay = rawFoodNoise != null
              ? Math.round((1 - rawFoodNoise / 20) * 100)
              : null;
            const foodNoiseLabel = rawFoodNoise != null
              ? (rawFoodNoise <= 4 ? 'Minimal' : rawFoodNoise <= 9 ? 'Mild' : rawFoodNoise <= 14 ? 'Moderate' : 'High')
              : '';

            const energyMoodScore = wc?.energyMood.score ?? null;
            const energyMoodLoggedAt = wc?.energyMood.loggedAt ?? null;
            const energyMoodRaw = (logStore.weeklyCheckins?.['energy_mood']?.[0] as any)?.answers
              ? Object.values((logStore.weeklyCheckins?.['energy_mood']?.[0] as any).answers as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
              : null;
            const energyMoodLabel = energyMoodScore != null
              ? (energyMoodScore >= 75 ? 'Strong' : energyMoodScore >= 50 ? 'Moderate' : energyMoodScore >= 25 ? 'Low' : 'Very Low')
              : '';

            const appetiteScore = wc?.appetite.score ?? null;
            const appetiteLoggedAt = wc?.appetite.loggedAt ?? null;
            const appetiteRaw = (logStore.weeklyCheckins?.['appetite']?.[0] as any)?.answers
              ? Object.values((logStore.weeklyCheckins?.['appetite']?.[0] as any).answers as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
              : null;
            const appetiteLabel = appetiteScore != null
              ? (appetiteScore >= 75 ? 'Well Controlled' : appetiteScore >= 50 ? 'Moderate' : appetiteScore >= 25 ? 'Mild Control' : 'Low Control')
              : '';

            const giBurdenScore = wc?.giBurden.score ?? null;
            const giBurdenLoggedAt = wc?.giBurden.loggedAt ?? null;
            const giBurdenLabel = giBurdenScore != null
              ? (giBurdenScore >= 75 ? 'Minimal' : giBurdenScore >= 50 ? 'Mild' : giBurdenScore >= 25 ? 'Moderate' : 'Severe')
              : '';

            const activityQualityScore = wc?.activityQuality.score ?? null;
            const activityQualityLoggedAt = wc?.activityQuality.loggedAt ?? null;
            const activityQualityLabel = activityQualityScore != null
              ? (activityQualityScore >= 75 ? 'High' : activityQualityScore >= 50 ? 'Moderate' : activityQualityScore >= 20 ? 'Low' : 'Very Low')
              : '';

            const sleepQualityScore = wc?.sleepQuality.score ?? null;
            const sleepQualityLoggedAt = wc?.sleepQuality.loggedAt ?? null;
            const sleepQualityLabel = sleepQualityScore != null
              ? (sleepQualityScore >= 75 ? 'Excellent' : sleepQualityScore >= 50 ? 'Good' : sleepQualityScore >= 25 ? 'Disrupted' : 'Poor')
              : '';

            const mentalHealthScore = wc?.mentalHealth.score ?? null;
            const mentalHealthLoggedAt = wc?.mentalHealth.loggedAt ?? null;
            const mentalHealthLabel = mentalHealthScore != null
              ? (mentalHealthScore >= 75 ? 'Stable' : mentalHealthScore >= 50 ? 'Mild' : mentalHealthScore >= 25 ? 'Moderate' : 'Significant')
              : '';

            const CHECKIN_CONFIG = [
              {
                type: 'food_noise' as const,
                label: 'Food Noise',
                subtitle: 'Weekly  ·  GLP-1 response',
                unlocksDay: 1,
                route: '/entry/food-noise-survey',
                lastScore: foodNoiseDisplay,
                lastLoggedAt: wc?.foodNoise.loggedAt ?? null,
                sparklineData: foodNoiseLogs.slice(0, 3).map(l => Math.round((1 - l.score / 20) * 100)).reverse(),
                summaryRoute: `/entry/checkin-summary?type=food_noise&score=${foodNoiseDisplay ?? 0}&rawScore=${rawFoodNoise ?? 0}&label=${encodeURIComponent(foodNoiseLabel)}`,
              },
              {
                type: 'gi_burden' as const,
                label: 'GI Symptoms',
                subtitle: 'Weekly  ·  Side effect burden',
                unlocksDay: 1,
                route: '/entry/gi-burden-survey',
                lastScore: giBurdenScore,
                lastLoggedAt: giBurdenLoggedAt,
                sparklineData: (logStore.weeklyCheckins?.['gi_burden'] ?? []).slice(0, 3).map(l => l.score).reverse(),
                summaryRoute: `/entry/checkin-summary?type=gi_burden&score=${giBurdenScore ?? 0}&rawScore=0&label=${encodeURIComponent(giBurdenLabel)}`,
              },
              {
                type: 'energy_mood' as const,
                label: 'Energy & Mood',
                subtitle: 'Weekly  ·  Wellbeing',
                unlocksDay: 8,
                route: '/entry/energy-mood-survey',
                lastScore: energyMoodScore,
                lastLoggedAt: energyMoodLoggedAt,
                sparklineData: (logStore.weeklyCheckins?.['energy_mood'] ?? []).slice(0, 3).map(l => l.score).reverse(),
                summaryRoute: `/entry/checkin-summary?type=energy_mood&score=${energyMoodScore ?? 0}&rawScore=${energyMoodRaw ?? 0}&label=${encodeURIComponent(energyMoodLabel)}`,
              },
              {
                type: 'activity_quality' as const,
                label: 'Activity',
                subtitle: 'Weekly  ·  Lean mass preservation',
                unlocksDay: 8,
                route: '/entry/activity-quality-survey',
                lastScore: activityQualityScore,
                lastLoggedAt: activityQualityLoggedAt,
                sparklineData: (logStore.weeklyCheckins?.['activity_quality'] ?? []).slice(0, 3).map(l => l.score).reverse(),
                summaryRoute: `/entry/checkin-summary?type=activity_quality&score=${activityQualityScore ?? 0}&rawScore=0&label=${encodeURIComponent(activityQualityLabel)}`,
              },
              {
                type: 'appetite' as const,
                label: 'Appetite & Satiety',
                subtitle: 'Weekly  ·  GLP-1 response',
                unlocksDay: 15,
                route: '/entry/appetite-survey',
                lastScore: appetiteScore,
                lastLoggedAt: appetiteLoggedAt,
                sparklineData: (logStore.weeklyCheckins?.['appetite'] ?? []).slice(0, 3).map(l => l.score).reverse(),
                summaryRoute: `/entry/checkin-summary?type=appetite&score=${appetiteScore ?? 0}&rawScore=${appetiteRaw ?? 0}&label=${encodeURIComponent(appetiteLabel)}`,
              },
              {
                type: 'sleep_quality' as const,
                label: 'Sleep Quality',
                subtitle: 'Weekly  ·  Recovery',
                unlocksDay: 15,
                route: '/entry/sleep-quality-survey',
                lastScore: sleepQualityScore,
                lastLoggedAt: sleepQualityLoggedAt,
                sparklineData: (logStore.weeklyCheckins?.['sleep_quality'] ?? []).slice(0, 3).map(l => l.score).reverse(),
                summaryRoute: `/entry/checkin-summary?type=sleep_quality&score=${sleepQualityScore ?? 0}&rawScore=0&label=${encodeURIComponent(sleepQualityLabel)}`,
              },
              {
                type: 'mental_health' as const,
                label: 'Mental Health',
                subtitle: 'Weekly  ·  PHQ-2 + GAD-2',
                unlocksDay: 22,
                route: '/entry/mental-health-survey',
                lastScore: mentalHealthScore,
                lastLoggedAt: mentalHealthLoggedAt,
                sparklineData: (logStore.weeklyCheckins?.['mental_health'] ?? []).slice(0, 3).map(l => l.score).reverse(),
                summaryRoute: `/entry/checkin-summary?type=mental_health&score=${mentalHealthScore ?? 0}&rawScore=0&label=${encodeURIComponent(mentalHealthLabel)}`,
              },
            ];

            // Show card if programDay meets unlock threshold (0 = no injection logged yet → show all)
            const unlockedCards = CHECKIN_CONFIG.filter(c => programDay === 0 || programDay >= c.unlocksDay);

            function daysSinceDate(dateStr: string): number {
              return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
            }

            const pendingCards = unlockedCards.filter(c =>
              c.lastLoggedAt == null || daysSinceDate(c.lastLoggedAt) > 6,
            );

            if (unlockedCards.length === 0) return null;

            return (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Text style={[s.sectionTitle, { marginBottom: 0 }]}>Weekly Check-Ins</Text>
                </View>
                {pendingCards.length === 0 ? (
                  <View style={{ padding: 16, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#27AE60' }}>All done this week</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                      Check back next week for your next check-ins.
                    </Text>
                  </View>
                ) : (
                <FlatList
                  data={pendingCards}
                  keyExtractor={item => item.type}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: 20 }}
                  renderItem={({ item }) => (
                    <WeeklyCheckinCard
                      label={item.label}
                      subtitle={item.subtitle}
                      lastScore={item.lastScore}
                      lastLoggedAt={item.lastLoggedAt}
                      route={item.route}
                      summaryRoute={item.summaryRoute}
                      sparklineData={item.sparklineData}
                    />
                  )}
                />
                )}
              </View>
            );
          })()}


          {/* ── Shot Day Banner (future projected injection days) ── */}
          {isFuture && isProjectedInjectionDay && (
            <View style={[s.phaseBanner, { marginBottom: 12 }]}>
              <View>
                <Text style={s.phaseDisplayName}>Shot Day</Text>
                <Text style={s.phaseFocus}>Projected injection day based on your schedule</Text>
              </View>
            </View>
          )}

          {/* ── Daily Log Summary ── */}
          <DailyLogSummaryCard
            foodLogs={displaySnapshot.foodLogs}
            activityLogs={displaySnapshot.activityLogs}
            weightLog={displaySnapshot.weightLog}
            injectionLog={displaySnapshot.injectionLog}
            sideEffectLogs={displaySnapshot.sideEffectLogs}
            waterOz={Math.round((isToday ? actuals.waterMl : (historicalSnapshot?.actuals.waterMl ?? 0)) / 29.5735)}
            isLoading={isPast && isLoadingDate}
            isFuture={isFuture}
            targets={targets}
            onRefresh={() => {
              if (isToday) {
                logStore.fetchInsightsData();
              } else {
                setIsLoadingDate(true);
                fetchDailySnapshot(localDateStr(selectedDate))
                  .then(setHistoricalSnapshot)
                  .catch(() => setHistoricalSnapshot(null))
                  .finally(() => setIsLoadingDate(false));
              }
            }}
          />

        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 },

  // Fixed header
  headerArea: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  dateTitleRow: { flexDirection: 'row', alignItems: 'center' },
  dateTitle: { fontSize: 26, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },
  weekday: { fontSize: 13, fontWeight: '500', color: c.textMuted, marginBottom: 8, fontFamily: 'Helvetica Neue' },
  medStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  medPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  medPillText: { fontSize: 12, fontWeight: '600', color: c.textMuted, fontFamily: 'Helvetica Neue' },
  phaseLabel: { fontSize: 13, fontWeight: '600', color: c.textSecondary, fontFamily: 'Helvetica Neue' },
  futureNote: { fontSize: 11, color: '#FF742A', marginTop: 4, fontWeight: '600', fontFamily: 'Helvetica Neue' },
  connectHealthKit: { fontSize: 12, color: 'rgba(255,116,42,0.7)', fontWeight: '500', marginTop: 4, textDecorationLine: 'underline', fontFamily: 'Helvetica Neue' },

  // Card containers
  cardWrap: { borderRadius: 28, ...glassShadow },
  cardBody: { borderRadius: 28, overflow: 'hidden', borderWidth: 0.5, borderColor: c.border },

  // Insights card
  insightsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  insightsTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  shotPhase: { fontSize: 10, fontWeight: '700', color: ORANGE, letterSpacing: 1.2, fontFamily: 'Helvetica Neue' },
  insightsParagraph: { fontSize: 15, color: w(0.75), fontWeight: '400', lineHeight: 23, fontFamily: 'Helvetica Neue' },

  // Section title
  sectionTitle: { fontSize: 22, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, marginBottom: 14, fontFamily: 'Helvetica Neue' },
  pendingBadge: {
    backgroundColor: 'rgba(255,116,42,0.15)',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
  },
  pendingBadgeText: {
    fontSize: 11, fontWeight: '700', color: '#FF742A', fontFamily: 'Helvetica Neue',
  },

  // Focus timeline card
  focusCard: { borderRadius: 28, ...glassShadow, marginBottom: 24, marginTop: 8 },
  focusCardInner: { borderRadius: 28, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 0.5, borderColor: c.border, padding: 22 },
  focusCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  focusCountBadge: { backgroundColor: c.borderSubtle, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  focusCountText: { fontSize: 10, fontWeight: '700', color: w(0.45), letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Helvetica Neue' },
  focusTimelineItem: { flexDirection: 'row', alignItems: 'flex-start' },
  focusIndicatorCol: { width: 24, alignItems: 'center', marginRight: 16 },
  focusContent: { flex: 1 },
  focusContentSpaced: { paddingBottom: 28 },
  focusLabel: { fontSize: 16, fontWeight: '700', color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  focusLabelMuted: { color: w(0.45) },
  focusLabelDone: { color: w(0.35), textDecorationLine: 'line-through' },
  focusSubtitle: { fontSize: 12, fontWeight: '400', color: w(0.45), marginTop: 3, lineHeight: 17, fontFamily: 'Helvetica Neue' },
  indicatorFilled: { width: 24, height: 24, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  indicatorEmpty: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: w(0.35), alignItems: 'center', justifyContent: 'center' },
  pulsingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  timelineLine: { position: 'absolute', top: 28, bottom: 0, left: 11, width: 2 },

  // Escalation Phase Banner
  phaseBanner: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,116,42,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,116,42,0.2)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  phaseDisplayName: {
    fontSize: 13, fontWeight: '700', color: '#FF742A', fontFamily: 'Helvetica Neue',
  },
  phaseWeek: {
    fontSize: 11, fontWeight: '600', color: w(0.4),
    backgroundColor: c.borderSubtle, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2, fontFamily: 'Helvetica Neue',
  },
  plasticityBadge: {
    backgroundColor: 'rgba(255,116,42,0.2)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  plasticityText: {
    fontSize: 9, fontWeight: '800', color: '#FF742A', letterSpacing: 0.8, fontFamily: 'Helvetica Neue',
  },
  phaseFocus: {
    fontSize: 12, color: w(0.55), lineHeight: 17, fontFamily: 'Helvetica Neue',
  },

  });
};

const createCalStyles = (c: AppColors) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 200,
    elevation: 200,
    borderRadius: 20,
    overflow: 'hidden',
  },
  inner:      { padding: 16 },
  monthRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  monthLabel: { fontSize: 15, fontWeight: '700', color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  weekRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dayHeader:  { width: 36, textAlign: 'center', fontSize: 10, fontWeight: '600', color: c.textMuted, fontFamily: 'Helvetica Neue' },
  cell:       { width: 36, height: 42, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 3 },
  dayCircle:  { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: '#FF742A' },
  dayNum:     { fontSize: 14, fontWeight: '600', color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  dayNumSel:  { fontWeight: '800' },
  dayFuture:  { opacity: 0.45 },
  todayDot:   { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#5AC8FA', marginTop: 2 },
  injDot:     { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FF742A', marginTop: 2 },
  logDot:     { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#34C759', marginTop: 2 },
  legend:      { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { fontSize: 11, color: c.textMuted, fontFamily: 'Helvetica Neue' },
});
