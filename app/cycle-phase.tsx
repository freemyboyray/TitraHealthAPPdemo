import { ChevronLeft, ChevronRight, Hospital } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { useLogStore } from '@/stores/log-store';
import { useHealthData } from '@/contexts/health-data';
import { BRAND_DISPLAY_NAMES, isOnTreatment } from '@/constants/user-profile';
import { isOralDrug } from '@/constants/drug-pk';
import {
  daysSinceInjection,
  rawDaysSinceInjection,
  getShotPhase,
  getPhaseFocusMessage,
  type ShotPhase,
} from '@/constants/scoring';
import type { AppColors } from '@/constants/theme';
import { VerticalCycleTimeline } from '@/components/cycle-phase/vertical-cycle-timeline';

const FF = 'System';

const PHASE_COLORS: Record<ShotPhase, string> = {
  shot: '#FF742A', peak: '#27AE60', balance: '#3B9AE1', reset: '#F5A623',
};

export default function CyclePhaseScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile: fullUserProfile } = useProfile();
  const logStore = useLogStore();
  const healthData = useHealthData();
  const { actuals, profile } = healthData;
  const s = useMemo(() => createStyles(colors), [colors]);

  const onTreatment = isOnTreatment(fullUserProfile);
  const oral = isOralDrug(profile?.glp1Type);

  // ── Derive cycle data (same logic as home screen) ──
  const profileLastInj = fullUserProfile?.lastInjectionDate || null;
  const logStoreLastInj = logStore.injectionLogs[0]?.injection_date || null;
  const effectiveLastInjectionDate = (() => {
    if (!profileLastInj) return logStoreLastInj;
    if (!logStoreLastInj) return profileLastInj;
    return profileLastInj >= logStoreLastInj ? profileLastInj : logStoreLastInj;
  })();

  const freq = fullUserProfile?.injectionFrequencyDays ?? 7;
  const todayDayNum = daysSinceInjection(effectiveLastInjectionDate, undefined, freq);
  const rawTodayDayNum = rawDaysSinceInjection(effectiveLastInjectionDate);
  const uncappedDaysUntil = isFinite(rawTodayDayNum) ? freq - rawTodayDayNum : null;
  const rawDaysUntil = uncappedDaysUntil != null ? Math.max(0, uncappedDaysUntil) : null;
  const todayInjLogged = actuals.injectionLogged;

  const shotPhase = getShotPhase(todayDayNum, freq);
  const phaseColor = PHASE_COLORS[shotPhase];
  const phaseFocus = getPhaseFocusMessage(shotPhase, profile?.glp1Type, freq);

  // ── Medication name ──
  const medName = (() => {
    const brand = fullUserProfile?.medicationBrand;
    if (!brand) return 'My Medication';
    const display = BRAND_DISPLAY_NAMES[brand];
    if (!display || display === 'Other') {
      return fullUserProfile?.medicationCustomName || 'My Medication';
    }
    return display;
  })();
  const medDose = fullUserProfile?.doseMg != null ? `${fullUserProfile.doseMg}mg` : null;

  // ── Treatment duration ──
  const treatmentStartDate = fullUserProfile?.startDate || fullUserProfile?.doseStartDate;
  const daysOnTreatment = treatmentStartDate
    ? Math.max(0, Math.floor((Date.now() - new Date(treatmentStartDate + 'T00:00:00').getTime()) / 86400000))
    : null;
  const weeksOn = daysOnTreatment != null && daysOnTreatment >= 14
    ? `Week ${Math.floor(daysOnTreatment / 7)}`
    : daysOnTreatment != null
      ? `Day ${daysOnTreatment}`
      : null;

  if (!onTreatment) {
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ChevronLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Your Cycle</Text>
          <View style={s.backBtn} />
        </View>
        <View style={s.emptyState}>
          <Hospital size={48} color={colors.textMuted} />
          <Text style={s.emptyTitle}>No active medication</Text>
          <Text style={s.emptySub}>Add a medication to see your injection cycle</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{oral ? 'Your Treatment' : 'Your Cycle'}</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Medication + week label */}
        <View style={s.medRow}>
          <Text style={s.medLabel}>
            {medName}{medDose ? ` \u00b7 ${medDose}` : ''}
          </Text>
          {weeksOn && <Text style={s.weekLabel}>{weeksOn}</Text>}
        </View>

        {/* Hero phase name + timeline — injectable only */}
        {!oral && (
          <>
            <Text style={[s.heroPhase, { color: phaseColor }]}>
              {phaseFocus.title}
            </Text>
            <Text style={s.heroSub}>
              Day {Math.max(1, todayDayNum)} of {freq}
            </Text>

            <View style={s.timelineWrap}>
              <VerticalCycleTimeline
                currentPhase={shotPhase}
                todayDayNum={todayDayNum}
                freq={freq}
                rawDaysUntil={rawDaysUntil}
                todayInjLogged={todayInjLogged}
                oral={oral}
                colors={colors}
              />
            </View>
          </>
        )}

        {/* Phase insight card */}
        <View style={s.insightCard}>
          <Text style={[s.insightTitle, { color: phaseColor }]}>
            What to expect
          </Text>
          <Text style={s.insightBody}>
            {phaseFocus.message}
          </Text>
        </View>

        {/* My Medications link */}
        <Pressable
          style={s.medLink}
          onPress={() => router.push('/medication-detail' as any)}
          accessibilityLabel="View my medications"
          accessibilityRole="button"
        >
          <View style={{ flex: 1 }}>
            <Text style={s.medLinkTitle}>My Medications</Text>
            <Text style={s.medLinkSub}>View and manage your medication library</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary, fontFamily: FF },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },

  medRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  medLabel: {
    fontSize: 14, fontWeight: '600', color: c.textSecondary, fontFamily: FF,
  },
  weekLabel: {
    fontSize: 13, fontWeight: '500', color: c.textMuted, fontFamily: FF,
  },

  heroPhase: {
    fontSize: 32, fontWeight: '800', fontFamily: FF, letterSpacing: -0.5,
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 15, fontWeight: '500', color: c.textSecondary, fontFamily: FF,
    marginBottom: 24,
  },

  timelineWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },

  insightCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: c.border,
    marginBottom: 16,
  },
  insightTitle: {
    fontSize: 15, fontWeight: '700', fontFamily: FF, marginBottom: 6,
  },
  insightBody: {
    fontSize: 14, fontWeight: '400', color: c.textSecondary, fontFamily: FF,
    lineHeight: 20,
  },

  medLink: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: c.border,
  },
  medLinkTitle: {
    fontSize: 16, fontWeight: '700', color: c.textPrimary, fontFamily: FF,
  },
  medLinkSub: {
    fontSize: 13, fontWeight: '400', color: c.textMuted, fontFamily: FF, marginTop: 2,
  },

  emptyState: {
    alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8,
  },
  emptyTitle: {
    fontSize: 20, fontWeight: '700', color: c.textPrimary, fontFamily: FF, marginTop: 12,
  },
  emptySub: {
    fontSize: 15, color: c.textMuted, fontFamily: FF, textAlign: 'center',
  },
});
