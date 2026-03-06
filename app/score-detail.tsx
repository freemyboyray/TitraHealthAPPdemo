import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScoreRing } from '@/components/score-ring';
import { useHealthData } from '@/contexts/health-data';
import {
  daysSinceInjection,
  GLP1_COACH_NOTE,
  GLP1_ROW_NOTES,
  recoveryBreakdown,
  recoveryColor,
  recoveryGradient,
  recoveryMessage,
  RECOVERY_COACH_NOTE,
  RECOVERY_ROW_NOTES,
  supportBreakdown,
  supportColor,
  supportGradient,
  supportMessage,
} from '@/constants/scoring';

const FF = 'Helvetica Neue';

const glassShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 24,
  elevation: 8,
};

// ─── Metric Card ──────────────────────────────────────────────────────────────

type MetricCardProps = {
  icon: React.ReactNode;
  label: string;
  pts: number;
  maxPts: number;
  value: string;
  pct: number;
  color: string;
  note: string;
};

function MetricCard({ icon, label, pts, maxPts, value, pct, color, note }: MetricCardProps) {
  return (
    <View style={[c.wrap, glassShadow]}>
      <View style={c.body}>
        <View style={c.inner}>
          <View style={c.topRow}>
            <View style={c.iconLabel}>
              <View style={c.iconWrap}>{icon}</View>
              <Text style={c.label}>{label}</Text>
            </View>
            <Text style={[c.pts, { color }]}>
              {pts}
              <Text style={c.ptsMax}> / {maxPts} pts</Text>
            </Text>
          </View>
          <Text style={c.value}>{value}</Text>
          <View style={c.barTrack}>
            <View style={[c.barFill, { width: `${Math.min(pct, 1) * 100}%` as any, backgroundColor: color }]} />
          </View>
          <Text style={c.note}>{note}</Text>
        </View>
      </View>
    </View>
  );
}

const c = StyleSheet.create({
  wrap: { borderRadius: 20, marginBottom: 12 },
  body: {
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  inner: { padding: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', fontFamily: FF },
  pts: { fontSize: 14, fontWeight: '800', fontFamily: FF },
  ptsMax: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.35)', fontFamily: FF },
  value: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 12, fontFamily: FF },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 },
  barFill: { height: 6, borderRadius: 3 },
  note: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 18, fontWeight: '400', fontFamily: FF },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScoreDetailScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const isRecovery = type === 'recovery';

  const { recoveryScore, supportScore, wearable, actuals, targets, profile } = useHealthData();

  const score   = isRecovery ? recoveryScore : supportScore;
  const grad    = isRecovery ? recoveryGradient(score) : supportGradient(score);
  const accent  = isRecovery ? recoveryColor(score)    : supportColor(score);
  const message = isRecovery ? recoveryMessage(score)  : supportMessage(score);
  const title   = isRecovery ? 'Recovery'              : 'GLP-1 Amplifier';
  const coachNote = isRecovery ? RECOVERY_COACH_NOTE   : GLP1_COACH_NOTE;

  const dayNum  = daysSinceInjection(profile.lastInjectionDate);
  const freq    = profile.injectionFrequencyDays;
  const phaseLabel = (() => {
    if (dayNum === 1) return 'Shot Day';
    if (dayNum <= 3) return `Shot Phase · Day ${dayNum}`;
    if (dayNum < freq) return `Recovery Day ${dayNum}`;
    if (dayNum === freq) return 'Shot Day Tomorrow';
    return 'Shot Overdue';
  })();

  const targetLabel = isRecovery ? 'Target: 70+' : 'Target: 80+';
  const todayLabel  = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const ICON_SIZE = 18;

  let cards: MetricCardProps[] = [];

  if (isRecovery) {
    const rows = recoveryBreakdown(wearable);
    const h = Math.floor(wearable.sleepMinutes / 60);
    const m = wearable.sleepMinutes % 60;
    cards = [
      {
        icon: <Ionicons name="moon-outline" size={ICON_SIZE} color={accent} />,
        label: 'Sleep',
        pts: rows[0].actual, maxPts: rows[0].max,
        value: `${h}h ${m}m`,
        pct: rows[0].actual / rows[0].max,
        color: accent,
        note: RECOVERY_ROW_NOTES[0],
      },
      {
        icon: <MaterialIcons name="show-chart" size={ICON_SIZE} color={accent} />,
        label: 'HRV',
        pts: rows[1].actual, maxPts: rows[1].max,
        value: `${wearable.hrvMs} ms`,
        pct: rows[1].actual / rows[1].max,
        color: accent,
        note: RECOVERY_ROW_NOTES[1],
      },
      {
        icon: <Ionicons name="heart-outline" size={ICON_SIZE} color={accent} />,
        label: 'Resting HR',
        pts: rows[2].actual, maxPts: rows[2].max,
        value: `${wearable.restingHR} bpm`,
        pct: rows[2].actual / rows[2].max,
        color: accent,
        note: RECOVERY_ROW_NOTES[2],
      },
      {
        icon: <MaterialIcons name="bloodtype" size={ICON_SIZE} color={accent} />,
        label: 'SpO\u2082',
        pts: rows[3].actual, maxPts: rows[3].max,
        value: `${wearable.spo2Pct}%`,
        pct: rows[3].actual / rows[3].max,
        color: accent,
        note: RECOVERY_ROW_NOTES[3],
      },
    ];
  } else {
    const rows = supportBreakdown(actuals, targets);
    const waterOz  = Math.round(actuals.waterMl / 29.57);
    const targetOz = Math.round(targets.waterMl / 29.57);
    cards = [
      {
        icon: <MaterialIcons name="fitness-center" size={ICON_SIZE} color={accent} />,
        label: 'Protein',
        pts: rows[0].actual, maxPts: rows[0].max,
        value: `${actuals.proteinG}g / ${targets.proteinG}g`,
        pct: rows[0].actual / rows[0].max,
        color: accent,
        note: GLP1_ROW_NOTES[0],
      },
      {
        icon: <Ionicons name="water-outline" size={ICON_SIZE} color={accent} />,
        label: 'Hydration',
        pts: rows[1].actual, maxPts: rows[1].max,
        value: `${waterOz}oz / ${targetOz}oz`,
        pct: rows[1].actual / rows[1].max,
        color: accent,
        note: GLP1_ROW_NOTES[1],
      },
      {
        icon: <Ionicons name="walk-outline" size={ICON_SIZE} color={accent} />,
        label: 'Movement',
        pts: rows[2].actual, maxPts: rows[2].max,
        value: `${actuals.steps.toLocaleString()} steps`,
        pct: rows[2].actual / rows[2].max,
        color: accent,
        note: GLP1_ROW_NOTES[2],
      },
      {
        icon: <MaterialIcons name="nutrition" size={ICON_SIZE} color={accent} />,
        label: 'Fiber',
        pts: rows[3].actual, maxPts: rows[3].max,
        value: `${actuals.fiberG}g / ${targets.fiberG}g`,
        pct: rows[3].actual / rows[3].max,
        color: accent,
        note: GLP1_ROW_NOTES[3],
      },
      {
        icon: <FontAwesome5 name="syringe" size={ICON_SIZE - 2} color={accent} />,
        label: 'Medication',
        pts: rows[4].actual, maxPts: rows[4].max,
        value: actuals.injectionLogged ? 'Logged \u2713' : 'Not logged',
        pct: rows[4].actual / rows[4].max,
        color: accent,
        note: 'Logging your injection unlocks the full 15-point medication bonus and enables phase-aware coaching.',
      },
    ];
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Nav bar */}
        <View style={s.navBar}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={s.navCenter}>
            <Text style={s.navTitle}>{title}</Text>
            <Text style={s.navDate}>{todayLabel}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Hero ring */}
          <View style={s.hero}>
            <ScoreRing
              score={score}
              size={180}
              strokeWidth={14}
              gradientStart={grad.start}
              gradientEnd={grad.end}
              label={isRecovery ? 'RECOVERY' : 'GLP-1 AMP'}
              message={message}
              onTap={() => {}}
            />
            <View style={s.phaseStrip}>
              <Text style={s.phaseText}>{targetLabel} · {phaseLabel}</Text>
            </View>
          </View>

          {/* Section label */}
          <Text style={s.sectionLabel}>SCORE BREAKDOWN</Text>

          {/* Metric cards */}
          {cards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}

          {/* Divider */}
          <View style={s.divider} />

          {/* Coach note */}
          <Text style={s.sectionLabel}>WHAT MOVES THIS SCORE</Text>
          <View style={[s.coachWrap, glassShadow]}>
            <View style={s.coachBody}>
              <View style={s.coachInner}>
                <Text style={s.coachText}>{coachNote}</Text>
              </View>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3, fontFamily: FF },
  navDate: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.40)', marginTop: 1, fontFamily: FF },

  content: { paddingHorizontal: 20, paddingBottom: 40 },

  hero: { alignItems: 'center', paddingVertical: 24 },
  phaseStrip: { marginTop: 14 },
  phaseText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.2, fontFamily: FF },

  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: '#FF742A',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginBottom: 14, marginTop: 4, fontFamily: FF,
  },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 20 },

  coachWrap: { borderRadius: 20 },
  coachBody: {
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  coachInner: { padding: 18 },
  coachText: { fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 22, fontWeight: '400', fontFamily: FF },
});
