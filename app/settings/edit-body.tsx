import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WheelPicker } from '@/components/onboarding/wheel-picker';
import type { AppColors } from '@/constants/theme';
import { UnitSystem } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';

const ORANGE = '#FF742A';

const FEET = Array.from({ length: 4 }, (_, i) => `${i + 4} ft`);
const INCHES = Array.from({ length: 12 }, (_, i) => `${i} in`);
const LBS_WHOLE = Array.from({ length: 321 }, (_, i) => `${i + 80} lbs`);
const LBS_HALF = ['.0', '.5'];
const CM = Array.from({ length: 101 }, (_, i) => `${i + 120} cm`);
const KG = Array.from({ length: 161 }, (_, i) => `${i + 40} kg`);

export default function EditBodyScreen() {
  const { profile, updateProfile } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [unit, setUnit] = useState<UnitSystem>(profile?.unitSystem ?? 'imperial');

  // Imperial indices - reverse-mapped from profile
  const [ftIdx, setFtIdx] = useState(() => Math.max(0, (profile?.heightFt ?? 5) - 4));
  const [inIdx, setInIdx] = useState(() => profile?.heightIn ?? 6);
  const [lbsIdx, setLbsIdx] = useState(() => Math.max(0, Math.floor(profile?.weightLbs ?? 180) - 80));
  const [halfIdx, setHalfIdx] = useState(() => ((profile?.weightLbs ?? 0) % 1) >= 0.5 ? 1 : 0);

  // Metric indices
  const [cmIdx, setCmIdx] = useState(() => Math.max(0, (profile?.heightCm ?? 165) - 120));
  const [kgIdx, setKgIdx] = useState(() => Math.max(0, Math.round(profile?.weightKg ?? 80) - 40));

  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    if (unit === 'imperial') {
      const ft = ftIdx + 4;
      const inches = inIdx;
      const lbs = lbsIdx + 80 + (halfIdx === 1 ? 0.5 : 0);
      await updateProfile({
        unitSystem: 'imperial',
        heightFt: ft,
        heightIn: inches,
        heightCm: Math.round(((ft * 12) + inches) * 2.54),
        weightLbs: lbs,
        startWeightLbs: lbs,
        weightKg: Math.round(lbs * 0.453592 * 10) / 10,
      });
    } else {
      const cm = cmIdx + 120;
      const kg = kgIdx + 40;
      const lbs = Math.round(kg * 2.20462 * 10) / 10;
      await updateProfile({
        unitSystem: 'metric',
        heightCm: cm,
        heightFt: Math.floor(cm / 30.48),
        heightIn: Math.round((cm / 2.54) % 12),
        weightKg: kg,
        weightLbs: lbs,
        startWeightLbs: lbs,
      });
    }
    router.back();
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>BODY</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Unit toggle */}
        <View style={s.toggle}>
          <TouchableOpacity
            style={[s.toggleBtn, unit === 'imperial' && s.toggleBtnActive]}
            onPress={() => setUnit('imperial')}>
            <Text style={[s.toggleText, unit === 'imperial' && s.toggleTextActive]}>Imperial</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, unit === 'metric' && s.toggleBtnActive]}
            onPress={() => setUnit('metric')}>
            <Text style={[s.toggleText, unit === 'metric' && s.toggleTextActive]}>Metric</Text>
          </TouchableOpacity>
        </View>

        {/* Height */}
        <Text style={s.sectionLabel}>Height</Text>
        <View style={s.pickersRow}>
          {unit === 'imperial' ? (
            <>
              <View style={s.pickerWrap}>
                <WheelPicker data={FEET} selectedIndex={ftIdx} onSelect={setFtIdx} />
              </View>
              <View style={s.pickerWrap}>
                <WheelPicker data={INCHES} selectedIndex={inIdx} onSelect={setInIdx} />
              </View>
            </>
          ) : (
            <View style={s.pickerWrap}>
              <WheelPicker data={CM} selectedIndex={cmIdx} onSelect={setCmIdx} />
            </View>
          )}
        </View>

        {/* Weight */}
        <Text style={[s.sectionLabel, { marginTop: 16 }]}>Weight</Text>
        <View style={s.pickersRow}>
          {unit === 'imperial' ? (
            <>
              <View style={s.pickerWrap}>
                <WheelPicker data={LBS_WHOLE} selectedIndex={lbsIdx} onSelect={setLbsIdx} />
              </View>
              <View style={[s.pickerWrap, { flex: 0.5 }]}>
                <WheelPicker data={LBS_HALF} selectedIndex={halfIdx} onSelect={setHalfIdx} />
              </View>
            </>
          ) : (
            <View style={s.pickerWrap}>
              <WheelPicker data={KG} selectedIndex={kgIdx} onSelect={setKgIdx} />
            </View>
          )}
        </View>

      </ScrollView>

      <View style={s.footer}>
        <Pressable style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </Pressable>
      </View>
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
  headerTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '700', letterSpacing: 3.5 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: c.glassOverlay,
    borderRadius: 12, padding: 3, marginBottom: 28, alignSelf: 'flex-start',
  },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: ORANGE },
  toggleText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
  toggleTextActive: { color: '#FFFFFF' },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: c.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  pickersRow: { flexDirection: 'row', gap: 8 },
  pickerWrap: { flex: 1 },
  footer: { padding: 16, paddingBottom: 8 },
  saveBtn: {
    backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
