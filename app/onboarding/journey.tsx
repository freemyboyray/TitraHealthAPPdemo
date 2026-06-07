import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { JourneyOptionCard } from '@/components/onboarding/journey-option-card';
import { useProfile } from '@/contexts/profile-context';
import type { TreatmentStatus } from '@/constants/user-profile';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

// LayoutAnimation needs to be enabled explicitly on Android for the card
// grow/shrink reflow to animate (iOS supports it out of the box).
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type JourneyOption = 'active' | 'starting' | 'off';

const OPTIONS: { id: JourneyOption; label: string; subtitle: string; emoji: string }[] = [
  {
    id: 'active',
    label: "I'm currently on a GLP-1",
    subtitle: 'Currently taking medication, tracking progress',
    emoji: '💉',
  },
  {
    id: 'starting',
    label: "I'm about to start a GLP-1",
    subtitle: 'Preparing for my first dose',
    emoji: '🚀',
  },
  {
    id: 'off',
    label: "I'm not on a GLP-1 right now",
    subtitle: 'Lifestyle tracking only: weight, food, activity',
    emoji: '🏃',
  },
];

export default function JourneyScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const [selected, setSelected] = useState<JourneyOption | null>(null);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const selectOption = (id: JourneyOption) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelected(id);
  };

  const handleContinue = () => {
    if (!selected) return;
    const treatmentStatus: TreatmentStatus = selected === 'active' ? 'on' : 'off';
    const glp1Status = selected === 'starting' ? 'starting' : 'active';
    updateDraft({ glp1Status, treatmentStatus });
    router.push('/onboarding/terms' as any);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={1} total={15} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>Where are you in your GLP-1 journey?</Text>
          <Text style={s.subtitle}>This helps us tailor your experience from day one.</Text>

          <View style={s.options}>
            {OPTIONS.map((o) => (
              <JourneyOptionCard
                key={o.id}
                emoji={o.emoji}
                label={o.label}
                subtitle={o.subtitle}
                selected={selected === o.id}
                onPress={() => selectOption(o.id)}
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
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'System' },
  subtitle: { fontSize: 17, color: c.textSecondary, marginBottom: 32, lineHeight: 22, fontFamily: 'System' },
  options: {},
});
