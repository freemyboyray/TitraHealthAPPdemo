import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

export default function UsernameScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const isStarting = draft.glp1Status !== 'active';
  const total = isStarting ? 10 : 15;
  const step = isStarting ? 2 : 3;
  const [name, setName] = useState(draft.username ?? '');
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const trimmed = name.trim();
  const isValid = trimmed.length >= 2;

  const handleContinue = () => {
    if (!isValid) return;
    updateDraft({ username: trimmed });
    router.push(draft.treatmentStatus === 'on' ? '/onboarding/medication' : '/onboarding/sex');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={step} total={total} onBack={() => router.back()} />
        <View style={s.content}>
          <Text style={s.title}>What should we call you?</Text>
          <Text style={s.subtitle}>
            This is your display name — no real name required.
          </Text>

          <TextInput
            style={s.input}
            value={name}
            onChangeText={(t) => setName(t.slice(0, 15))}
            placeholder="Enter a name"
            placeholderTextColor={colors.textMuted}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            maxLength={15}
          />
          <Text style={s.charCount}>{trimmed.length}/15</Text>
        </View>

        <ContinueButton onPress={handleContinue} disabled={!isValid} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24 },
  content: { flex: 1, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'System' },
  subtitle: { fontSize: 17, color: c.textSecondary, marginBottom: 32, lineHeight: 22, fontFamily: 'System' },
  input: {
    fontSize: 22,
    fontWeight: '600',
    color: c.textPrimary,
    fontFamily: 'System',
    borderBottomWidth: 2,
    borderBottomColor: c.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  charCount: {
    fontSize: 13,
    color: c.textMuted,
    fontFamily: 'System',
    marginTop: 8,
    textAlign: 'right',
  },
});
