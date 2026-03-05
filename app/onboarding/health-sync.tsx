import { useRouter } from 'expo-router';
import React from 'react';
import {
  SafeAreaView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';

export default function HealthSyncScreen() {
  const router = useRouter();
  const { updateDraft } = useProfile();

  const handleConnect = () => {
    // Stub: in production call HealthKit permissions
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
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A1A', marginBottom: 8, lineHeight: 34 },
  subtitle: { fontSize: 15, color: '#666666', marginBottom: 32, lineHeight: 22 },
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
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  healthLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  healthDesc: {
    fontSize: 15,
    color: '#888',
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
    color: '#888',
    fontWeight: '500',
  },
});
