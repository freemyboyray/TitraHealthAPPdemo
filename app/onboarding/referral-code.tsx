import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

export default function ReferralCodeScreen() {
  const router = useRouter();
  const { draft } = useProfile();
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const trimmed = code.trim();

  const goNext = () =>
    router.push(draft.treatmentStatus === 'on' ? '/onboarding/medication' : '/onboarding/sex');

  const handleContinue = async () => {
    // Optional step — no code means just move on.
    if (!trimmed) {
      goNext();
      return;
    }
    if (applying) return;

    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke('redeem-referral', {
        body: { code: trimmed },
      });
      if (error || !data?.success) {
        // Surface the server's reason when we have one (eligibility / unknown code).
        const message =
          (data as { error?: string } | null)?.error ??
          "We couldn't apply that code. Check it with your friend, or skip this step.";
        Alert.alert('Referral code', message);
        return;
      }
      Alert.alert(
        'Code applied',
        "You're all set — you and your friend will each get a free month of Titra Pro once you subscribe.",
        [{ text: 'Continue', onPress: goNext }],
      );
    } catch {
      Alert.alert('Connection Error', 'Could not apply your code right now. Please try again or skip.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={6} total={17} onBack={() => router.back()} />
        <View style={s.content}>
          <Text style={s.title}>Have a referral code?</Text>
          <Text style={s.subtitle}>
            If a friend invited you, enter their code. You’ll both get a free month of Titra Pro when you
            subscribe. This is optional — you can skip it.
          </Text>

          <TextInput
            style={s.input}
            value={code}
            onChangeText={(t) => setCode(t.slice(0, 20))}
            placeholder="TITRA-XXXXXX"
            placeholderTextColor={colors.textMuted}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!applying}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            maxLength={20}
          />
        </View>

        <ContinueButton
          onPress={handleContinue}
          disabled={applying}
          label={applying ? 'Applying…' : trimmed ? 'Continue' : 'Skip for now'}
        />
        {applying && <ActivityIndicator style={s.spinner} color={colors.textMuted} />}
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
    letterSpacing: 2,
    borderBottomWidth: 2,
    borderBottomColor: c.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  spinner: { position: 'absolute', bottom: 110, alignSelf: 'center' },
});
