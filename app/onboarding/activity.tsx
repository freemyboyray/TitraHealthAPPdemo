import { MaterialIcons } from '@expo/vector-icons';
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

const OPTION_DATA: { value: ActivityLevel; label: string; iconName: string; subtitle: string }[] = [
  { value: 'sedentary',   label: 'Sedentary',      iconName: 'event-seat',      subtitle: 'Mostly seated, little exercise' },
  { value: 'light',       label: 'Lightly Active',  iconName: 'directions-walk', subtitle: 'Some walking or light movement' },
  { value: 'active',      label: 'Active',           iconName: 'directions-run',  subtitle: 'Regular workouts or physical tasks' },
  { value: 'very_active', label: 'Very Active',      iconName: 'flash-on',       subtitle: 'Intense exercise or very physical job' },
];

export default function ActivityScreen() {
  const router = useRouter();
  const { draft, updateDraft, completeOnboarding } = useProfile();
  const isStarting = draft.glp1Status !== 'active';
  const total = isStarting ? 10 : 16;
  const step = isStarting ? 10 : 16;
  const [selected, setSelected] = useState<ActivityLevel | null>(null);
  const [saving, setSaving] = useState(false);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const iconColor = colors.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)';

  const handleContinue = async () => {
    if (!selected || saving) return;
    setSaving(true);
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
                icon={<MaterialIcons name={o.iconName as any} size={20} color={iconColor} />}
                subtitle={o.subtitle}
                selected={selected === o.value}
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
          disabled={!selected || saving}
          label={saving ? 'Saving...' : 'Done'}
        />
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
