import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import type { AppColors } from '@/constants/theme';
import { requestNotificationPermission } from '@/lib/notifications';
import {
  type ReminderSlot,
  type HydrationConfig,
  type ProteinConfig,
  type CustomReminder,
  MAX_CUSTOM_REMINDERS,
  useRemindersStore,
  syncDoseReminder,
} from '@/stores/reminders-store';
import { Bell, ChevronLeft, Droplet, FlaskConical, PlusCircle, Trash2, Utensils } from 'lucide-react-native';
import { LucideIconByName } from '@/lib/lucide-icon-map';

const FF = 'System';

const BRAND_LABEL: Record<string, string> = {
  zepbound: 'Zepbound', mounjaro: 'Mounjaro', wegovy: 'Wegovy', ozempic: 'Ozempic',
  trulicity: 'Trulicity', saxenda: 'Saxenda', victoza: 'Victoza', rybelsus: 'Rybelsus',
  oral_wegovy: 'Oral Wegovy', orforglipron: 'Orforglipron',
  compounded_semaglutide: 'Compounded (Sema)', compounded_tirzepatide: 'Compounded (Tirz)',
  compounded_liraglutide: 'Compounded (Lira)', other: 'Other',
};

/* ── Slot metadata ── */
type SlotMeta = {
  slot: ReminderSlot;
  label: string;
  subtitle: string;
  icon: string;
  color: string;
};

type Category = {
  title: string;
  subtitle: string;
  slots: SlotMeta[];
};

function getCategories(isOnMedication: boolean): Category[] {
  const healthSlots: SlotMeta[] = [
    { slot: 'weight_morning', label: 'Morning Weigh-in', subtitle: 'Track daily weight trends', icon: 'Scale', color: '#AF52DE' },
  ];
  if (isOnMedication) {
    healthSlots.push({ slot: 'side_effects_evening', label: 'Side Effects Check-in', subtitle: 'Log how you\'re feeling', icon: 'Hospital', color: '#FF3B30' });
  }

  return [
    {
      title: 'Nutrition',
      subtitle: 'Stay on top of your meals',
      slots: [
        { slot: 'meals_morning', label: 'Breakfast', subtitle: 'Start your day right', icon: 'Sun', color: '#FF9500' },
        { slot: 'meals_evening', label: 'Dinner', subtitle: 'End the day strong', icon: 'Moon', color: '#5856D6' },
      ],
    },
    {
      title: 'Health Tracking',
      subtitle: 'Monitor your progress',
      slots: healthSlots,
    },
    {
      title: 'Daily Planning',
      subtitle: 'Set your daily intention',
      slots: [
        { slot: 'daily_plan_morning', label: 'Daily Focus', subtitle: 'See today\'s priorities', icon: 'Compass', color: '#5AC8FA' },
      ],
    },
  ];
}

/* ── Custom reminder presets ── */
const CUSTOM_PRESETS: { label: string; icon: string; color: string }[] = [
  { label: 'Take supplements', icon: 'Sun', color: '#FF9500' },
  { label: 'Movement break', icon: 'Footprints', color: '#34C759' },
  { label: 'Drink electrolytes', icon: 'Zap', color: '#5AC8FA' },
  { label: 'Mindful breathing', icon: 'Leaf', color: '#AF52DE' },
  { label: 'Log progress photo', icon: 'Camera', color: '#FF2D55' },
];

/* ── Hydration interval options ── */
const HYDRATION_INTERVALS: { label: string; value: number }[] = [
  { label: '1h', value: 1 },
  { label: '1.5h', value: 1.5 },
  { label: '2h', value: 2 },
  { label: '3h', value: 3 },
];

/* ── Protein meal labels ── */
const PROTEIN_MEALS = ['Breakfast', 'Lunch', 'Dinner'] as const;

/* ── Time helpers ── */
function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1);
  d.setHours(h ?? 8, m ?? 0, 0, 0);
  return d;
}

function dateToHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = (h ?? 0) >= 12 ? 'PM' : 'AM';
  const hour = ((h ?? 0) % 12) || 12;
  return `${hour}:${String(m ?? 0).padStart(2, '0')} ${period}`;
}

function computeNextDose(lastDate: string | undefined, freqDays: number | undefined): string | null {
  if (!lastDate || !freqDays) return null;
  const last = new Date(lastDate + 'T12:00:00');
  const next = new Date(last.getTime() + freqDays * 86400000);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (next.getTime() < today.getTime()) return 'Overdue';
  if (next.toDateString() === today.toDateString()) return 'Today';
  const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
  if (diff === 1) return 'Tomorrow';
  return next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/* ── Component ── */
type PickerTarget =
  | ReminderSlot
  | 'dose_time'
  | 'hydration_start'
  | 'hydration_end'
  | 'protein_0'
  | 'protein_1'
  | 'protein_2'
  | `custom_${string}`
  | null;

export default function RemindersScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { profile, updateProfile } = useProfile();

  const store = useRemindersStore();
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date(2000, 0, 1, 8, 0));
  const pickerDateRef = useRef<Date>(new Date(2000, 0, 1, 8, 0));

  // Custom reminder inline form state
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState('');

  // ─── Entrance animations ──────────────────────────────────────────────────
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslate = useRef(new Animated.Value(10)).current;
  const masterOpacity = useRef(new Animated.Value(0)).current;
  const masterTranslate = useRef(new Animated.Value(16)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(headerTranslate, { toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(masterOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(masterTranslate, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(contentTranslate, { toValue: 0, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // Dose reminder state
  const doseReminderEnabled = store.doseReminderEnabled;
  const doseTimeStr = profile?.doseTime || '08:00';

  async function handleDoseToggle(v: boolean) {
    store.setDoseReminderEnabled(v);
    if (v && profile) {
      const brandDisplay = profile.medicationBrand
        ? (profile.medicationBrand.charAt(0).toUpperCase() + profile.medicationBrand.slice(1))
        : 'GLP-1';
      await syncDoseReminder({
        injFreqDays: profile.injectionFrequencyDays ?? 7,
        doseTime: doseTimeStr,
        drugName: brandDisplay,
        lastInjectionDate: profile.lastInjectionDate || null,
      }).catch(() => {});
    } else {
      // doseReminderEnabled is now false → syncDoseReminder cancels all dose reminders.
      await syncDoseReminder().catch(() => {});
    }
  }

  function openDoseTimePicker() {
    const d = hhmmToDate(doseTimeStr);
    pickerDateRef.current = d;
    setPickerDate(d);
    setPickerTarget('dose_time');
  }

  async function confirmDoseTime() {
    const newTime = dateToHHMM(pickerDateRef.current);
    closePicker();
    if (profile) {
      await updateProfile({ doseTime: newTime });
      // syncDoseReminder no-ops (cancels) when the dose toggle is off.
      const brandDisplay = profile.medicationBrand
        ? (profile.medicationBrand.charAt(0).toUpperCase() + profile.medicationBrand.slice(1))
        : 'GLP-1';
      await syncDoseReminder({
        injFreqDays: profile.injectionFrequencyDays ?? 7,
        doseTime: newTime,
        drugName: brandDisplay,
        lastInjectionDate: profile.lastInjectionDate || null,
      }).catch(() => {});
    }
  }

  async function handleMasterToggle(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Notifications Blocked',
          'Enable notifications in Settings → Titra Health → Notifications.',
        );
        return;
      }
    }
    store.setMasterEnabled(value);
  }

  function openPicker(slot: ReminderSlot) {
    const d = hhmmToDate(store.slots[slot].time);
    pickerDateRef.current = d;
    setPickerDate(d);
    setPickerTarget(slot);
  }

  function openHydrationPicker(which: 'hydration_start' | 'hydration_end') {
    const time = which === 'hydration_start' ? store.hydration.startTime : store.hydration.endTime;
    const d = hhmmToDate(time);
    pickerDateRef.current = d;
    setPickerDate(d);
    setPickerTarget(which);
  }

  function openProteinPicker(index: 0 | 1 | 2) {
    const d = hhmmToDate(store.protein.times[index]);
    pickerDateRef.current = d;
    setPickerDate(d);
    setPickerTarget(`protein_${index}` as PickerTarget);
  }

  function openCustomPicker(id: string) {
    const cr = store.customReminders.find((r) => r.id === id);
    if (!cr) return;
    const d = hhmmToDate(cr.time);
    pickerDateRef.current = d;
    setPickerDate(d);
    setPickerTarget(`custom_${id}`);
  }

  function closePicker() {
    setPickerTarget(null);
  }

  function confirmPicker() {
    if (!pickerTarget) return;
    if (pickerTarget === 'dose_time') {
      confirmDoseTime();
      return;
    }
    if (pickerTarget === 'hydration_start') {
      store.setHydrationStartTime(dateToHHMM(pickerDateRef.current));
      closePicker();
      return;
    }
    if (pickerTarget === 'hydration_end') {
      store.setHydrationEndTime(dateToHHMM(pickerDateRef.current));
      closePicker();
      return;
    }
    if (pickerTarget === 'protein_0' || pickerTarget === 'protein_1' || pickerTarget === 'protein_2') {
      const index = Number(pickerTarget.split('_')[1]) as 0 | 1 | 2;
      store.setProteinTime(index, dateToHHMM(pickerDateRef.current));
      closePicker();
      return;
    }
    if (typeof pickerTarget === 'string' && pickerTarget.startsWith('custom_')) {
      const id = pickerTarget.slice(7);
      store.updateCustomReminder(id, { time: dateToHHMM(pickerDateRef.current) });
      closePicker();
      return;
    }
    // Standard slot
    store.setSlotTime(pickerTarget as ReminderSlot, dateToHHMM(pickerDateRef.current));
    closePicker();
  }

  function handleAddPreset(preset: typeof CUSTOM_PRESETS[number]) {
    if (store.customReminders.length >= MAX_CUSTOM_REMINDERS) return;
    const id = crypto.randomUUID?.() ?? Date.now().toString();
    store.addCustomReminder({
      id,
      label: preset.label,
      enabled: true,
      time: '09:00',
      icon: preset.icon,
      color: preset.color,
    });
  }

  function handleAddCustom() {
    if (!customLabel.trim()) return;
    if (store.customReminders.length >= MAX_CUSTOM_REMINDERS) return;
    const id = crypto.randomUUID?.() ?? Date.now().toString();
    store.addCustomReminder({
      id,
      label: customLabel.trim(),
      enabled: true,
      time: '09:00',
      icon: 'Bell',
      color: colors.orange,
    });
    setCustomLabel('');
    setShowCustomForm(false);
  }

  function handleDeleteCustom(id: string) {
    Alert.alert('Remove Reminder', 'Are you sure you want to delete this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => store.removeCustomReminder(id) },
    ]);
  }

  // Medication info
  const p = profile;
  const isOnMedication = p?.treatmentStatus === 'on' && !!p.medicationBrand;
  const categories = useMemo(() => getCategories(isOnMedication), [isOnMedication]);
  const brandName = p ? (BRAND_LABEL[p.medicationBrand] ?? p.medicationBrand) : null;
  const freqDays = p?.injectionFrequencyDays;
  const nextDose = p ? computeNextDose(p.lastInjectionDate, freqDays) : null;
  const doseLabel = p
    ? `${brandName} ${p.doseMg} mg · ${freqDays === 1 ? 'daily' : freqDays === 7 ? 'weekly' : freqDays === 14 ? 'biweekly' : `every ${freqDays}d`}`
    : null;

  // Split categories: Nutrition is index 0, the rest follow after Wellness
  const nutritionCategory = categories[0];
  const remainingCategories = categories.slice(1);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <Animated.View style={[s.header, { opacity: headerOpacity, transform: [{ translateY: headerTranslate }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Reminders</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Master toggle card */}
        <Animated.View style={[s.masterCard, { opacity: masterOpacity, transform: [{ translateY: masterTranslate }] }]}>
          <View style={s.masterIconWrap}>
            <Bell size={22} color={colors.orange} />
          </View>
          <View style={s.masterTextWrap}>
            <Text style={s.masterLabel}>Enable Reminders</Text>
            <Text style={s.masterSub}>
              {store.masterEnabled ? 'Reminders are active' : 'Turn on to stay on track'}
            </Text>
          </View>
          <Switch
            value={store.masterEnabled}
            onValueChange={handleMasterToggle}
            trackColor={{ false: colors.isDark ? '#333' : '#DDD', true: colors.orange }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={colors.isDark ? '#333' : '#DDD'}
          />
        </Animated.View>

        {store.masterEnabled && (
          <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentTranslate }] }}>

            {/* ── Nutrition category ── */}
            {nutritionCategory && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>{nutritionCategory.title}</Text>
                  <Text style={s.sectionSub}>{nutritionCategory.subtitle}</Text>
                </View>
                <View style={s.card}>
                  {nutritionCategory.slots.map((meta, i) => {
                    const cfg = store.slots[meta.slot];
                    return (
                      <View key={meta.slot}>
                        {i > 0 && <View style={s.divider} />}
                        <View style={s.slotRow}>
                          <View style={s.slotLeft}>
                            <View style={[s.slotIconWrap, { backgroundColor: meta.color + '18' }]}>
                              <LucideIconByName name={meta.icon} size={18} color={meta.color} />
                            </View>
                            <View style={s.slotTextWrap}>
                              <Text style={[s.slotLabel, !cfg.enabled && s.slotLabelDisabled]}>
                                {meta.label}
                              </Text>
                              {cfg.enabled && (
                                <TouchableOpacity
                                  onPress={() => openPicker(meta.slot)}
                                  activeOpacity={0.7}
                                  hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                                >
                                  <Text style={s.timeInline}>{formatTime(cfg.time)}</Text>
                                </TouchableOpacity>
                              )}
                              {!cfg.enabled && (
                                <Text style={s.slotSub}>{meta.subtitle}</Text>
                              )}
                            </View>
                          </View>
                          <Switch
                            value={cfg.enabled}
                            onValueChange={(v) => store.setSlotEnabled(meta.slot, v)}
                            trackColor={{ false: colors.isDark ? '#333' : '#DDD', true: colors.orange }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor={colors.isDark ? '#333' : '#DDD'}
                            style={s.slotSwitch}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Wellness section (Hydration + Protein) ── */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Wellness</Text>
                <Text style={s.sectionSub}>Healthy habits throughout the day</Text>
              </View>
              <View style={s.card}>

                {/* Hydration row */}
                <View style={s.slotRow}>
                  <View style={s.slotLeft}>
                    <View style={[s.slotIconWrap, { backgroundColor: '#5AC8FA18' }]}>
                      <Droplet size={18} color="#5AC8FA" />
                    </View>
                    <View style={[s.slotTextWrap, { flex: 1 }]}>
                      <Text style={[s.slotLabel, !store.hydration.enabled && s.slotLabelDisabled]}>
                        Hydration Reminders
                      </Text>
                      {!store.hydration.enabled && (
                        <Text style={s.slotSub}>Gentle sip reminders throughout the day</Text>
                      )}
                    </View>
                  </View>
                  <Switch
                    value={store.hydration.enabled}
                    onValueChange={(v) => store.setHydrationEnabled(v)}
                    trackColor={{ false: colors.isDark ? '#333' : '#DDD', true: colors.orange }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={colors.isDark ? '#333' : '#DDD'}
                    style={s.slotSwitch}
                  />
                </View>
                {store.hydration.enabled && (
                  <View style={s.wellnessExpanded}>
                    {/* Start / End time row */}
                    <View style={s.wellnessTimeRow}>
                      <TouchableOpacity
                        onPress={() => openHydrationPicker('hydration_start')}
                        activeOpacity={0.7}
                        style={s.wellnessTimePill}
                      >
                        <Text style={s.wellnessTimeLabel}>From</Text>
                        <Text style={s.timeInline}>{formatTime(store.hydration.startTime)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => openHydrationPicker('hydration_end')}
                        activeOpacity={0.7}
                        style={s.wellnessTimePill}
                      >
                        <Text style={s.wellnessTimeLabel}>To</Text>
                        <Text style={s.timeInline}>{formatTime(store.hydration.endTime)}</Text>
                      </TouchableOpacity>
                    </View>
                    {/* Interval selector */}
                    <View style={s.intervalRow}>
                      {HYDRATION_INTERVALS.map((opt) => {
                        const active = store.hydration.intervalHours === opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            onPress={() => store.setHydrationInterval(opt.value)}
                            activeOpacity={0.7}
                            style={[s.intervalPill, active && s.intervalPillActive]}
                          >
                            <Text style={[s.intervalPillText, active && s.intervalPillTextActive]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={s.wellnessSummary}>
                      Reminders every {store.hydration.intervalHours}h from {formatTime(store.hydration.startTime)} to {formatTime(store.hydration.endTime)}
                    </Text>
                  </View>
                )}

                <View style={s.divider} />

                {/* Protein row */}
                <View style={s.slotRow}>
                  <View style={s.slotLeft}>
                    <View style={[s.slotIconWrap, { backgroundColor: '#FF742A18' }]}>
                      <Utensils size={18} color="#FF742A" />
                    </View>
                    <View style={[s.slotTextWrap, { flex: 1 }]}>
                      <Text style={[s.slotLabel, !store.protein.enabled && s.slotLabelDisabled]}>
                        Protein Check-ins
                      </Text>
                      {!store.protein.enabled && (
                        <Text style={s.slotSub}>Protein-first reminders at each meal</Text>
                      )}
                    </View>
                  </View>
                  <Switch
                    value={store.protein.enabled}
                    onValueChange={(v) => store.setProteinEnabled(v)}
                    trackColor={{ false: colors.isDark ? '#333' : '#DDD', true: colors.orange }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={colors.isDark ? '#333' : '#DDD'}
                    style={s.slotSwitch}
                  />
                </View>
                {store.protein.enabled && (
                  <View style={s.wellnessExpanded}>
                    {PROTEIN_MEALS.map((meal, i) => (
                      <View key={meal} style={s.proteinMealRow}>
                        <Text style={s.proteinMealLabel}>{meal}</Text>
                        <TouchableOpacity
                          onPress={() => openProteinPicker(i as 0 | 1 | 2)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                        >
                          <Text style={s.timeInline}>{formatTime(store.protein.times[i])}</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

              </View>
            </View>

            {/* ── Remaining categories (Health Tracking, Daily Planning) ── */}
            {remainingCategories.map((cat) => (
              <View key={cat.title} style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>{cat.title}</Text>
                  <Text style={s.sectionSub}>{cat.subtitle}</Text>
                </View>
                <View style={s.card}>
                  {cat.slots.map((meta, i) => {
                    const cfg = store.slots[meta.slot];
                    return (
                      <View key={meta.slot}>
                        {i > 0 && <View style={s.divider} />}
                        <View style={s.slotRow}>
                          <View style={s.slotLeft}>
                            <View style={[s.slotIconWrap, { backgroundColor: meta.color + '18' }]}>
                              <LucideIconByName name={meta.icon} size={18} color={meta.color} />
                            </View>
                            <View style={s.slotTextWrap}>
                              <Text style={[s.slotLabel, !cfg.enabled && s.slotLabelDisabled]}>
                                {meta.label}
                              </Text>
                              {cfg.enabled && (
                                <TouchableOpacity
                                  onPress={() => openPicker(meta.slot)}
                                  activeOpacity={0.7}
                                  hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                                >
                                  <Text style={s.timeInline}>{formatTime(cfg.time)}</Text>
                                </TouchableOpacity>
                              )}
                              {!cfg.enabled && (
                                <Text style={s.slotSub}>{meta.subtitle}</Text>
                              )}
                            </View>
                          </View>
                          <Switch
                            value={cfg.enabled}
                            onValueChange={(v) => store.setSlotEnabled(meta.slot, v)}
                            trackColor={{ false: colors.isDark ? '#333' : '#DDD', true: colors.orange }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor={colors.isDark ? '#333' : '#DDD'}
                            style={s.slotSwitch}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Medication section */}
            {isOnMedication && doseLabel && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>Medication</Text>
                  <Text style={s.sectionSub}>Never miss a dose</Text>
                </View>
                <View style={s.card}>
                  <View style={s.slotRow}>
                    <View style={s.slotLeft}>
                      <View style={[s.slotIconWrap, { backgroundColor: 'rgba(10,132,255,0.14)' }]}>
                        <FlaskConical size={18} color="#0A84FF" />
                      </View>
                      <View style={[s.slotTextWrap, { flex: 1 }]}>
                        <Text style={[s.slotLabel, !doseReminderEnabled && s.slotLabelDisabled]}>
                          Dose Reminder
                        </Text>
                        <Text style={s.medDetail}>{doseLabel}</Text>
                        {nextDose && (
                          <View style={s.nextDoseRow}>
                            <View style={[s.nextDoseDot, nextDose === 'Overdue' && s.nextDoseDotOverdue]} />
                            <Text style={[s.medDetail, nextDose === 'Overdue' && s.overdueText]}>
                              Next: {nextDose}
                            </Text>
                          </View>
                        )}
                        {doseReminderEnabled && (
                          <TouchableOpacity
                            onPress={openDoseTimePicker}
                            activeOpacity={0.7}
                            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                          >
                            <Text style={s.timeInline}>{formatTime(doseTimeStr)}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <Switch
                      value={doseReminderEnabled}
                      onValueChange={handleDoseToggle}
                      trackColor={{ false: colors.isDark ? '#333' : '#DDD', true: colors.orange }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor={colors.isDark ? '#333' : '#DDD'}
                      style={s.slotSwitch}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* ── Custom section ── */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Custom</Text>
                <Text style={s.sectionSub}>Your personal reminders</Text>
              </View>

              {/* Preset chips */}
              {store.customReminders.length < MAX_CUSTOM_REMINDERS && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.presetsScroll}
                  contentContainerStyle={s.presetsContent}
                >
                  {CUSTOM_PRESETS.filter(
                    (preset) => !store.customReminders.some((cr) => cr.label === preset.label),
                  ).map((preset) => (
                    <TouchableOpacity
                      key={preset.label}
                      onPress={() => handleAddPreset(preset)}
                      activeOpacity={0.7}
                      style={s.presetChip}
                    >
                      <LucideIconByName name={preset.icon as any} size={14} color={preset.color} />
                      <Text style={s.presetChipText}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Existing custom reminders */}
              {store.customReminders.length > 0 && (
                <View style={s.card}>
                  {store.customReminders.map((cr, i) => (
                    <View key={cr.id}>
                      {i > 0 && <View style={s.divider} />}
                      <View style={s.slotRow}>
                        <View style={s.slotLeft}>
                          <View style={[s.slotIconWrap, { backgroundColor: cr.color + '18' }]}>
                            <LucideIconByName name={cr.icon as any} size={18} color={cr.color} />
                          </View>
                          <View style={[s.slotTextWrap, { flex: 1 }]}>
                            <Text style={[s.slotLabel, !cr.enabled && s.slotLabelDisabled]}>
                              {cr.label}
                            </Text>
                            {cr.enabled && (
                              <TouchableOpacity
                                onPress={() => openCustomPicker(cr.id)}
                                activeOpacity={0.7}
                                hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                              >
                                <Text style={s.timeInline}>{formatTime(cr.time)}</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteCustom(cr.id)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={s.deleteBtn}
                        >
                          <Trash2 size={18} color="#FF3B30" />
                        </TouchableOpacity>
                        <Switch
                          value={cr.enabled}
                          onValueChange={(v) => store.setCustomReminderEnabled(cr.id, v)}
                          trackColor={{ false: colors.isDark ? '#333' : '#DDD', true: colors.orange }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor={colors.isDark ? '#333' : '#DDD'}
                          style={s.slotSwitch}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Inline add form */}
              {showCustomForm && (
                <View style={[s.card, { marginTop: 12 }]}>
                  <View style={s.customFormRow}>
                    <TextInput
                      style={s.customInput}
                      placeholder="Reminder label..."
                      placeholderTextColor={colors.textMuted}
                      value={customLabel}
                      onChangeText={setCustomLabel}
                      maxLength={40}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleAddCustom}
                    />
                    <TouchableOpacity
                      onPress={handleAddCustom}
                      activeOpacity={0.7}
                      style={[s.customDoneBtn, !customLabel.trim() && { opacity: 0.4 }]}
                      disabled={!customLabel.trim()}
                    >
                      <Text style={s.customDoneBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Add button */}
              {store.customReminders.length < MAX_CUSTOM_REMINDERS && !showCustomForm && (
                <TouchableOpacity
                  onPress={() => setShowCustomForm(true)}
                  activeOpacity={0.7}
                  style={s.addCustomBtn}
                >
                  <PlusCircle size={20} color={colors.orange} />
                  <Text style={s.addCustomBtnText}>Add Custom Reminder</Text>
                </TouchableOpacity>
              )}
            </View>

          </Animated.View>
        )}
      </ScrollView>

      {/* Time picker modal - iOS */}
      {Platform.OS === 'ios' && pickerTarget && (
        <Modal transparent animationType="slide" onRequestClose={closePicker}>
          <Pressable style={s.modalBackdrop} onPress={closePicker} />
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <View style={s.pickerHeader}>
              <TouchableOpacity onPress={closePicker} activeOpacity={0.7}>
                <Text style={s.pickerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.pickerTitle}>Set Time</Text>
              <TouchableOpacity onPress={confirmPicker} activeOpacity={0.7}>
                <Text style={s.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerDate}
              mode="time"
              display="spinner"
              onChange={(_, date) => {
                if (date) pickerDateRef.current = date;
              }}
              style={s.picker}
              textColor={colors.textPrimary}
            />
          </View>
        </Modal>
      )}

      {/* Android picker */}
      {Platform.OS === 'android' && pickerTarget && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="default"
          onChange={(_, date) => {
            if (date) {
              pickerDateRef.current = date;
              confirmPicker();
            } else {
              closePicker();
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },

    /* ── Header ──────────────────────────────── */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    headerTitle: {
      color: c.textPrimary,
      fontSize: 17,
      fontWeight: '600',
      fontFamily: FF,
      letterSpacing: -0.2,
    },

    scroll: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },

    /* ── Master toggle ───────────────────────── */
    masterCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderTopColor: c.border,
      borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle,
      borderBottomColor: c.borderSubtle,
    },
    masterIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.isDark ? 'rgba(255,116,42,0.12)' : 'rgba(232,101,42,0.08)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    masterTextWrap: {
      flex: 1,
      marginLeft: 14,
    },
    masterLabel: {
      color: c.textPrimary,
      fontSize: 17,
      fontWeight: '600',
      fontFamily: FF,
      letterSpacing: -0.2,
    },
    masterSub: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: FF,
      marginTop: 2,
    },

    /* ── Sections ────────────────────────────── */
    section: {
      marginTop: 24,
    },
    sectionHeader: {
      marginBottom: 10,
      marginLeft: 4,
    },
    sectionTitle: {
      color: c.textPrimary,
      fontSize: 20,
      fontWeight: '700',
      fontFamily: FF,
      letterSpacing: -0.3,
    },
    sectionSub: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: FF,
      marginTop: 2,
    },

    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderTopColor: c.border,
      borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle,
      borderBottomColor: c.borderSubtle,
      overflow: 'hidden',
    },

    /* ── Slot rows ───────────────────────────── */
    slotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 16,
      paddingRight: 14,
      paddingVertical: 14,
    },
    slotLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    slotIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slotTextWrap: {
      marginLeft: 12,
      gap: 1,
    },
    slotLabel: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '500',
      fontFamily: FF,
      letterSpacing: -0.1,
    },
    slotLabelDisabled: {
      color: c.textMuted,
    },
    slotSub: {
      color: c.textMuted,
      fontSize: 13,
      fontFamily: FF,
    },
    slotSwitch: {
      transform: [{ scale: 0.85 }],
      marginLeft: 8,
    },

    /* ── Time display ────────────────────────── */
    timeInline: {
      color: c.orange,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: FF,
      marginTop: 2,
    },

    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.borderSubtle,
      marginLeft: 64,
    },

    /* ── Wellness expanded area ──────────────── */
    wellnessExpanded: {
      paddingHorizontal: 16,
      paddingBottom: 14,
      paddingTop: 2,
      marginLeft: 48,
    },
    wellnessTimeRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 10,
    },
    wellnessTimePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    wellnessTimeLabel: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: FF,
    },
    wellnessSummary: {
      color: c.textMuted,
      fontSize: 12,
      fontFamily: FF,
      marginTop: 8,
    },

    /* ── Interval pills ──────────────────────── */
    intervalRow: {
      flexDirection: 'row',
      gap: 8,
    },
    intervalPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    },
    intervalPillActive: {
      backgroundColor: c.isDark ? 'rgba(255,116,42,0.2)' : 'rgba(232,101,42,0.12)',
    },
    intervalPillText: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      fontFamily: FF,
    },
    intervalPillTextActive: {
      color: c.orange,
    },

    /* ── Protein meals ───────────────────────── */
    proteinMealRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    proteinMealLabel: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: FF,
    },

    /* ── Medication ──────────────────────────── */
    medDetail: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: FF,
      marginTop: 2,
    },
    nextDoseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 2,
    },
    nextDoseDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#34C759',
    },
    nextDoseDotOverdue: {
      backgroundColor: '#FF3B30',
    },
    overdueText: {
      color: '#FF3B30',
      fontWeight: '600',
    },

    /* ── Custom reminders ────────────────────── */
    presetsScroll: {
      marginBottom: 12,
    },
    presetsContent: {
      gap: 8,
      paddingHorizontal: 2,
    },
    presetChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    },
    presetChipText: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '500',
      fontFamily: FF,
    },
    deleteBtn: {
      padding: 4,
      marginLeft: 4,
    },
    addCustomBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,116,42,0.25)' : 'rgba(232,101,42,0.2)',
      borderStyle: 'dashed',
    },
    addCustomBtnText: {
      color: c.orange,
      fontSize: 15,
      fontWeight: '600',
      fontFamily: FF,
    },
    customFormRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 10,
    },
    customInput: {
      flex: 1,
      color: c.textPrimary,
      fontSize: 16,
      fontFamily: FF,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    customDoneBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: c.orange,
    },
    customDoneBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
      fontFamily: FF,
    },

    /* ── Picker modal ────────────────────────── */
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    pickerSheet: {
      backgroundColor: c.isDark ? '#1C1C1E' : '#FFFFFF',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 32,
    },
    pickerHandle: {
      width: 36,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: w(0.15),
      alignSelf: 'center',
      marginTop: 8,
      marginBottom: 4,
    },
    pickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: w(0.08),
    },
    pickerTitle: {
      color: c.textPrimary,
      fontSize: 17,
      fontWeight: '600',
      fontFamily: FF,
    },
    pickerCancel: {
      color: c.textSecondary,
      fontSize: 17,
      fontFamily: FF,
    },
    pickerDone: {
      color: c.orange,
      fontSize: 17,
      fontWeight: '600',
      fontFamily: FF,
    },
    picker: {
      backgroundColor: c.isDark ? '#1C1C1E' : '#FFFFFF',
    },
  });
};
