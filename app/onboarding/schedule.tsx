import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { useProfile } from '@/contexts/profile-context';
import { DRUG_IS_ORAL } from '@/constants/drug-pk';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const INJECTABLE_FREQUENCIES: { label: string; days: number | 'custom' }[] = [
  { label: 'Every day',                   days: 1  },
  { label: 'Every 7 days (most common)',  days: 7  },
  { label: 'Every 14 days',              days: 14 },
  { label: 'Custom',                      days: 'custom' },
];

export default function ScheduleScreen() {
  const router = useRouter();
  const { updateDraft, draft } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const glp1Type  = draft.glp1Type;
  const isOral    = glp1Type ? DRUG_IS_ORAL[glp1Type] : false;

  // We always ask for the frequency outright — nothing is pre-selected, even
  // for drugs with a fixed on-label cadence. The user confirms it every time.
  const [freq, setFreq] = useState<number | 'custom' | null>(null);
  const [customFreq, setCustomFreq] = useState('');
  // dose_time: default to 8:00 AM, surfaced once a daily cadence is chosen
  const [doseTime, setDoseTime] = useState(() => {
    const d = new Date(); d.setHours(8, 0, 0, 0); return d;
  });
  // "I'm not sure" → midday (12:00 PM) reminder for a rough-time taker.
  const [unsureTime, setUnsureTime] = useState(false);
  const pickMidday = () => {
    const noon = new Date(doseTime); noon.setHours(12, 0, 0, 0);
    setDoseTime(noon); setUnsureTime(true);
  };

  const freqDays =
    freq === 'custom' ? (customFreq !== '' ? parseInt(customFreq, 10) : null) : freq;

  const isValid = freqDays !== null;
  const isDailySelected = freqDays === 1;

  const handleContinue = () => {
    if (!isValid) return;
    // Capture a reminder time only when they're on a daily cadence.
    const formattedDoseTime = isDailySelected
      ? `${String(doseTime.getHours()).padStart(2, '0')}:${String(doseTime.getMinutes()).padStart(2, '0')}`
      : '';
    updateDraft({
      injectionFrequencyDays: freqDays as number,
      doseTime: formattedDoseTime,
    });
    router.push('/onboarding/last-shot');
  };

  const doseNoun  = isOral ? 'pill' : 'shot';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={5} total={15} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          <Text style={s.title}>How often do you take your {doseNoun}?</Text>
          <Text style={s.subtitle}>Select the frequency that matches your prescription.</Text>
          <View style={s.options}>
            {INJECTABLE_FREQUENCIES.map((f) => (
              <OptionPill
                key={String(f.days)}
                label={f.label}
                selected={freq === f.days}
                onPress={() => setFreq(f.days)}
                solidSelect
              />
            ))}
            {freq === 'custom' && (
              <TextInput
                style={s.input}
                placeholder="Frequency in days (e.g. 10)"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={customFreq}
                onChangeText={setCustomFreq}
                autoFocus
              />
            )}
          </View>

          {isDailySelected && (
            <>
              <Text style={s.sectionLabel}>What time do you take your {doseNoun}?</Text>
              <Text style={[s.subtitle, { marginBottom: 12, marginTop: -4 }]}>
                We'll send you a daily reminder at this time.
              </Text>
              {unsureTime ? (
                <TouchableOpacity
                  style={s.middayRow}
                  activeOpacity={0.7}
                  onPress={() => setUnsureTime(false)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.middayTitle}>Midday reminder · 12:00 PM</Text>
                    <Text style={s.midToggleLink}>Set a specific time instead</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <>
                  <View style={s.datePickerWrap}>
                    <DateTimePicker
                      value={doseTime}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_, date) => { if (date) setDoseTime(date); }}
                      style={s.datePicker}
                      textColor={colors.textPrimary}
                      themeVariant={colors.isDark ? 'dark' : 'light'}
                    />
                  </View>
                  <TouchableOpacity onPress={pickMidday} activeOpacity={0.7} style={{ paddingVertical: 8 }}>
                    <Text style={s.midToggleLink}>I'm not sure, just remind me midday</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </ScrollView>

        <ContinueButton onPress={handleContinue} disabled={!isValid} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe:         { flex: 1, backgroundColor: c.bg },
  container:    { flex: 1, paddingHorizontal: 24 },
  content:      { paddingBottom: 16 },
  title:        { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'System' },
  subtitle:     { fontSize: 17, color: c.textSecondary, marginBottom: 32, lineHeight: 22, fontFamily: 'System' },
  options:      {},
  input:        {
    height: 52, borderWidth: 1.5, borderColor: c.border, borderRadius: 14,
    paddingHorizontal: 16, fontSize: 18, fontFamily: 'System', color: c.textPrimary,
    marginTop: 4, marginBottom: 10, backgroundColor: c.bg,
  },
  sectionLabel: { fontSize: 18, fontWeight: '600', fontFamily: 'System', color: c.textPrimary, marginTop: 24, marginBottom: 12 },
  datePickerWrap: { marginBottom: 8, alignItems: 'center' },
  datePicker:   { width: '100%', height: 180 },
  midToggleLink: { fontSize: 14, fontWeight: '600', color: c.orange, fontFamily: 'System' },
  middayRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: c.orange, backgroundColor: 'rgba(255,116,42,0.06)',
  },
  middayTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary, fontFamily: 'System', marginBottom: 2 },
  tipCard:      {
    backgroundColor: 'rgba(255,116,42,0.10)', borderWidth: 1, borderColor: 'rgba(255,116,42,0.30)',
    borderRadius: 16, padding: 16, marginBottom: 8,
  },
  tipTitle:     { fontSize: 16, fontWeight: '700', color: '#FF742A', marginBottom: 8, fontFamily: 'System' },
  tipBody:      { fontSize: 15, color: c.textSecondary, lineHeight: 20, fontFamily: 'System' },
  tipBold:      { color: c.textPrimary, fontWeight: '700' },
});
