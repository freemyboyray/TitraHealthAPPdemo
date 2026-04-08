import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import type { AppColors } from '@/constants/theme';
import { requestNotificationPermission, scheduleTestNotification } from '@/lib/notifications';
import { type ReminderSlot, useRemindersStore } from '@/stores/reminders-store';

const ORANGE = '#FF742A';

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
  icon: keyof typeof Ionicons.glyphMap;
};

type Category = {
  title: string;
  slots: SlotMeta[];
};

const CATEGORIES: Category[] = [
  {
    title: 'NUTRITION',
    slots: [
      { slot: 'meals_morning', label: 'Breakfast reminder', icon: 'sunny-outline' },
      { slot: 'meals_evening', label: 'Dinner reminder', icon: 'moon-outline' },
    ],
  },
  {
    title: 'HEALTH TRACKING',
    slots: [
      { slot: 'weight_morning', label: 'Morning weigh-in', icon: 'scale-outline' },
      { slot: 'side_effects_evening', label: 'Side effects check-in', icon: 'medkit-outline' },
    ],
  },
  {
    title: 'DAILY PLANNING',
    slots: [
      { slot: 'daily_plan_morning', label: 'Daily focus', icon: 'compass-outline' },
    ],
  },
];

/* ── Time helpers ── */
function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1); // fixed date to avoid "today" boundary issues
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
type PickerTarget = ReminderSlot | null;

export default function RemindersScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useProfile();

  const store = useRemindersStore();
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date(2000, 0, 1, 8, 0));
  const pickerDateRef = useRef<Date>(new Date(2000, 0, 1, 8, 0));
  const [testSent, setTestSent] = useState(false);

  async function handleMasterToggle(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Notifications Blocked',
          'Enable notifications in Settings → TitraHealth → Notifications.',
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
    store.setSlotTime(pickerTarget, dateToHHMM(pickerDateRef.current));
    closePicker();
  }

  async function handleTestNotification() {
    await scheduleTestNotification(
      'TitraHealth Reminder',
      'This is a test - your reminders are working!',
    );
    setTestSent(true);
    setTimeout(() => setTestSent(false), 4000);
    Alert.alert('Test Sent', 'Background the app - notification fires in 5 seconds.');
  }

  // Medication info
  const p = profile;
  const brandName = p ? (BRAND_LABEL[p.medicationBrand] ?? p.medicationBrand) : null;
  const freqDays = p?.injectionFrequencyDays;
  const nextDose = p ? computeNextDose(p.lastInjectionDate, freqDays) : null;
  const doseLabel = p
    ? `${brandName} ${p.doseMg} mg · ${freqDays === 1 ? 'daily' : freqDays === 7 ? 'weekly' : freqDays === 14 ? 'biweekly' : `every ${freqDays}d`}`
    : null;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>REMINDERS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Master toggle */}
        <View style={s.masterCard}>
          <View style={s.masterLeft}>
            <Ionicons name="notifications" size={20} color={ORANGE} />
            <Text style={s.masterLabel}>Enable Reminders</Text>
          </View>
          <Switch
            value={store.masterEnabled}
            onValueChange={handleMasterToggle}
            trackColor={{ false: '#333', true: ORANGE }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#333"
          />
        </View>

        {store.masterEnabled && (
          <>
            {/* Reminder categories */}
            {CATEGORIES.map((cat) => (
              <View key={cat.title}>
                <Text style={s.sectionLabel}>{cat.title}</Text>
                <View style={s.card}>
                  {cat.slots.map((meta, i) => {
                    const cfg = store.slots[meta.slot];
                    return (
                      <View key={meta.slot}>
                        {i > 0 && <View style={s.divider} />}
                        <View style={s.slotRow}>
                          <View style={s.slotLeft}>
                            <View style={s.slotIconWrap}>
                              <Ionicons name={meta.icon} size={16} color={ORANGE} />
                            </View>
                            <Text style={[s.slotLabel, !cfg.enabled && s.slotLabelDisabled]}>
                              {meta.label}
                            </Text>
                          </View>
                          <View style={s.slotRight}>
                            {cfg.enabled && (
                              <TouchableOpacity
                                style={s.timeChip}
                                onPress={() => openPicker(meta.slot)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="time-outline" size={13} color={ORANGE} style={{ marginRight: 4 }} />
                                <Text style={s.timeText}>{formatTime(cfg.time)}</Text>
                              </TouchableOpacity>
                            )}
                            <Switch
                              value={cfg.enabled}
                              onValueChange={(v) => store.setSlotEnabled(meta.slot, v)}
                              trackColor={{ false: '#333', true: ORANGE }}
                              thumbColor="#FFFFFF"
                              ios_backgroundColor="#333"
                              style={s.slotSwitch}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Medication section */}
            {doseLabel && (
              <View>
                <Text style={s.sectionLabel}>MEDICATION</Text>
                <View style={s.card}>
                  <View style={s.medRow}>
                    <View style={s.slotLeft}>
                      <View style={[s.slotIconWrap, { backgroundColor: 'rgba(10,132,255,0.12)' }]}>
                        <Ionicons name="flask-outline" size={16} color="#0A84FF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.slotLabel}>{doseLabel}</Text>
                        {nextDose && (
                          <Text style={s.medSub}>
                            Next dose: {nextDose}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={s.autoBadge}>
                      <Text style={s.autoText}>Auto</Text>
                    </View>
                  </View>
                  <View style={s.medHintRow}>
                    <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                    <Text style={s.medHint}>
                      Dose reminders are scheduled automatically from your treatment plan
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={s.separator} />

            {/* Test button */}
            <TouchableOpacity style={s.testBtn} onPress={handleTestNotification} activeOpacity={0.8}>
              <Ionicons name="notifications-outline" size={18} color={ORANGE} style={{ marginRight: 8 }} />
              <Text style={s.testBtnText}>{testSent ? 'Notification Sent!' : 'Send Test Notification'}</Text>
            </TouchableOpacity>

            <Text style={s.hint}>Background the app after tapping to see the notification.</Text>
          </>
        )}
      </ScrollView>

      {/* Time picker modal - iOS */}
      {Platform.OS === 'ios' && pickerTarget && (
        <Modal transparent animationType="slide" onRequestClose={closePicker}>
          <Pressable style={s.modalBackdrop} onPress={closePicker} />
          <View style={s.pickerSheet}>
            <View style={s.pickerHeader}>
              <TouchableOpacity onPress={closePicker}>
                <Text style={s.pickerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.pickerTitle}>Set Time</Text>
              <TouchableOpacity onPress={confirmPicker}>
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
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '700', letterSpacing: 3.5 },

    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 40 },

    /* Master toggle */
    masterCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.glassOverlay,
      borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16,
      borderWidth: 1,
      borderTopColor: w(0.13), borderLeftColor: c.borderSubtle,
      borderRightColor: w(0.03), borderBottomColor: w(0.02),
      marginBottom: 8,
    },
    masterLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    masterLabel: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },

    /* Sections */
    sectionLabel: {
      color: c.textMuted, fontSize: 11, fontWeight: '700',
      letterSpacing: 2, marginTop: 16, marginBottom: 6, marginLeft: 4,
    },

    card: {
      backgroundColor: c.glassOverlay,
      borderRadius: 16, borderWidth: 1,
      borderTopColor: w(0.13), borderLeftColor: c.borderSubtle,
      borderRightColor: w(0.03), borderBottomColor: w(0.02),
      overflow: 'hidden',
    },

    /* Slot rows */
    slotRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingLeft: 16, paddingRight: 12, paddingVertical: 12,
    },
    slotLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    slotRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    slotIconWrap: {
      width: 30, height: 30, borderRadius: 8,
      backgroundColor: 'rgba(255,116,42,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    slotLabel: { color: c.textPrimary, fontSize: 14, fontWeight: '500', flex: 1 },
    slotLabelDisabled: { color: c.textMuted },
    slotSwitch: { transform: [{ scale: 0.85 }] },

    timeChip: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(255,116,42,0.10)',
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 20,
    },
    timeText: { color: ORANGE, fontSize: 12, fontWeight: '600' },

    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginLeft: 56 },

    /* Medication section */
    medRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingLeft: 16, paddingRight: 16, paddingTop: 14, paddingBottom: 6,
    },
    medSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    autoBadge: {
      backgroundColor: 'rgba(10,132,255,0.12)',
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    },
    autoText: { color: '#0A84FF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    medHintRow: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 6,
      paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4,
    },
    medHint: { color: c.textMuted, fontSize: 12, flex: 1, lineHeight: 16 },

    separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginVertical: 16 },

    testBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,116,42,0.10)',
      borderRadius: 14, paddingVertical: 14,
      borderWidth: 1, borderColor: 'rgba(255,116,42,0.20)',
    },
    testBtnText: { color: ORANGE, fontSize: 15, fontWeight: '600' },
    hint: { color: w(0.3), fontSize: 12, textAlign: 'center', marginTop: 8 },

    /* Picker modal */
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    pickerSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingBottom: 32,
    },
    pickerHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w(0.1),
    },
    pickerTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },
    pickerCancel: { color: w(0.5), fontSize: 15 },
    pickerDone: { color: ORANGE, fontSize: 15, fontWeight: '600' },
    picker: { backgroundColor: c.surface },
  });
};
