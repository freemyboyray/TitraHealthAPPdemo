import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { WheelPicker } from '@/components/onboarding/wheel-picker';
import { UnitSystem } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const LBS_WHOLE = Array.from({ length: 321 }, (_, i) => `${i + 80} lbs`);
const LBS_HALF = ['.0', '.5'];
const KG = Array.from({ length: 161 }, (_, i) => `${i + 40} kg`);

export default function WeightScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const isStarting = draft.glp1Status !== 'active';
  const total = isStarting ? 10 : 16;
  const step = isStarting ? 6 : 11;
  const [unit, setUnit] = useState<UnitSystem>(draft.unitSystem ?? 'imperial');
  const [lbsIdx, setLbsIdx] = useState(100);
  const [halfIdx, setHalfIdx] = useState(0);
  const [kgIdx, setKgIdx] = useState(42);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const handleContinue = () => {
    if (unit === 'imperial') {
      const lbs = lbsIdx + 80 + (halfIdx === 1 ? 0.5 : 0);
      updateDraft({
        unitSystem: 'imperial',
        weightLbs: lbs,
        weightKg: Math.round(lbs * 0.453592 * 10) / 10,
        currentWeightLbs: lbs,
        currentWeightKg: Math.round(lbs * 0.453592 * 10) / 10,
      });
    } else {
      const kg = kgIdx + 40;
      updateDraft({
        unitSystem: 'metric',
        weightKg: kg,
        weightLbs: Math.round(kg * 2.20462 * 10) / 10,
        currentWeightLbs: Math.round(kg * 2.20462 * 10) / 10,
        currentWeightKg: kg,
      });
    }
    router.push('/onboarding/health-sync');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={step} total={total} onBack={() => router.back()} />

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>What's your current weight?</Text>
          <Text style={s.subtitle}>
            What you weigh right now — helps us personalize your nutrition and activity goals.
          </Text>

          <View style={s.toggle}>
            <TouchableOpacity
              style={[s.toggleBtn, unit === 'imperial' && s.toggleBtnActive]}
              onPress={() => setUnit('imperial')}>
              <Text style={[s.toggleText, unit === 'imperial' && s.toggleTextActive]}>
                Imperial
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleBtn, unit === 'metric' && s.toggleBtnActive]}
              onPress={() => setUnit('metric')}>
              <Text style={[s.toggleText, unit === 'metric' && s.toggleTextActive]}>
                Metric
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.pickersRow}>
            {unit === 'imperial' ? (
              <>
                <View style={s.pickerWrap}>
                  <WheelPicker data={LBS_WHOLE} selectedIndex={lbsIdx} onSelect={setLbsIdx} />
                </View>
                <View style={[s.pickerWrap, { flex: 0.5 }]}>
                  <WheelPicker data={LBS_HALF} selectedIndex={halfIdx} onSelect={setHalfIdx} />
                </View>
              </>
            ) : (
              <View style={s.pickerWrap}>
                <WheelPicker data={KG} selectedIndex={kgIdx} onSelect={setKgIdx} />
              </View>
            )}
          </View>
        </ScrollView>

        <ContinueButton onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'Inter_800ExtraBold' },
  subtitle: { fontSize: 15, color: c.textSecondary, marginBottom: 20, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  toggle: {
    flexDirection: 'row',
    backgroundColor: c.glassOverlay,
    borderRadius: 12,
    padding: 3,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: '#FF742A' },
  toggleText: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_400Regular', color: c.textSecondary },
  toggleTextActive: { color: '#FFFFFF', fontFamily: 'Inter_400Regular' },
  scrollContent: { paddingBottom: 16 },
  pickersRow: { flexDirection: 'row', gap: 8 },
  pickerWrap: { flex: 1 },
});
