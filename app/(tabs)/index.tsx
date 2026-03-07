import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { GlassBorder } from '@/components/ui/glass-border';
import { useHealthData } from '@/contexts/health-data';
import {
  daysSinceInjection,
  generateInsights,
  recoveryGradient,
  recoveryMessage,
  supportGradient,
  supportMessage,
} from '@/constants/scoring';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';
import { generateDynamicInsights } from '@/lib/openai';

const ORANGE = '#FF742A';

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

const HEALTH_DATA: HealthMetric[] = [
  { id: 'rrr',   label: 'Resp. Rate', value: '16',    unit: 'bpm', status: 'normal',   iconSet: 'MaterialIcons', iconName: 'air',           rangeLabel: 'Normal' },
  { id: 'rhr',   label: 'Resting HR', value: '58',    unit: 'bpm', status: 'good',     iconSet: 'Ionicons',      iconName: 'heart-outline',  rangeLabel: 'Optimal' },
  { id: 'hrv',   label: 'HRV',        value: '45',    unit: 'ms',  status: 'good',     iconSet: 'MaterialIcons', iconName: 'show-chart',    rangeLabel: 'Strong' },
  { id: 'spo2',  label: 'SpO₂',       value: '98',    unit: '%',   status: 'normal',   iconSet: 'MaterialIcons', iconName: 'bloodtype',     rangeLabel: 'Normal' },
  { id: 'temp',  label: 'Temp',        value: '98.4', unit: '°F',  status: 'normal',   iconSet: 'MaterialIcons', iconName: 'thermostat',    rangeLabel: 'Normal' },
  { id: 'sleep', label: 'Sleep',       value: '7h 23m', unit: '',  status: 'low',      iconSet: 'Ionicons',      iconName: 'moon-outline',  rangeLabel: 'Below Goal' },
];

const hmStatusStyle: Record<HMStatus, { bg: string; text: string }> = {
  good:     { bg: 'rgba(39,174,96,0.15)',   text: '#27AE60' },
  normal:   { bg: 'rgba(91,139,245,0.15)',  text: '#7BA3F7' },
  low:      { bg: 'rgba(243,156,18,0.15)',  text: '#F39C12' },
  elevated: { bg: 'rgba(231,76,60,0.15)',   text: '#E74C3C' },
};

// ─── Health Monitor Card ──────────────────────────────────────────────────────

function HealthMonitorCard({ metric }: { metric: HealthMetric }) {
  const ss = hmStatusStyle[metric.status];
  const icon = metric.iconSet === 'Ionicons'
    ? <Ionicons name={metric.iconName as any} size={20} color={ORANGE} />
    : <MaterialIcons name={metric.iconName as any} size={20} color={ORANGE} />;

  return (
    <View style={[s.hmWrap, glassShadow]}>
      <View style={[s.hmBody, { borderRadius: 20, backgroundColor: '#000000' }]}>
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
    </View>
  );
}

// ─── Dual Ring Arc ────────────────────────────────────────────────────────────

type DualRingArcProps = {
  recoveryScore: number;
  supportScore: number;
};

function DualRingArc({ recoveryScore, supportScore }: DualRingArcProps) {
  const SVG_SIZE = 500;
  const cx = 250, cy = 250;
  const OUTER_R = 200, INNER_R = 148, SW = 38;
  const outerCirc = 2 * Math.PI * OUTER_R;
  const innerCirc = 2 * Math.PI * INNER_R;
  const outerQuart = outerCirc / 4;
  const innerQuart = innerCirc / 4;

  const outerOffset = useSharedValue(outerQuart);
  const innerOffset = useSharedValue(innerQuart);

  useEffect(() => {
    outerOffset.value = withTiming(outerQuart * (1 - recoveryScore / 100), {
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
      <Circle cx={cx} cy={cy} r={OUTER_R} strokeWidth={SW} stroke="#FF742A" fill="none" opacity={0.15} />
      <Circle cx={cx} cy={cy} r={INNER_R} strokeWidth={SW} stroke="#FFFFFF" fill="none" opacity={0.15} />
      <AnimatedCircle
        cx={cx} cy={cy} r={OUTER_R} fill="none"
        stroke="#FF742A" strokeWidth={SW} strokeLinecap="round"
        strokeDasharray={outerQuart} animatedProps={outerProps}
        rotation="-90" origin={`${cx}, ${cy}`}
      />
      <AnimatedCircle
        cx={cx} cy={cy} r={INNER_R} fill="none"
        stroke="#FFFFFF" strokeWidth={SW} strokeLinecap="round"
        strokeDasharray={innerQuart} animatedProps={innerProps}
        rotation="-90" origin={`${cx}, ${cy}`}
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
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
      <GlassBorder r={20} />
      <View style={cal.inner}>
        {/* Month nav */}
        <View style={cal.monthRow}>
          <Pressable onPress={prevMonth} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={cal.monthLabel}>{monthLabel}</Text>
          <Pressable onPress={nextMonth} hitSlop={10}>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
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

const FF = 'Helvetica Neue';

function RingsExplainerModal({ onClose }: { onClose: () => void }) {
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
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={em.scrollContent}>

            {/* Recovery Ring */}
            <View style={em.section}>
              <View style={em.sectionHeader}>
                <View style={[em.dot, { backgroundColor: '#FF742A' }]} />
                <Text style={em.sectionTitle}>Recovery Ring (Orange)</Text>
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
                <View style={[em.dot, { backgroundColor: '#FFFFFF' }]} />
                <Text style={em.sectionTitle}>Readiness Ring (White)</Text>
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

const em = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    maxHeight: '88%',
    paddingBottom: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    fontFamily: FF,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    color: '#FFFFFF',
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
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 19,
    fontFamily: FF,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 20,
  },
  phaseList: { gap: 0 },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  phaseEmoji: { fontSize: 20, lineHeight: 26 },
  phaseName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
    fontFamily: FF,
  },
  phaseDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.50)',
    lineHeight: 19,
    fontFamily: FF,
  },
});

// ─── Focus Timeline Sub-components ───────────────────────────────────────────

function PulsingDot() {
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
  if (status === 'completed') {
    return <View style={[s.timelineLine, { backgroundColor: ORANGE }]} />;
  }
  if (status === 'active') {
    return <View style={[s.timelineLine, { borderLeftWidth: 2, borderStyle: 'dashed', borderLeftColor: ORANGE }]} />;
  }
  return <View style={[s.timelineLine, { borderLeftWidth: 2, borderStyle: 'dashed', borderLeftColor: 'rgba(255,255,255,0.15)' }]} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { onScroll } = useTabBarVisibility();
  const healthData = useHealthData();
  const { recoveryScore, supportScore, lastLogAction, wearable, actuals, targets, profile, focuses } = healthData;

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const recovGrad = recoveryGradient(recoveryScore);
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
  const phaseLabel = (() => {
    if (dayNum === 1) return 'Shot Day';
    if (dayNum <= 3) return `Shot Phase · Day ${dayNum}`;
    if (dayNum < freq) return `Recovery · Day ${dayNum}`;
    if (dayNum === freq) return 'Shot Day Tomorrow';
    return 'Shot Overdue';
  })();
  const phaseOverdue = dayNum > freq;

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
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
                color="#FFFFFF"
                style={{ marginLeft: 6, marginTop: 2 }}
              />
            </Pressable>
            <Pressable style={s.helpBtn} onPress={() => setShowHelp(true)} hitSlop={12}>
              <Ionicons name="help-circle-outline" size={26} color="rgba(255,255,255,0.55)" />
            </Pressable>
          </View>
          <Text style={s.weekday}>{weekday}</Text>
          <Text style={[s.phaseLabel, phaseOverdue && { color: '#E53E3E' }]}>{phaseLabel}</Text>
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
            <View style={[s.cardBody, { backgroundColor: '#000000' }]}>
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
                      <Text style={s.infoLabel}>RECOVERY</Text>
                    </View>
                    <View style={s.infoScoreRow}>
                      <Text style={s.infoScore}>{recoveryScore}</Text>
                      <Text style={s.infoDenom}>/100</Text>
                    </View>
                  </Pressable>

                  <View style={s.infoDiv} />

                  <Pressable style={s.infoRow} onPress={() => router.push('/score-detail?type=support')}>
                    <View style={s.infoLabelRow}>
                      <View style={[s.infoDot, { backgroundColor: '#FFFFFF' }]} />
                      <Text style={s.infoLabel}>READINESS</Text>
                    </View>
                    <View style={s.infoScoreRow}>
                      <Text style={s.infoScore}>{supportScore}</Text>
                      <Text style={s.infoDenom}>/100</Text>
                    </View>
                  </Pressable>
                </View>
              </View>


            </View>
          </View>

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

              {/* Timeline items */}
              {(focuses ?? []).map((item, index) => {
                const isLast = index === (focuses ?? []).length - 1;
                return (
                  <View key={item.id} style={s.focusTimelineItem}>
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
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Insights Card ── */}
          <View style={[s.cardWrap, { marginBottom: 24, marginTop: 8 }]}>
            <View style={[s.cardBody, { backgroundColor: '#000000' }]}>
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
                        <View style={{ height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.08)', flex: 1, maxWidth: `${w * 100}%` as any }} />
                      </View>
                    ))}
                  </>
                ) : aiInsights ? (
                  aiInsights.map((text, i) => (
                    <View key={i} style={s.bulletRow}>
                      <View style={[s.bullet, { backgroundColor: ORANGE }]} />
                      <Text style={s.bulletText}>{text}</Text>
                    </View>
                  ))
                ) : (
                  staticInsights.map((b, i) => (
                    <View key={i} style={s.bulletRow}>
                      <View style={[s.bullet, { backgroundColor: ORANGE }]} />
                      <Text style={s.bulletText}>{b.text}</Text>
                    </View>
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
            {HEALTH_DATA.map(m => <HealthMonitorCard key={m.id} metric={m} />)}
          </View>

        </ScrollView>

        {/* ── Rings Explainer Modal ── */}
        {showHelp && <RingsExplainerModal onClose={() => setShowHelp(false)} />}

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 },

  // Fixed header
  headerArea: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  dateTitleRow: { flexDirection: 'row', alignItems: 'center' },
  helpBtn: { padding: 2 },
  dateTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },
  weekday: { fontSize: 13, fontWeight: '500', color: '#7A7570', marginBottom: 4, fontFamily: 'Helvetica Neue' },
  phaseLabel: { fontSize: 13, fontWeight: '600', color: '#9A9490', fontFamily: 'Helvetica Neue' },
  futureNote: { fontSize: 11, color: '#FF742A', marginTop: 4, fontWeight: '600', fontFamily: 'Helvetica Neue' },

  // Glass card containers
  cardWrap: { borderRadius: 28, ...glassShadow },
  cardBody: { borderRadius: 28, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)' },

  // Dark overlay
  darkOverlay: { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.04)' },

  // Score card inner
  scoreCard: { padding: 24 },
  scoreCardTitle: { fontSize: 13, fontWeight: '600', color: '#9A9490', letterSpacing: 0.3, textAlign: 'center', marginBottom: 18, fontFamily: 'Helvetica Neue' },

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
    width: '52%',
    backgroundColor: '#000000',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  infoRow: {
    flexDirection: 'column',
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.4, fontFamily: 'Helvetica Neue',
  },
  infoScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  infoScore: { fontSize: 42, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1, fontFamily: 'Helvetica Neue' },
  infoDenom: { fontSize: 20, fontWeight: '400', color: 'rgba(255,255,255,0.55)', fontFamily: 'Helvetica Neue' },
  infoMsg: { fontSize: 10, fontWeight: '600', marginTop: 3, fontFamily: 'Helvetica Neue' },
  infoDiv: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 14,
  },

  // Stats row
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statItemText: {},
  statBold: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', fontFamily: 'Helvetica Neue' },
  statLight: { fontSize: 12, color: '#5A5754', fontWeight: '400', fontFamily: 'Helvetica Neue' },
  statDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#3A3735' },

  // Insights card
  insightsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  insightsTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Helvetica Neue' },
  shotPhase: { fontSize: 10, fontWeight: '700', color: ORANGE, letterSpacing: 1.2, fontFamily: 'Helvetica Neue' },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bullet: { width: 7, height: 7, borderRadius: 3.5, marginRight: 10 },
  bulletText: { fontSize: 15, color: 'rgba(255,255,255,0.75)', fontWeight: '400', flex: 1, fontFamily: 'Helvetica Neue' },
  insightsFooter: { fontSize: 12, color: 'rgba(255,255,255,0.40)', fontWeight: '500', marginTop: 6, lineHeight: 18, fontFamily: 'Helvetica Neue' },

  // Section title
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 14, fontFamily: 'Helvetica Neue' },

  // Focus timeline card
  focusCard: { borderRadius: 28, ...glassShadow, marginBottom: 24, marginTop: 8 },
  focusCardInner: { borderRadius: 28, overflow: 'hidden', backgroundColor: '#000000', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)', padding: 22 },
  focusCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  focusCountBadge: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  focusCountText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Helvetica Neue' },
  focusTimelineItem: { flexDirection: 'row', alignItems: 'flex-start' },
  focusIndicatorCol: { width: 24, alignItems: 'center', marginRight: 16 },
  focusContent: { flex: 1 },
  focusContentSpaced: { paddingBottom: 28 },
  focusLabel: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Helvetica Neue' },
  focusLabelMuted: { color: 'rgba(255,255,255,0.45)' },
  focusSubtitle: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 17, fontFamily: 'Helvetica Neue' },
  indicatorFilled: { width: 24, height: 24, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  indicatorActive: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  indicatorEmpty: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  pulsingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  timelineLine: { position: 'absolute', top: 28, bottom: 0, left: 11, width: 2 },
  badge: {
    backgroundColor: 'rgba(50,168,82,0.12)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(50,168,82,0.25)',
    alignSelf: 'flex-start', marginTop: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#2B9450', fontFamily: 'Helvetica Neue' },

  // Health Monitor grid
  hmGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  hmWrap: { width: '47.5%', borderRadius: 20 },
  hmBody: { overflow: 'hidden' },
  hmInner: { padding: 16 },
  hmTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  hmIconWrap: { alignItems: 'center', justifyContent: 'center' },
  hmBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  hmBadgeText: { fontSize: 9, fontWeight: '700', fontFamily: 'Helvetica Neue' },
  hmLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '500', marginBottom: 3, fontFamily: 'Helvetica Neue' },
  hmValue: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },
  hmUnit: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.45)', letterSpacing: 0, fontFamily: 'Helvetica Neue' },
  hmBody: { overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)' },
});

const cal = StyleSheet.create({
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
  monthLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Helvetica Neue' },
  weekRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dayHeader:  { width: 36, textAlign: 'center', fontSize: 10, fontWeight: '600', color: '#5A5754', fontFamily: 'Helvetica Neue' },
  cell:       { width: 36, height: 42, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 3 },
  dayCircle:  { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: '#FF742A' },
  dayNum:     { fontSize: 14, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Helvetica Neue' },
  dayNumSel:  { fontWeight: '800' },
  dayFuture:  { opacity: 0.45 },
  todayDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FF742A', marginTop: 2 },
});
