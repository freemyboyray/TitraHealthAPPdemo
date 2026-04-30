import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { OptionPill } from '@/components/onboarding/option-pill';
import { WheelPicker } from '@/components/onboarding/wheel-picker';
import type { AppColors } from '@/constants/theme';
import { ActivityLevel, Sex, UnitSystem, addWeeks } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { computeBaseTargets } from '@/lib/targets';
import { useLogStore } from '@/stores/log-store';

const ORANGE = '#FF742A';

// ─── Picker data ───────────────────────────────────────────────────────────
const FEET = Array.from({ length: 4 }, (_, i) => `${i + 4} ft`);
const INCHES = Array.from({ length: 12 }, (_, i) => `${i} in`);
const LBS_WHOLE = Array.from({ length: 321 }, (_, i) => `${i + 80} lbs`);
const LBS_HALF = ['.0', '.5'];
const CM = Array.from({ length: 101 }, (_, i) => `${i + 120} cm`);
const KG = Array.from({ length: 161 }, (_, i) => `${i + 40} kg`);
const GOAL_LBS = Array.from({ length: 321 }, (_, i) => `${i + 80} lbs`);
const GOAL_KG = Array.from({ length: 161 }, (_, i) => `${i + 40} kg`);
const SNAP_VALUES = [0.2, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
const SNAP_LABELS = SNAP_VALUES.map((v) => `${v.toFixed(1)} lbs/wk`);

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: '♂  Male' },
  { value: 'female', label: '♀  Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];
const SEX_DISPLAY: Record<string, string> = {
  male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say',
};
const ACTIVITY_DISPLAY: Record<string, string> = {
  sedentary: 'Sedentary', light: 'Lightly Active', active: 'Active', very_active: 'Very Active',
};
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

// ─── Sheet types ───────────────────────────────────────────────────────────
type SheetType = 'height' | 'weight' | 'sex' | 'birthday' | 'activity' | 'goalWeight' | 'pace' | null;

export default function EditProfileScreen() {
  const { profile, updateProfile, isLoading } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const latestWeightLog = useLogStore((st: any) => st.weightLogs[0]);
  const effectiveWeightLbs = latestWeightLog?.weight_lbs ?? profile?.weightLbs ?? 180;
  const effectiveWeightKg = Math.round(effectiveWeightLbs * 0.453592 * 10) / 10;

  // ─── Editable state ────────────────────────────────────────────────────────
  const [unit, setUnit] = useState<UnitSystem>(profile?.unitSystem ?? 'imperial');
  const [ftIdx, setFtIdx] = useState(() => Math.max(0, (profile?.heightFt ?? 5) - 4));
  const [inIdx, setInIdx] = useState(() => profile?.heightIn ?? 6);
  const [lbsIdx, setLbsIdx] = useState(() => Math.max(0, Math.floor(effectiveWeightLbs) - 80));
  const [halfIdx, setHalfIdx] = useState(() => (effectiveWeightLbs % 1) >= 0.5 ? 1 : 0);
  const [cmIdx, setCmIdx] = useState(() => Math.max(0, (profile?.heightCm ?? 165) - 120));
  const [kgIdx, setKgIdx] = useState(() => Math.max(0, Math.round(effectiveWeightKg) - 40));

  const initialGoalLbs = profile?.goalWeightLbs ?? Math.round(effectiveWeightLbs - 20);
  const [goalLbsIdx, setGoalLbsIdx] = useState(() => Math.max(0, initialGoalLbs - 80));
  const [goalKgIdx, setGoalKgIdx] = useState(() => Math.max(0, Math.round(initialGoalLbs * 0.453592) - 40));
  const defaultSpeedIdx = Math.max(0, SNAP_VALUES.indexOf(profile?.targetWeeklyLossLbs ?? 1.0));
  const [speedIdx, setSpeedIdx] = useState(defaultSpeedIdx === -1 ? 2 : defaultSpeedIdx);

  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'prefer_not_to_say');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile?.activityLevel ?? 'light');
  const birthdayParts = (profile?.birthday || '1990-01-01').split('-');
  const [yearIdx, setYearIdx] = useState(() => Math.max(0, YEARS.indexOf(birthdayParts[0] ?? '1990')));
  const [monthIdx, setMonthIdx] = useState(() => Math.max(0, parseInt(birthdayParts[1] ?? '1') - 1));
  const [dayIdx, setDayIdx] = useState(() => Math.max(0, parseInt(birthdayParts[2] ?? '1') - 1));

  const [saving, setSaving] = useState(false);
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);

  if (isLoading) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><ActivityIndicator color={ORANGE} style={{ flex: 1 }} /></SafeAreaView>;
  }
  if (!profile) { router.back(); return null; }

  // ─── Computed display values ───────────────────────────────────────────────
  const heightDisplay = unit === 'imperial'
    ? `${ftIdx + 4}'${inIdx}"`
    : `${cmIdx + 120} cm`;
  const weightDisplay = unit === 'imperial'
    ? `${lbsIdx + 80}${halfIdx === 1 ? '.5' : ''} lbs`
    : `${kgIdx + 40} kg`;
  const goalLbs = goalLbsIdx + 80;
  const goalDisplay = unit === 'imperial'
    ? `${goalLbs} lbs`
    : `${goalKgIdx + 40} kg`;
  const speed = SNAP_VALUES[speedIdx];
  const lbsToLose = Math.max(1, effectiveWeightLbs - goalLbs);
  const weeks = lbsToLose / speed;
  const goalDate = addWeeks(new Date(), weeks);
  const dateStr = goalDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const birthdayDisplay = `${MONTHS[monthIdx]?.slice(0, 3)} ${dayIdx + 1}, ${YEARS[yearIdx]}`;

  // ─── Save logic ────────────────────────────────────────────────────────────
  function buildBodyFields() {
    if (unit === 'imperial') {
      const ft = ftIdx + 4;
      const inches = inIdx;
      const lbs = lbsIdx + 80 + (halfIdx === 1 ? 0.5 : 0);
      return {
        unitSystem: 'imperial' as const,
        heightFt: ft, heightIn: inches,
        heightCm: Math.round(((ft * 12) + inches) * 2.54),
        weightLbs: lbs, startWeightLbs: lbs,
        weightKg: Math.round(lbs * 0.453592 * 10) / 10,
      };
    }
    const cm = cmIdx + 120;
    const kg = kgIdx + 40;
    const lbs = Math.round(kg * 2.20462 * 10) / 10;
    return {
      unitSystem: 'metric' as const,
      heightCm: cm, heightFt: Math.floor(cm / 30.48),
      heightIn: Math.round((cm / 2.54) % 12),
      weightKg: kg, weightLbs: lbs, startWeightLbs: lbs,
    };
  }

  function doSave() {
    setSaving(true);
    const m = String(monthIdx + 1).padStart(2, '0');
    const d = String(dayIdx + 1).padStart(2, '0');
    const year = YEARS[yearIdx];
    const bodyFields = buildBodyFields();
    const selectedGoalLbs = unit === 'imperial' ? goalLbsIdx + 80 : Math.round((goalKgIdx + 40) * 2.20462);

    updateProfile({
      ...bodyFields,
      goalWeightLbs: selectedGoalLbs,
      goalWeightKg: Math.round(selectedGoalLbs * 0.453592 * 10) / 10,
      targetWeeklyLossLbs: SNAP_VALUES[speedIdx],
      sex,
      birthday: `${year}-${m}-${d}`,
      activityLevel,
    }).then(() => router.back());
  }

  function handleSave() {
    if (saving) return;
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
    const selectedGoalLbs = unit === 'imperial' ? goalLbsIdx + 80 : Math.round((goalKgIdx + 40) * 2.20462);

    const currentTargets = computeBaseTargets(profile!);
    const proposed = {
      ...profile!, ...bodyFields,
      goalWeightLbs: selectedGoalLbs,
      goalWeightKg: Math.round(selectedGoalLbs * 0.453592 * 10) / 10,
      targetWeeklyLossLbs: SNAP_VALUES[speedIdx],
      sex, birthday, age, activityLevel,
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

  function openSheet(type: SheetType) {
    Haptics.selectionAsync();
    setActiveSheet(type);
  }

  // ─── Row component ─────────────────────────────────────────────────────────
  function Row({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
    return (
      <Pressable style={s.row} onPress={onPress}>
        <Text style={s.rowLabel}>{label}</Text>
        <View style={s.rowRight}>
          <Text style={s.rowValue}>{value}</Text>
          <IconSymbol name="chevron.right" size={14} color={colors.textMuted} />
        </View>
      </Pressable>
    );
  }

  // ─── Bottom sheet ──────────────────────────────────────────────────────────
  function BottomSheet({ visible, title, onDone, children }: {
    visible: boolean; title: string; onDone: () => void; children: React.ReactNode;
  }) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
        <View style={s.sheetOverlay}>
          <Pressable style={s.sheetBackdrop} onPress={onDone} />
          <View style={s.sheetContainer}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{title}</Text>
              <TouchableOpacity onPress={onDone} activeOpacity={0.7}>
                <Text style={s.sheetDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={s.sheetBody}>{children}</View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Body & Goals</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Unit toggle */}
        <View style={s.unitToggle}>
          <TouchableOpacity
            style={[s.unitBtn, unit === 'imperial' && s.unitBtnActive]}
            onPress={() => { setUnit('imperial'); Haptics.selectionAsync(); }}
          >
            <Text style={[s.unitText, unit === 'imperial' && s.unitTextActive]}>Imperial</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.unitBtn, unit === 'metric' && s.unitBtnActive]}
            onPress={() => { setUnit('metric'); Haptics.selectionAsync(); }}
          >
            <Text style={[s.unitText, unit === 'metric' && s.unitTextActive]}>Metric</Text>
          </TouchableOpacity>
        </View>

        {/* BODY section */}
        <Text style={s.sectionLabel}>BODY</Text>
        <View style={s.card}>
          <Row label="Height" value={heightDisplay} onPress={() => openSheet('height')} />
          <View style={s.divider} />
          <Row label="Weight" value={weightDisplay} onPress={() => openSheet('weight')} />
          <View style={s.divider} />
          <Row label="Sex" value={SEX_DISPLAY[sex] ?? sex} onPress={() => openSheet('sex')} />
          <View style={s.divider} />
          <Row label="Birthday" value={birthdayDisplay} onPress={() => openSheet('birthday')} />
          <View style={s.divider} />
          <Row label="Activity Level" value={ACTIVITY_DISPLAY[activityLevel] ?? activityLevel} onPress={() => openSheet('activity')} />
        </View>

        {/* GOALS section */}
        <Text style={s.sectionLabel}>GOALS</Text>
        <View style={s.card}>
          <Row label="Goal Weight" value={goalDisplay} onPress={() => openSheet('goalWeight')} />
          <View style={s.divider} />
          <Row label="Weekly Pace" value={`${speed.toFixed(1)} lbs/wk`} onPress={() => openSheet('pace')} />
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Est. Goal Date</Text>
            <Text style={s.rowValueComputed}>{dateStr}</Text>
          </View>
        </View>

      </ScrollView>

      {/* Save button */}
      <View style={s.footer}>
        <Pressable style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </Pressable>
      </View>

      {/* ─── Bottom sheets ─────────────────────────────────────────────────── */}

      <BottomSheet visible={activeSheet === 'height'} title="Height" onDone={() => setActiveSheet(null)}>
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
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'weight'} title="Weight" onDone={() => setActiveSheet(null)}>
        <View style={s.pickersRow}>
          {unit === 'imperial' ? (
            <>
              <View style={s.pickerWrap}><WheelPicker data={LBS_WHOLE} selectedIndex={lbsIdx} onSelect={setLbsIdx} /></View>
              <View style={[s.pickerWrap, { flex: 0.4 }]}><WheelPicker data={LBS_HALF} selectedIndex={halfIdx} onSelect={setHalfIdx} /></View>
            </>
          ) : (
            <View style={s.pickerWrap}><WheelPicker data={KG} selectedIndex={kgIdx} onSelect={setKgIdx} /></View>
          )}
        </View>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'sex'} title="Sex" onDone={() => setActiveSheet(null)}>
        {SEX_OPTIONS.map((o) => (
          <OptionPill key={o.value} label={o.label} selected={sex === o.value} onPress={() => { setSex(o.value); Haptics.selectionAsync(); }} />
        ))}
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'birthday'} title="Birthday" onDone={() => setActiveSheet(null)}>
        <View style={s.bdayLabels}>
          <Text style={[s.bdayLabel, { flex: 2 }]}>Month</Text>
          <Text style={[s.bdayLabel, { flex: 1 }]}>Day</Text>
          <Text style={[s.bdayLabel, { flex: 1 }]}>Year</Text>
        </View>
        <View style={s.bdayRow}>
          <View style={{ flex: 2 }}><WheelPicker data={MONTHS} selectedIndex={monthIdx} onSelect={setMonthIdx} circular /></View>
          <View style={{ flex: 1 }}><WheelPicker data={DAYS} selectedIndex={dayIdx} onSelect={setDayIdx} circular /></View>
          <View style={{ flex: 1 }}><WheelPicker data={YEARS} selectedIndex={yearIdx} onSelect={setYearIdx} /></View>
        </View>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'activity'} title="Activity Level" onDone={() => setActiveSheet(null)}>
        {ACTIVITY_OPTIONS.map((o) => (
          <OptionPill
            key={o.value} label={o.label} icon={o.icon} subtitle={o.subtitle}
            selected={activityLevel === o.value}
            onPress={() => { setActivityLevel(o.value); Haptics.selectionAsync(); }}
          />
        ))}
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'goalWeight'} title="Goal Weight" onDone={() => setActiveSheet(null)}>
        <View style={s.pickersRow}>
          {unit === 'imperial' ? (
            <View style={s.pickerWrap}><WheelPicker data={GOAL_LBS} selectedIndex={goalLbsIdx} onSelect={setGoalLbsIdx} /></View>
          ) : (
            <View style={s.pickerWrap}><WheelPicker data={GOAL_KG} selectedIndex={goalKgIdx} onSelect={setGoalKgIdx} /></View>
          )}
        </View>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'pace'} title="Weekly Pace" onDone={() => setActiveSheet(null)}>
        <View style={s.pickersRow}>
          <View style={s.pickerWrap}><WheelPicker data={SNAP_LABELS} selectedIndex={speedIdx} onSelect={setSpeedIdx} /></View>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 19, fontWeight: '700', color: c.textPrimary },

    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 24 },

    unitToggle: {
      flexDirection: 'row', backgroundColor: w(0.06),
      borderRadius: 12, padding: 3, marginBottom: 20, alignSelf: 'center',
    },
    unitBtn: { paddingHorizontal: 24, paddingVertical: 9, borderRadius: 10 },
    unitBtnActive: { backgroundColor: ORANGE },
    unitText: { fontSize: 15, fontWeight: '600', color: w(0.5) },
    unitTextActive: { color: '#FFFFFF' },

    sectionLabel: {
      fontSize: 13, fontWeight: '600', color: c.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.5,
      marginBottom: 8, marginLeft: 4, marginTop: 8,
    },
    card: {
      backgroundColor: c.glassOverlay,
      borderRadius: 16, borderWidth: 1,
      borderTopColor: c.border,
      borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle,
      borderBottomColor: c.borderSubtle,
      overflow: 'hidden', marginBottom: 20,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 15,
    },
    rowLabel: { fontSize: 17, fontWeight: '500', color: c.textPrimary },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowValue: { fontSize: 17, fontWeight: '500', color: c.textSecondary },
    rowValueComputed: { fontSize: 17, fontWeight: '500', color: ORANGE },
    divider: {
      height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle,
      marginLeft: 16,
    },

    footer: { padding: 16, paddingBottom: 8 },
    saveBtn: {
      backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 16,
      alignItems: 'center', justifyContent: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

    // ─── Bottom sheet ──────────────────────────────────────────────────────
    sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
    sheetBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheetContainer: {
      backgroundColor: c.isDark ? '#1C1C1E' : '#FFFFFF',
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingBottom: 34,
    },
    sheetHandle: {
      width: 36, height: 5, borderRadius: 3,
      backgroundColor: w(0.3),
      alignSelf: 'center', marginTop: 8, marginBottom: 4,
    },
    sheetHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    sheetTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    sheetDone: { fontSize: 17, fontWeight: '600', color: ORANGE },
    sheetBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },

    // ─── Picker layout ─────────────────────────────────────────────────────
    pickersRow: { flexDirection: 'row', gap: 8, height: 260 },
    pickerWrap: { flex: 1 },
    bdayLabels: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    bdayLabel: {
      fontSize: 13, fontWeight: '600', color: c.textSecondary,
      textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5,
    },
    bdayRow: { flexDirection: 'row', gap: 8, height: 260 },
  });
};
