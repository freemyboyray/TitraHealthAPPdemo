import { Ionicons } from '@expo/vector-icons';
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
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { requestNotificationPermission, scheduleDoseReminder, cancelReminder } from '@/lib/notifications';
import { type ReminderSlot, useRemindersStore } from '@/stores/reminders-store';

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
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

type Category = {
  title: string;
  subtitle: string;
  slots: SlotMeta[];
};

function getCategories(isOnMedication: boolean): Category[] {
  const healthSlots: SlotMeta[] = [
    { slot: 'weight_morning', label: 'Morning Weigh-in', subtitle: 'Track daily weight trends', icon: 'scale-outline', color: '#AF52DE' },
  ];
  if (isOnMedication) {
    healthSlots.push({ slot: 'side_effects_evening', label: 'Side Effects Check-in', subtitle: 'Log how you\'re feeling', icon: 'medkit-outline', color: '#FF3B30' });
  }

  return [
    {
      title: 'Nutrition',
      subtitle: 'Stay on top of your meals',
      slots: [
        { slot: 'meals_morning', label: 'Breakfast', subtitle: 'Start your day right', icon: 'sunny-outline', color: '#FF9500' },
        { slot: 'meals_evening', label: 'Dinner', subtitle: 'End the day strong', icon: 'moon-outline', color: '#5856D6' },
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
        { slot: 'daily_plan_morning', label: 'Daily Focus', subtitle: 'See today\'s priorities', icon: 'compass-outline', color: '#5AC8FA' },
      ],
    },
  ];
}

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
type PickerTarget = ReminderSlot | 'dose_time' | null;

export default function RemindersScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { profile, updateProfile } = useProfile();

  const store = useRemindersStore();
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date(2000, 0, 1, 8, 0));
  const pickerDateRef = useRef<Date>(new Date(2000, 0, 1, 8, 0));

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
      await scheduleDoseReminder(
        profile.injectionFrequencyDays ?? 7,
        doseTimeStr,
        brandDisplay,
        profile.lastInjectionDate || null,
      ).catch(() => {});
    } else {
      await cancelReminder('dose_reminder_daily').catch(() => {});
      await cancelReminder('dose_reminder_weekly').catch(() => {});
      await cancelReminder('dose_reminder_weekly_eve').catch(() => {});
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
      if (doseReminderEnabled) {
        const brandDisplay = profile.medicationBrand
          ? (profile.medicationBrand.charAt(0).toUpperCase() + profile.medicationBrand.slice(1))
          : 'GLP-1';
        await scheduleDoseReminder(
          profile.injectionFrequencyDays ?? 7,
          newTime,
          brandDisplay,
          profile.lastInjectionDate || null,
        ).catch(() => {});
      }
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

  function closePicker() {
    setPickerTarget(null);
  }

  function confirmPicker() {
    if (!pickerTarget) return;
    if (pickerTarget === 'dose_time') {
      confirmDoseTime();
      return;
    }
    store.setSlotTime(pickerTarget, dateToHHMM(pickerDateRef.current));
    closePicker();
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

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <Animated.View style={[s.header, { opacity: headerOpacity, transform: [{ translateY: headerTranslate }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Reminders</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Master toggle card */}
        <Animated.View style={[s.masterCard, { opacity: masterOpacity, transform: [{ translateY: masterTranslate }] }]}>
          <View style={s.masterIconWrap}>
            <Ionicons name="notifications" size={22} color={colors.orange} />
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
            {/* Reminder categories */}
            {categories.map((cat) => (
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
                              <Ionicons name={meta.icon} size={18} color={meta.color} />
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
                        <Ionicons name="flask-outline" size={18} color="#0A84FF" />
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
  const elevation = cardElevation(c.isDark);

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
      backgroundColor: c.cardBg,
      borderRadius: 16,
      padding: 16,
      marginBottom: 8,
      borderWidth: c.isDark ? 0.5 : 1,
      borderColor: c.isDark ? w(0.1) : w(0.05),
      ...elevation,
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
      backgroundColor: c.cardBg,
      borderRadius: 16,
      borderWidth: c.isDark ? 0.5 : 1,
      borderColor: c.isDark ? w(0.1) : w(0.05),
      overflow: 'hidden',
      ...elevation,
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
