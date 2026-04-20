import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import type { AppColors } from '@/constants/theme';

export default function HealthSyncScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const isStarting = draft.treatmentStatus !== 'on';
  const total = isStarting ? 10 : 14;
  const step = isStarting ? 7 : 10;
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const requestPermissions = useHealthKitStore((s) => s.requestPermissions);
  const setAppleHealthEnabled = usePreferencesStore((s) => s.setAppleHealthEnabled);

  const navigateNext = () => {
    if (isStarting) {
      updateDraft({ startWeightLbs: draft.weightLbs, startDate: new Date().toISOString().slice(0, 10) });
      router.push('/onboarding/goal-weight');
    } else {
      router.push('/onboarding/start');
    }
  };

  const handleConnect = async () => {
    const granted = await requestPermissions();
    if (granted) {
      updateDraft({ appleHealthEnabled: true });
      setAppleHealthEnabled(true);
    } else {
      // HealthKit unavailable (Expo Go / simulator) or user denied — continue anyway
      updateDraft({ appleHealthEnabled: false });
    }
    navigateNext();
  };

  const handleSkip = () => {
    updateDraft({ appleHealthEnabled: false });
    navigateNext();
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={step} total={total} onBack={() => router.back()} />

        <Text style={s.title}>Sync with Apple Health</Text>
        <Text style={s.subtitle}>
          Easily pull in your height, weight, and activity to save time and get a more tailored plan.
        </Text>

        <View style={s.illustration}>
          <View style={s.healthIcon}>
            <Ionicons name="heart" size={64} color="#FF2D55" />
          </View>
          <Text style={s.healthLabel}>Apple Health</Text>
          <Text style={s.healthDesc}>
            Sync sleep, HRV, resting heart rate, steps, and more to power your recovery ring.
          </Text>
        </View>

        <View style={s.actions}>
          <ContinueButton onPress={handleConnect} label="Connect Apple Health" />
          <TouchableOpacity onPress={handleSkip} style={s.skipBtn}>
            <Text style={s.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'Helvetica Neue' },
  subtitle: { fontSize: 15, color: c.textSecondary, marginBottom: 32, lineHeight: 22, fontFamily: 'Helvetica Neue' },
  illustration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  healthIcon: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: 'rgba(255,45,85,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  healthLabel: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Helvetica Neue',
    color: c.textPrimary,
  },
  healthDesc: {
    fontSize: 15,
    fontFamily: 'Helvetica Neue',
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  actions: {},
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipText: {
    fontSize: 15,
    fontFamily: 'Helvetica Neue',
    color: c.textSecondary,
    fontWeight: '500',
  },
});
