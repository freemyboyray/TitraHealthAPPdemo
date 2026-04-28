import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { toDateString } from '@/constants/user-profile';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

export default function DoseStartScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const { colors, isDark } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [doseStartDate, setDoseStartDate] = useState(new Date());

  const handleContinue = () => {
    updateDraft({ doseStartDate: toDateString(doseStartDate) });
    router.push('/onboarding/sex');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={7} total={16} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>When did you start your current dose?</Text>
          <Text style={s.subtitle}>
            The date you first took this specific dose amount.
          </Text>

          <View style={s.datePickerWrap}>
            <DateTimePicker
              value={doseStartDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={new Date()}
              onChange={(_, date) => { if (date) setDoseStartDate(date); }}
              style={s.datePicker}
              themeVariant={isDark ? 'dark' : 'light'}
              accentColor="#FF742A"
              textColor={colors.textPrimary}
            />
          </View>
        </ScrollView>

        <ContinueButton onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe:           { flex: 1, backgroundColor: c.bg },
  container:      { flex: 1, paddingHorizontal: 24 },
  content:        { paddingBottom: 16 },
  title:          { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'System' },
  subtitle:       { fontSize: 17, color: c.textSecondary, marginBottom: 24, lineHeight: 22, fontFamily: 'System' },
  datePickerWrap: { marginTop: 8 },
  datePicker:     { alignSelf: 'stretch' },
});
