import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { GlassBorder } from '@/components/ui/glass-border';
import { useHealthData } from '@/contexts/health-data';
import { useLogStore } from '@/stores/log-store';
import { VoiceButton } from '@/components/ui/voice-button';
import { parseVoiceLog, type VoiceActivityResult } from '@/lib/openai';

const BG     = '#000000';
const ORANGE = '#FF742A';
const DARK   = '#FFFFFF';
const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 8 } as const, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 };

function clamp(v: number, mn: number, mx: number) { return Math.min(Math.max(v, mn), mx); }

const WORKOUT_TYPES = ['Walking', 'Running', 'Cycling', 'Strength', 'HIIT', 'Yoga', 'Pilates', 'Swimming', 'Other'];

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  onPress,
  last = false,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
        style={s.infoRow}
      >
        <Ionicons name={icon as any} size={20} color="rgba(255,255,255,0.5)" style={{ width: 26 }} />
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
        {onPress && <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />}
      </TouchableOpacity>
      {!last && <View style={s.divider} />}
    </>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, unit }: { icon: string; label: string; value: string | number; unit: string }) {
  return (
    <View style={[sc.card, SHADOW]}>
      <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
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

// ─── ArcGauge ────────────────────────────────────────────────────────────────

interface ArcGaugeProps {
  value: number;
  min: number;
  max: number;
  unit?: string;
  labels: string[];
  onChange: (v: number) => void;
}

function ArcGauge({ value, min, max, unit, labels, onChange }: ArcGaugeProps) {
  const W = 280, H = 160, cx = 140, cy = 140, R = 110;
  const progress = clamp((value - min) / (max - min), 0, 1);
  const angle = -Math.PI + progress * Math.PI;
  const tx = cx + R * Math.cos(angle);
  const ty = cy + R * Math.sin(angle);
  const largeArc = progress > 0.5 ? 1 : 0;
  const bgPath = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  const progPath = progress > 0.005
    ? `M ${cx - R} ${cy} A ${R} ${R} 0 ${largeArc} 1 ${tx.toFixed(2)} ${ty.toFixed(2)}`
    : null;

  const containerWidthRef = useRef(0);
  const panStartRef = useRef(progress);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const subtitleDerived =
    value <= min + (max - min) * 0.35 ? labels[0]
    : value <= min + (max - min) * 0.7  ? labels[1]
    : labels[2] ?? labels[labels.length - 1];

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: () => {
        panStartRef.current = clamp((valueRef.current - min) / (max - min), 0, 1);
      },
      onPanResponderMove: (_, gs) => {
        if (!containerWidthRef.current) return;
        const p = clamp(panStartRef.current + gs.dx / containerWidthRef.current, 0, 1);
        onChangeRef.current(Math.round(min + p * (max - min)));
      },
    })
  ).current;

  return (
    <View
      style={{ paddingVertical: 16 }}
      onLayout={e => { containerWidthRef.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
    >
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={bgPath} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={10} strokeLinecap="round" />
        {progPath && (
          <Path d={progPath} fill="none" stroke={ORANGE} strokeWidth={10} strokeLinecap="round" />
        )}
        <Circle cx={tx} cy={ty} r={8} fill="white" stroke={ORANGE} strokeWidth={2.5} />
      </Svg>

      <View style={ag.center}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
          <Text style={ag.bigValue}>{value}</Text>
          {unit && <Text style={ag.unitText}>{unit}</Text>}
        </View>
        <Text style={ag.subtitle}>{subtitleDerived}</Text>
      </View>

      <View style={ag.labelsRow}>
        {labels.map((l, i) => (
          <Text key={i} style={ag.labelText}>{l}</Text>
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
}: {
  visible: boolean;
  current: string;
  onSave: (t: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [temp, setTemp] = useState(current);

  function handleDone() {
    onSave(temp);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={tp.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={[tp.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
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
  const { dispatch } = useHealthData();
  const { loading, addActivityLog } = useLogStore();

  const [workoutType, setWorkoutType]       = useState('Walking');
  const [durationMin, setDurationMin]       = useState(30);
  const [intensity, setIntensity]           = useState(5);
  const [showTypePicker, setShowTypePicker] = useState(false);

  async function handleVoiceTranscription(text: string) {
    try {
      const result = await parseVoiceLog('activity', text) as VoiceActivityResult;
      if (result.exercise_type) {
        const matched = WORKOUT_TYPES.find(
          t => t.toLowerCase() === result.exercise_type.toLowerCase(),
        );
        setWorkoutType(matched ?? result.exercise_type);
      }
      if (result.duration_min) setDurationMin(Math.round(result.duration_min));
      if (result.intensity) {
        setIntensity(result.intensity === 'low' ? 2 : result.intensity === 'moderate' ? 5 : 9);
      }
    } catch {
      // ignore — user can adjust manually
    }
  }

  const estCalories = Math.round(durationMin * (intensity / 10) * 8);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  async function handleLog() {
    if (loading) return;
    const intensityLevel = intensity <= 3 ? 'low' : intensity <= 7 ? 'moderate' : 'high';
    await addActivityLog(workoutType, durationMin, intensityLevel);
    const steps = Math.round(durationMin * 90);
    dispatch({ type: 'LOG_STEPS', steps });
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={{ height: insets.top, backgroundColor: BG }} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.back}>
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <GlassBorder r={22} />
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        <Text style={s.title}>Log Activity</Text>
        <VoiceButton onTranscription={handleVoiceTranscription} size="sm" />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary cards row */}
        <View style={s.cardsRow}>
          <SummaryCard icon="flame-outline" label="Est. Calories" value={estCalories} unit="kcal" />
          <SummaryCard icon="time-outline" label="Duration" value={durationMin} unit="min" />
        </View>

        {/* Workout Info */}
        <Text style={s.sectionLabel}>WORKOUT INFO</Text>
        <View style={[s.card, SHADOW]}>
          <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
          <GlassBorder r={28} />
          <InfoRow icon="calendar-outline" label="DATE" value={dateStr} />
          <InfoRow icon="barbell-outline" label="WORKOUT TYPE" value={workoutType} onPress={() => setShowTypePicker(true)} last />
        </View>

        {/* Intensity gauge */}
        <Text style={s.sectionLabel}>INTENSITY</Text>
        <View style={[s.card, SHADOW]}>
          <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
          <GlassBorder r={28} />
          <View style={{ paddingHorizontal: 16 }}>
            <ArcGauge
              value={intensity}
              min={1}
              max={10}
              labels={['Recovery', 'Moderate', 'Max Effort']}
              onChange={setIntensity}
            />
          </View>
        </View>

        {/* Duration gauge */}
        <Text style={s.sectionLabel}>DURATION</Text>
        <View style={[s.card, SHADOW]}>
          <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
          <GlassBorder r={28} />
          <View style={{ paddingHorizontal: 16 }}>
            <ArcGauge
              value={durationMin}
              min={0}
              max={120}
              unit="min"
              labels={['0', '60 min', '120 min']}
              onChange={setDurationMin}
            />
          </View>
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={[s.ctaWrap, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={handleLog}
          activeOpacity={0.85}
          disabled={loading}
          style={[s.logBtn, loading && { opacity: 0.75 }]}
        >
          {loading
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={s.logBtnText}>Log Activity</Text>
          }
        </TouchableOpacity>
      </View>

      <TypePickerSheet
        visible={showTypePicker}
        current={workoutType}
        onSave={setWorkoutType}
        onClose={() => setShowTypePicker(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
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
  title: { fontSize: 18, fontWeight: '700', color: DARK, fontFamily: 'Helvetica Neue' },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.2,
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
    fontFamily: 'Helvetica Neue',
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#111111',
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
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.8,
    fontFamily: 'Helvetica Neue',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: DARK,
    maxWidth: 180,
    fontFamily: 'Helvetica Neue',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 16,
  },
  ctaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: BG,
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
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
    fontFamily: 'Helvetica Neue',
  },
});

// ─── Summary card styles ──────────────────────────────────────────────────────

const sc = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
    backgroundColor: '#111111',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.3,
    fontFamily: 'Helvetica Neue',
  },
  value: {
    fontSize: 30,
    fontWeight: '800',
    color: DARK,
    letterSpacing: -1,
    fontFamily: 'Helvetica Neue',
  },
  unit: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 4,
    fontFamily: 'Helvetica Neue',
  },
});

// ─── Arc gauge styles ─────────────────────────────────────────────────────────

const ag = StyleSheet.create({
  center: {
    position: 'absolute',
    bottom: 44,
    alignSelf: 'center',
    alignItems: 'center',
  },
  bigValue: {
    fontSize: 56,
    fontWeight: '900',
    color: DARK,
    lineHeight: 60,
    fontFamily: 'Helvetica Neue',
  },
  unitText: {
    fontSize: 20,
    fontWeight: '700',
    color: ORANGE,
    marginBottom: 8,
    fontFamily: 'Helvetica Neue',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica Neue',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: -12,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica Neue',
  },
});

// ─── Type picker sheet styles ─────────────────────────────────────────────────

const tp = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#111111',
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  handle: {
    width: 44,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    color: DARK,
    fontFamily: 'Helvetica Neue',
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,116,42,0.15)',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: ORANGE,
    fontFamily: 'Helvetica Neue',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillSelected: {
    backgroundColor: 'rgba(255,116,42,0.2)',
    borderColor: ORANGE,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Helvetica Neue',
  },
  pillTextSelected: {
    color: ORANGE,
    fontWeight: '700',
  },
});
