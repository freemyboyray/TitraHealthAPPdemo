import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

export default function StartScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const unit = draft.unitSystem ?? 'imperial';
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [weightInput, setWeightInput] = useState('');
  const [editingWeight, setEditingWeight] = useState(false);

  const weightLabel = unit === 'imperial' ? 'lbs' : 'kg';
  const isValid = weightInput !== '' && !isNaN(parseFloat(weightInput));

  const handleContinue = () => {
    if (!isValid) return;
    const lbs =
      unit === 'imperial'
        ? parseFloat(weightInput)
        : Math.round(parseFloat(weightInput) * 2.20462 * 10) / 10;
    // Use the dose start date (from previous step) as the tracking start date.
    const startDate = draft.doseStartDate ?? new Date().toISOString().slice(0, 10);
    updateDraft({ startWeightLbs: lbs, startDate });
    router.push('/onboarding/goal-weight');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={13} total={16} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>What weight were you at when you started your current dose?</Text>
          <Text style={s.subtitle}>
            We'll use this to track your progress on this dose.
          </Text>

          <TouchableOpacity style={s.row} onPress={() => setEditingWeight(true)}>
            <Text style={s.rowLabel}>Start Weight</Text>
            {editingWeight ? (
              <View style={s.inlineInput}>
                <TextInput
                  style={s.inputText}
                  keyboardType="decimal-pad"
                  placeholder={`Weight in ${weightLabel}`}
                  placeholderTextColor={colors.textMuted}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  autoFocus
                  onBlur={() => setEditingWeight(false)}
                />
                <Text style={s.unitHint}>{weightLabel}</Text>
              </View>
            ) : (
              <View style={s.rowRight}>
                <Text style={s.rowValue}>
                  {weightInput ? `${weightInput} ${weightLabel}` : `Tap to enter`}
                </Text>
                <Ionicons name="pencil" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>

        <ContinueButton onPress={handleContinue} disabled={!isValid} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24 },
  content: { paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'Inter_800ExtraBold' },
  subtitle: { fontSize: 15, color: c.textSecondary, marginBottom: 32, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSubtle,
    minHeight: 64,
    gap: 12,
  },
  rowLabel: { fontSize: 16, fontWeight: '600', color: c.textPrimary, fontFamily: 'Inter_400Regular' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 16, color: c.textSecondary, fontFamily: 'Inter_400Regular' },
  inlineInput: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputText: { fontSize: 18, color: c.textPrimary, minWidth: 80, textAlign: 'right', fontFamily: 'Inter_400Regular' },
  unitHint: { fontSize: 14, color: c.textSecondary, fontFamily: 'Inter_400Regular' },
});
