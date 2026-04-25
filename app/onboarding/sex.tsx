import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { Sex } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: '♂  Male' },
  { value: 'female', label: '♀  Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export default function SexScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const isStarting = draft.glp1Status !== 'active';
  const total = isStarting ? 10 : 13;
  const step = isStarting ? 4 : 7;
  const [selected, setSelected] = useState<Sex | null>(null);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const handleContinue = () => {
    if (!selected) return;
    updateDraft({ sex: selected });
    router.push('/onboarding/birthday');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={step} total={total} onBack={() => router.back()} />
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

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24 },
  content: { paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'Inter_800ExtraBold' },
  subtitle: { fontSize: 15, color: c.textSecondary, marginBottom: 32, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  options: {},
});
