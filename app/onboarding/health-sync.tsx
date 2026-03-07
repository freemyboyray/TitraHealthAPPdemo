import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';

export default function HealthSyncScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();

  const handleConnect = async () => {
    // NitroModules (HealthKit) crash the app in Expo Go — skip the native call there.
    // In a production EAS build this code path runs normally.
    const isExpoGo = Constants.appOwnership === 'expo';

    if (Platform.OS === 'ios' && !isExpoGo) {
      try {
        const HealthKit = require('@kingstinct/react-native-healthkit').default;
        const { HKQuantityTypeIdentifier } = require('@kingstinct/react-native-healthkit');

        const typesToRead = [
          HKQuantityTypeIdentifier.stepCount,
          HKQuantityTypeIdentifier.heartRateVariabilitySDNN,
          HKQuantityTypeIdentifier.restingHeartRate,
          HKQuantityTypeIdentifier.oxygenSaturation,
          HKQuantityTypeIdentifier.bodyMass,
        ];

        await HealthKit.requestAuthorization(typesToRead, []);
      } catch {
        // Permission denied or unavailable — still mark as enabled and continue
      }
    }

    updateDraft({ appleHealthEnabled: true });
    router.push('/onboarding/start');
  };

  const handleSkip = () => {
    updateDraft({ appleHealthEnabled: false });
    router.push('/onboarding/start');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={8} total={14} onBack={() => router.back()} />

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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, lineHeight: 34, fontFamily: 'Helvetica Neue' },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 32, lineHeight: 22, fontFamily: 'Helvetica Neue' },
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
    color: '#FFFFFF',
  },
  healthDesc: {
    fontSize: 15,
    fontFamily: 'Helvetica Neue',
    color: 'rgba(255,255,255,0.45)',
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
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
  },
});
