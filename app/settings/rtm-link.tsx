import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
let Print: typeof import('expo-print') | undefined;
try { Print = require('expo-print'); } catch {}
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
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
import { generateWeeklyInsight, generateProviderReportNarrative } from '@/lib/openai';
import { computeWeeklySummary } from '@/lib/weekly-summary';
import { useLogStore } from '@/stores/log-store';
import { fetchEngagementDaysRange } from '@/lib/rtm';
import { supabase } from '@/lib/supabase';

const ORANGE = '#FF742A';
const FF = 'Helvetica Neue';

const CONSENT_TEXT =
  'I consent to my clinician reviewing the health data I log in Titra Health.';

// ─── Date helpers ─────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function subDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() - n); return r;
}
function formatDateDisplay(d: string): string {
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
}

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

const INCLUDED_SECTIONS = [
  'Patient Header & Medication',
  'Subjective — Patient-Reported',
  'Objective — Measured Data',
  'Assessment — Clinical Observations',
  'Topics for Discussion',
];

const RANGE_OPTIONS: { key: RangePreset; label: string }[] = [
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'program', label: 'Since Start' },
];

// ─── Screen ───────────────────────────────────────────────────────────────
export default function ClinicianReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { profile, isLoading: profileLoading, updateProfile } = useProfile();
  const { targets, wearable } = useHealthData();
  const {
    foodLogs, weightLogs, activityLogs, sideEffectLogs,
    injectionLogs, weeklyCheckins, foodNoiseLogs,
  } = useLogStore();
  const s = useMemo(() => createStyles(colors), [colors]);

  const linked = profile?.rtmEnabled ?? false;
  const clinicianId = profile?.rtmClinicianId ?? null;

  // ── Clinician link state ────────────────────────────────────────────────
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clinicianName, setClinicianName] = useState<string | null>(null);
  const [linkedAt, setLinkedAt] = useState<string | null>(null);

  // ── Report state ────────────────────────────────────────────────────────
  const [rangePreset, setRangePreset] = useState<RangePreset>('30d');
  const [generating, setGenerating] = useState(false);
  const [generatingStage, setGeneratingStage] = useState('');

  const dateRange = useMemo(
    () => getDateRange(rangePreset, profile?.startDate ?? null),
    [rangePreset, profile?.startDate],
  );

  // Hydrate clinician info
  useEffect(() => {
    if (!linked || !clinicianId) { setClinicianName(null); setLinkedAt(null); return; }
    let cancelled = false;
    (async () => {
      const [{ data: clin }, { data: { user } }] = await Promise.all([
        supabase.from('clinicians').select('display_name, practice_name').eq('id', clinicianId).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      if (clin) setClinicianName(clin.practice_name ? `${clin.display_name} · ${clin.practice_name}` : clin.display_name);
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('rtm_linked_at').eq('id', user.id).maybeSingle();
        if (!cancelled && prof?.rtm_linked_at) setLinkedAt(prof.rtm_linked_at);
      }
    })();
    return () => { cancelled = true; };
  }, [linked, clinicianId]);

  // ── Link / Unlink ──────────────────────────────────────────────────────
  async function handleLink() {
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Enter a provider code.'); return; }
    setBusy(true);
    const { data, error: lookupErr } = await supabase
      .from('clinicians').select('id, display_name').eq('code', trimmed).eq('active', true).maybeSingle();
    if (lookupErr || !data) {
      setBusy(false);
      setError("Code not found. Double-check with your clinician.");
      return;
    }
    await updateProfile({ rtmEnabled: true, rtmClinicianId: data.id, rtmConsentText: CONSENT_TEXT });
    setBusy(false);
    setCode('');
  }

  function handleUnlink() {
    Alert.alert(
      'Unlink Clinician',
      'You will no longer be able to generate the Clinician Report. You can re-link any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink', style: 'destructive',
          onPress: async () => {
            setBusy(true);
            await updateProfile({ rtmEnabled: false, rtmClinicianId: null, rtmConsentText: null });
            setBusy(false);
          },
        },
      ],
    );
  }

  // ── Generate PDF ───────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!Print) { Alert.alert('Unavailable', 'PDF generation requires a dev build.'); return; }
    if (profileLoading) { Alert.alert('Loading', 'Profile is still loading.'); return; }
    if (!profile) { Alert.alert('Profile Required', 'Please complete your profile first.'); return; }
    setGenerating(true);
    try {
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

      const config: ProviderReportConfig = {
        dateRange,
        sections: { weight: true, adherence: true, sideEffects: true, nutrition: true, activity: true, biometrics: true, checkins: true },
        includeAiSummary: true,
        includeDetailedTables: false,
      };

      let rtmInput: ProviderReportInput['rtm'];
      if (profile.rtmEnabled && profile.rtmClinicianId) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const days = await fetchEngagementDaysRange(user.id, dateRange.start, dateRange.end);
            const { data: clin } = await supabase.from('clinicians').select('display_name, practice_name').eq('id', profile.rtmClinicianId).maybeSingle();
            const name = clin ? (clin.practice_name ? `${clin.display_name} · ${clin.practice_name}` : clin.display_name) : null;
            rtmInput = { clinicianName: name, engagementDays: days };
          }
        } catch {}
      }

      const input: ProviderReportInput = {
        foodLogs, weightLogs, activityLogs, sideEffectLogs,
        injectionLogs, weeklyCheckins, foodNoiseLogs,
        profile, targets, wearable: wearable ?? {}, waterByDate, rtm: rtmInput,
      };
      const reportData = computeProviderReport(input, config);

      let aiSummary: string | null = null;
      setGeneratingStage('Generating AI summary...');
      try {
        const weeklySummary = computeWeeklySummary(
          { foodLogs, weightLogs, activityLogs, sideEffectLogs, weeklyCheckins, foodNoiseLogs },
          targets, waterByDate,
        );
        aiSummary = await generateWeeklyInsight(weeklySummary, profile);
      } catch { aiSummary = null; }

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
      } catch { assessmentNarrative = null; }

      setGeneratingStage('Creating PDF...');
      const html = buildProviderReportHtml(reportData, config, aiSummary, assessmentNarrative);
      const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });
      setGenerating(false);
      setGeneratingStage('');
      router.push({ pathname: '/entry/report-preview', params: { pdfUri: uri, rangeStart: dateRange.start, rangeEnd: dateRange.end } } as any);
    } catch (err) {
      console.warn('Clinician report error:', err);
      Alert.alert('Error', 'Something went wrong generating the report.');
      setGenerating(false);
      setGeneratingStage('');
    }
  }, [profile, profileLoading, dateRange, foodLogs, weightLogs, activityLogs, sideEffectLogs, injectionLogs, weeklyCheckins, foodNoiseLogs, targets, wearable]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Clinician Report</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: linked ? insets.bottom + 100 : 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Clinician Link Section ── */}
          {linked ? (
            <View style={s.card}>
              <View style={s.linkedHeader}>
                <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                  <Ionicons name="medkit" size={20} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.linkedTitle}>{clinicianName ?? 'Linked'}</Text>
                  <Text style={s.linkedSub}>Clinician Report unlocked</Text>
                </View>
              </View>
              {linkedAt && (
                <Text style={s.linkedDate}>
                  Linked on {new Date(linkedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              )}
              <Pressable
                style={[s.btn, s.btnDestructive, busy && s.btnDisabled]}
                onPress={handleUnlink}
                disabled={busy}
              >
                <Text style={s.btnDestructiveText}>Unlink Clinician</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.card}>
              <Text style={s.intro}>
                Link your clinician to unlock the Clinician Report — a clinical PDF
                summary you can generate and share at appointments.
              </Text>
              <Text style={s.codeLabel}>PROVIDER CODE</Text>
              <TextInput
                style={s.codeInput}
                value={code}
                onChangeText={(t) => { setCode(t); setError(null); }}
                placeholder="e.g. TITRA-SMITH-A4F2"
                placeholderTextColor="rgba(255,255,255,0.55)"
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
              />
              {error && <Text style={s.error}>{error}</Text>}
              <Text style={s.consent}>{CONSENT_TEXT}</Text>
              <Pressable
                style={[s.btn, s.btnPrimary, (busy || !code.trim()) && s.btnDisabled]}
                onPress={handleLink}
                disabled={busy || !code.trim()}
              >
                <Text style={s.btnPrimaryText}>{busy ? 'Linking…' : 'Link Clinician'}</Text>
              </Pressable>
            </View>
          )}

          {/* ── Report Section (only when linked) ── */}
          {linked && (
            <>
              <View style={[s.card, { marginTop: 16 }]}>
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

              <View style={[s.card, { marginTop: 12 }]}>
                <Text style={s.sectionLabel}>INCLUDED IN REPORT</Text>
                {INCLUDED_SECTIONS.map((label, i) => (
                  <View key={label} style={[s.includedRow, i === INCLUDED_SECTIONS.length - 1 && { borderBottomWidth: 0 }]}>
                    <Ionicons name="checkmark-circle" size={18} color={ORANGE} />
                    <Text style={s.includedLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              <View style={s.infoCard}>
                <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.4)" />
                <Text style={s.infoText}>
                  Your report includes all logged data for the selected period, clinical flags, and an AI-generated summary.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Generate Button (only when linked) */}
      {linked && (
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
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 12, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    backBtn: { padding: 8, width: 36, alignItems: 'center' },
    headerTitle: { flex: 1, color: c.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
    content: { padding: 20 },
    intro: { color: c.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 16 },

    card: {
      borderRadius: 16, borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', padding: 18,
    },
    iconBadge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

    // Linked state
    linkedHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    linkedTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '700' },
    linkedSub: { color: ORANGE, fontSize: 12, fontWeight: '600', marginTop: 2, letterSpacing: 0.5 },
    linkedDate: { color: c.textMuted, fontSize: 12, marginBottom: 18 },

    // Code input
    codeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: c.textMuted, marginBottom: 8 },
    codeInput: {
      height: 56, borderRadius: 14, borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#000000',
      paddingHorizontal: 18, color: '#FFFFFF', fontSize: 16, fontWeight: '600', letterSpacing: 0.5,
    },
    error: { marginTop: 10, color: '#FF453A', fontSize: 13, fontWeight: '600' },
    consent: { marginTop: 14, fontSize: 12, lineHeight: 17, color: c.textMuted },

    btn: { marginTop: 18, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
    btnPrimary: { backgroundColor: ORANGE },
    btnPrimaryText: { color: '#000000', fontSize: 15, fontWeight: '700' },
    btnDestructive: { backgroundColor: 'rgba(255,69,58,0.12)', borderWidth: 1, borderColor: 'rgba(255,69,58,0.4)' },
    btnDestructiveText: { color: '#FF453A', fontSize: 15, fontWeight: '700' },
    btnDisabled: { opacity: 0.4 },

    // Report section
    sectionLabel: { fontSize: 11, fontWeight: '700', color: ORANGE, letterSpacing: 1.5, marginBottom: 12, fontFamily: FF },
    pillRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    pill: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
    pillActive: { backgroundColor: ORANGE },
    pillText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', fontFamily: FF },
    pillTextActive: { color: '#fff' },
    rangeSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: FF },
    includedRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    includedLabel: { fontSize: 14, color: '#fff', fontFamily: FF },
    infoCard: {
      flexDirection: 'row', gap: 8, padding: 14, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.03)', marginTop: 12,
    },
    infoText: { flex: 1, fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.4)', fontFamily: FF },

    // Footer
    footer: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingHorizontal: 16, paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)',
    },
    generateBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: ORANGE, height: 50, borderRadius: 14,
    },
    generateBtnDisabled: { opacity: 0.7 },
    generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, fontFamily: FF },
    generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  });
}
