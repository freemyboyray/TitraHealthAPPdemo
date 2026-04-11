import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
// expo-print requires a dev build; guard so Expo Go doesn't crash.
let Print: typeof import('expo-print') | undefined;
try { Print = require('expo-print'); } catch {}
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import { useHealthData } from '@/contexts/health-data';
import { useProfile } from '@/contexts/profile-context';
import type { AppColors } from '@/constants/theme';
import { computeProviderReport, type ProviderReportConfig, type ProviderReportInput } from '@/lib/provider-report-data';
import { buildProviderReportHtml } from '@/lib/provider-report-html';
import { generateWeeklyInsight, generateProviderReportNarrative } from '@/lib/openai';
import { computeWeeklySummary } from '@/lib/weekly-summary';
import { useLogStore } from '@/stores/log-store';
import { fetchEngagementDaysRange } from '@/lib/rtm';
import { supabase } from '@/lib/supabase';

const ORANGE = '#FF742A';
const FF = 'Helvetica Neue';

// ─── Date helpers ────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function subDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

function formatDateDisplay(d: string): string {
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
}

// ─── Range presets ──────────────────────────────────────────────────────────

type RangePreset = '30d' | '90d' | 'program';

function getDateRange(preset: RangePreset, programStart: string | null): { start: string; end: string } {
  const today = new Date();
  const end = toDateStr(today);

  switch (preset) {
    case '30d': return { start: toDateStr(subDays(today, 30)), end };
    case '90d': return { start: toDateStr(subDays(today, 90)), end };
    case 'program': return { start: programStart ?? toDateStr(subDays(today, 90)), end };
    default: return { start: toDateStr(subDays(today, 30)), end };
  }
}

// ─── Included sections (fixed, not user-configurable) ──────────────────────

const INCLUDED_SECTIONS = [
  'Patient Header & Medication',
  'Subjective — Patient-Reported',
  'Objective — Measured Data',
  'Assessment — Clinical Observations',
  'Topics for Discussion',
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProviderReportScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { profile, isLoading: profileLoading } = useProfile();
  const { targets, wearable } = useHealthData();
  const {
    foodLogs, weightLogs, activityLogs, sideEffectLogs,
    injectionLogs, weeklyCheckins, foodNoiseLogs,
  } = useLogStore();

  const [rangePreset, setRangePreset] = useState<RangePreset>('30d');
  const [generating, setGenerating] = useState(false);
  const [generatingStage, setGeneratingStage] = useState('');

  const dateRange = useMemo(
    () => getDateRange(rangePreset, profile?.startDate ?? null),
    [rangePreset, profile?.startDate],
  );

  // ── Generate PDF ──────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!Print) { Alert.alert('Unavailable', 'PDF generation requires a dev build.'); return; }
    if (profileLoading) { Alert.alert('Loading', 'Profile is still loading. Please try again in a moment.'); return; }
    if (!profile) { Alert.alert('Profile Required', 'Please complete your profile before generating a report.'); return; }
    setGenerating(true);

    try {
      // 1. Build water data from AsyncStorage
      setGeneratingStage('Aggregating data...');
      const waterByDate: Record<string, number> = {};
      const startD = new Date(dateRange.start + 'T00:00:00');
      const endD = new Date(dateRange.end + 'T00:00:00');
      const cursor = new Date(startD);
      while (cursor <= endD) {
        const ds = toDateStr(cursor);
        const val = await AsyncStorage.getItem(`@titrahealth_water_${ds}`);
        if (val) waterByDate[ds] = parseFloat(val);
        cursor.setDate(cursor.getDate() + 1);
      }

      // 2. Build config — all sections always on
      const config: ProviderReportConfig = {
        dateRange,
        sections: {
          weight: true,
          adherence: true,
          sideEffects: true,
          nutrition: true,
          activity: true,
          biometrics: true,
          checkins: true,
        },
        includeAiSummary: true,
        includeDetailedTables: false,
      };

      // 3. Compute report data
      // 3a. RTM engagement (only if patient has linked a clinician)
      let rtmInput: ProviderReportInput['rtm'];
      if (profile.rtmEnabled && profile.rtmClinicianId) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const days = await fetchEngagementDaysRange(user.id, dateRange.start, dateRange.end);
            const { data: clin } = await supabase
              .from('clinicians')
              .select('display_name, practice_name')
              .eq('id', profile.rtmClinicianId)
              .maybeSingle();
            const name = clin
              ? clin.practice_name
                ? `${clin.display_name} · ${clin.practice_name}`
                : clin.display_name
              : null;
            rtmInput = { clinicianName: name, engagementDays: days };
          }
        } catch {
          // swallow — report will simply omit the RTM block
        }
      }

      const input: ProviderReportInput = {
        foodLogs, weightLogs, activityLogs, sideEffectLogs,
        injectionLogs, weeklyCheckins, foodNoiseLogs,
        profile, targets,
        wearable: wearable ?? {},
        waterByDate,
        rtm: rtmInput,
      };

      const reportData = computeProviderReport(input, config);

      // 4. AI summary (legacy weekly insight, kept for parity)
      let aiSummary: string | null = null;
      setGeneratingStage('Generating AI summary...');
      try {
        const weeklySummary = computeWeeklySummary(
          { foodLogs, weightLogs, activityLogs, sideEffectLogs, weeklyCheckins, foodNoiseLogs },
          targets,
          waterByDate,
        );
        aiSummary = await generateWeeklyInsight(weeklySummary, profile);
      } catch {
        aiSummary = null;
      }

      // 4b. Assessment narrative — rules-first, LLM polishes the prose.
      // Rendered as the prose paragraph at the top of the SOAP "Assessment" section.
      setGeneratingStage('Polishing clinical narrative...');
      let assessmentNarrative: string | null = null;
      try {
        assessmentNarrative = await generateProviderReportNarrative(
          reportData.narrative.assessment,
          {
            sex: profile.sex ?? 'unspecified',
            programWeek: reportData.patient.programWeek,
            medication: reportData.medication.brand ?? reportData.medication.type,
          },
        );
      } catch {
        assessmentNarrative = null;
      }

      // 5. Build HTML & generate PDF
      setGeneratingStage('Creating PDF...');
      const html = buildProviderReportHtml(reportData, config, aiSummary, assessmentNarrative);
      const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });

      setGenerating(false);
      setGeneratingStage('');

      // 6. Navigate to preview screen with the PDF URI
      router.push({
        pathname: '/entry/report-preview',
        params: {
          pdfUri: uri,
          rangeStart: dateRange.start,
          rangeEnd: dateRange.end,
        },
      } as any);
    } catch (err) {
      console.warn('Provider report error:', err);
      Alert.alert('Error', 'Something went wrong generating the report. Please try again.');
      setGenerating(false);
      setGeneratingStage('');
    }
  }, [profile, profileLoading, dateRange,
      foodLogs, weightLogs, activityLogs, sideEffectLogs, injectionLogs,
      weeklyCheckins, foodNoiseLogs, targets, wearable]);

  // ── Render ────────────────────────────────────────────────────────────────

  const RANGE_OPTIONS: { key: RangePreset; label: string }[] = [
    { key: '30d', label: 'Last 30 Days' },
    { key: '90d', label: 'Last 90 Days' },
    { key: 'program', label: 'Since Start' },
  ];

  // ── Locked state: no clinician linked ─────────────────────────────────────
  if (!profileLoading && profile && !profile.rtmEnabled) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Provider Report</Text>
            <Text style={s.headerSub}>Generate a PDF for your healthcare provider</Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{
            width: 84, height: 84, borderRadius: 42,
            backgroundColor: 'rgba(255,116,42,0.12)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}>
            <Ionicons name="lock-closed" size={36} color={ORANGE} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 12, fontFamily: FF }}>
            Link Your Clinician
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 32, paddingHorizontal: 16 }}>
            The Provider Report is a clinical PDF you can share with your doctor.
            Enter your provider code to unlock it.
          </Text>
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: ORANGE, paddingHorizontal: 24, height: 50, borderRadius: 25,
            }}
            onPress={() => router.replace('/settings/rtm-link' as any)}
          >
            <Ionicons name="medkit-outline" size={18} color="#000" />
            <Text style={{ color: '#000', fontSize: 15, fontWeight: '700' }}>Link Clinician</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Provider Report</Text>
          <Text style={s.headerSub}>Generate a PDF for your healthcare provider</Text>
        </View>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Range */}
        <View style={s.sectionCard}>
          <Text style={s.sectionLabel}>DATE RANGE</Text>
          <View style={s.pillRow}>
            {RANGE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[s.pill, rangePreset === opt.key && s.pillActive]}
                onPress={() => setRangePreset(opt.key)}
              >
                <Text style={[s.pillText, rangePreset === opt.key && s.pillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.rangeSub}>
            {formatDateDisplay(dateRange.start)} – {formatDateDisplay(dateRange.end)}
          </Text>
        </View>

        {/* What's Included */}
        <View style={s.sectionCard}>
          <Text style={s.sectionLabel}>INCLUDED IN REPORT</Text>
          {INCLUDED_SECTIONS.map((label, i) => (
            <View key={label} style={[s.includedRow, i === INCLUDED_SECTIONS.length - 1 && { borderBottomWidth: 0 }]}>
              <Ionicons name="checkmark-circle" size={18} color={ORANGE} />
              <Text style={s.includedLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Info note */}
        <View style={s.infoCard}>
          <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.4)" />
          <Text style={s.infoText}>
            Your report includes all logged data for the selected period, clinical flags, and an AI-generated summary for your provider.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Footer */}
      <BlurView intensity={30} tint="dark" style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[s.generateBtn, (generating || profileLoading) && s.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={generating || profileLoading}
        >
          {generating ? (
            <View style={s.generatingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={s.generateBtnText}>{generatingStage || 'Generating...'}</Text>
            </View>
          ) : (
            <>
              <Ionicons name="document-text" size={18} color="#fff" />
              <Text style={s.generateBtnText}>Generate Report</Text>
            </>
          )}
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    fontFamily: FF,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    fontFamily: FF,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: ORANGE,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
    fontFamily: FF,
  },

  // Range pills
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  pillActive: { backgroundColor: ORANGE },
  pillText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', fontFamily: FF },
  pillTextActive: { color: '#fff' },
  rangeSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: FF },

  // Included sections list
  includedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  includedLabel: {
    fontSize: 14,
    color: '#fff',
    fontFamily: FF,
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: FF,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ORANGE,
    height: 50,
    borderRadius: 14,
  },
  generateBtnDisabled: { opacity: 0.7 },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, fontFamily: FF },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
