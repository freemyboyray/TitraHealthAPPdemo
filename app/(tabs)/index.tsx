import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassBorder } from '@/components/ui/glass-border';
import { RingBreakdown } from '@/components/ring-breakdown';
import { ScoreRing } from '@/components/score-ring';
import { useHealthData } from '@/contexts/health-data';
import {
  ChipData,
  daysSinceInjection,
  generateInsights,
  GLP1_COACH_NOTE,
  GLP1_ROW_NOTES,
  recoveryBreakdown,
  RECOVERY_COACH_NOTE,
  RECOVERY_ROW_NOTES,
  recoveryChips,
  recoveryGradient,
  recoveryMessage,
  supportBreakdown,
  supportChips,
  supportGradient,
  supportMessage,
} from '@/constants/scoring';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';

const ORANGE = '#E8831A';
const DARK = '#FFFFFF';

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
      <View style={[s.hmBody, { borderRadius: 20, backgroundColor: '#1E1B17' }]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
        <GlassBorder r={20} />
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

// ─── Sub-Metric Chips ─────────────────────────────────────────────────────────

function SubMetricChips({ chips, color }: { chips: ChipData[]; color: string }) {
  return (
    <View style={chipStyles.row}>
      {chips.map((chip) => (
        <View key={chip.label} style={chipStyles.chip}>
          <Text style={chipStyles.label}>{chip.label}</Text>
          {chip.glp1Note
            ? <Text style={[chipStyles.value, { color }]}>~{chip.value}</Text>
            : <Text style={chipStyles.value}>{chip.value}</Text>}
          <View style={chipStyles.barTrack}>
            <View style={[chipStyles.barFill, { width: `${chip.pct * 100}%` as any, backgroundColor: color }]} />
          </View>
          {chip.glp1Note && <Text style={[chipStyles.glp1Tag, { color }]}>{chip.glp1Note}</Text>}
        </View>
      ))}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  chip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  label: { fontSize: 9, fontWeight: '600', color: '#9A9490', letterSpacing: 0.3, marginBottom: 3 },
  value: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', marginBottom: 5, textAlign: 'center' },
  barTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: { height: 4, borderRadius: 2 },
  glp1Tag: { fontSize: 8, fontWeight: '700', marginTop: 4, letterSpacing: 0.2 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { onScroll } = useTabBarVisibility();
  const { recoveryScore, supportScore, lastLogAction, wearable, actuals, targets, profile } = useHealthData();

  const [recoveryBreakdownVisible, setRecoveryBreakdownVisible] = useState(false);
  const [supportBreakdownVisible, setSupportBreakdownVisible] = useState(false);

  const recovGrad = recoveryGradient(recoveryScore);
  const suppGrad  = supportGradient(supportScore);
  const recChips  = recoveryChips(wearable);
  const supChips  = supportChips(actuals, targets);

  const insights = generateInsights(recoveryScore, supportScore, wearable, actuals, targets);

  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const dayNum = daysSinceInjection(profile.lastInjectionDate);
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
    <View style={{ flex: 1, backgroundColor: '#141210' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >

          {/* ── Header ── */}
          <Text style={s.dateTitle}>{todayLabel}</Text>
          <Text style={[s.dateSub, phaseOverdue && { color: '#E53E3E' }]}>{phaseLabel}</Text>

          {/* ── Score Card ── */}
          <View style={[s.cardWrap, { marginBottom: 16 }]}>
            <View style={[s.cardBody, { backgroundColor: '#1E1B17' }]}>
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.darkOverlay]} />
              <GlassBorder />

              <View style={s.scoreCard}>
                <Text style={s.scoreCardTitle}>Recovery / Readiness</Text>

                {/* Primary ring — Body Response */}
                <View style={{ alignItems: 'center' }}>
                  <ScoreRing
                    score={recoveryScore}
                    size={160}
                    strokeWidth={11}
                    gradientStart={recovGrad.start}
                    gradientEnd={recovGrad.end}
                    label="BODY RESPONSE"
                    message={recoveryMessage(recoveryScore)}
                    onTap={() => setRecoveryBreakdownVisible(true)}
                    ripple={lastLogAction === 'water'}
                    proteinPulse={lastLogAction === 'protein'}
                  />
                  <SubMetricChips chips={recChips} color={recovGrad.end} />
                </View>

                <View style={{ height: 20 }} />

                {/* Secondary ring — GLP-1 Amplifier */}
                <View style={{ alignItems: 'center' }}>
                  <ScoreRing
                    score={supportScore}
                    size={110}
                    strokeWidth={9}
                    gradientStart={suppGrad.start}
                    gradientEnd={suppGrad.end}
                    label="GLP-1 AMP"
                    message={supportMessage(supportScore)}
                    onTap={() => setSupportBreakdownVisible(true)}
                    glowPulse={lastLogAction === 'injection'}
                    ripple={lastLogAction === 'water'}
                    proteinPulse={lastLogAction === 'protein'}
                  />
                  <SubMetricChips chips={supChips} color={suppGrad.end} />
                </View>

                {/* Recovery alert */}
                {recoveryScore < 40 && (
                  <View style={s.alertBadge}>
                    <Text style={s.alertText}>⚠ Stress detected · Focus on rest</Text>
                  </View>
                )}

                {/* Stats row */}
                <View style={s.statsRow}>
                  <View style={s.statItem}>
                    <MaterialIcons name="restaurant" size={14} color={ORANGE} />
                    <Text style={s.statItemText}>
                      <Text style={s.statBold}>{actuals.proteinG}</Text>
                      <Text style={s.statLight}>/{targets.proteinG}g</Text>
                    </Text>
                  </View>
                  <View style={s.statDot} />
                  <View style={s.statItem}>
                    <Ionicons name="water-outline" size={14} color="#5B8BF5" />
                    <Text style={s.statItemText}>
                      <Text style={s.statBold}>{Math.round(actuals.waterMl / 100) / 10}</Text>
                      <Text style={s.statLight}>/{Math.round(targets.waterMl / 100) / 10}L</Text>
                    </Text>
                  </View>
                  <View style={s.statDot} />
                  <View style={s.statItem}>
                    <MaterialIcons name="directions-walk" size={14} color="#2B9450" />
                    <Text style={s.statItemText}>
                      <Text style={s.statBold}>{actuals.steps.toLocaleString()}</Text>
                      <Text style={s.statLight}>/{targets.steps.toLocaleString()}</Text>
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ── Today's Focuses ── */}
          <Text style={s.sectionTitle}>Today's Focuses</Text>

          {[
            {
              icon: <MaterialIcons name="restaurant" size={22} color={ORANGE} />,
              label: 'High Protein Meal',
              badge: '+3% Score',
            },
            {
              icon: <MaterialIcons name="trending-up" size={22} color={ORANGE} />,
              label: '15 min Walk',
              badge: '+2% Score',
            },
            {
              icon: <Ionicons name="water-outline" size={22} color={ORANGE} />,
              label: 'Hydration Goal',
              badge: '+1% Score',
            },
          ].map((item) => (
            <View key={item.label} style={[s.focusWrap, { marginBottom: 12 }]}>
              <View style={[s.focusBody, { backgroundColor: '#1E1B17' }]}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={[StyleSheet.absoluteFillObject, s.darkOverlay]} />
                <GlassBorder r={20} />
                <View style={s.focusRow}>
                  <View style={s.focusIconWrap}>{item.icon}</View>
                  <Text style={s.focusLabel}>{item.label}</Text>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{item.badge}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}

          {/* ── Insights Card ── */}
          <View style={[s.cardWrap, { marginBottom: 24, marginTop: 8 }]}>
            <View style={[s.cardBody, { backgroundColor: '#1E1B17' }]}>
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.darkOverlay]} />
              <GlassBorder />
              <View style={{ padding: 20 }}>
                <View style={s.insightsHead}>
                  <Text style={s.insightsTitle}>Insights</Text>
                  <Text style={s.shotPhase}>{insights[0]?.phase ?? 'TODAY'}</Text>
                </View>
                {insights.map((b, i) => (
                  <View key={i} style={s.bulletRow}>
                    <View style={[s.bullet, { backgroundColor: ORANGE }]} />
                    <Text style={s.bulletText}>{b.text}</Text>
                  </View>
                ))}
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
      </SafeAreaView>

      {/* Breakdown sheets */}
      <RingBreakdown
        visible={recoveryBreakdownVisible}
        title="Recovery Breakdown"
        color={recovGrad.end}
        rows={recoveryBreakdown(wearable)}
        rowNotes={RECOVERY_ROW_NOTES}
        coachNote={RECOVERY_COACH_NOTE}
        onClose={() => setRecoveryBreakdownVisible(false)}
      />
      <RingBreakdown
        visible={supportBreakdownVisible}
        title="GLP-1 Support Breakdown"
        color={suppGrad.end}
        rows={supportBreakdown(actuals, targets)}
        rowNotes={GLP1_ROW_NOTES}
        coachNote={GLP1_COACH_NOTE}
        onClose={() => setSupportBreakdownVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 },

  // Header
  dateTitle: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', letterSpacing: -1, marginBottom: 4 },
  dateSub: { fontSize: 14, fontWeight: '500', color: '#9A9490', textAlign: 'center', marginBottom: 28 },

  // Glass card containers
  cardWrap: { borderRadius: 28, ...glassShadow },
  cardBody: { borderRadius: 28, overflow: 'hidden' },

  // Dark overlay
  darkOverlay: { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.04)' },

  // Score card inner
  scoreCard: { padding: 24 },
  scoreCardTitle: { fontSize: 13, fontWeight: '600', color: '#9A9490', letterSpacing: 0.3, textAlign: 'center', marginBottom: 18 },

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
  alertText: { fontSize: 12, fontWeight: '700', color: '#E53E3E' },

  // Stats row
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statItemText: {},
  statBold: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  statLight: { fontSize: 12, color: '#5A5754', fontWeight: '400' },
  statDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#3A3735' },

  // Insights card
  insightsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  insightsTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  shotPhase: { fontSize: 10, fontWeight: '700', color: '#7BA3F7', letterSpacing: 1.2 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bullet: { width: 7, height: 7, borderRadius: 3.5, marginRight: 10 },
  bulletText: { fontSize: 15, color: '#9A9490', fontWeight: '400', flex: 1 },
  insightsFooter: { fontSize: 12, color: '#5A5754', fontWeight: '500', marginTop: 6, lineHeight: 18 },

  // Section title
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 14 },

  // Focus cards
  focusWrap: { borderRadius: 20, ...glassShadow },
  focusBody: { borderRadius: 20, overflow: 'hidden' },
  focusRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  focusIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(232,131,26,0.12)',
    borderWidth: 1, borderColor: 'rgba(232,131,26,0.20)',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  focusLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  badge: {
    backgroundColor: 'rgba(50,168,82,0.12)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(50,168,82,0.25)',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#2B9450' },

  // Health Monitor grid
  hmGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  hmWrap: { width: '47.5%', borderRadius: 20 },
  hmBody: { overflow: 'hidden' },
  hmInner: { padding: 16 },
  hmTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  hmIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(232,131,26,0.12)', alignItems: 'center', justifyContent: 'center' },
  hmBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  hmBadgeText: { fontSize: 9, fontWeight: '700' },
  hmLabel: { fontSize: 12, color: '#9A9490', fontWeight: '500', marginBottom: 3 },
  hmValue: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  hmUnit: { fontSize: 13, fontWeight: '500', color: '#5A5754', letterSpacing: 0 },
});
