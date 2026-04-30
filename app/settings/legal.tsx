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

import { SlidingTabs } from '@/components/ui/sliding-tabs';
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
        <SlidingTabs
          tabs={[{ key: 'tos' as Tab, label: 'Terms of Service' }, { key: 'privacy' as Tab, label: 'Privacy Policy' }]}
          activeKey={activeTab}
          onChange={setActiveTab}
          height={38}
          borderRadius={12}
          padding={3}
        />

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
      fontSize: 19,
      fontWeight: '700',
      color: c.textPrimary,
    },

    container: { flex: 1, paddingHorizontal: 16 },

    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },

    versionInfo: {
      fontSize: 14,
      color: w(0.4),
      fontWeight: '600',
      marginBottom: 20,
    },

    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: 8,
    },
    sectionBody: {
      fontSize: 16,
      color: w(0.65),
      lineHeight: 22,
    },
  });
}
