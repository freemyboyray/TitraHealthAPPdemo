import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo } from 'react';
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
import { MEDICAL_SOURCES, MEDICAL_DISCLAIMER } from '@/constants/medical-sources';
import { ChevronLeft, ExternalLink, Info } from 'lucide-react-native';


type SourceItem = { key: string; label: string; citation: string; url: string };

type SourceGroup = {
  category: string;
  items: SourceItem[];
};

const SOURCE_GROUPS: SourceGroup[] = [
  {
    category: 'Pharmacokinetics (Drug Levels)',
    items: [
      MEDICAL_SOURCES.semaglutide_pk,
      MEDICAL_SOURCES.tirzepatide_pk,
      MEDICAL_SOURCES.dulaglutide_pk,
      MEDICAL_SOURCES.liraglutide_pk,
      MEDICAL_SOURCES.oral_semaglutide_pk,
    ].map((s, i) => ({ key: `pk-${i}`, ...s })),
  },
  {
    category: 'Clinical Trials (Weight Loss Data)',
    items: [
      MEDICAL_SOURCES.step1_trial,
      MEDICAL_SOURCES.surmount1_trial,
      MEDICAL_SOURCES.scale_trial,
      MEDICAL_SOURCES.award2_trial,
    ].map((s, i) => ({ key: `trial-${i}`, ...s })),
  },
  {
    category: 'Nutrition & Lifestyle',
    items: [
      MEDICAL_SOURCES.protein_glp1,
      MEDICAL_SOURCES.hydration_baseline,
      MEDICAL_SOURCES.fiber_gastric,
      MEDICAL_SOURCES.exercise_glp1,
      MEDICAL_SOURCES.aclm_macros,
    ].map((s, i) => ({ key: `nutrition-${i}`, ...s })),
  },
  {
    category: 'Sleep & Cardiovascular',
    items: [
      MEDICAL_SOURCES.sleep_glp1,
      MEDICAL_SOURCES.glp1_hrv,
      MEDICAL_SOURCES.lean_mass_glp1,
    ].map((s, i) => ({ key: `cardio-${i}`, ...s })),
  },
];

export default function MedicalSourcesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Medical Sources</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator
      >
        {/* Disclaimer banner */}
        <View style={s.disclaimerBanner}>
          <Info size={20} color={colors.orange} />
          <Text style={s.disclaimerText}>{MEDICAL_DISCLAIMER}</Text>
        </View>

        <Text style={s.intro}>
          All health information in Titra is based on the following peer-reviewed
          studies, prescribing information, and published clinical
          guidelines. Tap any source to view the original publication.
        </Text>

        {SOURCE_GROUPS.map((group) => (
          <View key={group.category} style={s.group}>
            <Text style={s.groupTitle}>{group.category}</Text>
            {group.items.map((item) => (
              <Pressable
                key={item.key}
                style={s.sourceCard}
                onPress={() => WebBrowser.openBrowserAsync(item.url)}
              >
                <View style={s.sourceContent}>
                  <Text style={s.sourceLabel}>{item.label}</Text>
                  <Text style={s.sourceCitation}>{item.citation}</Text>
                </View>
                <ExternalLink
                  size={16}
                  color={colors.orange}
                  style={s.sourceIcon} />
              </Pressable>
            ))}
          </View>
        ))}

        <View style={s.footer}>
          <Text style={s.footerText}>
            If you believe any information in this app is inaccurate or outdated,
            please contact us at support@titrahealth.io.
          </Text>
        </View>
      </ScrollView>
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

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

    disclaimerBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: c.isDark ? 'rgba(255,116,42,0.08)' : 'rgba(255,116,42,0.06)',
      borderRadius: 14,
      padding: 14,
      marginTop: 16,
      marginBottom: 16,
    },
    disclaimerText: {
      flex: 1,
      fontSize: 14,
      color: w(0.6),
      lineHeight: 20,
    },

    intro: {
      fontSize: 15,
      color: w(0.5),
      lineHeight: 22,
      marginBottom: 24,
    },

    group: {
      marginBottom: 24,
    },
    groupTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: w(0.4),
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 10,
    },

    sourceCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 14,
      marginBottom: 8,
    },
    sourceContent: {
      flex: 1,
      gap: 4,
    },
    sourceLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
    },
    sourceCitation: {
      fontSize: 14,
      color: w(0.55),
      lineHeight: 20,
    },
    sourceIcon: {
      marginLeft: 10,
      marginTop: 2,
    },

    footer: {
      marginTop: 8,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderSubtle,
    },
    footerText: {
      fontSize: 13,
      color: w(0.35),
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
