import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AppColors } from '@/constants/theme';
import type { ShotPhase, IntradayPhase } from '@/constants/scoring';
import { getHomeHeadline } from '@/lib/home-headline';
import type { TransitionPhase } from '@/components/today/medication-status-tile';

const FF = 'System';

type Props = {
  colors: AppColors;
  shotPhase: ShotPhase;
  intradayPhase: IntradayPhase | null;
  transitionPhase: TransitionPhase;
  oral: boolean;
  daysUntil: number;
  rawDaysUntil: number | null;
  todayInjLogged: boolean;
  weightDelta: number | null;
  pctToGoal: number | null;
  stat3Val: string;
  stat3Lbl: string;
  effectiveLastInjectionDate: string | null;
  freq: number | null;
  selectedDate: Date;
  today: Date;
};

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// "Next shot/dose" stat — the scheduled date of the upcoming injection.
function nextDoseStat(
  lastDate: string | null,
  freq: number | null,
  oral: boolean,
  transitionPhase: TransitionPhase,
  todayInjLogged: boolean,
): { val: string; lbl: string } {
  const lbl = oral ? 'next\ndose' : 'next\nshot';
  if (transitionPhase === 'washout') return { val: 'Soon', lbl };
  if (!lastDate || !freq) return { val: '—', lbl };
  const next = new Date(lastDate + 'T12:00:00');
  next.setDate(next.getDate() + freq);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (next.getTime() <= today.getTime() && !todayInjLogged) return { val: 'Today', lbl };
  return { val: next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), lbl };
}

export function TodayHeroCard(props: Props) {
  const {
    colors, shotPhase, intradayPhase, transitionPhase, oral, daysUntil,
    rawDaysUntil, todayInjLogged, weightDelta, pctToGoal, stat3Val, stat3Lbl,
    effectiveLastInjectionDate, freq, selectedDate, today,
  } = props;

  const s = useMemo(() => createStyles(colors), [colors]);

  const isToday = sameDay(selectedDate, today);
  const hasLoggedDose = effectiveLastInjectionDate != null;

  const { headline, subtext } = getHomeHeadline({
    shotPhase, intradayPhase, transitionPhase, oral, daysUntil, rawDaysUntil,
    todayInjLogged, weightDelta, pctToGoal, hasLoggedDose, isToday,
  });

  // ── Stats ──
  const next = nextDoseStat(effectiveLastInjectionDate, freq, oral, transitionPhase, todayInjLogged);

  const lost = weightDelta != null && weightDelta <= 0 ? Math.abs(weightDelta) : null;
  const weightVal = weightDelta == null ? '—'
    : weightDelta <= 0 ? lost!.toFixed(1)
    : `+${weightDelta.toFixed(1)}`;
  const weightLbl = weightDelta != null && weightDelta > 0 ? 'lbs\ngained' : 'lbs\nlost';
  const weightColor = weightDelta != null
    ? (weightDelta <= 0 ? '#27AE60' : '#E53E3E')
    : colors.textPrimary;

  const mutedText = colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
  const dividerColor = colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={s.container}>
      {/* Dynamic, phase + progress aware message */}
      <View style={s.messageBlock}>
        <Text style={s.headline} numberOfLines={2}>{headline}</Text>
        {subtext ? <Text style={s.subtext} numberOfLines={2}>{subtext}</Text> : null}
      </View>

      {/* Stats: next shot · lbs lost · % goal */}
      <View style={[s.statsRow, { borderTopColor: dividerColor }]}>
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: colors.textPrimary }]} numberOfLines={1}>{next.val}</Text>
          <Text style={[s.statLabel, { color: mutedText }]}>{next.lbl}</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: dividerColor }]} />
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: weightColor }]} numberOfLines={1}>{weightVal}</Text>
          <Text style={[s.statLabel, { color: mutedText }]}>{weightLbl}</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: dividerColor }]} />
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: colors.textPrimary }]} numberOfLines={1}>{stat3Val}</Text>
          <Text style={[s.statLabel, { color: mutedText }]}>{stat3Lbl}</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    container: {
      paddingTop: 4,
      paddingBottom: 12,
    },
    messageBlock: {
      paddingHorizontal: 4,
      paddingTop: 6,
      paddingBottom: 16,
      gap: 4,
    },
    headline: {
      fontSize: 24,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      letterSpacing: -0.5,
      lineHeight: 29,
    },
    subtext: {
      fontSize: 14,
      fontWeight: '500',
      color: c.textSecondary,
      fontFamily: FF,
      lineHeight: 19,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingTop: 14,
      paddingBottom: 2,
      borderTopWidth: 1,
      marginHorizontal: 4,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statDivider: {
      width: 1,
      height: 28,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
      fontFamily: FF,
      lineHeight: 24,
      letterSpacing: -0.3,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '400',
      fontFamily: FF,
      marginTop: 3,
      textAlign: 'center',
    },
  });
