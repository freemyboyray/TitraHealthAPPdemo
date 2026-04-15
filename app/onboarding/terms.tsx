import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import {
  TOS_VERSION,
  TOS_EFFECTIVE_DATE,
  TOS_SECTIONS,
  PRIVACY_VERSION,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_SECTIONS,
  type LegalSection,
} from '@/constants/legal';

const ORANGE = '#FF742A';

type Tab = 'tos' | 'privacy';

export default function TermsScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [accepted, setAccepted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('tos');

  const sections = activeTab === 'tos' ? TOS_SECTIONS : PRIVACY_SECTIONS;
  const effectiveDate = activeTab === 'tos' ? TOS_EFFECTIVE_DATE : PRIVACY_EFFECTIVE_DATE;

  const handleContinue = () => {
    if (!accepted) return;
    const now = new Date().toISOString();
    updateDraft({
      tosAcceptedAt: now,
      tosVersion: TOS_VERSION,
      privacyAcceptedAt: now,
      privacyVersion: PRIVACY_VERSION,
    });
    router.push(draft.glp1Status === 'active' ? '/onboarding/medication' : '/onboarding/sex');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={3} total={14} onBack={() => router.back()} />

        <Text style={s.title}>Terms & Privacy</Text>
        <Text style={s.subtitle}>
          Please review and accept our Terms of Service and Privacy Policy to continue.
        </Text>

        {/* Tab switcher */}
        <View style={s.tabRow}>
          <Pressable
            style={[s.tab, activeTab === 'tos' && s.tabActive]}
            onPress={() => setActiveTab('tos')}
          >
            <Text style={[s.tabText, activeTab === 'tos' && s.tabTextActive]}>
              Terms of Service
            </Text>
          </Pressable>
          <Pressable
            style={[s.tab, activeTab === 'privacy' && s.tabActive]}
            onPress={() => setActiveTab('privacy')}
          >
            <Text style={[s.tabText, activeTab === 'privacy' && s.tabTextActive]}>
              Privacy Policy
            </Text>
          </Pressable>
        </View>

        {/* Scrollable legal text */}
        <View style={s.legalContainer}>
          <ScrollView
            style={s.legalScroll}
            contentContainerStyle={s.legalContent}
            showsVerticalScrollIndicator
          >
            <Text style={s.effectiveDate}>Effective: {effectiveDate}</Text>
            {sections.map((section: LegalSection, i: number) => (
              <View key={i} style={s.section}>
                <Text style={s.sectionTitle}>{section.title}</Text>
                <Text style={s.sectionBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Checkbox */}
        <Pressable style={s.checkboxRow} onPress={() => setAccepted((v) => !v)}>
          <View style={[s.checkbox, accepted && s.checkboxChecked]}>
            {accepted && <Text style={s.checkmark}>✓</Text>}
          </View>
          <Text style={s.checkboxLabel}>
            I have read and agree to the Terms of Service and Privacy Policy
          </Text>
        </Pressable>

        <ContinueButton onPress={handleContinue} disabled={!accepted} />
      </View>
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  const w = (a: number) =>
    c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, paddingHorizontal: 24 },

    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.5,
      marginTop: 16,
    },
    subtitle: {
      fontSize: 15,
      color: w(0.55),
      lineHeight: 22,
      marginTop: 8,
      marginBottom: 16,
    },

    // Tab switcher
    tabRow: {
      flexDirection: 'row',
      backgroundColor: w(0.06),
      borderRadius: 12,
      padding: 3,
      marginBottom: 12,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: ORANGE,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: w(0.5),
    },
    tabTextActive: {
      color: '#FFFFFF',
    },

    // Legal text container
    legalContainer: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: w(0.1),
      backgroundColor: w(0.03),
      overflow: 'hidden',
    },
    legalScroll: { flex: 1 },
    legalContent: { padding: 16, paddingBottom: 24 },

    effectiveDate: {
      fontSize: 12,
      color: w(0.4),
      fontWeight: '600',
      marginBottom: 16,
    },

    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: 6,
    },
    sectionBody: {
      fontSize: 13,
      color: w(0.65),
      lineHeight: 20,
    },

    // Checkbox
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 16,
      marginBottom: 12,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: w(0.25),
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: ORANGE,
      borderColor: ORANGE,
    },
    checkmark: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    checkboxLabel: {
      flex: 1,
      fontSize: 13,
      color: w(0.7),
      lineHeight: 18,
    },
  });
}
