import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
// expo-print requires a dev build; guard so Expo Go doesn't crash.
let Print: typeof import('expo-print') | undefined;
try { Print = require('expo-print'); } catch {}
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
import { generateWeeklyInsight } from '@/lib/openai';
import { computeWeeklySummary } from '@/lib/weekly-summary';
import { useLogStore } from '@/stores/log-store';

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

type RangePreset = '30d' | '90d' | 'program' | 'custom';

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

// ─── Section toggle data ────────────────────────────────────────────────────

const SECTION_TOGGLES: { key: keyof ProviderReportConfig['sections']; label: string; defaultOn: boolean }[] = [
  { key: 'weight', label: 'Weight Trend', defaultOn: true },
  { key: 'adherence', label: 'Medication Adherence', defaultOn: true },
  { key: 'sideEffects', label: 'Side Effect Profile', defaultOn: true },
  { key: 'nutrition', label: 'Nutrition Summary', defaultOn: true },
  { key: 'activity', label: 'Activity & Exercise', defaultOn: true },
  { key: 'biometrics', label: 'Biometrics (HealthKit)', defaultOn: true },
  { key: 'checkins', label: 'Weekly Check-in Trends', defaultOn: false },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProviderReportScreen() {
  const { colors, isDark } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { profile, isLoading: profileLoading } = useProfile();
  const { targets, wearable } = useHealthData();
  const {
    foodLogs, weightLogs, activityLogs, sideEffectLogs,
    injectionLogs, weeklyCheckins, foodNoiseLogs,
  } = useLogStore();

  // ── Config state ──────────────────────────────────────────────────────────

  const [rangePreset, setRangePreset] = useState<RangePreset>('30d');
  const [sections, setSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const t of SECTION_TOGGLES) init[t.key] = t.defaultOn;
    return init;
  });
  const [providerName, setProviderName] = useState('');
  const [practiceName, setPracticeName] = useState('');
  const [includeAi, setIncludeAi] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingStage, setGeneratingStage] = useState('');

  const dateRange = useMemo(
    () => getDateRange(rangePreset, profile?.startDate ?? null),
    [rangePreset, profile?.startDate],
  );

  const toggleSection = useCallback((key: string) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

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

      // 2. Build config
      const config: ProviderReportConfig = {
        dateRange,
        sections: {
          weight: sections.weight ?? true,
          adherence: sections.adherence ?? true,
          sideEffects: sections.sideEffects ?? true,
          nutrition: sections.nutrition ?? true,
          activity: sections.activity ?? true,
          biometrics: sections.biometrics ?? true,
          checkins: sections.checkins ?? false,
        },
        providerName: providerName.trim() || undefined,
        practiceName: practiceName.trim() || undefined,
        includeAiSummary: includeAi,
        includeDetailedTables: false,
      };

      // 3. Compute report data
      const input: ProviderReportInput = {
        foodLogs,
        weightLogs,
        activityLogs,
        sideEffectLogs,
        injectionLogs,
        weeklyCheckins,
        foodNoiseLogs,
        profile,
        targets,
        wearable: wearable ?? {},
        waterByDate,
      };

      const reportData = computeProviderReport(input, config);

      // 4. Optional AI summary
      let aiSummary: string | null = null;
      if (includeAi) {
        setGeneratingStage('Generating AI summary...');
        try {
          // Reuse weekly summary compute for AI insight generation
          const weeklySummary = computeWeeklySummary(
            { foodLogs, weightLogs, activityLogs, sideEffectLogs, weeklyCheckins, foodNoiseLogs },
            targets,
            waterByDate,
          );
          aiSummary = await generateWeeklyInsight(weeklySummary, profile);
        } catch {
          aiSummary = null;
        }
      }

      // 5. Build HTML & generate PDF
      setGeneratingStage('Creating PDF...');
      const html = buildProviderReportHtml(reportData, config, aiSummary);
      const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });

      // Reset spinner before share sheet — shareAsync may never resolve on iOS dismiss
      setGenerating(false);
      setGeneratingStage('');

      // 6. Share (fire-and-forget so iOS share sheet dismiss doesn't hang)
      Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' }).catch(() => {});
    } catch (err) {
      console.warn('Provider report error:', err);
      setGenerating(false);
      setGeneratingStage('');
    }
  }, [profile, profileLoading, dateRange, sections, providerName, practiceName, includeAi,
      foodLogs, weightLogs, activityLogs, sideEffectLogs, injectionLogs,
      weeklyCheckins, foodNoiseLogs, targets, wearable]);

  // ── Render ────────────────────────────────────────────────────────────────

  const RANGE_OPTIONS: { key: RangePreset; label: string }[] = [
    { key: '30d', label: 'Last 30 Days' },
    { key: '90d', label: 'Last 90 Days' },
    { key: 'program', label: 'Since Start' },
  ];

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

        {/* Sections */}
        <View style={s.sectionCard}>
          <Text style={s.sectionLabel}>REPORT SECTIONS</Text>
          <View style={s.toggleList}>
            {/* Always-on sections */}
            <View style={s.toggleRow}>
              <Text style={[s.toggleLabel, { color: colors.textSecondary }]}>Patient Summary & Medication</Text>
              <Text style={[s.alwaysOnText]}>Always included</Text>
            </View>

            {SECTION_TOGGLES.map(t => (
              <View key={t.key} style={s.toggleRow}>
                <Text style={s.toggleLabel}>{t.label}</Text>
                <Switch
                  value={sections[t.key] ?? t.defaultOn}
                  onValueChange={() => toggleSection(t.key)}
                  trackColor={{ false: 'rgba(255,255,255,0.15)', true: ORANGE + '80' }}
                  thumbColor={sections[t.key] ? ORANGE : '#999'}
                  ios_backgroundColor="rgba(255,255,255,0.15)"
                />
              </View>
            ))}

            {/* Clinical flags always on */}
            <View style={s.toggleRow}>
              <Text style={[s.toggleLabel, { color: colors.textSecondary }]}>Clinical Flags</Text>
              <Text style={s.alwaysOnText}>Always included</Text>
            </View>
          </View>
        </View>

        {/* Provider Info */}
        <View style={s.sectionCard}>
          <Text style={s.sectionLabel}>PROVIDER INFORMATION (OPTIONAL)</Text>
          <TextInput
            style={s.input}
            placeholder="Provider Name (e.g., Dr. Jane Smith)"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={providerName}
            onChangeText={setProviderName}
            returnKeyType="next"
          />
          <TextInput
            style={s.input}
            placeholder="Practice / Clinic"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={practiceName}
            onChangeText={setPracticeName}
            returnKeyType="done"
          />
        </View>

        {/* Options */}
        <View style={s.sectionCard}>
          <Text style={s.sectionLabel}>OPTIONS</Text>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleLabel}>Include AI Summary</Text>
              <Text style={s.toggleSub}>AI-generated clinical narrative at the top</Text>
            </View>
            <Switch
              value={includeAi}
              onValueChange={setIncludeAi}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: ORANGE + '80' }}
              thumbColor={includeAi ? ORANGE : '#999'}
              ios_backgroundColor="rgba(255,255,255,0.15)"
            />
          </View>
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

  // Section card
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

  // Toggles
  toggleList: { gap: 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  toggleLabel: { fontSize: 14, color: '#fff', fontFamily: FF },
  toggleSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontFamily: FF },
  alwaysOnText: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: FF },

  // Inputs
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#fff',
    fontFamily: FF,
    marginBottom: 8,
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
