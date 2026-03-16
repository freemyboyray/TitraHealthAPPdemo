import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OptionPill } from '@/components/onboarding/option-pill';
import type { AppColors } from '@/constants/theme';
import {
  BRAND_DEFAULT_FREQ_DAYS, BRAND_TO_GLP1_TYPE, BRAND_TO_ROUTE,
  MedicationBrand, getBrandDoses, toDateString,
} from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { DRUG_IS_ORAL } from '@/constants/drug-pk';

const ORANGE = '#FF742A';

type BrandOption = { value: MedicationBrand; label: string; note?: string };
type BrandGroup = { heading: string; subheading: string; brands: BrandOption[] };

const BRAND_GROUPS: BrandGroup[] = [
  {
    heading: 'Weekly Injection',
    subheading: 'Administered once a week by subcutaneous injection',
    brands: [
      { value: 'zepbound',               label: 'Zepbound®',              note: 'Tirzepatide' },
      { value: 'mounjaro',               label: 'Mounjaro®',              note: 'Tirzepatide' },
      { value: 'wegovy',                 label: 'Wegovy®',                note: 'Semaglutide' },
      { value: 'ozempic',                label: 'Ozempic®',               note: 'Semaglutide (off-label wt loss)' },
      { value: 'trulicity',              label: 'Trulicity®',             note: 'Dulaglutide' },
      { value: 'compounded_semaglutide', label: 'Compounded Semaglutide', note: 'Weekly' },
      { value: 'compounded_tirzepatide', label: 'Compounded Tirzepatide', note: 'Weekly' },
    ],
  },
  {
    heading: 'Daily Injection',
    subheading: 'Administered once a day by subcutaneous injection',
    brands: [
      { value: 'saxenda',                label: 'Saxenda®',               note: 'Liraglutide 3 mg' },
      { value: 'victoza',                label: 'Victoza®',               note: 'Liraglutide (off-label wt loss)' },
      { value: 'compounded_liraglutide', label: 'Compounded Liraglutide', note: 'Daily' },
    ],
  },
  {
    heading: 'Daily Oral Pill',
    subheading: 'Taken by mouth once a day - no injections',
    brands: [
      { value: 'oral_wegovy',  label: 'Oral Wegovy®',  note: 'Semaglutide 25 mg · FDA approved Dec 2025' },
      { value: 'rybelsus',     label: 'Rybelsus®',     note: 'Semaglutide 3/7/14 mg · T2D approved' },
      { value: 'orforglipron', label: 'Orforglipron',  note: 'Eli Lilly · NDA filed - FDA decision Q2 2026' },
    ],
  },
  {
    heading: 'Other',
    subheading: '',
    brands: [{ value: 'other', label: 'Other / Not listed' }],
  },
];

const INJECTABLE_FREQUENCIES = [
  { label: 'Every day',                  days: 1 as number | 'custom' },
  { label: 'Every 7 days (most common)', days: 7 as number | 'custom' },
  { label: 'Every 14 days',             days: 14 as number | 'custom' },
  { label: 'Custom',                     days: 'custom' as number | 'custom' },
];

export default function EditMedicationScreen() {
  const { profile, updateProfile } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [brand, setBrand] = useState<MedicationBrand>(profile?.medicationBrand ?? 'ozempic');
  const [dose, setDose] = useState<number | 'custom'>(
    () => {
      const doses = getBrandDoses(profile?.medicationBrand ?? 'ozempic');
      return doses.includes(profile?.doseMg ?? 0) ? (profile?.doseMg ?? doses[0]) : 'custom';
    }
  );
  const [customDose, setCustomDose] = useState(() => {
    const doses = getBrandDoses(profile?.medicationBrand ?? 'ozempic');
    return doses.includes(profile?.doseMg ?? 0) ? '' : String(profile?.doseMg ?? '');
  });
  const [freq, setFreq] = useState<number | 'custom'>(
    () => {
      const validFreqs = [1, 7, 14];
      const pFreq = profile?.injectionFrequencyDays ?? 7;
      return validFreqs.includes(pFreq) ? pFreq : 'custom';
    }
  );
  const [customFreq, setCustomFreq] = useState(() => {
    const validFreqs = [1, 7, 14];
    const pFreq = profile?.injectionFrequencyDays ?? 7;
    return validFreqs.includes(pFreq) ? '' : String(pFreq);
  });
  const [lastInjDate, setLastInjDate] = useState(() =>
    profile?.lastInjectionDate
      ? new Date(profile.lastInjectionDate + 'T12:00:00')
      : new Date()
  );
  const [doseStartDate, setDoseStartDate] = useState(() =>
    profile?.doseStartDate
      ? new Date(profile.doseStartDate + 'T12:00:00')
      : new Date()
  );
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const glp1Type = BRAND_TO_GLP1_TYPE[brand];
  const isOral = DRUG_IS_ORAL[glp1Type] ?? false;
  const brandDoses = getBrandDoses(brand);

  function handleBrandChange(b: MedicationBrand) {
    setBrand(b);
    const newFreq = BRAND_DEFAULT_FREQ_DAYS[b];
    setFreq(newFreq);
    setCustomFreq('');
    // reset dose selection if brand changes
    const newDoses = getBrandDoses(b);
    if (!newDoses.includes(dose as number)) {
      setDose(newDoses[0]);
      setCustomDose('');
    }
  }

  const freqDays = freq === 'custom'
    ? (customFreq !== '' ? parseInt(customFreq, 10) : null)
    : freq;
  const doseMg = dose === 'custom'
    ? (customDose !== '' && !isNaN(parseFloat(customDose)) ? parseFloat(customDose) : null)
    : dose;
  const isValid = freqDays !== null && doseMg !== null;

  async function handleSave() {
    if (saving || !isValid) return;
    setSaving(true);
    await updateProfile({
      medicationBrand: brand,
      glp1Type: BRAND_TO_GLP1_TYPE[brand],
      routeOfAdministration: BRAND_TO_ROUTE[brand],
      injectionFrequencyDays: freqDays as number,
      doseMg: doseMg as number,
      lastInjectionDate: toDateString(lastInjDate),
      doseStartDate: toDateString(doseStartDate),
    });
    router.back();
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>MEDICATION</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Brand picker */}
        {BRAND_GROUPS.map((group) => (
          <View key={group.heading} style={s.group}>
            <Text style={s.groupHeading}>{group.heading}</Text>
            {group.subheading ? <Text style={s.groupSub}>{group.subheading}</Text> : null}
            {group.brands.map((b) => (
              <OptionPill
                key={b.value}
                label={b.note ? `${b.label}  ·  ${b.note}` : b.label}
                selected={brand === b.value}
                onPress={() => handleBrandChange(b.value)}
              />
            ))}
          </View>
        ))}

        {/* Dose */}
        <Text style={s.sectionLabel}>Current Dose</Text>
        {brandDoses.map((d) => (
          <OptionPill
            key={String(d)}
            label={`${d} mg`}
            selected={dose === d}
            onPress={() => { setDose(d); setCustomDose(''); }}
          />
        ))}
        <OptionPill
          label="Custom / Other"
          selected={dose === 'custom'}
          onPress={() => setDose('custom')}
        />
        {dose === 'custom' && (
          <TextInput
            style={s.input}
            placeholder="Enter dose in mg (e.g. 3.5)"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={customDose}
            onChangeText={setCustomDose}
            autoFocus
          />
        )}

        {/* Frequency - hide for oral */}
        {!isOral && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 24 }]}>Frequency</Text>
            {INJECTABLE_FREQUENCIES.map((f) => (
              <OptionPill
                key={String(f.days)}
                label={f.label}
                selected={freq === f.days}
                onPress={() => { setFreq(f.days); setCustomFreq(''); }}
              />
            ))}
            {freq === 'custom' && (
              <TextInput
                style={s.input}
                placeholder="Frequency in days (e.g. 10)"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={customFreq}
                onChangeText={setCustomFreq}
                autoFocus
              />
            )}
          </>
        )}

        {/* Last dose date */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>
          {isOral ? 'When did you last take your pill?' : 'When was your last injection?'}
        </Text>
        <View style={s.datePickerWrap}>
          <DateTimePicker
            value={lastInjDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            maximumDate={new Date()}
            onChange={(_, date) => { if (date) setLastInjDate(date); }}
            style={s.datePicker}
          />
        </View>

        {/* Dose start date */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>When did you start this dose?</Text>
        <View style={s.datePickerWrap}>
          <DateTimePicker
            value={doseStartDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            maximumDate={new Date()}
            onChange={(_, date) => { if (date) setDoseStartDate(date); }}
            style={s.datePicker}
          />
        </View>

      </ScrollView>

      <View style={s.footer}>
        <Pressable style={[s.saveBtn, (!isValid || saving) && s.saveBtnDisabled]} onPress={handleSave} disabled={!isValid || saving}>
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
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 4 },
  group: { marginBottom: 20 },
  groupHeading: {
    fontSize: 13, fontWeight: '700', color: ORANGE,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4,
  },
  groupSub: { fontSize: 12, color: c.textMuted, marginBottom: 10 },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: c.textPrimary, marginBottom: 12 },
  input: {
    height: 52, borderWidth: 1.5, borderColor: c.border, borderRadius: 14,
    paddingHorizontal: 16, fontSize: 16, color: c.textPrimary,
    marginTop: 4, marginBottom: 4, backgroundColor: c.bg,
  },
  datePickerWrap: { marginBottom: 8 },
  datePicker: { alignSelf: 'flex-start' },
  footer: { padding: 16, paddingBottom: 8 },
  saveBtn: {
    backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
