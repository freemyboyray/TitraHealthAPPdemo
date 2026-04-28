import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { toDateString } from '@/constants/user-profile';
import { DRUG_IS_ORAL, DRUG_DEFAULT_FREQ_DAYS } from '@/constants/drug-pk';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

export default function LastShotScreen() {
  const router = useRouter();
  const { updateDraft, draft } = useProfile();
  const { colors, isDark } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const glp1Type = draft.glp1Type;
  const isOral   = glp1Type ? DRUG_IS_ORAL[glp1Type] : false;
  const isDaily  = glp1Type ? DRUG_DEFAULT_FREQ_DAYS[glp1Type] === 1 : false;
  const doseNoun = isOral ? 'pill' : isDaily ? 'injection' : 'shot';

  const [lastInjDate, setLastInjDate] = useState(new Date());

  const handleContinue = () => {
    updateDraft({ lastInjectionDate: toDateString(lastInjDate) });
    const isActive = (draft.glp1Status ?? 'active') === 'active';
    router.push(isActive ? '/onboarding/dose-start' : '/onboarding/sex');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={6} total={16} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>
            {isOral ? `When did you last take your ${doseNoun}?` : `When was your last ${doseNoun}?`}
          </Text>
          <Text style={s.subtitle}>
            We use this to estimate where you are in the dose cycle.
          </Text>

          <View style={s.datePickerWrap}>
            <DateTimePicker
              value={lastInjDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={new Date()}
              onChange={(_, date) => { if (date) setLastInjDate(date); }}
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
