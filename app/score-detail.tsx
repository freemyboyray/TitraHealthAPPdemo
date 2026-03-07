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
  getGLP1RowNotes,
  getRecoveryRowNotes,
  getShotPhase,
  recoveryBreakdown,
  recoveryColor,
  recoveryGradient,
  recoveryMessage,
  RECOVERY_COACH_NOTE,
  ShotPhase,
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

// ─── Tier Bar Colors ──────────────────────────────────────────────────────────

function tierBarColor(pct: number): string {
  if (pct >= 0.8) return '#27AE60';  // green  — optimal
  if (pct >= 0.5) return '#F39C12';  // amber  — fair
  return '#E74C3C';                  // red    — low
}

function tierStatusLabel(pct: number): string {
  if (pct >= 0.8) return 'Optimal';
  if (pct >= 0.5) return 'Fair';
  return 'Low';
}

function tierStatusColor(pct: number): string {
  if (pct >= 0.8) return '#27AE60';
  if (pct >= 0.5) return '#F39C12';
  return '#E74C3C';
}

// ─── Phase Interpretation Banner ──────────────────────────────────────────────

type BannerContent = { heading: string; body: string };

function getPhaseInterpretation(
  isRecovery: boolean,
  phase: ShotPhase,
  score: number,
): BannerContent {
  if (isRecovery) {
    const phaseLabel =
      phase === 'peak'    ? 'Peak Phase' :
      phase === 'shot'    ? 'Shot Day' :
      phase === 'balance' ? 'Balance Phase' : 'Reset Phase';

    if (phase === 'peak') {
      return {
        heading: `Recovery — ${phaseLabel}`,
        body: `HRV and RHR are adjusted for expected GLP-1 effects. A score of ${score} during peak days (3–4) is equivalent to ~${score + 8} on a trough day. Focus on light movement and hydration.`,
      };
    }
    if (phase === 'shot') {
      return {
        heading: `Recovery — ${phaseLabel}`,
        body: `HRV and RHR are adjusted for early medication activity. Your body is beginning to process the dose — rest, hydrate, and eat adequate protein today.`,
      };
    }
    return {
      heading: `Recovery — ${phaseLabel}`,
      body: `No medication adjustment applied today. Your recovery score reflects your biometrics directly, without GLP-1 phase offsets.`,
    };
  }

  const phaseLabel =
    phase === 'peak'    ? 'Peak Phase' :
    phase === 'shot'    ? 'Shot Day' :
    phase === 'balance' ? 'Balance Phase' : 'Reset Phase';

  if (phase === 'peak') {
    return {
      heading: `GLP-1 Amplifier — ${phaseLabel}`,
      body: `Medication is at peak effectiveness today (days 3–4). Prioritize rest and hydration — your body is doing the most work right now.`,
    };
  }
  if (phase === 'shot') {
    return {
      heading: `GLP-1 Amplifier — ${phaseLabel}`,
      body: `Injection day. Log your shot to unlock the full 15-point bonus. Protein and hydration are most critical in the first 24 hours.`,
    };
  }
  return {
    heading: `GLP-1 Amplifier — ${phaseLabel}`,
    body: `Medication levels are ${phase === 'reset' ? 'tapering toward your next shot' : 'stabilizing'}. Consistent protein and movement build on the work your medication is doing.`,
  };
}

function PhaseInterpretationBanner({
  isRecovery,
  phase,
  score,
}: {
  isRecovery: boolean;
  phase: ShotPhase;
  score: number;
}) {
  const content = getPhaseInterpretation(isRecovery, phase, score);
  return (
    <View style={[pb.wrap, glassShadow]}>
      <View style={pb.body}>
        <View style={pb.inner}>
          <Text style={pb.heading}>{content.heading}</Text>
          <Text style={pb.bodyText}>{content.body}</Text>
        </View>
      </View>
    </View>
  );
}

const pb = StyleSheet.create({
  wrap: { borderRadius: 16, marginBottom: 20 },
  body: {
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(255,116,42,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(255,116,42,0.30)',
  },
  inner: { padding: 16 },
  heading: {
    fontSize: 13, fontWeight: '700', color: '#FF742A',
    letterSpacing: 0.1, marginBottom: 6, fontFamily: FF,
  },
  bodyText: {
    fontSize: 13, color: 'rgba(255,255,255,0.60)',
    lineHeight: 19, fontWeight: '400', fontFamily: FF,
  },
});

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
  const barColor    = tierBarColor(pct);
  const statusLabel = tierStatusLabel(pct);
  const statusColor = tierStatusColor(pct);
  return (
    <View style={[c.wrap, glassShadow]}>
      <View style={c.body}>
        <View style={c.inner}>
          <View style={c.topRow}>
            <View style={c.iconLabel}>
              <View style={c.iconWrap}>{icon}</View>
              <Text style={c.label}>{label}</Text>
            </View>
            <View style={c.ptsGroup}>
              <Text style={[c.statusBadge, { color: statusColor, borderColor: statusColor }]}>
                {statusLabel}
              </Text>
              <Text style={[c.pts, { color }]}>
                {pts}
                <Text style={c.ptsMax}> / {maxPts} pts</Text>
              </Text>
            </View>
          </View>
          <Text style={c.value}>{value}</Text>
          <View style={c.barTrack}>
            <View style={[c.barFill, { width: `${Math.min(pct, 1) * 100}%` as any, backgroundColor: barColor }]} />
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
  ptsGroup: { alignItems: 'flex-end', gap: 4 },
  statusBadge: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
    borderWidth: 1, borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
    fontFamily: FF, overflow: 'hidden',
  },
  pts: { fontSize: 14, fontWeight: '800', fontFamily: FF },
  ptsMax: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.35)', fontFamily: FF },
  value: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 12, fontFamily: FF },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 },
  barFill: { height: 6, borderRadius: 3 },
  note: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 18, fontWeight: '400', fontFamily: FF },
});

// ─── Today's Primary Focus ─────────────────────────────────────────────────────

function PrimaryFocusCard({ cards }: { cards: MetricCardProps[] }) {
  const focus = cards.reduce(
    (worst, card) => (card.maxPts - card.pts > worst.maxPts - worst.pts ? card : worst),
    cards[0],
  );
  const gap = focus.maxPts - focus.pts;
  const allOptimal = gap === 0;

  return (
    <View style={[pf.wrap, glassShadow]}>
      <View style={pf.body}>
        <View style={pf.inner}>
          <Text style={pf.sectionLabel}>TODAY'S PRIMARY FOCUS</Text>
          {allOptimal ? (
            <Text style={pf.allGood}>All metrics are optimal — maintain your current habits.</Text>
          ) : (
            <>
              <Text style={pf.focusLabel}>{focus.label}</Text>
              <Text style={pf.detail}>
                {focus.pts} / {focus.maxPts} pts scored{' '}
                <Text style={pf.ptsAvail}>· +{gap} pts available</Text>
              </Text>
              <Text style={pf.note}>{focus.note}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const pf = StyleSheet.create({
  wrap: { borderRadius: 16, marginTop: 4, marginBottom: 4 },
  body: {
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  inner: { padding: 16 },
  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: '#FF742A',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginBottom: 10, fontFamily: FF,
  },
  focusLabel: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3, marginBottom: 4, fontFamily: FF },
  detail: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 8, fontFamily: FF },
  ptsAvail: { color: '#FF742A', fontWeight: '700' },
  note: { fontSize: 12, color: 'rgba(255,255,255,0.40)', lineHeight: 18, fontFamily: FF },
  allGood: { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 20, fontFamily: FF },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScoreDetailScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const isRecovery = type === 'recovery';

  const { recoveryScore, supportScore, wearable, actuals, targets, profile } = useHealthData();

  const score     = isRecovery ? recoveryScore : supportScore;
  // Fixed brand identity colors — Recovery=orange, Readiness=white/silver (matches home screen rings)
  const grad      = isRecovery
    ? { start: '#D4601A', end: '#FF742A' }
    : { start: '#B0B0B0', end: '#FFFFFF' };
  const accent    = isRecovery ? recoveryColor(score)    : supportColor(score);
  const message   = isRecovery ? recoveryMessage(score)  : supportMessage(score);
  const title     = isRecovery ? 'Recovery'              : 'GLP-1 Amplifier';
  const coachNote = isRecovery ? RECOVERY_COACH_NOTE     : GLP1_COACH_NOTE;

  const dayNum     = daysSinceInjection(profile.lastInjectionDate);
  const freq       = profile.injectionFrequencyDays;
  const phase      = getShotPhase(dayNum);
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

  // Phase-aware notes
  const recoveryNotes = getRecoveryRowNotes(phase);
  const glp1Notes     = getGLP1RowNotes(phase);

  let cards: MetricCardProps[] = [];

  if (isRecovery) {
    const rows = recoveryBreakdown(wearable, phase);
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
        note: recoveryNotes[0],
      },
      {
        icon: <MaterialIcons name="show-chart" size={ICON_SIZE} color={accent} />,
        label: 'HRV',
        pts: rows[1].actual, maxPts: rows[1].max,
        value: `${wearable.hrvMs} ms`,
        pct: rows[1].actual / rows[1].max,
        color: accent,
        note: recoveryNotes[1],
      },
      {
        icon: <Ionicons name="heart-outline" size={ICON_SIZE} color={accent} />,
        label: 'Resting HR',
        pts: rows[2].actual, maxPts: rows[2].max,
        value: `${wearable.restingHR} bpm`,
        pct: rows[2].actual / rows[2].max,
        color: accent,
        note: recoveryNotes[2],
      },
      {
        icon: <MaterialIcons name="bloodtype" size={ICON_SIZE} color={accent} />,
        label: 'SpO\u2082',
        pts: rows[3].actual, maxPts: rows[3].max,
        value: `${wearable.spo2Pct}%`,
        pct: rows[3].actual / rows[3].max,
        color: accent,
        note: recoveryNotes[3],
      },
    ];
    // Respiratory rate card — present when HealthKit supplies the value
    if (rows.length > 4) {
      cards.push({
        icon: <MaterialIcons name="air" size={ICON_SIZE} color={accent} />,
        label: 'Resp. Rate',
        pts: rows[4].actual, maxPts: rows[4].max,
        value: `${wearable.respRateRpm} rpm`,
        pct: rows[4].actual / rows[4].max,
        color: accent,
        note: 'Normal resting respiratory rate is 12–20 bpm. Elevated rate can signal illness, stress, or altitude effects.',
      });
    }
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
        note: glp1Notes[0],
      },
      {
        icon: <Ionicons name="water-outline" size={ICON_SIZE} color={accent} />,
        label: 'Hydration',
        pts: rows[1].actual, maxPts: rows[1].max,
        value: `${waterOz}oz / ${targetOz}oz`,
        pct: rows[1].actual / rows[1].max,
        color: accent,
        note: glp1Notes[1],
      },
      {
        icon: <Ionicons name="walk-outline" size={ICON_SIZE} color={accent} />,
        label: 'Movement',
        pts: rows[2].actual, maxPts: rows[2].max,
        value: `${actuals.steps.toLocaleString()} steps`,
        pct: rows[2].actual / rows[2].max,
        color: accent,
        note: glp1Notes[2],
      },
      {
        icon: <MaterialIcons name="nutrition" size={ICON_SIZE} color={accent} />,
        label: 'Fiber',
        pts: rows[3].actual, maxPts: rows[3].max,
        value: `${actuals.fiberG}g / ${targets.fiberG}g`,
        pct: rows[3].actual / rows[3].max,
        color: accent,
        note: glp1Notes[3],
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
          <Pressable
            onPress={() => router.push(`/ai-chat?type=${type}`)}
            style={s.chatBtn}
            hitSlop={12}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFFFFF" />
          </Pressable>
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
              message=""
              onTap={() => {}}
            />
            <View style={s.phaseStrip}>
              <Text style={s.messageText}>{message}</Text>
              <Text style={s.targetText}>{targetLabel}</Text>
              <Text style={s.phaseText}>{phaseLabel}</Text>
            </View>
          </View>

          {/* Phase interpretation banner */}
          <PhaseInterpretationBanner isRecovery={isRecovery} phase={phase} score={score} />

          {/* Section label */}
          <Text style={s.sectionLabel}>SCORE BREAKDOWN</Text>

          {/* Metric cards */}
          {cards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}

          {/* Today's Primary Focus */}
          <PrimaryFocusCard cards={cards} />

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
  phaseStrip: { marginTop: 14, alignItems: 'center', gap: 3 },
  messageText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.1, fontFamily: FF },
  targetText: {
    fontSize: 11, fontWeight: '700', color: '#FF742A',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3, fontFamily: FF,
  },
  phaseText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.2, fontFamily: FF },
  chatBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

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
