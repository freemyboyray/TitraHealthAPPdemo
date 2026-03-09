import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { useProfile } from '@/contexts/profile-context';
import { toDateString, BRAND_DEFAULT_FREQ_DAYS } from '@/constants/user-profile';
import { DRUG_IS_ORAL, DRUG_DEFAULT_FREQ_DAYS } from '@/constants/drug-pk';

const INJECTABLE_FREQUENCIES: { label: string; days: number | 'custom' }[] = [
  { label: 'Every day',                   days: 1  },
  { label: 'Every 7 days (most common)',  days: 7  },
  { label: 'Every 14 days',              days: 14 },
  { label: 'Custom',                      days: 'custom' },
];

export default function ScheduleScreen() {
  const router = useRouter();
  const { updateDraft, draft } = useProfile();

  const glp1Type  = draft.glp1Type;
  const isOral    = glp1Type ? DRUG_IS_ORAL[glp1Type]            : false;
  const isDaily   = glp1Type ? DRUG_DEFAULT_FREQ_DAYS[glp1Type] === 1 : false;
  // Daily drugs (injected or oral) lock to freq=1; only show picker for weekly/biweekly injectables
  const lockedFreq = isDaily ? 1 : null;

  const [freq, setFreq] = useState<number | 'custom' | null>(lockedFreq);
  const [customFreq, setCustomFreq] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay]     = useState('');
  const [year, setYear]   = useState('');

  // Keep freq in sync if the user navigates back and changes their drug selection
  useEffect(() => {
    if (lockedFreq !== null) setFreq(lockedFreq);
  }, [lockedFreq]);

  const freqDays =
    freq === 'custom' ? (customFreq !== '' ? parseInt(customFreq, 10) : null) : freq;

  const isValidDate = month !== '' && day !== '' && year.length === 4;
  const isValid = freqDays !== null && isValidDate;

  const handleContinue = () => {
    if (!isValid) return;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    updateDraft({
      injectionFrequencyDays: freqDays as number,
      lastInjectionDate: toDateString(d),
    });
    router.push('/onboarding/sex');
  };

  // Language adapts: oral = "pill / tablet", daily injectable = "injection / dose", weekly = "shot"
  const doseNoun  = isOral ? 'pill' : isDaily ? 'injection' : 'shot';
  const doseNounC = isOral ? 'Pill' : isDaily ? 'Injection' : 'Shot';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={4} total={14} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          {/* Frequency — hidden/locked for daily drugs */}
          {!isDaily ? (
            <>
              <Text style={s.title}>How often do you take your {doseNoun}?</Text>
              <Text style={s.subtitle}>Select the frequency that matches your prescription.</Text>
              <View style={s.options}>
                {INJECTABLE_FREQUENCIES.map((f) => (
                  <OptionPill
                    key={String(f.days)}
                    label={f.label}
                    selected={freq === f.days}
                    onPress={() => setFreq(f.days)}
                  />
                ))}
                {freq === 'custom' && (
                  <TextInput
                    style={s.input}
                    placeholder="Frequency in days (e.g. 10)"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="number-pad"
                    value={customFreq}
                    onChangeText={setCustomFreq}
                    autoFocus
                  />
                )}
              </View>
            </>
          ) : (
            <>
              <Text style={s.title}>
                {isOral ? 'Daily oral medication' : 'Daily injection'}
              </Text>
              <Text style={s.subtitle}>
                {isOral
                  ? 'This medication is taken every day as a pill. Your schedule is automatically set to once daily.'
                  : 'This medication is injected once every day. Your schedule is automatically set to daily.'}
              </Text>
              {isOral && (
                <View style={s.tipCard}>
                  <Text style={s.tipTitle}>Important: Take on an empty stomach</Text>
                  <Text style={s.tipBody}>
                    Oral semaglutide must be taken first thing in the morning with at most{' '}
                    <Text style={s.tipBold}>4 oz (120 mL) of plain water</Text>, then wait{' '}
                    <Text style={s.tipBold}>at least 30 minutes</Text> before eating, drinking,
                    or taking other medications. Food or excess water can reduce absorption by
                    up to 90%.
                  </Text>
                </View>
              )}
            </>
          )}

          <Text style={s.sectionLabel}>
            {isOral ? `When did you last take your ${doseNoun}?`
                    : `When was your last ${doseNoun}?`}
          </Text>
          <View style={s.dateRow}>
            <TextInput
              style={[s.dateInput, s.dateInputSm]}
              placeholder="MM"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="number-pad"
              maxLength={2}
              value={month}
              onChangeText={setMonth}
            />
            <TextInput
              style={[s.dateInput, s.dateInputSm]}
              placeholder="DD"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="number-pad"
              maxLength={2}
              value={day}
              onChangeText={setDay}
            />
            <TextInput
              style={[s.dateInput, s.dateInputLg]}
              placeholder="YYYY"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="number-pad"
              maxLength={4}
              value={year}
              onChangeText={setYear}
            />
          </View>
        </ScrollView>

        <ContinueButton onPress={handleContinue} disabled={!isValid} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#000000' },
  container:    { flex: 1, paddingHorizontal: 24 },
  content:      { paddingBottom: 16 },
  title:        { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, lineHeight: 34, fontFamily: 'Helvetica Neue' },
  subtitle:     { fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 32, lineHeight: 22, fontFamily: 'Helvetica Neue' },
  options:      {},
  input:        {
    height: 52, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14,
    paddingHorizontal: 16, fontSize: 16, fontFamily: 'Helvetica Neue', color: '#FFFFFF',
    marginTop: 4, marginBottom: 10, backgroundColor: '#000000',
  },
  sectionLabel: { fontSize: 16, fontWeight: '600', fontFamily: 'Helvetica Neue', color: '#FFFFFF', marginTop: 24, marginBottom: 12 },
  dateRow:      { flexDirection: 'row', gap: 10 },
  dateInput:    {
    height: 52, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14,
    paddingHorizontal: 16, fontSize: 18, fontFamily: 'Helvetica Neue', color: '#FFFFFF',
    textAlign: 'center', backgroundColor: '#000000',
  },
  dateInputSm:  { flex: 1 },
  dateInputLg:  { flex: 1.8 },
  tipCard:      {
    backgroundColor: 'rgba(255,116,42,0.10)', borderWidth: 1, borderColor: 'rgba(255,116,42,0.30)',
    borderRadius: 16, padding: 16, marginBottom: 8,
  },
  tipTitle:     { fontSize: 14, fontWeight: '700', color: '#FF742A', marginBottom: 8, fontFamily: 'Helvetica Neue' },
  tipBody:      { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20, fontFamily: 'Helvetica Neue' },
  tipBold:      { color: '#FFFFFF', fontWeight: '700' },
});
