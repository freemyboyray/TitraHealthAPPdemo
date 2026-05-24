import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo } from 'react';

import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { useLogStore } from '@/stores/log-store';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { isOnTreatment } from '@/constants/user-profile';
import type { AppColors } from '@/constants/theme';

const ORANGE = '#FF742A';

const BRAND_LABEL: Record<string, string> = {
  zepbound: 'Zepbound', mounjaro: 'Mounjaro', wegovy: 'Wegovy', ozempic: 'Ozempic',
  trulicity: 'Trulicity', saxenda: 'Saxenda', victoza: 'Victoza', rybelsus: 'Rybelsus',
  oral_wegovy: 'Oral Wegovy', orforglipron: 'Orforglipron',
  compounded_semaglutide: 'Compounded (Sema)', compounded_tirzepatide: 'Compounded (Tirz)',
  compounded_liraglutide: 'Compounded (Lira)', other: 'Other',
};

function computeNextDose(lastDate: string | undefined, freqDays: number | undefined): string | null {
  if (!lastDate || !freqDays) return null;
  const last = new Date(lastDate + 'T12:00:00');
  const next = new Date(last.getTime() + freqDays * 86400000);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (next.getTime() < today.getTime()) return 'Overdue';
  if (next.toDateString() === today.toDateString()) return 'Today';
  const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
  if (diff === 1) return 'Tomorrow';
  return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PlanScreen() {
  const { profile: p } = useProfile();
  const { colors } = useAppTheme();
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const s = useMemo(() => createStyles(colors), [colors]);

  const onTreatment = isOnTreatment(p);
  const brandName = p ? (BRAND_LABEL[p.medicationBrand] ?? p.medicationBrand) : '-';
  const freqLabel = p
    ? p.injectionFrequencyDays === 1 ? 'daily'
    : p.injectionFrequencyDays === 7 ? 'weekly'
    : p.injectionFrequencyDays === 14 ? 'biweekly'
    : `every ${p.injectionFrequencyDays}d`
    : '';
  const hasPendingTransition = p?.pendingFirstDoseDate != null;
  const nextDose = hasPendingTransition
    ? (() => {
        const d = new Date(p!.pendingFirstDoseDate! + 'T12:00:00');
        const today = new Date(); today.setHours(12, 0, 0, 0);
        if (d.toDateString() === today.toDateString()) return 'Today';
        const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
        if (diff === 1) return 'Tomorrow';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      })()
    : p ? computeNextDose(p.lastInjectionDate, p.injectionFrequencyDays) : null;
  const pendingBrandName = p?.pendingMedicationBrand ? (BRAND_LABEL[p.pendingMedicationBrand] ?? p.pendingMedicationBrand) : null;
  const treatmentLine1 = !p ? '-' : onTreatment ? `${brandName} ${p.doseMg}mg · ${freqLabel}` : 'Not on medication';
  const treatmentLine2 = !onTreatment
    ? 'Tap to start or resume a GLP-1'
    : hasPendingTransition
      ? `Switching to ${pendingBrandName} ${p!.pendingDoseMg}mg · Next dose: ${nextDose}`
      : nextDose ? `Next dose: ${nextDose}` : '';

  const latestWeightLog = useLogStore((s) => s.weightLogs[0]);
  const displayWeightLbs = latestWeightLog?.weight_lbs ?? p?.weightLbs ?? 0;
  const displayWeightKg = Math.round(displayWeightLbs * 0.453592 * 10) / 10;
  const bodyLine = p
    ? p.unitSystem === 'imperial'
      ? `${p.heightFt}'${p.heightIn}" · ${displayWeightLbs} lbs`
      : `${p.heightCm} cm · ${displayWeightKg} kg`
    : '-';
  const goalsLine = p ? `Goal: ${p.goalWeightLbs} lbs · ${p.targetWeeklyLossLbs} lbs/wk` : '';

  return (
    <View style={s.safe}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back" accessibilityRole="button">
            <IconSymbol name="chevron.left" size={22} color={ORANGE} />
          </Pressable>
          <Text style={s.headerTitle}>My Plan</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Treatment Plan */}
          <Text style={s.sectionLabel}>TREATMENT</Text>
          <View style={s.card}>
            <Pressable style={s.cardRow} onPress={() => router.push('/medication-detail' as any)} accessibilityLabel={`Treatment Plan, ${treatmentLine1}`} accessibilityRole="button">
              <View style={s.rowLeft}>
                <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                  <IconSymbol name="syringe.fill" size={18} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>Treatment Plan</Text>
                  <Text style={s.rowSub}>{treatmentLine1}</Text>
                  {treatmentLine2 ? <Text style={s.rowSub}>{treatmentLine2}</Text> : null}
                </View>
              </View>
              <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Body & Goals */}
          <Text style={s.sectionLabel}>BODY & GOALS</Text>
          <View style={s.card}>
            <Pressable style={s.cardRow} onPress={() => router.push('/settings/edit-profile')} accessibilityLabel={`Body & Goals, ${bodyLine}`} accessibilityRole="button">
              <View style={s.rowLeft}>
                <View style={[s.iconBadge, { backgroundColor: 'rgba(10,132,255,0.15)' }]}>
                  <IconSymbol name="figure.stand" size={18} color="#0A84FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>Body & Goals</Text>
                  <Text style={s.rowSub}>{bodyLine}</Text>
                  {goalsLine ? <Text style={s.rowSub}>{goalsLine}</Text> : null}
                </View>
              </View>
              <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Provider Report (premium only) */}
          {isPremium && (
            <>
              <Text style={s.sectionLabel}>REPORTS</Text>
              <View style={s.card}>
                <Pressable style={s.cardRow} onPress={() => router.push('/settings/export-report' as any)} accessibilityLabel="Provider Report" accessibilityRole="button">
                  <View style={s.rowLeft}>
                    <View style={[s.iconBadge, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
                      <IconSymbol name="doc.text.fill" size={18} color="#34C759" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowLabel}>Provider Report</Text>
                      <Text style={s.rowSub}>Export PDF for your doctor</Text>
                    </View>
                  </View>
                  <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    content: { padding: 16, paddingBottom: 60 },
    sectionLabel: {
      color: c.textMuted, fontSize: 11, fontWeight: '600',
      letterSpacing: 1, marginTop: 12, marginBottom: 6, marginLeft: 4,
      textTransform: 'uppercase',
    },
    card: {
      backgroundColor: c.glassOverlay,
      borderRadius: 16,
      borderWidth: 1,
      borderTopColor: c.border,
      borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle,
      borderBottomColor: c.borderSubtle,
      overflow: 'hidden',
    },
    cardRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    iconBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { color: c.textPrimary, fontSize: 17, fontWeight: '600', lineHeight: 22 },
    rowSub: { color: c.textSecondary, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 2 },
  });
}
