import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { TOS_VERSION, PRIVACY_VERSION } from '@/constants/legal';

const FF = 'System';
const TERMS_URL = 'https://titrahealth.io/terms-conditions';
const PRIVACY_URL = 'https://titrahealth.io/privacy-policy';

export default function TermsScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const handleContinue = () => {
    const now = new Date().toISOString();
    updateDraft({
      tosAcceptedAt: now,
      tosVersion: TOS_VERSION,
      privacyAcceptedAt: now,
      privacyVersion: PRIVACY_VERSION,
    });
    router.push(draft.treatmentStatus === 'on' ? '/onboarding/medication' : '/onboarding/sex');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={3} total={17} onBack={() => router.back()} />

        <Text style={s.title}>We respect{'\n'}your data</Text>
        <Text style={s.subtitle}>
          Please review our terms and privacy policy before continuing.
        </Text>

        <View style={s.center}>
          <TouchableOpacity
            style={s.linkRow}
            activeOpacity={0.7}
            onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
          >
            <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
            <Text style={s.linkText}>Terms of Use</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.linkRow}
            activeOpacity={0.7}
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
          >
            <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
            <Text style={s.linkText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={s.bottom}>
          <ContinueButton onPress={handleContinue} label="Accept and Continue" />
          <Text style={s.footerText}>
            By continuing, you acknowledge that you have read and agree to our Terms of Service and Privacy Policy.
          </Text>
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
    lineHeight: 34,
    fontFamily: FF,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: c.textSecondary,
    lineHeight: 22,
    fontFamily: FF,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
  },
  linkText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: c.textPrimary,
    fontFamily: FF,
  },

  bottom: {
    paddingBottom: 8,
  },
  footerText: {
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    fontFamily: FF,
    lineHeight: 18,
    marginTop: 12,
    paddingHorizontal: 8,
  },
});
