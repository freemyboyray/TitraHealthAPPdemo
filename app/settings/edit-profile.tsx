import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, NativeScrollEvent,
  NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OptionPill } from '@/components/onboarding/option-pill';
import { WheelPicker } from '@/components/onboarding/wheel-picker';
import type { AppColors } from '@/constants/theme';
import { ActivityLevel, Sex, UnitSystem, addWeeks } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { computeBaseTargets } from '@/lib/targets';
import { useLogStore } from '@/stores/log-store';

const ORANGE = '#FF742A';

// ─── Body picker data ──────────────────────────────────────────────────────
const FEET = Array.from({ length: 4 }, (_, i) => `${i + 4} ft`);
const INCHES = Array.from({ length: 12 }, (_, i) => `${i} in`);
const LBS_WHOLE = Array.from({ length: 321 }, (_, i) => `${i + 80} lbs`);
const LBS_HALF = ['.0', '.5'];
const CM = Array.from({ length: 101 }, (_, i) => `${i + 120} cm`);
const KG = Array.from({ length: 161 }, (_, i) => `${i + 40} kg`);

// ─── Goals data ────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_W = 32;
const TICK_SPACING = 8;
const UNIT_W = ITEM_W + TICK_SPACING;
const SNAP_VALUES = [0.2, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
const CONTEXT_NOTES: Record<string, string> = {
  '0.2': 'This slower pace is gentle and sustainable for your journey.',
  '0.5': 'A gentle, sustainable pace - great for long-term success.',
  '1.0': 'A moderate pace with good results.',
  '1.5': 'A moderate pace with good results.',
  '2.0': 'Aggressive - ensure adequate protein and recovery.',
  '2.5': 'Aggressive - ensure adequate protein and recovery.',
  '3.0': 'Aggressive - ensure adequate protein and recovery.',
};

// ─── Personal data ─────────────────────────────────────────────────────────
const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: '♂  Male' },
  { value: 'female', label: '♀  Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];
const ACTIVITY_ICON_COLOR = 'rgba(255,255,255,0.7)';
const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; icon: React.ReactNode; subtitle: string }[] = [
  { value: 'sedentary',   label: 'Sedentary',      icon: <MaterialIcons name="event-seat"      size={20} color={ACTIVITY_ICON_COLOR} />, subtitle: 'Mostly seated, little exercise' },
  { value: 'light',       label: 'Lightly Active',  icon: <MaterialIcons name="directions-walk" size={20} color={ACTIVITY_ICON_COLOR} />, subtitle: 'Some walking or light movement' },
  { value: 'active',      label: 'Active',           icon: <MaterialIcons name="directions-run"  size={20} color={ACTIVITY_ICON_COLOR} />, subtitle: 'Regular workouts or physical tasks' },
  { value: 'very_active', label: 'Very Active',      icon: <MaterialIcons name="flash-on"        size={20} color={ACTIVITY_ICON_COLOR} />, subtitle: 'Intense exercise or very physical job' },
];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1939 }, (_, i) =>
  String(CURRENT_YEAR - i),
).filter((y) => parseInt(y) <= CURRENT_YEAR - 16);

export default function EditProfileScreen() {
  const { profile, updateProfile, isLoading } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  // ─── Body state ────────────────────────────────────────────────────────────
  // Prefer latest weight log over stale profile value
  const latestWeightLog = useLogStore((s) => s.weightLogs[0]);
  const effectiveWeightLbs = latestWeightLog?.weight_lbs ?? profile?.weightLbs ?? 180;
  const effectiveWeightKg = Math.round(effectiveWeightLbs * 0.453592 * 10) / 10;

  const [unit, setUnit] = useState<UnitSystem>(profile?.unitSystem ?? 'imperial');
  const [ftIdx, setFtIdx] = useState(() => Math.max(0, (profile?.heightFt ?? 5) - 4));
  const [inIdx, setInIdx] = useState(() => profile?.heightIn ?? 6);
  const [lbsIdx, setLbsIdx] = useState(() => Math.max(0, Math.floor(effectiveWeightLbs) - 80));
  const [halfIdx, setHalfIdx] = useState(() => (effectiveWeightLbs % 1) >= 0.5 ? 1 : 0);
  const [cmIdx, setCmIdx] = useState(() => Math.max(0, (profile?.heightCm ?? 165) - 120));
  const [kgIdx, setKgIdx] = useState(() => Math.max(0, Math.round(effectiveWeightKg) - 40));

  // ─── Goals state ───────────────────────────────────────────────────────────
  const currentLbs = effectiveWeightLbs;
  const minLbs = Math.max(80, Math.round(currentLbs - 80));
  const maxLbs = Math.round(currentLbs - 5);
  const count = Math.max(1, maxLbs - minLbs + 1);
  const initialGoalLbs = Math.min(Math.max(profile?.goalWeightLbs ?? Math.round(currentLbs - 20), minLbs), maxLbs);
  const [selectedLbs, setSelectedLbs] = useState(initialGoalLbs);
  const defaultSpeedIdx = Math.max(0, SNAP_VALUES.indexOf(profile?.targetWeeklyLossLbs ?? 1.0));
  const [speedIdx, setSpeedIdx] = useState(defaultSpeedIdx === -1 ? 2 : defaultSpeedIdx);
  const listRef = useRef<ScrollView>(null);

  // ─── Personal state ────────────────────────────────────────────────────────
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'prefer_not_to_say');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile?.activityLevel ?? 'light');
  const birthdayParts = (profile?.birthday || '1990-01-01').split('-');
  const [yearIdx, setYearIdx] = useState(() => Math.max(0, YEARS.indexOf(birthdayParts[0] ?? '1990')));
  const [monthIdx, setMonthIdx] = useState(() => Math.max(0, parseInt(birthdayParts[1] ?? '1') - 1));
  const [dayIdx, setDayIdx] = useState(() => Math.max(0, parseInt(birthdayParts[2] ?? '1') - 1));

  const [saving, setSaving] = useState(false);

  if (isLoading) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><ActivityIndicator color={ORANGE} style={{ flex: 1 }} /></SafeAreaView>;
  }
  if (!profile) { router.back(); return null; }

  // ─── Goals computed values ─────────────────────────────────────────────────
  const speed = SNAP_VALUES[speedIdx];
  const lbsToLose = Math.max(1, currentLbs - selectedLbs);
  const weeks = lbsToLose / speed;
  const goalDate = addWeeks(new Date(), weeks);
  const dateStr = goalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const goalDisplayValue = unit === 'imperial'
    ? `${selectedLbs} lbs`
    : `${Math.round(selectedLbs * 0.453592)} kg`;

  const handleGoalScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.x;
      const idx = Math.max(0, Math.min(count - 1, Math.round(offset / UNIT_W)));
      setSelectedLbs(minLbs + idx);
    },
    [count, minLbs],
  );

  function buildBodyFields() {
    if (unit === 'imperial') {
      const ft = ftIdx + 4;
      const inches = inIdx;
      const lbs = lbsIdx + 80 + (halfIdx === 1 ? 0.5 : 0);
      return {
        unitSystem: 'imperial' as const,
        heightFt: ft,
        heightIn: inches,
        heightCm: Math.round(((ft * 12) + inches) * 2.54),
        weightLbs: lbs,
        startWeightLbs: lbs,
        weightKg: Math.round(lbs * 0.453592 * 10) / 10,
      };
    } else {
      const cm = cmIdx + 120;
      const kg = kgIdx + 40;
      const lbs = Math.round(kg * 2.20462 * 10) / 10;
      return {
        unitSystem: 'metric' as const,
        heightCm: cm,
        heightFt: Math.floor(cm / 30.48),
        heightIn: Math.round((cm / 2.54) % 12),
        weightKg: kg,
        weightLbs: lbs,
        startWeightLbs: lbs,
      };
    }
  }

  function doSave() {
    setSaving(true);
    const m = String(monthIdx + 1).padStart(2, '0');
    const d = String(dayIdx + 1).padStart(2, '0');
    const year = YEARS[yearIdx];
    const bodyFields = buildBodyFields();

    updateProfile({
      ...bodyFields,
      goalWeightLbs: selectedLbs,
      goalWeightKg: Math.round(selectedLbs * 0.453592 * 10) / 10,
      targetWeeklyLossLbs: SNAP_VALUES[speedIdx],
      sex,
      birthday: `${year}-${m}-${d}`,
      activityLevel,
    }).then(() => router.back());
  }

  function handleSave() {
    if (saving) return;

    // Check if nutrition targets would change
    const bodyFields = buildBodyFields();
    const m = String(monthIdx + 1).padStart(2, '0');
    const d = String(dayIdx + 1).padStart(2, '0');
    const year = YEARS[yearIdx];
    const birthday = `${year}-${m}-${d}`;
    const bd = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - bd.getFullYear();
    const mo = today.getMonth() - bd.getMonth();
    if (mo < 0 || (mo === 0 && today.getDate() < bd.getDate())) age--;

    const currentTargets = computeBaseTargets(profile!);
    const proposed = {
      ...profile!,
      ...bodyFields,
      goalWeightLbs: selectedLbs,
      goalWeightKg: Math.round(selectedLbs * 0.453592 * 10) / 10,
      targetWeeklyLossLbs: SNAP_VALUES[speedIdx],
      sex,
      birthday,
      age,
      activityLevel,
    };
    const newTargets = computeBaseTargets(proposed);

    const targetsChanged =
      currentTargets.caloriesTarget !== newTargets.caloriesTarget ||
      currentTargets.proteinG !== newTargets.proteinG ||
      currentTargets.steps !== newTargets.steps;

    const targetsDiff = targetsChanged
      ? `\n\nYour daily targets will change:\nCalories: ${currentTargets.caloriesTarget} → ${newTargets.caloriesTarget} cal\nProtein: ${currentTargets.proteinG}g → ${newTargets.proteinG}g\nSteps: ${currentTargets.steps.toLocaleString()} → ${newTargets.steps.toLocaleString()}`
      : '';

    Alert.alert(
      'Update Your Plan?',
      `Your body metrics, goals, and daily plan will be recalculated based on these changes.${targetsDiff}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: doSave },
      ],
    );
  }

  const hasWeight = profile.weightLbs > 0;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>BODY & GOALS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ═══ BODY SECTION ═══ */}
        <Text style={s.sectionHeading}>Body</Text>

        {/* Unit toggle */}
        <View style={s.toggle}>
          <TouchableOpacity
            style={[s.toggleBtn, unit === 'imperial' && s.toggleBtnActive]}
            onPress={() => setUnit('imperial')}>
            <Text style={[s.toggleText, unit === 'imperial' && s.toggleTextActive]}>Imperial</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, unit === 'metric' && s.toggleBtnActive]}
            onPress={() => setUnit('metric')}>
            <Text style={[s.toggleText, unit === 'metric' && s.toggleTextActive]}>Metric</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionLabel}>Height</Text>
        <View style={s.pickersRow}>
          {unit === 'imperial' ? (
            <>
              <View style={s.pickerWrap}><WheelPicker data={FEET} selectedIndex={ftIdx} onSelect={setFtIdx} /></View>
              <View style={s.pickerWrap}><WheelPicker data={INCHES} selectedIndex={inIdx} onSelect={setInIdx} /></View>
            </>
          ) : (
            <View style={s.pickerWrap}><WheelPicker data={CM} selectedIndex={cmIdx} onSelect={setCmIdx} /></View>
          )}
        </View>

        <Text style={[s.sectionLabel, { marginTop: 16 }]}>Weight</Text>
        <View style={s.pickersRow}>
          {unit === 'imperial' ? (
            <>
              <View style={s.pickerWrap}><WheelPicker data={LBS_WHOLE} selectedIndex={lbsIdx} onSelect={setLbsIdx} /></View>
              <View style={[s.pickerWrap, { flex: 0.5 }]}><WheelPicker data={LBS_HALF} selectedIndex={halfIdx} onSelect={setHalfIdx} /></View>
            </>
          ) : (
            <View style={s.pickerWrap}><WheelPicker data={KG} selectedIndex={kgIdx} onSelect={setKgIdx} /></View>
          )}
        </View>

        {/* ═══ GOALS SECTION ═══ */}
        <View style={s.divider} />
        <Text style={s.sectionHeading}>Goals</Text>

        {!hasWeight ? (
          <View style={s.warningBox}>
            <Text style={s.warningTitle}>Log your weight first</Text>
            <Text style={s.warningText}>
              Add a weight entry so we can calculate your goal range accurately.
            </Text>
          </View>
        ) : (
          <>
            <Text style={s.sectionLabel}>Goal Weight</Text>
            <View style={s.display}>
              <Text style={s.displaySmall}>Dream Weight</Text>
              <Text style={s.displayValue}>{goalDisplayValue}</Text>
            </View>

            <View style={s.rulerContainer}>
              <View style={s.indicator} />
              <ScrollView
                ref={listRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={UNIT_W}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: SCREEN_WIDTH / 2 - UNIT_W / 2 }}
                contentOffset={{ x: Math.max(0, initialGoalLbs - minLbs) * UNIT_W, y: 0 }}
                onMomentumScrollEnd={handleGoalScroll}
              >
                {Array.from({ length: count }, (_, i) => {
                  const item = minLbs + i;
                  const isMajor = item % 10 === 0;
                  const isMid = item % 5 === 0;
                  return (
                    <View key={item} style={[s.tick, { width: UNIT_W }]}>
                      <View style={[s.tickLine, isMajor && s.tickMajor, isMid && !isMajor && s.tickMid]} />
                      {isMajor && <Text style={s.tickLabel}>{item}</Text>}
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            <Text style={[s.sectionLabel, { marginTop: 8 }]}>Weekly Loss Rate</Text>
            <View style={s.chip}>
              <Text style={s.chipText}>Est. Goal Date: {dateStr}</Text>
            </View>
            <View style={s.goalDisplay}>
              <Text style={s.goalDisplayLabel}>Weekly Change</Text>
              <Text style={s.goalDisplayBig}>{speed.toFixed(1)} lbs</Text>
            </View>
            <Text style={s.contextNote}>{CONTEXT_NOTES[speed.toFixed(1)]}</Text>
            <View style={s.selectorRow}>
              {SNAP_VALUES.map((v, i) => {
                const isSelected = i === speedIdx;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setSpeedIdx(i)}
                    activeOpacity={0.7}
                    style={[s.snapItem, isSelected && s.snapItemSelected]}>
                    <Text style={[s.snapLabel, isSelected && s.snapLabelSelected]}>
                      {v.toFixed(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.markerRow}>
              <Text style={s.markerText}>Gentle</Text>
              <Text style={s.markerText}>Moderate</Text>
              <Text style={s.markerText}>Fast</Text>
            </View>
          </>
        )}

        {/* ═══ PERSONAL SECTION ═══ */}
        <View style={s.divider} />
        <Text style={s.sectionHeading}>Personal</Text>

        <Text style={s.sectionLabel}>Sex</Text>
        {SEX_OPTIONS.map((o) => (
          <OptionPill
            key={o.value}
            label={o.label}
            selected={sex === o.value}
            onPress={() => setSex(o.value)}
          />
        ))}

        <Text style={[s.sectionLabel, { marginTop: 28, marginBottom: 4 }]}>Birthday</Text>
        <View style={s.bdayColLabels}>
          <Text style={[s.colLabel, { flex: 2 }]}>Month</Text>
          <Text style={[s.colLabel, { flex: 1 }]}>Day</Text>
          <Text style={[s.colLabel, { flex: 1 }]}>Year</Text>
        </View>
        <View style={s.bdayRow}>
          <View style={s.pickerWrapLg}>
            <WheelPicker data={MONTHS} selectedIndex={monthIdx} onSelect={setMonthIdx} />
          </View>
          <View style={s.pickerWrapSm}>
            <WheelPicker data={DAYS} selectedIndex={dayIdx} onSelect={setDayIdx} />
          </View>
          <View style={s.pickerWrapSm}>
            <WheelPicker data={YEARS} selectedIndex={yearIdx} onSelect={setYearIdx} />
          </View>
        </View>

        <Text style={[s.sectionLabel, { marginTop: 28 }]}>Activity Level</Text>
        {ACTIVITY_OPTIONS.map((o) => (
          <OptionPill
            key={o.value}
            label={o.label}
            icon={o.icon}
            subtitle={o.subtitle}
            selected={activityLevel === o.value}
            onPress={() => setActivityLevel(o.value)}
          />
        ))}

      </ScrollView>

      <View style={s.footer}>
        <Pressable style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '700', letterSpacing: 3.5 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },

  sectionHeading: {
    fontSize: 20, fontWeight: '800', color: ORANGE,
    letterSpacing: 0.5, marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: c.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  divider: {
    height: 1, backgroundColor: c.borderSubtle,
    marginVertical: 32,
  },

  // Body
  toggle: {
    flexDirection: 'row',
    backgroundColor: c.glassOverlay,
    borderRadius: 12, padding: 3, marginBottom: 28, alignSelf: 'flex-start',
  },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: ORANGE },
  toggleText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
  toggleTextActive: { color: '#FFFFFF' },
  pickersRow: { flexDirection: 'row', gap: 8 },
  pickerWrap: { flex: 1 },

  // Goals
  display: { alignItems: 'center', marginBottom: 16 },
  displaySmall: { fontSize: 13, color: c.textSecondary, letterSpacing: 0.5 },
  displayValue: { fontSize: 42, fontWeight: '800', color: c.textPrimary, marginTop: 4 },
  rulerContainer: {
    height: 72, position: 'relative', marginBottom: 32, marginHorizontal: -24,
  },
  indicator: {
    position: 'absolute', top: 0, left: '50%', width: 2, height: 48,
    backgroundColor: ORANGE, zIndex: 2, marginLeft: -1,
  },
  tick: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  tickLine: { width: 1.5, height: 18, backgroundColor: 'rgba(255,255,255,0.3)' },
  tickMid: { height: 26, backgroundColor: 'rgba(255,255,255,0.55)' },
  tickMajor: { height: 36, backgroundColor: '#FFFFFF', width: 2 },
  tickLabel: { fontSize: 11, color: c.textSecondary, marginTop: 4 },
  chip: {
    alignSelf: 'flex-start', backgroundColor: c.glassOverlay,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginBottom: 20,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
  goalDisplay: { alignItems: 'center', marginBottom: 12 },
  goalDisplayLabel: { fontSize: 13, color: c.textSecondary, letterSpacing: 0.5 },
  goalDisplayBig: { fontSize: 48, fontWeight: '800', color: c.textPrimary, marginTop: 4 },
  contextNote: {
    fontSize: 14, color: c.textSecondary, textAlign: 'center',
    marginBottom: 24, lineHeight: 20, paddingHorizontal: 8,
  },
  selectorRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 12 },
  snapItem: {
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5,
    borderColor: c.borderSubtle, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg,
  },
  snapItemSelected: { backgroundColor: ORANGE, borderColor: ORANGE },
  snapLabel: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  snapLabelSelected: { color: '#FFFFFF' },
  markerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  markerText: { fontSize: 12, color: c.textMuted },

  warningBox: { alignItems: 'center', paddingVertical: 24 },
  warningTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  warningText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center' },

  // Personal
  bdayColLabels: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  bdayRow: { flexDirection: 'row', gap: 8, height: 180 },
  pickerWrapLg: { flex: 2 },
  pickerWrapSm: { flex: 1 },
  colLabel: {
    fontSize: 12, fontWeight: '600', color: c.textSecondary,
    textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase',
  },

  footer: { padding: 16, paddingBottom: 8 },
  saveBtn: {
    backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
