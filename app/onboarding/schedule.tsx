import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { useProfile } from '@/contexts/profile-context';
import { toDateString } from '@/constants/user-profile';

const FREQUENCIES: { label: string; days: number | 'custom' }[] = [
  { label: 'Every day', days: 1 },
  { label: 'Every 7 days (most common)', days: 7 },
  { label: 'Every 14 days', days: 14 },
  { label: 'Custom', days: 'custom' },
];

export default function ScheduleScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const [freq, setFreq] = useState<number | 'custom' | null>(null);
  const [customFreq, setCustomFreq] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');

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

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={4} total={14} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>How often do you take your shots?</Text>
          <Text style={s.subtitle}>Select the frequency that matches your prescription.</Text>

          <View style={s.options}>
            {FREQUENCIES.map((f) => (
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

          <Text style={s.sectionLabel}>When was your last shot?</Text>
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
  safe: { flex: 1, backgroundColor: '#141210' },
  container: { flex: 1, paddingHorizontal: 24 },
  content: { paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, lineHeight: 34 },
  subtitle: { fontSize: 15, color: '#9A9490', marginBottom: 32, lineHeight: 22 },
  options: {},
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 4,
    marginBottom: 10,
    backgroundColor: '#252219',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateInput: {
    height: 52,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: '#252219',
  },
  dateInputSm: { flex: 1 },
  dateInputLg: { flex: 1.8 },
});
