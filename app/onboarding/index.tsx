import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { useProfile } from '@/contexts/profile-context';
import { Glp1Status } from '@/constants/user-profile';

export default function JourneyScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const [selected, setSelected] = useState<Glp1Status | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    updateDraft({ glp1Status: selected });
    router.push('/onboarding/medication');
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
              label="I'm already on a GLP-1"
              subtitle="Currently injecting, tracking progress"
              selected={selected === 'active'}
              onPress={() => setSelected('active')}
            />
            <OptionPill
              label="I'm about to start a GLP-1"
              subtitle="Preparing for my first injection"
              selected={selected === 'starting'}
              onPress={() => setSelected('starting')}
            />
          </View>
        </ScrollView>

        <ContinueButton onPress={handleContinue} disabled={!selected} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingHorizontal: 24 },
  content: { paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A1A', marginBottom: 8, lineHeight: 34 },
  subtitle: { fontSize: 15, color: '#666666', marginBottom: 32, lineHeight: 22 },
  options: {},
});
