import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  type ShotPhase,

} from '@/constants/scoring';
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

const ORANGE = '#FF742A';
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

// ─── Health Monitor types + data ──────────────────────────────────────────────

type HMStatus = 'good' | 'normal' | 'low' | 'elevated';

type HealthMetric = {
  id: string;
  label: string;
  value: string;
  unit: string;
  status: HMStatus;
  iconName: string;
  iconSet: 'Ionicons' | 'MaterialIcons';
  rangeLabel: string;
};

function hmRhrStatus(bpm: number): HMStatus {
  if (bpm < 55) return 'good';
  if (bpm < 70) return 'normal';
  return 'elevated';
}
function hmRhrLabel(bpm: number): string {
  if (bpm < 55) return 'Optimal';
  if (bpm < 70) return 'Normal';
  return 'Elevated';
}
function hmHrvStatus(ms: number): HMStatus {
  if (ms >= 50) return 'good';
  if (ms >= 30) return 'normal';
  return 'low';
}
function hmHrvLabel(ms: number): string {
  if (ms >= 50) return 'Strong';
  if (ms >= 30) return 'Normal';
  return 'Low';
}
function hmSpo2Status(pct: number): HMStatus {
  if (pct >= 97) return 'good';
  if (pct >= 94) return 'normal';
  return 'low';
}
function hmSleepStatus(min: number): HMStatus {
  if (min >= 420) return 'good';
  if (min >= 360) return 'normal';
  return 'low';
}
function hmSleepLabel(min: number): string {
  if (min >= 420) return 'On Target';
  if (min >= 360) return 'Normal';
  return 'Below Goal';
}
function fmtSleep(min: number): string {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

const hmStatusStyle: Record<HMStatus, { bg: string; text: string }> = {
  good:     { bg: 'rgba(39,174,96,0.15)',   text: '#27AE60' },
  normal:   { bg: 'rgba(91,139,245,0.15)',  text: '#7BA3F7' },
  low:      { bg: 'rgba(243,156,18,0.15)',  text: '#F39C12' },
  elevated: { bg: 'rgba(231,76,60,0.15)',   text: '#E74C3C' },
};

// ─── Health Monitor Card ──────────────────────────────────────────────────────

function HealthMonitorCard({ metric }: { metric: HealthMetric }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const ss = hmStatusStyle[metric.status];
  const icon = metric.iconSet === 'Ionicons'
    ? <Ionicons name={metric.iconName as any} size={20} color={ORANGE} />
    : <MaterialIcons name={metric.iconName as any} size={20} color={ORANGE} />;

  const contextValue = `${metric.value}${metric.unit ? ' ' + metric.unit : ''} · ${metric.rangeLabel}`;
  const { openAiChat } = useUiStore();
  const handleAskAI = () => {
    openAiChat({ type: 'metric', contextLabel: metric.label, contextValue, chips: JSON.stringify(['How can I improve this?', `Is this normal for my phase?`, `How does GLP-1 affect ${metric.label}?`, 'What trends should I watch?']) });
  };

  return (
    <Pressable style={[s.hmWrap, glassShadow]} onPress={handleAskAI}>
      <View style={[s.hmBody, { borderRadius: 20, backgroundColor: colors.surface }]}>
        <View style={s.hmInner}>
          <View style={s.hmTopRow}>
            <View style={s.hmIconWrap}>{icon}</View>
            <View style={[s.hmBadge, { backgroundColor: ss.bg }]}>
              <Text style={[s.hmBadgeText, { color: ss.text }]}>{metric.rangeLabel}</Text>
            </View>
          </View>
          <Text style={s.hmLabel}>{metric.label}</Text>
          <Text style={s.hmValue}>
            {metric.value}
            {metric.unit ? <Text style={s.hmUnit}> {metric.unit}</Text> : null}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Phase Label Builder ──────────────────────────────────────────────────────

function buildPhaseLabel(phase: ShotPhase, daysSinceShot: number, medType: string): string {
  if (daysSinceShot === 0) return 'Shot Day · Injection logged';
  if (daysSinceShot === 1) return 'Peak Phase · Day 2 since last shot';
  if (daysSinceShot === 2) return 'Peak Phase · Day 3 since last shot';
  if (daysSinceShot === 3) return 'Peak Phase · Day 4 since last shot';
  if (daysSinceShot <= 5)  return `Balance Phase · Day ${daysSinceShot} since last shot`;
  if (daysSinceShot === 6) return 'Reset Phase · Day 7 — Injection due tomorrow';
  if (daysSinceShot >= 7)  return 'Injection Overdue — Consider logging your dose';
  return 'Balance Phase';
}

function buildDynamicFocusHint(plan: PersonalizedPlan | null): string {
  if (!plan) return '';
  if (!plan.actuals.injectionLogged) return 'Log your injection to complete today\'s cycle';
  const proteinPct = plan.targets.proteinG > 0 ? plan.actuals.proteinG / plan.targets.proteinG : 1;
  if (proteinPct < 0.5) return 'Protein is well below target — prioritize it today to protect muscle';
  if (proteinPct < 0.8) return 'You\'re partway to your protein target — keep going';
  const stepsPct = plan.targets.steps > 0 ? plan.actuals.steps / plan.targets.steps : 1;
  if (stepsPct < 0.4) return 'Movement is low today — even a short walk counts';
  if (plan.sideEffectBurden > 60) return 'High side effect burden — focus on hydration and rest';
  if (plan.adherenceScore >= 85) return 'Strong day — you\'re ahead on all fronts';
  return 'Keep your current habits going — consistency is what drives results';
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
};

function CalendarDropdown({ selectedDate, onSelect, top, minDate, lastInjectionDate, injectionFrequencyDays = 7, datesWithLogs }: CalendarDropdownProps) {
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
              // Injection day dot: projected based on last injection date + frequency
              const isInjDay = lastInjectionDate
                ? (() => {
                    const diff = Math.round((date.getTime() - new Date(lastInjectionDate).getTime()) / 86400000);
                    return diff >= 0 && diff % injectionFrequencyDays === 0;
                  })()
                : false;
              const hasLogs = !isTod && datesWithLogs?.has(localDateStr(date)) === true;
              return (
                <Pressable key={di} style={cal.cell} onPress={() => { if (!isPre) onSelect(date); }}>
                  <View style={[cal.dayCircle, isSel && cal.daySelected]}>
                    <Text style={[cal.dayNum, isSel && cal.dayNumSel, isPre && cal.dayFuture]}>
                      {day}
                    </Text>
                  </View>
                  {isTod && !isSel && <View style={cal.todayDot} />}
                  {isInjDay && !isSel && !isTod && !hasLogs && <View style={cal.injDot} />}
                  {hasLogs && !isSel && <View style={cal.logDot} />}
                </Pressable>
              );
            })}
          </View>
        ))}
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

const MEAL_ICONS: Record<string, string> = {
  breakfast: '🍳',
  lunch:     '🥗',
  dinner:    '🍽️',
  snack:     '🫐',
};

type DailyLogSummaryCardProps = {
  foodLogs:      DailySnapshot['foodLogs'];
  activityLogs:  DailySnapshot['activityLogs'];
  weightLog:     DailySnapshot['weightLog'] | null;
  injectionLog:  DailySnapshot['injectionLog'] | null;
  sideEffectLogs: DailySnapshot['sideEffectLogs'];
  isLoading:     boolean;
  isFuture:      boolean;
};

function DailyLogSummaryCard({
  foodLogs,
  activityLogs,
  weightLog,
  injectionLog,
  sideEffectLogs,
  isLoading,
  isFuture,
}: DailyLogSummaryCardProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const totalCals = foodLogs.reduce((sum, f) => sum + (f.calories ?? 0), 0);
  const isEmpty = foodLogs.length === 0 && activityLogs.length === 0 && !weightLog && !injectionLog && sideEffectLogs.length === 0;

  // Group food logs by meal type, show max 5 total
  const foodByMeal: Record<string, typeof foodLogs> = {};
  for (const f of foodLogs) {
    const m = (f.meal_type ?? 'snack').toLowerCase();
    if (!foodByMeal[m]) foodByMeal[m] = [];
    foodByMeal[m].push(f);
  }
  const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
  const sortedFoods = MEAL_ORDER.flatMap(m => foodByMeal[m] ?? []);
  const shownFoods = sortedFoods.slice(0, 5);
  const moreCount = Math.max(0, sortedFoods.length - 5);

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

  return (
    <View style={[s.cardWrap, { marginBottom: 24, marginTop: 8 }]}>
      <View style={[s.cardBody, { backgroundColor: colors.surface }]}>
        <View style={{ padding: 20 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={s.insightsTitle}>Day Log</Text>
            {totalCals > 0 && (
              <View style={{ backgroundColor: colors.borderSubtle, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: w(0.55), fontFamily: FF }}>{totalCals} cal</Text>
              </View>
            )}
          </View>

          {isFuture ? (
            <Text style={{ fontSize: 14, color: w(0.4), fontFamily: FF }}>Nothing logged yet — this is a future date.</Text>
          ) : isEmpty ? (
            <Text style={{ fontSize: 14, color: w(0.4), fontFamily: FF }}>No entries logged for this day.</Text>
          ) : (
            <>
              {/* Injection row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 }}>
                <Ionicons name="medical-outline" size={16} color={injectionLog ? ORANGE : w(0.3)} />
                <Text style={{ fontSize: 14, color: injectionLog ? w(0.75) : w(0.35), fontFamily: FF }}>
                  {injectionLog
                    ? `${injectionLog.medication_name ?? 'Injection'} ${injectionLog.dose_mg}mg · logged`
                    : 'No injection logged'}
                </Text>
              </View>

              {/* Food section */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: w(0.4), letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, fontFamily: FF }}>Food</Text>
              {shownFoods.length === 0 ? (
                <Text style={{ fontSize: 14, color: w(0.35), fontFamily: FF, marginBottom: 12 }}>No meals logged</Text>
              ) : (
                <>
                  {shownFoods.map(f => (
                    <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                      <Text style={{ fontSize: 16 }}>{MEAL_ICONS[(f.meal_type ?? 'snack').toLowerCase()] ?? '🍽️'}</Text>
                      <Text style={{ fontSize: 14, color: w(0.75), flex: 1, fontFamily: FF }} numberOfLines={1}>{f.food_name}</Text>
                      <Text style={{ fontSize: 13, color: w(0.4), fontFamily: FF }}>{f.calories} cal</Text>
                    </View>
                  ))}
                  {moreCount > 0 && (
                    <Text style={{ fontSize: 12, color: ORANGE, fontWeight: '600', fontFamily: FF, marginBottom: 8 }}>+{moreCount} more</Text>
                  )}
                </>
              )}

              {/* Activity section */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: w(0.4), letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4, marginBottom: 8, fontFamily: FF }}>Activity</Text>
              {activityLogs.length === 0 ? (
                <Text style={{ fontSize: 14, color: w(0.35), fontFamily: FF, marginBottom: 12 }}>No activity logged</Text>
              ) : (
                <>
                  {activityLogs.map(a => (
                    <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                      <Ionicons name="fitness-outline" size={16} color={ORANGE} />
                      <Text style={{ fontSize: 14, color: w(0.75), flex: 1, fontFamily: FF }}>{a.exercise_type || 'Activity'}</Text>
                      <Text style={{ fontSize: 13, color: w(0.4), fontFamily: FF }}>
                        {a.duration_min > 0 ? `${a.duration_min}min` : a.steps > 0 ? `${a.steps} steps` : ''}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {/* Weight row */}
              {weightLog && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8, gap: 8 }}>
                  <Ionicons name="scale-outline" size={16} color={w(0.45)} />
                  <Text style={{ fontSize: 14, color: w(0.75), fontFamily: FF }}>{weightLog.weight_lbs} lbs</Text>
                </View>
              )}

              {/* Side effects badge */}
              {sideEffectLogs.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                  <View style={{ backgroundColor: 'rgba(231,76,60,0.12)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#E74C3C', fontFamily: FF }}>
                      {sideEffectLogs.length} side effect{sideEffectLogs.length > 1 ? 's' : ''} logged
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { onScroll } = useTabBarVisibility();
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
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [dismissedFlags, setDismissedFlags] = useState<string[]>([]);
  const [historicalSnapshot, setHistoricalSnapshot] = useState<DailySnapshot | null>(null);
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const [datesWithLogs, setDatesWithLogs] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => {
    hkStore.fetchAll();
    personalizationStore.fetchAndRecompute();
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
        const dates = new Set<string>();
        (injR.data ?? []).forEach(r => dates.add(r.injection_date));
        (foodR.data ?? []).forEach(r => {
          const d = localDateStr(new Date(r.logged_at));
          dates.add(d);
        });
        (actR.data ?? []).forEach(r => dates.add(r.date));
        setDatesWithLogs(dates);
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

  const dateLabel = isToday
    ? `Today, ${selectedDate.toLocaleDateString('en-US', { month: 'long' })} ${ordinal(selectedDate.getDate())}`
    : `${selectedDate.toLocaleDateString('en-US', { month: 'long' })} ${ordinal(selectedDate.getDate())}`;
  const weekday = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });

  const dayNum = daysSinceInjection(profile.lastInjectionDate, selectedDate);
  const freq = profile.injectionFrequencyDays;
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

  const displayFocuses = isToday
    ? focuses
    : generateFocuses(displayActuals, targets, {}, dayNum);

  const isProjectedInjectionDay = isFuture
    ? isProjectedShot(profile.lastInjectionDate, profile.injectionFrequencyDays ?? 7, selectedDate)
    : displayActuals.injectionLogged;

  const focusSectionLabel = isToday
    ? "Today's Focuses"
    : isFuture
      ? `Planned for ${weekday}`
      : `${weekday}'s Focuses`;

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
        foodLogs:       todayFoodLogs.map(f => ({ id: f.id, food_name: f.food_name, calories: f.calories ?? 0, protein_g: f.protein_g ?? 0, carbs_g: (f as any).carbs_g ?? 0, fat_g: (f as any).fat_g ?? 0, meal_type: f.meal_type ?? 'snack', logged_at: f.logged_at })),
        activityLogs:   todayActivityLogs.map(a => ({ id: a.id, exercise_type: a.exercise_type ?? '', duration_min: a.duration_min ?? 0, steps: a.steps ?? 0, active_calories: a.active_calories ?? 0 })),
        weightLog:      todayWeightLog ? { weight_lbs: todayWeightLog.weight_lbs ?? 0, logged_at: todayWeightLog.logged_at } : null,
        injectionLog:   todayInjectionLog ? { dose_mg: todayInjectionLog.dose_mg ?? 0, injection_date: todayInjectionLog.injection_date, medication_name: (todayInjectionLog as any).medication_name ?? null } : null,
        sideEffectLogs: todaySideEffects.map(s => ({ effect_type: s.effect_type, severity: s.severity ?? 0, logged_at: s.logged_at })),
      }
    : (historicalSnapshot ?? { foodLogs: [], activityLogs: [], weightLog: null, injectionLog: null, sideEffectLogs: [] });

  // Block all past dates until the user has at least one logged entry.
  // A fresh user has no reason to navigate back — there's nothing there.
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

          {isFuture && <Text style={s.futureNote}>Projected plan — nothing logged yet</Text>}
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
          />
        )}

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >

          {/* ── Phase Focus Hint ── */}
          {plan && buildDynamicFocusHint(plan) !== '' && (
            <View style={[s.phaseBanner, { marginBottom: 12 }]}>
              <Text style={s.phaseFocus}>{buildDynamicFocusHint(plan)}</Text>
            </View>
          )}

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

          {/* ── Clinical Alerts (top 2) ── */}
          {clinicalFlags.slice(0, 2).map(flag => (
            <ClinicalAlertCard
              key={flag.type}
              flag={flag}
              onDismiss={(type) => setDismissedFlags(prev => [...prev, type])}
            />
          ))}

          {/* ── Shot Day Banner (future projected injection days) ── */}
          {isFuture && isProjectedInjectionDay && (
            <View style={[s.phaseBanner, { marginBottom: 12 }]}>
              <View>
                <Text style={s.phaseDisplayName}>Shot Day</Text>
                <Text style={s.phaseFocus}>Projected injection day based on your schedule</Text>
              </View>
            </View>
          )}

          {/* ── Today's Focuses ── */}
          <View style={s.focusCard}>
            <View style={s.focusCardInner}>
              {/* Header */}
              <View style={s.focusCardHeader}>
                <Text style={[s.sectionTitle, { marginBottom: 0 }]}>{focusSectionLabel}</Text>
                <View style={s.focusCountBadge}>
                  <Text style={s.focusCountText}>{(displayFocuses ?? []).length} Tasks</Text>
                </View>
              </View>

              {/* Timeline items — tap any to open AI chat with context */}
              {(displayFocuses ?? []).map((item, index) => {
                const isLast = index === (displayFocuses ?? []).length - 1;
                const handleFocusPress = () => {
                  openAiChat({ type: 'focus', contextLabel: item.label, contextValue: item.subtitle, chips: JSON.stringify(['What should I eat now?', 'Give me a specific plan', 'How close am I to my goal?', 'What has the biggest impact?']) });
                };
                return (
                  <Pressable key={item.id} style={s.focusTimelineItem} onPress={handleFocusPress}>
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

          {/* ── Daily Log Summary ── */}
          <DailyLogSummaryCard
            foodLogs={displaySnapshot.foodLogs}
            activityLogs={displaySnapshot.activityLogs}
            weightLog={displaySnapshot.weightLog}
            injectionLog={displaySnapshot.injectionLog}
            sideEffectLogs={displaySnapshot.sideEffectLogs}
            isLoading={isPast && isLoadingDate}
            isFuture={isFuture}
          />

          {/* ── Insights Card ── */}
          <View style={[s.cardWrap, { marginBottom: 24, marginTop: 8 }]}>
            <View style={[s.cardBody, { backgroundColor: colors.surface }]}>
              <View style={{ padding: 20 }}>
                <View style={s.insightsHead}>
                  <Text style={s.insightsTitle}>Insights</Text>
                  <Text style={s.shotPhase}>{aiInsights ? 'AI · TODAY' : (staticInsights[0]?.phase ?? 'TODAY')}</Text>
                </View>
                {insightsLoading && !aiInsights ? (
                  <>
                    {[0.85, 0.70, 0.78].map((w, i) => (
                      <View key={i} style={[s.bulletRow, { marginBottom: 14 }]}>
                        <View style={[s.bullet, { backgroundColor: 'rgba(255,116,42,0.3)' }]} />
                        <View style={{ height: 14, borderRadius: 7, backgroundColor: colors.borderSubtle, flex: 1, maxWidth: `${w * 100}%` as any }} />
                      </View>
                    ))}
                  </>
                ) : aiInsights ? (
                  aiInsights.map((text, i) => (
                    <Pressable
                      key={i}
                      style={s.bulletRow}
                      onPress={() => openAiChat({ contextLabel: 'Insight', contextValue: text.slice(0, 60), seedMessage: text, chips: JSON.stringify(['Tell me more', 'What should I do?', 'How does this affect my goals?']) })}
                    >
                      <View style={[s.bullet, { backgroundColor: ORANGE }]} />
                      <Text style={s.bulletText}>{text}</Text>
                    </Pressable>
                  ))
                ) : (
                  staticInsights.map((b, i) => (
                    <Pressable
                      key={i}
                      style={s.bulletRow}
                      onPress={() => openAiChat({ contextLabel: 'Insight', contextValue: b.text.slice(0, 60), seedMessage: b.text, chips: JSON.stringify(['Tell me more', 'What should I do?', 'How does this affect my goals?']) })}
                    >
                      <View style={[s.bullet, { backgroundColor: ORANGE }]} />
                      <Text style={s.bulletText}>{b.text}</Text>
                    </Pressable>
                  ))
                )}
                <Text style={s.insightsFooter}>
                  Based on your latest biometrics and medication phase.
                </Text>
              </View>
            </View>
          </View>

          {/* ── Health Monitor ── */}
          <Text style={[s.sectionTitle, { marginTop: 8 }]}>Health Monitor</Text>
          <View style={s.hmGrid}>
            {((): HealthMetric[] => {
              const hkRhr   = appleHealthEnabled ? hkStore.restingHR   : null;
              const hkHrv   = appleHealthEnabled ? hkStore.hrv         : null;
              const hkSleep = appleHealthEnabled ? hkStore.sleepHours  : null;
              const hkGlucose = appleHealthEnabled ? hkStore.bloodGlucose : null;

              const noData = !appleHealthEnabled;

              const rhrVal  = hkRhr  ?? (noData ? null : wearable.restingHR);
              const hrvVal  = hkHrv  ?? (noData ? null : wearable.hrvMs);
              const sleepMin = hkSleep != null ? Math.round(hkSleep * 60) : (noData ? null : wearable.sleepMinutes);
              const spo2Val = noData ? null : wearable.spo2Pct;
              const respVal = noData ? null : wearable.respRateRpm;

              const metrics: HealthMetric[] = [
                {
                  id: 'rrr', label: 'Resp. Rate',
                  value: respVal != null ? String(respVal) : 'No data',
                  unit: respVal != null ? 'bpm' : '', status: 'normal',
                  iconSet: 'MaterialIcons', iconName: 'air',
                  rangeLabel: respVal != null ? 'Normal' : '—',
                },
                {
                  id: 'rhr', label: 'Resting HR',
                  value: rhrVal != null ? String(rhrVal) : 'No data',
                  unit: rhrVal != null ? 'bpm' : '',
                  status: rhrVal != null ? hmRhrStatus(rhrVal) : 'normal',
                  iconSet: 'Ionicons', iconName: 'heart-outline',
                  rangeLabel: rhrVal != null ? hmRhrLabel(rhrVal) : '—',
                },
                {
                  id: 'hrv', label: 'HRV',
                  value: hrvVal != null ? String(hrvVal) : 'No data',
                  unit: hrvVal != null ? 'ms' : '',
                  status: hrvVal != null ? hmHrvStatus(hrvVal) : 'normal',
                  iconSet: 'MaterialIcons', iconName: 'show-chart',
                  rangeLabel: hrvVal != null ? hmHrvLabel(hrvVal) : '—',
                },
                {
                  id: 'spo2', label: 'SpO₂',
                  value: spo2Val != null ? String(spo2Val) : 'No data',
                  unit: spo2Val != null ? '%' : '',
                  status: spo2Val != null ? hmSpo2Status(spo2Val) : 'normal',
                  iconSet: 'MaterialIcons', iconName: 'bloodtype',
                  rangeLabel: spo2Val != null ? 'Normal' : '—',
                },
                {
                  id: 'temp', label: 'Temp',
                  value: noData ? 'No data' : '98.4',
                  unit: noData ? '' : '°F', status: 'normal',
                  iconSet: 'MaterialIcons', iconName: 'thermostat',
                  rangeLabel: noData ? '—' : 'Normal',
                },
                {
                  id: 'sleep', label: 'Sleep',
                  value: sleepMin != null ? fmtSleep(sleepMin) : 'No data',
                  unit: '',
                  status: sleepMin != null ? hmSleepStatus(sleepMin) : 'normal',
                  iconSet: 'Ionicons', iconName: 'moon-outline',
                  rangeLabel: sleepMin != null ? hmSleepLabel(sleepMin) : '—',
                },
              ];

              if (hkGlucose != null) {
                metrics.push({
                  id: 'glucose', label: 'Blood Glucose', value: String(hkGlucose), unit: 'mg/dL',
                  status: hkGlucose < 100 ? 'good' : hkGlucose < 125 ? 'normal' : 'elevated',
                  iconSet: 'MaterialIcons', iconName: 'water-drop',
                  rangeLabel: hkGlucose < 100 ? 'Normal' : hkGlucose < 125 ? 'Pre-range' : 'High',
                });
              }

              return metrics;
            })().map(m => <HealthMonitorCard key={m.id} metric={m} />)}
          </View>

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
  weekday: { fontSize: 13, fontWeight: '500', color: c.textMuted, marginBottom: 4, fontFamily: 'Helvetica Neue' },
  phaseLabel: { fontSize: 13, fontWeight: '600', color: c.textSecondary, fontFamily: 'Helvetica Neue' },
  futureNote: { fontSize: 11, color: '#FF742A', marginTop: 4, fontWeight: '600', fontFamily: 'Helvetica Neue' },
  connectHealthKit: { fontSize: 12, color: 'rgba(255,116,42,0.7)', fontWeight: '500', marginTop: 4, textDecorationLine: 'underline', fontFamily: 'Helvetica Neue' },

  // Card containers
  cardWrap: { borderRadius: 28, ...glassShadow },
  cardBody: { borderRadius: 28, overflow: 'hidden', borderWidth: 0.5, borderColor: c.border },

  // Insights card
  insightsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  insightsTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  shotPhase: { fontSize: 10, fontWeight: '700', color: ORANGE, letterSpacing: 1.2, fontFamily: 'Helvetica Neue' },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bullet: { width: 7, height: 7, borderRadius: 3.5, marginRight: 10 },
  bulletText: { fontSize: 15, color: w(0.75), fontWeight: '400', flex: 1, fontFamily: 'Helvetica Neue' },
  insightsFooter: { fontSize: 12, color: w(0.40), fontWeight: '500', marginTop: 6, lineHeight: 18, fontFamily: 'Helvetica Neue' },

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

  // Health Monitor grid
  hmGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  hmWrap: { width: '47.5%', borderRadius: 20 },
  hmBody: { overflow: 'hidden', borderWidth: 0.5, borderColor: c.border },
  hmInner: { padding: 16 },
  hmTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  hmIconWrap: { alignItems: 'center', justifyContent: 'center' },
  hmBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  hmBadgeText: { fontSize: 9, fontWeight: '700', fontFamily: 'Helvetica Neue' },
  hmLabel: { fontSize: 12, color: w(0.45), fontWeight: '500', marginBottom: 3, fontFamily: 'Helvetica Neue' },
  hmValue: { fontSize: 22, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },
  hmUnit: { fontSize: 13, fontWeight: '500', color: w(0.45), letterSpacing: 0, fontFamily: 'Helvetica Neue' },
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
  todayDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FF742A', marginTop: 2 },
  injDot:     { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FF742A', marginTop: 2 },
  logDot:     { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FF742A', marginTop: 2, opacity: 0.55 },
});
