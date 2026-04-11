import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const ORANGE = '#FF742A';

const CONSENT_TEXT =
  'I consent to my clinician reviewing the health data I log in TitraHealth.';

type Choice = 'yes' | 'no' | null;

export default function ClinicianScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [choice, setChoice] = useState<Choice>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue =
    choice === 'no' || (choice === 'yes' && code.trim().length > 0 && !verifying);

  const handleContinue = async () => {
    setError(null);

    if (choice === 'no') {
      updateDraft({
        rtmEnabled: false,
        rtmClinicianId: null,
        rtmClinicianName: null,
        rtmConsentText: null,
      });
      router.push('/onboarding/terms');
      return;
    }

    if (choice !== 'yes') return;

    const trimmed = code.trim().toUpperCase();
    setVerifying(true);
    const { data, error: lookupErr } = await supabase
      .from('clinicians')
      .select('id, display_name')
      .eq('code', trimmed)
      .eq('active', true)
      .maybeSingle();
    setVerifying(false);

    if (lookupErr || !data) {
      setError("Code not found. Double-check with your clinician.");
      return;
    }

    updateDraft({
      rtmEnabled: true,
      rtmClinicianId: data.id,
      rtmClinicianName: data.display_name,
      rtmConsentText: CONSENT_TEXT,
    });
    router.push('/onboarding/terms');
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.container}>
          <OnboardingHeader step={2} total={14} onBack={() => router.back()} />
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.title}>Are you using TitraHealth through a clinician?</Text>
            <Text style={s.subtitle}>
              If your doctor referred you, enter their code so they can review the
              progress reports you generate.
            </Text>

            <View style={s.options}>
              <OptionPill
                label="Yes — I have a provider code"
                subtitle="My clinician will see my progress reports"
                selected={choice === 'yes'}
                onPress={() => {
                  setChoice('yes');
                  setError(null);
                }}
              />
              <OptionPill
                label="No — I'm using it on my own"
                subtitle="You can link a clinician later in Settings."
                selected={choice === 'no'}
                onPress={() => {
                  setChoice('no');
                  setError(null);
                }}
              />
            </View>

            {choice === 'yes' && (
              <View style={s.codeBlock}>
                <Text style={s.codeLabel}>PROVIDER CODE</Text>
                <TextInput
                  style={s.codeInput}
                  value={code}
                  onChangeText={(t) => {
                    setCode(t);
                    setError(null);
                  }}
                  placeholder="e.g. TITRA-SMITH-A4F2"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                {error && <Text style={s.error}>{error}</Text>}
                <Text style={s.consent}>{CONSENT_TEXT}</Text>
              </View>
            )}
          </ScrollView>

          <ContinueButton onPress={handleContinue} disabled={!canContinue} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, paddingHorizontal: 24 },
    content: { paddingBottom: 16 },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
      marginBottom: 8,
      lineHeight: 34,
      fontFamily: 'Helvetica Neue',
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      marginBottom: 24,
      lineHeight: 22,
      fontFamily: 'Helvetica Neue',
    },
    options: {},

    codeBlock: { marginTop: 18 },
    codeLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: 'rgba(255,255,255,0.5)',
      marginBottom: 8,
    },
    codeInput: {
      height: 56,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      backgroundColor: '#000000',
      paddingHorizontal: 18,
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'Helvetica Neue',
      letterSpacing: 0.5,
    },
    error: {
      marginTop: 10,
      color: '#FF453A',
      fontSize: 13,
      fontWeight: '600',
    },
    consent: {
      marginTop: 14,
      fontSize: 12,
      lineHeight: 17,
      color: 'rgba(255,255,255,0.5)',
    },
  });
