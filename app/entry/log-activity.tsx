import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBorder } from '@/components/ui/glass-border';
import { useHealthData } from '@/contexts/health-data';
import { useLogStore } from '@/stores/log-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const ORANGE = '#FF742A';
const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 8 } as const, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 };

function clamp(v: number, mn: number, mx: number) { return Math.min(Math.max(v, mn), mx); }

const WORKOUT_TYPES = ['Walking', 'Running', 'Cycling', 'Strength', 'HIIT', 'Yoga', 'Pilates', 'Swimming', 'Other'];

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

// MET values from Compendium of Physical Activities (moderate effort baseline)
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

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  onPress,
  last = false,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
  last?: boolean;
  colors: AppColors;
}) {
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
        style={s.infoRow}
      >
        <Ionicons name={icon as any} size={20} color={colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} style={{ width: 26 }} />
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
        {onPress && <Ionicons name="chevron-forward" size={16} color={colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />}
      </TouchableOpacity>
      {!last && <View style={s.divider} />}
    </>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, unit, colors }: { icon: string; label: string; value: string | number; unit: string; colors: AppColors }) {
  const sc = useMemo(() => createSummaryCardStyles(colors), [colors]);
  return (
    <View style={[sc.card, SHADOW]}>
      <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
      <GlassBorder r={20} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Ionicons name={icon as any} size={18} color={ORANGE} />
        <Text style={sc.label}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        <Text style={sc.value}>{value}</Text>
        <Text style={sc.unit}>{unit}</Text>
      </View>
    </View>
  );
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
        // Tap-to-position: jump to the tapped location on the track
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
      {/* Value display — tap to type */}
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
              fontFamily: 'System',
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
            fontFamily: 'System',
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
            fontFamily: 'System',
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
          fontFamily: 'System',
          marginBottom: 10,
          marginLeft: 4,
        }}>
          {subtitleDerived}
        </Text>
      </TouchableOpacity>

      {/* Track — tap to position or drag */}
      <View
        style={{ height: 36, justifyContent: 'center' }}
        onLayout={e => { trackWidthRef.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}
      >
        {/* Background track */}
        <View style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
        }} />
        {/* Filled portion */}
        <View style={{
          position: 'absolute',
          left: 0,
          width: `${progress * 100}%`,
          height: 6,
          borderRadius: 3,
          backgroundColor: ORANGE,
        }} />
        {/* Thumb */}
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

      {/* Labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {labels.map((l, i) => (
          <Text key={i} style={{
            fontSize: 12,
            fontWeight: '700',
            color: colors.textMuted,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            fontFamily: 'System',
          }}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ─── Workout Type Picker Sheet ────────────────────────────────────────────────

function TypePickerSheet({
  visible,
  current,
  onSave,
  onClose,
  colors,
}: {
  visible: boolean;
  current: string;
  onSave: (t: string) => void;
  onClose: () => void;
  colors: AppColors;
}) {
  const insets = useSafeAreaInsets();
  const [temp, setTemp] = useState(current);
  const tp = useMemo(() => createTypePickerStyles(colors), [colors]);

  function handleDone() {
    onSave(temp);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tp.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={[tp.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={28} />

          <View style={tp.handle} />

          <View style={tp.header}>
            <Text style={tp.title}>Workout Type</Text>
            <TouchableOpacity onPress={handleDone} activeOpacity={0.7} style={tp.doneBtn}>
              <Text style={tp.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={tp.pillRow}>
            {WORKOUT_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setTemp(t)}
                activeOpacity={0.7}
                style={[tp.pill, temp === t && tp.pillSelected]}
              >
                <Text style={[tp.pillText, temp === t && tp.pillTextSelected]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
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
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [stepsInput, setStepsInput]         = useState('');
  const [stepsEdited, setStepsEdited]       = useState(false);
  const [isSubmitting, setIsSubmitting]     = useState(false);

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

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

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
      dispatch({ type: 'LOG_STEPS', steps: stepsValue });
      router.back();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ height: insets.top, backgroundColor: colors.bg }} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.back}>
          <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 22, backgroundColor: colors.borderSubtle }]} />
          <GlassBorder r={22} />
          <Ionicons name="chevron-back" size={22} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
        </TouchableOpacity>
        <Text style={s.title}>Log Activity</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary cards row */}
        <View style={s.cardsRow}>
          <SummaryCard icon="flame-outline" label="Est. Calories" value={estCalories} unit="cal" colors={colors} />
          <SummaryCard icon="time-outline" label="Duration" value={durationMin} unit="min" colors={colors} />
        </View>

        {/* Workout Info */}
        <Text style={s.sectionLabel}>WORKOUT INFO</Text>
        <View style={[s.card, SHADOW]}>
          <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 28, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={28} />
          <InfoRow icon="calendar-outline" label="DATE" value={dateStr} colors={colors} />
          <InfoRow icon="barbell-outline" label="WORKOUT TYPE" value={workoutType} onPress={() => setShowTypePicker(true)} last colors={colors} />
        </View>

        {/* Intensity gauge */}
        <Text style={s.sectionLabel}>INTENSITY</Text>
        <View style={[s.card, SHADOW]}>
          <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 28, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={28} />
          <View style={{ paddingHorizontal: 16 }}>
            <LinearSlider
              value={intensity}
              min={1}
              max={10}
              labels={['Recovery', 'Moderate', 'Max Effort']}
              onChange={setIntensity}
              colors={colors}
            />
          </View>
        </View>

        {/* Duration gauge */}
        <Text style={s.sectionLabel}>DURATION</Text>
        <View style={[s.card, SHADOW]}>
          <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 28, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={28} />
          <View style={{ paddingHorizontal: 16 }}>
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
        </View>

        {/* Steps */}
        <Text style={s.sectionLabel}>STEPS</Text>
        <View style={[s.card, SHADOW]}>
          <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 28, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={28} />
          <View style={s.infoRow}>
            <Ionicons name="footsteps-outline" size={20}
              color={colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
              style={{ width: 26 }} />
            <Text style={s.infoLabel}>STEPS</Text>
            <TextInput
              style={s.stepsInput}
              value={stepsInput}
              onChangeText={handleStepsChange}
              keyboardType="number-pad"
              placeholder="-"
              placeholderTextColor={colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              returnKeyType="done"
              maxLength={6}
            />
          </View>
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={[s.ctaWrap, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={handleLog}
          activeOpacity={0.85}
          disabled={isSubmitting}
          style={[s.logBtn, isSubmitting && { opacity: 0.75 }]}
        >
          {isSubmitting
            ? <ActivityIndicator color={colors.bg} size="small" />
            : <Text style={s.logBtnText}>Log Activity</Text>
          }
        </TouchableOpacity>
      </View>

      <TypePickerSheet
        visible={showTypePicker}
        current={workoutType}
        onSave={setWorkoutType}
        onClose={() => setShowTypePicker(false)}
        colors={colors}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  back: {
    width: 44, height: 44, borderRadius: 22,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    ...SHADOW, shadowOpacity: 0.08, shadowRadius: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: c.textPrimary, fontFamily: 'System' },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: c.textMuted,
    letterSpacing: 1.2,
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
    fontFamily: 'System',
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: c.surface,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  infoLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: c.textSecondary,
    letterSpacing: 0.8,
    fontFamily: 'System',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: c.textPrimary,
    maxWidth: 180,
    fontFamily: 'System',
  },
  divider: {
    height: 1,
    backgroundColor: c.borderSubtle,
    marginHorizontal: 16,
  },
  stepsInput: {
    fontSize: 16,
    fontWeight: '500',
    color: c.textPrimary,
    textAlign: 'right',
    minWidth: 80,
    fontFamily: 'System',
  },
  ctaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: c.bg,
  },
  logBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  logBtnText: {
    fontSize: 19,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
    fontFamily: 'System',
  },
});

// ─── Summary card styles ──────────────────────────────────────────────────────

const createSummaryCardStyles = (c: AppColors) => StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
    backgroundColor: c.surface,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: c.textSecondary,
    letterSpacing: 0.3,
    fontFamily: 'System',
  },
  value: {
    fontSize: 30,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -1,
    fontFamily: 'System',
  },
  unit: {
    fontSize: 15,
    fontWeight: '500',
    color: c.textSecondary,
    marginBottom: 4,
    fontFamily: 'System',
  },
});

// ─── Type picker sheet styles ─────────────────────────────────────────────────

const createTypePickerStyles = (c: AppColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: c.surface,
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  handle: {
    width: 44,
    height: 4,
    backgroundColor: c.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: c.textPrimary,
    fontFamily: 'System',
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,116,42,0.15)',
  },
  doneBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: ORANGE,
    fontFamily: 'System',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 4,
    paddingBottom: 8,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: c.borderSubtle,
    borderWidth: 1,
    borderColor: c.border,
  },
  pillSelected: {
    backgroundColor: 'rgba(255,116,42,0.2)',
    borderColor: ORANGE,
  },
  pillText: {
    fontSize: 17,
    fontWeight: '600',
    color: c.textSecondary,
    fontFamily: 'System',
  },
  pillTextSelected: {
    color: ORANGE,
    fontWeight: '700',
  },
});
