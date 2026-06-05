import { Calendar, FileText, Frown, MessageCircle, Heart, TrendingUp, ChevronRight, ChevronDown, Check, XCircle, Syringe, Pill } from 'lucide-react-native';
import { LucideIconByName } from '@/lib/lucide-icon-map';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { GradientBackground } from '@/components/ui/gradient-background';
import { ScrollTitle } from '@/components/ui/scroll-title';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Image, KeyboardAvoidingView, LayoutChangeEvent, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassBorder } from '@/components/ui/glass-border';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import { fetchDailySnapshot, useHealthData, type DailySnapshot } from '@/contexts/health-data';
import { localDateStr } from '@/lib/date-utils';
import { useHealthKitStore } from '@/stores/healthkit-store';
import {
  daysSinceInjection,
  rawDaysSinceInjection,
  generateFocuses,
  getScheduleMode,
  getIntradayPhase,
  hoursSinceDose,
  type DailyActuals,
  type FocusItem,
  type ShotPhase,
  type IntradayPhase,
} from '@/constants/scoring';
import { BRAND_DISPLAY_NAMES, isOnTreatment } from '@/constants/user-profile';
import { isOralDrug, doseNoun, pkConcentrationPct } from '@/constants/drug-pk';
import { useFocusEffect, useRouter } from 'expo-router';
import { useUserStore } from '@/stores/user-store';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';
// generateDynamicInsights removed — replaced by static Treatment Progress card
import { WeeklyCheckinCard } from '@/components/weekly-checkin-card';
import { WeeklySummaryCard } from '@/components/weekly-summary-card';
import { TodayPagerCard } from '@/components/today-pager-card';
import { EnergyBankCard } from '@/components/energy-bank-card';
import { PremiumGate } from '@/components/ui/premium-gate';
import { AppleHealthPromoCard } from '@/components/apple-health-promo-card';
import { computeEnergyBank, computeSideEffectBurden } from '@/constants/scoring';
import { usePersonalizationStore } from '@/stores/personalization-store';
import type { PersonalizedPlan } from '@/lib/personalization';
import { useLogStore } from '@/stores/log-store';
import { useUiStore } from '@/stores/ui-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
// focusCategoryColor moved to daily-action-cards.tsx
import { usePreferencesStore } from '@/stores/preferences-store';
import { supabase } from '@/lib/supabase';
import { pushWidgetData } from '@/lib/widget-sync';
import { useBiometricStore } from '@/stores/biometric-store';
import { WaterLogSheet } from '@/components/water-log-sheet';
import { syncNotifications } from '@/stores/reminders-store';
// ── Appetite forecast imports — commented out (section removed from home screen)
// import { generateForecastStrip, generateIntradayForecast } from '@/lib/cycle-intelligence';
// import { AppetiteForecastStrip } from '@/components/appetite-forecast-strip';
// import { AppetiteForecastWave } from '@/components/appetite-forecast-wave';
// import { AppetiteForecastGauge } from '@/components/appetite-forecast-gauge';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MissedShotModal } from '@/components/missed-shot-modal';
import { TreatmentCheckModal } from '@/components/treatment-check-modal';
import { useProgressPhotoStore } from '@/stores/progress-photo-store';
import { useProfile } from '@/contexts/profile-context';
import { currentWeekWindow, getWeekWindow, isWithinWindow } from '@/lib/program-week';
import { useWeeklySummaryAutoGen } from '@/hooks/use-weekly-summary-gen';
import { MEDICAL_DISCLAIMER } from '@/constants/medical-sources';
import { getEscalationPhase } from '@/lib/escalation-phase';
import { DailyTaskCards } from '@/components/daily-task-cards';
import { PremiumUpsellCard } from '@/components/premium-upsell-card';
import { useSubscriptionStore } from '@/stores/subscription-store';


const INJECTION_SITES = [
  'Left Abdomen', 'Right Abdomen',
  'Left Thigh', 'Right Thigh',
  'Left Upper Arm', 'Right Upper Arm',
];
const FF = 'System';

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
  const router = useRouter();
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
      <Pressable style={mb.viewChip} onPress={() => router.push('/medication-detail' as any)} accessibilityLabel="View medication details" accessibilityRole="link">
        <Text style={mb.viewChipText}>View</Text>
        <IconSymbol name="chevron.right" size={13} color={colors.orange} />
      </Pressable>
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
      fontSize: 14, fontWeight: '600',
      color: w(0.7),
      fontFamily: FF,
    },
    viewChip: {
      flexDirection: 'row', alignItems: 'center', gap: 2,
      backgroundColor: 'rgba(255,116,42,0.10)',
      borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 5,
    },
    viewChipText: {
      fontSize: 14, fontWeight: '600',
      color: c.orange,
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
  if (daysSinceShot === 0) return `${oral ? 'Dose Day' : PHASE_DISPLAY.shot} · ${Noun} logged`;
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

// ─── Week Calendar Strip ─────────────────────────────────────────────────────

const STRIP_DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const STRIP_TOTAL_DAYS = 29; // 14 past + today + 14 future
const STRIP_TODAY_IDX = 14;
const STRIP_TILE_W = 44;
const STRIP_GAP = 6;
const STRIP_ITEM_W = STRIP_TILE_W + STRIP_GAP;

type StripDay = {
  date: Date;
  dateStr: string;
  day: number;
  dayLabel: string;
  isToday: boolean;
  isSelected: boolean;
  isFuture: boolean;
  hasLog: boolean;
};

function DayTile({ item, onSelect, colors }: { item: StripDay; onSelect: (d: Date) => void; colors: AppColors }) {
  const isHighlighted = item.isToday && item.isSelected;
  const isSelectedOther = item.isSelected && !item.isToday;
  const dk = colors.isDark;

  return (
    <Pressable
      onPress={() => onSelect(item.date)}
      style={{
        width: STRIP_TILE_W,
        height: 56,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isHighlighted ? '#FF742A'
          : item.isToday ? (dk ? 'rgba(255,116,42,0.15)' : 'rgba(255,116,42,0.1)')
          : isSelectedOther ? (dk ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)')
          : dk ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.85)',
        borderWidth: isSelectedOther ? 1.5 : 0,
        borderColor: isSelectedOther ? '#FF742A' : 'transparent',
        opacity: item.isFuture && !item.isSelected ? 0.55 : 1,
      }}
      accessibilityLabel={`${item.dayLabel} ${item.day}${item.isToday ? ', today' : ''}${item.hasLog ? ', has logged data' : ''}`}
      accessibilityRole="button"
    >
      <Text style={{
        fontSize: 10, fontWeight: '600', fontFamily: FF,
        color: isHighlighted ? 'rgba(255,255,255,0.8)'
          : dk ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
        marginBottom: 2,
      }}>
        {item.dayLabel}
      </Text>
      <Text style={{
        fontSize: 17, fontWeight: '800', fontFamily: FF,
        color: isHighlighted ? '#FFFFFF'
          : dk ? '#FFFFFF' : '#000000',
      }}>
        {item.day}
      </Text>
      {item.hasLog && !isHighlighted && (
        <View style={{
          width: 4, height: 4, borderRadius: 2, marginTop: 2,
          backgroundColor: item.isToday ? '#FF742A' : (dk ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'),
        }} />
      )}
    </Pressable>
  );
}

function WeekStrip({ selectedDate, onSelect, datesWithLogs, colors }: {
  selectedDate: Date;
  onSelect: (d: Date) => void;
  datesWithLogs: Set<string>;
  colors: AppColors;
}) {
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: STRIP_TOTAL_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + (i - STRIP_TODAY_IDX));
      return {
        date: d,
        dateStr: localDateStr(d),
        day: d.getDate(),
        dayLabel: STRIP_DAY_LABELS[d.getDay()],
        isToday: sameDay(d, today),
        isSelected: sameDay(d, selectedDate),
        isFuture: d > today && !sameDay(d, today),
        hasLog: datesWithLogs.has(localDateStr(d)),
      };
    });
  }, [selectedDate, datesWithLogs]);

  const listRef = useRef<FlatList<StripDay>>(null);
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (!hasScrolled.current) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: STRIP_TODAY_IDX, animated: false, viewPosition: 0.5 });
        hasScrolled.current = true;
      }, 100);
    }
  }, []);

  return (
    <FlatList
      ref={listRef}
      horizontal
      data={days}
      keyExtractor={d => d.dateStr}
      renderItem={({ item }) => <DayTile item={item} onSelect={onSelect} colors={colors} />}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 8, gap: STRIP_GAP }}
      getItemLayout={(_, i) => ({ length: STRIP_ITEM_W, offset: STRIP_ITEM_W * i, index: i })}
      onScrollToIndexFailed={() => {}}
    />
  );
}

function isProjectedShot(lastDate: string | null, freqDays: number, target: Date): boolean {
  if (!lastDate) return false;
  // Parse as local midnight to avoid UTC-offset skew (consistent with daysSinceInjection)
  const lastMs = new Date(lastDate + 'T00:00:00').getTime();
  const targetMs = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diff = Math.round((targetMs - lastMs) / 86400000);
  // Match the projected shot day AND any overdue days (diff >= freqDays)
  // so the reminder persists if the user is late rather than silently vanishing.
  // For future dates, only match the single next projected shot (exact multiple).
  if (diff < freqDays) return false;
  if (diff === freqDays) return true;
  // Overdue: show reminder for current day only (not future dates)
  return diff > freqDays && targetMs <= new Date().setHours(23, 59, 59, 999);
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
          <Pressable onPress={prevMonth} hitSlop={10} accessibilityLabel="Previous month" accessibilityRole="button">
            <IconSymbol name="chevron.left" size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={cal.monthLabel} accessibilityRole="header">{monthLabel}</Text>
          <Pressable onPress={nextMonth} hitSlop={10} accessibilityLabel="Next month" accessibilityRole="button">
            <IconSymbol name="chevron.right" size={20} color={colors.textPrimary} />
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
                <Pressable
                  key={di}
                  style={cal.cell}
                  onPress={() => { if (!isPre) onSelect(date); }}
                  accessibilityLabel={`${new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long' })} ${day}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel, disabled: isPre }}
                >
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

function activityLucideIcon(exerciseType: string | null | undefined): string {
  const t = (exerciseType ?? '').toLowerCase();
  if (t.includes('run') || t.includes('jog'))      return 'Activity';
  if (t.includes('walk'))                           return 'Footprints';
  if (t.includes('cycl') || t.includes('bike'))    return 'Bike';
  if (t.includes('swim'))                           return 'Waves';
  if (t.includes('yoga') || t.includes('stretch'))  return 'Brain';
  if (t.includes('strength') || t.includes('weight') || t.includes('lift')) return 'Dumbbell';
  if (t.includes('hike'))                           return 'Mountain';
  if (t.includes('dance'))                          return 'Music';
  if (t.includes('sport') || t.includes('tennis') || t.includes('basketball') || t.includes('soccer')) return 'Trophy';
  return 'Zap';
}

type DailyLogSummaryCardProps = {
  foodLogs:       DailySnapshot['foodLogs'];
  activityLogs:   DailySnapshot['activityLogs'];
  weightLog:      DailySnapshot['weightLog'] | null;
  injectionLog:   DailySnapshot['injectionLog'] | null;
  sideEffectLogs: DailySnapshot['sideEffectLogs'];
  waterOz:        number;
  isLoading:      boolean;
  isFuture:       boolean;
  oral?:          boolean;
};

function DailyLogSummaryCard({
  foodLogs, activityLogs, weightLog, injectionLog, sideEffectLogs, waterOz,
  isLoading, isFuture, oral = false,
}: DailyLogSummaryCardProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const totalCals = foodLogs.reduce((sum, f) => sum + (f.calories ?? 0), 0);
  const isEmpty = foodLogs.length === 0 && activityLogs.length === 0 && !weightLog && !injectionLog && sideEffectLogs.length === 0 && waterOz === 0;

  const navigate = () => router.push('/day-log' as any);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[s.cardWrap, { marginBottom: 16 }]}>
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
  if (injectionLog) summaryRows.push({ icon: oral ? <Pill size={12} color={w(0.45)} /> : <Syringe size={12} color={w(0.45)} />, label: `${injectionLog.medication_name ?? (oral ? 'Dose' : 'Injection')} ${injectionLog.dose_mg}mg logged` });
  if (foodLogs.length > 0) summaryRows.push({ icon: <IconSymbol name="fork.knife" size={14} color={w(0.45)} />, label: `${foodLogs.length} meal${foodLogs.length > 1 ? 's' : ''} · ${totalCals} cal` });
  if (activityLogs.length > 0) summaryRows.push({ icon: <LucideIconByName name={activityLucideIcon(activityLogs[0]?.exercise_type)} size={14} color={w(0.45)} />, label: `${activityLogs.length} activit${activityLogs.length > 1 ? 'ies' : 'y'}` });
  if (weightLog) summaryRows.push({ icon: <IconSymbol name="scalemass.fill" size={14} color={w(0.45)} />, label: `${weightLog.weight_lbs} lbs` });
  if (waterOz > 0) summaryRows.push({ icon: <IconSymbol name="drop.fill" size={14} color={w(0.45)} />, label: `${waterOz} oz water` });
  if (sideEffectLogs.length > 0) summaryRows.push({ icon: <Frown size={14} color={w(0.45)} />, label: `${sideEffectLogs.length} side effect${sideEffectLogs.length > 1 ? 's' : ''}` });

  return (
    <View style={[s.cardWrap, { marginBottom: 16 }]}>
      <Pressable
        style={[s.cardBody, { backgroundColor: colors.surface }]}
        onPress={navigate}
        accessibilityLabel={`Day log, ${totalCals} calories. View full day`}
        accessibilityRole="button"
      >
        {/* ── Header ── */}
        <View style={{ padding: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color={colors.textPrimary} />
            <Text style={s.insightsTitle}>Day Log</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {injectionLog && (oral ? <Pill size={15} color={w(0.4)} /> : <Syringe size={15} color={w(0.4)} />)}
            {foodLogs.length > 0 && <IconSymbol name="fork.knife" size={15} color={w(0.4)} />}
            {activityLogs.length > 0 && <LucideIconByName name={activityLucideIcon(activityLogs[0]?.exercise_type)} size={15} color={w(0.4)} />}
            {weightLog && <IconSymbol name="scalemass.fill" size={15} color={w(0.4)} />}
            {waterOz > 0 && <IconSymbol name="drop.fill" size={15} color={w(0.4)} />}
            {sideEffectLogs.length > 0 && <Frown size={15} color={w(0.4)} />}
            <IconSymbol name="chevron.right" size={16} color={w(0.35)} />
          </View>
        </View>

        {/* ── Body ── */}
        {isFuture && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
            <Text style={{ fontSize: 16, color: w(0.4), fontFamily: FF }}>Nothing logged yet - this is a future date.</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { appleHealthEnabled, headerStyle, healthPromoCardDismissed, dismissHealthPromoCard, devicesPromoCardDismissed, dismissDevicesPromoCard, weeklyCheckinCardDismissed, dismissWeeklyCheckinCard, weeklySummaryCardDismissed, dismissWeeklySummaryCard, tutorialHintPending, setTutorialHintPending } = usePreferencesStore();
  const minimalHeader = (headerStyle ?? 'gradient') === 'minimal';
  const s = useMemo(() => createStyles(colors, minimalHeader), [colors, minimalHeader]);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { onScroll: tabBarOnScroll, onScrollEnd } = useTabBarVisibility();
  const onScroll = useCallback((e: any) => { scrollY.setValue(e.nativeEvent.contentOffset.y); tabBarOnScroll(e); }, [tabBarOnScroll]);
  const healthData = useHealthData();
  const { lastLogAction, actuals, targets, profile, focuses } = healthData;
  const oral = isOralDrug(profile?.glp1Type);
  const hkStore = useHealthKitStore();
  const { updateProfile, applyPendingTransition, profile: fullUserProfile } = useProfile();
  const onTreatment = isOnTreatment(fullUserProfile);

  const personalizationStore = usePersonalizationStore();
  const logStore = useLogStore();
  const plan = personalizationStore.plan;
  const router = useRouter();
  const { openAiChat } = useUiStore();

  // Lazily generate the just-completed program week's summary snapshot (once).
  useWeeklySummaryAutoGen();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [historicalSnapshot, setHistoricalSnapshot] = useState<DailySnapshot | null>(null);
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const [datesWithLogs, setDatesWithLogs] = useState<Set<string>>(new Set());
  const [datesWithInjections, setDatesWithInjections] = useState<Set<string>>(new Set());
  const [missedShotVisible, setMissedShotVisible] = useState(false);
  const [treatmentCheckVisible, setTreatmentCheckVisible] = useState(false);
  const [waterLogVisible, setWaterLogVisible] = useState(false);
  const missedShotShownRef = useRef(false);

  const userName = useUserStore(st => st.profile?.username ?? null);

  const biometricStore = useBiometricStore();

  // ── Progress photos ──
  const progressPhotos = useProgressPhotoStore((st) => st.photos);
  const fetchProgressPhotos = useProgressPhotoStore((st) => st.fetchPhotos);
  const getSignedUrl = useProgressPhotoStore((st) => st.getSignedUrl);
  const [progressPhotoUrl, setProgressPhotoUrl] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    // Re-verify actuals (including injectionLogged) from Supabase on every tab focus
    // so the injection reminder updates immediately after logging a dose.
    healthData.refreshActuals();
    hkStore.fetchAll().then(() => logStore.syncWeightFromHealthKit()).catch(() => {});
    personalizationStore.fetchAndRecompute();
    logStore.fetchInsightsData().then(() => syncNotifications());
    pushWidgetData(fullUserProfile);
    fetchProgressPhotos();

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



  // Resolve signed URL for the most recent progress photo (for the card thumbnail)
  useEffect(() => {
    const latest = progressPhotos[0];
    if (!latest) { setProgressPhotoUrl(null); return; }
    let cancelled = false;
    getSignedUrl(latest.photoUrl).then((url) => { if (!cancelled) setProgressPhotoUrl(url); });
    return () => { cancelled = true; };
  }, [progressPhotos]);

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

  // One-time hint after the first-run tutorial: let the user know where to find
  // it again. Flag is set when they leave the tutorial post-onboarding.
  useEffect(() => {
    if (!tutorialHintPending) return;
    setTutorialHintPending(false);
    Alert.alert(
      'Tutorial saved for later',
      'You can revisit the tutorial anytime in Settings → Help & Support.',
      [{ text: 'Got it' }],
    );
  }, [tutorialHintPending, setTutorialHintPending]);

  const today   = new Date();
  const isToday = sameDay(selectedDate, today);
  const isFuture = !isToday && selectedDate > today;
  const isPast = !isToday && !isFuture;
  const isPremium = useSubscriptionStore((s) => s.isPremium);

  const dateLabel = `${selectedDate.toLocaleDateString('en-US', { month: 'long' })} ${ordinal(selectedDate.getDate())}`;
  const weekday = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });

  const goToPrevDay = useCallback(() => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  }, [selectedDate]);

  const MAX_FUTURE_DAYS = 14;
  const daysAhead = Math.round((selectedDate.getTime() - today.getTime()) / 86400000);
  const atFutureLimit = daysAhead >= MAX_FUTURE_DAYS;

  const goToNextDay = useCallback(() => {
    if (!atFutureLimit) {
      const next = new Date(selectedDate);
      next.setDate(next.getDate() + 1);
      setSelectedDate(next);
    }
  }, [selectedDate, atFutureLimit]);

  const toggleCalendar = useCallback(() => setCalendarOpen(o => !o), []);

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
  // Unclamped elapsed days for PK concentration (continues decaying past dosing interval)
  const rawDayNum = rawDaysSinceInjection(effectiveLastInjectionDate, selectedDate);

  // Medication strip - always relative to today
  const todayDayNum = daysSinceInjection(effectiveLastInjectionDate, today, freq ?? 7);
  const rawTodayDayNum = rawDaysSinceInjection(effectiveLastInjectionDate, today);
  const uncappedDaysUntil = isFinite(rawTodayDayNum) ? (freq ?? 7) - rawTodayDayNum : null;
  const daysUntil = uncappedDaysUntil != null ? Math.max(0, uncappedDaysUntil) : (freq ?? 7);
  // Use actuals as source of truth for whether today's injection is already logged.
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
      // Use the user's custom name if they set one, otherwise show generic label
      return profile.medicationCustomName || 'My Medication';
    }
    return display;
  })();
  // Always show the prescribed profile dose — that's the single source of truth
  // the user set in Settings. Reading the last injection log here caused the home
  // card to show a stale dose (e.g. a prior brand's mg) after a med/dose change,
  // disagreeing with the My Medications screen. The PK curve shape is dose-
  // independent (Bateman peak normalizes to 100%), so nothing is lost.
  const displayDoseMg = profile.doseMg;
  const medDose = displayDoseMg != null ? `${displayDoseMg}mg` : null;

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

  // "Shot Day" is literally the injection day only (dayNum === 0, i.e. cycle Day 1).
  // From the next day the drug is climbing toward peak, so we never show the
  // "Shot Day" headline/needle on Day 2+. Thresholds scale with cycle length to
  // stay correct for bi-weekly drugs (peak ≤50%, balance ≤85%, then reset).
  const shotPhaseForLabel: ShotPhase =
    dayNum === 0 ? 'shot'
    : dayNum <= Math.round(injFreqDays * 0.5) ? 'peak'
    : dayNum <= Math.round(injFreqDays * 0.85) ? 'balance'
    : 'reset';
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

  // ── Escalation phase (for Fuel/Move/Recharge banner) ───────────────────────
  const escalationPhase = useMemo(() => {
    if (!profile?.startDate || !profile?.doseMg || !profile?.glp1Type) return null;
    const startMs = new Date(profile.startDate + 'T00:00:00').getTime();
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const programWeek = Math.max(1, Math.ceil((now.getTime() - startMs) / (7 * 86400000)));
    return getEscalationPhase(programWeek, profile.doseMg, profile.glp1Type);
  }, [profile?.startDate, profile?.doseMg, profile?.glp1Type]);

  // ── Date-scoped display values ──────────────────────────────────────────────
  const ZERO_ACTUALS: DailyActuals = { proteinG: 0, waterMl: 0, fiberG: 0, steps: 0, caloriesKcal: 0, injectionLogged: false, exerciseMinutes: 0, workoutMinutes: 0, workoutCalories: 0, flightsClimbed: 0 };

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
      lucideIcon: oral ? 'Pill' : 'Syringe',
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
  // Anchor on medicationStartDate so this counter reflects time on the CURRENT
  // medication (drug/brand). It resets only on a drug/brand switch — NOT on a
  // dose titration or frequency change, which keep the same medication running.
  // Fall back to doseStartDate, then startDate, for legacy profiles written
  // before medicationStartDate existed.
  const treatmentStartDate =
    profile.medicationStartDate || profile.doseStartDate || profile.startDate;
  const daysOnTreatment = treatmentStartDate
    ? Math.max(0, Math.floor((referenceTime - new Date(treatmentStartDate + 'T00:00:00').getTime()) / 86400000))
    : null;
  const treatmentDisplayVal = daysOnTreatment != null
    ? daysOnTreatment >= 14 ? `${Math.floor(daysOnTreatment / 7)}` : `${daysOnTreatment}`
    : null;
  const treatmentDisplayLbl = daysOnTreatment != null && daysOnTreatment >= 14
    ? 'weeks on\nmedication'
    : 'days on\nmedication';

  // Latest weight: read from useProfile() (Supabase-backed), not healthData's
  // copy, so we share a single source of truth with the Insights screen.
  // fullUserProfile.currentWeightLbs is reconciled against the latest weight
  // log timestamp on every weigh-in, so it's the authoritative current weight.
  const weightLogsArr = logStore.weightLogs ?? [];
  const selectedDateEndStr = localDateStr(selectedDate);
  const currentFromProfile = fullUserProfile?.currentWeightLbs ?? 0;
  const startFromProfile = fullUserProfile?.startWeightLbs ?? 0;
  const goalFromProfile = fullUserProfile?.goalWeightLbs ?? 0;
  const latestWeight = isPast
    ? (weightLogsArr.find(w => localDateStr(new Date(w.logged_at)) <= selectedDateEndStr)?.weight_lbs ?? null)
    // Prefer the newest actual weigh-in over profile.currentWeightLbs, which can
    // be stale (still equal to the start weight) for seeded/legacy data. This
    // keeps the home card in sync with the Weight Journey page, which also reads
    // from the logs. profile/HK are fallbacks for when no log exists.
    : (weightLogsArr[0]?.weight_lbs ?? (currentFromProfile > 0 ? currentFromProfile : (hkStore.latestWeight ?? null)));

  // Start weight: always use the profile's start weight (set during onboarding),
  // not the earliest weight log entry.
  const startWeight = startFromProfile > 0 ? startFromProfile : null;
  const weightDelta = (startWeight != null && latestWeight != null)
    ? latestWeight - startWeight
    : null;

  // Stat 3: % to goal (or lbs to go if no goal set)
  const goalWeight = goalFromProfile > 0 ? goalFromProfile : null;
  const pctToGoal = (startWeight != null && goalWeight != null && latestWeight != null && startWeight !== goalWeight)
    ? Math.max(0, Math.min(100, Math.round(((startWeight - latestWeight) / (startWeight - goalWeight)) * 100)))
    : null;
  const lbsToGo = (latestWeight != null && goalWeight != null)
    ? Math.max(0, latestWeight - goalWeight)
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

  const daysSinceLastShot = effectiveLastInjectionDate
    ? Math.floor(
        (today.getTime() - new Date(effectiveLastInjectionDate + 'T00:00:00').getTime()) / 86400000
      )
    : 0;

  const lastDoseMg = logStore.injectionLogs[0]?.dose_mg ?? (profile as any).doseMg ?? 0.5;

  // Trigger missed shot / treatment check modal once per session when overdue.
  // Wait for logStore.hydrated so injection logs are loaded before checking.
  // 1–3 days late  -> MissedShotModal (quick backdate)
  // 4+  days late  -> TreatmentCheckModal (still on this med? snoozable for 24h)
  const logStoreHydrated = useLogStore((s) => s.hydrated);
  useEffect(() => {
    if (!logStoreHydrated) return;
    if (missedShotShownRef.current) return;
    if (transitionPhase !== 'none') return; // Don't show during medication transition
    if (rawDaysUntil == null) return;
    if (!effectiveLastInjectionDate) return;
    if (rawDaysUntil >= 0) return;
    if (todayInjLogged) return;
    // Only show after the user has actively logged at least one injection
    // (onboarding seeds exactly 1, so require >1 to avoid nagging new users)
    if (logStore.injectionLogs.length <= 1) return;

    const overdue = Math.abs(rawDaysUntil);

    if (overdue <= 3) {
      missedShotShownRef.current = true;
      setMissedShotVisible(true);
      return;
    }

    // 4+ days late — check 24h snooze before prompting
    (async () => {
      try {
        const snoozedUntilStr = await AsyncStorage.getItem('treatmentCheckSnoozedUntil');
        if (snoozedUntilStr) {
          const snoozedUntil = parseInt(snoozedUntilStr, 10);
          if (Number.isFinite(snoozedUntil) && Date.now() < snoozedUntil) return;
        }
      } catch {}
      missedShotShownRef.current = true;
      setTreatmentCheckVisible(true);
    })();
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

  // ── Energy Bank computation ─────────────────────────────────────────────────
  const energySlide = (() => {
    if (!isToday) return null;
    const phase = dayNum <= Math.round((freq ?? 7) * 0.15) ? 'shot' as const
      : dayNum <= Math.round((freq ?? 7) * 0.5) ? 'peak' as const
      : dayNum <= Math.round((freq ?? 7) * 0.85) ? 'balance' as const : 'reset' as const;
    const seLogs = (logStore.sideEffectLogs ?? []).map(l => ({
      effect_type: l.effect_type, severity: l.severity ?? 0, logged_at: l.logged_at, phase_at_log: l.phase_at_log ?? '',
    }));
    const { burden: seBurden } = computeSideEffectBurden(seLogs, phase, 14);
    const tHours = rawDayNum * 24;
    const glp1Type = profile.glp1Type;
    const intervalH = (freq ?? 7) * 24;
    const pkPct = onTreatment && glp1Type && tHours > 0
      ? pkConcentrationPct(tHours, glp1Type as any, true, intervalH)
      : null;
    const fatigueLogs = seLogs.filter(l => l.effect_type === 'fatigue');
    const { burden: fatigueBurden } = fatigueLogs.length > 0
      ? computeSideEffectBurden(fatigueLogs, phase, 14)
      : { burden: 0 };
    const energyResult = computeEnergyBank(
      healthData.wearable,
      actuals,
      targets,
      phase,
      seBurden,
      pkPct,
      fatigueBurden,
      biometricStore.baseline,
      onTreatment,
    );
    return { result: energyResult, phase };
  })();

  return (
    <TabScreenWrapper>
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView
          style={{ backgroundColor: colors.bg }}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          onScrollEndDrag={onScrollEnd}
          onMomentumScrollEnd={onScrollEnd}
          scrollEventThrottle={16}
        >
          <GradientBackground />
          {/* ── Header (scrolls with content) ── */}
          <View
            style={s.headerArea}
            onLayout={(e: LayoutChangeEvent) => setHeaderHeight(e.nativeEvent.layout.height)}
          >
            {/* Greeting + Streak row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={s.greetingText}>
                {(() => {
                  const h = new Date().getHours();
                  return h >= 5 && h < 12 ? 'Good morning,' : h >= 12 && h < 17 ? 'Good afternoon,' : 'Good evening,';
                })()}
                {userName ? (
                  <>
                    {'\n'}
                    <Text style={s.greetingName}>
                      {userName.length > 15 ? userName.slice(0, 15).trim() + '…' : userName}
                    </Text>
                  </>
                ) : null}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable
                  onPress={() => router.push('/streak')}
                  style={{
                    width: 52, height: 52, borderRadius: 26,
                    backgroundColor: colors.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.9)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  accessibilityLabel="Calendar and achievements"
                  accessibilityRole="button"
                >
                  <Calendar size={24} color={colors.isDark ? '#FFFFFF' : '#1A1A1A'} />
                </Pressable>
              </View>
            </View>

            <View style={{ height: 8 }} />

            {isFuture && <Text style={s.futureNote}>Projected plan - nothing logged yet</Text>}
            {isPast && isLoadingDate && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 6 }} />}
            {isPast && !isLoadingDate && historicalSnapshot !== null &&
              historicalSnapshot.actuals.proteinG === 0 && historicalSnapshot.actuals.fiberG === 0 &&
              historicalSnapshot.actuals.steps === 0 && !historicalSnapshot.actuals.injectionLogged &&
              historicalSnapshot.actuals.waterMl === 0 && historicalSnapshot.foodLogs.length === 0 &&
              <Text style={s.futureNote}>No entries logged for this day</Text>
            }
          </View>

          <Pressable onLongPress={handleBackgroundLongPress} delayLongPress={600} accessibilityLabel="Dashboard content. Long press for AI assistant." accessibilityRole="none">

          {/* ── Viewing History Banner ── */}
          {isPast && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(255,255,255,0.85)',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 9,
              marginBottom: 14,
            }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#1a1a1a', fontFamily: FF }}>
                {`Viewing ${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`}
              </Text>
              <Pressable onPress={() => { setSelectedDate(new Date()); setCalendarOpen(false); }} accessibilityLabel="Back to today" accessibilityRole="button">
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.orange, fontFamily: FF }}>
                  Back to today
                </Text>
              </Pressable>
            </View>
          )}


          {/* ── Today Pager Card (medication, energy, lifestyle highlight, article of day) ── */}
          <TodayPagerCard
            medication={{
              onTreatment,
              profile,
              medName,
              medDose,
              treatmentDisplayVal,
              treatmentDisplayLbl,
              weightDelta,
              stat3Val,
              stat3Lbl,
              todayDayNum,
              freq,
              todayInjLogged,
              rawDaysUntil,
              daysUntil,
              oral,
              effectiveLastInjectionDate,
              transitionPhase,
              intradayPhase,
              shotPhaseForLabel,
              isPast,
              selectedDate,
              today,
              onPhaseLongPress: handlePhasePillPress,
            }}
            energy={null}
          />

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
            oral={oral}
          />

          {/* ── Eat / Move / Rest ── */}
          <DailyTaskCards
            focuses={displayFocuses ?? []}
          />

          {/* ── Energy Bank Card ── */}
          {isToday && energySlide && (
            <View style={{ marginBottom: 16 }}>
              <PremiumGate feature="energy_bank" variant="soft" title="Energy Bank">
                <EnergyBankCard result={energySlide.result} phase={energySlide.phase} />
              </PremiumGate>
            </View>
          )}

          {/* ── Progress Photos Card ── */}
          {isToday && (
            <Pressable
              style={[s.cardWrap, { marginBottom: 16 }]}
              onPress={() => router.push('/progress-photos' as any)}
              accessibilityLabel="Progress photos"
              accessibilityRole="button"
            >
              <View style={[s.cardBody, { backgroundColor: colors.surface }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, fontFamily: FF }}>
                      Progress Photos
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={colors.textMuted} />
                </View>
              </View>
            </Pressable>
          )}

          {/* ── Apple Health Promo (hidden once connected) ── */}
          {!healthPromoCardDismissed && !appleHealthEnabled && (
            <View style={{ marginBottom: 16 }}>
              <AppleHealthPromoCard
                onConnect={() => router.push('/settings/apple-health' as any)}
                onDismiss={dismissHealthPromoCard}
              />
            </View>
          )}

          {/* ── Weekly Check-In (today only) ── */}
          {isToday && !weeklyCheckinCardDismissed && (() => {
            // Read directly from logStore so deletion updates the card synchronously,
            // without waiting for the async personalization plan recompute.
            const allRows = Object.values(logStore.weeklyCheckins).flat();
            const allLoggedAts = allRows
              .map(r => r.logged_at as string)
              .filter(Boolean);

            const lastLoggedAt = allLoggedAts.length > 0
              ? allLoggedAts.reduce((a, b) => (a > b ? a : b))
              : null;

            // Gate to one check-in per program week. A week is "done" if any
            // check-in row falls inside the current program-week window.
            const cur = currentWeekWindow(profile.startDate);
            const currentWeekComplete = cur
              ? allRows.some(r => isWithinWindow(r.logged_at as string, cur))
              : false;
            const nextWin = cur ? getWeekWindow(profile.startDate, cur.index + 1) : null;

            return (
              <View style={{ marginBottom: 16 }}>
                <WeeklyCheckinCard
                  lastLoggedAt={lastLoggedAt}
                  currentWeekComplete={currentWeekComplete}
                  nextAvailableAt={nextWin?.startStr ?? null}
                  isDaily={scheduleMode === 'intraday'}
                  onDismiss={dismissWeeklyCheckinCard}
                />
              </View>
            );
          })()}

          {/* ── Weekly Summary (today only, after at least 7 days on treatment) ── */}
          {isToday && !weeklySummaryCardDismissed && (daysOnTreatment ?? 0) >= 7 && (
            <View style={{ marginBottom: 16 }}>
              <WeeklySummaryCard latestSummary={logStore.weeklySummaries[0] ?? null} onDismiss={dismissWeeklySummaryCard} />
            </View>
          )}

          {/* ── Shot / Dose Day Banner (future projected days) ── */}
          {isFuture && isProjectedInjectionDay && (
            <View style={[s.phaseBanner, { marginBottom: 12 }]}>
              <View>
                <Text style={s.phaseDisplayName}>{oral ? 'Dose Day' : 'Shot Day'}</Text>
                <Text style={s.phaseFocus}>{oral ? 'Projected dose day based on your schedule' : 'Projected injection day based on your schedule'}</Text>
              </View>
            </View>
          )}

          {/* ── Premium Upsell (free users only, today view) ── */}
          {isToday && !isPremium && <PremiumUpsellCard />}

          </Pressable>
        </ScrollView>

        <MissedShotModal
          visible={onTreatment && missedShotVisible}
          onClose={() => setMissedShotVisible(false)}
          expectedShotDate={expectedShotDate}
          overdueDays={overdueDays}
          lastDoseMg={lastDoseMg}
          addInjectionLog={async (dose_mg, injection_date) => {
            const success = await logStore.addInjectionLog(dose_mg, injection_date);
            if (!success) return;
            // If the logged date is today, immediately update daily focuses
            if (injection_date === localDateStr()) {
              healthData.dispatch({ type: 'LOG_INJECTION' });
            }
            await updateProfile({ lastInjectionDate: injection_date });
          }}
          isOral={oral}
        />

        <TreatmentCheckModal
          visible={onTreatment && treatmentCheckVisible}
          onClose={() => setTreatmentCheckVisible(false)}
          daysSinceLastShot={daysSinceLastShot}
          medicationBrand={profile.medicationBrand}
          medicationCustomName={(profile as any).medicationCustomName}
          isOral={oral}
          onLogRecentShot={() => {
            router.push('/entry/log-dose');
          }}
          onStopMedication={async () => {
            try {
              await updateProfile({ treatmentStatus: 'off' });
              const { data: { user: historyUser } } = await supabase.auth.getUser();
              if (historyUser) {
                const { error: histErr } = await supabase.from('medication_changes').insert({
                  user_id: historyUser.id,
                  change_type: 'stopped',
                  prev_brand: profile.medicationBrand ?? null,
                  prev_glp1_type: profile.glp1Type ?? null,
                  prev_dose_mg: profile.doseMg ?? null,
                  prev_frequency_days: profile.injectionFrequencyDays ?? null,
                  new_brand: null,
                  new_glp1_type: null,
                  new_dose_mg: null,
                  new_frequency_days: null,
                });
                if (histErr) console.warn('treatment-check: medication_changes.insert failed:', histErr);
              }
              logStore.fetchInsightsData();
            } catch (err) {
              console.warn('treatment-check: stop medication failed', err);
            }
          }}
          onSnooze={async () => {
            const next = Date.now() + 24 * 60 * 60 * 1000;
            try {
              await AsyncStorage.setItem('treatmentCheckSnoozedUntil', String(next));
            } catch {}
          }}
        />

        <WaterLogSheet visible={waterLogVisible} onClose={() => setWaterLogVisible(false)} />

      </SafeAreaView>
      <ScrollTitle title="Home" scrollY={scrollY} />
    </View>
    </TabScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors, minimalHeader = false) => {
  const headerText = minimalHeader && !c.isDark ? '#000000' : '#FFFFFF';
  const headerTextMuted = minimalHeader && !c.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)';
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 120, backgroundColor: c.bg },

  // Hero gradient — absolute positioned behind all content, fades to page bg
  heroGradientBg: {
    ...StyleSheet.absoluteFillObject,
    height: 320,
  },

  // Fixed header
  headerArea: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  greetingText: { fontSize: 28, fontWeight: '600', color: headerText, letterSpacing: -0.5, fontFamily: FF },
  greetingName: { fontSize: 28, fontWeight: '900', color: headerText, letterSpacing: -0.5, fontFamily: FF },
  dateTitle: { fontSize: 18, fontWeight: '700', color: minimalHeader && !c.isDark ? '#000000' : '#FFFFFF', letterSpacing: -0.3, fontFamily: FF },
  medStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  medPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  medPillText: { fontSize: 14, fontWeight: '600', color: c.textMuted, fontFamily: FF },
  phaseLabel: { fontSize: 15, fontWeight: '600', color: c.textSecondary, fontFamily: FF },
  futureNote: { fontSize: 13, color: headerText, opacity: 0.7, marginTop: 4, fontWeight: '600', fontFamily: FF, textAlign: 'center' as const },
  connectHealthKit: { fontSize: 14, color: 'rgba(255,116,42,0.7)', fontWeight: '500', marginTop: 4, textDecorationLine: 'underline', fontFamily: FF },

  // Card containers
  cardWrap: { borderRadius: 28, ...(c.isDark
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }
    : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }) },
  cardBody: { borderRadius: 28, overflow: 'hidden', borderWidth: 0.5, borderColor: c.border },

  // Insights card (kept for DailyLogSummaryCard insightsTitle usage)
  insightsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  insightsTitle: { fontSize: 19, fontWeight: '700', color: c.textPrimary, fontFamily: FF },
  shotPhase: { fontSize: 12, fontWeight: '700', color: c.orange, letterSpacing: 1.2, fontFamily: FF },
  insightsParagraph: { fontSize: 17, color: w(0.75), fontWeight: '400', lineHeight: 23, fontFamily: FF },

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
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: FF,
  },
  heroMedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textSecondary,
    fontFamily: FF,
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
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
  },
  heroStatVal: {
    fontSize: 26,
    fontWeight: '800',
    color: c.textPrimary,
    fontFamily: FF,
    letterSpacing: -0.5,
  },
  heroStatLbl: {
    fontSize: 13,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
    fontFamily: FF,
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
    fontSize: 13,
    color: c.textSecondary,
    fontFamily: FF,
  },
  heroCycleBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)',
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
    fontSize: 15,
    fontWeight: '700',
    color: '#FF742A',
    fontFamily: FF,
  },
  transitionBody: {
    fontSize: 15,
    fontWeight: '600',
    color: c.textPrimary,
    fontFamily: FF,
  },
  transitionHint: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 4,
    fontFamily: FF,
  },

  // Section title
  sectionTitle: { fontSize: 22, fontWeight: '700', color: c.textPrimary, letterSpacing: -0.3, lineHeight: 28, marginTop: 12, marginBottom: 16, fontFamily: FF },
  pendingBadge: {
    backgroundColor: 'rgba(255,116,42,0.15)',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
  },
  pendingBadgeText: {
    fontSize: 13, fontWeight: '700', color: '#FF742A', fontFamily: FF,
  },

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
    fontSize: 15, fontWeight: '700', color: '#FF742A', fontFamily: FF,
  },
  phaseWeek: {
    fontSize: 13, fontWeight: '600', color: w(0.4),
    backgroundColor: c.borderSubtle, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2, fontFamily: FF,
  },
  plasticityBadge: {
    backgroundColor: 'rgba(255,116,42,0.2)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  plasticityText: {
    fontSize: 11, fontWeight: '800', color: '#FF742A', letterSpacing: 0.8, fontFamily: FF,
  },
  phaseFocus: {
    fontSize: 14, color: w(0.55), lineHeight: 17, fontFamily: FF,
  },

  medDisclaimer: { fontSize: 12, color: w(0.30), textAlign: 'center', lineHeight: 16, marginTop: 20, paddingHorizontal: 8, fontFamily: FF },
  sourcesLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, marginBottom: 8 },
  sourcesLinkText: { fontSize: 13, fontWeight: '600', color: '#FF742A', fontFamily: FF },

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
  monthLabel: { fontSize: 17, fontWeight: '700', color: c.textPrimary, fontFamily: FF },
  weekRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dayHeader:  { width: 36, textAlign: 'center', fontSize: 12, fontWeight: '600', color: c.textMuted, fontFamily: FF },
  cell:       { width: 36, height: 42, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 3 },
  dayCircle:  { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: '#FF742A' },
  dayNum:     { fontSize: 16, fontWeight: '600', color: c.textPrimary, fontFamily: FF },
  dayNumSel:  { fontWeight: '800' },
  dayFuture:  { opacity: 0.45 },
  todayDot:   { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#5AC8FA', marginTop: 2 },
  injDot:     { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FF742A', marginTop: 2 },
  logDot:     { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#34C759', marginTop: 2 },
  legend:      { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { fontSize: 13, color: c.textMuted, fontFamily: FF },
});
