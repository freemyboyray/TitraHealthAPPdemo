import * as Haptics from 'expo-haptics';
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

const OPTION_DATA: { value: ActivityLevel; label: string; emoji: string; subtitle: string }[] = [
  { value: 'sedentary',   label: 'Sedentary',      emoji: '🛋️', subtitle: 'Mostly seated, little exercise' },
  { value: 'light',       label: 'Lightly Active', emoji: '🚶', subtitle: 'Some walking or light movement' },
  { value: 'active',      label: 'Active',         emoji: '🏃', subtitle: 'Regular workouts or physical tasks' },
  { value: 'very_active', label: 'Very Active',    emoji: '🏋️', subtitle: 'Intense exercise or very physical job' },
];

export default function ActivityScreen() {
  const router = useRouter();
  const { draft, updateDraft, completeOnboarding } = useProfile();
  const isStarting = draft.glp1Status !== 'active';
  const total = isStarting ? 10 : 15;
  const step = isStarting ? 10 : 15;
  const [selected, setSelected] = useState<ActivityLevel | null>(null);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  // Navigation is synchronous (draft write + push), so there's no async save to
  // track. A leftover `saving` flag was getting stuck `true` on back-navigation.
  const handleContinue = () => {
    if (!selected) return;
    updateDraft({ activityLevel: selected });
    router.push('/onboarding/progress-photo');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={step} total={total} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>Tell us a bit about your daily routine.</Text>
          <Text style={s.subtitle}>On most days you are...</Text>

          <View style={s.options}>
            {OPTION_DATA.map((o) => (
              <OptionPill
                key={o.value}
                label={o.label}
                icon={<Text style={s.emoji}>{o.emoji}</Text>}
                subtitle={o.subtitle}
                selected={selected === o.value}
                solidSelect
                onPress={() => {
                  if (selected !== o.value) Haptics.selectionAsync();
                  setSelected(o.value);
                }}
              />
            ))}
          </View>
        </ScrollView>

        <ContinueButton
          onPress={handleContinue}
          disabled={!selected}
          label="Done"
        />
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
  emoji: { fontSize: 20 },
});
