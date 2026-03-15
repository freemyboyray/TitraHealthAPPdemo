import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, LayoutChangeEvent, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { GlassBorder } from '@/components/ui/glass-border';
import { useHealthData } from '@/contexts/health-data';
import { useHealthKitStore } from '@/stores/healthkit-store';
import {
  daysSinceInjection,
  generateInsights,
  recoveryGradient,
  recoveryMessage,
  supportGradient,
  supportMessage,
  type ShotPhase,
  type SideEffectIndex,
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

// ─── Side Effect Badge ────────────────────────────────────────────────────────

function SideEffectBadge({ index }: { index: SideEffectIndex }) {
  if (index.level === 'none') return null;

  const badgeColor =
    index.level === 'severe' ? '#E53E3E'
    : index.level === 'moderate' ? '#E8960C'
    : '#27AE60'; // mild + expected

  const emoji =
    index.level === 'severe' ? '🔴'
    : index.level === 'moderate' ? '🟡'
    : '🟢';

  const symptomLabel = index.primarySymptom
    ? index.primarySymptom.replace('_', ' ')
    : null;

  const label = index.level === 'severe'
    ? `${emoji} Severe — Contact prescriber`
    : symptomLabel
    ? `${emoji} ${index.level.charAt(0).toUpperCase() + index.level.slice(1)} · ${symptomLabel.charAt(0).toUpperCase() + symptomLabel.slice(1)}${index.phaseNote ? ` — ${index.phaseNote}` : ''}`
    : `${emoji} ${index.level.charAt(0).toUpperCase() + index.level.slice(1)}${index.phaseNote ? ` — ${index.phaseNote}` : ''}`;

  return (
    <View style={[seb.wrap, { borderColor: badgeColor + '55', backgroundColor: badgeColor + '18' }]}>
      <Text style={[seb.text, { color: badgeColor }]}>{label}</Text>
    </View>
  );
}

const seb = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
  },
  text: { fontSize: 12, fontWeight: '600', fontFamily: 'Helvetica Neue' },
});

// ─── Dual Ring Arc ────────────────────────────────────────────────────────────

type DualRingArcProps = {
  recoveryScore: number | null;
  supportScore: number;
};

function DualRingArc({ recoveryScore, supportScore }: DualRingArcProps) {
  const { colors } = useAppTheme();
  const SVG_SIZE = 500;
  const cx = 250, cy = 250;
  const OUTER_R = 155, INNER_R = 103, SW = 38;
  const outerCirc = 2 * Math.PI * OUTER_R;
  const innerCirc = 2 * Math.PI * INNER_R;
  const outerQuart = outerCirc / 4;
  const innerQuart = innerCirc / 4;

  const outerOffset = useSharedValue(outerQuart);
  const innerOffset = useSharedValue(innerQuart);

  useEffect(() => {
    // When recovery is null (no wearable data), keep outer ring at 0% fill (full dash offset = full circle = empty)
    outerOffset.value = withTiming(recoveryScore != null ? outerQuart * (1 - recoveryScore / 100) : outerQuart, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
    innerOffset.value = withTiming(innerQuart * (1 - supportScore / 100), {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [recoveryScore, supportScore]);

  const outerProps = useAnimatedProps(() => ({ strokeDashoffset: outerOffset.value }));
  const innerProps = useAnimatedProps(() => ({ strokeDashoffset: innerOffset.value }));

  return (
    <Svg width={SVG_SIZE} height={SVG_SIZE}>
      <Circle cx={cx} cy={cy} r={OUTER_R} strokeWidth={SW} stroke={colors.ringTrack} fill="none" opacity={1} />
      <Circle cx={cx} cy={cy} r={INNER_R} strokeWidth={SW} stroke={colors.ringTrack} fill="none" opacity={1} />
      <AnimatedCircle
        cx={cx} cy={cy} r={OUTER_R} fill="none"
        stroke="#FF742A" strokeWidth={SW} strokeLinecap="round"
        strokeDasharray={outerQuart} animatedProps={outerProps}
        rotation="-90" origin={`${cx}, ${cy}`}
        opacity={recoveryScore === 0 ? 0 : 1}
      />
      <AnimatedCircle
        cx={cx} cy={cy} r={INNER_R} fill="none"
        stroke={colors.textPrimary} strokeWidth={SW} strokeLinecap="round"
        strokeDasharray={innerQuart} animatedProps={innerProps}
        rotation="-90" origin={`${cx}, ${cy}`}
        opacity={supportScore === 0 ? 0 : 1}
      />
    </Svg>
  );
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

// ─── Calendar Dropdown ────────────────────────────────────────────────────────

type CalendarDropdownProps = {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  top: number;
};

function CalendarDropdown({ selectedDate, onSelect, top }: CalendarDropdownProps) {
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
              const isFut = date > today && !isTod;
              return (
                <Pressable key={di} style={cal.cell} onPress={() => onSelect(date)}>
                  <View style={[cal.dayCircle, isSel && cal.daySelected]}>
                    <Text style={[cal.dayNum, isSel && cal.dayNumSel, isFut && cal.dayFuture]}>
                      {day}
                    </Text>
                  </View>
                  {isTod && !isSel && <View style={cal.todayDot} />}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}


// ─── Rings Explainer Modal ────────────────────────────────────────────────────

function RingsExplainerModal({ onClose }: { onClose: () => void }) {
  const { colors } = useAppTheme();
  const em = useMemo(() => createEmStyles(colors), [colors]);
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={em.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={em.sheet}>
          <View style={em.handle} />

          {/* Header */}
          <View style={em.header}>
            <Text style={em.title}>How Your Rings Work</Text>
            <Pressable onPress={onClose} style={em.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={em.scrollContent}>

            {/* Recovery Ring */}
            <View style={em.section}>
              <View style={em.sectionHeader}>
                <View style={[em.dot, { backgroundColor: '#FF742A' }]} />
                <Text style={em.sectionTitle}>Readiness Ring (Orange)</Text>
              </View>
              <View style={em.metricList}>
                <View style={em.metricRow}>
                  <Text style={em.metricName}>Sleep</Text>
                  <Text style={em.metricDesc}>GLP-1 can disrupt sleep cycles — quality rest is critical for medication effectiveness and appetite regulation.</Text>
                </View>
                <View style={em.metricRow}>
                  <Text style={em.metricName}>HRV</Text>
                  <Text style={em.metricDesc}>Heart rate variability reflects your nervous system's recovery. GLP-1 medications temporarily lower HRV near injection day — scores are phase-adjusted.</Text>
                </View>
                <View style={em.metricRow}>
                  <Text style={em.metricName}>Resting HR</Text>
                  <Text style={em.metricDesc}>A lower resting heart rate indicates good cardiovascular recovery. Peak phase (days 3–4) may cause a slight elevation due to medication activity.</Text>
                </View>
                <View style={em.metricRow}>
                  <Text style={em.metricName}>SpO₂</Text>
                  <Text style={em.metricDesc}>Blood oxygen saturation above 95% ensures your muscles and brain are properly fueled during GLP-1-driven metabolic changes.</Text>
                </View>
              </View>
            </View>

            <View style={em.divider} />

            {/* Readiness Ring */}
            <View style={em.section}>
              <View style={em.sectionHeader}>
                <View style={[em.dot, { backgroundColor: colors.textPrimary }]} />
                <Text style={em.sectionTitle}>Routine Ring (White)</Text>
              </View>
              <View style={em.metricList}>
                <View style={em.metricRow}>
                  <Text style={em.metricName}>Protein</Text>
                  <Text style={em.metricDesc}>GLP-1 reduces appetite — hitting your protein target prevents muscle loss while your body composition changes.</Text>
                </View>
                <View style={em.metricRow}>
                  <Text style={em.metricName}>Hydration</Text>
                  <Text style={em.metricDesc}>Semaglutide and tirzepatide increase the risk of dehydration. Staying hydrated reduces nausea and supports kidney function.</Text>
                </View>
                <View style={em.metricRow}>
                  <Text style={em.metricName}>Movement</Text>
                  <Text style={em.metricDesc}>Daily steps amplify GLP-1's metabolic effect and offset the muscle loss risk from reduced calorie intake.</Text>
                </View>
                <View style={em.metricRow}>
                  <Text style={em.metricName}>Fiber</Text>
                  <Text style={em.metricDesc}>Fiber slows gastric emptying in sync with your medication and supports gut microbiome health for better outcomes.</Text>
                </View>
                <View style={em.metricRow}>
                  <Text style={em.metricName}>Medication</Text>
                  <Text style={em.metricDesc}>Logging your injection unlocks the full 15-point bonus and enables phase-aware scoring and coaching throughout your cycle.</Text>
                </View>
              </View>
            </View>

            <View style={em.divider} />

            {/* Shot Phase Guide */}
            <View style={em.section}>
              <Text style={[em.sectionTitle, { marginBottom: 14 }]}>Shot Phase Guide</Text>
              <View style={em.phaseList}>
                <View style={em.phaseRow}>
                  <Text style={em.phaseEmoji}>💉</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={em.phaseName}>Shot Day</Text>
                    <Text style={em.phaseDesc}>Log your injection and focus on protein + hydration. Your body begins absorbing the dose in the first 12–24 hours.</Text>
                  </View>
                </View>
                <View style={em.phaseRow}>
                  <Text style={em.phaseEmoji}>⚡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={em.phaseName}>Peak Phase (Days 3–4)</Text>
                    <Text style={em.phaseDesc}>Medication is at peak blood concentration. Nausea is most common here — prioritize light meals, hydration, and gentle movement.</Text>
                  </View>
                </View>
                <View style={em.phaseRow}>
                  <Text style={em.phaseEmoji}>⚖️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={em.phaseName}>Balance Phase (Days 5–6)</Text>
                    <Text style={em.phaseDesc}>Medication levels are stabilizing. Appetite usually improves — a good time to focus on hitting all nutrition targets.</Text>
                  </View>
                </View>
                <View style={[em.phaseRow, { borderBottomWidth: 0 }]}>
                  <Text style={em.phaseEmoji}>🔄</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={em.phaseName}>Reset Phase (Day 7)</Text>
                    <Text style={em.phaseDesc}>Medication is tapering toward your next shot. Maintain consistency to keep momentum until the next cycle begins.</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createEmStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 0.5,
    borderColor: c.ringTrack,
    maxHeight: '88%',
    paddingBottom: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: w(0.2),
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: c.borderSubtle,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: c.textPrimary,
    letterSpacing: -0.3,
    fontFamily: FF,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  section: { marginBottom: 4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: c.textPrimary,
    fontFamily: FF,
  },
  metricList: { gap: 12 },
  metricRow: {
    flexDirection: 'column',
    gap: 2,
  },
  metricName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF742A',
    fontFamily: FF,
  },
  metricDesc: {
    fontSize: 13,
    color: w(0.55),
    lineHeight: 19,
    fontFamily: FF,
  },
  divider: {
    height: 0.5,
    backgroundColor: c.borderSubtle,
    marginVertical: 20,
  },
  phaseList: { gap: 0 },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: w(0.06),
  },
  phaseEmoji: { fontSize: 20, lineHeight: 26 },
  phaseName: {
    fontSize: 13,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 2,
    fontFamily: FF,
  },
  phaseDesc: {
    fontSize: 13,
    color: w(0.50),
    lineHeight: 19,
    fontFamily: FF,
  },
  });
};

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
  if (status === 'active') {
    return (
      <View style={s.indicatorActive}>
        <PulsingDot />
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { onScroll } = useTabBarVisibility();
  const healthData = useHealthData();
  const { recoveryScore, supportScore, lastLogAction, wearable, actuals, targets, profile, focuses } = healthData;
  const hkStore = useHealthKitStore();

  const personalizationStore = usePersonalizationStore();
  const logStore = useLogStore();
  const plan = personalizationStore.plan;
  const { openAiChat } = useUiStore();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [dismissedFlags, setDismissedFlags] = useState<string[]>([]);

  useFocusEffect(useCallback(() => {
    hkStore.fetchAll();
    personalizationStore.fetchAndRecompute();
    getDismissedFlags().then(setDismissedFlags);
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

  const recovGrad = recoveryScore != null ? recoveryGradient(recoveryScore) : { start: 'rgba(255,116,42,0.2)', end: 'rgba(255,116,42,0.1)' };
  const suppGrad  = supportGradient(supportScore);

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

  const today   = new Date();
  const isToday = sameDay(selectedDate, today);
  const isFuture = !isToday && selectedDate > today;

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
            <Pressable style={s.helpBtn} onPress={() => setShowHelp(true)} hitSlop={12}>
              <Ionicons name="help-circle-outline" size={26} color={colors.isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)'} />
            </Pressable>
          </View>
          <Text style={s.weekday}>{weekday}</Text>
          {plan && (
            <MedicationBanner
              glp1Type={profile.glp1Type ?? 'semaglutide'}
              doseMg={profile.doseMg ?? 0}
              medicationName={(logStore.injectionLogs[0] as any)?.medication_name ?? null}
              programWeek={plan.programWeek}
              startDate={profile.startDate ?? new Date().toISOString().split('T')[0]}
            />
          )}
          <Text style={[s.phaseLabel, phaseOverdue && { color: '#E53E3E' }, { marginTop: 6 }]}>{phaseLabel}</Text>
          {plan?.sideEffectIndex && plan.sideEffectIndex.level !== 'none' && (
            <SideEffectBadge index={plan.sideEffectIndex} />
          )}
          {isFuture && <Text style={s.futureNote}>No data yet — showing targets</Text>}
        </View>

        {/* ── Calendar dropdown overlay ── */}
        {calendarOpen && (
          <CalendarDropdown
            selectedDate={selectedDate}
            onSelect={(d) => { setSelectedDate(d); setCalendarOpen(false); }}
            top={headerHeight}
          />
        )}

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >

          {/* ── Score Card ── */}
          <View style={[s.cardWrap, { marginBottom: 16 }]}>
            <View style={[s.cardBody, { backgroundColor: colors.surface }]}>
              {/* ── Ring + Info panel section ── */}
              <View style={{ height: 220 }}>
                {/* Concentric rings anchored to bottom-left corner */}
                <View style={s.ringsWrap} pointerEvents="none">
                  <DualRingArc recoveryScore={recoveryScore} supportScore={supportScore} />
                </View>

                {/* Info panel — right side */}
                <View style={s.infoPanel}>
                  <Pressable style={s.infoRow} onPress={() => router.push('/score-detail?type=recovery')}>
                    <View style={s.infoLabelRow}>
                      <View style={[s.infoDot, { backgroundColor: '#FF742A' }]} />
                      <Text style={s.infoLabel}>READINESS</Text>
                    </View>
                    <View style={s.infoScoreRow}>
                      {recoveryScore != null ? (
                        <>
                          <Text style={s.infoScore}>{recoveryScore}</Text>
                          <Text style={s.infoDenom}>/100</Text>
                        </>
                      ) : (
                        <Text style={[s.infoScore, { color: colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)', fontSize: 36 }]}>—</Text>
                      )}
                    </View>
                  </Pressable>

                  <View style={s.infoDiv} />

                  <Pressable style={s.infoRow} onPress={() => router.push('/score-detail?type=routine')}>
                    <View style={s.infoLabelRow}>
                      <View style={[s.infoDot, { backgroundColor: colors.textPrimary }]} />
                      <Text style={s.infoLabel}>ROUTINE</Text>
                    </View>
                    <View style={s.infoScoreRow}>
                      <Text style={s.infoScore}>{plan?.adherenceScore ?? supportScore}</Text>
                      <Text style={s.infoDenom}>/100</Text>
                    </View>
                  </Pressable>
                </View>
              </View>


            </View>
          </View>

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

            // Pending first, completed last
            const sortedCards = [...unlockedCards].sort((a, b) => {
              const aDone = a.lastLoggedAt != null && daysSinceDate(a.lastLoggedAt) <= 6;
              const bDone = b.lastLoggedAt != null && daysSinceDate(b.lastLoggedAt) <= 6;
              return Number(aDone) - Number(bDone);
            });

            const pendingCount = unlockedCards.filter(c =>
              c.lastLoggedAt == null || daysSinceDate(c.lastLoggedAt) > 6,
            ).length;

            if (unlockedCards.length === 0) return null;

            return (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Text style={[s.sectionTitle, { marginBottom: 0 }]}>Weekly Check-Ins</Text>
                  {pendingCount > 0 && (
                    <View style={s.pendingBadge}>
                      <Text style={s.pendingBadgeText}>{pendingCount} pending</Text>
                    </View>
                  )}
                </View>
                <FlatList
                  data={sortedCards}
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

          {/* ── Today's Focuses ── */}
          <View style={s.focusCard}>
            <View style={s.focusCardInner}>
              {/* Header */}
              <View style={s.focusCardHeader}>
                <Text style={[s.sectionTitle, { marginBottom: 0 }]}>Today's Focuses</Text>
                <View style={s.focusCountBadge}>
                  <Text style={s.focusCountText}>{(focuses ?? []).length} Tasks</Text>
                </View>
              </View>

              {/* Timeline items — tap any to open AI chat with context */}
              {(focuses ?? []).map((item, index) => {
                const isLast = index === (focuses ?? []).length - 1;
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
                    {/* Right: label + subtitle + badge */}
                    <View style={[s.focusContent, !isLast && s.focusContentSpaced]}>
                      <Text style={[s.focusLabel, item.status === 'pending' && s.focusLabelMuted]}>
                        {item.label}
                      </Text>
                      <Text style={s.focusSubtitle}>{item.subtitle}</Text>
                      <View style={s.badge}>
                        <Text style={s.badgeText}>{item.badge}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

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
              const hkRhr   = hkStore.restingHR;
              const hkHrv   = hkStore.hrv;
              const hkSleep = hkStore.sleepHours;
              const rhrVal  = hkRhr   ?? wearable.restingHR ?? 62;
              const hrvVal  = hkHrv   ?? wearable.hrvMs ?? 45;
              const sleepMin = hkSleep != null ? Math.round(hkSleep * 60) : (wearable.sleepMinutes ?? 0);

              const metrics: HealthMetric[] = [
                {
                  id: 'rrr', label: 'Resp. Rate',
                  value: wearable.respRateRpm != null ? String(wearable.respRateRpm) : (hkRhr != null || hkHrv != null ? '—' : '16'),
                  unit: 'bpm', status: 'normal', iconSet: 'MaterialIcons', iconName: 'air', rangeLabel: 'Normal',
                },
                {
                  id: 'rhr', label: 'Resting HR', value: String(rhrVal), unit: 'bpm',
                  status: hmRhrStatus(rhrVal), iconSet: 'Ionicons', iconName: 'heart-outline',
                  rangeLabel: hmRhrLabel(rhrVal) + (hkRhr != null ? ' ·  ' : ''),
                },
                {
                  id: 'hrv', label: 'HRV', value: String(hrvVal), unit: 'ms',
                  status: hmHrvStatus(hrvVal), iconSet: 'MaterialIcons', iconName: 'show-chart',
                  rangeLabel: hmHrvLabel(hrvVal) + (hkHrv != null ? ' ·  ' : ''),
                },
                {
                  id: 'spo2', label: 'SpO₂', value: String(wearable.spo2Pct ?? '—'), unit: wearable.spo2Pct != null ? '%' : '',
                  status: hmSpo2Status(wearable.spo2Pct ?? 98), iconSet: 'MaterialIcons', iconName: 'bloodtype',
                  rangeLabel: 'Normal',
                },
                {
                  id: 'temp', label: 'Temp', value: '98.4', unit: '°F', status: 'normal',
                  iconSet: 'MaterialIcons', iconName: 'thermostat', rangeLabel: 'Normal',
                },
                {
                  id: 'sleep', label: 'Sleep',
                  value: fmtSleep(sleepMin),
                  unit: '', status: hmSleepStatus(sleepMin), iconSet: 'Ionicons', iconName: 'moon-outline',
                  rangeLabel: hmSleepLabel(sleepMin) + (hkSleep != null ? ' ·  ' : ''),
                },
              ];

              if (hkStore.bloodGlucose != null) {
                metrics.push({
                  id: 'glucose', label: 'Blood Glucose', value: String(hkStore.bloodGlucose), unit: 'mg/dL',
                  status: hkStore.bloodGlucose < 100 ? 'good' : hkStore.bloodGlucose < 125 ? 'normal' : 'elevated',
                  iconSet: 'MaterialIcons', iconName: 'water-drop',
                  rangeLabel: hkStore.bloodGlucose < 100 ? 'Normal' : hkStore.bloodGlucose < 125 ? 'Pre-range' : 'High',
                });
              }

              return metrics;
            })().map(m => <HealthMonitorCard key={m.id} metric={m} />)}
          </View>

        </ScrollView>

        {/* ── Rings Explainer Modal ── */}
        {showHelp && <RingsExplainerModal onClose={() => setShowHelp(false)} />}

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
  helpBtn: { padding: 2 },
  dateTitle: { fontSize: 26, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },
  weekday: { fontSize: 13, fontWeight: '500', color: c.textMuted, marginBottom: 4, fontFamily: 'Helvetica Neue' },
  phaseLabel: { fontSize: 13, fontWeight: '600', color: c.textSecondary, fontFamily: 'Helvetica Neue' },
  futureNote: { fontSize: 11, color: '#FF742A', marginTop: 4, fontWeight: '600', fontFamily: 'Helvetica Neue' },
  connectHealthKit: { fontSize: 12, color: 'rgba(255,116,42,0.7)', fontWeight: '500', marginTop: 4, textDecorationLine: 'underline', fontFamily: 'Helvetica Neue' },

  // Glass card containers
  cardWrap: { borderRadius: 28, ...glassShadow },
  cardBody: { borderRadius: 28, overflow: 'hidden', borderWidth: 0.5, borderColor: c.border },

  // Dark overlay
  darkOverlay: { borderRadius: 28, backgroundColor: c.glassOverlay },

  // Score card inner
  scoreCard: { padding: 24 },
  scoreCardTitle: { fontSize: 13, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.3, textAlign: 'center', marginBottom: 18, fontFamily: 'Helvetica Neue' },

  // Alert badge
  alertBadge: {
    marginTop: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(229,62,62,0.10)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(229,62,62,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  alertText: { fontSize: 12, fontWeight: '700', color: '#E53E3E', fontFamily: 'Helvetica Neue' },

  // Dual ring arc card
  ringsWrap: {
    position: 'absolute',
    bottom: -250,
    left: -250,
  },
  infoPanel: {
    position: 'absolute',
    right: 16,
    top: 16,
    bottom: 16,
    width: '44%',
    backgroundColor: c.bg,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: w(0.25),
    justifyContent: 'center',
    paddingVertical: 8,
  },
  infoRow: {
    flexDirection: 'column',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  infoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoDot: { width: 8, height: 8, borderRadius: 4 },
  infoText: { flex: 1 },
  infoLabel: {
    fontSize: 11, fontWeight: '700', color: w(0.45),
    letterSpacing: 1.4, fontFamily: 'Helvetica Neue',
  },
  infoScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  infoScore: { fontSize: 36, fontWeight: '700', color: c.textPrimary, letterSpacing: -1, fontFamily: 'Helvetica Neue' },
  infoDenom: { fontSize: 20, fontWeight: '400', color: w(0.55), fontFamily: 'Helvetica Neue' },
  infoMsg: { fontSize: 10, fontWeight: '600', marginTop: 3, fontFamily: 'Helvetica Neue' },
  infoHint: { fontSize: 10, color: w(0.35), marginTop: 3, fontFamily: 'Helvetica Neue', lineHeight: 14 },
  infoDiv: {
    height: 0.5,
    backgroundColor: w(0.15),
    marginHorizontal: 14,
  },

  // Stats row
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statItemText: {},
  statBold: { fontSize: 14, fontWeight: '800', color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  statLight: { fontSize: 12, color: c.textMuted, fontWeight: '400', fontFamily: 'Helvetica Neue' },
  statDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#3A3735' },

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
  focusSubtitle: { fontSize: 12, fontWeight: '400', color: w(0.45), marginTop: 3, lineHeight: 17, fontFamily: 'Helvetica Neue' },
  indicatorFilled: { width: 24, height: 24, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  indicatorActive: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  indicatorEmpty: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: w(0.35) },
  pulsingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  timelineLine: { position: 'absolute', top: 28, bottom: 0, left: 11, width: 2 },
  badge: {
    backgroundColor: 'rgba(50,168,82,0.12)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(50,168,82,0.25)',
    alignSelf: 'flex-start', marginTop: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#2B9450', fontFamily: 'Helvetica Neue' },

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
});
