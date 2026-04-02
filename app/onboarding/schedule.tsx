import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { useProfile } from '@/contexts/profile-context';
import { toDateString } from '@/constants/user-profile';
import { DRUG_IS_ORAL, DRUG_DEFAULT_FREQ_DAYS } from '@/constants/drug-pk';
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
  const isOral    = glp1Type ? DRUG_IS_ORAL[glp1Type]            : false;
  const isDaily   = glp1Type ? DRUG_DEFAULT_FREQ_DAYS[glp1Type] === 1 : false;
  const lockedFreq = isDaily ? 1 : null;

  const glp1Status = draft.glp1Status ?? 'active';
  const isActive   = glp1Status === 'active';

  const [freq, setFreq] = useState<number | 'custom' | null>(lockedFreq);
  const [customFreq, setCustomFreq] = useState('');
  const [lastInjDate, setLastInjDate] = useState(new Date());
  const [doseStartDate, setDoseStartDate] = useState(new Date());
  // dose_time: default to 8:00 AM for daily drugs
  const [doseTime, setDoseTime] = useState(() => {
    const d = new Date(); d.setHours(8, 0, 0, 0); return d;
  });

  useEffect(() => {
    if (lockedFreq !== null) setFreq(lockedFreq);
  }, [lockedFreq]);

  const freqDays =
    freq === 'custom' ? (customFreq !== '' ? parseInt(customFreq, 10) : null) : freq;

  const isValid = freqDays !== null;

  const handleContinue = () => {
    if (!isValid) return;
    const formattedDoseTime = isDaily
      ? `${String(doseTime.getHours()).padStart(2, '0')}:${String(doseTime.getMinutes()).padStart(2, '0')}`
      : '';
    updateDraft({
      injectionFrequencyDays: freqDays as number,
      lastInjectionDate: toDateString(lastInjDate),
      doseStartDate: toDateString(isActive ? doseStartDate : lastInjDate),
      doseTime: formattedDoseTime,
    });
    router.push('/onboarding/sex');
  };

  const doseNoun  = isOral ? 'pill' : isDaily ? 'injection' : 'shot';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={5} total={13} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

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
                    placeholderTextColor={colors.textMuted}
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
          <View style={s.datePickerWrap}>
            <DateTimePicker
              value={lastInjDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              maximumDate={new Date()}
              onChange={(_, date) => { if (date) setLastInjDate(date); }}
              style={s.datePicker}
            />
          </View>

          {isDaily && (
            <>
              <Text style={s.sectionLabel}>What time do you take your {doseNoun}?</Text>
              <Text style={[s.subtitle, { marginBottom: 12, marginTop: -4 }]}>
                We'll send you a daily reminder at this time.
              </Text>
              <View style={s.datePickerWrap}>
                <DateTimePicker
                  value={doseTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'compact' : 'default'}
                  onChange={(_, date) => { if (date) setDoseTime(date); }}
                  style={s.datePicker}
                />
              </View>
            </>
          )}

          {isActive && (
            <>
              <Text style={s.sectionLabel}>When did you start your current dose?</Text>
              <Text style={[s.subtitle, { marginBottom: 12, marginTop: -4 }]}>
                The date you first took this specific dose amount.
              </Text>
              <View style={s.datePickerWrap}>
                <DateTimePicker
                  value={doseStartDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'compact' : 'default'}
                  maximumDate={new Date()}
                  onChange={(_, date) => { if (date) setDoseStartDate(date); }}
                  style={s.datePicker}
                />
              </View>
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
  title:        { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'Helvetica Neue' },
  subtitle:     { fontSize: 15, color: c.textSecondary, marginBottom: 32, lineHeight: 22, fontFamily: 'Helvetica Neue' },
  options:      {},
  input:        {
    height: 52, borderWidth: 1.5, borderColor: c.border, borderRadius: 14,
    paddingHorizontal: 16, fontSize: 16, fontFamily: 'Helvetica Neue', color: c.textPrimary,
    marginTop: 4, marginBottom: 10, backgroundColor: c.bg,
  },
  sectionLabel: { fontSize: 16, fontWeight: '600', fontFamily: 'Helvetica Neue', color: c.textPrimary, marginTop: 24, marginBottom: 12 },
  datePickerWrap: { marginBottom: 8 },
  datePicker:   { alignSelf: 'flex-start' },
  tipCard:      {
    backgroundColor: 'rgba(255,116,42,0.10)', borderWidth: 1, borderColor: 'rgba(255,116,42,0.30)',
    borderRadius: 16, padding: 16, marginBottom: 8,
  },
  tipTitle:     { fontSize: 14, fontWeight: '700', color: '#FF742A', marginBottom: 8, fontFamily: 'Helvetica Neue' },
  tipBody:      { fontSize: 13, color: c.textSecondary, lineHeight: 20, fontFamily: 'Helvetica Neue' },
  tipBold:      { color: c.textPrimary, fontWeight: '700' },
});
