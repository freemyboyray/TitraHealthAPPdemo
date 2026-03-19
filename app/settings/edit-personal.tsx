import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OptionPill } from '@/components/onboarding/option-pill';
import { WheelPicker } from '@/components/onboarding/wheel-picker';
import type { AppColors } from '@/constants/theme';
import { ActivityLevel, Sex } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';

const ORANGE = '#FF742A';

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: '♂  Male' },
  { value: 'female', label: '♀  Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const ACTIVITY_ICON_COLOR = 'rgba(255,255,255,0.7)';
const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; icon: React.ReactNode; subtitle: string }[] = [
  { value: 'sedentary',   label: 'Sedentary',      icon: <MaterialIcons name="event-seat"      size={20} color={ACTIVITY_ICON_COLOR} />, subtitle: 'Mostly seated, little exercise' },
  { value: 'light',       label: 'Lightly Active',  icon: <MaterialIcons name="directions-walk" size={20} color={ACTIVITY_ICON_COLOR} />, subtitle: 'Some walking or light movement' },
  { value: 'active',      label: 'Active',           icon: <MaterialIcons name="directions-run"  size={20} color={ACTIVITY_ICON_COLOR} />, subtitle: 'Regular workouts or physical tasks' },
  { value: 'very_active', label: 'Very Active',      icon: <MaterialIcons name="flash-on"        size={20} color={ACTIVITY_ICON_COLOR} />, subtitle: 'Intense exercise or very physical job' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1939 }, (_, i) =>
  String(CURRENT_YEAR - i),
).filter((y) => parseInt(y) <= CURRENT_YEAR - 16);

export default function EditPersonalScreen() {
  const { profile, updateProfile } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'prefer_not_to_say');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile?.activityLevel ?? 'light');

  // Birthday reverse-mapping from YYYY-MM-DD
  const birthdayParts = (profile?.birthday || '1990-01-01').split('-');
  const [yearIdx, setYearIdx] = useState(() => Math.max(0, YEARS.indexOf(birthdayParts[0] ?? '1990')));
  const [monthIdx, setMonthIdx] = useState(() => Math.max(0, parseInt(birthdayParts[1] ?? '1') - 1));
  const [dayIdx, setDayIdx] = useState(() => Math.max(0, parseInt(birthdayParts[2] ?? '1') - 1));

  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const m = String(monthIdx + 1).padStart(2, '0');
    const d = String(dayIdx + 1).padStart(2, '0');
    const year = YEARS[yearIdx];
    await updateProfile({
      sex,
      birthday: `${year}-${m}-${d}`,
      activityLevel,
    });
    router.back();
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>PERSONAL</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Sex */}
        <Text style={s.sectionLabel}>Sex</Text>
        {SEX_OPTIONS.map((o) => (
          <OptionPill
            key={o.value}
            label={o.label}
            selected={sex === o.value}
            onPress={() => setSex(o.value)}
          />
        ))}

        {/* Birthday */}
        <Text style={[s.sectionLabel, { marginTop: 28 }]}>Birthday</Text>
        <View style={s.pickersRow}>
          <View style={s.pickerWrapLg}>
            <Text style={s.colLabel}>Month</Text>
            <WheelPicker data={MONTHS} selectedIndex={monthIdx} onSelect={setMonthIdx} />
          </View>
          <View style={s.pickerWrapSm}>
            <Text style={s.colLabel}>Day</Text>
            <WheelPicker data={DAYS} selectedIndex={dayIdx} onSelect={setDayIdx} />
          </View>
          <View style={s.pickerWrapSm}>
            <Text style={s.colLabel}>Year</Text>
            <WheelPicker data={YEARS} selectedIndex={yearIdx} onSelect={setYearIdx} />
          </View>
        </View>

        {/* Activity Level */}
        <Text style={[s.sectionLabel, { marginTop: 28 }]}>Activity Level</Text>
        {ACTIVITY_OPTIONS.map((o) => (
          <OptionPill
            key={o.value}
            label={o.label}
            icon={o.icon}
            subtitle={o.subtitle}
            selected={activityLevel === o.value}
            onPress={() => setActivityLevel(o.value)}
          />
        ))}

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
  sectionLabel: { fontSize: 16, fontWeight: '700', color: c.textPrimary, marginBottom: 12 },
  pickersRow: { flexDirection: 'row', gap: 8, alignItems: 'center', height: 200 },
  pickerWrapLg: { flex: 2 },
  pickerWrapSm: { flex: 1 },
  colLabel: {
    fontSize: 12, fontWeight: '600', color: c.textSecondary,
    textAlign: 'center', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase',
  },
  footer: { padding: 16, paddingBottom: 8 },
  saveBtn: {
    backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
