import { FontAwesome5, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, LayoutChangeEvent, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassBorder } from '@/components/ui/glass-border';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import { fetchDailySnapshot, useHealthData, type DailySnapshot } from '@/contexts/health-data';
import { localDateStr } from '@/lib/date-utils';
import { useHealthKitStore } from '@/stores/healthkit-store';
import {
  daysSinceInjection,
  generateFocuses,
  getScheduleMode,
  getIntradayPhase,
  hoursSinceDose,
  type DailyActuals,
  type DailyTargets,
  type FocusItem,
  type ShotPhase,
  type IntradayPhase,
} from '@/constants/scoring';
import { BRAND_DISPLAY_NAMES, isOnTreatment } from '@/constants/user-profile';
import { isOralDrug, doseNoun, doseIconName } from '@/constants/drug-pk';
import { useFocusEffect } from 'expo-router';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';
// generateDynamicInsights removed — replaced by static Treatment Progress card
import { WeeklyCheckinCard } from '@/components/weekly-checkin-card';
import { ClinicalAlertCard, getDismissedFlags } from '@/components/clinical-alert-card';
import { buildClinicalFlags } from '@/lib/clinical-alerts';
import { usePersonalizationStore } from '@/stores/personalization-store';
import type { PersonalizedPlan } from '@/lib/personalization';
import { useLogStore, computeStreak } from '@/stores/log-store';
import { useUiStore } from '@/stores/ui-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { usePreferencesStore } from '@/stores/preferences-store';
import { supabase } from '@/lib/supabase';
import { useBiometricStore } from '@/stores/biometric-store';
import { syncNotifications } from '@/stores/reminders-store';
// ── Appetite forecast imports — commented out (section removed from home screen)
// import { generateForecastStrip, generateIntradayForecast } from '@/lib/cycle-intelligence';
// import { AppetiteForecastStrip } from '@/components/appetite-forecast-strip';
// import { AppetiteForecastWave } from '@/components/appetite-forecast-wave';
// import { AppetiteForecastGauge } from '@/components/appetite-forecast-gauge';
import { MissedShotModal } from '@/components/missed-shot-modal';
import { useProfile } from '@/contexts/profile-context';

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

const PHASE_DISPLAY: Record<ShotPhase, string> = {
  shot:    'Shot Day',
  peak:    'Peak Effect',
  balance: 'Stable',
  reset:   'Fading',
};

const PHASE_COLORS: Record<ShotPhase, string> = {
  shot:    '#FF742A',
  peak:    '#27AE60',
  balance: '#3B9AE1',
  reset:   '#F5A623',
};

const PHASE_DESCRIPTIONS: Record<ShotPhase, string> = {
  shot:    'Shot day: highest appetite suppression. Prioritize hydration and injection site rotation.',
  peak:    'Peak phase: medication at max concentration. Nausea risk is highest. Eat small meals.',
  balance: 'Balance phase: stable medication level. Best window for activity and protein goals.',
  reset:   'Reset phase: medication tapering. Hunger may increase. Focus on habit consistency.',
};

// Intraday phase display (daily drugs)
const INTRADAY_PHASE_DISPLAY: Record<IntradayPhase, string> = {
  post_dose: 'Recently Dosed',
  peak:      'Peak Effect',
  trough:    'Approaching Trough',
};

const INTRADAY_PHASE_COLORS: Record<IntradayPhase, string> = {
  post_dose: '#D4850A',
  peak:      '#27AE60',
  trough:    '#F5A623',
};

const INTRADAY_PHASE_DESCRIPTIONS: Record<IntradayPhase, string> = {
  post_dose: 'Recently dosed. Medication absorbing. For oral drugs, avoid food/water for 30 min.',
  peak:      'Peak window. Highest appetite suppression. Best time for protein-rich meals.',
  trough:    'Approaching trough. Hunger may increase before your next dose. Prioritize protein.',
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

function buildPhaseLabel(
  phase: ShotPhase,
  daysSinceShot: number,
  medType: string,
  injFreqDays: number = 7,
  intradayPhase?: IntradayPhase | null,
  hoursSince?: number,
  oral: boolean = false,
): string {
  const Noun = oral ? 'Dose' : 'Injection';
  const noun = oral ? 'dose' : 'injection';
  const shotOrDose = oral ? 'dose' : 'shot';
  // Intraday mode for daily drugs
  if (intradayPhase != null && hoursSince != null) {
    const hoursUntilNext = Math.max(0, 24 - hoursSince);
    const nextDoseLabel = hoursUntilNext < 1
      ? 'Next dose due now'
      : `Next dose in ${Math.round(hoursUntilNext)}h`;
    if (intradayPhase === 'post_dose') return `Recently Dosed · ${nextDoseLabel}`;
    if (intradayPhase === 'peak')      return `Peak Window · ${nextDoseLabel}`;
    return `Trough Phase · ${nextDoseLabel}`;
  }
  // Cycle-day mode
  if (daysSinceShot <= 1) return `${oral ? 'Dose Day' : PHASE_DISPLAY.shot} · ${Noun} logged`;
  if (daysSinceShot <= Math.round(injFreqDays * 0.5)) return `Peak Phase · Day ${daysSinceShot} since last ${shotOrDose}`;
  if (daysSinceShot <= Math.round(injFreqDays * 0.85)) return `Balance Phase · Day ${daysSinceShot} since last ${shotOrDose}`;
  if (daysSinceShot < injFreqDays) return `Reset Phase · ${Noun} due in ${injFreqDays - daysSinceShot}d`;
  if (daysSinceShot >= injFreqDays) return `${Noun} Overdue - Consider logging your ${noun}`;
  return 'Balance Phase';
}

function buildDynamicFocusHint(plan: PersonalizedPlan | null, oral: boolean = false): string {
  if (!plan) return '';
  if (!plan.actuals.injectionLogged) return `Log your ${doseNoun(oral)} to complete today's cycle`;
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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
  // Parse as local midnight to avoid UTC-offset skew (consistent with daysSinceInjection)
  const lastMs = new Date(lastDate + 'T00:00:00').getTime();
  const targetMs = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diff = Math.round((targetMs - lastMs) / 86400000);
  // Only match the single next projected shot, not every future multiple
  return diff === freqDays;
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
  oral?: boolean;
};

function CalendarDropdown({ selectedDate, onSelect, top, minDate, lastInjectionDate, injectionFrequencyDays = 7, datesWithLogs, datesWithInjections, oral = false }: CalendarDropdownProps) {
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
            <Text style={cal.legendLabel}>{oral ? 'Dose day' : 'Shot day'}</Text>
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


// ─── Daily Log Summary Card ───────────────────────────────────────────────────

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch:     'Lunch',
  dinner:    'Dinner',
  snack:     'Snack',
};

type MealIconName = React.ComponentProps<typeof MaterialIcons>['name'];
const MEAL_ICON: Record<string, MealIconName> = {
  breakfast: 'free-breakfast',
  lunch:     'lunch-dining',
  dinner:    'dinner-dining',
  snack:     'local-cafe',
};

function MealIcon({ mealType, size = 16, color }: { mealType: string; size?: number; color: string }) {
  const name = MEAL_ICON[(mealType ?? 'snack').toLowerCase()] ?? 'restaurant';
  return <MaterialIcons name={name} size={size} color={color} />;
}

function activityIconNameDL(exerciseType: string | null | undefined): React.ComponentProps<typeof MaterialIcons>['name'] {
  const t = (exerciseType ?? '').toLowerCase();
  if (t.includes('run') || t.includes('jog'))      return 'directions-run';
  if (t.includes('walk'))                           return 'directions-walk';
  if (t.includes('cycl') || t.includes('bike'))    return 'directions-bike';
  if (t.includes('swim'))                           return 'pool';
  if (t.includes('yoga') || t.includes('stretch'))  return 'self-improvement';
  if (t.includes('strength') || t.includes('weight') || t.includes('lift')) return 'fitness-center';
  if (t.includes('hike'))                           return 'terrain';
  if (t.includes('dance'))                          return 'music-note';
  if (t.includes('sport') || t.includes('tennis') || t.includes('basketball') || t.includes('soccer')) return 'sports';
  return 'flash-on';
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
  oral?:          boolean;
};

function DailyLogSummaryCard({
  foodLogs, activityLogs, weightLog, injectionLog, sideEffectLogs, waterOz,
  isLoading, isFuture, targets, onRefresh, oral = false,
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
      let saveError: { message: string } | null = null;
      if (editTarget.kind === 'food') {
        const { error } = await supabase.from('food_logs').update({
          food_name: editForm.food_name,
          calories:  Number(editForm.calories)  || 0,
          protein_g: Number(editForm.protein_g) || 0,
          carbs_g:   Number(editForm.carbs_g)   || 0,
          fat_g:     Number(editForm.fat_g)     || 0,
          meal_type: editForm.meal_type as any,
        }).eq('id', editTarget.item.id);
        saveError = error;
      } else if (editTarget.kind === 'activity') {
        const { error } = await supabase.from('activity_logs').update({
          exercise_type:   editForm.exercise_type,
          duration_min:    Number(editForm.duration_min)    || 0,
          steps:           Number(editForm.steps)           || 0,
          active_calories: Number(editForm.active_calories) || 0,
        }).eq('id', editTarget.item.id);
        saveError = error;
      } else {
        const { error } = await supabase.from('weight_logs').update({
          weight_lbs: Number(editForm.weight_lbs) || 0,
        }).eq('id', editTarget.item.id);
        saveError = error;
      }
      if (saveError) {
        console.warn('inline edit save failed:', saveError);
        Alert.alert('Could not save', saveError.message);
        return;
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
          const { error } = await supabase.from(table as any).delete().eq('id', id);
          if (error) {
            console.warn('inline delete failed:', error);
            Alert.alert('Could not delete', error.message);
            return;
          }
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
  const summaryRows: { icon: React.ReactNode; label: string }[] = [];
  if (injectionLog) summaryRows.push({ icon: <FontAwesome5 name={doseIconName(oral)} size={12} color={w(0.45)} />, label: `${injectionLog.medication_name ?? (oral ? 'Dose' : 'Injection')} ${injectionLog.dose_mg}mg logged` });
  if (foodLogs.length > 0) summaryRows.push({ icon: <MaterialIcons name="restaurant" size={14} color={w(0.45)} />, label: `${foodLogs.length} meal${foodLogs.length > 1 ? 's' : ''} · ${totalCals} cal` });
  if (activityLogs.length > 0) summaryRows.push({ icon: <MaterialIcons name={activityIconNameDL(activityLogs[0]?.exercise_type)} size={14} color={w(0.45)} />, label: `${activityLogs.length} activit${activityLogs.length > 1 ? 'ies' : 'y'}` });
  if (weightLog) summaryRows.push({ icon: <MaterialCommunityIcons name="scale" size={14} color={w(0.45)} />, label: `${weightLog.weight_lbs} lbs` });
  if (waterOz > 0) summaryRows.push({ icon: <Ionicons name="water-outline" size={14} color={w(0.45)} />, label: `${waterOz} oz water` });
  if (sideEffectLogs.length > 0) summaryRows.push({ icon: <MaterialIcons name="sick" size={14} color={w(0.45)} />, label: `${sideEffectLogs.length} side effect${sideEffectLogs.length > 1 ? 's' : ''}` });

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
              <View style={{ gap: 7 }}>
                {summaryRows.map((row, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 16, alignItems: 'center' }}>{row.icon}</View>
                    <Text style={{ fontSize: 14, color: w(0.65), fontFamily: FF }}>{row.label}</Text>
                  </View>
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

            {/* ── Injection / Dose ── */}
            {injectionLog && (
              <View style={{ marginBottom: 16 }}>
                <Text style={dlSectionLabel(w)}>{oral ? 'Dose' : 'Injection'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w(0.07), gap: 10 }}>
                  <FontAwesome5 name={doseIconName(oral)} size={14} color={w(0.45)} />
                  <Text style={{ fontSize: 14, color: w(0.82), flex: 1, fontFamily: FF }}>
                    {injectionLog.medication_name ?? (oral ? 'Dose' : 'Injection')} · {injectionLog.dose_mg}mg
                  </Text>
                  <Pressable hitSlop={10} onPress={() => confirmDelete('injection_logs', injectionLog.id, `${injectionLog.medication_name ?? (oral ? 'Dose' : 'Injection')} ${injectionLog.dose_mg}mg`)}>
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
                      <MealIcon mealType={f.meal_type ?? 'snack'} size={14} color={w(0.45)} />
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
                    <MaterialIcons name={activityIconNameDL(a.exercise_type)} size={16} color={w(0.45)} />
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
                  <MaterialCommunityIcons name="scale" size={16} color={w(0.45)} />
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
                  <Ionicons name="water-outline" size={16} color="#5B8BF5" />
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
                    <View key={se.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(231,76,60,0.1)', borderRadius: 20, paddingLeft: 8, paddingRight: 6, paddingVertical: 5 }}>
                      <MaterialIcons name="sick" size={12} color="#E74C3C" />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#E74C3C', fontFamily: FF }}>
                        {se.effect_type.replace(/_/g, ' ')} · {se.severity}/10
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
  const { lastLogAction, actuals, targets, profile, focuses } = healthData;
  const oral = isOralDrug(profile?.glp1Type);
  const hkStore = useHealthKitStore();
  const { appleHealthEnabled } = usePreferencesStore();
  const { updateProfile, applyPendingTransition, profile: fullUserProfile } = useProfile();
  const onTreatment = isOnTreatment(fullUserProfile);

  const personalizationStore = usePersonalizationStore();
  const logStore = useLogStore();
  const plan = personalizationStore.plan;
  const { openAiChat } = useUiStore();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [dismissedFlags, setDismissedFlags] = useState<string[]>([]);
  const [historicalSnapshot, setHistoricalSnapshot] = useState<DailySnapshot | null>(null);
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const [datesWithLogs, setDatesWithLogs] = useState<Set<string>>(new Set());
  const [datesWithInjections, setDatesWithInjections] = useState<Set<string>>(new Set());
  const [missedShotVisible, setMissedShotVisible] = useState(false);
  const missedShotShownRef = useRef(false);

  const streak = useMemo(() => computeStreak(logStore), [
    logStore.weightLogs, logStore.injectionLogs, logStore.foodLogs,
    logStore.activityLogs, logStore.sideEffectLogs, logStore.foodNoiseLogs,
  ]);

  const biometricStore = useBiometricStore();

  useFocusEffect(useCallback(() => {
    hkStore.fetchAll().then(() => logStore.syncWeightFromHealthKit()).catch(() => {});
    personalizationStore.fetchAndRecompute();
    logStore.fetchInsightsData().then(() => syncNotifications());
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

  // ── Medication transition detection ──
  const hasPendingTransition = profile.pendingFirstDoseDate != null;
  const pendingFirstDoseStr = profile.pendingFirstDoseDate ?? '';
  const pendingLastDoseOldStr = profile.pendingLastDoseOld ?? '';
  const todayStr_transition = localDateStr(today);

  type TransitionPhase = 'none' | 'old_med' | 'washout' | 'new_med_ready';
  const transitionPhase: TransitionPhase = (() => {
    if (!hasPendingTransition) return 'none';
    if (todayStr_transition <= pendingLastDoseOldStr) return 'old_med';
    if (todayStr_transition < pendingFirstDoseStr) return 'washout';
    return 'new_med_ready';
  })();

  // Auto-apply transition when the date arrives
  const transitionAppliedRef = useRef(false);
  useEffect(() => {
    if (transitionPhase === 'new_med_ready' && !transitionAppliedRef.current) {
      transitionAppliedRef.current = true;
      applyPendingTransition();
    }
  }, [transitionPhase]);

  // Use whichever last-injection date is more recent: profile (updated by
  // settings edits) or the most recent injection log (updated by addInjectionLog).
  // This ensures both manual settings changes AND new injection logs are reflected.
  const profileLastInj = profile.lastInjectionDate || null;
  const logStoreLastInj = logStore.injectionLogs[0]?.injection_date || null;
  const effectiveLastInjectionDate = (() => {
    if (!profileLastInj) return logStoreLastInj;
    if (!logStoreLastInj) return profileLastInj;
    return profileLastInj >= logStoreLastInj ? profileLastInj : logStoreLastInj;
  })();

  const freq = profile.injectionFrequencyDays;
  const dayNum = daysSinceInjection(effectiveLastInjectionDate, selectedDate, freq ?? 7);

  // Medication strip - always relative to today
  const todayDayNum = daysSinceInjection(effectiveLastInjectionDate, today, freq ?? 7);
  const daysUntil = Math.max(0, (freq ?? 7) - (todayDayNum - 1));
  // Use actuals as source of truth for whether today's injection is already logged.
  // daysSinceInjection is capped at 7 so daysUntil can't go negative — we must
  // distinguish "due and not yet logged" from "due and already logged".
  // During washout, treat injection as "logged" so UI doesn't nag about missing dose
  const todayInjLogged = transitionPhase === 'washout' ? true : actuals.injectionLogged;
  const nextShotLabel = transitionPhase === 'washout'
    ? 'Transitioning'
    : !effectiveLastInjectionDate
      ? `Log first ${oral ? 'dose' : 'shot'}`
      : todayInjLogged
        ? 'Logged today'
        : daysUntil <= 0
          ? 'Due today'
          : daysUntil === 1
            ? 'Due tomorrow'
            : `In ${daysUntil} days`;
  const medName = (() => {
    const display = BRAND_DISPLAY_NAMES[profile.medicationBrand ?? ''];
    if (!display || display === 'Other') {
      const type = profile.glp1Type;
      if (type === 'semaglutide') return 'Semaglutide';
      if (type === 'tirzepatide') return 'Tirzepatide';
      if (type === 'liraglutide') return 'Liraglutide';
      if (type === 'oral_semaglutide') return 'Semaglutide (oral)';
      return 'GLP-1';
    }
    return display;
  })();
  const medDose = profile.doseMg != null ? `${profile.doseMg}mg` : null;

  // ── Multi-schedule mode ───────────────────────────────────────────────────
  const injFreqDays = profile.injectionFrequencyDays ?? 7;
  const scheduleMode = getScheduleMode(injFreqDays);
  const profileDoseTime = (profile as any).doseTime as string | undefined;
  const doseTime = profileDoseTime || '08:00';
  // lastLoggedInjectionDate is defined further down; use effectiveLastInjectionDate here
  const hSinceDose = scheduleMode === 'intraday' && effectiveLastInjectionDate != null
    ? hoursSinceDose(effectiveLastInjectionDate, doseTime)
    : null;
  const intradayPhase: IntradayPhase | null = scheduleMode === 'intraday' && hSinceDose != null
    ? getIntradayPhase(hSinceDose, profile.glp1Type ?? 'liraglutide')
    : null;

  const shotPhaseForLabel: ShotPhase =
    dayNum <= 2 ? 'shot' : dayNum <= 4 ? 'peak' : dayNum <= 6 ? 'balance' : 'reset';
  const phaseLabel = buildPhaseLabel(
    shotPhaseForLabel,
    dayNum - 1,
    profile.glp1Type ?? 'semaglutide',
    injFreqDays,
    intradayPhase,
    hSinceDose ?? undefined,
    oral,
  );
  const phaseOverdue = dayNum > freq;

  // ── Date-scoped display values ──────────────────────────────────────────────
  const ZERO_ACTUALS: DailyActuals = { proteinG: 0, waterMl: 0, fiberG: 0, steps: 0, injectionLogged: false };

  const displayActuals: DailyActuals = isToday
    ? actuals
    : (historicalSnapshot?.actuals ?? ZERO_ACTUALS);

  // Pass isInjectionDue: false — injection reminder is handled separately by
  // isShotDay below to avoid the dose showing up on every day.
  const rawFocuses: FocusItem[] = isToday
    ? focuses
    : generateFocuses(displayActuals, targets, {}, dayNum, undefined, false);
  // During washout, remove any injection-related focuses
  const baseFocuses: FocusItem[] = transitionPhase === 'washout'
    ? rawFocuses.filter(f => f.id !== 'injection')
    : rawFocuses;

  // ── Shot-day injection reminder ──────────────────────────────────────────────
  // Shown on any date that is a confirmed or projected injection day.
  // Suppressed during washout — no active dose cycle.
  const isShotDay = transitionPhase === 'washout' ? false : (
    localDateStr(selectedDate) === effectiveLastInjectionDate ||
    isProjectedShot(effectiveLastInjectionDate, profile.injectionFrequencyDays ?? 7, selectedDate)
  );

  const displayFocuses: FocusItem[] = (() => {
    if (!isShotDay) return baseFocuses;

    const brandName = BRAND_DISPLAY_NAMES[profile.medicationBrand] ?? profile.medicationBrand;
    const doseMg    = profile.doseMg;

    // Next suggested rotation site based on most recent injection log (skip for oral drugs)
    let nextSite: string | null = null;
    if (!oral) {
      const lastSite  = logStore.injectionLogs[0]?.site ?? null;
      const lastIdx   = lastSite ? INJECTION_SITES.indexOf(lastSite) : -1;
      nextSite  = INJECTION_SITES[(lastIdx + 1) % INJECTION_SITES.length];
    }

    // Injection is logged for selected date when:
    // - today: actuals.injectionLogged
    // - past:  historicalSnapshot has an injection log
    // - future: never logged yet
    const injLogged = isToday
      ? displayActuals.injectionLogged
      : isPast
        ? historicalSnapshot?.injectionLog != null
        : false;

    const subtitleParts = [`${brandName}`, `${doseMg}mg`];
    if (nextSite) subtitleParts.push(nextSite);

    const reminder: FocusItem = {
      id: 'injection',
      label: injLogged ? `${oral ? 'Dose' : 'Injection'} logged` : (oral ? 'Take your pill' : 'Take your injection'),
      subtitle: subtitleParts.join(' · '),
      status: injLogged ? 'completed' : 'pending',
      iconName: oral ? 'medication' : 'colorize',
      iconSet: 'MaterialIcons',
    };

    // Merge injection item with other focuses, sorted: incomplete first, completed last
    const merged = [reminder, ...baseFocuses.filter(f => f.id !== 'injection')];
    merged.sort((a, b) => {
      const aComplete = a.status === 'completed' ? 1 : 0;
      const bComplete = b.status === 'completed' ? 1 : 0;
      return aComplete - bComplete;
    });
    return merged;
  })();

  const isProjectedInjectionDay = isFuture
    ? isProjectedShot(effectiveLastInjectionDate, profile.injectionFrequencyDays ?? 7, selectedDate)
    : displayActuals.injectionLogged;

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const focusSectionLabel = isToday
    ? "Daily Focuses"
    : isFuture
      ? `Planned for ${weekday}`
      : `Focuses from ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}`;

  const handlePhasePillPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openAiChat({
      type: 'metric',
      contextLabel: PHASE_DISPLAY[shotPhaseForLabel],
      contextValue: PHASE_DESCRIPTIONS[shotPhaseForLabel],
      chips: JSON.stringify(['What should I focus on today?', 'How does this phase affect appetite?', 'What are the side effects right now?', 'When is my next shot?']),
    });
  };

  const handleBackgroundLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openAiChat({
      chips: JSON.stringify([
        'How am I doing overall?',
        'What should I focus on today?',
        'Any tips for my current phase?',
        'Summarize my week',
      ]),
    });
  }, [openAiChat]);

  // ── Appetite forecast — COMMENTED OUT (not providing enough value on home screen) ──
  // const [mockupVariant, setMockupVariant] = React.useState<'current' | 'wave' | 'gauge'>('wave');
  // const lastLoggedInjectionDate = logStore.injectionLogs[0]?.injection_date ?? null;
  // const drugName = BRAND_DISPLAY_NAMES[profile.medicationBrand] ?? profile.glp1Type ?? 'your medication';
  // const forecastDays = useMemo(
  //   () => scheduleMode === 'cycle-day' && lastLoggedInjectionDate
  //     ? generateForecastStrip(lastLoggedInjectionDate, injFreqDays, profile.glp1Type, profile.glp1Status, profile.doseMg ?? null)
  //     : [],
  //   [scheduleMode, lastLoggedInjectionDate, injFreqDays, profile.glp1Type, profile.glp1Status, profile.doseMg],
  // );
  // const intradayHourBlocks = useMemo(
  //   () => scheduleMode === 'intraday'
  //     ? generateIntradayForecast(profile.glp1Type, profile.glp1Status, doseTime, profile.doseMg ?? null)
  //     : [],
  //   [scheduleMode, profile.glp1Type, profile.glp1Status, doseTime, profile.doseMg],
  // );

  // ── Treatment Progress computations ─────────────────────────────────────────
  const referenceTime = isPast ? selectedDate.getTime() : Date.now();
  const daysOnTreatment = profile.startDate
    ? Math.floor((referenceTime - new Date(profile.startDate + 'T00:00:00').getTime()) / 86400000)
    : null;
  const treatmentDisplayVal = daysOnTreatment != null
    ? daysOnTreatment >= 14 ? `${Math.floor(daysOnTreatment / 7)}` : `${daysOnTreatment}`
    : null;
  const treatmentDisplayLbl = daysOnTreatment != null && daysOnTreatment >= 14
    ? 'weeks on\ntreatment'
    : 'days on\ntreatment';
  const weightLogsArr = logStore.weightLogs ?? [];
  const selectedDateEndStr = localDateStr(selectedDate);
  const latestWeight = isPast
    ? (weightLogsArr.find(w => localDateStr(new Date(w.logged_at)) <= selectedDateEndStr)?.weight_lbs ?? null)
    : (weightLogsArr[0]?.weight_lbs ?? hkStore.latestWeight ?? null);
  const firstWeight = weightLogsArr.length > 0
    ? weightLogsArr[weightLogsArr.length - 1].weight_lbs
    : null;
  const weightDelta = (firstWeight != null && latestWeight != null)
    ? latestWeight - firstWeight
    : null;
  // Stat 3: % to goal (or lbs to go if no goal set)
  const goalWeight = (profile as any).goalWeightLbs > 0 ? (profile as any).goalWeightLbs : null;
  const startWeightForGoal = (profile as any).startWeightLbs > 0
    ? (profile as any).startWeightLbs
    : firstWeight;
  const pctToGoal = (startWeightForGoal != null && goalWeight != null && latestWeight != null && startWeightForGoal !== goalWeight)
    ? Math.max(0, Math.min(100, Math.round(((startWeightForGoal - latestWeight) / (startWeightForGoal - goalWeight)) * 100)))
    : null;
  const lbsToGo = (latestWeight != null && goalWeight != null)
    ? Math.max(0, latestWeight - goalWeight)
    : (latestWeight != null && startWeightForGoal != null)
      ? Math.max(0, startWeightForGoal - latestWeight)
      : null;
  const stat3Val = pctToGoal != null ? `${pctToGoal}%` : lbsToGo != null ? lbsToGo.toFixed(1) : '—';
  const stat3Lbl = pctToGoal != null ? 'to\ngoal' : goalWeight != null ? 'lbs\nto go' : 'lbs\nlost';

  // Raw (uncapped) days until next shot — needed to detect overdue
  const rawDaysUntil = effectiveLastInjectionDate
    ? (freq ?? 7) - Math.floor(
        (today.getTime() - new Date(effectiveLastInjectionDate + 'T00:00:00').getTime()) / 86400000
      )
    : null;

  // Missed shot modal — computed props
  const expectedShotDate = useMemo(() => {
    if (!effectiveLastInjectionDate) return '';
    const d = new Date(effectiveLastInjectionDate + 'T00:00:00');
    d.setDate(d.getDate() + (freq ?? 7));
    return localDateStr(d);
  }, [effectiveLastInjectionDate, freq]);

  const overdueDays = (rawDaysUntil != null && rawDaysUntil < 0) ? Math.abs(rawDaysUntil) : 0;

  const lastDoseMg = logStore.injectionLogs[0]?.dose_mg ?? (profile as any).doseMg ?? 0.5;

  // Trigger missed shot modal once per session when overdue
  // Wait for logStore.hydrated so injection logs are loaded before checking
  const logStoreHydrated = useLogStore((s) => s.hydrated);
  useEffect(() => {
    if (!logStoreHydrated) return;
    if (missedShotShownRef.current) return;
    if (transitionPhase !== 'none') return; // Don't show during medication transition
    if (rawDaysUntil == null) return;
    if (!effectiveLastInjectionDate) return;
    if (rawDaysUntil >= 0) return;
    if (todayInjLogged) return;
    missedShotShownRef.current = true;
    setMissedShotVisible(true);
  }, [logStoreHydrated, rawDaysUntil, todayInjLogged, effectiveLastInjectionDate]);

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
    <TabScreenWrapper>
    <Pressable style={{ flex: 1, backgroundColor: colors.bg }} onLongPress={handleBackgroundLongPress} delayLongPress={600}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* ── Fixed header ── */}
        <View
          style={s.headerArea}
          onLayout={(e: LayoutChangeEvent) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          <View style={s.headerTopRow}>
            {/* Left: greeting */}
            <View style={{ flex: 1 }}>
              <Text style={s.greetingLabel}>Welcome,</Text>
              <Text style={s.greetingName}>
                {logStore.profile?.username?.split(' ')[0] ?? fullUserProfile?.username?.split(' ')[0] ?? 'there'}!
              </Text>
            </View>
            {/* Right: date + weekday */}
            <Pressable style={s.dateTitleRow} onPress={() => setCalendarOpen(v => !v)}>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={s.dateTitle}>{dateLabel}</Text>
                  <Ionicons
                    name={calendarOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textPrimary}
                    style={{ marginLeft: 5, marginTop: 2 }}
                  />
                </View>
                <Text style={s.weekday}>{weekday}</Text>
              </View>
            </Pressable>
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
          <>
            {/* Full-screen backdrop — tapping it closes the calendar */}
            <Pressable
              style={[StyleSheet.absoluteFillObject, { zIndex: 199 }]}
              onPress={() => setCalendarOpen(false)}
            />
            <CalendarDropdown
              selectedDate={selectedDate}
              onSelect={(d) => { setSelectedDate(d); setCalendarOpen(false); }}
              top={headerHeight}
              minDate={calMinDate}
              lastInjectionDate={effectiveLastInjectionDate}
              injectionFrequencyDays={profile.injectionFrequencyDays}
              datesWithLogs={datesWithLogs}
              datesWithInjections={datesWithInjections}
              oral={oral}
            />
          </>
        )}

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          onScrollEndDrag={onScrollEnd}
          onMomentumScrollEnd={onScrollEnd}
          scrollEventThrottle={16}
        >
          <Pressable onLongPress={handleBackgroundLongPress} delayLongPress={600}>

          {/* ── Viewing History Banner ── */}
          {isPast && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(255,116,42,0.15)',
              borderWidth: 1,
              borderColor: 'rgba(255,116,42,0.4)',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 9,
              marginBottom: 14,
            }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: ORANGE, fontFamily: FF }}>
                {`Viewing ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`}
              </Text>
              <Pressable onPress={() => { setSelectedDate(new Date()); setCalendarOpen(false); }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: ORANGE, fontFamily: FF }}>
                  Back to today
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── First-Use Checklist ── */}
          {(() => {
            const checklistItems = onTreatment
              ? [
                  { label: `Log your first ${doseNoun(oral)}`, done: logStore.injectionLogs.length > 0 },
                  { label: 'Log your starting weight', done: logStore.weightLogs.length > 0 },
                ]
              : [
                  { label: 'Log your current weight', done: logStore.weightLogs.length > 0 },
                ];
            const allDone = checklistItems.every((i) => i.done);
            if (allDone) return null;
            return (
            <View style={[s.cardWrap, { marginBottom: 20 }]}>
              <View style={[s.cardBody, { backgroundColor: colors.surface, padding: 20 }]}>
                <Text style={{ color: ORANGE, fontSize: 11, fontWeight: '700', letterSpacing: 2, fontFamily: FF, marginBottom: 8 }}>
                  GET STARTED
                </Text>
                <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800', fontFamily: FF, marginBottom: 4 }}>
                  {onTreatment ? 'Set up your journey' : 'Start tracking'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: FF, marginBottom: 16 }}>
                  {onTreatment
                    ? 'Complete these steps to unlock your personalized phase tracking.'
                    : 'Log your first entry to get personalized insights.'}
                </Text>
                {checklistItems.map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: item.done ? ORANGE : 'transparent',
                      borderWidth: 2, borderColor: item.done ? ORANGE : 'rgba(255,255,255,0.3)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {item.done && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                    <Text style={{ color: item.done ? colors.textSecondary : colors.textPrimary, fontSize: 14, fontFamily: FF, textDecorationLine: item.done ? 'line-through' : 'none' }}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            );
          })()}

          {/* ── Treatment Hero Card (medication users only) ── */}
          {onTreatment ? (
          <Pressable
            style={[s.cardWrap, { marginBottom: 20 }]}
            onLongPress={handlePhasePillPress}
            delayLongPress={500}
          >
            <View style={[s.cardBody, { backgroundColor: colors.surface }]}>
              <View style={s.heroCard}>

                {/* Streak + medication row */}
                <View style={s.heroTopRow}>
                  {streak > 0 ? (
                    <View style={[s.heroPhaseBadge, { backgroundColor: ORANGE + '22' }]}>
                      <Ionicons name="flame" size={13} color={ORANGE} />
                      <Text style={[s.heroPhaseText, { color: ORANGE }]}>
                        {streak} DAY{streak !== 1 ? 'S' : ''}
                      </Text>
                    </View>
                  ) : (
                    <View style={[s.heroPhaseBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                      <Ionicons name="flame-outline" size={13} color={colors.textSecondary} />
                      <Text style={[s.heroPhaseText, { color: colors.textSecondary }]}>
                        NO STREAK
                      </Text>
                    </View>
                  )}
                  <Text style={s.heroMedLabel}>
                    {medName}{medDose ? ` · ${medDose}` : ''}
                  </Text>
                </View>

                {/* Stats row */}
                <View style={s.heroStats}>
                  <View style={s.heroStat}>
                    <Text style={s.heroStatVal}>
                      {treatmentDisplayVal ?? '—'}
                    </Text>
                    <Text style={s.heroStatLbl}>{treatmentDisplayLbl}</Text>
                  </View>
                  <View style={s.heroStatDiv} />
                  <View style={s.heroStat}>
                    <Text style={[s.heroStatVal, weightDelta != null && { color: weightDelta <= 0 ? '#27AE60' : '#E53E3E' }]}>
                      {weightDelta != null ? `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)}` : '—'}
                    </Text>
                    <Text style={s.heroStatLbl}>
                      {isPast
                        ? `lbs since\nstart (${MONTHS[selectedDate.getMonth()].slice(0, 3)} ${selectedDate.getDate()})`
                        : 'lbs since\nstart'}
                    </Text>
                  </View>
                  <View style={s.heroStatDiv} />
                  <View style={s.heroStat}>
                    <Text style={s.heroStatVal}>{stat3Val}</Text>
                    <Text style={s.heroStatLbl}>{stat3Lbl}</Text>
                  </View>
                </View>

                {/* Transition banner during washout */}
                {onTreatment && (transitionPhase === 'washout' || transitionPhase === 'old_med') && profile.pendingFirstDoseDate && (
                  (() => {
                    const startDate = new Date(profile.pendingFirstDoseDate + 'T00:00:00');
                    const daysAway = Math.max(0, Math.ceil((startDate.getTime() - today.getTime()) / 86400000));
                    const dateLabel2 = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const newBrandLabel = BRAND_DISPLAY_NAMES[profile.pendingMedicationBrand as keyof typeof BRAND_DISPLAY_NAMES] ?? profile.pendingMedicationBrand ?? '';
                    return (
                      <View style={s.transitionBanner}>
                        <View style={s.transitionRow}>
                          <Ionicons name="swap-horizontal" size={16} color={ORANGE} />
                          <Text style={s.transitionTitle}>Switching Medication</Text>
                        </View>
                        <Text style={s.transitionBody}>
                          Starting {newBrandLabel} {profile.pendingDoseMg}mg on {dateLabel2}
                          {daysAway > 0 ? ` (${daysAway} day${daysAway !== 1 ? 's' : ''})` : ' (today)'}
                        </Text>
                        {transitionPhase === 'washout' && (
                          <Text style={s.transitionHint}>Washout period — no active dose cycle</Text>
                        )}
                      </View>
                    );
                  })()
                )}

                {/* Cycle day progress bar — hidden during washout and off-treatment */}
                {onTreatment && transitionPhase !== 'washout' && effectiveLastInjectionDate && todayDayNum != null && (freq ?? 7) > 1 && (
                  (() => {
                    // Shot-day override: show start of new cycle instead of end of old one
                    const displayDayNum = (!todayInjLogged && rawDaysUntil === 0) ? 1 : todayDayNum;
                    return (
                  <View style={s.heroCycleRow}>
                    <View style={s.heroCycleLabels}>
                      <Text style={s.heroCycleLbl}>Day {displayDayNum} of {freq ?? 7}</Text>
                      <Text style={[
                        s.heroCycleLbl,
                        !todayInjLogged && rawDaysUntil != null && rawDaysUntil < 0 && { color: '#E74C3C' },
                        !todayInjLogged && rawDaysUntil != null && rawDaysUntil === 0 && { color: ORANGE },
                      ]}>
                        {todayInjLogged
                          ? `${oral ? 'Dosed' : 'Injected'} today ✓`
                          : rawDaysUntil == null
                            ? `In ${daysUntil} days`
                            : rawDaysUntil < 0
                              ? 'Past due'
                              : rawDaysUntil === 0
                                ? (oral ? 'Dose day' : 'Shot day')
                                : rawDaysUntil === 1
                                  ? (oral ? 'Dose tomorrow' : 'Shot tomorrow')
                                  : `In ${rawDaysUntil} days`}
                      </Text>
                    </View>
                    <View style={s.heroCycleBar}>
                      <View style={[
                        s.heroCycleFill,
                        {
                          width: `${Math.min((displayDayNum / (freq ?? 7)) * 100, 100)}%` as any,
                          backgroundColor: intradayPhase
                            ? INTRADAY_PHASE_COLORS[intradayPhase]
                            : PHASE_COLORS[shotPhaseForLabel],
                        },
                      ]} />
                    </View>
                  </View>
                    );
                  })()
                )}

              </View>
            </View>
          </Pressable>
          ) : (
          /* ── Wellness Card (non-medication users) ── */
          <View style={[s.cardWrap, { marginBottom: 20 }]}>
            <View style={[s.cardBody, { backgroundColor: colors.surface }]}>
              <View style={s.heroCard}>
                <View style={s.heroStats}>
                  <View style={s.heroStat}>
                    <Text style={s.heroStatVal}>
                      {profile.currentWeightLbs ?? profile.weightLbs ?? '—'}
                    </Text>
                    <Text style={s.heroStatLbl}>{'current\nweight'}</Text>
                  </View>
                  <View style={s.heroStatDiv} />
                  <View style={s.heroStat}>
                    <Text style={s.heroStatVal}>{profile.goalWeightLbs ?? '—'}</Text>
                    <Text style={s.heroStatLbl}>{'goal\nweight'}</Text>
                  </View>
                  <View style={s.heroStatDiv} />
                  <View style={s.heroStat}>
                    <Text style={s.heroStatVal}>
                      {profile.currentWeightLbs && profile.goalWeightLbs
                        ? `${Math.max(0, Math.round(((profile.currentWeightLbs ?? profile.weightLbs) - profile.goalWeightLbs) * 10) / 10)}`
                        : '—'}
                    </Text>
                    <Text style={s.heroStatLbl}>{'lbs\nto go'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
          )}

          {/* ── Daily Focuses ── */}
          <View style={s.focusCard}>
            <View style={s.focusCardInner}>
              {/* Header */}
              <View style={s.focusCardHeader}>
                <Text style={[s.sectionTitle, { marginBottom: 0 }]}>{focusSectionLabel}</Text>
                <View style={s.focusCountBadge}>
                  <Text style={s.focusCountText}>
                    {(() => {
                      const items = displayFocuses ?? [];
                      const done = items.filter(f => f.status === 'completed').length;
                      return `${done}/${items.length} done`;
                    })()}
                  </Text>
                </View>
              </View>

              {/* Coaching cards - long-press any to open AI chat */}
              {(displayFocuses ?? []).map((item, index) => {
                const isLast = index === (displayFocuses ?? []).length - 1;
                const handleFocusPress = () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  openAiChat({ type: 'focus', contextLabel: item.label, contextValue: item.subtitle, seedMessage: `I'm working on: ${item.label}. ${item.subtitle}. What's the most important thing I should know?`, chips: JSON.stringify(['What should I eat now?', 'Give me a specific plan', 'How close am I to my goal?', 'What has the biggest impact?']) });
                };
                return (
                  <React.Fragment key={item.id}>
                    <Pressable style={s.focusRow} onLongPress={handleFocusPress} delayLongPress={400}>
                      {/* Icon */}
                      <View style={[s.focusIconWrap, item.status === 'completed' && s.focusIconDone]}>
                        {item.iconSet === 'MaterialIcons'
                          ? <MaterialIcons name={item.iconName as any} size={18} color={item.status === 'completed' ? 'rgba(255,116,42,0.4)' : ORANGE} />
                          : <Ionicons name={item.iconName as any} size={18} color={item.status === 'completed' ? 'rgba(255,116,42,0.4)' : ORANGE} />
                        }
                      </View>
                      {/* Text + progress bar */}
                      <View style={s.focusBody}>
                        <View style={s.focusLabelRow}>
                          <Text style={[s.focusLabel, item.status === 'completed' && s.focusLabelDone]}>
                            {item.label}
                          </Text>
                          {item.status === 'completed' && (
                            <Ionicons name="checkmark-circle" size={16} color={ORANGE} />
                          )}
                        </View>
                        <Text style={s.focusSubtitle}>{item.subtitle}</Text>

                        {/* Progress bar — only for non-binary items */}
                        {item.progressPct != null && (
                          <View style={s.focusBarTrack}>
                            <View style={[
                              s.focusBarFill,
                              { width: `${item.progressPct}%` as any },
                              item.status === 'completed' && s.focusBarDone,
                            ]} />
                          </View>
                        )}

                        {/* Value label */}
                        {item.valueLabel != null && (
                          <Text style={s.focusValueLabel}>{item.valueLabel}</Text>
                        )}

                        {/* Binary injection pill */}
                        {item.id === 'injection' && item.progressPct == null && (
                          <View style={[s.injectionPill, item.status === 'completed' && s.injectionPillDone]}>
                            <Text style={[s.injectionPillText, item.status === 'completed' && { color: '#4CAF50' }]}>
                              {item.status === 'completed' ? 'Logged' : 'Tap to log'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                    {!isLast && <View style={s.focusDivider} />}
                  </React.Fragment>
                );
              })}

            </View>
          </View>

          {/* ── Appetite Forecast — COMMENTED OUT (not providing enough value) ──
          {isToday && (
            <AppetiteForecastStrip
              forecastDays={forecastDays}
              appleHealthEnabled={appleHealthEnabled}
              drugName={drugName}
              hourBlocks={intradayHourBlocks}
              injFreqDays={injFreqDays}
            />
          )}
          ── */}

          {/* ── Weekly Check-In (today only) ── */}
          {isToday && (() => {
            // Read directly from logStore so deletion updates the card synchronously,
            // without waiting for the async personalization plan recompute.
            const allLoggedAts = Object.values(logStore.weeklyCheckins)
              .flat()
              .map(r => r.logged_at as string)
              .filter(Boolean);

            const lastLoggedAt = allLoggedAts.length > 0
              ? allLoggedAts.reduce((a, b) => (a > b ? a : b))
              : null;

            return (
              <View style={{ marginBottom: 16 }}>
                <Text style={[s.sectionTitle, { marginBottom: 12 }]}>Weekly Check-In</Text>
                <WeeklyCheckinCard lastLoggedAt={lastLoggedAt} isDaily={scheduleMode === 'intraday'} />
              </View>
            );
          })()}




          {/* ── Shot / Dose Day Banner (future projected days) ── */}
          {isFuture && isProjectedInjectionDay && (
            <View style={[s.phaseBanner, { marginBottom: 12 }]}>
              <View>
                <Text style={s.phaseDisplayName}>{oral ? 'Dose Day' : 'Shot Day'}</Text>
                <Text style={s.phaseFocus}>{oral ? 'Projected dose day based on your schedule' : 'Projected injection day based on your schedule'}</Text>
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
            oral={oral}
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

          </Pressable>
        </ScrollView>

        <MissedShotModal
          visible={onTreatment && missedShotVisible}
          onClose={() => setMissedShotVisible(false)}
          expectedShotDate={expectedShotDate}
          overdueDays={overdueDays}
          lastDoseMg={lastDoseMg}
          addInjectionLog={async (dose_mg, injection_date) => {
            await logStore.addInjectionLog(dose_mg, injection_date);
            // If the logged date is today, immediately update daily focuses
            if (injection_date === localDateStr()) {
              healthData.dispatch({ type: 'LOG_INJECTION' });
            }
            await updateProfile({ lastInjectionDate: injection_date });
          }}
          isOral={oral}
        />

      </SafeAreaView>
    </Pressable>
    </TabScreenWrapper>
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
  dateTitleRow: { alignItems: 'flex-end' },
  dateTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary, letterSpacing: -0.2, fontFamily: 'Helvetica Neue', textAlign: 'right' },
  weekday: { fontSize: 12, fontWeight: '500', color: c.textMuted, marginTop: 2, fontFamily: 'Helvetica Neue', textAlign: 'right' },
  greetingLabel: { fontSize: 13, fontWeight: '500', color: c.textMuted, fontFamily: 'Helvetica Neue', marginBottom: 2 },
  greetingName: { fontSize: 26, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },
  medStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
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

  // Insights card (kept for DailyLogSummaryCard insightsTitle usage)
  insightsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  insightsTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  shotPhase: { fontSize: 10, fontWeight: '700', color: ORANGE, letterSpacing: 1.2, fontFamily: 'Helvetica Neue' },
  insightsParagraph: { fontSize: 15, color: w(0.75), fontWeight: '400', lineHeight: 23, fontFamily: 'Helvetica Neue' },

  // Treatment Hero card
  heroCard: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroPhaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroPhaseIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroPhaseText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: 'Helvetica Neue',
  },
  heroMedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textSecondary,
    fontFamily: 'Helvetica Neue',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  heroStatDiv: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
  },
  heroStatVal: {
    fontSize: 26,
    fontWeight: '800',
    color: c.textPrimary,
    fontFamily: 'Helvetica Neue',
    letterSpacing: -0.5,
  },
  heroStatLbl: {
    fontSize: 11,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
    fontFamily: 'Helvetica Neue',
  },
  heroCycleRow: {
    gap: 8,
  },
  heroCycleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroCycleLbl: {
    fontSize: 11,
    color: c.textSecondary,
    fontFamily: 'Helvetica Neue',
  },
  heroCycleBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
  },
  heroCycleFill: {
    height: 4,
    borderRadius: 2,
  },
  transitionBanner: {
    backgroundColor: c.isDark ? 'rgba(255,116,42,0.08)' : 'rgba(255,116,42,0.06)',
    borderWidth: 1,
    borderColor: c.isDark ? 'rgba(255,116,42,0.2)' : 'rgba(255,116,42,0.15)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  transitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  transitionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF742A',
    fontFamily: 'Helvetica Neue',
  },
  transitionBody: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textPrimary,
    fontFamily: 'Helvetica Neue',
  },
  transitionHint: {
    fontSize: 11,
    color: c.textSecondary,
    marginTop: 4,
    fontFamily: 'Helvetica Neue',
  },

  // Section title
  sectionTitle: { fontSize: 22, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, marginBottom: 14, fontFamily: 'Helvetica Neue' },
  pendingBadge: {
    backgroundColor: 'rgba(255,116,42,0.15)',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
  },
  pendingBadgeText: {
    fontSize: 11, fontWeight: '700', color: '#FF742A', fontFamily: 'Helvetica Neue',
  },

  // Focus coaching cards
  focusCard: { borderRadius: 28, ...glassShadow, marginBottom: 24, marginTop: 8 },
  focusCardInner: { borderRadius: 28, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 0.5, borderColor: c.border, padding: 22 },
  focusCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  focusCountBadge: { backgroundColor: c.borderSubtle, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  focusCountText: { fontSize: 10, fontWeight: '700', color: w(0.45), letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Helvetica Neue' },
  focusRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
  focusIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,116,42,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 14, marginTop: 2 },
  focusIconDone: { backgroundColor: 'rgba(255,116,42,0.06)' },
  focusBody: { flex: 1 },
  focusLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  focusLabel: { fontSize: 15, fontWeight: '700', color: c.textPrimary, fontFamily: 'Helvetica Neue', flex: 1 },
  focusLabelDone: { color: w(0.35), textDecorationLine: 'line-through' },
  focusSubtitle: { fontSize: 12, fontWeight: '400', color: w(0.45), lineHeight: 17, marginBottom: 10, fontFamily: 'Helvetica Neue' },
  focusBarTrack: { height: 4, borderRadius: 2, backgroundColor: w(0.1), overflow: 'hidden', marginBottom: 6 },
  focusBarFill: { height: 4, borderRadius: 2, backgroundColor: ORANGE },
  focusBarDone: { backgroundColor: '#4CAF50' },
  focusValueLabel: { fontSize: 11, fontWeight: '600', color: w(0.4), letterSpacing: 0.3, fontFamily: 'Helvetica Neue' },
  injectionPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(255,116,42,0.12)', marginTop: 4 },
  injectionPillDone: { backgroundColor: 'rgba(76,175,80,0.12)' },
  injectionPillText: { fontSize: 12, fontWeight: '700', color: ORANGE, fontFamily: 'Helvetica Neue' },
  focusDivider: { height: 0.5, backgroundColor: w(0.08), marginLeft: 50 },

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
