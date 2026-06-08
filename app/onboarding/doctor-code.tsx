import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

export default function DoctorCodeScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const [code, setCode] = useState(draft.doctorCode ?? '');
  const [verifying, setVerifying] = useState(false);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const trimmed = code.trim();

  const goNext = () => router.push('/onboarding/referral-code');

  const handleContinue = async () => {
    // No code entered — it's optional, so just move on.
    if (!trimmed) {
      updateDraft({ doctorCode: null, providerName: null });
      goNext();
      return;
    }
    if (verifying) return;

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-doctor-code', {
        body: { code: trimmed },
      });
      if (error || !data?.success) {
        Alert.alert('Invalid Code', 'We couldn’t find that code. Check it with your provider, or skip this step.');
        return;
      }
      updateDraft({ doctorCode: trimmed, providerName: data.providerName ?? null });
      goNext();
    } catch {
      Alert.alert('Connection Error', 'Could not verify your code right now. Please try again or skip.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={6} total={17} onBack={() => router.back()} />
        <View style={s.content}>
          <Text style={s.title}>Have a provider code?</Text>
          <Text style={s.subtitle}>
            If your doctor or clinic gave you a code, enter it to connect your account. This is optional, so you can skip it.
          </Text>

          <TextInput
            style={s.input}
            value={code}
            onChangeText={(t) => setCode(t.slice(0, 24))}
            placeholder="Enter code"
            placeholderTextColor={colors.textMuted}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!verifying}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            maxLength={24}
          />
        </View>

        <ContinueButton
          onPress={handleContinue}
          disabled={verifying}
          label={verifying ? 'Verifying…' : trimmed ? 'Continue' : 'Skip for now'}
        />
        {verifying && <ActivityIndicator style={s.spinner} color={colors.textMuted} />}
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
