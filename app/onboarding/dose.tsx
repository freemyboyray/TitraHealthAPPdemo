import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const DOSES = [0.25, 0.5, 1.0, 2.5, 5.0, 7.5, 10.0];

export default function DoseScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const [selected, setSelected] = useState<number | 'custom' | null>(null);
  const [customVal, setCustomVal] = useState('');
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const isValid =
    selected !== null &&
    (selected !== 'custom' || (customVal !== '' && !isNaN(parseFloat(customVal))));

  const handleContinue = () => {
    if (!isValid) return;
    const doseMg = selected === 'custom' ? parseFloat(customVal) : (selected as number);
    updateDraft({ doseMg });
    router.push('/onboarding/schedule');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={4} total={16} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>What's your current dose?</Text>
          <Text style={s.subtitle}>Select the dosage you're currently on.</Text>

          <View style={s.options}>
            {DOSES.map((d) => (
              <OptionPill
                key={String(d)}
                label={`${d} mg`}
                selected={selected === d}
                onPress={() => setSelected(d)}
              />
            ))}
            <OptionPill
              label="Custom / Other"
              selected={selected === 'custom'}
              onPress={() => setSelected('custom')}
            />
            {selected === 'custom' && (
              <TextInput
                style={s.input}
                placeholder="Enter dose in mg (e.g. 3.5)"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={customVal}
                onChangeText={setCustomVal}
                autoFocus
              />
            )}
          </View>
        </ScrollView>

        <ContinueButton onPress={handleContinue} disabled={!isValid} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24 },
  content: { paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'System' },
  subtitle: { fontSize: 17, color: c.textSecondary, marginBottom: 32, lineHeight: 22, fontFamily: 'System' },
  options: {},
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: 'System',
    color: c.textPrimary,
    marginTop: 4,
    backgroundColor: c.bg,
  },
});
