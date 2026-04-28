import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { supabase } from '@/lib/supabase';
import { BRAND_DISPLAY_NAMES, BRAND_TO_GLP1_TYPE } from '@/constants/user-profile';
import { DRUG_HALF_LIFE_LABEL } from '@/constants/drug-pk';
import type { AppColors } from '@/constants/theme';

const ORANGE = '#FF742A';
const FF = 'System';

const GLP1_DISPLAY: Record<string, string> = {
  semaglutide: 'Semaglutide',
  tirzepatide: 'Tirzepatide',
  dulaglutide: 'Dulaglutide',
  liraglutide: 'Liraglutide',
  oral_semaglutide: 'Semaglutide (oral)',
  orforglipron: 'Orforglipron',
};

type UserMedication = {
  id: string;
  medication_brand: string;
  medication_custom_name: string | null;
  glp1_type: string;
  route_of_administration: string;
  dose_mg: number;
  frequency_days: number;
  dose_time: string | null;
  notes: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
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

// ── Medication Card ──────────────────────────────────────────────────────────

function MedicationCard({
  med,
  expanded,
  onToggle,
  onSetActive,
  onPhotoUpload,
  onNotesUpdate,
  onDelete,
  colors,
  s,
}: {
  med: UserMedication;
  expanded: boolean;
  onToggle: () => void;
  onSetActive: () => void;
  onPhotoUpload: (medId: string) => void;
  onNotesUpdate: (medId: string, notes: string) => void;
  onDelete: () => void;
  colors: AppColors;
  s: ReturnType<typeof createStyles>;
}) {
  const [photoSignedUrl, setPhotoSignedUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState(med.notes ?? '');
  const lastSavedNotes = useRef(med.notes ?? '');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!med.photo_url) { setPhotoSignedUrl(null); return; }
      (async () => {
        const { data } = await supabase.storage
          .from('medication-photos')
          .createSignedUrl(med.photo_url!, 3600);
        if (!cancelled && data?.signedUrl) setPhotoSignedUrl(data.signedUrl);
      })();
      return () => { cancelled = true; };
    }, [med.photo_url]),
  );

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
    <View style={[s.medCard, med.is_active && s.medCardActive]}>
      <View style={s.medCardHeader}>
        {/* Selection circle — separate touchable */}
        <TouchableOpacity onPress={onSetActive} activeOpacity={0.6} style={s.selectCircle}>
          {med.is_active ? (
            <View style={s.selectCircleFilled}>
              <Ionicons name="checkmark" size={14} color="#FFF" />
            </View>
          ) : (
            <View style={s.selectCircleEmpty} />
          )}
        </TouchableOpacity>

        {/* Rest of row — taps to expand */}
        <Pressable onPress={onToggle} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {/* Thumbnail */}
          <View style={s.medThumb}>
            {photoSignedUrl ? (
              <Image source={{ uri: photoSignedUrl }} style={s.medThumbImg} resizeMode="cover" />
            ) : (
              <Ionicons name="medkit" size={22} color={colors.textMuted} />
            )}
          </View>

          {/* Name + dose */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.medName} numberOfLines={1}>{brandLabel}</Text>
            <Text style={s.medDose}>{med.dose_mg} mg · {route} · {freq}</Text>
          </View>

          {/* Expand chevron */}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={s.medExpanded}>
          {/* Photo section */}
          <Pressable onPress={() => onPhotoUpload(med.id)} style={s.medPhotoArea}>
            {photoSignedUrl ? (
              <Image source={{ uri: photoSignedUrl }} style={s.medPhotoImg} resizeMode="cover" />
            ) : (
              <View style={s.medPhotoPlaceholder}>
                <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
                <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: FF, marginTop: 4 }}>Add photo</Text>
              </View>
            )}
          </Pressable>

          {/* Info rows */}
          <View style={{ marginTop: 12 }}>
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
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,59,48,0.4)' }]}
              onPress={onDelete}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color="#FF3B30" />
              <Text style={[s.actionBtnText, { color: '#FF3B30' }]}>Remove</Text>
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
  const { profile, updateProfile } = useProfile();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [medications, setMedications] = useState<UserMedication[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const fetchMedications = useCallback(async () => {
    const { data } = await supabase
      .from('user_medications')
      .select('*')
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });
    if (data) setMedications(data as UserMedication[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMedications();
    }, [fetchMedications]),
  );

  // Sync: if the profile's active medication isn't in the library, add it
  useFocusEffect(
    useCallback(() => {
      if (!profile || loading) return;
      if (profile.treatmentStatus !== 'on' || !profile.medicationBrand) return;
      (async () => {
        // Check if the current active profile medication already exists in library
        const alreadyExists = medications.some(
          m => m.medication_brand === profile.medicationBrand
            && m.dose_mg === profile.doseMg
            && m.glp1_type === profile.glp1Type,
        );
        if (alreadyExists) return;

        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        // Deactivate all existing entries
        if (medications.length > 0) {
          await supabase.from('user_medications').update({ is_active: false }).eq('user_id', userData.user.id);
        }

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
    }, [profile?.medicationBrand, profile?.doseMg, profile?.glp1Type, loading]),
  );

  function handleToggle(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  }

  async function handleSetActive(med: UserMedication) {
    // Deactivate all, activate this one
    await supabase.from('user_medications').update({ is_active: false }).neq('id', med.id);
    await supabase.from('user_medications').update({ is_active: true }).eq('id', med.id);

    // Update profile to match
    const glp1Type = med.glp1_type as any;
    await updateProfile({
      medicationBrand: med.medication_brand as any,
      medicationCustomName: med.medication_custom_name,
      glp1Type,
      routeOfAdministration: med.route_of_administration as any,
      doseMg: med.dose_mg,
      injectionFrequencyDays: med.frequency_days,
      doseTime: med.dose_time || '',
      treatmentStatus: 'on' as any,
    });

    await fetchMedications();
  }

  async function handlePhotoUpload(medId: string) {
    Alert.alert('Medication Photo', 'Add a photo', [
      {
        text: 'Take Photo',
        onPress: () => pickAndUpload(medId, 'camera'),
      },
      {
        text: 'Choose from Library',
        onPress: () => pickAndUpload(medId, 'library'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function pickAndUpload(medId: string, source: 'camera' | 'library') {
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, base64: true, quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, base64: true, quality: 0.6 });

    if (result.canceled || !result.assets[0]?.base64) return;

    setUploading(medId);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const path = `${userData.user.id}/med-${medId}-${Date.now()}.jpg`;
      const med = medications.find(m => m.id === medId);
      if (med?.photo_url) {
        await supabase.storage.from('medication-photos').remove([med.photo_url]).catch(() => {});
      }

      const bytes = Uint8Array.from(atob(result.assets[0].base64), c => c.charCodeAt(0));
      const { error } = await supabase.storage
        .from('medication-photos')
        .upload(path, bytes, { contentType: 'image/jpeg' });

      if (error) { Alert.alert('Upload Failed', error.message); return; }

      await supabase.from('user_medications').update({ photo_url: path }).eq('id', medId);
      if (med?.is_active) await updateProfile({ medicationPhotoUrl: path });
      await fetchMedications();
    } catch {
      Alert.alert('Upload Failed', 'Please try again.');
    } finally {
      setUploading(null);
    }
  }

  async function handleNotesUpdate(medId: string, notes: string) {
    await supabase.from('user_medications').update({ notes: notes || null }).eq('id', medId);
    const med = medications.find(m => m.id === medId);
    if (med?.is_active) await updateProfile({ medicationNotes: notes || null });
  }

  async function handleDelete(med: UserMedication) {
    if (med.is_active) {
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

  function handleAddNew() {
    router.push('/settings/edit-treatment');
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Medications</Text>
        <TouchableOpacity onPress={handleAddNew} style={s.backBtn}>
          <Ionicons name="add" size={26} color={ORANGE} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={ORANGE} style={{ marginTop: 60 }} />
        ) : medications.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="medkit-outline" size={48} color={colors.textMuted} />
            <Text style={s.emptyTitle}>No medications yet</Text>
            <Text style={s.emptySub}>Add your first medication to get started</Text>
            <TouchableOpacity style={s.addBtn} onPress={handleAddNew} activeOpacity={0.8}>
              <Ionicons name="add-circle" size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={s.addBtnText}>Add Medication</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {medications.map(med => (
              <MedicationCard
                key={med.id}
                med={med}
                expanded={expandedId === med.id}
                onToggle={() => handleToggle(med.id)}
                onSetActive={() => handleSetActive(med)}
                onPhotoUpload={handlePhotoUpload}
                onNotesUpdate={handleNotesUpdate}
                onDelete={() => handleDelete(med)}
                colors={colors}
                s={s}
              />
            ))}

            <TouchableOpacity style={s.addNewBtn} onPress={handleAddNew} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={18} color={ORANGE} style={{ marginRight: 8 }} />
              <Text style={s.addNewBtnText}>Add New Medication</Text>
            </TouchableOpacity>
          </>
        )}
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
    content: { padding: 16, paddingBottom: 40 },

    // Medication card
    medCard: {
      borderRadius: 20, overflow: 'hidden',
      backgroundColor: c.surface,
      borderWidth: 0.5, borderColor: c.border,
      marginBottom: 12,
    },
    medCardActive: {
      borderColor: ORANGE, borderWidth: 1,
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
      backgroundColor: ORANGE,
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
      fontSize: 12, fontWeight: '800', color: ORANGE,
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
      backgroundColor: ORANGE, borderRadius: 12,
      paddingVertical: 10, gap: 6,
    },
    actionBtnText: {
      fontSize: 14, fontWeight: '600', color: '#FFF', fontFamily: FF,
    },

    // Add new
    addNewBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: ORANGE, borderRadius: 16,
      paddingVertical: 14, marginTop: 4,
    },
    addNewBtnText: {
      fontSize: 16, fontWeight: '600', color: ORANGE, fontFamily: FF,
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
      backgroundColor: ORANGE, borderRadius: 14,
      paddingHorizontal: 20, paddingVertical: 12,
      marginTop: 16,
    },
    addBtnText: {
      fontSize: 16, fontWeight: '700', color: '#FFF', fontFamily: FF,
    },
  });
};
