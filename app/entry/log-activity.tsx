import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

import { useHealthData } from '@/contexts/health-data';
import { useLogStore } from '@/stores/log-store';
import { useUiStore } from '@/stores/ui-store';
import { usePostHog } from '@/lib/posthog';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { cardElevation } from '@/constants/theme';
import { VoiceButton } from '@/components/ui/voice-button';
import { parseVoiceLog, type VoiceActivityResult } from '@/lib/openai';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Clock, Dumbbell, Flame, Footprints } from 'lucide-react-native';
import { LucideIconByName } from '@/lib/lucide-icon-map';
import { useActivityPicker } from '@/stores/activity-picker-store';
import {
  buildActivityItems,
  CUSTOM_ACTIVITIES_KEY,
  type CustomActivity,
} from '@/constants/activities';

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;

function clamp(v: number, mn: number, mx: number) { return Math.min(Math.max(v, mn), mx); }

// Intensity is a 1–10 slider; these derive its label + the stored bucket and
// scale the calorie estimate (mirrors the old 0.75–1.35 envelope).
function intensityLabel(v: number): string {
  return v <= 3 ? 'Recovery' : v <= 7 ? 'Moderate' : 'Max effort';
}
function intensityDb(v: number): 'low' | 'moderate' | 'high' {
  return v <= 3 ? 'low' : v <= 7 ? 'moderate' : 'high';
}
function intensityMult(v: number): number {
  return 0.75 + (v - 1) * (0.60 / 9);
}

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
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(0);
  const trackXRef = useRef(0);
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

  // Measure the track's absolute on-screen position so we can map a touch's
  // pageX → value. locationX can't be used here because the track has child
  // views (fill bar + thumb); a tap landing on a child reports locationX
  // relative to that child, which would snap the value to the wrong spot.
  const measureTrack = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      trackXRef.current = x;
      trackWidthRef.current = w;
    });
  };

  const applyPageX = (pageX: number) => {
    const tw = trackWidthRef.current;
    if (tw <= 0) return;
    const pct = clamp((pageX - trackXRef.current) / tw, 0, 1);
    const next = Math.round(min + pct * (max - min));
    onChangeRef.current(next);
    if (next !== lastHapticRef.current) {
      lastHapticRef.current = next;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: (evt) => {
        measureTrack();
        applyPageX(evt.nativeEvent.pageX);
      },
      onPanResponderMove: (evt) => {
        applyPageX(evt.nativeEvent.pageX);
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
              borderBottomColor: colors.orange,
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
            color: colors.orange,
            marginBottom: 8,
          }}>
            {unit}
          </Text>
        )}
        <Text style={{
          fontSize: 14,
          fontWeight: '600',
          color: colors.textMuted,
          marginBottom: 10,
          marginLeft: 4,
        }}>
          {subtitleDerived}
        </Text>
      </TouchableOpacity>

      <View
        ref={trackRef}
        style={{ height: 36, justifyContent: 'center' }}
        onLayout={e => { trackWidthRef.current = e.nativeEvent.layout.width; measureTrack(); }}
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
          backgroundColor: colors.orange,
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
          borderColor: colors.orange,
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
            fontWeight: '600',
            color: colors.textMuted,
          }}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Today" or "Mon, Jun 9" for the selected calendar day. */
function dayLabel(d: Date): string {
  if (localYMD(d) === localYMD(new Date())) return 'Today';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Never allow an activity to be logged on a future day. */
function clampToToday(d: Date): Date {
  return d.getTime() > Date.now() ? new Date() : d;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LogActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dispatch, profile } = useHealthData();
  const { addActivityLog } = useLogStore();
  const posthog = usePostHog();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const pendingKey = useActivityPicker((st) => st.pendingKey);
  const setPendingKey = useActivityPicker((st) => st.setPendingKey);

  const [selectedKey, setSelectedKey]       = useState<string | null>(null);
  const [intensity, setIntensity]           = useState(5);
  const [durationMin, setDurationMin]       = useState(30);
  const [stepsInput, setStepsInput]         = useState('');
  const [stepsEdited, setStepsEdited]       = useState(false);
  const [editingSteps, setEditingSteps]     = useState(false);
  const [notes, setNotes]                   = useState('');
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [customActivities, setCustomActivities] = useState<CustomActivity[]>([]);
  const [loggedAt, setLoggedAt]             = useState<Date>(() => new Date());
  const [whenOpen, setWhenOpen]             = useState(false);            // iOS: inline picker panel
  const [androidPicker, setAndroidPicker]   = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Reload custom exercises + adopt any pending pick from the picker page.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(CUSTOM_ACTIVITIES_KEY).then((raw) => {
        if (!active || !raw) return;
        try { setCustomActivities(JSON.parse(raw)); } catch { /* ignore corrupt cache */ }
      });
      if (pendingKey != null) {
        setSelectedKey(pendingKey);
        setPendingKey(null);
      }
      return () => { active = false; };
    }, [pendingKey, setPendingKey]),
  );

  const allItems = buildActivityItems(customActivities);
  const selected = selectedKey ? allItems.find((i) => i.key === selectedKey) ?? null : null;

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

  const headerAnim = useAnimatedStyle(() => ({ opacity: headerOpacity.value, transform: [{ translateY: headerY.value }] }));
  const typeAnim = useAnimatedStyle(() => ({ opacity: typeOpacity.value, transform: [{ translateY: typeY.value }] }));
  const summaryAnim = useAnimatedStyle(() => ({ opacity: summaryOpacity.value, transform: [{ translateY: summaryY.value }] }));
  const slidersAnim = useAnimatedStyle(() => ({ opacity: slidersOpacity.value, transform: [{ translateY: slidersY.value }] }));
  const fieldsAnim = useAnimatedStyle(() => ({ opacity: fieldsOpacity.value, transform: [{ translateY: fieldsY.value }] }));
  const ctaAnim = useAnimatedStyle(() => ({ opacity: ctaOpacity.value, transform: [{ translateY: ctaY.value }] }));

  const stepsPerMin = selected?.stepsPerMin ?? 0;
  const isStepBased = stepsPerMin > 0;

  // ── Steps auto-calculation ──────────────────────────────────────────────
  useEffect(() => {
    if (stepsPerMin === 0) {
      // Non-step activity: clear any steps and drop the manual-edit flag.
      setStepsInput('');
      setStepsEdited(false);
      return;
    }
    if (stepsEdited) return;
    setStepsInput(String(Math.round(durationMin * stepsPerMin)));
  }, [stepsPerMin, durationMin, stepsEdited]);

  function handleStepsChange(text: string) {
    setStepsEdited(true);
    setStepsInput(text.replace(/[^0-9]/g, ''));
  }

  const stepsValue = stepsInput === '' ? 0 : parseInt(stepsInput, 10);
  const weightKg = profile.weightKg > 0 ? profile.weightKg : 75;
  const met = selected?.met ?? 0;
  const estCalories = Math.round(met * intensityMult(intensity) * weightKg * (durationMin / 60));

  // ── Voice transcription ─────────────────────────────────────────────────
  async function handleVoiceTranscription(text: string) {
    try {
      const result = await parseVoiceLog('activity', text) as VoiceActivityResult;
      if (result.exercise_type) {
        const typeLower = result.exercise_type.toLowerCase();
        const matched = allItems.find((t) =>
          t.key.toLowerCase() === typeLower ||
          t.label.toLowerCase().includes(typeLower)
        );
        if (matched) setSelectedKey(matched.key);
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
    if (isSubmitting || !selected) return;
    setIsSubmitting(true);
    try {
      await addActivityLog(selected.label, durationMin, intensityDb(intensity), stepsValue, estCalories, loggedAt);
      const { error } = useLogStore.getState();
      if (error) {
        Alert.alert('Could not save activity', error);
        return;
      }
      // TODO: persist notes once activity_logs.notes column is added
      dispatch({ type: 'LOG_STEPS', steps: stepsValue });
      posthog?.capture('activity_logged', {
        type: selected.label,
        duration_min: durationMin,
        intensity: intensity,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      useUiStore.getState().showLogSuccess({
        title: 'Activity logged',
        subtitle: `${selected.label}, ${durationMin} min`,
      });
      router.back();
    } finally {
      setIsSubmitting(false);
    }
  }

  function openPicker() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/entry/select-activity' as any);
  }

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
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Log Activity</Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (Platform.OS === 'android') setAndroidPicker(true);
              else setWhenOpen(v => !v);
            }}
            activeOpacity={0.7}
            hitSlop={8}
            style={s.dateChip}
            accessibilityLabel={`Logged ${dayLabel(loggedAt)}. Tap to change the date`}
            accessibilityRole="button"
          >
            <Calendar size={13} color={colors.textMuted} />
            <Text style={s.dateLabel}>{dayLabel(loggedAt)}</Text>
            <ChevronDown size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={s.headerSpacer} />
      </Animated.View>

      {/* iOS inline date picker */}
      {whenOpen && Platform.OS === 'ios' && (
        <Animated.View
          style={s.pickerCard}
          entering={FadeIn.duration(550).easing(Easing.out(Easing.cubic))}
          exiting={FadeOut.duration(350).easing(Easing.in(Easing.cubic))}
        >
          <DateTimePicker
            value={loggedAt}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            onChange={(_, d) => { if (d) setLoggedAt(clampToToday(d)); }}
            themeVariant={colors.isDark ? 'dark' : 'light'}
            textColor={colors.textPrimary}
            style={{ alignSelf: 'center' }}
          />
        </Animated.View>
      )}

      {/* Android date dialog */}
      {Platform.OS === 'android' && androidPicker && (
        <DateTimePicker
          value={loggedAt}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, d) => {
            setAndroidPicker(false);
            if (event.type === 'set' && d) setLoggedAt(clampToToday(d));
          }}
        />
      )}

      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Workout type selector ── */}
        <Animated.View style={typeAnim}>
          <Text style={s.sectionLabel}>Workout type</Text>
          <TouchableOpacity
            style={s.typeSelector}
            onPress={openPicker}
            activeOpacity={0.8}
            accessibilityLabel={selected ? `Workout type: ${selected.label}. Tap to change.` : 'Choose workout type'}
            accessibilityRole="button"
          >
            {selected ? (
              <View style={s.typeSelectorInner}>
                <View style={s.typeSelectorIcon}>
                  <LucideIconByName name={selected.icon} size={22} color={colors.textPrimary} />
                </View>
                <Text style={s.typeSelectorLabel}>{selected.label}</Text>
              </View>
            ) : (
              <Text style={s.typeSelectorPlaceholder}>Choose workout type</Text>
            )}
            <ChevronRight size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Calorie hero (once a type is chosen) ── */}
        {selected && (
          <Animated.View style={summaryAnim}>
            <View style={s.heroCard}>
              <View style={s.heroIcon}>
                <Flame size={20} color={colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.heroValueRow}>
                  <Text style={s.heroValue}>{estCalories}</Text>
                  <Text style={s.heroUnit}>cal</Text>
                </View>
                <View style={s.heroChips}>
                  <View style={s.heroChip}>
                    <Clock size={12} color={colors.textMuted} />
                    <Text style={s.heroChipText}>{durationMin} min</Text>
                  </View>
                  <View style={s.heroChip}>
                    <Text style={s.heroChipText}>{intensityLabel(intensity)}</Text>
                  </View>
                  {isStepBased && (
                    <TouchableOpacity
                      style={s.heroChip}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEditingSteps(true); }}
                      activeOpacity={0.7}
                      accessibilityLabel={`Steps: ${stepsValue}. Tap to edit`}
                      accessibilityRole="button"
                    >
                      <Footprints size={12} color={colors.textMuted} />
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
                        <Text style={s.heroChipText}>{stepsValue} steps</Text>
                      )}
                      {!stepsEdited && !editingSteps && (
                        <View style={s.autoBadge}><Text style={s.autoBadgeText}>Auto</Text></View>
                      )}
                    </TouchableOpacity>
                  )}
                  {isStepBased && stepsEdited && !editingSteps && (
                    <TouchableOpacity
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStepsEdited(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={s.resetLink}>Reset</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Intensity ── */}
        <Animated.View style={slidersAnim}>
          <Text style={s.sectionLabel}>Intensity</Text>
          <View style={s.slidersCard}>
            <LinearSlider
              value={intensity}
              min={1}
              max={10}
              labels={['Recovery', 'Moderate', 'Max effort']}
              onChange={setIntensity}
              colors={colors}
            />
          </View>

          {/* ── Duration ── */}
          <Text style={[s.sectionLabel, { marginTop: 4 }]}>Duration</Text>
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
              onFocus={() => {
                // Keep the note field above the keyboard — KeyboardAvoidingView
                // shrinks the view, but the field is the last thing in the
                // scroll, so nudge it fully into view once the keyboard settles.
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
              }}
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
            disabled={isSubmitting || !selected}
            style={[s.saveBtn, (isSubmitting || !selected) && s.saveBtnDisabled]}
            accessibilityLabel="Save activity"
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <View style={s.saveBtnInner}>
                <Dumbbell size={16} color="#FFF" />
                <Text style={s.saveBtnText}>{selected ? 'Log Activity' : 'Choose a workout type'}</Text>
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
    dateChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 3,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    dateLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textMuted,
      letterSpacing: 0.1,
    },
    pickerCard: {
      marginHorizontal: 20,
      marginTop: 8,
      borderRadius: 16,
      paddingVertical: 4,
      backgroundColor: c.cardBg,
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

    // ── Section heading (sentence case, normal heading) ──
    sectionLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
      letterSpacing: -0.2,
      marginBottom: 10,
    },

    // ── Workout type selector ──
    typeSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.cardBg,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 18,
      marginBottom: 24,
      ...elevation,
    },
    typeSelectorInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    typeSelectorIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    typeSelectorLabel: {
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
      letterSpacing: -0.3,
    },
    typeSelectorPlaceholder: {
      fontSize: 17,
      fontWeight: '600',
      color: c.textMuted,
    },

    // ── Calorie hero ──
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.cardBg,
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 18,
      marginBottom: 24,
      ...elevation,
    },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    heroValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    heroValue: {
      fontSize: 34,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -1,
    },
    heroUnit: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textMuted,
    },
    heroChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    heroChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.borderSubtle,
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    heroChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
    },
    stepsInlineInput: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textPrimary,
      minWidth: 44,
      borderBottomWidth: 1,
      borderBottomColor: c.orange,
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
    },
    resetLink: {
      fontSize: 13,
      fontWeight: '600',
      color: c.orange,
    },

    // ── Slider cards ──
    slidersCard: {
      backgroundColor: c.cardBg,
      borderRadius: 20,
      padding: 20,
      marginBottom: 20,
      ...elevation,
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
      backgroundColor: c.orange,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.orange,
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
