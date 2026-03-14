import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { ActivityLevel } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const OPTIONS: { value: ActivityLevel; label: string; icon: string; subtitle: string }[] = [
  { value: 'sedentary', label: 'Sedentary', icon: '🧍', subtitle: 'Mostly seated, little exercise' },
  { value: 'light', label: 'Lightly Active', icon: '🚶', subtitle: 'Some walking or light movement' },
  { value: 'active', label: 'Active', icon: '🏃', subtitle: 'Regular workouts or physical tasks' },
  { value: 'very_active', label: 'Very Active', icon: '⚡', subtitle: 'Intense exercise or very physical job' },
];

export default function ActivityScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const [selected, setSelected] = useState<ActivityLevel | null>(null);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const handleContinue = () => {
    if (!selected) return;
    updateDraft({ activityLevel: selected });
    router.push('/onboarding/cravings');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={12} total={14} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>Tell us a bit about your daily routine.</Text>
          <Text style={s.subtitle}>On most days you are...</Text>

          <View style={s.options}>
            {OPTIONS.map((o) => (
              <OptionPill
                key={o.value}
                label={`${o.icon}  ${o.label}`}
                subtitle={o.subtitle}
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
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'Helvetica Neue' },
  subtitle: { fontSize: 15, color: c.textSecondary, marginBottom: 32, lineHeight: 22, fontFamily: 'Helvetica Neue' },
  options: {},
});
