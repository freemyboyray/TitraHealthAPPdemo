import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Heart } from 'lucide-react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { requestPermissionsDetailed as hkRequestDetailed } from '@/lib/healthkit';
import { requestPermissionsDetailed as hcRequestDetailed } from '@/lib/health-connect';
import type { AppColors } from '@/constants/theme';

const isIOS = Platform.OS === 'ios';
const HEALTH_NAME = isIOS ? 'Apple Health' : 'Health Connect';
const HEALTH_COLOR = isIOS ? '#FF2D55' : '#4285F4';
const requestPermissionsDetailed = isIOS ? hkRequestDetailed : hcRequestDetailed;

export default function HealthSyncScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const isStarting = draft.treatmentStatus !== 'on';
  const total = isStarting ? 10 : 15;
  const step = isStarting ? 7 : 12;
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { requestPermissions: storeRequestPermissions } = useHealthKitStore();
  const { setAppleHealthEnabled } = usePreferencesStore();
  const [connecting, setConnecting] = useState(false);

  const navigateNext = () => {
    // startWeightLbs is set in weight.tsx — only need to backfill startDate here.
    if (!draft.startDate) {
      updateDraft({
        startDate: draft.doseStartDate ?? new Date().toISOString().slice(0, 10),
      });
    }
    router.push('/onboarding/goal-weight');
  };

  const handleConnect = async () => {
    if (connecting) return;

    setConnecting(true);
    try {
      const result = await requestPermissionsDetailed();

      if (result.status === 'granted') {
        updateDraft({ appleHealthEnabled: true });
        setAppleHealthEnabled(true);
        storeRequestPermissions();
        navigateNext();
      } else if (result.status === 'denied') {
        Alert.alert(
          `${HEALTH_NAME} Access Denied`,
          isIOS
            ? 'You previously declined Apple Health access. To enable it, open Settings > TitraHealth > Health and turn on the categories you\'d like to share.'
            : 'You previously declined Health Connect access. To enable it, open Health Connect and grant permissions to Titra Health.',
          [
            { text: 'Open Settings', onPress: () => result.openSettings() },
            { text: 'Skip for Now', onPress: () => {
              updateDraft({ appleHealthEnabled: false });
              navigateNext();
            }},
          ],
        );
      } else {
        // unavailable
        Alert.alert(
          `${HEALTH_NAME} Unavailable`,
          result.reason,
          [
            { text: 'Skip for Now', onPress: () => {
              updateDraft({ appleHealthEnabled: false });
              navigateNext();
            }},
          ],
        );
      }
    } catch (e) {
      console.error('[HealthSync] handleConnect error:', e);
      Alert.alert(
        'Connection Failed',
        `Something went wrong connecting to ${HEALTH_NAME}. You can try again later in Settings.`,
        [
          { text: 'Skip for Now', onPress: () => {
            updateDraft({ appleHealthEnabled: false });
            navigateNext();
          }},
        ],
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleSkip = () => {
    updateDraft({ appleHealthEnabled: false });
    navigateNext();
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={step} total={total} onBack={() => router.back()} />

        <Text style={s.title}>Sync with {HEALTH_NAME}</Text>
        <Text style={s.subtitle}>
          Easily pull in your height, weight, and activity to save time and get a more tailored plan.
        </Text>

        <View style={s.illustration}>
          <View style={s.healthIcon}>
            <Heart size={56} color={HEALTH_COLOR} fill={HEALTH_COLOR} />
          </View>
          <Text style={s.healthLabel}>{HEALTH_NAME}</Text>
          <Text style={s.healthDesc}>
            Sync sleep, HRV, resting heart rate, steps, and more to power your recovery ring.
          </Text>
        </View>

        <View style={s.actions}>
          <ContinueButton
            onPress={handleConnect}
            disabled={connecting}
            label={connecting ? 'Connecting...' : `Connect ${HEALTH_NAME}`}
          />
          <TouchableOpacity onPress={handleSkip} disabled={connecting} style={s.skipBtn} accessibilityLabel="Skip for now" accessibilityRole="button">
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
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'System' },
  subtitle: { fontSize: 17, color: c.textSecondary, marginBottom: 32, lineHeight: 22, fontFamily: 'System' },
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthLabel: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'System',
    color: c.textPrimary,
  },
  healthDesc: {
    fontSize: 17,
    fontFamily: 'System',
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
    fontSize: 17,
    fontFamily: 'System',
    color: c.textSecondary,
    fontWeight: '500',
  },
});
