import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLogStore } from '../../stores/log-store';
import { VoiceButton } from '../../components/ui/voice-button';
import { parseVoiceLog, type VoiceInjectionResult } from '../../lib/openai';
import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import type { AppColors } from '@/constants/theme';
import { isOralDrug } from '@/constants/drug-pk';
import type { Glp1Type } from '@/constants/user-profile';
import { useHealthData } from '@/contexts/health-data';


// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE = '#FF742A';

const SITES = [
  'Left Abdomen',
  'Right Abdomen',
  'Left Thigh',
  'Right Thigh',
  'Left Upper Arm',
  'Right Upper Arm',
];

/** Given a previous injection site, return the next recommended rotation site. */
function getRecommendedSite(lastSite: string): string {
  const idx = SITES.indexOf(lastSite);
  if (idx === -1) return SITES[0];
  return SITES[(idx + 1) % SITES.length];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassBorder({ r = 20 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: r,
          borderWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.13)',
          borderLeftColor: 'rgba(255,255,255,0.08)',
          borderRightColor: 'rgba(255,255,255,0.03)',
          borderBottomColor: 'rgba(255,255,255,0.02)',
        },
      ]}
    />
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', marginBottom: 14 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: ORANGE, letterSpacing: 2 }}>{text}</Text>
    </View>
  );
}

function GlassCard({ children, colors }: { children: React.ReactNode; colors: AppColors }) {
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={s.cardShadow}>
      <View style={s.cardClip}>
        <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, s.cardOverlay]} />
        <GlassBorder r={20} />
        <View style={s.cardContent}>{children}</View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LogDoseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, addInjectionLog, injectionLogs, profile } = useLogStore();
  const { updateProfile } = useProfile();
  const { dispatch } = useHealthData();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const MED_TYPE_DEFAULT: Record<string, string> = {
    semaglutide: 'Ozempic',
    tirzepatide: 'Mounjaro',
    liraglutide: 'Saxenda',
  };

  // Medication & dose from profile (read-only display)
  const medication = profile?.medication_brand
    ? (profile.medication_brand as string).charAt(0).toUpperCase() + (profile.medication_brand as string).slice(1)
    : (profile?.medication_type ? MED_TYPE_DEFAULT[profile.medication_type] : null)
    ?? 'Not set';
  const doseMg = profile?.dose_mg;
  const doseLabel = doseMg != null ? `${doseMg}mg` : 'Not set';

  // Belt-and-suspenders: derive "is oral" from BOTH the medication_type
  // (via isOralDrug, the same source add-entry-sheet uses) AND the
  // route_of_administration column. Either one being truthy is enough.
  // This protects against stale rows where one column is set but not the other —
  // e.g. an in-flight medication switch via pendingRoute that hasn't fully
  // synced, or a profile created before route_of_administration existed.
  const isOral =
    isOralDrug(profile?.medication_type as Glp1Type | undefined) ||
    profile?.route_of_administration === 'oral';

  // Injection site: derive from last injection log
  const lastInjectionSite = injectionLogs[0]?.site ?? null;
  const recommendedSite = lastInjectionSite ? getRecommendedSite(lastInjectionSite) : null;
  const isFirstInjection = !lastInjectionSite;

  const [site, setSite] = useState(recommendedSite ?? 'Left Abdomen');
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [emptyStomach, setEmptyStomach] = useState<boolean | null>(null); // oral sema fasting window

  async function handleVoiceTranscription(text: string) {
    try {
      const result = await parseVoiceLog('injection', text) as VoiceInjectionResult;
      if (result.site) {
        const siteLower = result.site.toLowerCase();
        const matched = SITES.find(s =>
          s.toLowerCase().includes(siteLower) ||
          siteLower.includes(s.toLowerCase().split(' ').slice(-1)[0])
        );
        if (matched) setSite(matched);
      }
      if (result.batch) setBatchNumber(result.batch);
      if (result.notes) setNotes(result.notes);
    } catch {
      Alert.alert('Voice Input', 'Could not parse your injection details. Try saying the site and any notes.');
    }
  }

  async function handleSave() {
    if (doseMg == null) {
      Alert.alert('Dose not set', 'Please set your medication and dose in Settings before logging.');
      return;
    }
    const date = todayString();
    // For oral drugs: encode empty-stomach response in notes if no other note given
    const emptyStomachNote = isOral && emptyStomach !== null
      ? (emptyStomach ? '(taken on empty stomach)' : '(taken with food/water — absorption may be reduced)')
      : '';
    const combinedNotes = [notes.trim(), emptyStomachNote].filter(Boolean).join(' ');
    await addInjectionLog(
      doseMg,
      date,
      undefined,
      isOral ? undefined : site,
      combinedNotes || undefined,
      medication,
      isOral ? undefined : (batchNumber.trim() || undefined),
    );
    // Immediately mark injection as logged in the health data context so
    // daily focuses update without waiting for a full data refresh.
    dispatch({ type: 'LOG_INJECTION' });
    // Keep ProfileContext in sync so cycle-intelligence reads the correct date immediately
    await updateProfile({ lastInjectionDate: date });
    router.back();
  }

  const siteStyles = useMemo(() => createSiteStyles(colors), [colors]);

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} activeOpacity={0.75} style={s.backShadow}>
          <View style={s.backClip}>
            <BlurView intensity={76} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, s.backOverlay]} />
            <GlassBorder r={20} />
            <Ionicons name="chevron-back" size={22} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
          </View>
        </TouchableOpacity>

        <Text style={s.headerTitle}>{isOral ? 'Log Dose' : 'Log Injection'}</Text>

        <View style={s.headerSpacer} />
      </View>

      {/* ── Date label ── */}
      <Text style={s.dateLabel}>{todayLabel().toUpperCase()}</Text>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Medication & Dose Card (read-only from profile) ── */}
        <GlassCard colors={colors}>
          <SectionLabel text="MEDICATION & DOSE" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[s.chip, s.chipActive]}>
              <Text style={[s.chipText, s.chipTextActive]}>{medication}</Text>
            </View>
            <View style={[s.chip, s.chipActive]}>
              <Text style={[s.chipText, s.chipTextActive]}>{doseLabel}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/settings/edit-treatment'); }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginTop: 12 }}
          >
            <Text style={{ fontSize: 12, color: colors.textMuted, textDecorationLine: 'underline' }}>
              Doesn't match? Update in Settings
            </Text>
          </TouchableOpacity>
        </GlassCard>

        {/* ── Injection Site Card (injectable only) ── */}
        {!isOral && (
          <GlassCard colors={colors}>
            <SectionLabel text="INJECTION SITE" />

            {/* Rotation recommendation based on last injection */}
            {lastInjectionSite && (
              <View style={s.rotateRow}>
                <Ionicons name="sync-outline" size={14} color={ORANGE} style={s.rotateIcon} />
                <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, flex: 1 }}>
                  Last site: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{lastInjectionSite}</Text>
                  {'\n'}
                  <Text style={{ color: ORANGE, fontWeight: '700' }}>
                    We recommend rotating to {recommendedSite}
                  </Text>
                </Text>
              </View>
            )}

            {isFirstInjection && (
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 19 }}>
                Select your injection site. We'll track rotation for you going forward.
              </Text>
            )}

            <View style={[s.siteGrid, { marginTop: lastInjectionSite ? 14 : 0 }]}>
              {SITES.map((siteName) => {
                const active = siteName === site;
                return (
                  <TouchableOpacity
                    key={siteName}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSite(siteName); }}
                    activeOpacity={0.75}
                    style={[
                      siteStyles.siteBtn,
                      active ? siteStyles.siteBtnActive : siteStyles.siteBtnInactive,
                    ]}
                  >
                    <Text
                      style={[
                        siteStyles.siteBtnText,
                        active ? siteStyles.siteBtnTextActive : siteStyles.siteBtnTextInactive,
                      ]}
                    >
                      {siteName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </GlassCard>
        )}

        {/* ── Empty Stomach Toggle (oral drugs only) ── */}
        {isOral && (
          <GlassCard colors={colors}>
            <SectionLabel text="FASTING WINDOW" />
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 19 }}>
              Did you take your dose on an empty stomach?{'\n'}
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Oral semaglutide must be taken 30 min before food or water for proper absorption.
              </Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {([true, false] as const).map((val) => (
                <TouchableOpacity
                  key={String(val)}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEmptyStomach(val); }}
                  activeOpacity={0.75}
                  style={[
                    siteStyles.siteBtn,
                    { flex: 1 },
                    emptyStomach === val ? siteStyles.siteBtnActive : siteStyles.siteBtnInactive,
                  ]}
                >
                  <Text style={[siteStyles.siteBtnText, emptyStomach === val ? siteStyles.siteBtnTextActive : siteStyles.siteBtnTextInactive]}>
                    {val ? 'Yes — empty stomach' : 'No — had food/water'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>
        )}

        {/* ── Batch & Notes Card ── */}
        <GlassCard colors={colors}>
          {!isOral && (
            <>
              <TextInput
                style={s.textInput}
                placeholder="Batch # (optional)"
                placeholderTextColor={colors.textMuted}
                value={batchNumber}
                onChangeText={setBatchNumber}
                maxLength={30}
                returnKeyType="next"
              />
              <View style={s.inputDivider} />
            </>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <TextInput
              style={[s.textInput, s.notesInput, { flex: 1 }]}
              placeholder="Add a note or speak to auto-fill…"
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              maxLength={200}
              multiline
              textAlignVertical="top"
            />
            <VoiceButton onTranscription={handleVoiceTranscription} size="sm" style={{ marginTop: 6 }} />
          </View>
        </GlassCard>
      </ScrollView>

      {/* ── Save Button ── */}
      <View style={[s.saveWrapper, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleSave(); }}
          activeOpacity={0.82}
          disabled={loading}
          style={[s.saveBtn, loading && s.saveBtnDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <View style={s.saveBtnInner}>
              <FontAwesome5 name={isOral ? 'pills' : 'syringe'} size={16} color="#FFF" style={s.saveIcon} />
              <Text style={s.saveBtnText}>{isOral ? 'Save Dose' : 'Save Injection'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createSiteStyles = (c: AppColors) => StyleSheet.create({
  siteBtn: {
    width: '48%',
    marginBottom: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  siteBtnActive: {
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 5,
  },
  siteBtnInactive: {
    backgroundColor: c.borderSubtle,
  },
  siteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  siteBtnTextActive: {
    color: '#FFFFFF',
  },
  siteBtnTextInactive: {
    color: c.textSecondary,
  },
});

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backShadow: {
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  backClip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backOverlay: {
    borderRadius: 20,
    backgroundColor: w(0.12),
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },

  // Date label
  dateLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    letterSpacing: 3.5,
    marginTop: 6,
    marginBottom: 18,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 14,
  },

  // Glass card
  cardShadow: {
    borderRadius: 20,
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  cardClip: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: c.surface,
  },
  cardOverlay: {
    borderRadius: 20,
    backgroundColor: c.borderSubtle,
  },
  cardContent: {
    padding: 18,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  chipActive: {
    backgroundColor: ORANGE,
  },
  chipInactive: {
    backgroundColor: c.borderSubtle,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipTextInactive: {
    color: c.textSecondary,
  },

  // Site grid
  siteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  // Rotate row
  rotateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  rotateIcon: {
    marginRight: 4,
  },
  rotateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    letterSpacing: 1.5,
  },
  rotateValue: {
    fontSize: 11,
    fontWeight: '700',
    color: ORANGE,
    letterSpacing: 1,
  },

  // Text inputs
  textInput: {
    fontSize: 15,
    color: c.textPrimary,
    fontWeight: '500',
    paddingVertical: 6,
    minHeight: 36,
  },
  notesInput: {
    minHeight: 72,
    paddingTop: 10,
  },
  inputDivider: {
    height: 1,
    backgroundColor: c.borderSubtle,
    marginVertical: 10,
  },

  // Save button
  saveWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  saveBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveIcon: {
    marginTop: 1,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  });
};
