import { useMemo } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import type { EnergyBankResult } from '@/constants/scoring';

import { MedicationStatusTile } from '@/components/today/medication-status-tile';
import type { TransitionPhase } from '@/components/today/medication-status-tile';

import type { FullUserProfile } from '@/constants/user-profile';
import type { ShotPhase, IntradayPhase } from '@/constants/scoring';

type MedicationProps = {
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
  onPhaseLongPress: () => void;
};

type Props = {
  medication: MedicationProps;
  /** When null (e.g. viewing a past day), the Energy slide is omitted. */
  energy: { result: EnergyBankResult; phase: string } | null;
};

export function TodayPagerCard({ medication, energy }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={s.cardWrap}>
      <View style={[s.cardBody, { backgroundColor: colors.surface }]}>
        <MedicationStatusTile
          onTreatment={medication.onTreatment}
          profile={medication.profile}
          medName={medication.medName}
          medDose={medication.medDose}
          treatmentDisplayVal={medication.treatmentDisplayVal}
          treatmentDisplayLbl={medication.treatmentDisplayLbl}
          weightDelta={medication.weightDelta}
          stat3Val={medication.stat3Val}
          stat3Lbl={medication.stat3Lbl}
          todayDayNum={medication.todayDayNum}
          freq={medication.freq}
          todayInjLogged={medication.todayInjLogged}
          rawDaysUntil={medication.rawDaysUntil}
          daysUntil={medication.daysUntil}
          oral={medication.oral}
          effectiveLastInjectionDate={medication.effectiveLastInjectionDate}
          transitionPhase={medication.transitionPhase}
          intradayPhase={medication.intradayPhase}
          shotPhaseForLabel={medication.shotPhaseForLabel}
          isPast={medication.isPast}
          selectedDate={medication.selectedDate}
          today={medication.today}
          onLongPress={medication.onPhaseLongPress}
        />
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  cardWrap: {
    borderRadius: 28,
    marginTop: 16,
    marginBottom: 16,
    ...(c.isDark
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }),
  },
  cardBody: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: c.border,
  },
});
