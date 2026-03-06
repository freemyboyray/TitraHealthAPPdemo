import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { WheelPicker } from '@/components/onboarding/wheel-picker';
import { useProfile } from '@/contexts/profile-context';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1939 }, (_, i) =>
  String(CURRENT_YEAR - i),
).filter((y) => parseInt(y) <= CURRENT_YEAR - 16);

export default function BirthdayScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const [monthIdx, setMonthIdx] = useState(0);
  const [dayIdx, setDayIdx] = useState(0);
  const [yearIdx, setYearIdx] = useState(20);

  const handleContinue = () => {
    const month = String(monthIdx + 1).padStart(2, '0');
    const day = String(dayIdx + 1).padStart(2, '0');
    const year = YEARS[yearIdx];
    updateDraft({ birthday: `${year}-${month}-${day}` });
    router.push('/onboarding/body');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={6} total={14} onBack={() => router.back()} />

        <Text style={s.title}>When's your birthday?</Text>
        <Text style={s.subtitle}>Your age helps us fine-tune your nutrition goals.</Text>

        <View style={s.pickersRow}>
          <View style={s.pickerWrap}>
            <Text style={s.colLabel}>Month</Text>
            <WheelPicker data={MONTHS} selectedIndex={monthIdx} onSelect={setMonthIdx} />
          </View>
          <View style={[s.pickerWrap, s.pickerSm]}>
            <Text style={s.colLabel}>Day</Text>
            <WheelPicker data={DAYS} selectedIndex={dayIdx} onSelect={setDayIdx} />
          </View>
          <View style={[s.pickerWrap, s.pickerSm]}>
            <Text style={s.colLabel}>Year</Text>
            <WheelPicker data={YEARS} selectedIndex={yearIdx} onSelect={setYearIdx} />
          </View>
        </View>

        <ContinueButton onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, lineHeight: 34, fontFamily: 'Helvetica Neue' },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 32, lineHeight: 22, fontFamily: 'Helvetica Neue' },
  pickersRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pickerWrap: { flex: 2 },
  pickerSm: { flex: 1 },
  colLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Helvetica Neue',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
