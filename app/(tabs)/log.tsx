import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';
import { useHealthData } from '@/contexts/health-data';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { generateLogInsight } from '@/lib/openai';
import { generatePkCurve, generateIntradayPkCurve, DRUG_HALF_LIFE_LABEL, DRUG_DEFAULT_FREQ_DAYS, DRUG_IS_ORAL, INTRADAY_TIME_LABELS } from '@/constants/drug-pk';
import { useLogStore, type WeightLog, type InjectionLog, type FoodLog, type ActivityLog } from '@/stores/log-store';
import { useUiStore } from '@/stores/ui-store';

const ORANGE = '#FF742A';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SITE_ROTATION = ['Left Abdomen', 'Right Thigh', 'Left Thigh', 'Right Abdomen'];

function nextSite(current: string | null): string {
  if (!current) return 'Left Abdomen';
  const idx = SITE_ROTATION.indexOf(current);
  return idx === -1 ? SITE_ROTATION[0] : SITE_ROTATION[(idx + 1) % SITE_ROTATION.length];
}

function fmtDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  const isToday = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today, ${time}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateOnly(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (dateStr === today) return 'Today';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function nextInjectionLabel(injectionDate: string, freqDays = 7): string {
  const nextMs = new Date(injectionDate + 'T00:00:00').getTime() + freqDays * 86400000;
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const daysLeft = Math.round((nextMs - todayMs) / 86400000);
  if (daysLeft <= 0) return 'Today';
  if (daysLeft === 1) return 'Tomorrow';
  return `In ${daysLeft} Days`;
}

function computeBMI(weightLbs: number, heightInches: number): number {
  if (!heightInches) return 0;
  return Math.round((weightLbs / (heightInches * heightInches)) * 703 * 10) / 10;
}

function goalProgress(start: number, current: number, goal: number): number {
  if (start <= goal) return 0;
  return Math.max(0, Math.min(100, Math.round(((start - current) / (start - goal)) * 100)));
}


function last7DayLabels(): string[] {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const todayIdx = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => days[(todayIdx - 6 + i + 7) % 7]);
}

function weightDataForPeriod(logs: WeightLog[], period: '7D' | '30D' | '90D' | '1Y'): number[] {
  const days = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 }[period];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const filtered = logs
    .filter(l => l.logged_at >= since)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    .map(l => l.weight_lbs);
  return filtered.length >= 2 ? filtered : [];
}

function foodToEntry(f: FoodLog): LogEntry {
  const details = `${Math.round(f.calories)} cal · ${Math.round(f.protein_g)}g protein · ${Math.round(f.fiber_g)}g fiber · ${Math.round(f.carbs_g)}g carbs`;
  const impact = `+${Math.round(f.protein_g)}g protein, +${Math.round(f.carbs_g)}g carbs, +${Math.round(f.fiber_g)}g fiber`;
  return {
    id: f.id, timestamp: fmtDateTime(f.logged_at), title: f.food_name,
    details, impact, impactStatus: 'positive',
    icon: <MaterialIcons name="restaurant" size={18} color={ORANGE} />,
  };
}

function activityToEntry(a: ActivityLog): LogEntry {
  const durationStr = a.duration_min ? `${a.duration_min} min` : '';
  const stepsStr = a.steps ? `${a.steps.toLocaleString()} steps` : '';
  const calStr = a.active_calories ? `${a.active_calories} cal burned` : '';
  const details = [durationStr, stepsStr, calStr].filter(Boolean).join(' · ') || 'Activity logged';
  const impact = `Steps ${a.steps ? `+${a.steps.toLocaleString()}` : '—'} · Calories ${a.active_calories ? `+${a.active_calories}` : '—'}`;
  return {
    id: a.id, timestamp: fmtDateOnly(a.date), title: a.exercise_type ?? 'Activity',
    details, impact, impactStatus: 'positive',
    icon: <MaterialIcons name="directions-run" size={18} color={ORANGE} />,
  };
}

function injectionToEntry(inj: InjectionLog): LogEntry {
  const medName = inj.medication_name ?? 'Injection';
  const batchStr = inj.batch_number ? ` · Batch #${inj.batch_number}` : '';
  const details = `Site: ${inj.site ?? '—'} · Dose: ${inj.dose_mg}mg${batchStr}`;
  const next = nextSite(inj.site ?? null);
  return {
    id: inj.id, timestamp: fmtDateOnly(inj.injection_date),
    title: `${medName} ${inj.dose_mg}mg`,
    details, impact: `Next injection in 7 days — rotate to ${next}`, impactStatus: 'neutral',
    icon: <FontAwesome5 name="syringe" size={16} color={ORANGE} />,
  };
}

function weightToEntry(log: WeightLog, prevLog?: WeightLog): LogEntry {
  const delta = prevLog ? Math.round((log.weight_lbs - prevLog.weight_lbs) * 10) / 10 : 0;
  const deltaStr = delta < 0 ? `Down ${Math.abs(delta)} lbs` : delta > 0 ? `Up ${delta} lbs` : 'Steady';
  return {
    id: log.id, timestamp: fmtDateTime(log.logged_at),
    title: `Weight Log — ${log.weight_lbs} lbs`,
    details: `${log.weight_lbs} lbs · ${deltaStr} from last entry`,
    impact: delta <= 0 ? deltaStr : `Up ${Math.abs(delta)} lbs`,
    impactStatus: delta < 0 ? 'positive' : delta > 0 ? 'negative' : 'neutral',
    icon: <MaterialIcons name="fitness-center" size={18} color={ORANGE} />,
  };
}

// ─── Segmented control ────────────────────────────────────────────────────────

type Tab = 'medication' | 'lifestyle' | 'progress';

const TABS: { key: Tab; label: string }[] = [
  { key: 'medication', label: 'Medication' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'progress', label: 'Progress' },
];

function SegmentedControl({ active, onChange, colors }: { active: Tab; onChange: (t: Tab) => void; colors: AppColors }) {
  const sc = useMemo(() => createSegmentedStyles(colors), [colors]);
  return (
    <View style={sc.wrap}>
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
                  <BlurView intensity={30} tint={colors.blurTint} style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]} />
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

const createSegmentedStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: {
      borderRadius: 36, overflow: 'hidden', marginBottom: 24,
      shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
      backgroundColor: c.borderSubtle,
      borderWidth: 0.5, borderColor: c.border,
    },
    overlay: { borderRadius: 36, backgroundColor: c.glassOverlay },
    row: { flexDirection: 'row', padding: 5 },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 28, overflow: 'hidden' },
    tabActive: {},
    tabActiveOverlay: { borderRadius: 28, backgroundColor: 'rgba(255,116,42,0.15)' },
    tabLabel: { fontSize: 13, fontWeight: '600', color: w(0.35), fontFamily: 'Helvetica Neue' },
    tabLabelActive: { color: ORANGE, fontWeight: '700', fontFamily: 'Helvetica Neue' },
  });
};

// ─── Ring indicator ───────────────────────────────────────────────────────────

function RingIndicator({ size = 88, strokeWidth = 7, color = ORANGE }: { size?: number; strokeWidth?: number; color?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: size / 2, borderWidth: strokeWidth, borderColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }} />
      <View style={{
        position: 'absolute',
        width: size - strokeWidth * 2 + 4, height: size - strokeWidth * 2 + 4,
        borderRadius: (size - strokeWidth * 2 + 4) / 2,
        borderWidth: strokeWidth, borderColor: color,
      }} />
    </View>
  );
}

// ─── Shared Ask AI button ─────────────────────────────────────────────────────

function AskAIButton({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={s.askAiRow} onPress={onPress} hitSlop={6}>
      <Ionicons name="chatbubble-outline" size={11} color="rgba(255,116,42,0.55)" />
      <Text style={s.askAiText}>Ask AI</Text>
    </Pressable>
  );
}

// ─── Shared AI card renderer ──────────────────────────────────────────────────

function AIInsightsCardShell({ text, loading, onPress }: { text: string | null; loading: boolean; onPress?: () => void }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={[s.cardWrap, { marginBottom: 16 }]} onPress={onPress} disabled={loading || !onPress}>
      <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={s.aiAccent} />
        <View style={s.aiContent}>
          <View style={s.aiHeader}>
            <MaterialIcons name="auto-awesome" size={16} color={ORANGE} />
            <Text style={s.aiLabel}>AI INSIGHTS</Text>
          </View>
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 }}>
              <ActivityIndicator size="small" color={ORANGE} />
              <View style={{ flex: 1, gap: 7 }}>
                <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.borderSubtle, width: '88%' }} />
                <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.borderSubtle, width: '65%' }} />
              </View>
            </View>
          ) : (
            <Text style={s.aiBody}>{text}</Text>
          )}
          {!loading && onPress && (
            <View style={s.aiTapHint}>
              <Ionicons name="chatbubble-outline" size={11} color="rgba(255,116,42,0.5)" />
              <Text style={s.aiTapHintText}>Tap to ask AI</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── AI Insights card ─────────────────────────────────────────────────────────

function AIInsightsCard({ health }: { health: ReturnType<typeof useHealthData> }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateLogInsight('lifestyle', health)
      .then(t => setText(t))
      .catch(() => setText('You have a protein and hydration deficit today. Try to increase your intake to reach your daily goal.'))
      .finally(() => setLoading(false));
  }, []);

  const { openAiChat } = useUiStore();
  const handlePress = () => {
    if (!text) return;
    openAiChat({ type: 'insight', contextLabel: 'Lifestyle Insight', contextValue: text.slice(0, 80), chips: JSON.stringify(['Tell me more', 'Give me an action plan', 'What should I prioritize?', 'How does this relate to my medication?']) });
  };

  return <AIInsightsCardShell text={text} loading={loading} onPress={handlePress} />;
}

// ─── Metric card (Calories / Steps) ──────────────────────────────────────────

function MetricCard({ value, label, ringColor }: { value: string; label: string; ringColor: string }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 }), [colors]);
  const { openAiChat } = useUiStore();
  const handleAskAI = () => {
    openAiChat({ type: 'metric', contextLabel: label, contextValue: value, chips: JSON.stringify(['Is this on track for my goals?', 'How can I improve this?', 'How does GLP-1 affect this?']) });
  };
  return (
    <View style={[s.metricWrap, glassShadow]}>
      <View style={[s.cardBody, { borderRadius: 22, backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={s.metricInner}>
          <View style={s.ringWrap}>
            <RingIndicator color={ringColor} />
            <View style={s.ringCenter}>
              <Text style={[s.metricValue, { color: ringColor }]}>{value}</Text>
            </View>
          </View>
          <Text style={s.metricLabel}>{label}</Text>
          <AskAIButton onPress={handleAskAI} />
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
  positive: { bg: 'rgba(43,148,80,0.15)', text: '#2B9450' },
  negative: { bg: 'rgba(220,50,50,0.15)', text: '#DC3232' },
  neutral: { bg: 'rgba(150,150,150,0.10)', text: '#9A9490' },
};

function DailyMetricCard({
  icon, label, value, change, status,
}: {
  icon: React.ReactNode; label: string; value: string; change: string; status: Status;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 }), [colors]);
  const ss = statusStyle[status];
  const { openAiChat } = useUiStore();
  const handleAskAI = () => {
    openAiChat({ type: 'metric', contextLabel: label, contextValue: `${value} · ${change}`, chips: JSON.stringify(['Is this on track?', 'How can I improve this?', `Why is my ${label.toLowerCase()} important on GLP-1?`]) });
  };
  return (
    <View style={[s.dailyWrap, glassShadow]}>
      <View style={[s.cardBody, { borderRadius: 20, backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={s.dailyInner}>
          <View style={s.dailyTopRow}>
            <View style={s.dailyIconWrap}>{icon}</View>
            <View style={[s.changeBadge, { backgroundColor: ss.bg }]}>
              <Text style={[s.changeText, { color: ss.text }]}>{change}</Text>
            </View>
          </View>
          <Text style={s.dailyLabel}>{label}</Text>
          <Text style={s.dailyValue}>{value}</Text>
          <AskAIButton onPress={handleAskAI} />
        </View>
      </View>
    </View>
  );
}

// ─── Med AI Insights card ─────────────────────────────────────────────────────

function MedAIInsightsCard({ health }: { health: ReturnType<typeof useHealthData> }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { openAiChat } = useUiStore();

  useEffect(() => {
    generateLogInsight('medication', health)
      .then(t => setText(t))
      .catch(() => setText('Your medication levels are stable. Adherence is strong this month. Your metabolic response is in the optimal range.'))
      .finally(() => setLoading(false));
  }, []);

  const handlePress = () => {
    if (!text) return;
    openAiChat({ type: 'insight', contextLabel: 'Medication Insight', contextValue: text.slice(0, 80), chips: JSON.stringify(['Tell me more', 'When should I take my next dose?', 'What side effects should I watch for?', 'How do I optimize my medication timing?']) });
  };

  return <AIInsightsCardShell text={text} loading={loading} onPress={handlePress} />;
}

// ─── Medication Level Chart card ──────────────────────────────────────────────

const CHART_HEIGHT = 110;

function MedLevelChartCard({ chartData, daysSince, dayLabels, glp1Type, isDailyDrug }: {
  chartData: number[];
  daysSince: number;
  dayLabels: string[];
  glp1Type: import('@/constants/user-profile').Glp1Type;
  isDailyDrug: boolean;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [chartWidth, setChartWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  const n = chartData.length;
  const colW = chartWidth > 0 ? chartWidth / n : 0;

  const points = chartData.map((v, i) => ({
    x: colW * i + colW / 2,
    y: CHART_HEIGHT - (v / 100) * CHART_HEIGHT,
  }));

  const currentLevel = chartData[chartData.length - 1] ?? 0;
  const levelLabel = currentLevel >= 75 ? 'Optimal' : currentLevel >= 50 ? 'Active' : currentLevel >= 30 ? 'Tapering' : 'Low';
  const daysSinceLabel = daysSince === 1 ? 'Today' : daysSince === 2 ? 'Yesterday' : `${daysSince - 1} days ago`;
  const { openAiChat } = useUiStore();

  return (
    <View style={[s.cardWrap, { marginBottom: 16 }]}>
      <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.chartMuted}>{glp1Type.charAt(0).toUpperCase() + glp1Type.slice(1)} · {DRUG_HALF_LIFE_LABEL[glp1Type]}</Text>
            <AskAIButton onPress={() => openAiChat({ type: 'metric', contextLabel: 'Medication Level', contextValue: `${levelLabel} · Last injection ${daysSinceLabel}`, chips: JSON.stringify(['What does optimal mean?', 'How will this change over my cycle?', 'When is my peak concentration?', 'How does this affect my appetite?']) })} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 2, gap: 10 }}>
            <Text style={s.chartBig}>{levelLabel}</Text>
            <View style={s.inRangeBadge}>
              <Text style={s.inRangeText}>In Range</Text>
            </View>
          </View>
          <Text style={[s.chartMuted, { marginBottom: 14 }]}>
            {isDailyDrug ? 'Intraday concentration profile' : `Since last injection: ${daysSinceLabel}`}
          </Text>

          <View style={{ height: CHART_HEIGHT }} onLayout={onLayout}>
            {chartWidth > 0 && (
              <>
                {points.map((pt, i) => (
                  <View
                    key={`area-${i}`}
                    style={{
                      position: 'absolute',
                      left: colW * i,
                      width: colW,
                      top: pt.y,
                      bottom: 0,
                      backgroundColor: 'rgba(255,116,42,0.08)',
                    }}
                  />
                ))}

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
                        backgroundColor: ORANGE,
                        left: midX - length / 2,
                        top: midY - 1.25,
                        transform: [{ rotate: `${angle}deg` }],
                        borderRadius: 2,
                      }}
                    />
                  );
                })}

                {points.map((pt, i) => (
                  <View
                    key={`dot-${i}`}
                    style={{
                      position: 'absolute',
                      width: 8, height: 8, borderRadius: 4,
                      backgroundColor: ORANGE,
                      left: pt.x - 4, top: pt.y - 4,
                    }}
                  />
                ))}
              </>
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            {dayLabels.map((d, i) => (
              <Text key={`${d}-${i}`} style={s.dayLabel}>{d}</Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Injection info card ───────────────────────────────────────────────────────

function InjectionCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 }), [colors]);
  const { openAiChat } = useUiStore();
  const handleAskAI = () => {
    openAiChat({ type: 'metric', contextLabel: label, contextValue: value, chips: JSON.stringify(['Why does this matter?', 'How does this affect my treatment?', 'What should I know about site rotation?']) });
  };
  return (
    <View style={[s.dailyWrap, glassShadow]}>
      <View style={[s.cardBody, { borderRadius: 20, backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={s.dailyInner}>
          <View style={[s.dailyTopRow, { marginBottom: 10 }]}>
            <View style={s.dailyIconWrap}>{icon}</View>
          </View>
          <Text style={s.dailyLabel}>{label}</Text>
          <Text style={s.dailyValue}>{value}</Text>
          <AskAIButton onPress={handleAskAI} />
        </View>
      </View>
    </View>
  );
}

// ─── Weight chart ─────────────────────────────────────────────────────────────

const WEIGHT_CHART_HEIGHT = 130;

const PERIOD_SUBTITLES: Record<string, string> = {
  '7D': 'Last 7 days', '30D': 'Last 30 days', '90D': 'Last 3 months', '1Y': 'Last year',
};

function WeightChartCard({ datasets, currentWeight }: {
  datasets: Record<string, number[]>;
  currentWeight: number | null;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [activePeriod, setActivePeriod] = useState<'7D' | '30D' | '90D' | '1Y'>('90D');
  const [chartWidth, setChartWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setChartWidth(e.nativeEvent.layout.width);

  const data = datasets[activePeriod];
  const hasData = data && data.length >= 2;
  const n = hasData ? data.length : 0;
  const colW = chartWidth > 0 && n > 0 ? chartWidth / n : 0;
  const minW = hasData ? Math.min(...data) : 0;
  const maxW = hasData ? Math.max(...data) + 5 : 5;
  const range = maxW - minW || 1;

  const toY = (v: number) => WEIGHT_CHART_HEIGHT - ((v - minW) / range) * WEIGHT_CHART_HEIGHT;
  const points = hasData ? data.map((v, i) => ({ x: colW * i + colW / 2, y: toY(v) })) : [];
  const lastPt = points[points.length - 1];

  const displayWeight = currentWeight ?? (hasData ? data[data.length - 1] : null);
  const PERIODS = ['7D', '30D', '90D', '1Y'] as const;
  const { openAiChat } = useUiStore();

  return (
    <View style={[s.cardWrap, { marginBottom: 16 }]}>
      <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' }}>Weight Journey</Text>
              <Text style={s.chartMuted}>{PERIOD_SUBTITLES[activePeriod]}</Text>
              <AskAIButton onPress={() => openAiChat({ type: 'metric', contextLabel: 'Weight Journey', contextValue: `${displayWeight != null ? displayWeight + ' lbs' : '—'} · ${PERIOD_SUBTITLES[activePeriod]}`, chips: JSON.stringify(['Am I on pace for my goal?', 'Is my rate of loss healthy on GLP-1?', 'When will I reach my goal?', 'What can I do to accelerate progress?']) })} />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: ORANGE, letterSpacing: -1, fontFamily: 'Helvetica Neue' }}>
              {displayWeight != null ? `${displayWeight} lbs` : '—'}
            </Text>
          </View>

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

          <View style={{ height: WEIGHT_CHART_HEIGHT }} onLayout={onLayout}>
            {!hasData ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={s.chartMuted}>Log weight entries to see your chart</Text>
              </View>
            ) : chartWidth > 0 && (
              <>
                {points.map((pt, i) => (
                  <View
                    key={`wa-${i}`}
                    style={{
                      position: 'absolute', left: colW * i, width: colW,
                      top: pt.y, bottom: 0,
                      backgroundColor: 'rgba(255,116,42,0.08)',
                    }}
                  />
                ))}

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
                        backgroundColor: ORANGE,
                        left: midX - length / 2, top: midY - 1.25,
                        transform: [{ rotate: `${angle}deg` }],
                        borderRadius: 2,
                      }}
                    />
                  );
                })}

                {points.slice(0, -1).map((pt, i) => (
                  <View
                    key={`wd-${i}`}
                    style={{
                      position: 'absolute', width: 8, height: 8, borderRadius: 4,
                      backgroundColor: ORANGE, left: pt.x - 4, top: pt.y - 4,
                    }}
                  />
                ))}

                {lastPt && (
                  <>
                    <View style={[s.progCurrentDotRing, { left: lastPt.x - 9, top: lastPt.y - 9 }]} />
                    <View style={{
                      position: 'absolute', width: 12, height: 12, borderRadius: 6,
                      backgroundColor: ORANGE, left: lastPt.x - 6, top: lastPt.y - 6,
                    }} />
                  </>
                )}

                <Text style={[s.progGoalLabel, { position: 'absolute', left: 0, top: 2 }]}>
                  START ({data[0]})
                </Text>
              </>
            )}
          </View>

          {hasData && chartWidth > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3A3735' }} />
                <Text style={s.progGoalLabel}>START</Text>
              </View>
              <Text style={[s.progGoalLabel, { color: ORANGE, fontWeight: '700' }]}>
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
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const glassShadow = useMemo(() => ({ shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 }), [colors]);
  const { openAiChat } = useUiStore();
  const handleAskAI = () => {
    openAiChat({ type: 'metric', contextLabel: label, contextValue: value, chips: JSON.stringify(['What does this mean for my health?', 'Is this a healthy rate of change?', 'What should my target be?']) });
  };
  return (
    <View style={[s.dailyWrap, glassShadow]}>
      <View style={[s.cardBody, { borderRadius: 20, backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border }]}>
        <View style={s.dailyInner}>
          <View style={[s.dailyTopRow, { marginBottom: 10 }]}>
            <View style={s.dailyIconWrap}>{icon}</View>
          </View>
          <Text style={s.dailyLabel}>{label}</Text>
          <Text style={s.dailyValue}>{value}</Text>
          {children != null && <View style={s.progStatSub}>{children}</View>}
          <AskAIButton onPress={handleAskAI} />
        </View>
      </View>
    </View>
  );
}

// ─── Weight Timeline card ─────────────────────────────────────────────────────

function WeightTimelineCard({
  startWeight, startDate, currentWeight, currentDate, goalWeight,
}: {
  startWeight: number | null;
  startDate: string;
  currentWeight: number | null;
  currentDate: string;
  goalWeight: number | null;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const milestones = [
    { color: colors.textPrimary, label: 'Starting Weight', date: startDate, weight: startWeight != null ? `${startWeight} lbs` : '—', muted: false },
    { color: ORANGE, label: 'Current Weight', date: currentDate, weight: currentWeight != null ? `${currentWeight} lbs` : '—', muted: false },
    { color: '#3A3735', label: 'Est. Goal Weight', date: 'Goal', weight: goalWeight != null ? `~${goalWeight} lbs` : '—', muted: true },
  ];

  const aiContext = `${startWeight ?? '?'} lbs → ${currentWeight ?? '?'} lbs · Goal ${goalWeight ?? '?'} lbs`;
  const { openAiChat } = useUiStore();

  return (
    <View style={s.cardWrap}>
      <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border }]}>
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
          <AskAIButton
            onPress={() => openAiChat({ type: 'metric', contextLabel: 'Weight Timeline', contextValue: aiContext, chips: JSON.stringify(['Am I on track for my goal?', 'How long until I reach my goal?', 'What pace should I aim for?', 'How does GLP-1 affect my timeline?']) })}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Recent Logs card ─────────────────────────────────────────────────────────

function RecentLogsCard({ entries }: { entries: LogEntry[] }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(e => !e);
  };

  return (
    <View style={[s.cardWrap, { marginTop: 24, marginBottom: 8 }]}>
      <View style={[s.cardBody, { borderRadius: 24, backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border }]}>

        <TouchableOpacity style={s.logHeader} onPress={toggle} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={s.logHeaderText}>Recent Logs</Text>
            <View style={s.logCountBadge}>
              <Text style={s.logCountText}>{entries.length}</Text>
            </View>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'} />
        </TouchableOpacity>

        {expanded && (
          <View style={s.logEntryList}>
            <View style={s.logDivider} />
            {entries.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', fontSize: 13, fontFamily: 'Helvetica Neue' }}>No entries yet</Text>
              </View>
            ) : entries.map((entry, i) => (
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

// ─── Progress AI Insights card ────────────────────────────────────────────────

function ProgAIInsightsCard({ health }: { health: ReturnType<typeof useHealthData> }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { openAiChat } = useUiStore();

  useEffect(() => {
    generateLogInsight('progress', health)
      .then(t => setText(t))
      .catch(() => setText("You're on track to reach your goal. Your weight loss rate is steady and healthy on GLP-1."))
      .finally(() => setLoading(false));
  }, []);

  const handlePress = () => {
    if (!text) return;
    openAiChat({ type: 'insight', contextLabel: 'Progress Insight', contextValue: text.slice(0, 80), chips: JSON.stringify(['Tell me more', 'Am I on pace for my goal?', 'How can I accelerate my progress?', 'What does this mean long-term?']) });
  };

  return <AIInsightsCardShell text={text} loading={loading} onPress={handlePress} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { onScroll } = useTabBarVisibility();
  const health = useHealthData();
  const { actuals, targets } = health;
  const { weightLogs, injectionLogs, foodLogs, activityLogs, profile, fetchInsightsData } = useLogStore();
  const [activeTab, setActiveTab] = useState<Tab>('lifestyle');

  useEffect(() => { fetchInsightsData(); }, []);

  // ── Today filters ──────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayFoodLogs = foodLogs.filter(f => f.logged_at.slice(0, 10) === todayStr);
  const todayActivityLogs = activityLogs.filter(a => a.date === todayStr);

  // ── Lifestyle metrics ──────────────────────────────────────────────────────
  const todayProteinG = Math.round(todayFoodLogs.reduce((s, f) => s + f.protein_g, 0));
  const todayFiberG = Math.round(todayFoodLogs.reduce((s, f) => s + f.fiber_g, 0));
  const todayCarbsG = Math.round(todayFoodLogs.reduce((s, f) => s + f.carbs_g, 0));
  const todayActiveCalories = Math.round(todayActivityLogs.reduce((s, a) => s + (a.active_calories ?? 0), 0));
  const todaySteps = todayActivityLogs.reduce((s, a) => s + (a.steps ?? 0), 0);

  const proteinPct = targets.proteinG > 0 ? Math.round((todayProteinG / targets.proteinG) * 100) : 0;
  const fiberPct = targets.fiberG > 0 ? Math.round((todayFiberG / targets.fiberG) * 100) : 0;
  const waterOz = Math.round(actuals.waterMl / 29.57);
  const waterPct = targets.waterMl > 0 ? Math.round((actuals.waterMl / targets.waterMl) * 100) : 0;

  // ── Lifestyle logs ─────────────────────────────────────────────────────────
  const lifestyleLogs: LogEntry[] = [
    ...todayFoodLogs.map(foodToEntry),
    ...todayActivityLogs.map(activityToEntry),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // ── Medication data ────────────────────────────────────────────────────────
  const lastInj = injectionLogs[0] ?? null;
  const lastSite = lastInj?.site ?? null;
  const rotateTo = nextSite(lastSite);
  const lastDosage = lastInj ? `${lastInj.dose_mg}mg` : '—';
  const lastDaysSince = lastInj
    ? Math.max(1, Math.floor(
        (new Date().setHours(0, 0, 0, 0) - new Date(lastInj.injection_date + 'T00:00:00').getTime()) / 86400000
      ) + 1)
    : 4;
  const nextInjLabel = lastInj
    ? nextInjectionLabel(lastInj.injection_date, profile?.injection_frequency_days ?? 7)
    : '—';
  const isDailyDrug = DRUG_DEFAULT_FREQ_DAYS[health.profile.glp1Type] === 1;
  const medChartData = isDailyDrug
    ? generateIntradayPkCurve(health.profile.glp1Type)
    : generatePkCurve(
        lastDaysSince,
        health.profile.glp1Type,
        health.profile.glp1Status,
        health.profile.injectionFrequencyDays ?? 7,
      );
  const medDayLabels = isDailyDrug ? INTRADAY_TIME_LABELS : last7DayLabels();
  const medicationLogs: LogEntry[] = injectionLogs.slice(0, 5).map(injectionToEntry);

  // ── Progress data ──────────────────────────────────────────────────────────
  const currentWeight = weightLogs[0]?.weight_lbs ?? null;
  const startWeight = profile?.start_weight_lbs ?? (weightLogs.length > 0 ? weightLogs[weightLogs.length - 1]?.weight_lbs : null) ?? null;
  const goalWeight = profile?.goal_weight_lbs ?? null;
  const heightIn = profile?.height_inches ?? null;
  const bmi = currentWeight && heightIn ? computeBMI(currentWeight, heightIn) : null;
  const startBmi = startWeight && heightIn ? computeBMI(startWeight, heightIn) : null;
  const bmiDelta = bmi && startBmi ? Math.round((startBmi - bmi) * 10) / 10 : null;
  const toGoalPct = startWeight && currentWeight && goalWeight
    ? goalProgress(startWeight, currentWeight, goalWeight)
    : null;

  const weightDatasets: Record<string, number[]> = {
    '7D': weightDataForPeriod(weightLogs, '7D'),
    '30D': weightDataForPeriod(weightLogs, '30D'),
    '90D': weightDataForPeriod(weightLogs, '90D'),
    '1Y': weightDataForPeriod(weightLogs, '1Y'),
  };

  const progressLogs: LogEntry[] = weightLogs.slice(0, 5).map((log, i) =>
    weightToEntry(log, weightLogs[i + 1])
  );

  const startDate = profile?.program_start_date
    ? new Date(profile.program_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : (weightLogs.length > 0
      ? new Date(weightLogs[weightLogs.length - 1].logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—');
  const currentDate = weightLogs[0]
    ? new Date(weightLogs[0].logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
            <TouchableOpacity style={[s.bellBtn, { backgroundColor: colors.borderSubtle }]} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* ── Segmented Control ── */}
          <SegmentedControl active={activeTab} onChange={setActiveTab} colors={colors} />

          {/* ── Lifestyle content ── */}
          {activeTab === 'lifestyle' && (
            <>
              <AIInsightsCard health={health} />

              <View style={s.metricsRow}>
                <MetricCard
                  value={todayActiveCalories > 0 ? todayActiveCalories.toLocaleString() : '—'}
                  label="Calories Burned"
                  ringColor={ORANGE}
                />
                <MetricCard
                  value={todaySteps > 0 ? todaySteps.toLocaleString() : '—'}
                  label="Daily Steps"
                  ringColor={colors.textPrimary}
                />
              </View>

              <Text style={s.sectionTitle}>Daily Metrics</Text>
              <View style={s.dailyGrid}>
                <DailyMetricCard
                  icon={<MaterialIcons name="restaurant" size={20} color={ORANGE} />}
                  label="Protein" value={`${todayProteinG}g`}
                  change={`${proteinPct}%`}
                  status={proteinPct >= 80 ? 'positive' : proteinPct >= 40 ? 'neutral' : 'negative'}
                />
                <DailyMetricCard
                  icon={<Ionicons name="leaf-outline" size={20} color={ORANGE} />}
                  label="Fiber" value={`${todayFiberG}g`}
                  change={`${fiberPct}%`}
                  status={fiberPct >= 80 ? 'positive' : fiberPct >= 40 ? 'neutral' : 'negative'}
                />
                <DailyMetricCard
                  icon={<Ionicons name="water-outline" size={20} color={ORANGE} />}
                  label="Hydration" value={`${waterOz}oz`}
                  change={`${waterPct}%`}
                  status={waterPct >= 80 ? 'positive' : waterPct >= 40 ? 'neutral' : 'negative'}
                />
                <DailyMetricCard
                  icon={<MaterialIcons name="grain" size={20} color={ORANGE} />}
                  label="Carbs" value={`${todayCarbsG}g`}
                  change="Today" status="neutral"
                />
              </View>
              <RecentLogsCard entries={lifestyleLogs} />
            </>
          )}

          {/* ── Medication content ── */}
          {activeTab === 'medication' && (
            <>
              <MedAIInsightsCard health={health} />
              <MedLevelChartCard
                chartData={medChartData}
                daysSince={lastDaysSince}
                dayLabels={medDayLabels}
                glp1Type={health.profile.glp1Type}
                isDailyDrug={isDailyDrug}
              />
              <Text style={s.sectionTitle}>Injection Details</Text>
              <View style={s.dailyGrid}>
                <InjectionCard
                  icon={<Ionicons name="body-outline" size={20} color={ORANGE} />}
                  label="Last Injection Site"
                  value={lastSite ?? '—'}
                />
                <InjectionCard
                  icon={<Ionicons name="sync-outline" size={20} color={ORANGE} />}
                  label="Rotate To"
                  value={rotateTo}
                />
                <InjectionCard
                  icon={<FontAwesome5 name="syringe" size={18} color={ORANGE} />}
                  label="Last Dosage"
                  value={lastDosage}
                />
                <InjectionCard
                  icon={<Ionicons name="calendar-outline" size={20} color={ORANGE} />}
                  label="Next Injection"
                  value={nextInjLabel}
                />
              </View>
              <RecentLogsCard entries={medicationLogs} />
            </>
          )}

          {/* ── Progress content ── */}
          {activeTab === 'progress' && (
            <>
              <ProgAIInsightsCard health={health} />
              <WeightChartCard datasets={weightDatasets} currentWeight={currentWeight} />
              <View style={s.dailyGrid}>
                <ProgressStatCard
                  icon={<MaterialIcons name="fitness-center" size={20} color={ORANGE} />}
                  label="Current BMI"
                  value={bmi != null ? String(bmi) : '—'}
                >
                  {bmiDelta != null && bmiDelta > 0 && (
                    <View style={[s.changeBadge, { backgroundColor: statusStyle.positive.bg }]}>
                      <Text style={[s.changeText, { color: statusStyle.positive.text }]}>↓ Down {bmiDelta} pts</Text>
                    </View>
                  )}
                </ProgressStatCard>
                <ProgressStatCard
                  icon={<Ionicons name="flag-outline" size={20} color={ORANGE} />}
                  label="To Goal"
                  value={toGoalPct != null ? `${toGoalPct}%` : '—'}
                >
                  {toGoalPct != null && (
                    <View style={s.progBar}>
                      <View style={[s.progBarFill, { width: `${toGoalPct}%` as any }]} />
                    </View>
                  )}
                </ProgressStatCard>
              </View>
              <Text style={[s.sectionTitle, { marginTop: 24 }]}>Weight Timeline</Text>
              <WeightTimelineCard
                startWeight={startWeight}
                startDate={startDate}
                currentWeight={currentWeight}
                currentDate={currentDate}
                goalWeight={goalWeight}
              />
              <RecentLogsCard entries={progressLogs} />
            </>
          )}

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

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  headerTitle: { fontSize: 36, fontWeight: '800', color: c.textPrimary, letterSpacing: -1, fontFamily: 'Helvetica Neue' },
  bellBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bellOverlay: { borderRadius: 22, backgroundColor: c.glassOverlay },

  // Card base
  cardWrap: { borderRadius: 24 },
  cardBody: { overflow: 'hidden' },

  // AI Insights
  aiAccent: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, backgroundColor: ORANGE, borderTopLeftRadius: 24, borderBottomLeftRadius: 24 },
  aiContent: { paddingVertical: 18, paddingLeft: 20, paddingRight: 18 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  aiLabel: { fontSize: 11, fontWeight: '700', color: ORANGE, letterSpacing: 1.5, marginLeft: 6, textTransform: 'uppercase', fontFamily: 'Helvetica Neue' },
  aiBody: { fontSize: 14, color: w(0.6), lineHeight: 21, fontFamily: 'Helvetica Neue' },
  aiTapHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  aiTapHintText: { fontSize: 11, color: 'rgba(255,116,42,0.5)', fontWeight: '600', fontFamily: 'Helvetica Neue' },
  askAiRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  askAiText: { fontSize: 10, fontWeight: '600', color: 'rgba(255,116,42,0.55)', fontFamily: 'Helvetica Neue' },

  // Metrics row
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  metricWrap: { flex: 1, borderRadius: 22 },
  metricInner: { padding: 18, alignItems: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 15, fontWeight: '800', letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },
  metricLabel: { fontSize: 12, color: w(0.45), fontWeight: '500', textAlign: 'center', fontFamily: 'Helvetica Neue' },

  // Daily Metrics grid
  sectionTitle: { fontSize: 20, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, marginBottom: 14, fontFamily: 'Helvetica Neue' },
  dailyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dailyWrap: { width: '47.5%', borderRadius: 20 },
  dailyInner: { padding: 16 },
  dailyTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dailyIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  changeText: { fontSize: 10, fontWeight: '700', fontFamily: 'Helvetica Neue' },
  dailyLabel: { fontSize: 12, color: w(0.45), fontWeight: '500', marginBottom: 3, fontFamily: 'Helvetica Neue' },
  dailyValue: { fontSize: 22, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },

  // Medication chart card
  chartMuted: { fontSize: 12, color: w(0.45), fontWeight: '500', fontFamily: 'Helvetica Neue' },
  chartBig: { fontSize: 28, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, fontFamily: 'Helvetica Neue' },
  inRangeBadge: { backgroundColor: 'rgba(43,148,80,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  inRangeText: { fontSize: 12, fontWeight: '700', color: '#2B9450', fontFamily: 'Helvetica Neue' },
  dayLabel: { fontSize: 10, fontWeight: '600', color: w(0.35), letterSpacing: 0.5, fontFamily: 'Helvetica Neue' },

  // Progress chart
  progPeriodRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  progPeriodBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  progPeriodBtnActive: { backgroundColor: ORANGE },
  progPeriodLabel: { fontSize: 12, fontWeight: '700', color: w(0.35), fontFamily: 'Helvetica Neue' },
  progPeriodLabelActive: { color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  progCurrentDotRing: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: c.bg },
  progGoalLabel: { fontSize: 10, fontWeight: '600', color: w(0.35), fontFamily: 'Helvetica Neue' },

  // Progress stat card
  progStatSub: { marginTop: 6 },
  progBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,116,42,0.15)', marginTop: 6, overflow: 'hidden' },
  progBarFill: { height: 6, backgroundColor: ORANGE, borderRadius: 3 },

  // Timeline
  timelineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLabel: { fontSize: 13, fontWeight: '700', color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  timelineDate: { fontSize: 11, color: w(0.45), fontWeight: '500', marginTop: 2, fontFamily: 'Helvetica Neue' },
  timelineWeight: { marginLeft: 'auto', fontSize: 18, fontWeight: '800', color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  timelineWeightMuted: { color: w(0.35) },
  timelineDivider: { height: 1, backgroundColor: w(0.06) },

  // Recent Logs card
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
  logHeaderText: { fontSize: 16, fontWeight: '700', color: c.textPrimary, fontFamily: 'Helvetica Neue' },
  logCountBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(255,116,42,0.12)' },
  logCountText: { fontSize: 11, fontWeight: '700', color: ORANGE, fontFamily: 'Helvetica Neue' },
  logEntryList: { paddingHorizontal: 18, paddingBottom: 14 },
  logDivider: { height: 1, backgroundColor: w(0.06) },
  logEntryRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  logEntryIconWrap: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logEntryTitle: { fontSize: 13, fontWeight: '700', color: c.textPrimary, flex: 1, fontFamily: 'Helvetica Neue' },
  logEntryTime: { fontSize: 11, color: w(0.35), fontWeight: '500', flexShrink: 0, marginLeft: 8, fontFamily: 'Helvetica Neue' },
  logEntryDetails: { fontSize: 12, color: w(0.45), lineHeight: 18, marginTop: 3, fontFamily: 'Helvetica Neue' },
  logImpactTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  logImpactText: { fontSize: 10, fontWeight: '700', fontFamily: 'Helvetica Neue' },
  });
};
