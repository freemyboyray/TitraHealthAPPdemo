import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { Sex } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';

const OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: '♂  Male' },
  { value: 'female', label: '♀  Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export default function SexScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const [selected, setSelected] = useState<Sex | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    updateDraft({ sex: selected });
    router.push('/onboarding/birthday');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={5} total={14} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>Help us get the basics right.</Text>
          <Text style={s.subtitle}>
            We use a few simple details to better tailor your nutrition, activity, and wellness plan.
          </Text>

          <View style={s.options}>
            {OPTIONS.map((o) => (
              <OptionPill
                key={o.value}
                label={o.label}
                selected={selected === o.value}
                onPress={() => setSelected(o.value)}
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
  safe: { flex: 1, backgroundColor: '#141210' },
  container: { flex: 1, paddingHorizontal: 24 },
  content: { paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, lineHeight: 34 },
  subtitle: { fontSize: 15, color: '#9A9490', marginBottom: 32, lineHeight: 22 },
  options: {},
});
