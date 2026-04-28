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

const FEET = Array.from({ length: 4 }, (_, i) => `${i + 4} ft`);
const INCHES = Array.from({ length: 12 }, (_, i) => `${i} in`);
const CM = Array.from({ length: 101 }, (_, i) => `${i + 120} cm`);

export default function HeightScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const isStarting = draft.glp1Status !== 'active';
  const total = isStarting ? 10 : 16;
  const step = isStarting ? 5 : 10;
  const [unit, setUnit] = useState<UnitSystem>(draft.unitSystem ?? 'imperial');
  const [ftIdx, setFtIdx] = useState(2);
  const [inIdx, setInIdx] = useState(0);
  const [cmIdx, setCmIdx] = useState(45);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const handleContinue = () => {
    if (unit === 'imperial') {
      const ft = ftIdx + 4;
      const inches = inIdx;
      updateDraft({
        unitSystem: 'imperial',
        heightFt: ft,
        heightIn: inches,
        heightCm: Math.round(((ft * 12) + inches) * 2.54),
      });
    } else {
      const cm = cmIdx + 120;
      updateDraft({
        unitSystem: 'metric',
        heightCm: cm,
        heightFt: Math.floor(cm / 30.48),
        heightIn: Math.round((cm / 2.54) % 12),
      });
    }
    router.push('/onboarding/weight');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={step} total={total} onBack={() => router.back()} />

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>How tall are you?</Text>
          <Text style={s.subtitle}>
            Height helps us calibrate your nutrition and activity goals.
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
                  <WheelPicker data={FEET} selectedIndex={ftIdx} onSelect={setFtIdx} />
                </View>
                <View style={s.pickerWrap}>
                  <WheelPicker data={INCHES} selectedIndex={inIdx} onSelect={setInIdx} />
                </View>
              </>
            ) : (
              <View style={s.pickerWrap}>
                <WheelPicker data={CM} selectedIndex={cmIdx} onSelect={setCmIdx} />
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
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'System' },
  subtitle: { fontSize: 17, color: c.textSecondary, marginBottom: 20, lineHeight: 22, fontFamily: 'System' },
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
  toggleText: { fontSize: 16, fontWeight: '600', fontFamily: 'System', color: c.textSecondary },
  toggleTextActive: { color: '#FFFFFF', fontFamily: 'System' },
  scrollContent: { paddingBottom: 16 },
  pickersRow: { flexDirection: 'row', gap: 8 },
  pickerWrap: { flex: 1 },
});
