import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/contexts/theme-context';
import { BRAND_DISPLAY_NAMES, type FullUserProfile } from '@/constants/user-profile';
import type { AppColors } from '@/constants/theme';
import type { ShotPhase, IntradayPhase } from '@/constants/scoring';
import { InjectionCycleTimeline } from '@/components/today/injection-cycle-timeline';
import { ArrowLeftRight, PlusCircle } from 'lucide-react-native';

const FF = 'System';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PHASE_COLORS: Record<ShotPhase, string> = {
  shot: '#FF742A', peak: '#27AE60', balance: '#3B9AE1', reset: '#F5A623',
};

const INTRADAY_PHASE_COLORS: Record<IntradayPhase, string> = {
  post_dose: '#D4850A', peak: '#27AE60', trough: '#F5A623',
};

export type TransitionPhase = 'none' | 'old_med' | 'washout' | 'new_med_ready';

type Props = {
  onTreatment: boolean;
  profile: FullUserProfile;
  medName: string;
  medDose: string | null;
  treatmentDisplayVal: string | null;
  treatmentDisplayLbl: string;
  weightDelta: number | null;
  stat3Val: string;
  stat3Lbl: string;
  todayDayNum: number | null;
  freq: number | null;
  todayInjLogged: boolean;
  rawDaysUntil: number | null;
  daysUntil: number;
  oral: boolean;
  effectiveLastInjectionDate: string | null;
  transitionPhase: TransitionPhase;
  intradayPhase: IntradayPhase | null;
  shotPhaseForLabel: ShotPhase;
  isPast: boolean;
  selectedDate: Date;
  today: Date;
  onLongPress: () => void;
};

export function MedicationStatusTile(props: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  if (!props.onTreatment) {
    return (
      <View style={s.heroCard}>
        {/* Top row with Add Medication link */}
        <View style={s.heroTopRow}>
          <Text style={s.heroMedLabel}>No active medication</Text>
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
            onPress={() => router.push('/settings/edit-treatment')}
            accessibilityLabel="Add medication"
            accessibilityRole="button"
          >
            <PlusCircle size={15} color={colors.orange} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.orange, fontFamily: FF, marginLeft: 2 }}>Add Medication</Text>
          </Pressable>
        </View>

        {/* Weight stats */}
        <View style={s.heroStats}>
          <View style={s.heroStat}>
            <Text style={s.heroStatVal}>
              {props.profile.currentWeightLbs ?? props.profile.weightLbs ?? '—'}
            </Text>
            <Text style={s.heroStatLbl}>{'current\nweight'}</Text>
          </View>
          <View style={s.heroStatDiv} />
          <View style={s.heroStat}>
            <Text style={s.heroStatVal}>{props.profile.goalWeightLbs ?? '—'}</Text>
            <Text style={s.heroStatLbl}>{'goal\nweight'}</Text>
          </View>
          <View style={s.heroStatDiv} />
          <View style={s.heroStat}>
            <Text style={s.heroStatVal}>
              {props.profile.currentWeightLbs && props.profile.goalWeightLbs
                ? `${Math.max(0, Math.round(((props.profile.currentWeightLbs ?? props.profile.weightLbs) - props.profile.goalWeightLbs) * 10) / 10)}`
                : '—'}
            </Text>
            <Text style={s.heroStatLbl}>{'lbs\nto go'}</Text>
          </View>
        </View>
      </View>
    );
  }

  const {
    medName, medDose, treatmentDisplayVal, treatmentDisplayLbl, weightDelta,
    stat3Val, stat3Lbl, todayDayNum, freq, todayInjLogged, rawDaysUntil,
    daysUntil, oral, effectiveLastInjectionDate, transitionPhase,
    intradayPhase, shotPhaseForLabel, isPast, selectedDate, today, profile,
    onLongPress,
  } = props;

  return (
    <Pressable
      style={{ flex: 1 }}
      onLongPress={onLongPress}
      delayLongPress={500}
      accessibilityLabel={`Treatment progress card. ${medName}${medDose ? `, ${medDose}` : ''}. Long press for AI insights.`}
      accessibilityRole="button"
    >
      <View style={s.heroCard}>
        {/* Medication row */}
        <View style={s.heroTopRow}>
          <Text style={s.heroMedLabel}>
            {medName}{medDose ? ` · ${medDose}` : ''}
          </Text>
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
            onPress={() => router.push('/medication-detail' as any)}
            accessibilityLabel="View medication details"
            accessibilityRole="link"
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.orange, fontFamily: FF }}>View</Text>
            <IconSymbol name="chevron.right" size={14} color={colors.orange} />
          </Pressable>
        </View>

        {/* Transition banner during washout */}
        {(transitionPhase === 'washout' || transitionPhase === 'old_med') && profile.pendingFirstDoseDate && (
          (() => {
            const startDate = new Date(profile.pendingFirstDoseDate + 'T00:00:00');
            const daysAway = Math.max(0, Math.ceil((startDate.getTime() - today.getTime()) / 86400000));
            const dateLabel2 = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const newBrandLabel = BRAND_DISPLAY_NAMES[profile.pendingMedicationBrand as keyof typeof BRAND_DISPLAY_NAMES] ?? profile.pendingMedicationBrand ?? '';
            return (
              <View style={s.transitionBanner}>
                <View style={s.transitionRow}>
                  <ArrowLeftRight size={16} color={colors.orange} />
                  <Text style={s.transitionTitle}>Switching Medication</Text>
                </View>
                <Text style={s.transitionBody}>
                  Starting {newBrandLabel} {profile.pendingDoseMg}mg on {dateLabel2}
                  {daysAway > 0 ? ` (${daysAway} day${daysAway !== 1 ? 's' : ''})` : ' (today)'}
                </Text>
                {transitionPhase === 'washout' && (
                  <Text style={s.transitionHint}>Washout period — no active dose cycle</Text>
                )}
              </View>
            );
          })()
        )}

        {/* Injection cycle timeline — hidden during washout and off-treatment */}
        {transitionPhase !== 'washout' && effectiveLastInjectionDate && todayDayNum != null && (freq ?? 7) > 1 && (
          <InjectionCycleTimeline
            todayDayNum={todayDayNum}
            freq={freq ?? 7}
            shotPhase={shotPhaseForLabel}
            rawDaysUntil={rawDaysUntil}
            todayInjLogged={todayInjLogged}
            oral={oral}
            colors={colors}
            treatmentDisplayVal={treatmentDisplayVal}
            treatmentDisplayLbl={treatmentDisplayLbl}
            weightDelta={weightDelta}
            stat3Val={stat3Val}
            stat3Lbl={stat3Lbl}
          />
        )}

        {/* Daily / oral drugs have no injection cycle, so the shot-phase arc is
            hidden — but progress (days on med · weight delta · to goal) still shows. */}
        {transitionPhase !== 'washout' && (freq ?? 7) === 1 && (
          <InjectionCycleTimeline
            hideArc
            todayDayNum={todayDayNum ?? 1}
            freq={freq ?? 1}
            shotPhase={shotPhaseForLabel}
            rawDaysUntil={rawDaysUntil}
            todayInjLogged={todayInjLogged}
            oral={oral}
            colors={colors}
            treatmentDisplayVal={treatmentDisplayVal}
            treatmentDisplayLbl={treatmentDisplayLbl}
            weightDelta={weightDelta}
            stat3Val={stat3Val}
            stat3Lbl={stat3Lbl}
          />
        )}
      </View>
    </Pressable>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  heroCard: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroMedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textSecondary,
    fontFamily: FF,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  heroStatDiv: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
  },
  heroStatVal: {
    fontSize: 26,
    fontWeight: '800',
    color: c.textPrimary,
    fontFamily: FF,
    letterSpacing: -0.5,
  },
  heroStatLbl: {
    fontSize: 13,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
    fontFamily: FF,
  },
  transitionBanner: {
    backgroundColor: c.isDark ? 'rgba(255,116,42,0.08)' : 'rgba(255,116,42,0.06)',
    borderWidth: 1,
    borderColor: c.isDark ? 'rgba(255,116,42,0.2)' : 'rgba(255,116,42,0.15)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  transitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  transitionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF742A',
    fontFamily: FF,
  },
  transitionBody: {
    fontSize: 15,
    fontWeight: '600',
    color: c.textPrimary,
    fontFamily: FF,
  },
  transitionHint: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 4,
    fontFamily: FF,
  },
});
