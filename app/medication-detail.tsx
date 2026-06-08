import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { supabase } from '@/lib/supabase';
import { useMedicationsStore, type UserMedication } from '@/stores/medications-store';
import { BRAND_DISPLAY_NAMES, BRAND_TO_GLP1_TYPE, isOnTreatment, getTransitionPhase } from '@/constants/user-profile';
import { DRUG_HALF_LIFE_LABEL } from '@/constants/drug-pk';
import { useLogStore } from '@/stores/log-store';
import type { AppColors } from '@/constants/theme';
import { Check, ChevronDown, ChevronLeft, ChevronUp, Hospital, Pill, Plus, PlusCircle, Trash2 } from 'lucide-react-native';

const FF = 'System';

const MED_PEN = require('@/assets/images/med-hero.png');

const GLP1_DISPLAY: Record<string, string> = {
  semaglutide: 'Semaglutide',
  tirzepatide: 'Tirzepatide',
  dulaglutide: 'Dulaglutide',
  liraglutide: 'Liraglutide',
  oral_semaglutide: 'Semaglutide (oral)',
  orforglipron: 'Orforglipron',
};

function getBrandLabel(med: UserMedication): string {
  if (med.medication_brand === 'other' && med.medication_custom_name) return med.medication_custom_name;
  return BRAND_DISPLAY_NAMES[med.medication_brand as keyof typeof BRAND_DISPLAY_NAMES] ?? med.medication_brand;
}

function InfoRow({ label, value, isLast, colors }: { label: string; value: string; isLast?: boolean; colors: AppColors }) {
  return (
    <View style={[
      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 0 },
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle },
    ]}>
      <Text style={{ fontSize: 14, color: colors.textMuted, fontFamily: FF }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, fontFamily: FF, textAlign: 'right', flex: 1, marginLeft: 16 }}>{value}</Text>
    </View>
  );
}

// ── Medication Row (within the grouped inset list) ───────────────────────────

function MedicationCard({
  med,
  active,
  expanded,
  isFirst,
  onToggle,
  onSetActive,
  onNotesUpdate,
  onDelete,
  colors,
  s,
}: {
  med: UserMedication;
  active: boolean;
  expanded: boolean;
  isFirst: boolean;
  onToggle: () => void;
  onSetActive: () => void;
  onNotesUpdate: (medId: string, notes: string) => void;
  onDelete: () => void;
  colors: AppColors;
  s: ReturnType<typeof createStyles>;
}) {
  const [notes, setNotes] = useState(med.notes ?? '');
  const lastSavedNotes = useRef(med.notes ?? '');

  function saveNotes() {
    const trimmed = notes.trim();
    if (trimmed === lastSavedNotes.current) return;
    lastSavedNotes.current = trimmed;
    onNotesUpdate(med.id, trimmed);
  }

  const brandLabel = getBrandLabel(med);
  const ingredient = GLP1_DISPLAY[med.glp1_type] ?? med.glp1_type;
  const route = med.route_of_administration === 'injection' ? 'Injection' : 'Oral';
  const freq = med.frequency_days === 1 ? 'Daily' : `Every ${med.frequency_days} days`;
  const halfLife = DRUG_HALF_LIFE_LABEL[med.glp1_type as keyof typeof DRUG_HALF_LIFE_LABEL] ?? '';

  return (
    <View>
      {!isFirst && <View style={s.rowDivider} />}

      {/* Row header — text only, trailing check (active) + expand chevron */}
      <Pressable onPress={onToggle} style={s.row}>
        <View style={s.rowText}>
          <Text style={s.medName} numberOfLines={1}>{brandLabel}</Text>
          <Text style={s.medDose}>{med.dose_mg} mg · {route} · {freq}</Text>
        </View>
        {active && (
          <View style={s.checkWrap}><Check size={15} color="#FFF" /></View>
        )}
        {expanded
          ? <ChevronUp size={18} color={colors.textMuted} />
          : <ChevronDown size={18} color={colors.textMuted} />}
      </Pressable>

      {/* Expanded detail */}
      {expanded && (
        <View style={s.rowExpanded}>
          {/* Info rows */}
          <View>
            <InfoRow label="Active Ingredient" value={ingredient} colors={colors} />
            <InfoRow label="Dose" value={`${med.dose_mg} mg`} colors={colors} />
            <InfoRow label="Route" value={med.route_of_administration === 'injection' ? 'Subcutaneous Injection' : 'Oral'} colors={colors} />
            <InfoRow label="Frequency" value={freq} colors={colors} />
            {halfLife ? <InfoRow label="Half-life" value={halfLife} colors={colors} isLast /> : null}
          </View>

          {/* Notes */}
          <Text style={[s.notesLabel, { marginTop: 14 }]}>NOTES</Text>
          <TextInput
            style={s.notesInput}
            multiline
            maxLength={500}
            placeholder="Add notes..."
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            onBlur={saveNotes}
            textAlignVertical="top"
          />

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            {!active && (
              <TouchableOpacity style={s.setActiveBtn} onPress={onSetActive} activeOpacity={0.85}>
                <Check size={16} color="#FFF" />
                <Text style={s.setActiveBtnText}>Set as Active</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.removeBtn} onPress={onDelete} activeOpacity={0.8}>
              <Trash2 size={16} color="#FF3B30" />
              <Text style={s.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function MedicationDetailScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useProfile();
  const s = useMemo(() => createStyles(colors), [colors]);
  const onTreatment = isOnTreatment(profile);

  // ── Pending medication switch (future-dated) ──
  const transitionPhase = getTransitionPhase(profile);
  const hasPending = transitionPhase !== 'none' && profile?.pendingFirstDoseDate != null;
  const pendingMedName = (() => {
    const brand = profile?.pendingMedicationBrand;
    if (!brand) return 'New medication';
    const display = BRAND_DISPLAY_NAMES[brand as keyof typeof BRAND_DISPLAY_NAMES];
    return !display || display === 'Other' ? 'New medication' : display;
  })();
  const pendingStartLabel = profile?.pendingFirstDoseDate
    ? new Date(profile.pendingFirstDoseDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  const pendingMeta = [
    profile?.pendingDoseMg != null ? `${profile.pendingDoseMg} mg` : null,
    profile?.pendingRoute ? (profile.pendingRoute.toLowerCase().includes('oral') ? 'Oral' : 'Injection') : null,
  ].filter(Boolean).join(' · ');

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Backed by a store that's preloaded at app start, so navigating here shows
  // the medication library instantly instead of flashing an empty state. We
  // still refetch on focus to stay fresh after edits elsewhere.
  const medications = useMedicationsStore((st) => st.medications);
  const loaded = useMedicationsStore((st) => st.loaded);
  const fetchMedications = useMedicationsStore((st) => st.fetchMedications);
  const loading = !loaded;

  useFocusEffect(
    useCallback(() => {
      fetchMedications();
    }, [fetchMedications]),
  );

  // Sync: if the profile's active medication isn't in the library, add it.
  // Queries the DB directly to avoid stale-state race with fetchMedications.
  useFocusEffect(
    useCallback(() => {
      if (!profile || !loaded) return;
      if (profile.treatmentStatus !== 'on' || !profile.medicationBrand) return;
      (async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        // Check the DB for an existing matching medication (not local state, which can be stale)
        const { data: existing } = await supabase
          .from('user_medications')
          .select('id')
          .eq('user_id', userData.user.id)
          .eq('medication_brand', profile.medicationBrand)
          .eq('dose_mg', profile.doseMg)
          .eq('glp1_type', profile.glp1Type)
          .limit(1);

        if (existing && existing.length > 0) {
          // Already exists — just make sure it's the active one
          await supabase.from('user_medications').update({ is_active: false }).eq('user_id', userData.user.id).neq('id', existing[0].id);
          await supabase.from('user_medications').update({ is_active: true }).eq('id', existing[0].id);
          await fetchMedications();
          return;
        }

        // Deactivate all existing entries
        await supabase.from('user_medications').update({ is_active: false }).eq('user_id', userData.user.id);

        // Insert the new active medication
        await supabase.from('user_medications').insert({
          user_id: userData.user.id,
          medication_brand: profile.medicationBrand,
          medication_custom_name: profile.medicationCustomName ?? null,
          glp1_type: profile.glp1Type,
          route_of_administration: profile.routeOfAdministration,
          dose_mg: profile.doseMg,
          frequency_days: profile.injectionFrequencyDays,
          dose_time: profile.doseTime || null,
          notes: null,
          photo_url: null,
          is_active: true,
        });
        await fetchMedications();
      })();
    }, [profile?.medicationBrand, profile?.doseMg, profile?.glp1Type, loaded]),
  );

  function handleToggle(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  }

  function handleSetActive(med: UserMedication) {
    // When off-treatment, no med is effectively active even if the DB row still
    // carries a stale is_active flag — so allow tapping it to resume.
    if (med.is_active && onTreatment) return;
    // Don't silently swap the active medication. Route through the full treatment
    // change flow (confirmation steps, medication_changes history, and target
    // recalculation) — same as changing meds from Settings. The user_medications
    // is_active flag is reconciled by the sync effect on focus once it's applied.
    router.push({
      pathname: '/settings/edit-treatment',
      params: {
        presetBrand: med.medication_brand,
        presetDose: String(med.dose_mg),
        presetFreq: String(med.frequency_days),
      },
    });
  }

  async function handleNotesUpdate(medId: string, notes: string) {
    await supabase.from('user_medications').update({ notes: notes || null }).eq('id', medId);
    const med = medications.find(m => m.id === medId);
    if (med?.is_active) await updateProfile({ medicationNotes: notes || null });
  }

  async function handleDelete(med: UserMedication) {
    if (med.is_active && onTreatment) {
      Alert.alert('Cannot Remove', 'This is your active medication. Set another medication as active first.');
      return;
    }
    Alert.alert('Remove Medication', `Remove ${getBrandLabel(med)} from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          if (med.photo_url) {
            await supabase.storage.from('medication-photos').remove([med.photo_url]).catch(() => {});
          }
          await supabase.from('user_medications').delete().eq('id', med.id);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          await fetchMedications();
        },
      },
    ]);
  }

  function handleStopMedication() {
    if (!onTreatment) return;
    Alert.alert(
      'Not taking a medication?',
      "You'll still have access to weight, food, and activity tracking. You can resume anytime by selecting a medication here.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateProfile({ treatmentStatus: 'off' });
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                // Clear the active flag so no card reads as active, and log the
                // change to medication history (same shape as Settings → Stop).
                await supabase.from('user_medications').update({ is_active: false }).eq('user_id', user.id);
                const { error: histErr } = await supabase.from('medication_changes').insert({
                  user_id: user.id,
                  change_type: 'stopped',
                  prev_brand: profile?.medicationBrand ?? null,
                  prev_glp1_type: profile?.glp1Type ?? null,
                  prev_dose_mg: profile?.doseMg ?? null,
                  prev_frequency_days: profile?.injectionFrequencyDays ?? null,
                  new_brand: null,
                  new_glp1_type: null,
                  new_dose_mg: null,
                  new_frequency_days: null,
                });
                if (histErr) console.warn('stop-medication (library): medication_changes.insert failed:', histErr);
              }
              useLogStore.getState().fetchInsightsData();
              await fetchMedications();
            } catch {
              Alert.alert('Error', 'Could not update treatment status. Please try again.');
            }
          },
        },
      ],
    );
  }

  function handleAddNew() {
    router.push('/settings/edit-treatment');
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* ── Hero header: large pen illustration + title ── */}
        <View style={[s.hero, { paddingTop: insets.top }]}>
          {/* Nav row */}
          <View style={[s.heroNav, { top: insets.top + 6 }]}>
            <TouchableOpacity onPress={() => router.back()} style={s.heroNavBtn} hitSlop={8}>
              <ChevronLeft size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Image source={MED_PEN} style={s.heroPen} resizeMode="contain" />
          <Text style={s.heroTitle}>My Medications</Text>
          <Text style={s.heroSubtitle}>Set your active medication, add new ones, or switch to lifestyle-only tracking.</Text>
        </View>

        <View style={s.body}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.orange} style={{ marginTop: 60 }} />
        ) : medications.length === 0 ? (
          <View style={s.emptyState}>
            <Hospital size={48} color={colors.textMuted} />
            <Text style={s.emptyTitle}>No medications yet</Text>
            <Text style={s.emptySub}>Add your first medication to get started</Text>
            <TouchableOpacity style={s.addBtn} onPress={handleAddNew} activeOpacity={0.8}>
              <PlusCircle size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={s.addBtnText}>Add Medication</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Incoming medication (scheduled switch not yet started) */}
            {hasPending && (
              <View style={s.pendingCard}>
                <View style={s.pendingIcon}>
                  <Pill size={18} color={colors.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.pendingTitleRow}>
                    <Text style={s.pendingName}>{pendingMedName}</Text>
                    <View style={s.pendingBadge}>
                      <Text style={s.pendingBadgeText}>
                        {pendingStartLabel ? `Starts ${pendingStartLabel}` : 'Scheduled'}
                      </Text>
                    </View>
                  </View>
                  {!!pendingMeta && <Text style={s.pendingMeta}>{pendingMeta}</Text>}
                  <Text style={s.pendingNote}>
                    {transitionPhase === 'washout'
                      ? 'Between medications — your current course has ended.'
                      : 'Replaces your current medication on the start date.'}
                  </Text>
                </View>
              </View>
            )}

            <Text style={s.groupLabel}>Current medication</Text>
            <View style={s.group}>
              {medications.map((med, index) => (
                <MedicationCard
                  key={med.id}
                  med={med}
                  active={med.is_active && onTreatment && !hasPending}
                  expanded={expandedId === med.id}
                  isFirst={index === 0}
                  onToggle={() => handleToggle(med.id)}
                  onSetActive={() => handleSetActive(med)}
                  onNotesUpdate={handleNotesUpdate}
                  onDelete={() => handleDelete(med)}
                  colors={colors}
                  s={s}
                />
              ))}

              {/* "Not taking" — last row in the group, drives treatmentStatus 'off' */}
              <View style={s.rowDivider} />
              <TouchableOpacity
                style={s.row}
                onPress={handleStopMedication}
                activeOpacity={0.7}
                disabled={!onTreatment}
              >
                <View style={s.rowText}>
                  <Text style={s.medName}>Not taking a medication</Text>
                  <Text style={s.medDose}>Lifestyle tracking only — weight, food, activity</Text>
                </View>
                {!onTreatment && (
                  <View style={s.checkWrap}><Check size={15} color="#FFF" /></View>
                )}
              </TouchableOpacity>
            </View>

            {/* Add medication — its own inset row */}
            <TouchableOpacity style={s.addRow} onPress={handleAddNew} activeOpacity={0.7}>
              <View style={s.addIcon}><Plus size={18} color={colors.orange} /></View>
              <Text style={s.addLabel}>Add Medication</Text>
            </TouchableOpacity>
          </>
        )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: c.textPrimary, fontSize: 18, fontWeight: '700', fontFamily: FF },
    scroll: { flex: 1 },
    content: { paddingBottom: 40 },

    // ── Hero header (no background — sits on the screen bg) ──
    hero: {},
    heroPen: {
      alignSelf: 'center',
      width: 300,
      height: 300,
      marginTop: 44, // clear the nav row
    },
    heroNav: {
      position: 'absolute',
      left: 8, right: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 1,
    },
    heroNavBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroTitle: {
      color: c.textPrimary,
      fontSize: 30, fontWeight: '800',
      letterSpacing: -0.4,
      fontFamily: FF,
      marginLeft: 20, marginTop: 4, marginBottom: 4,
    },
    heroSubtitle: {
      color: c.textSecondary,
      fontSize: 15, fontWeight: '500',
      lineHeight: 20,
      fontFamily: FF,
      marginHorizontal: 20, marginBottom: 10,
    },

    body: { paddingHorizontal: 16, paddingTop: 16 },

    // ── Grouped inset list (Apple-style selection list) ──
    groupLabel: {
      fontSize: 12, fontWeight: '600', color: c.textMuted,
      letterSpacing: 0.6, textTransform: 'uppercase',
      fontFamily: FF, marginLeft: 4, marginBottom: 8,
    },
    group: {
      backgroundColor: c.surface,
      borderRadius: 16, overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
      marginBottom: 18,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 15,
    },
    rowText: { flex: 1, minWidth: 0 },
    rowDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.borderSubtle,
      marginLeft: 16,
    },
    checkWrap: {
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: c.orange,
      alignItems: 'center', justifyContent: 'center',
    },
    rowExpanded: {
      paddingHorizontal: 16, paddingBottom: 16, paddingTop: 2,
    },
    setActiveBtn: {
      flex: 1,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: c.orange, borderRadius: 12, paddingVertical: 11,
    },
    setActiveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF', fontFamily: FF },
    removeBtn: {
      flex: 1,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: 'transparent',
      borderWidth: 1, borderColor: 'rgba(255,59,48,0.4)',
      borderRadius: 12, paddingVertical: 11,
    },
    removeBtnText: { fontSize: 14, fontWeight: '600', color: '#FF3B30', fontFamily: FF },

    // Add medication — inset row
    addRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.surface,
      borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
    },
    addIcon: {
      width: 28, height: 28, borderRadius: 8,
      backgroundColor: 'rgba(255,116,42,0.14)',
      alignItems: 'center', justifyContent: 'center',
    },
    addLabel: { fontSize: 16, fontWeight: '600', color: c.orange, fontFamily: FF },

    // Medication card
    medCard: {
      borderRadius: 20, overflow: 'hidden',
      backgroundColor: c.surface,
      borderWidth: 0.5, borderColor: c.border,
      marginBottom: 12,
    },
    medCardActive: {
      borderColor: c.orange, borderWidth: 1,
    },
    medCardHeader: {
      flexDirection: 'row', alignItems: 'center',
      padding: 14,
    },
    selectCircle: {
      marginRight: 10,
    },
    selectCircleFilled: {
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: c.orange,
      alignItems: 'center', justifyContent: 'center',
    },
    selectCircleEmpty: {
      width: 24, height: 24, borderRadius: 12,
      borderWidth: 2, borderColor: w(0.2),
    },
    medThumb: {
      width: 48, height: 48, borderRadius: 12,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    medThumbImg: { width: 48, height: 48 },
    medName: {
      fontSize: 17, fontWeight: '700', color: c.textPrimary, fontFamily: FF,
      flexShrink: 1,
    },
    medDose: {
      fontSize: 13, color: c.textMuted, fontFamily: FF, marginTop: 2,
    },

    // Expanded section
    medExpanded: {
      paddingHorizontal: 14, paddingBottom: 14,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle,
    },
    medPhotoArea: {
      height: 160, borderRadius: 14, overflow: 'hidden',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      alignItems: 'center', justifyContent: 'center',
      marginTop: 12,
    },
    medPhotoImg: { width: '100%', height: '100%' },
    medPhotoPlaceholder: {
      alignItems: 'center', justifyContent: 'center',
    },

    // Notes
    notesLabel: {
      fontSize: 12, fontWeight: '800', color: c.orange,
      letterSpacing: 2, fontFamily: FF, marginBottom: 6,
    },
    notesInput: {
      fontSize: 14, color: c.textPrimary, fontFamily: FF,
      minHeight: 60, lineHeight: 20,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      borderRadius: 12, padding: 12,
    },

    // Action buttons
    actionBtn: {
      flex: 1,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.orange, borderRadius: 12,
      paddingVertical: 10, gap: 6,
    },
    actionBtnText: {
      fontSize: 14, fontWeight: '600', color: '#FFF', fontFamily: FF,
    },

    // "Not taking a medication" row
    pendingCard: {
      flexDirection: 'row', gap: 12,
      borderRadius: 20, padding: 14,
      backgroundColor: 'rgba(255,116,42,0.08)',
      borderWidth: 1, borderColor: 'rgba(255,116,42,0.3)',
      marginBottom: 12,
    },
    pendingIcon: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(255,116,42,0.15)',
      alignItems: 'center', justifyContent: 'center',
    },
    pendingTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    pendingName: { fontSize: 16, fontWeight: '800', color: c.textPrimary, flexShrink: 1 },
    pendingBadge: {
      backgroundColor: c.orange, borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    pendingBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
    pendingMeta: { fontSize: 13, fontWeight: '600', color: c.textSecondary, marginTop: 3 },
    pendingNote: { fontSize: 12, fontWeight: '500', color: c.textMuted, marginTop: 6, lineHeight: 17 },

    noneRow: {
      flexDirection: 'row', alignItems: 'center',
      borderRadius: 20, padding: 14,
      backgroundColor: c.surface,
      borderWidth: 0.5, borderColor: c.border,
      marginBottom: 12,
    },
    noneRowActive: {
      borderColor: c.orange, borderWidth: 1,
    },
    noneTitle: {
      fontSize: 16, fontWeight: '700', color: c.textPrimary, fontFamily: FF,
    },
    noneSub: {
      fontSize: 13, color: c.textMuted, fontFamily: FF, marginTop: 2,
    },

    // Add new
    addNewBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: c.orange, borderRadius: 16,
      paddingVertical: 14, marginTop: 4,
    },
    addNewBtnText: {
      fontSize: 16, fontWeight: '600', color: c.orange, fontFamily: FF,
    },

    // Empty state
    emptyState: {
      alignItems: 'center', justifyContent: 'center',
      paddingTop: 80, gap: 8,
    },
    emptyTitle: {
      fontSize: 20, fontWeight: '700', color: c.textPrimary, fontFamily: FF, marginTop: 12,
    },
    emptySub: {
      fontSize: 15, color: c.textMuted, fontFamily: FF, textAlign: 'center',
    },
    addBtn: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.orange, borderRadius: 14,
      paddingHorizontal: 20, paddingVertical: 12,
      marginTop: 16,
    },
    addBtnText: {
      fontSize: 16, fontWeight: '700', color: '#FFF', fontFamily: FF,
    },
  });
};
