import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScoreRing } from '@/components/score-ring';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useHealthData } from '@/contexts/health-data';
import { generateCoachNote } from '@/lib/openai';
import {
  adherenceBreakdown,
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
  supportColor,
  supportGradient,
  supportMessage,
} from '@/constants/scoring';
import { usePersonalizationStore } from '@/stores/personalization-store';
import { useUiStore } from '@/stores/ui-store';

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
  if (pct >= 0.8) return '#27AE60';  // green  - optimal
  if (pct >= 0.5) return '#F39C12';  // amber  - fair
  return '#E74C3C';                  // red    - low
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
        heading: `Readiness - ${phaseLabel}`,
        body: `HRV and RHR are adjusted for expected GLP-1 effects. A score of ${score} during peak days (3–4) is equivalent to ~${score + 8} on a trough day. Focus on light movement and hydration.`,
      };
    }
    if (phase === 'shot') {
      return {
        heading: `Readiness - ${phaseLabel}`,
        body: `HRV and RHR are adjusted for early medication activity. Your body is beginning to process the dose - rest, hydrate, and eat adequate protein today.`,
      };
    }
    return {
      heading: `Readiness - ${phaseLabel}`,
      body: `No medication adjustment applied today. Your recovery score reflects your biometrics directly, without GLP-1 phase offsets.`,
    };
  }

  const phaseLabel =
    phase === 'peak'    ? 'Peak Phase' :
    phase === 'shot'    ? 'Shot Day' :
    phase === 'balance' ? 'Balance Phase' : 'Reset Phase';

  if (phase === 'peak') {
    return {
      heading: `GLP-1 Amplifier - ${phaseLabel}`,
      body: `Medication is at peak effectiveness today (days 3–4). Prioritize rest and hydration - your body is doing the most work right now.`,
    };
  }
  if (phase === 'shot') {
    return {
      heading: `GLP-1 Amplifier - ${phaseLabel}`,
      body: `Injection day. Log your shot to unlock the full 15-point bonus. Protein and hydration are most critical in the first 24 hours.`,
    };
  }
  return {
    heading: `GLP-1 Amplifier - ${phaseLabel}`,
    body: `Medication levels are ${phase === 'reset' ? 'tapering toward your next shot' : 'stabilizing'}. Consistent protein and movement build on the work your medication is doing.`,
  };
}

function PhaseInterpretationBanner({
  isRecovery,
  phase,
  score,
  pb,
}: {
  isRecovery: boolean;
  phase: ShotPhase;
  score: number;
  pb: ReturnType<typeof createBannerStyles>;
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

const createBannerStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
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
      fontSize: 13, color: w(0.60),
      lineHeight: 19, fontWeight: '400', fontFamily: FF,
    },
  });
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

function MetricCard({ icon, label, pts, maxPts, value, pct, color, note, c: cStyles }: MetricCardProps & { c: ReturnType<typeof createCardStyles> }) {
  const barColor    = tierBarColor(pct);
  const statusLabel = tierStatusLabel(pct);
  const statusColor = tierStatusColor(pct);
  return (
    <View style={[cStyles.wrap, glassShadow]}>
      <View style={cStyles.body}>
        <View style={cStyles.inner}>
          <View style={cStyles.topRow}>
            <View style={cStyles.iconLabel}>
              <View style={cStyles.iconWrap}>{icon}</View>
              <Text style={cStyles.label}>{label}</Text>
            </View>
            <View style={cStyles.ptsGroup}>
              <Text style={[cStyles.statusBadge, { color: statusColor, borderColor: statusColor }]}>
                {statusLabel}
              </Text>
              <Text style={[cStyles.pts, { color }]}>
                {pts}
                <Text style={cStyles.ptsMax}> / {maxPts} pts</Text>
              </Text>
            </View>
          </View>
          <Text style={cStyles.value}>{value}</Text>
          <View style={cStyles.barTrack}>
            <View style={[cStyles.barFill, { width: `${Math.min(pct, 1) * 100}%` as any, backgroundColor: barColor }]} />
          </View>
          <Text style={cStyles.note}>{note}</Text>
        </View>
      </View>
    </View>
  );
}

const createCardStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: { borderRadius: 20, marginBottom: 12 },
    body: {
      borderRadius: 20, overflow: 'hidden',
      backgroundColor: c.surface,
      borderWidth: 0.5, borderColor: c.border,
    },
    inner: { padding: 18 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconWrap: { alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 14, fontWeight: '600', color: c.textPrimary, fontFamily: FF },
    ptsGroup: { alignItems: 'flex-end', gap: 4 },
    statusBadge: {
      fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
      borderWidth: 1, borderRadius: 5,
      paddingHorizontal: 6, paddingVertical: 2,
      fontFamily: FF, overflow: 'hidden',
    },
    pts: { fontSize: 14, fontWeight: '800', fontFamily: FF },
    ptsMax: { fontSize: 12, fontWeight: '500', color: w(0.35), fontFamily: FF },
    value: { fontSize: 28, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, marginBottom: 12, fontFamily: FF },
    barTrack: { height: 6, borderRadius: 3, backgroundColor: c.borderSubtle, overflow: 'hidden', marginBottom: 10 },
    barFill: { height: 6, borderRadius: 3 },
    note: { fontSize: 12, color: w(0.45), lineHeight: 18, fontWeight: '400', fontFamily: FF },
  });
};

// ─── Today's Primary Focus ─────────────────────────────────────────────────────

function PrimaryFocusCard({ cards, pf }: { cards: MetricCardProps[]; pf: ReturnType<typeof createFocusStyles> }) {
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
            <Text style={pf.allGood}>All metrics are optimal - maintain your current habits.</Text>
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

const createFocusStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: { borderRadius: 16, marginTop: 4, marginBottom: 4 },
    body: {
      borderRadius: 16, overflow: 'hidden',
      backgroundColor: c.surface,
      borderWidth: 0.5, borderColor: c.border,
    },
    inner: { padding: 16 },
    sectionLabel: {
      fontSize: 9, fontWeight: '700', color: '#FF742A',
      letterSpacing: 1.5, textTransform: 'uppercase',
      marginBottom: 10, fontFamily: FF,
    },
    focusLabel: { fontSize: 18, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3, marginBottom: 4, fontFamily: FF },
    detail: { fontSize: 13, color: w(0.45), marginBottom: 8, fontFamily: FF },
    ptsAvail: { color: '#FF742A', fontWeight: '700' },
    note: { fontSize: 12, color: w(0.40), lineHeight: 18, fontFamily: FF },
    allGood: { fontSize: 14, color: w(0.55), lineHeight: 20, fontFamily: FF },
  });
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScoreDetailScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const pb = useMemo(() => createBannerStyles(colors), [colors]);
  const cStyles = useMemo(() => createCardStyles(colors), [colors]);
  const pf = useMemo(() => createFocusStyles(colors), [colors]);

  const { type } = useLocalSearchParams<{ type: string }>();
  const isRecovery = type === 'recovery' || type === 'readiness';

  const healthData = useHealthData();
  const { recoveryScore, supportScore, wearable, actuals: healthActuals, targets: healthTargets, profile } = healthData;
  const plan = usePersonalizationStore(s => s.plan);
  // Prefer plan actuals/targets (fresher, synced with log-store) over health-data context
  const actuals = plan?.actuals ?? healthActuals;
  const targets = plan?.targets ?? healthTargets;
  // Use adherence score from personalization plan when available
  const adherenceScore = plan?.adherenceScore ?? supportScore;
  const sideEffectBurden = plan?.sideEffectBurden ?? 0;

  const { openAiChat } = useUiStore();
  const [aiCoachNote, setAiCoachNote] = useState<string | null>(null);
  const [coachNoteLoading, setCoachNoteLoading] = useState(true);

  useEffect(() => {
    const noteType = isRecovery ? 'recovery' : 'support';
    setCoachNoteLoading(true);
    generateCoachNote(noteType, healthData)
      .then(note => setAiCoachNote(note))
      .catch(() => setAiCoachNote(null))
      .finally(() => setCoachNoteLoading(false));
  }, [type]);

  const score     = isRecovery ? (recoveryScore ?? 0) : adherenceScore;
  const hasRecoveryData = recoveryScore != null;
  // Fixed brand identity colors - Recovery=orange, Adherence=white/silver (matches home screen rings)
  const grad      = isRecovery
    ? { start: '#D4601A', end: '#FF742A' }
    : { start: '#B0B0B0', end: '#FFFFFF' };
  const accent    = isRecovery ? recoveryColor(score)    : supportColor(score);
  const message   = isRecovery
    ? (hasRecoveryData ? recoveryMessage(score) : 'No wearable data')
    : supportMessage(score);
  const title     = isRecovery ? 'Readiness'             : 'Routine';
  const staticCoachNote = isRecovery ? RECOVERY_COACH_NOTE : GLP1_COACH_NOTE;
  const coachNote = aiCoachNote ?? staticCoachNote;

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
  const dimColor = colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

  // Phase-aware notes
  const recoveryNotes = getRecoveryRowNotes(phase);
  const glp1Notes     = getGLP1RowNotes(phase);

  let cards: MetricCardProps[] = [];

  if (isRecovery) {
    if (!hasRecoveryData) {
      // No wearable data - show suppressed state cards
      const suppressedNote = 'Connect Apple Health in Settings to enable this metric.';
      const rowDefs = [
        { icon: <Ionicons name="moon-outline" size={ICON_SIZE} color={dimColor} />, label: 'Sleep', max: 40 },
        { icon: <MaterialIcons name="show-chart" size={ICON_SIZE} color={dimColor} />, label: 'HRV', max: 35 },
        { icon: <Ionicons name="heart-outline" size={ICON_SIZE} color={dimColor} />, label: 'Resting HR', max: 15 },
        { icon: <MaterialIcons name="bloodtype" size={ICON_SIZE} color={dimColor} />, label: 'SpO\u2082', max: 10 },
      ];
      cards = rowDefs.map(rd => ({
        icon: rd.icon,
        label: rd.label,
        pts: 0,
        maxPts: rd.max,
        value: '-',
        pct: 0,
        color: dimColor,
        note: suppressedNote,
      }));
    } else {
      const rows = recoveryBreakdown(wearable, phase);
      const h = Math.floor((wearable.sleepMinutes ?? 0) / 60);
      const m = (wearable.sleepMinutes ?? 0) % 60;
      cards = [
        {
          icon: <Ionicons name="moon-outline" size={ICON_SIZE} color={rows[0].available ? accent : dimColor} />,
          label: 'Sleep',
          pts: rows[0].actual, maxPts: rows[0].max,
          value: rows[0].available ? `${h}h ${m}m` : '-',
          pct: rows[0].available ? rows[0].actual / rows[0].max : 0,
          color: rows[0].available ? accent : dimColor,
          note: rows[0].available ? recoveryNotes[0] : 'Connect Apple Health to track sleep.',
        },
        {
          icon: <MaterialIcons name="show-chart" size={ICON_SIZE} color={rows[1].available ? accent : dimColor} />,
          label: 'HRV',
          pts: rows[1].actual, maxPts: rows[1].max,
          value: rows[1].available ? `${wearable.hrvMs} ms` : '-',
          pct: rows[1].available ? rows[1].actual / rows[1].max : 0,
          color: rows[1].available ? accent : dimColor,
          note: rows[1].available ? recoveryNotes[1] : 'Connect Apple Health to track HRV.',
        },
        {
          icon: <Ionicons name="heart-outline" size={ICON_SIZE} color={rows[2].available ? accent : dimColor} />,
          label: 'Resting HR',
          pts: rows[2].actual, maxPts: rows[2].max,
          value: rows[2].available ? `${wearable.restingHR} bpm` : '-',
          pct: rows[2].available ? rows[2].actual / rows[2].max : 0,
          color: rows[2].available ? accent : dimColor,
          note: rows[2].available ? recoveryNotes[2] : 'Connect Apple Health to track resting heart rate.',
        },
        {
          icon: <MaterialIcons name="bloodtype" size={ICON_SIZE} color={rows[3].available ? accent : dimColor} />,
          label: 'SpO\u2082',
          pts: rows[3].actual, maxPts: rows[3].max,
          value: rows[3].available ? `${wearable.spo2Pct}%` : '-',
          pct: rows[3].available ? rows[3].actual / rows[3].max : 0,
          color: rows[3].available ? accent : dimColor,
          note: rows[3].available ? recoveryNotes[3] : 'Connect Apple Health to track blood oxygen.',
        },
      ];
    }
  } else {
    // 4-pillar adherence breakdown: Medication(35) + SideEffects(25) + Protein(25) + Activity(15)
    const rows = adherenceBreakdown(actuals, targets, sideEffectBurden);
    cards = [
      {
        icon: <FontAwesome5 name="syringe" size={ICON_SIZE - 2} color={accent} />,
        label: 'Medication',
        pts: rows[0].actual, maxPts: rows[0].max,
        value: actuals.injectionLogged ? 'Logged ✓' : 'Not logged',
        pct: rows[0].actual / rows[0].max,
        color: accent,
        note: 'Logging your injection unlocks the full 35-point medication bonus and enables phase-aware coaching.',
      },
      {
        icon: <Ionicons name="pulse-outline" size={ICON_SIZE} color={accent} />,
        label: 'Side Effects',
        pts: rows[1].actual, maxPts: rows[1].max,
        value: `${sideEffectBurden}% burden`,
        pct: rows[1].actual / rows[1].max,
        color: accent,
        note: 'Lower side effect burden means your body is tolerating the medication well. Phase-expected GI effects are discounted.',
      },
      {
        icon: <MaterialIcons name="fitness-center" size={ICON_SIZE} color={rows[2].included ? accent : dimColor} />,
        label: 'Protein',
        pts: rows[2].actual, maxPts: rows[2].max,
        value: rows[2].included ? `${actuals.proteinG}g / ${targets.proteinG}g` : '-',
        pct: rows[2].included ? rows[2].actual / rows[2].max : 0,
        color: rows[2].included ? accent : dimColor,
        note: rows[2].note ?? glp1Notes[0],
      },
      {
        icon: <Ionicons name="walk-outline" size={ICON_SIZE} color={rows[3].included ? accent : dimColor} />,
        label: 'Movement',
        pts: rows[3].actual, maxPts: rows[3].max,
        value: rows[3].included ? `${actuals.steps.toLocaleString()} steps` : '-',
        pct: rows[3].included ? rows[3].actual / rows[3].max : 0,
        color: rows[3].included ? accent : dimColor,
        note: rows[3].note ?? glp1Notes[2],
      },
    ];
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Nav bar */}
        <View style={s.navBar}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={s.navCenter}>
            <Text style={s.navTitle}>{title}</Text>
            <Text style={s.navDate}>{todayLabel}</Text>
          </View>
          <Pressable
            onPress={() => {
              const scoreLabel = isRecovery ? 'Readiness Score' : 'Routine Score';
              const scoreContext = `${score}/100 · ${phaseLabel}`;
              const contextChips = isRecovery
                ? ['Why is my score this level?', 'How does my phase affect this?', 'What can I do to improve?', 'Is this normal for peak phase?']
                : ['How do I improve my readiness?', 'What should I prioritize today?', 'How does protein affect my score?', 'When should I log my injection?'];
              openAiChat({ type: type as string, contextLabel: scoreLabel, contextValue: scoreContext, chips: JSON.stringify(contextChips) });
            }}
            style={s.chatBtn}
            hitSlop={12}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Hero ring */}
          <View style={s.hero}>
            <ScoreRing
              score={isRecovery && !hasRecoveryData ? 0 : score}
              size={180}
              strokeWidth={14}
              gradientStart={isRecovery && !hasRecoveryData ? (colors.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : grad.start}
              gradientEnd={isRecovery && !hasRecoveryData ? (colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : grad.end}
              label={isRecovery ? 'READINESS' : 'ROUTINE'}
              message=""
              onTap={() => {}}
            />
            <View style={s.phaseStrip}>
              <Text style={s.messageText}>{message}</Text>
              <Text style={s.targetText}>{targetLabel}</Text>
              <Text style={s.phaseText}>{phaseLabel}</Text>
            </View>
          </View>

          {/* Phase interpretation banner - suppressed when no wearable data */}
          {(!isRecovery || hasRecoveryData) && (
            <PhaseInterpretationBanner isRecovery={isRecovery} phase={phase} score={score} pb={pb} />
          )}
          {isRecovery && !hasRecoveryData && (
            <View style={[pb.wrap, { marginBottom: 20 }]}>
              <View style={pb.body}>
                <View style={pb.inner}>
                  <Text style={pb.heading}>No Wearable Data</Text>
                  <Text style={pb.bodyText}>
                    Connect Apple Health in Settings to enable recovery scoring. Sleep, HRV, resting heart rate, and SpO₂ are required for an accurate recovery score.
                  </Text>
                </View>
              </View>
            </View>
          )}


          {/* Section label */}
          <Text style={s.sectionLabel}>SCORE BREAKDOWN</Text>

          {/* Metric cards */}
          {cards.map((card) => (
            <MetricCard key={card.label} {...card} c={cStyles} />
          ))}

          {/* Fiber - informational only (not scored) */}
          {!isRecovery && (
            <View style={[cStyles.wrap, glassShadow, { opacity: 0.75 }]}>
              <View style={[cStyles.body, { borderColor: colors.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                <View style={cStyles.inner}>
                  <View style={cStyles.topRow}>
                    <View style={cStyles.iconLabel}>
                      <View style={cStyles.iconWrap}>
                        <MaterialIcons name="eco" size={ICON_SIZE} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
                      </View>
                      <Text style={[cStyles.label, { color: colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>Fiber (Informational)</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', fontFamily: FF }}>NOT SCORED</Text>
                  </View>
                  <Text style={[cStyles.value, { fontSize: 20, color: colors.isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }]}>
                    {actuals.fiberG}g / {targets.fiberG}g
                  </Text>
                  <Text style={cStyles.note}>
                    Fiber is tracked but not scored. During shot/peak phases, high fiber worsens GI side effects - target is lowered automatically. During balance/reset phases, aim for 25–35g.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Today's Primary Focus */}
          <PrimaryFocusCard cards={cards} pf={pf} />

          {/* Divider */}
          <View style={s.divider} />

          {/* Coach note */}
          <Text style={s.sectionLabel}>WHAT MOVES THIS SCORE</Text>
          <View style={[s.coachWrap, glassShadow]}>
            <View style={s.coachBody}>
              <View style={s.coachInner}>
                {coachNoteLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator size="small" color="#FF742A" />
                    <View style={{ flex: 1, gap: 8 }}>
                      <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.borderSubtle, width: '90%' }} />
                      <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.borderSubtle, width: '75%' }} />
                    </View>
                  </View>
                ) : (
                  <Text style={s.coachText}>{coachNote}</Text>
                )}
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

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: c.borderSubtle,
      alignItems: 'center', justifyContent: 'center',
    },
    navCenter: { flex: 1, alignItems: 'center' },
    navTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, letterSpacing: -0.3, fontFamily: FF },
    navDate: { fontSize: 12, fontWeight: '500', color: w(0.40), marginTop: 1, fontFamily: FF },

    content: { paddingHorizontal: 20, paddingBottom: 40 },

    hero: { alignItems: 'center', paddingVertical: 24 },
    phaseStrip: { marginTop: 14, alignItems: 'center', gap: 3 },
    messageText: { fontSize: 11, fontWeight: '600', color: w(0.55), letterSpacing: 0.1, fontFamily: FF },
    targetText: {
      fontSize: 11, fontWeight: '700', color: '#FF742A',
      letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3, fontFamily: FF,
    },
    phaseText: { fontSize: 13, fontWeight: '500', color: w(0.45), letterSpacing: 0.2, fontFamily: FF },
    chatBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: c.borderSubtle,
      alignItems: 'center', justifyContent: 'center',
    },

    sectionLabel: {
      fontSize: 9, fontWeight: '700', color: '#FF742A',
      letterSpacing: 1.5, textTransform: 'uppercase',
      marginBottom: 14, marginTop: 4, fontFamily: FF,
    },

    divider: { height: 1, backgroundColor: c.borderSubtle, marginVertical: 20 },

    coachWrap: { borderRadius: 20 },
    coachBody: {
      borderRadius: 20, overflow: 'hidden',
      backgroundColor: c.surface,
      borderWidth: 0.5, borderColor: c.border,
    },
    coachInner: { padding: 18 },
    coachText: { fontSize: 15, color: w(0.55), lineHeight: 22, fontWeight: '400', fontFamily: FF },
  });
};
