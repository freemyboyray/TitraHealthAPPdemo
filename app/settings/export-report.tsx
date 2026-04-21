import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// expo-print requires a dev build; guard so Expo Go doesn't crash.
let Print: typeof import('expo-print') | undefined;
try { Print = require('expo-print'); } catch {}
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { useLogStore } from '@/stores/log-store';
import type { AppColors } from '@/constants/theme';
import { buildHealthReportHtml, type ReportData } from '@/lib/health-report';
import { useSubscriptionStore } from '@/stores/subscription-store';

const ORANGE = '#FF742A';

type RangeOption = { label: string; days: number };
const RANGE_OPTIONS: RangeOption[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

export default function ExportReportScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useProfile();
  const {
    foodLogs,
    weightLogs,
    activityLogs,
    sideEffectLogs,
    injectionLogs,
    weeklyCheckins,
  } = useLogStore();

  const [selectedDays, setSelectedDays] = useState(30);
  const [generating, setGenerating] = useState(false);

  const isPremium = useSubscriptionStore((s) => s.isPremium);

  const handleGenerate = async () => {
    if (!isPremium) {
      Alert.alert(
        'Titra Pro Feature',
        'Provider report generation is available with Titra Pro. Upgrade to export shareable health reports.',
        [{ text: 'OK' }],
      );
      return;
    }

    if (!profile || !Print) {
      Alert.alert(
        'Not Available',
        Print ? 'Profile not loaded.' : 'PDF export requires a development build.',
      );
      return;
    }

    setGenerating(true);

    try {
      const now = new Date();
      const startDate = new Date(now.getTime() - selectedDays * 86400000);
      const startStr = startDate.toISOString().slice(0, 10);
      const endStr = now.toISOString().slice(0, 10);

      // Filter logs by date range
      const inRange = (dateStr: string) => dateStr >= startStr && dateStr <= endStr;

      const rangeFood = foodLogs.filter(l => l.logged_at?.slice(0, 10) >= startStr);
      const rangeWeight = weightLogs.filter(l => inRange(l.logged_at?.slice(0, 10) ?? ''));
      const rangeActivity = activityLogs.filter(l => inRange(l.date ?? ''));
      const rangeSideEffects = sideEffectLogs.filter(l => inRange(l.logged_at?.slice(0, 10) ?? ''));
      const rangeInjections = injectionLogs.filter(l => inRange(l.injection_date ?? ''));
      // weeklyCheckins is Record<string, WeeklyCheckinRow[]> — flatten all types
      const allCheckins = Object.values(weeklyCheckins).flat();
      const rangeCheckins = allCheckins.filter((l: any) => inRange(l.logged_at?.slice(0, 10) ?? ''));

      // Compute nutrition averages
      const daysWithFood = new Set(rangeFood.map(l => l.logged_at?.slice(0, 10))).size;
      const totalCal = rangeFood.reduce((sum, l) => sum + (l.calories ?? 0), 0);
      const totalProtein = rangeFood.reduce((sum, l) => sum + (l.protein_g ?? 0), 0);
      const totalFiber = rangeFood.reduce((sum, l) => sum + (l.fiber_g ?? 0), 0);

      // Compute weight trend
      const sortedWeight = [...rangeWeight].sort((a, b) =>
        (a.logged_at ?? '').localeCompare(b.logged_at ?? ''));
      const firstWeight = sortedWeight[0]?.weight_lbs ?? null;
      const lastWeight = sortedWeight[sortedWeight.length - 1]?.weight_lbs ?? null;

      // Compute activity averages
      const daysWithActivity = new Set(rangeActivity.map(l => l.date)).size;
      const totalSteps = rangeActivity.reduce((sum, l) => sum + (l.steps ?? 0), 0);

      // Compute side effects
      const seTypeCounts: Record<string, number> = {};
      rangeSideEffects.forEach(l => {
        const t = l.effect_type ?? 'unknown';
        seTypeCounts[t] = (seTypeCounts[t] ?? 0) + 1;
      });
      const topSe = Object.entries(seTypeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k]) => k);

      // Compute checkin averages
      const checkinByType: Record<string, number[]> = {};
      rangeCheckins.forEach((c: any) => {
        const t = c.checkin_type ?? c.type ?? '';
        if (!checkinByType[t]) checkinByType[t] = [];
        checkinByType[t].push(c.score ?? 0);
      });
      const checkinAvgs: Record<string, number | null> = {};
      Object.entries(checkinByType).forEach(([k, scores]) => {
        checkinAvgs[k] = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
      });

      const reportData: ReportData = {
        profile,
        dateRange: { start: startStr, end: endStr },
        weight: {
          start: firstWeight,
          end: lastWeight,
          delta: firstWeight != null && lastWeight != null ? lastWeight - firstWeight : null,
        },
        nutrition: {
          avgCalories: daysWithFood > 0 ? Math.round(totalCal / daysWithFood) : null,
          avgProteinG: daysWithFood > 0 ? Math.round(totalProtein / daysWithFood) : null,
          avgFiberG: daysWithFood > 0 ? Math.round(totalFiber / daysWithFood) : null,
          avgWaterOz: null, // Water is stored in AsyncStorage by date, not in log store
          daysLogged: daysWithFood,
        },
        activity: {
          avgSteps: daysWithActivity > 0 ? Math.round(totalSteps / daysWithActivity) : null,
          activeDays: daysWithActivity,
          totalDays: selectedDays,
        },
        sideEffects: {
          totalCount: rangeSideEffects.length,
          topTypes: topSe,
        },
        checkins: checkinAvgs,
        injections: {
          count: rangeInjections.length,
          dates: rangeInjections.map(l => l.injection_date ?? ''),
        },
      };

      const html = buildHealthReportHtml(reportData);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } catch (e) {
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Export Health Report</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {/* Info card */}
        <View style={s.infoCard}>
          <Ionicons name="document-text-outline" size={32} color={ORANGE} />
          <Text style={s.infoTitle}>Share Your Wellness Data</Text>
          <Text style={s.infoBody}>
            Generate a PDF report of your self-reported wellness data to share with your physician
            during appointments. The report includes medication, weight, nutrition, activity,
            side effects, and check-in scores.
          </Text>
        </View>

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Ionicons name="information-circle-outline" size={18} color="#856404" />
          <Text style={s.disclaimerText}>
            This is self-reported wellness data, not a medical record. The report includes a
            blank "Patient Name" field so you can hand-write your name when sharing with your doctor.
          </Text>
        </View>

        {/* Date range selection */}
        <Text style={s.sectionLabel}>DATE RANGE</Text>
        <View style={s.rangeRow}>
          {RANGE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.days}
              style={[s.rangePill, selectedDays === opt.days && s.rangePillActive]}
              onPress={() => setSelectedDays(opt.days)}
              activeOpacity={0.8}
            >
              <Text style={[s.rangePillText, selectedDays === opt.days && s.rangePillTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Generate button */}
        <TouchableOpacity
          style={[s.generateBtn, generating && s.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={generating}
          activeOpacity={0.85}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={s.generateBtnText}>Generate PDF</Text>
            </>
          )}
        </TouchableOpacity>
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
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
    },

    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 40 },

    infoCard: {
      backgroundColor: c.glassOverlay,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      marginBottom: 16,
    },
    infoTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.textPrimary,
      textAlign: 'center',
    },
    infoBody: {
      fontSize: 14,
      color: w(0.6),
      textAlign: 'center',
      lineHeight: 20,
    },

    disclaimer: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: 'rgba(255,243,205,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(255,193,7,0.3)',
      borderRadius: 12,
      padding: 12,
      marginBottom: 24,
    },
    disclaimerText: {
      flex: 1,
      fontSize: 12,
      color: w(0.6),
      lineHeight: 18,
    },

    sectionLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 2,
      marginBottom: 8,
      marginLeft: 4,
    },

    rangeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 32,
    },
    rangePill: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: w(0.1),
      backgroundColor: w(0.03),
    },
    rangePillActive: {
      backgroundColor: ORANGE,
      borderColor: ORANGE,
    },
    rangePillText: {
      fontSize: 13,
      fontWeight: '600',
      color: w(0.5),
    },
    rangePillTextActive: {
      color: '#FFFFFF',
    },

    generateBtn: {
      flexDirection: 'row',
      height: 52,
      borderRadius: 26,
      backgroundColor: ORANGE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    generateBtnDisabled: { opacity: 0.55 },
    generateBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}
