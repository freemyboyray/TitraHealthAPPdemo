import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useLogStore } from '../../stores/log-store';
import { VoiceButton } from '../../components/ui/voice-button';
import { usePostHog } from '@/lib/posthog';
import { parseVoiceLog, type VoiceInjectionResult } from '../../lib/openai';
import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import type { AppColors } from '@/constants/theme';
import { cardElevation } from '@/constants/theme';
import { isOralDrug } from '@/constants/drug-pk';
import type { Glp1Type } from '@/constants/user-profile';
import { useHealthData } from '@/contexts/health-data';

// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE = '#FF742A';
const SCREEN_WIDTH = Dimensions.get('window').width;
const USE_THREE_COLUMNS = SCREEN_WIDTH >= 375;

const SITES = [
  'Left Abdomen',
  'Right Abdomen',
  'Left Thigh',
  'Right Thigh',
  'Left Upper Arm',
  'Right Upper Arm',
];

function getRecommendedSite(lastSite: string): string {
  const idx = SITES.indexOf(lastSite);
  if (idx === -1) return SITES[0];
  return SITES[(idx + 1) % SITES.length];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LogDoseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, addInjectionLog, injectionLogs } = useLogStore();
  const { profile: fullProfile, updateProfile } = useProfile();
  const { dispatch } = useHealthData();
  const { colors } = useAppTheme();
  const posthog = usePostHog();
  const s = useMemo(() => createStyles(colors), [colors]);

  const medication = fullProfile?.medicationBrand
    ? fullProfile.medicationBrand.charAt(0).toUpperCase() + fullProfile.medicationBrand.slice(1)
    : 'Not set';
  const doseMg = fullProfile?.doseMg ?? null;
  const doseLabel = doseMg != null ? `${doseMg}mg` : 'Not set';

  const isOral =
    isOralDrug(fullProfile?.glp1Type) ||
    fullProfile?.routeOfAdministration === 'oral';

  const lastInjectionSite = injectionLogs[0]?.site ?? null;
  const recommendedSite = lastInjectionSite ? getRecommendedSite(lastInjectionSite) : null;
  const isFirstInjection = !lastInjectionSite;

  const [site, setSite] = useState(recommendedSite ?? 'Left Abdomen');
  const [customSite, setCustomSite] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [emptyStomach, setEmptyStomach] = useState<boolean | null>(null);

  // ── Entrance animations ──────────────────────────────────────────────────
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(12);
  const medRowOpacity = useSharedValue(0);
  const medRowY = useSharedValue(16);
  const cardOpacity = useSharedValue(0);
  const cardY = useSharedValue(24);
  const fieldsOpacity = useSharedValue(0);
  const fieldsY = useSharedValue(16);
  const saveBtnOpacity = useSharedValue(0);
  const saveBtnY = useSharedValue(40);

  useEffect(() => {
    const ease = { duration: 400, easing: Easing.out(Easing.quad) };
    headerOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
    headerY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
    medRowOpacity.value = withDelay(100, withTiming(1, ease));
    medRowY.value = withDelay(100, withTiming(0, ease));
    cardOpacity.value = withDelay(200, withTiming(1, ease));
    cardY.value = withDelay(200, withTiming(0, ease));
    fieldsOpacity.value = withDelay(350, withTiming(1, ease));
    fieldsY.value = withDelay(350, withTiming(0, ease));
    saveBtnOpacity.value = withDelay(400, withTiming(1, ease));
    saveBtnY.value = withDelay(400, withTiming(0, ease));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const headerAnim = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));
  const medRowAnim = useAnimatedStyle(() => ({
    opacity: medRowOpacity.value,
    transform: [{ translateY: medRowY.value }],
  }));
  const cardAnim = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));
  const fieldsAnim = useAnimatedStyle(() => ({
    opacity: fieldsOpacity.value,
    transform: [{ translateY: fieldsY.value }],
  }));
  const saveBtnAnim = useAnimatedStyle(() => ({
    opacity: saveBtnOpacity.value,
    transform: [{ translateY: saveBtnY.value }],
  }));

  // ── Voice transcription ──────────────────────────────────────────────────
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

  // ── Save handler ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (doseMg == null) {
      Alert.alert('Dose not set', 'Please set your medication and dose in Settings before logging.');
      return;
    }
    const date = todayString();
    const emptyStomachNote = isOral && emptyStomach !== null
      ? (emptyStomach ? '(taken on empty stomach)' : '(taken with food/water — absorption may be reduced)')
      : '';
    const combinedNotes = [notes.trim(), emptyStomachNote].filter(Boolean).join(' ');
    const success = await addInjectionLog(
      doseMg,
      date,
      undefined,
      isOral ? undefined : (site === 'Other' ? customSite.trim() : site),
      combinedNotes || undefined,
      medication,
      isOral ? undefined : (batchNumber.trim() || undefined),
    );
    if (!success) {
      Alert.alert('Save Failed', 'Could not save your dose. Please check your connection and try again.');
      return;
    }
    posthog?.capture('dose_logged', { route: isOral ? 'oral' : 'injection' });
    dispatch({ type: 'LOG_INJECTION' });
    await updateProfile({ lastInjectionDate: date });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  const cols = USE_THREE_COLUMNS ? 3 : 2;
  const gridGap = 10;
  const gridItemWidth = (SCREEN_WIDTH - 40 - gridGap * (cols - 1)) / cols;

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ── */}
      <Animated.View style={[s.header, headerAnim]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          activeOpacity={0.7}
          style={s.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{isOral ? 'Log Dose' : 'Log Injection'}</Text>
          <Text style={s.dateLabel}>{todayLabel()}</Text>
        </View>

        <View style={s.headerSpacer} />
      </Animated.View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Medication Context Row ── */}
        <Animated.View style={medRowAnim}>
          <TouchableOpacity
            style={s.medRow}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/settings/edit-treatment'); }}
            activeOpacity={0.7}
          >
            <FontAwesome5 name={isOral ? 'pills' : 'syringe'} size={13} color={colors.textMuted} />
            <Text style={s.medRowText} numberOfLines={1}>
              {medication} · {doseLabel}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Injection Site Card (injectable only) ── */}
        {!isOral && (
          <Animated.View style={[s.siteCard, cardAnim]}>
            <Text style={s.sectionLabel}>INJECTION SITE</Text>

            {recommendedSite && (
              <View style={s.rotateRow}>
                <Ionicons name="sync-outline" size={13} color={ORANGE} />
                <Text style={s.rotateText}>
                  Rotate to <Text style={s.rotateBold}>{recommendedSite}</Text>
                </Text>
              </View>
            )}

            {isFirstInjection && (
              <Text style={s.rotateText}>Select your first injection site</Text>
            )}

            <View style={[s.siteGrid, { marginTop: 14 }]}>
              {SITES.map((siteName) => {
                const active = siteName === site;
                const isRecommended = siteName === recommendedSite && !active;
                return (
                  <TouchableOpacity
                    key={siteName}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSite(siteName); }}
                    activeOpacity={0.75}
                    style={[
                      s.siteBtn,
                      { width: gridItemWidth },
                      active ? s.siteBtnActive : s.siteBtnInactive,
                    ]}
                  >
                    {isRecommended && <View style={s.recommendedDot} />}
                    <Text style={[s.siteBtnText, active ? s.siteBtnTextActive : s.siteBtnTextInactive]}>
                      {siteName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSite('Other'); }}
              activeOpacity={0.75}
              style={[s.otherBtn, site === 'Other' ? s.siteBtnActive : s.siteBtnInactive]}
            >
              <Text style={[s.siteBtnText, site === 'Other' ? s.siteBtnTextActive : s.siteBtnTextInactive]}>
                Other
              </Text>
            </TouchableOpacity>

            {site === 'Other' && (
              <TextInput
                style={s.customSiteInput}
                placeholder="Type injection site..."
                placeholderTextColor={colors.textMuted}
                value={customSite}
                onChangeText={setCustomSite}
                autoFocus
              />
            )}
          </Animated.View>
        )}

        {/* ── Fasting Window (oral only) ── */}
        {isOral && (
          <Animated.View style={[s.siteCard, cardAnim]}>
            <Text style={s.sectionLabel}>FASTING WINDOW</Text>
            <Text style={s.fastingQuestion}>Did you take your dose on an empty stomach?</Text>
            <View style={s.fastingOptions}>
              {([true, false] as const).map((val) => (
                <TouchableOpacity
                  key={String(val)}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEmptyStomach(val); }}
                  activeOpacity={0.75}
                  style={[s.fastingBtn, emptyStomach === val ? s.siteBtnActive : s.siteBtnInactive]}
                >
                  <Text style={[s.siteBtnText, emptyStomach === val ? s.siteBtnTextActive : s.siteBtnTextInactive]}>
                    {val ? 'Yes — empty stomach' : 'No — had food/water'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fastingFootnote}>
              Oral semaglutide should be taken 30 min before food or water for proper absorption.
            </Text>
          </Animated.View>
        )}

        {/* ── Batch & Notes (inline, no card) ── */}
        <Animated.View style={fieldsAnim}>
          {!isOral && (
            <TextInput
              style={s.inlineInput}
              placeholder="Batch # (optional)"
              placeholderTextColor={colors.textMuted}
              value={batchNumber}
              onChangeText={setBatchNumber}
              maxLength={30}
              returnKeyType="next"
            />
          )}
          <View style={s.notesRow}>
            <TextInput
              style={[s.inlineInput, s.notesInput]}
              placeholder="Add a note..."
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              maxLength={200}
              multiline
              textAlignVertical="top"
            />
            <VoiceButton onTranscription={handleVoiceTranscription} size="sm" style={{ marginTop: 6 }} />
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Save Button with gradient fade ── */}
      <View style={[s.saveWrapper, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} pointerEvents="box-none">
        <LinearGradient
          colors={['transparent', colors.bg + 'CC', colors.bg]}
          locations={[0, 0.35, 1]}
          style={s.saveFade}
          pointerEvents="none"
        />
        <Animated.View style={saveBtnAnim}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleSave(); }}
            activeOpacity={0.85}
            disabled={loading}
            style={[s.saveBtn, loading && s.saveBtnDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <View style={s.saveBtnInner}>
                <FontAwesome5 name={isOral ? 'pills' : 'syringe'} size={16} color="#FFF" />
                <Text style={s.saveBtnText}>{isOral ? 'Save Dose' : 'Save Injection'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const elevation = cardElevation(c.isDark);
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },

    // ── Header ──
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 4,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: c.textPrimary,
      letterSpacing: -0.4,
    },
    dateLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: c.textMuted,
      letterSpacing: 0.3,
      marginTop: 2,
    },
    headerSpacer: {
      width: 44,
    },

    // ── Scroll ──
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },

    // ── Medication context row ──
    medRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.borderSubtle,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    medRowText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: c.textSecondary,
    },

    // ── Section label ──
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: ORANGE,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 14,
    },

    // ── Site card ──
    siteCard: {
      backgroundColor: c.cardBg,
      borderRadius: 20,
      padding: 20,
      marginBottom: 20,
      ...elevation,
    },

    // ── Rotation recommendation ──
    rotateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rotateText: {
      fontSize: 13,
      fontWeight: '500',
      color: c.textMuted,
    },
    rotateBold: {
      fontWeight: '700',
      color: ORANGE,
    },

    // ── Site grid ──
    siteGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    siteBtn: {
      height: 64,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    siteBtnActive: {
      backgroundColor: ORANGE,
      shadowColor: ORANGE,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 5,
    },
    siteBtnInactive: {
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    siteBtnText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    siteBtnTextActive: {
      color: '#FFFFFF',
    },
    siteBtnTextInactive: {
      color: c.textSecondary,
    },
    recommendedDot: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: ORANGE,
      opacity: 0.6,
    },
    otherBtn: {
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    customSiteInput: {
      marginTop: 10,
      height: 48,
      borderWidth: 1.5,
      borderColor: ORANGE,
      borderRadius: 14,
      paddingHorizontal: 14,
      fontSize: 16,
      color: c.textPrimary,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    },

    // ── Fasting (oral) ──
    fastingQuestion: {
      fontSize: 15,
      fontWeight: '500',
      color: c.textPrimary,
      marginBottom: 14,
      lineHeight: 20,
    },
    fastingOptions: {
      gap: 8,
    },
    fastingBtn: {
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fastingFootnote: {
      fontSize: 13,
      fontWeight: '400',
      color: c.textMuted,
      marginTop: 12,
      lineHeight: 18,
    },

    // ── Inline fields (no card) ──
    inlineInput: {
      fontSize: 16,
      fontWeight: '500',
      color: c.textPrimary,
      height: 44,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    notesRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 4,
    },
    notesInput: {
      flex: 1,
      minHeight: 44,
      height: undefined,
      paddingTop: 12,
    },

    // ── Save button ──
    saveWrapper: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
    },
    saveFade: {
      position: 'absolute',
      top: -40,
      left: 0,
      right: 0,
      height: 40,
    },
    saveBtn: {
      height: 56,
      borderRadius: 18,
      backgroundColor: ORANGE,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: ORANGE,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
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
    saveBtnText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
  });
};
