import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import type { AppColors } from '@/constants/theme';
import { scheduleTestNotification } from '@/lib/notifications';
import { type ReminderType, useRemindersStore } from '@/stores/reminders-store';

const ORANGE = '#FF742A';

type ReminderRow = {
  type: ReminderType;
  label: string;
  slots: { label: string; index: number }[];
};

const ROWS: ReminderRow[] = [
  {
    type: 'meals',
    label: 'Log Meals',
    slots: [
      { label: 'Morning', index: 0 },
      { label: 'Evening', index: 1 },
    ],
  },
  {
    type: 'weight',
    label: 'Log Weight',
    slots: [{ label: 'Morning', index: 0 }],
  },
  {
    type: 'sideEffects',
    label: 'Log Side Effects',
    slots: [{ label: 'Evening', index: 0 }],
  },
  {
    type: 'dailyPlan',
    label: 'Check Daily Plan',
    slots: [{ label: 'Morning', index: 0 }],
  },
];

function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 8, m ?? 0, 0, 0);
  return d;
}

function dateToHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = (h ?? 0) >= 12 ? 'PM' : 'AM';
  const hour = ((h ?? 0) % 12) || 12;
  return `${hour}:${String(m ?? 0).padStart(2, '0')} ${period}`;
}

type PickerTarget = { type: ReminderType; index: number; current: string } | null;

export default function RemindersScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const store = useRemindersStore();
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
  const [testSent, setTestSent] = useState(false);

  function openPicker(type: ReminderType, index: number, current: string) {
    setPickerDate(hhmmToDate(current));
    setPickerTarget({ type, index, current });
  }

  function closePicker() {
    setPickerTarget(null);
  }

  function confirmPicker(date: Date) {
    if (!pickerTarget) return;
    store.setTime(pickerTarget.type, pickerTarget.index, dateToHHMM(date));
    closePicker();
  }

  async function handleTestNotification() {
    await scheduleTestNotification(
      'TitraHealth Reminder',
      'This is a test — your reminders are working!',
    );
    setTestSent(true);
    setTimeout(() => setTestSent(false), 4000);
    Alert.alert('Test Sent', 'Background the app — notification fires in 5 seconds.');
  }

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

        {ROWS.map((row) => {
          const config = store[row.type];
          return (
            <View key={row.type} style={s.card}>
              {/* Toggle row */}
              <View style={s.cardHeader}>
                <Text style={s.cardLabel}>{row.label}</Text>
                <Switch
                  value={config.enabled}
                  onValueChange={(v) => store.setEnabled(row.type, v)}
                  trackColor={{ false: '#333', true: ORANGE }}
                  thumbColor={colors.textPrimary}
                  ios_backgroundColor="#333"
                />
              </View>

              {/* Time slots — only when enabled */}
              {config.enabled && row.slots.map((slot) => (
                <TouchableOpacity
                  key={slot.index}
                  style={s.timeRow}
                  onPress={() => openPicker(row.type, slot.index, config.times[slot.index] ?? '08:00')}
                  activeOpacity={0.7}>
                  <Text style={s.slotLabel}>{slot.label}</Text>
                  <View style={s.timeChip}>
                    <Ionicons name="time-outline" size={14} color={ORANGE} style={{ marginRight: 4 }} />
                    <Text style={s.timeText}>{formatTime(config.times[slot.index] ?? '08:00')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        <View style={s.divider} />

        {/* Test button */}
        <TouchableOpacity style={s.testBtn} onPress={handleTestNotification} activeOpacity={0.8}>
          <Ionicons name="notifications-outline" size={18} color={ORANGE} style={{ marginRight: 8 }} />
          <Text style={s.testBtnText}>{testSent ? 'Notification Sent!' : 'Send Test Notification (5s)'}</Text>
        </TouchableOpacity>

        <Text style={s.hint}>Background the app after tapping to see the notification.</Text>
      </ScrollView>

      {/* Time picker modal — iOS */}
      {Platform.OS === 'ios' && pickerTarget && (
        <Modal transparent animationType="slide" onRequestClose={closePicker}>
          <Pressable style={s.modalBackdrop} onPress={closePicker} />
          <View style={s.pickerSheet}>
            <View style={s.pickerHeader}>
              <TouchableOpacity onPress={closePicker}>
                <Text style={s.pickerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.pickerTitle}>Set Time</Text>
              <TouchableOpacity onPress={() => confirmPicker(pickerDate)}>
                <Text style={s.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerDate}
              mode="time"
              display="spinner"
              onChange={(_, date) => date && setPickerDate(date)}
              style={s.picker}
              textColor={colors.textPrimary}
            />
          </View>
        </Modal>
      )}

      {/* Android inline picker */}
      {Platform.OS === 'android' && pickerTarget && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="default"
          onChange={(_, date) => {
            if (date) confirmPicker(date);
            else closePicker();
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
    content: { padding: 16, gap: 12 },

    card: {
      backgroundColor: c.glassOverlay,
      borderRadius: 16,
      borderWidth: 1,
      borderTopColor: w(0.13),
      borderLeftColor: c.borderSubtle,
      borderRightColor: w(0.03),
      borderBottomColor: w(0.02),
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
    },
    cardLabel: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },

    timeRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle,
    },
    slotLabel: { color: w(0.5), fontSize: 13 },
    timeChip: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(255,116,42,0.12)',
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 20,
    },
    timeText: { color: '#FF742A', fontSize: 13, fontWeight: '600' },

    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginVertical: 8 },

    testBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,116,42,0.12)',
      borderRadius: 14, paddingVertical: 14,
      borderWidth: 1, borderColor: 'rgba(255,116,42,0.25)',
    },
    testBtnText: { color: '#FF742A', fontSize: 15, fontWeight: '600' },
    hint: { color: w(0.3), fontSize: 12, textAlign: 'center', marginTop: 8 },

    // Picker modal
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
    pickerDone: { color: '#FF742A', fontSize: 15, fontWeight: '600' },
    picker: { backgroundColor: c.surface },
  });
};
