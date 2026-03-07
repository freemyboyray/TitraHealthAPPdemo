import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const TERRACOTTA = '#C4784B';
const DARK = '#1C0F09';
const BG = '#F0EAE4';

const EXERCISE_TYPES = [
  'Walking',
  'Running',
  'Cycling',
  'Strength Training',
  'Yoga',
  'Swimming',
  'HIIT',
  'Pilates',
  'Other',
];

const INTENSITY_OPTIONS: { value: 'low' | 'moderate' | 'high'; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#2B9450' },
  { value: 'moderate', label: 'Moderate', color: TERRACOTTA },
  { value: 'high', label: 'High', color: '#DC3232' },
];

const TODAY = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
}).toUpperCase();

// ─── Glass primitives ─────────────────────────────────────────────────────────

function GlassBorder({ r = 24 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: r,
          borderWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.65)',
          borderLeftColor: 'rgba(255,255,255,0.42)',
          borderRightColor: 'rgba(255,255,255,0.14)',
          borderBottomColor: 'rgba(255,255,255,0.08)',
        },
      ]}
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, addActivityLog } = useLogStore();

  const [exerciseType, setExerciseType] = useState('Walking');
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [notes, setNotes] = useState('');

  function decreaseDuration() {
    setDuration((d) => Math.max(5, d - 5));
  }

  function increaseDuration() {
    setDuration((d) => Math.min(300, d + 5));
  }

  async function handleSave() {
    await addActivityLog(exerciseType, duration, intensity);
    router.back();
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={s.backBtnShadow}
          >
            <View style={s.backBtn}>
              <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.backOverlay]} />
              <GlassBorder r={22} />
              <Ionicons name="chevron-back" size={22} color={DARK} />
            </View>
          </TouchableOpacity>

          <Text style={s.headerTitle}>Log Activity</Text>

          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Date label ── */}
          <Text style={s.dateLabel}>{TODAY}</Text>

          {/* ── Exercise Type Card ── */}
          <View style={[s.cardShadow, { marginBottom: 16 }]}>
            <View style={s.cardBody}>
              <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.cardOverlay]} />
              <GlassBorder r={24} />

              <View style={s.cardContent}>
                <View style={s.badgeWrap}>
                  <Text style={s.badgeText}>EXERCISE TYPE</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chipRow}
                >
                  {EXERCISE_TYPES.map((type) => {
                    const active = exerciseType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        activeOpacity={0.75}
                        onPress={() => setExerciseType(type)}
                        style={[
                          s.chip,
                          active
                            ? [s.chipActive, { shadowColor: TERRACOTTA }]
                            : s.chipInactive,
                        ]}
                      >
                        <Text style={[s.chipText, active ? s.chipTextActive : s.chipTextInactive]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>

          {/* ── Duration Card ── */}
          <View style={[s.cardShadow, { marginBottom: 16 }]}>
            <View style={s.cardBody}>
              <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.cardOverlay]} />
              <GlassBorder r={24} />

              <View style={s.cardContent}>
                <View style={s.badgeWrap}>
                  <Text style={s.badgeText}>DURATION</Text>
                </View>

                <View style={s.stepperRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={decreaseDuration}
                    style={s.stepBtnShadow}
                    disabled={duration <= 5}
                  >
                    <View style={s.stepBtn}>
                      <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
                      <View style={[StyleSheet.absoluteFillObject, s.stepOverlay]} />
                      <GlassBorder r={32} />
                      <Ionicons
                        name="remove"
                        size={28}
                        color={duration <= 5 ? 'rgba(28,15,9,0.25)' : DARK}
                      />
                    </View>
                  </TouchableOpacity>

                  <View style={s.stepValueWrap}>
                    <Text style={s.stepValue}>{duration}</Text>
                    <Text style={s.stepUnit}>MINUTES</Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={increaseDuration}
                    style={s.stepBtnShadow}
                    disabled={duration >= 300}
                  >
                    <View style={s.stepBtn}>
                      <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
                      <View style={[StyleSheet.absoluteFillObject, s.stepOverlay]} />
                      <GlassBorder r={32} />
                      <Ionicons
                        name="add"
                        size={28}
                        color={duration >= 300 ? 'rgba(28,15,9,0.25)' : DARK}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* ── Intensity Card ── */}
          <View style={[s.cardShadow, { marginBottom: 16 }]}>
            <View style={s.cardBody}>
              <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.cardOverlay]} />
              <GlassBorder r={24} />

              <View style={s.cardContent}>
                <View style={s.badgeWrap}>
                  <Text style={s.badgeText}>INTENSITY</Text>
                </View>

                <View style={s.intensityRow}>
                  {INTENSITY_OPTIONS.map((opt) => {
                    const active = intensity === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        activeOpacity={0.75}
                        onPress={() => setIntensity(opt.value)}
                        style={[
                          s.intensityPill,
                          active
                            ? [
                                s.intensityPillActive,
                                {
                                  backgroundColor: opt.color,
                                  shadowColor: opt.color,
                                },
                              ]
                            : s.intensityPillInactive,
                        ]}
                      >
                        <Text
                          style={[
                            s.intensityText,
                            active ? s.intensityTextActive : s.intensityTextInactive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          {/* ── Notes Card ── */}
          <View style={[s.cardShadow, { marginBottom: 32 }]}>
            <View style={s.cardBody}>
              <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.cardOverlay]} />
              <GlassBorder r={24} />

              <View style={s.cardContent}>
                <View style={s.notesRow}>
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color="rgba(28,15,9,0.45)"
                    style={{ marginRight: 10, marginTop: 2 }}
                  />
                  <TextInput
                    style={s.notesInput}
                    placeholder="Add a note… (optional)"
                    placeholderTextColor="rgba(28,15,9,0.35)"
                    value={notes}
                    onChangeText={setNotes}
                    maxLength={200}
                    multiline
                    returnKeyType="done"
                    blurOnSubmit
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ── Save Button ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={loading}
            style={s.saveBtn}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={s.saveBtnText}>Save Activity</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: DARK,
    letterSpacing: -0.3,
  },
  backBtnShadow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backOverlay: {
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // Date label
  dateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(28,15,9,0.45)',
    letterSpacing: 3.5,
    textAlign: 'center',
    marginBottom: 24,
  },

  // Glass card
  cardShadow: {
    borderRadius: 24,
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  cardBody: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardOverlay: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  cardContent: {
    padding: 20,
  },

  // Terracotta badge label
  badgeWrap: {
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: TERRACOTTA,
    letterSpacing: 3.5,
  },

  // Exercise type chips
  chipRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chipActive: {
    backgroundColor: TERRACOTTA,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  chipInactive: {
    backgroundColor: 'rgba(28,15,9,0.07)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipTextInactive: {
    color: 'rgba(28,15,9,0.55)',
  },

  // Duration stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBtnShadow: {
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  stepBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOverlay: {
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  stepValueWrap: {
    alignItems: 'center',
    flex: 1,
  },
  stepValue: {
    fontSize: 72,
    fontWeight: '800',
    color: DARK,
    letterSpacing: -3,
    lineHeight: 80,
  },
  stepUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(28,15,9,0.40)',
    letterSpacing: 3.5,
    marginTop: 2,
  },

  // Intensity pills
  intensityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  intensityPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intensityPillActive: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  intensityPillInactive: {
    backgroundColor: 'rgba(28,15,9,0.07)',
  },
  intensityText: {
    fontSize: 13,
    fontWeight: '700',
  },
  intensityTextActive: {
    color: '#FFFFFF',
  },
  intensityTextInactive: {
    color: 'rgba(28,15,9,0.50)',
  },

  // Notes
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notesInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: DARK,
    lineHeight: 22,
    minHeight: 44,
  },

  // Save button
  saveBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: TERRACOTTA,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TERRACOTTA,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
