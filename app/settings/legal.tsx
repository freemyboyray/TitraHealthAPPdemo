import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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

export default function LegalScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<Tab>('tos');

  const sections = activeTab === 'tos' ? TOS_SECTIONS : PRIVACY_SECTIONS;
  const effectiveDate = activeTab === 'tos' ? TOS_EFFECTIVE_DATE : PRIVACY_EFFECTIVE_DATE;
  const version = activeTab === 'tos' ? TOS_VERSION : PRIVACY_VERSION;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Terms & Privacy</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.container}>
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

        {/* Content */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator
        >
          <Text style={s.versionInfo}>
            Version {version} · Effective {effectiveDate}
          </Text>

          {sections.map((section: LegalSection, i: number) => (
            <View key={i} style={s.section}>
              <Text style={s.sectionTitle}>{section.title}</Text>
              <Text style={s.sectionBody}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  const w = (a: number) =>
    c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
    },

    container: { flex: 1, paddingHorizontal: 16 },

    tabRow: {
      flexDirection: 'row',
      backgroundColor: w(0.06),
      borderRadius: 12,
      padding: 3,
      marginTop: 12,
      marginBottom: 12,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: ORANGE },
    tabText: { fontSize: 13, fontWeight: '600', color: w(0.5) },
    tabTextActive: { color: '#FFFFFF' },

    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },

    versionInfo: {
      fontSize: 12,
      color: w(0.4),
      fontWeight: '600',
      marginBottom: 20,
    },

    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: 8,
    },
    sectionBody: {
      fontSize: 14,
      color: w(0.65),
      lineHeight: 22,
    },
  });
}
