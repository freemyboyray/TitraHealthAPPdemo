import { useRouter } from 'expo-router';
// expo-print requires a dev build; guard so Expo Go doesn't crash.
let Print: typeof import('expo-print') | undefined;
try { Print = require('expo-print'); } catch {}
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CircleIconButton } from '@/components/ui/circle-icon-button';
import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { useLogStore } from '@/stores/log-store';
import type { AppColors } from '@/constants/theme';
import { buildHealthReportHtml, type ReportData } from '@/lib/health-report';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { ChevronLeft, Download, FileText } from 'lucide-react-native';


type RangeOption = { label: string; days: number };
const RANGE_OPTIONS: RangeOption[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
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

      // Hand off to the in-app preview screen (WebView) where the user can view,
      // save, and share the generated PDF.
      router.push({
        pathname: '/entry/report-preview',
        params: { pdfUri: uri, rangeStart: startStr, rangeEnd: endStr },
      } as any);
    } catch (e) {
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header — back button, then icon + title centered */}
      <View style={s.header}>
        <CircleIconButton
          icon={ChevronLeft}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        />
        <View style={s.headerCenter}>
          <FileText size={20} color={colors.textPrimary} strokeWidth={1.8} />
          <Text style={s.headerTitle}>Share your wellness data</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.intro}>
          Generate a clean PDF of your self-reported data to bring to your next appointment.
          It covers medication, weight, nutrition, activity, side effects, and check-in scores.
        </Text>

        {/* Date range */}
        <Text style={s.sectionLabel}>Date range</Text>
        <View style={s.rangeRow}>
          {RANGE_OPTIONS.map((opt) => {
            const active = selectedDays === opt.days;
            return (
              <TouchableOpacity
                key={opt.days}
                style={[s.rangePill, active && s.rangePillActive]}
                onPress={() => setSelectedDays(opt.days)}
                activeOpacity={0.8}
              >
                <Text style={[s.rangePillText, active && s.rangePillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Generate → opens in-app preview */}
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
              <Download size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={s.generateBtnText}>Generate report</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={s.generateHint}>You'll preview it before sharing.</Text>
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
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    headerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
      color: c.textPrimary,
    },

    scroll: { flex: 1 },
    content: { paddingHorizontal: 20, paddingBottom: 40 },

    intro: {
      fontSize: 15,
      color: c.textSecondary,
      lineHeight: 22,
      paddingTop: 12,
      paddingBottom: 28,
    },

    sectionLabel: {
      color: c.textSecondary,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
      marginBottom: 10,
    },

    rangeRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 24,
    },
    rangePill: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      backgroundColor: w(0.05),
    },
    rangePillActive: {
      backgroundColor: c.orange,
    },
    rangePillText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textSecondary,
    },
    rangePillTextActive: {
      color: '#FFFFFF',
    },

    generateBtn: {
      flexDirection: 'row',
      height: 54,
      borderRadius: 999,
      backgroundColor: c.orange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    generateBtnDisabled: { opacity: 0.55 },
    generateBtnText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    generateHint: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 12,
    },
  });
}
