import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { LayoutAnimation, LayoutChangeEvent, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';

const TERRACOTTA = '#D67455';
const DARK = '#1A1A1A';
const BG = '#F0EAE4';

const glassShadow = {
  shadowColor: '#1A1A1A',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
  elevation: 8,
};

type Tab = 'medication' | 'lifestyle' | 'progress';

// ─── Glass border ─────────────────────────────────────────────────────────────

function GlassBorder({ r = 24 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: r, borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.80)',
        borderLeftColor: 'rgba(255,255,255,0.55)',
        borderRightColor: 'rgba(255,255,255,0.18)',
        borderBottomColor: 'rgba(255,255,255,0.10)',
      }}
    />
  );
}

// ─── Segmented control ────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'medication', label: 'Medication' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'progress', label: 'Progress' },
];

function SegmentedControl({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <View style={sc.wrap}>
      <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, sc.overlay]} />
      <GlassBorder r={36} />
      <View style={sc.row}>
        {TABS.map(({ key, label }) => {
          const isActive = active === key;
          return (
            <TouchableOpacity
              key={key}
              style={[sc.tab, isActive && sc.tabActive]}
              onPress={() => onChange(key)}
              activeOpacity={0.7}
            >
              {isActive && (
                <>
                  <BlurView intensity={60} tint="light" style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]} />
                  <View style={[StyleSheet.absoluteFillObject, sc.tabActiveOverlay]} />
                </>
              )}
              <Text style={[sc.tabLabel, isActive && sc.tabLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  wrap: {
    borderRadius: 36, overflow: 'hidden', marginBottom: 24,
    shadowColor: '#1A1A1A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 6,
  },
  overlay: { borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.30)' },
  row: { flexDirection: 'row', padding: 5 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 28, overflow: 'hidden' },
  tabActive: {},
  tabActiveOverlay: { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.50)' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#AAAAAA' },
  tabLabelActive: { color: TERRACOTTA, fontWeight: '700' },
});

// ─── Ring indicator ───────────────────────────────────────────────────────────

function RingIndicator({ size = 88, strokeWidth = 7, color = TERRACOTTA }: { size?: number; strokeWidth?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Track */}
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, borderWidth: strokeWidth, borderColor: 'rgba(0,0,0,0.06)',
      }} />
      {/* Progress ring */}
      <View style={{
        position: 'absolute',
        width: size - strokeWidth * 2 + 4, height: size - strokeWidth * 2 + 4,
        borderRadius: (size - strokeWidth * 2 + 4) / 2,
        borderWidth: strokeWidth, borderColor: color,
      }} />
    </View>
  );
}

// ─── AI Insights card ─────────────────────────────────────────────────────────

function AIInsightsCard() {
  return (
    <View style={[s.cardWrap, { marginBottom: 16 }]}>
      <View style={[s.cardBody, { borderRadius: 24 }]}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
        <GlassBorder r={24} />
        <View style={s.aiAccent} />
        <View style={s.aiContent}>
          <View style={s.aiHeader}>
            <MaterialIcons name="auto-awesome" size={16} color={TERRACOTTA} />
            <Text style={s.aiLabel}>AI INSIGHTS</Text>
          </View>
          <Text style={s.aiBody}>
            You have a{' '}
            <Text style={{ fontWeight: '700', color: DARK }}>protein and hydration deficit</Text>
            {' '}today. Try to increase your intake to reach your daily goal.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Metric card (Calories / Steps) ──────────────────────────────────────────

function MetricCard({ value, label, ringColor }: { value: string; label: string; ringColor: string }) {
  return (
    <View style={[s.metricWrap, glassShadow]}>
      <View style={[s.cardBody, { borderRadius: 22 }]}>
        <BlurView intensity={65} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
        <GlassBorder r={22} />
        <View style={s.metricInner}>
          <View style={s.ringWrap}>
            <RingIndicator color={ringColor} />
            <View style={s.ringCenter}>
              <Text style={[s.metricValue, { color: ringColor }]}>{value}</Text>
            </View>
          </View>
          <Text style={s.metricLabel}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Daily metric card (2×2 grid) ────────────────────────────────────────────

type Status = 'positive' | 'negative' | 'neutral';

type LogEntry = {
  id: string;
  timestamp: string;
  title: string;
  details: string;
  impact: string;
  impactStatus: Status;
  icon: React.ReactElement;
};

const statusStyle: Record<Status, { bg: string; text: string }> = {
  positive: { bg: 'rgba(43,148,80,0.12)', text: '#2B9450' },
  negative: { bg: 'rgba(220,50,50,0.10)', text: '#DC3232' },
  neutral: { bg: 'rgba(150,150,150,0.10)', text: '#888888' },
};

function DailyMetricCard({
  icon, label, value, change, status,
}: {
  icon: React.ReactNode; label: string; value: string; change: string; status: Status;
}) {
  const ss = statusStyle[status];
  return (
    <View style={[s.dailyWrap, glassShadow]}>
      <View style={[s.cardBody, { borderRadius: 20 }]}>
        <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
        <GlassBorder r={20} />
        <View style={s.dailyInner}>
          <View style={s.dailyTopRow}>
            <View style={s.dailyIconWrap}>{icon}</View>
            <View style={[s.changeBadge, { backgroundColor: ss.bg }]}>
              <Text style={[s.changeText, { color: ss.text }]}>{change}</Text>
            </View>
          </View>
          <Text style={s.dailyLabel}>{label}</Text>
          <Text style={s.dailyValue}>{value}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Med AI Insights card ─────────────────────────────────────────────────────

function MedAIInsightsCard() {
  return (
    <View style={[s.cardWrap, { marginBottom: 16 }]}>
      <View style={[s.cardBody, { borderRadius: 24 }]}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
        <GlassBorder r={24} />
        <View style={s.aiAccent} />
        <View style={s.aiContent}>
          <View style={s.aiHeader}>
            <MaterialIcons name="auto-awesome" size={16} color={TERRACOTTA} />
            <Text style={s.aiLabel}>AI INSIGHTS</Text>
          </View>
          <Text style={s.aiBody}>
            Your medication levels are stable. Adherence is at{' '}
            <Text style={{ fontWeight: '700', color: TERRACOTTA }}>98%</Text>
            {' '}this month. Your metabolic response is in the optimal range.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Medication Level Chart card ──────────────────────────────────────────────

const CHART_DATA = [35, 72, 88, 78, 65, 50, 42];
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const CHART_HEIGHT = 110;

function MedLevelChartCard() {
  const [chartWidth, setChartWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  };

  const n = CHART_DATA.length;
  const colW = chartWidth > 0 ? chartWidth / n : 0;

  // Map data values (0–100) to y positions (top = low value, so invert)
  const points = CHART_DATA.map((v, i) => ({
    x: colW * i + colW / 2,
    y: CHART_HEIGHT - (v / 100) * CHART_HEIGHT,
  }));

  return (
    <View style={[s.cardWrap, { marginBottom: 16 }]}>
      <View style={[s.cardBody, { borderRadius: 24 }]}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
        <GlassBorder r={24} />
        <View style={{ padding: 18 }}>
          <Text style={s.chartMuted}>Medication Level in Body</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 2, gap: 10 }}>
            <Text style={s.chartBig}>Optimal</Text>
            <View style={s.inRangeBadge}>
              <Text style={s.inRangeText}>In Range</Text>
            </View>
          </View>
          <Text style={[s.chartMuted, { marginBottom: 14 }]}>Since last injection: 4 days ago</Text>

          {/* Chart area */}
          <View style={{ height: CHART_HEIGHT }} onLayout={onLayout}>
            {chartWidth > 0 && (
              <>
                {/* Area fill columns */}
                {points.map((pt, i) => (
                  <View
                    key={`area-${i}`}
                    style={{
                      position: 'absolute',
                      left: colW * i,
                      width: colW,
                      top: pt.y,
                      bottom: 0,
                      backgroundColor: 'rgba(214,116,85,0.10)',
                    }}
                  />
                ))}

                {/* Line segments */}
                {points.slice(0, -1).map((pt, i) => {
                  const next = points[i + 1];
                  const dx = next.x - pt.x;
                  const dy = next.y - pt.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  const midX = (pt.x + next.x) / 2;
                  const midY = (pt.y + next.y) / 2;
                  return (
                    <View
                      key={`line-${i}`}
                      style={{
                        position: 'absolute',
                        width: length,
                        height: 2.5,
                        backgroundColor: TERRACOTTA,
                        left: midX - length / 2,
                        top: midY - 1.25,
                        transform: [{ rotate: `${angle}deg` }],
                        borderRadius: 2,
                      }}
                    />
                  );
                })}

                {/* Dots */}
                {points.map((pt, i) => (
                  <View
                    key={`dot-${i}`}
                    style={{
                      position: 'absolute',
                      width: 8, height: 8, borderRadius: 4,
                      backgroundColor: TERRACOTTA,
                      left: pt.x - 4, top: pt.y - 4,
                    }}
                  />
                ))}
              </>
            )}
          </View>

          {/* Day labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={s.dayLabel}>{d}</Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Injection info card ───────────────────────────────────────────────────────

function InjectionCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={[s.dailyWrap, glassShadow]}>
      <View style={[s.cardBody, { borderRadius: 20 }]}>
        <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
        <GlassBorder r={20} />
        <View style={s.dailyInner}>
          <View style={[s.dailyTopRow, { marginBottom: 10 }]}>
            <View style={s.dailyIconWrap}>{icon}</View>
          </View>
          <Text style={s.dailyLabel}>{label}</Text>
          <Text style={s.dailyValue}>{value}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Weight chart constants ───────────────────────────────────────────────────

const WEIGHT_CHART_HEIGHT = 130;
const WEIGHT_DATASETS: Record<string, number[]> = {
  '7D':  [199, 198, 197, 197, 196, 195, 195],
  '30D': [205, 203, 202, 200, 199, 198, 197, 196, 196, 195, 195, 195],
  '90D': [215, 212, 210, 207, 205, 203, 201, 199, 197, 196, 195, 195],
  '1Y':  [220, 216, 212, 209, 206, 204, 202, 200, 198, 197, 196, 195],
};
const PERIOD_SUBTITLES: Record<string, string> = {
  '7D': 'Last 7 days', '30D': 'Last 30 days', '90D': 'Last 3 months', '1Y': 'Last year',
};

// ─── Recent Logs mock data ────────────────────────────────────────────────────

const LIFESTYLE_LOGS: LogEntry[] = [
  {
    id: 'ls1', timestamp: 'Today, 12:34 PM', title: 'Cheeseburger',
    details: '520 cal · 28g protein · 2g fiber · 40g carbs',
    impact: 'Updated Protein +28g, Carbs +40g, Fiber +2g', impactStatus: 'positive',
    icon: <MaterialIcons name="restaurant" size={18} color={TERRACOTTA} />,
  },
  {
    id: 'ls2', timestamp: 'Today, 8:15 AM', title: 'Greek Yogurt Bowl',
    details: '220 cal · 18g protein · 3g fiber · 22g carbs',
    impact: 'Updated Protein +18g, Fiber +3g', impactStatus: 'positive',
    icon: <MaterialIcons name="restaurant" size={18} color={TERRACOTTA} />,
  },
  {
    id: 'ls3', timestamp: 'Today, 7:00 AM', title: 'Morning Walk',
    details: '45 min · 3,200 steps · 180 cal burned',
    impact: 'Updated Daily Steps +3,200, Calories Burned +180', impactStatus: 'positive',
    icon: <MaterialIcons name="directions-run" size={18} color={TERRACOTTA} />,
  },
  {
    id: 'ls4', timestamp: 'Yesterday, 9:00 PM', title: 'Water Intake',
    details: '32 oz hydration logged',
    impact: 'Updated Hydration +32 oz — daily goal met', impactStatus: 'positive',
    icon: <Ionicons name="water-outline" size={18} color={TERRACOTTA} />,
  },
];

const MEDICATION_LOGS: LogEntry[] = [
  {
    id: 'med1', timestamp: 'Mar 1, 2026', title: 'Ozempic 0.5mg',
    details: 'Site: Left Abdomen · Dose: 0.5mg · Batch #2',
    impact: 'Next injection in 7 days — rotate to Right Thigh', impactStatus: 'neutral',
    icon: <FontAwesome5 name="syringe" size={16} color={TERRACOTTA} />,
  },
  {
    id: 'med2', timestamp: 'Feb 22, 2026', title: 'Ozempic 0.5mg',
    details: 'Site: Right Thigh · Dose: 0.5mg · Batch #2',
    impact: 'Adherence streak maintained — 98% this month', impactStatus: 'positive',
    icon: <FontAwesome5 name="syringe" size={16} color={TERRACOTTA} />,
  },
  {
    id: 'med3', timestamp: 'Feb 15, 2026', title: 'Ozempic 0.25mg',
    details: 'Site: Left Abdomen · Dose: 0.25mg · Batch #1',
    impact: 'Dose escalation recorded — moving to 0.5mg next cycle', impactStatus: 'neutral',
    icon: <FontAwesome5 name="syringe" size={16} color={TERRACOTTA} />,
  },
];

const PROGRESS_LOGS: LogEntry[] = [
  {
    id: 'pr1', timestamp: 'Today, 7:30 AM', title: 'Weight Log — 195 lbs',
    details: 'Down 1 lb from last entry · BMI 28.4',
    impact: 'Goal progress updated to 65% — 25 lbs total lost', impactStatus: 'positive',
    icon: <MaterialIcons name="fitness-center" size={18} color={TERRACOTTA} />,
  },
  {
    id: 'pr2', timestamp: 'Feb 26, 2026', title: 'Weight Log — 196 lbs',
    details: 'Down 0.5 lbs from last entry · BMI 28.5',
    impact: 'Goal progress updated to 63%', impactStatus: 'positive',
    icon: <MaterialIcons name="fitness-center" size={18} color={TERRACOTTA} />,
  },
  {
    id: 'pr3', timestamp: 'Feb 19, 2026', title: 'Weight Log — 197 lbs',
    details: 'Steady decline · BMI 28.7',
    impact: 'On pace for goal by June 2026', impactStatus: 'positive',
    icon: <MaterialIcons name="fitness-center" size={18} color={TERRACOTTA} />,
  },
];

// ─── Progress AI Insights card ────────────────────────────────────────────────

function ProgAIInsightsCard() {
  return (
    <View style={[s.cardWrap, { marginBottom: 16 }]}>
      <View style={[s.cardBody, { borderRadius: 24 }]}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
        <GlassBorder r={24} />
        <View style={s.aiAccent} />
        <View style={s.aiContent}>
          <View style={s.aiHeader}>
            <MaterialIcons name="auto-awesome" size={16} color={TERRACOTTA} />
            <Text style={s.aiLabel}>AI INSIGHTS</Text>
          </View>
          <Text style={s.aiBody}>
            {"You're on track to reach your goal by "}
            <Text style={{ fontWeight: '700', color: TERRACOTTA }}>June 2026</Text>
            {'. Your weight loss rate is steady and healthy.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Weight Journey chart card ────────────────────────────────────────────────

function WeightChartCard() {
  const [activePeriod, setActivePeriod] = useState<'7D' | '30D' | '90D' | '1Y'>('90D');
  const [chartWidth, setChartWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  const data = WEIGHT_DATASETS[activePeriod];
  const n = data.length;
  const colW = chartWidth > 0 ? chartWidth / n : 0;
  const minW = Math.min(...data);
  const maxW = Math.max(...data) + 5;
  const range = maxW - minW || 1;

  const toY = (v: number) => WEIGHT_CHART_HEIGHT - ((v - minW) / range) * WEIGHT_CHART_HEIGHT;
  const points = data.map((v, i) => ({ x: colW * i + colW / 2, y: toY(v) }));
  const lastPt = points[points.length - 1];

  const PERIODS = ['7D', '30D', '90D', '1Y'] as const;

  return (
    <View style={[s.cardWrap, { marginBottom: 16 }]}>
      <View style={[s.cardBody, { borderRadius: 24 }]}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
        <GlassBorder r={24} />
        <View style={{ padding: 18 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: DARK, letterSpacing: -0.5 }}>Weight Journey</Text>
              <Text style={s.chartMuted}>{PERIOD_SUBTITLES[activePeriod]}</Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: TERRACOTTA, letterSpacing: -1 }}>195 lbs</Text>
          </View>

          {/* Period toggle */}
          <View style={s.progPeriodRow}>
            {PERIODS.map((p) => {
              const isActive = activePeriod === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[s.progPeriodBtn, isActive && s.progPeriodBtnActive]}
                  onPress={() => setActivePeriod(p)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.progPeriodLabel, isActive && s.progPeriodLabelActive]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Chart area */}
          <View style={{ height: WEIGHT_CHART_HEIGHT }} onLayout={onLayout}>
            {chartWidth > 0 && (
              <>
                {/* Area fill columns */}
                {points.map((pt, i) => (
                  <View
                    key={`wa-${i}`}
                    style={{
                      position: 'absolute', left: colW * i, width: colW,
                      top: pt.y, bottom: 0,
                      backgroundColor: 'rgba(214,116,85,0.10)',
                    }}
                  />
                ))}

                {/* Line segments */}
                {points.slice(0, -1).map((pt, i) => {
                  const next = points[i + 1];
                  const dx = next.x - pt.x;
                  const dy = next.y - pt.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  const midX = (pt.x + next.x) / 2;
                  const midY = (pt.y + next.y) / 2;
                  return (
                    <View
                      key={`wl-${i}`}
                      style={{
                        position: 'absolute', width: length, height: 2.5,
                        backgroundColor: TERRACOTTA,
                        left: midX - length / 2, top: midY - 1.25,
                        transform: [{ rotate: `${angle}deg` }],
                        borderRadius: 2,
                      }}
                    />
                  );
                })}

                {/* Regular dots (all except last) */}
                {points.slice(0, -1).map((pt, i) => (
                  <View
                    key={`wd-${i}`}
                    style={{
                      position: 'absolute', width: 8, height: 8, borderRadius: 4,
                      backgroundColor: TERRACOTTA, left: pt.x - 4, top: pt.y - 4,
                    }}
                  />
                ))}

                {/* Last dot — white halo ring then terracotta dot on top */}
                <View style={[s.progCurrentDotRing, { left: lastPt.x - 9, top: lastPt.y - 9 }]} />
                <View style={{
                  position: 'absolute', width: 12, height: 12, borderRadius: 6,
                  backgroundColor: TERRACOTTA, left: lastPt.x - 6, top: lastPt.y - 6,
                }} />

                {/* START label — top-left */}
                <Text style={[s.progGoalLabel, { position: 'absolute', left: 0, top: 2 }]}>
                  START ({data[0]})
                </Text>
              </>
            )}
          </View>

          {/* Annotation row below chart */}
          {chartWidth > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#CCCCCC' }} />
                <Text style={s.progGoalLabel}>GOAL (180)</Text>
              </View>
              <Text style={[s.progGoalLabel, { color: TERRACOTTA, fontWeight: '700' }]}>
                CURRENT ({data[data.length - 1]})
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Progress stat card ───────────────────────────────────────────────────────

function ProgressStatCard({
  icon, label, value, children,
}: {
  icon: React.ReactNode; label: string; value: string; children?: React.ReactNode;
}) {
  return (
    <View style={[s.dailyWrap, glassShadow]}>
      <View style={[s.cardBody, { borderRadius: 20 }]}>
        <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
        <GlassBorder r={20} />
        <View style={s.dailyInner}>
          <View style={[s.dailyTopRow, { marginBottom: 10 }]}>
            <View style={s.dailyIconWrap}>{icon}</View>
          </View>
          <Text style={s.dailyLabel}>{label}</Text>
          <Text style={s.dailyValue}>{value}</Text>
          {children != null && <View style={s.progStatSub}>{children}</View>}
        </View>
      </View>
    </View>
  );
}

// ─── Weight Timeline card ─────────────────────────────────────────────────────

function WeightTimelineCard() {
  const milestones = [
    { color: DARK, label: 'Starting Weight', date: 'Oct 15, 2024', weight: '220 lbs', muted: false },
    { color: TERRACOTTA, label: 'Current Weight', date: 'Mar 5, 2026', weight: '195 lbs', muted: false },
    { color: '#CCCCCC', label: 'Est. Goal Weight', date: 'Jun 2026', weight: '~180 lbs', muted: true },
  ];

  return (
    <View style={s.cardWrap}>
      <View style={[s.cardBody, { borderRadius: 24 }]}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
        <GlassBorder r={24} />
        <View style={{ padding: 18 }}>
          {milestones.map((m, i) => (
            <View key={i}>
              <View style={s.timelineRow}>
                <View style={[s.timelineDot, { backgroundColor: m.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.timelineLabel}>{m.label}</Text>
                  <Text style={s.timelineDate}>{m.date}</Text>
                </View>
                <Text style={[s.timelineWeight, m.muted ? s.timelineWeightMuted : null]}>
                  {m.weight}
                </Text>
              </View>
              {i < milestones.length - 1 && <View style={s.timelineDivider} />}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Recent Logs card ─────────────────────────────────────────────────────────

function RecentLogsCard({ entries }: { entries: LogEntry[] }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(e => !e);
  };

  return (
    <View style={[s.cardWrap, { marginTop: 24, marginBottom: 8 }]}>
      <View style={[s.cardBody, { borderRadius: 24 }]}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
        <GlassBorder r={24} />

        <TouchableOpacity style={s.logHeader} onPress={toggle} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={s.logHeaderText}>Recent Logs</Text>
            <View style={s.logCountBadge}>
              <Text style={s.logCountText}>{entries.length}</Text>
            </View>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#AAAAAA" />
        </TouchableOpacity>

        {expanded && (
          <View style={s.logEntryList}>
            <View style={s.logDivider} />
            {entries.map((entry, i) => (
              <View key={entry.id}>
                <View style={s.logEntryRow}>
                  <View style={s.logEntryIconWrap}>{entry.icon}</View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={s.logEntryTitle} numberOfLines={1}>{entry.title}</Text>
                      <Text style={s.logEntryTime}>{entry.timestamp}</Text>
                    </View>
                    <Text style={s.logEntryDetails}>{entry.details}</Text>
                    <View style={[s.logImpactTag, { backgroundColor: statusStyle[entry.impactStatus].bg, marginTop: 6, alignSelf: 'flex-start' }]}>
                      <Text style={[s.logImpactText, { color: statusStyle[entry.impactStatus].text }]}>
                        {entry.impact}
                      </Text>
                    </View>
                  </View>
                </View>
                {i < entries.length - 1 && <View style={s.logDivider} />}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Coming soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ title }: { title: string }) {
  return (
    <View style={[s.cardWrap, { marginTop: 8 }]}>
      <View style={[s.cardBody, { borderRadius: 28 }]}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
        <GlassBorder r={28} />
        <View style={s.comingSoonContent}>
          <MaterialIcons name="construction" size={36} color="rgba(0,0,0,0.18)" />
          <Text style={s.comingSoonTitle}>{title}</Text>
          <Text style={s.comingSoonSub}>Coming soon</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { onScroll } = useTabBarVisibility();
  const [activeTab, setActiveTab] = useState<Tab>('lifestyle');

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >

          {/* ── Header ── */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Insights</Text>
            <TouchableOpacity style={s.bellBtn} activeOpacity={0.7}>
              <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.bellOverlay]} />
              <GlassBorder r={22} />
              <Ionicons name="notifications-outline" size={20} color={DARK} />
            </TouchableOpacity>
          </View>

          {/* ── Segmented Control ── */}
          <SegmentedControl active={activeTab} onChange={setActiveTab} />

          {/* ── Lifestyle content ── */}
          {activeTab === 'lifestyle' && (
            <>
              <AIInsightsCard />

              <View style={s.metricsRow}>
                <MetricCard value="1,840" label="Calories Burned" ringColor={TERRACOTTA} />
                <MetricCard value="8,432" label="Daily Steps" ringColor={DARK} />
              </View>

              <Text style={s.sectionTitle}>Daily Metrics</Text>
              <View style={s.dailyGrid}>
                <DailyMetricCard
                  icon={<MaterialIcons name="restaurant" size={20} color={TERRACOTTA} />}
                  label="Protein" value="29g" change="+2%" status="positive"
                />
                <DailyMetricCard
                  icon={<Ionicons name="leaf-outline" size={20} color={TERRACOTTA} />}
                  label="Fiber" value="15g" change="-1%" status="negative"
                />
                <DailyMetricCard
                  icon={<Ionicons name="water-outline" size={20} color={TERRACOTTA} />}
                  label="Hydration" value="32oz" change="+5%" status="positive"
                />
                <DailyMetricCard
                  icon={<MaterialIcons name="grain" size={20} color={TERRACOTTA} />}
                  label="Carbs" value="48g" change="0%" status="neutral"
                />
              </View>
              <RecentLogsCard entries={LIFESTYLE_LOGS} />
            </>
          )}

          {activeTab === 'medication' && (
            <>
              <MedAIInsightsCard />
              <MedLevelChartCard />
              <Text style={s.sectionTitle}>Injection Details</Text>
              <View style={s.dailyGrid}>
                <InjectionCard
                  icon={<Ionicons name="body-outline" size={20} color={TERRACOTTA} />}
                  label="Last Injection Site"
                  value="Left Abdomen"
                />
                <InjectionCard
                  icon={<Ionicons name="sync-outline" size={20} color={TERRACOTTA} />}
                  label="Rotate To"
                  value="Right Thigh"
                />
                <InjectionCard
                  icon={<FontAwesome5 name="syringe" size={18} color={TERRACOTTA} />}
                  label="Last Dosage"
                  value="0.5mg"
                />
                <InjectionCard
                  icon={<Ionicons name="calendar-outline" size={20} color={TERRACOTTA} />}
                  label="Next Injection"
                  value="3 Days"
                />
              </View>
              <RecentLogsCard entries={MEDICATION_LOGS} />
            </>
          )}
          {activeTab === 'progress' && (
            <>
              <ProgAIInsightsCard />
              <WeightChartCard />
              <View style={s.dailyGrid}>
                <ProgressStatCard
                  icon={<MaterialIcons name="fitness-center" size={20} color={TERRACOTTA} />}
                  label="Current BMI"
                  value="28.4"
                >
                  <View style={[s.changeBadge, { backgroundColor: statusStyle.positive.bg }]}>
                    <Text style={[s.changeText, { color: statusStyle.positive.text }]}>↓ Down 2.1 pts</Text>
                  </View>
                </ProgressStatCard>
                <ProgressStatCard
                  icon={<Ionicons name="flag-outline" size={20} color={TERRACOTTA} />}
                  label="To Goal"
                  value="65%"
                >
                  <View style={s.progBar}>
                    <View style={[s.progBarFill, { width: '65%' }]} />
                  </View>
                </ProgressStatCard>
              </View>
              <Text style={[s.sectionTitle, { marginTop: 24 }]}>Weight Timeline</Text>
              <WeightTimelineCard />
              <RecentLogsCard entries={PROGRESS_LOGS} />
            </>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  headerTitle: { fontSize: 36, fontWeight: '800', color: DARK, letterSpacing: -1 },
  bellBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bellOverlay: { borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.40)' },

  // Card base
  cardWrap: { borderRadius: 24, ...glassShadow },
  cardBody: { overflow: 'hidden' },

  // AI Insights
  aiAccent: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, backgroundColor: TERRACOTTA, borderTopLeftRadius: 24, borderBottomLeftRadius: 24 },
  aiContent: { paddingVertical: 18, paddingLeft: 20, paddingRight: 18 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  aiLabel: { fontSize: 11, fontWeight: '700', color: TERRACOTTA, letterSpacing: 1.5, marginLeft: 6, textTransform: 'uppercase' },
  aiBody: { fontSize: 14, color: '#555555', lineHeight: 21 },

  // Metrics row
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  metricWrap: { flex: 1, borderRadius: 22 },
  metricInner: { padding: 18, alignItems: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 15, fontWeight: '800', letterSpacing: -0.5 },
  metricLabel: { fontSize: 12, color: '#888888', fontWeight: '500', textAlign: 'center' },

  // Daily Metrics grid
  sectionTitle: { fontSize: 20, fontWeight: '800', color: DARK, letterSpacing: -0.5, marginBottom: 14 },
  dailyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dailyWrap: { width: '47.5%', borderRadius: 20 },
  dailyInner: { padding: 16 },
  dailyTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dailyIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(214,116,85,0.12)', alignItems: 'center', justifyContent: 'center' },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  changeText: { fontSize: 10, fontWeight: '700' },
  dailyLabel: { fontSize: 12, color: '#888888', fontWeight: '500', marginBottom: 3 },
  dailyValue: { fontSize: 22, fontWeight: '800', color: DARK, letterSpacing: -0.5 },

  // Coming soon
  comingSoonContent: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  comingSoonTitle: { fontSize: 20, fontWeight: '800', color: DARK, marginTop: 16, marginBottom: 6 },
  comingSoonSub: { fontSize: 14, color: '#888888' },

  // Medication chart card
  chartMuted: { fontSize: 12, color: '#888888', fontWeight: '500' },
  chartBig: { fontSize: 28, fontWeight: '800', color: DARK, letterSpacing: -0.5 },
  inRangeBadge: { backgroundColor: 'rgba(43,148,80,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  inRangeText: { fontSize: 12, fontWeight: '700', color: '#2B9450' },
  dayLabel: { fontSize: 10, fontWeight: '600', color: '#AAAAAA', letterSpacing: 0.5 },

  // Progress chart
  progPeriodRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  progPeriodBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  progPeriodBtnActive: { backgroundColor: TERRACOTTA },
  progPeriodLabel: { fontSize: 12, fontWeight: '700', color: '#AAAAAA' },
  progPeriodLabelActive: { color: '#FFFFFF' },
  progCurrentDotRing: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#FFFFFF' },
  progGoalLabel: { fontSize: 10, fontWeight: '600', color: '#AAAAAA' },

  // Progress stat card
  progStatSub: { marginTop: 6 },
  progBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(214,116,85,0.15)', marginTop: 6, overflow: 'hidden' },
  progBarFill: { height: 6, backgroundColor: TERRACOTTA, borderRadius: 3 },

  // Timeline
  timelineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLabel: { fontSize: 13, fontWeight: '700', color: DARK },
  timelineDate: { fontSize: 11, color: '#888888', fontWeight: '500', marginTop: 2 },
  timelineWeight: { marginLeft: 'auto', fontSize: 18, fontWeight: '800', color: DARK },
  timelineWeightMuted: { color: '#AAAAAA' },
  timelineDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)' },

  // Recent Logs card
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
  logHeaderText: { fontSize: 16, fontWeight: '700', color: DARK },
  logCountBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(214,116,85,0.12)' },
  logCountText: { fontSize: 11, fontWeight: '700', color: TERRACOTTA },
  logEntryList: { paddingHorizontal: 18, paddingBottom: 14 },
  logDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)' },
  logEntryRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  logEntryIconWrap: { width: 36, height: 36, borderRadius: 9, backgroundColor: 'rgba(214,116,85,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logEntryTitle: { fontSize: 13, fontWeight: '700', color: DARK, flex: 1 },
  logEntryTime: { fontSize: 11, color: '#AAAAAA', fontWeight: '500', flexShrink: 0, marginLeft: 8 },
  logEntryDetails: { fontSize: 12, color: '#888888', lineHeight: 18, marginTop: 3 },
  logImpactTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  logImpactText: { fontSize: 10, fontWeight: '700' },
});
