import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { useProfile } from '@/contexts/profile-context';
import type { TreatmentStatus } from '@/constants/user-profile';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

type JourneyOption = 'active' | 'starting' | 'off';

export default function JourneyScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const [selected, setSelected] = useState<JourneyOption | null>(null);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const handleContinue = () => {
    if (!selected) return;
    const treatmentStatus: TreatmentStatus = selected === 'active' ? 'on' : 'off';
    const glp1Status = selected === 'starting' ? 'starting' : 'active';
    updateDraft({ glp1Status, treatmentStatus });
    router.push('/onboarding/clinician' as any);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={1} total={14} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>Where are you in your GLP-1 journey?</Text>
          <Text style={s.subtitle}>This helps us tailor your experience from day one.</Text>

          <View style={s.options}>
            <OptionPill
              label="I'm currently on a GLP-1"
              subtitle="Currently taking medication, tracking progress"
              selected={selected === 'active'}
              onPress={() => setSelected('active')}
            />
            <OptionPill
              label="I'm about to start a GLP-1"
              subtitle="Preparing for my first dose"
              selected={selected === 'starting'}
              onPress={() => setSelected('starting')}
            />
            <OptionPill
              label="I'm not on a GLP-1 right now"
              subtitle="Lifestyle tracking only — weight, food, activity"
              selected={selected === 'off'}
              onPress={() => setSelected('off')}
            />
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
