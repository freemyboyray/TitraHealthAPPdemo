import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { BRAND_TO_GLP1_TYPE, MedicationBrand } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';

const BRANDS: { value: MedicationBrand; label: string }[] = [
  { value: 'zepbound', label: 'Zepbound®' },
  { value: 'mounjaro', label: 'Mounjaro®' },
  { value: 'ozempic', label: 'Ozempic®' },
  { value: 'wegovy', label: 'Wegovy®' },
  { value: 'trulicity', label: 'Trulicity®' },
  { value: 'compounded_semaglutide', label: 'Compounded Semaglutide' },
  { value: 'compounded_tirzepatide', label: 'Compounded Tirzepatide' },
  { value: 'other', label: 'Other / Not listed' },
];

export default function MedicationScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const [selected, setSelected] = useState<MedicationBrand | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    updateDraft({ medicationBrand: selected, glp1Type: BRAND_TO_GLP1_TYPE[selected] });
    router.push('/onboarding/dose');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={2} total={14} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>Which GLP-1 medication are you taking?</Text>
          <Text style={s.subtitle}>If it's not listed, choose "Other".</Text>

          <View style={s.options}>
            {BRANDS.map((b) => (
              <OptionPill
                key={b.value}
                label={b.label}
                selected={selected === b.value}
                onPress={() => setSelected(b.value)}
              />
            ))}
          </View>
        </ScrollView>

        <ContinueButton onPress={handleContinue} disabled={!selected} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  container: { flex: 1, paddingHorizontal: 24 },
  content: { paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, lineHeight: 34, fontFamily: 'Helvetica Neue' },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 32, lineHeight: 22, fontFamily: 'Helvetica Neue' },
  options: {},
});
