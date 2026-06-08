import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useProfile } from '@/contexts/profile-context';
import { AI_VERSION, AI_EFFECTIVE_DATE, AI_SECTIONS } from '@/constants/legal';

const FF = 'System';

// What gets sent to OpenAI — shown as custom illustrated icon rows.
const SENT_ITEMS = [
  { image: require('@/assets/images/icon-chat.png'), text: 'Your chat messages and food descriptions' },
  { image: require('@/assets/images/icon-camera.png'), text: 'Food photos you capture' },
  { image: require('@/assets/images/icon-voice.png'), text: 'Voice recordings (for transcription)' },
  { image: require('@/assets/images/icon-wellness.png'), text: 'Wellness context: medication, dose, weight progress, scores, and side effects' },
];

/**
 * Explicit, default-OFF opt-in for sending data to OpenAI. Shown right after the
 * terms screen. Required for App Store Guideline 5.1.1(i)/5.1.2(i): AI data
 * sharing must be affirmatively granted, separate from general terms acceptance.
 * Declining is non-blocking — core tracking works without AI, and the user can
 * still enable it later at the point of first use or in Settings.
 */
export default function AiConsentScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { setAiDataConsent } = usePreferencesStore();
  const { updateDraft } = useProfile();
  const [aiOpen, setAiOpen] = useState(false);

  const next = () => {
    // Record that the user reached and reviewed the AI Disclosure (whichever
    // choice they make), at the current version.
    updateDraft({ aiAcceptedAt: new Date().toISOString(), aiVersion: AI_VERSION });
    // Account creation comes right after AI consent — onboarding has run
    // anonymously up to here; the user signs up (Apple/Google/email) so the
    // remaining steps attach to a real account. account.tsx then continues to
    // /onboarding/doctor-code.
    router.push('/onboarding/account');
  };

  const handleAllow = () => {
    setAiDataConsent(true);
    next();
  };

  const handleSkip = () => {
    // Leave aiDataConsent false. The user can opt in later from any AI feature.
    next();
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={4} total={17} onBack={() => router.back()} />

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={require('@/assets/images/ai-features.png')}
            style={s.hero}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />

          <Text style={s.title}>Enable AI features?</Text>
          <Text style={s.subtitle}>
            Titra can use OpenAI, a third-party AI provider, to power Ask AI, food analysis, and
            voice logging. This is optional — you can turn it on later anytime.
          </Text>

          {/* What gets sent — icon rows */}
          <View style={s.rows}>
            {SENT_ITEMS.map((item) => (
              <View key={item.text} style={s.row}>
                <View style={s.iconCircle}>
                  <Image source={item.image} style={s.iconImg} resizeMode="contain" />
                </View>
                <Text style={s.rowText}>{item.text}</Text>
              </View>
            ))}
          </View>

          <Text style={s.never}>
            <Text style={s.neverStrong}>Never sent: </Text>
            your name, email, or account ID. OpenAI doesn't train on this data and deletes it within
            30 days.
          </Text>

          <TouchableOpacity
            style={s.disclosureLink}
            onPress={() => setAiOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Read full AI Disclosure"
          >
            <Text style={s.disclosureLinkText}>Read full AI Disclosure</Text>
            <ChevronRight size={16} color={colors.orange} />
          </TouchableOpacity>
        </ScrollView>

        <View style={s.bottom}>
          <ContinueButton onPress={handleAllow} label="Allow AI features" />
          <TouchableOpacity
            onPress={handleSkip}
            style={s.skipBtn}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <Text style={s.skipText}>Not now</Text>
          </TouchableOpacity>
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
          <ScrollView style={s.modalScroll} contentContainerStyle={s.modalScrollContent} showsVerticalScrollIndicator>
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

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, paddingHorizontal: 24 },

    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 12 },

    hero: {
      width: '100%',
      height: 230,
      alignSelf: 'center',
      marginTop: 4,
      marginBottom: 8,
    },

    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
      lineHeight: 34,
      fontFamily: FF,
      letterSpacing: -0.3,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: c.textSecondary,
      lineHeight: 22,
      fontFamily: FF,
      textAlign: 'center',
      marginBottom: 24,
    },

    rows: {
      gap: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.isDark ? 'rgba(255,116,42,0.12)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconImg: {
      width: 30,
      height: 30,
    },
    rowText: {
      flex: 1,
      fontSize: 15,
      color: c.textPrimary,
      lineHeight: 20,
      fontFamily: FF,
    },

    never: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 19,
      fontFamily: FF,
      marginTop: 18,
      textAlign: 'center',
    },
    neverStrong: { color: c.textPrimary, fontWeight: '700' },

    disclosureLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 16,
      marginTop: 4,
    },
    disclosureLinkText: { fontSize: 14, fontWeight: '600', color: c.orange, fontFamily: FF },

    bottom: { paddingTop: 8, paddingBottom: 8 },
    skipBtn: { paddingVertical: 16, alignItems: 'center' },
    skipText: { fontSize: 16, fontWeight: '600', color: c.textSecondary, fontFamily: FF },

    // AI Disclosure modal
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary, fontFamily: FF },
    modalClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    modalScroll: { flex: 1 },
    modalScrollContent: { paddingHorizontal: 20, paddingVertical: 20, paddingBottom: 40 },
    modalVersion: { fontSize: 13, color: c.textMuted, fontWeight: '600', marginBottom: 20 },
    modalSection: { marginBottom: 24 },
    modalSectionTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, marginBottom: 8, fontFamily: FF },
    modalSectionBody: { fontSize: 15, color: c.textSecondary, lineHeight: 22, fontFamily: FF },
  });
