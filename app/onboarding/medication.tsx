import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { BRAND_TO_GLP1_TYPE, BRAND_TO_ROUTE, BRAND_DEFAULT_FREQ_DAYS, MedicationBrand } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

type BrandOption = { value: MedicationBrand; label: string; note?: string };
type BrandGroup = { heading: string; subheading: string; brands: BrandOption[] };

const BRAND_GROUPS: BrandGroup[] = [
  {
    heading: 'Weekly Injection',
    subheading: 'Once a week',
    brands: [
      { value: 'zepbound',               label: 'Zepbound',                note: 'Tirzepatide' },
      { value: 'mounjaro',               label: 'Mounjaro',                note: 'Tirzepatide' },
      { value: 'wegovy',                 label: 'Wegovy',                  note: 'Semaglutide' },
      { value: 'ozempic',                label: 'Ozempic',                 note: 'Semaglutide' },
      { value: 'trulicity',              label: 'Trulicity',               note: 'Dulaglutide' },
      { value: 'compounded_semaglutide', label: 'Compounded Semaglutide' },
      { value: 'compounded_tirzepatide', label: 'Compounded Tirzepatide' },
    ],
  },
  {
    heading: 'Daily Injection',
    subheading: 'Once a day',
    brands: [
      { value: 'saxenda',                label: 'Saxenda',                 note: 'Liraglutide' },
      { value: 'victoza',                label: 'Victoza',                 note: 'Liraglutide' },
      { value: 'compounded_liraglutide', label: 'Compounded Liraglutide' },
    ],
  },
  {
    heading: 'Oral Pill',
    subheading: 'Taken by mouth — no injections',
    brands: [
      { value: 'oral_wegovy',  label: 'Oral Wegovy',    note: 'Semaglutide' },
      { value: 'rybelsus',     label: 'Rybelsus',       note: 'Semaglutide' },
      { value: 'orforglipron', label: 'Orforglipron',   note: 'Eli Lilly' },
    ],
  },
  {
    heading: 'Other',
    subheading: '',
    brands: [
      { value: 'other', label: 'Other / Not listed' },
    ],
  },
];

export default function MedicationScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const [selected, setSelected] = useState<MedicationBrand | null>(null);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const handleContinue = () => {
    if (!selected) return;
    updateDraft({
      medicationBrand: selected,
      glp1Type: BRAND_TO_GLP1_TYPE[selected],
      routeOfAdministration: BRAND_TO_ROUTE[selected],
      injectionFrequencyDays: BRAND_DEFAULT_FREQ_DAYS[selected],
    });
    router.push('/onboarding/dose');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={3} total={16} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>Which GLP-1 medication are you taking?</Text>
          <Text style={s.subtitle}>Select the one that matches your prescription.</Text>

          {BRAND_GROUPS.map((group) => (
            <View key={group.heading} style={s.group}>
              <Text style={s.groupHeading}>{group.heading}</Text>
              {group.subheading ? (
                <Text style={s.groupSub}>{group.subheading}</Text>
              ) : null}
              {group.brands.map((b) => (
                <OptionPill
                  key={b.value}
                  label={b.label}
                  subtitle={b.note}
                  selected={selected === b.value}
                  onPress={() => setSelected(b.value)}
                />
              ))}
            </View>
          ))}
        </ScrollView>

        <ContinueButton onPress={handleContinue} disabled={!selected} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe:         { flex: 1, backgroundColor: c.bg },
  container:    { flex: 1, paddingHorizontal: 24 },
  content:      { paddingBottom: 16 },
  title:        { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'System' },
  subtitle:     { fontSize: 17, color: c.textSecondary, marginBottom: 24, lineHeight: 22, fontFamily: 'System' },
  group:        { marginBottom: 24 },
  groupHeading: { fontSize: 15, fontWeight: '700', color: '#FF742A', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4, fontFamily: 'System' },
  groupSub:     { fontSize: 14, color: c.textMuted, marginBottom: 10, fontFamily: 'System' },
});
