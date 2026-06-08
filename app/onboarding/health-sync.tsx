import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Footprints, Heart, Moon, Scale } from 'lucide-react-native';

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

// Center logo asset — swap the placeholder PNGs in assets/images/health/ with the
// official Apple Health / Health Connect icons (same paths, ~512px square).
const HEALTH_LOGO = isIOS
  ? require('@/assets/images/health/apple-health-v2.png')
  : require('@/assets/images/health/health-connect-v2.png');

// Constellation geometry — a fixed square stage, capped so it never clips on small devices.
const STAGE = Math.min(Dimensions.get('window').width - 48, 320);
const CENTER = STAGE / 2;
const ORBIT_R = STAGE * 0.42;
const BUBBLE = 52;

// Data types that orbit the central logo. Angles are offset for an organic, non-grid look.
const ORBIT_ICONS = [
  { Icon: Moon, color: '#5E5CE6', angle: -60, fill: false }, // sleep
  { Icon: Heart, color: '#FF2D55', angle: 35, fill: true }, // heart & HRV
  { Icon: Scale, color: '#0A84FF', angle: 150, fill: false }, // weight
  { Icon: Footprints, color: '#34C759', angle: 230, fill: false }, // steps & activity
] as const;

function bubblePosition(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    left: CENTER + ORBIT_R * Math.cos(rad) - BUBBLE / 2,
    top: CENTER + ORBIT_R * Math.sin(rad) - BUBBLE / 2,
  };
}

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

        <View style={s.illustration}>
          <View style={s.stage}>
            <View style={[s.ring, s.ringOuter]} />
            <View style={[s.ring, s.ringInner]} />

            <Image
              source={HEALTH_LOGO}
              style={s.centerLogo}
              resizeMode="contain"
              accessibilityLabel={`${HEALTH_NAME} logo`}
            />

            {ORBIT_ICONS.map(({ Icon, color, angle, fill }, i) => (
              <View key={i} style={[s.iconBubble, bubblePosition(angle)]}>
                <Icon size={26} color={color} fill={fill ? color : 'transparent'} />
              </View>
            ))}
          </View>
        </View>

        <Text style={s.title}>Have all your health data in one place</Text>
        <Text style={s.subtitle}>
          Connect {HEALTH_NAME} to sync your steps, heart rate, sleep, and weight — so Titra
          can save you setup time and tailor your plan.
        </Text>

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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: c.textPrimary,
    marginBottom: 12,
    lineHeight: 34,
    fontFamily: 'System',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: c.textSecondary,
    marginBottom: 24,
    lineHeight: 23,
    fontFamily: 'System',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  illustration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    width: STAGE,
    height: STAGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: c.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
  },
  ringOuter: {
    width: STAGE,
    height: STAGE,
  },
  ringInner: {
    width: STAGE * 0.62,
    height: STAGE * 0.62,
  },
  centerLogo: {
    width: 104,
    height: 104,
    borderRadius: 23,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  iconBubble: {
    position: 'absolute',
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
