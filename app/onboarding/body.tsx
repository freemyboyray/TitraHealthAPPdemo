import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { WheelPicker } from '@/components/onboarding/wheel-picker';
import { UnitSystem } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FEET = Array.from({ length: 4 }, (_, i) => `${i + 4} ft`);
const INCHES = Array.from({ length: 12 }, (_, i) => `${i} in`);
const LBS_WHOLE = Array.from({ length: 321 }, (_, i) => `${i + 80} lbs`);
const LBS_HALF = ['.0', '.5'];
const CM = Array.from({ length: 101 }, (_, i) => `${i + 120} cm`);
const KG = Array.from({ length: 161 }, (_, i) => `${i + 40} kg`);

export default function BodyScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();
  const [unit, setUnit] = useState<UnitSystem>('imperial');
  const [ftIdx, setFtIdx] = useState(2);
  const [inIdx, setInIdx] = useState(0);
  const [lbsIdx, setLbsIdx] = useState(100);
  const [halfIdx, setHalfIdx] = useState(0);
  const [cmIdx, setCmIdx] = useState(45);
  const [kgIdx, setKgIdx] = useState(42);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const handleContinue = () => {
    if (unit === 'imperial') {
      const ft = ftIdx + 4;
      const inches = inIdx;
      const lbs = lbsIdx + 80 + (halfIdx === 1 ? 0.5 : 0);
      updateDraft({
        unitSystem: 'imperial',
        heightFt: ft,
        heightIn: inches,
        heightCm: Math.round(((ft * 12) + inches) * 2.54),
        weightLbs: lbs,
        weightKg: Math.round(lbs * 0.453592 * 10) / 10,
      });
    } else {
      const cm = cmIdx + 120;
      const kg = kgIdx + 40;
      updateDraft({
        unitSystem: 'metric',
        heightCm: cm,
        heightFt: Math.floor(cm / 30.48),
        heightIn: Math.round((cm / 2.54) % 12),
        weightKg: kg,
        weightLbs: Math.round(kg * 2.20462 * 10) / 10,
      });
    }
    router.push('/onboarding/health-sync');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={7} total={14} onBack={() => router.back()} />

        <Text style={s.title}>Your Height & Weight</Text>
        <Text style={s.subtitle}>
          Helps us calculate your BMI and personalize daily nutrition and activity goals.
        </Text>

        {/* Unit toggle */}
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

        <View style={s.pickersSection}>
          <Text style={s.sectionLabel}>Height</Text>
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

          <Text style={[s.sectionLabel, { marginTop: 16 }]}>Weight</Text>
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
        </View>

        <ContinueButton onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'Helvetica Neue' },
  subtitle: { fontSize: 15, color: c.textSecondary, marginBottom: 20, lineHeight: 22, fontFamily: 'Helvetica Neue' },
  toggle: {
    flexDirection: 'row',
    backgroundColor: c.glassOverlay,
    borderRadius: 12,
    padding: 3,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  toggleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: '#FF742A',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Helvetica Neue',
    color: c.textSecondary,
  },
  toggleTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Helvetica Neue',
  },
  pickersSection: { flex: 1 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Helvetica Neue',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  pickersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerWrap: { flex: 1 },
});
