import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RingBreakdown } from '@/components/ring-breakdown';
import { ScoreRing } from '@/components/score-ring';
import { useHealthData } from '@/contexts/health-data';
import {
  generateInsights,
  recoveryBreakdown,
  recoveryColor,
  recoveryMessage,
  supportBreakdown,
  supportColor,
  supportMessage,
} from '@/constants/scoring';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';

const TERRACOTTA = '#D67455';
const DARK = '#1A1A1A';

const glassShadow = {
  shadowColor: '#1A1A1A',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
  elevation: 8,
};

// ─── Glass primitives ─────────────────────────────────────────────────────────

function GlassBorder({ r = 28 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: r,
        borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.80)',
        borderLeftColor: 'rgba(255,255,255,0.55)',
        borderRightColor: 'rgba(255,255,255,0.18)',
        borderBottomColor: 'rgba(255,255,255,0.10)',
      }}
    />
  );
}

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
  good:     { bg: 'rgba(43,148,80,0.12)',    text: '#2B9450' },
  normal:   { bg: 'rgba(91,139,245,0.12)',   text: '#5B8BF5' },
  low:      { bg: 'rgba(232,150,12,0.12)',   text: '#E8960C' },
  elevated: { bg: 'rgba(220,50,50,0.10)',    text: '#DC3232' },
};

// ─── Health Monitor Card ──────────────────────────────────────────────────────

function HealthMonitorCard({ metric }: { metric: HealthMetric }) {
  const ss = hmStatusStyle[metric.status];
  const icon = metric.iconSet === 'Ionicons'
    ? <Ionicons name={metric.iconName as any} size={20} color={TERRACOTTA} />
    : <MaterialIcons name={metric.iconName as any} size={20} color={TERRACOTTA} />;

  return (
    <View style={[s.hmWrap, glassShadow]}>
      <View style={[s.hmBody, { borderRadius: 20 }]}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.42)' }]} />
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { onScroll } = useTabBarVisibility();
  const { recoveryScore, supportScore, lastLogAction, wearable, actuals, targets } = useHealthData();

  const [recoveryBreakdownVisible, setRecoveryBreakdownVisible] = useState(false);
  const [supportBreakdownVisible, setSupportBreakdownVisible] = useState(false);

  const recovColor = recoveryColor(recoveryScore);
  const suppColor  = supportColor(supportScore);

  const insights = generateInsights(recoveryScore, supportScore, wearable, actuals, targets);

  return (
    <View style={{ flex: 1, backgroundColor: '#F0EAE4' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >

          {/* ── Header ── */}
          <Text style={s.dateTitle}>October 24</Text>
          <Text style={s.dateSub}>Shot Day · Day {2}</Text>

          {/* ── Score Card ── */}
          <View style={[s.cardWrap, { marginBottom: 16 }]}>
            <View style={s.cardBody}>
              <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.whiteOverlay]} />
              <GlassBorder />

              <View style={s.scoreCard}>
                <Text style={s.scoreCardTitle}>Recovery / Readiness</Text>

                <View style={s.ringsRow}>
                  {/* Recovery Ring — larger */}
                  <ScoreRing
                    score={recoveryScore}
                    size={148}
                    strokeWidth={10}
                    color={recovColor}
                    label="Recovery"
                    message={recoveryMessage(recoveryScore)}
                    onTap={() => setRecoveryBreakdownVisible(true)}
                    ripple={lastLogAction === 'water'}
                    proteinPulse={lastLogAction === 'protein'}
                  />

                  <View style={s.ringDivider} />

                  {/* GLP-1 Support Ring — smaller */}
                  <ScoreRing
                    score={supportScore}
                    size={120}
                    strokeWidth={9}
                    color={suppColor}
                    label="GLP-1"
                    message={supportMessage(supportScore)}
                    onTap={() => setSupportBreakdownVisible(true)}
                    glowPulse={lastLogAction === 'injection'}
                    ripple={lastLogAction === 'water'}
                    proteinPulse={lastLogAction === 'protein'}
                  />
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
                    <MaterialIcons name="restaurant" size={14} color={TERRACOTTA} />
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
              icon: <MaterialIcons name="restaurant" size={22} color={TERRACOTTA} />,
              label: 'High Protein Meal',
              badge: '+3% Score',
            },
            {
              icon: <MaterialIcons name="trending-up" size={22} color={TERRACOTTA} />,
              label: '15 min Walk',
              badge: '+2% Score',
            },
            {
              icon: <Ionicons name="water-outline" size={22} color={TERRACOTTA} />,
              label: 'Hydration Goal',
              badge: '+1% Score',
            },
          ].map((item) => (
            <View key={item.label} style={[s.focusWrap, { marginBottom: 12 }]}>
              <View style={s.focusBody}>
                <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
                <View style={[StyleSheet.absoluteFillObject, s.whiteOverlay]} />
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
            <View style={s.cardBody}>
              <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.whiteOverlay]} />
              <GlassBorder />
              <View style={{ padding: 20 }}>
                <View style={s.insightsHead}>
                  <Text style={s.insightsTitle}>Insights</Text>
                  <Text style={s.shotPhase}>{insights[0]?.phase ?? 'TODAY'}</Text>
                </View>
                {insights.map((b, i) => (
                  <View key={i} style={s.bulletRow}>
                    <View style={[s.bullet, { backgroundColor: TERRACOTTA }]} />
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
        color={recovColor}
        rows={recoveryBreakdown(wearable)}
        onClose={() => setRecoveryBreakdownVisible(false)}
      />
      <RingBreakdown
        visible={supportBreakdownVisible}
        title="GLP-1 Support Breakdown"
        color={suppColor}
        rows={supportBreakdown(actuals, targets)}
        onClose={() => setSupportBreakdownVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 },

  // Header
  dateTitle: { fontSize: 36, fontWeight: '800', color: DARK, textAlign: 'center', letterSpacing: -1, marginBottom: 4 },
  dateSub: { fontSize: 14, fontWeight: '500', color: '#888888', textAlign: 'center', marginBottom: 28 },

  // Glass card containers
  cardWrap: { borderRadius: 28, ...glassShadow },
  cardBody: { borderRadius: 28, overflow: 'hidden' },

  // Color overlays
  whiteOverlay: { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.45)' },

  // Score card inner
  scoreCard: { padding: 24 },
  scoreCardTitle: { fontSize: 13, fontWeight: '600', color: '#888', letterSpacing: 0.3, textAlign: 'center', marginBottom: 18 },

  // Rings row
  ringsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ringDivider: { width: 20 },

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
  statBold: { fontSize: 14, fontWeight: '800', color: DARK },
  statLight: { fontSize: 12, color: '#AAAAAA', fontWeight: '400' },
  statDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#CCC' },

  // Insights card
  insightsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  insightsTitle: { fontSize: 17, fontWeight: '700', color: DARK },
  shotPhase: { fontSize: 10, fontWeight: '700', color: '#5B8BF5', letterSpacing: 1.2 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bullet: { width: 7, height: 7, borderRadius: 3.5, marginRight: 10 },
  bulletText: { fontSize: 15, color: '#444444', fontWeight: '400', flex: 1 },
  insightsFooter: { fontSize: 12, color: '#AAAAAA', fontWeight: '500', marginTop: 6, lineHeight: 18 },

  // Section title
  sectionTitle: { fontSize: 22, fontWeight: '800', color: DARK, letterSpacing: -0.5, marginBottom: 14 },

  // Focus cards
  focusWrap: { borderRadius: 20, ...glassShadow },
  focusBody: { borderRadius: 20, overflow: 'hidden' },
  focusRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  focusIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(214,116,85,0.10)',
    borderWidth: 1, borderColor: 'rgba(214,116,85,0.18)',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  focusLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: DARK },
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
  hmIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(214,116,85,0.10)', alignItems: 'center', justifyContent: 'center' },
  hmBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  hmBadgeText: { fontSize: 9, fontWeight: '700' },
  hmLabel: { fontSize: 12, color: '#888888', fontWeight: '500', marginBottom: 3 },
  hmValue: { fontSize: 22, fontWeight: '800', color: DARK, letterSpacing: -0.5 },
  hmUnit: { fontSize: 13, fontWeight: '500', color: '#AAAAAA', letterSpacing: 0 },
});
