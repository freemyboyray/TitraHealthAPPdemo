import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

import { useHealthData } from '@/contexts/health-data';
import { useLogStore } from '@/stores/log-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { cardElevation } from '@/constants/theme';
import { VoiceButton } from '@/components/ui/voice-button';
import { parseVoiceLog, type VoiceActivityResult } from '@/lib/openai';

// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE = '#FF742A';
const SCREEN_WIDTH = Dimensions.get('window').width;
const USE_THREE_COLUMNS = SCREEN_WIDTH >= 375;

function clamp(v: number, mn: number, mx: number) { return Math.min(Math.max(v, mn), mx); }

const WORKOUT_TYPE_DATA = [
  { key: 'Walking',  label: 'Walking',  icon: 'walk-outline' },
  { key: 'Running',  label: 'Running',  icon: 'fitness-outline' },
  { key: 'Cycling',  label: 'Cycling',  icon: 'bicycle-outline' },
  { key: 'Strength', label: 'Strength', icon: 'barbell-outline' },
  { key: 'HIIT',     label: 'HIIT',     icon: 'flash-outline' },
  { key: 'Yoga',     label: 'Yoga',     icon: 'body-outline' },
  { key: 'Pilates',  label: 'Pilates',  icon: 'fitness-outline' },
  { key: 'Swimming', label: 'Swimming', icon: 'water-outline' },
  { key: 'Other',    label: 'Other',    icon: 'ellipsis-horizontal-outline' },
] as const;

const STEPS_PER_MIN: Record<string, number> = {
  Walking:  100,
  Running:  160,
  Cycling:    0,
  Strength:  30,
  HIIT:      30,
  Yoga:      30,
  Pilates:   30,
  Swimming:  30,
  Other:     30,
};

const MET_VALUES: Record<string, number> = {
  Walking:  3.8,
  Running:  9.8,
  Cycling:  7.5,
  Strength: 4.5,
  HIIT:    10.0,
  Yoga:     2.8,
  Pilates:  3.0,
  Swimming: 7.0,
  Other:    4.0,
};

// ─── LinearSlider ─────────────────────────────────────────────────────────────

interface LinearSliderProps {
  value: number;
  min: number;
  max: number;
  unit?: string;
  labels: string[];
  onChange: (v: number) => void;
  colors: AppColors;
}

function LinearSlider({ value, min, max, unit, labels, onChange, colors }: LinearSliderProps) {
  const trackWidthRef = useRef(0);
  const panStartValueRef = useRef(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastHapticRef = useRef(value);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const progress = clamp((value - min) / (max - min), 0, 1);

  const subtitleDerived =
    value <= min + (max - min) * 0.35 ? labels[0]
    : value <= min + (max - min) * 0.7  ? labels[1]
    : labels[2] ?? labels[labels.length - 1];

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: (evt) => {
        const tw = trackWidthRef.current;
        if (tw > 0) {
          const tapPct = evt.nativeEvent.locationX / tw;
          const next = Math.round(clamp(min + tapPct * (max - min), min, max));
          onChangeRef.current(next);
          if (next !== lastHapticRef.current) {
            lastHapticRef.current = next;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          panStartValueRef.current = next;
        } else {
          panStartValueRef.current = valueRef.current;
        }
      },
      onPanResponderMove: (_, gs) => {
        if (!trackWidthRef.current) return;
        const delta = (gs.dx / trackWidthRef.current) * (max - min);
        const next = Math.round(clamp(panStartValueRef.current + delta, min, max));
        onChangeRef.current(next);
        if (next !== lastHapticRef.current) {
          lastHapticRef.current = next;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
    })
  ).current;

  function startEditing() {
    setEditText(String(value));
    setEditing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function commitEdit() {
    const parsed = parseInt(editText, 10);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed, min, max));
    }
    setEditing(false);
  }

  const isDark = colors.isDark;

  return (
    <View style={{ paddingVertical: 20, paddingHorizontal: 4 }}>
      <TouchableOpacity
        onPress={startEditing}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 16 }}
      >
        {editing ? (
          <TextInput
            style={{
              fontSize: 52,
              fontWeight: '900',
              color: colors.textPrimary,
              lineHeight: 56,
              letterSpacing: -2,
              minWidth: 60,
              borderBottomWidth: 2,
              borderBottomColor: ORANGE,
              paddingBottom: 2,
            }}
            value={editText}
            onChangeText={t => setEditText(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={commitEdit}
            onBlur={commitEdit}
            maxLength={String(max).length}
          />
        ) : (
          <Text style={{
            fontSize: 52,
            fontWeight: '900',
            color: colors.textPrimary,
            lineHeight: 56,
            letterSpacing: -2,
          }}>
            {value}
          </Text>
        )}
        {unit && (
          <Text style={{
            fontSize: 20,
            fontWeight: '700',
            color: ORANGE,
            marginBottom: 8,
          }}>
            {unit}
          </Text>
        )}
        <Text style={{
          fontSize: 13,
          fontWeight: '700',
          color: colors.textMuted,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: 10,
          marginLeft: 4,
        }}>
          {subtitleDerived}
        </Text>
      </TouchableOpacity>

      <View
        style={{ height: 36, justifyContent: 'center' }}
        onLayout={e => { trackWidthRef.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}
      >
        <View style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
        }} />
        <View style={{
          position: 'absolute',
          left: 0,
          width: `${progress * 100}%`,
          height: 6,
          borderRadius: 3,
          backgroundColor: ORANGE,
        }} />
        <View style={{
          position: 'absolute',
          left: `${progress * 100}%`,
          marginLeft: -14,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: '#FFFFFF',
          borderWidth: 2.5,
          borderColor: ORANGE,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
          elevation: 4,
        }} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {labels.map((l, i) => (
          <Text key={i} style={{
            fontSize: 12,
            fontWeight: '700',
            color: colors.textMuted,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LogActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dispatch, profile } = useHealthData();
  const { addActivityLog } = useLogStore();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [workoutType, setWorkoutType]       = useState('Walking');
  const [durationMin, setDurationMin]       = useState(30);
  const [intensity, setIntensity]           = useState(5);
  const [stepsInput, setStepsInput]         = useState('');
  const [stepsEdited, setStepsEdited]       = useState(false);
  const [editingSteps, setEditingSteps]     = useState(false);
  const [notes, setNotes]                   = useState('');
  const [isSubmitting, setIsSubmitting]     = useState(false);

  // ── Entrance animations ──────────────────────────────────────────────────
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(12);
  const typeOpacity = useSharedValue(0);
  const typeY = useSharedValue(16);
  const summaryOpacity = useSharedValue(0);
  const summaryY = useSharedValue(12);
  const slidersOpacity = useSharedValue(0);
  const slidersY = useSharedValue(24);
  const fieldsOpacity = useSharedValue(0);
  const fieldsY = useSharedValue(16);
  const ctaOpacity = useSharedValue(0);
  const ctaY = useSharedValue(40);

  useEffect(() => {
    const ease = { duration: 400, easing: Easing.out(Easing.quad) };
    headerOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
    headerY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
    typeOpacity.value = withDelay(100, withTiming(1, ease));
    typeY.value = withDelay(100, withTiming(0, ease));
    summaryOpacity.value = withDelay(200, withTiming(1, ease));
    summaryY.value = withDelay(200, withTiming(0, ease));
    slidersOpacity.value = withDelay(300, withTiming(1, ease));
    slidersY.value = withDelay(300, withTiming(0, ease));
    fieldsOpacity.value = withDelay(400, withTiming(1, ease));
    fieldsY.value = withDelay(400, withTiming(0, ease));
    ctaOpacity.value = withDelay(500, withTiming(1, ease));
    ctaY.value = withDelay(500, withTiming(0, ease));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const headerAnim = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }));
  const typeAnim = useAnimatedStyle(() => ({
    opacity: typeOpacity.value,
    transform: [{ translateY: typeY.value }],
  }));
  const summaryAnim = useAnimatedStyle(() => ({
    opacity: summaryOpacity.value,
    transform: [{ translateY: summaryY.value }],
  }));
  const slidersAnim = useAnimatedStyle(() => ({
    opacity: slidersOpacity.value,
    transform: [{ translateY: slidersY.value }],
  }));
  const fieldsAnim = useAnimatedStyle(() => ({
    opacity: fieldsOpacity.value,
    transform: [{ translateY: fieldsY.value }],
  }));
  const ctaAnim = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaY.value }],
  }));

  // ── Steps auto-calculation ──────────────────────────────────────────────
  useEffect(() => {
    if (stepsEdited) return;
    const rate = STEPS_PER_MIN[workoutType] ?? 30;
    const estimated = Math.round(durationMin * rate);
    setStepsInput(estimated > 0 ? String(estimated) : '');
  }, [workoutType, durationMin, stepsEdited]);

  function handleStepsChange(text: string) {
    setStepsEdited(true);
    setStepsInput(text.replace(/[^0-9]/g, ''));
  }

  const stepsValue = stepsInput === '' ? 0 : parseInt(stepsInput, 10);
  const weightKg = profile.weightKg > 0 ? profile.weightKg : 75;
  const met = MET_VALUES[workoutType] ?? 4.0;
  const intensityMultiplier = 0.75 + (intensity - 1) * (0.60 / 9);
  const estCalories = Math.round(met * intensityMultiplier * weightKg * (durationMin / 60));

  // ── Voice transcription ─────────────────────────────────────────────────
  async function handleVoiceTranscription(text: string) {
    try {
      const result = await parseVoiceLog('activity', text) as VoiceActivityResult;
      if (result.exercise_type) {
        const typeLower = result.exercise_type.toLowerCase();
        const matched = WORKOUT_TYPE_DATA.find(t =>
          t.key.toLowerCase() === typeLower ||
          t.label.toLowerCase().includes(typeLower)
        );
        if (matched) setWorkoutType(matched.key);
      }
      if (result.duration_min && result.duration_min > 0) {
        setDurationMin(clamp(result.duration_min, 0, 120));
      }
      if (result.intensity) {
        const map: Record<string, number> = { low: 3, moderate: 5, high: 8 };
        setIntensity(map[result.intensity] ?? 5);
      }
      if (result.notes) setNotes(result.notes);
    } catch {
      Alert.alert('Voice Input', 'Could not parse your activity details. Try saying the workout type, duration, and intensity.');
    }
  }

  // ── Save handler ────────────────────────────────────────────────────────
  async function handleLog() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const intensityLevel = intensity <= 3 ? 'low' : intensity <= 7 ? 'moderate' : 'high';
      await addActivityLog(workoutType, durationMin, intensityLevel, stepsValue, estCalories);
      const { error } = useLogStore.getState();
      if (error) {
        Alert.alert('Could not save activity', error);
        return;
      }
      // TODO: persist notes once activity_logs.notes column is added
      dispatch({ type: 'LOG_STEPS', steps: stepsValue });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setIsSubmitting(false);
    }
  }

  const cols = USE_THREE_COLUMNS ? 3 : 2;
  const gridGap = 10;
  const gridItemWidth = (SCREEN_WIDTH - 80 - gridGap * (cols - 1)) / cols;

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
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Log Activity</Text>
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
        {/* ── Workout Type Grid ── */}
        <Animated.View style={typeAnim}>
          <Text style={s.sectionLabel}>WORKOUT TYPE</Text>
          <View style={s.typeCard}>
            <View style={s.typeGrid}>
              {WORKOUT_TYPE_DATA.map((t) => {
                const active = t.key === workoutType;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWorkoutType(t.key); }}
                    activeOpacity={0.75}
                    style={[
                      s.typeBtn,
                      { width: gridItemWidth },
                      active ? s.typeBtnActive : s.typeBtnInactive,
                    ]}
                    accessibilityLabel={`${t.label}${active ? ', selected' : ''}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={t.icon as any}
                      size={20}
                      color={active ? '#FFFFFF' : colors.textSecondary}
                      style={{ marginBottom: 4 }}
                    />
                    <Text style={[s.typeBtnText, active ? s.typeBtnTextActive : s.typeBtnTextInactive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* ── Live Summary Row ── */}
        <Animated.View style={summaryAnim}>
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Ionicons name="flame-outline" size={13} color={colors.textMuted} />
              <Text style={s.summaryText}>{estCalories} cal</Text>
            </View>
            <Text style={s.summaryDot}>·</Text>
            <View style={s.summaryItem}>
              <Ionicons name="time-outline" size={13} color={colors.textMuted} />
              <Text style={s.summaryText}>{durationMin} min</Text>
            </View>
            <Text style={s.summaryDot}>·</Text>
            <TouchableOpacity
              style={s.summaryItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEditingSteps(true);
              }}
              activeOpacity={0.7}
              accessibilityLabel={`Steps: ${stepsValue}. Tap to edit`}
              accessibilityRole="button"
            >
              <Ionicons name="footsteps-outline" size={13} color={colors.textMuted} />
              {editingSteps ? (
                <TextInput
                  style={s.stepsInlineInput}
                  value={stepsInput}
                  onChangeText={handleStepsChange}
                  keyboardType="number-pad"
                  autoFocus
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={() => setEditingSteps(false)}
                  onBlur={() => setEditingSteps(false)}
                  maxLength={6}
                />
              ) : (
                <Text style={s.summaryText}>{stepsValue} steps</Text>
              )}
              {!stepsEdited && !editingSteps && (
                <View style={s.autoBadge}>
                  <Text style={s.autoBadgeText}>auto</Text>
                </View>
              )}
            </TouchableOpacity>
            {stepsEdited && !editingSteps && (
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStepsEdited(false); }}
                activeOpacity={0.7}
              >
                <Text style={s.resetLink}>reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ── Duration & Intensity ── */}
        <Animated.View style={slidersAnim}>
          <Text style={s.sectionLabel}>DURATION & INTENSITY</Text>
          <View style={s.slidersCard}>
            <LinearSlider
              value={durationMin}
              min={0}
              max={120}
              unit="min"
              labels={['0', '60 min', '120 min']}
              onChange={setDurationMin}
              colors={colors}
            />
            <View style={s.sliderDivider} />
            <LinearSlider
              value={intensity}
              min={1}
              max={10}
              labels={['Recovery', 'Moderate', 'Max Effort']}
              onChange={setIntensity}
              colors={colors}
            />
          </View>
        </Animated.View>

        {/* ── Notes + Voice ── */}
        <Animated.View style={fieldsAnim}>
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
              accessibilityLabel="Activity notes"
            />
            <VoiceButton onTranscription={handleVoiceTranscription} size="sm" style={{ marginTop: 6 }} />
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── CTA with gradient fade ── */}
      <View style={[s.saveWrapper, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} pointerEvents="box-none">
        <LinearGradient
          colors={['transparent', colors.bg + 'CC', colors.bg]}
          locations={[0, 0.35, 1]}
          style={s.saveFade}
          pointerEvents="none"
        />
        <Animated.View style={ctaAnim}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleLog(); }}
            activeOpacity={0.85}
            disabled={isSubmitting}
            style={[s.saveBtn, isSubmitting && s.saveBtnDisabled]}
            accessibilityLabel="Save activity"
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <View style={s.saveBtnInner}>
                <Ionicons name="fitness-outline" size={16} color="#FFF" />
                <Text style={s.saveBtnText}>Log Activity</Text>
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

    // ── Section label ──
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: ORANGE,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 14,
    },

    // ── Workout type card + grid ──
    typeCard: {
      backgroundColor: c.cardBg,
      borderRadius: 20,
      padding: 20,
      ...elevation,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    typeBtn: {
      height: 72,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    typeBtnActive: {
      backgroundColor: ORANGE,
      shadowColor: ORANGE,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 5,
    },
    typeBtnInactive: {
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    typeBtnText: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    typeBtnTextActive: {
      color: '#FFFFFF',
    },
    typeBtnTextInactive: {
      color: c.textSecondary,
    },

    // ── Live summary row ──
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.borderSubtle,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginTop: 16,
      marginBottom: 8,
      gap: 8,
    },
    summaryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    summaryText: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textSecondary,
    },
    summaryDot: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textMuted,
    },
    stepsInlineInput: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textPrimary,
      minWidth: 50,
      borderBottomWidth: 1,
      borderBottomColor: ORANGE,
      paddingVertical: 0,
      paddingHorizontal: 2,
    },
    autoBadge: {
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    autoBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    resetLink: {
      fontSize: 13,
      fontWeight: '600',
      color: ORANGE,
    },

    // ── Duration & Intensity card ──
    slidersCard: {
      backgroundColor: c.cardBg,
      borderRadius: 20,
      padding: 20,
      marginBottom: 20,
      ...elevation,
    },
    sliderDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.borderSubtle,
      marginVertical: 4,
    },

    // ── Notes (inline, no card) ──
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
