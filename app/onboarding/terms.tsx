import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import {
  TOS_VERSION,
  PRIVACY_VERSION,
  AI_VERSION,
  AI_EFFECTIVE_DATE,
  AI_SECTIONS,
} from '@/constants/legal';
import { usePreferencesStore } from '@/stores/preferences-store';
import { ChevronRight, FileText, Lock, Sparkles, X } from 'lucide-react-native';

const FF = 'System';
const TERMS_URL = 'https://titrahealth.io/terms-conditions';
const PRIVACY_URL = 'https://titrahealth.io/privacy-policy';

export default function TermsScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [aiOpen, setAiOpen] = useState(false);

  const { setFoodDbConsent } = usePreferencesStore();

  const handleContinue = () => {
    const now = new Date().toISOString();
    updateDraft({
      tosAcceptedAt: now,
      tosVersion: TOS_VERSION,
      privacyAcceptedAt: now,
      privacyVersion: PRIVACY_VERSION,
      aiAcceptedAt: now,
      aiVersion: AI_VERSION,
    });
    // Food-database (FatSecret) access powers core food logging and shares only
    // search queries — no health or personal data — so it's enabled on terms
    // acceptance. AI (OpenAI) data sharing is NOT granted here; it requires a
    // separate, explicit opt-in on the next screen (App Store Guideline 5.1.1(i)).
    setFoodDbConsent(true);
    router.push('/onboarding/ai-consent');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={3} total={17} onBack={() => router.back()} />

        <Text style={s.title}>We respect{'\n'}your data</Text>
        <Text style={s.subtitle}>
          Please review our terms, privacy policy, and AI disclosure before continuing.
        </Text>

        <View style={s.center}>
          <TouchableOpacity
            style={s.linkRow}
            activeOpacity={0.7}
            onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
            accessibilityLabel="Terms of Use"
            accessibilityRole="link"
          >
            <FileText size={22} color={colors.textSecondary} />
            <Text style={s.linkText}>Terms of Use</Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.linkRow}
            activeOpacity={0.7}
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
            accessibilityLabel="Privacy Policy"
            accessibilityRole="link"
          >
            <Lock size={22} color={colors.textSecondary} />
            <Text style={s.linkText}>Privacy Policy</Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.linkRow}
            activeOpacity={0.7}
            onPress={() => setAiOpen(true)}
            accessibilityLabel="AI Disclosure"
            accessibilityRole="link"
          >
            <Sparkles size={22} color={colors.textSecondary} />
            <Text style={s.linkText}>AI Disclosure</Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={s.bottom}>
          <ContinueButton onPress={handleContinue} label="Accept and Continue" />
          <Text style={s.footerText}>
            By continuing, you acknowledge that you have read and agree to our Terms of Service, Privacy Policy, and AI Disclosure. You'll choose whether to enable AI features on the next screen.
          </Text>
        </View>
      </View>

      <Modal
        visible={aiOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAiOpen(false)}
      >
        <SafeAreaView style={s.safe}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>AI Disclosure</Text>
            <TouchableOpacity onPress={() => setAiOpen(false)} style={s.modalClose} hitSlop={12} accessibilityLabel="Close AI Disclosure" accessibilityRole="button">
              <X size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={s.modalScroll}
            contentContainerStyle={s.modalScrollContent}
            showsVerticalScrollIndicator
          >
            <Text style={s.modalVersion}>
              Version {AI_VERSION} · Effective {AI_EFFECTIVE_DATE}
            </Text>
            {AI_SECTIONS.map((section, i) => (
              <View key={i} style={s.modalSection}>
                <Text style={s.modalSectionTitle}>{section.title}</Text>
                <Text style={s.modalSectionBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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

  // ── AI Disclosure modal ──
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSubtle,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: c.textPrimary,
    fontFamily: FF,
  },
  modalClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: { flex: 1 },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  modalVersion: {
    fontSize: 13,
    color: c.textMuted,
    fontWeight: '600',
    marginBottom: 20,
  },
  modalSection: { marginBottom: 24 },
  modalSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 8,
    fontFamily: FF,
  },
  modalSectionBody: {
    fontSize: 15,
    color: c.textSecondary,
    lineHeight: 22,
    fontFamily: FF,
  },
});
