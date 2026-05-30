import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useLogStore } from '@/stores/log-store';
import type { EnergyLog } from '@/stores/log-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { X } from 'lucide-react-native';
import { LucideIconByName } from '@/lib/lucide-icon-map';

const FF = 'System';

const LEVEL_LABELS = ['', 'Depleted', 'Low', 'Steady', 'Good', 'Charged'] as const;
const LEVEL_EMOJIS = ['', '\u{1F6AB}', '\u{1F50B}', '\u{26A1}', '\u{1F4AA}', '\u{1F525}'] as const;
const LEVEL_COLORS = ['', '#E53E3E', '#E8960C', '#F6CB45', '#27AE60', '#27AE60'] as const;

const TIME_SLOTS = [
  { key: 'morning', label: 'Morning', icon: 'Sun' as const },
  { key: 'afternoon', label: 'Afternoon', icon: 'CloudSun' as const },
  { key: 'evening', label: 'Evening', icon: 'Moon' as const },
];

function getDefaultTimeSlot(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function LogEnergyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addEnergyLog, energyLogs } = useLogStore();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [level, setLevel] = useState(0);
  const [timeSlot, setTimeSlot] = useState(getDefaultTimeSlot());
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const todayKey = localDateKey(new Date());
  const todayLogs = useMemo(
    () => energyLogs.filter(l => l.logged_at.startsWith(todayKey)),
    [energyLogs, todayKey],
  );

  const canSave = level >= 1;

  async function handleSave() {
    if (!canSave || loading) return;
    setLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await addEnergyLog(level, timeSlot, note || undefined);
      router.back();
    } finally {
      setLoading(false);
    }
  }

  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14,
        }}
      >
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityLabel="Close"
          accessibilityRole="button"
        >
          <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <X size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={s.headerTitle}>Log Energy</Text>

        <TouchableOpacity
          style={[s.saveBtn, !canSave && { opacity: 0.4 }]}
          onPress={handleSave}
          activeOpacity={0.7}
          disabled={!canSave}
          accessibilityLabel="Save energy level"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={s.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        keyboardDismissMode="on-drag"
      >
        {/* Level picker */}
        <Text style={s.sectionTitle}>How's your energy?</Text>
        <View style={s.levelGrid}>
          {[1, 2, 3, 4, 5].map(v => {
            const selected = level === v;
            const color = LEVEL_COLORS[v];
            return (
              <TouchableOpacity
                key={v}
                style={[
                  s.levelBtn,
                  selected && { backgroundColor: `${color}20`, borderColor: color },
                ]}
                onPress={() => {
                  setLevel(v);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
                accessibilityLabel={`Energy level ${v} of 5, ${LEVEL_LABELS[v]}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={s.levelEmoji}>{LEVEL_EMOJIS[v]}</Text>
                <Text style={[s.levelLabel, selected && { color, fontWeight: '800' }]}>
                  {LEVEL_LABELS[v]}
                </Text>
                <Text style={[s.levelNum, selected && { color }]}>{v}/5</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Time slot */}
        <Text style={[s.sectionTitle, { marginTop: 28 }]}>Time of day</Text>
        <View style={s.slotRow}>
          {TIME_SLOTS.map(slot => {
            const selected = timeSlot === slot.key;
            return (
              <TouchableOpacity
                key={slot.key}
                style={[s.slotBtn, selected && s.slotBtnActive]}
                onPress={() => setTimeSlot(slot.key)}
                activeOpacity={0.7}
                accessibilityLabel={`${slot.label}${selected ? ', selected' : ''}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <LucideIconByName name={slot.icon}
                  size={18}
                  color={selected ? colors.orange : w(0.35)} />
                <Text style={[s.slotLabel, selected && s.slotLabelActive]}>
                  {slot.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Note */}
        <Text style={[s.sectionTitle, { marginTop: 28 }]}>Note (optional)</Text>
        <TextInput
          style={s.noteInput}
          placeholder="e.g. felt sluggish after lunch"
          placeholderTextColor={w(0.25)}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={200}
          accessibilityLabel="Energy note"
        />

        {/* Today's previous entries */}
        {todayLogs.length > 0 && (
          <View style={{ marginTop: 32 }}>
            <Text style={s.sectionTitle}>Today's entries</Text>
            {todayLogs.map(log => (
              <View key={log.id} style={s.entryRow}>
                <Text style={s.entryEmoji}>{LEVEL_EMOJIS[log.level]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.entryLabel}>
                    {LEVEL_LABELS[log.level]} ({log.level}/5)
                  </Text>
                  <Text style={s.entryMeta}>
                    {log.time_slot}{log.note ? ` \u2014 ${log.note}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    headerBtn: {
      width: 38, height: 38, borderRadius: 19,
      overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18, fontWeight: '800', color: c.textPrimary,
      fontFamily: FF,
    },
    saveBtn: {
      backgroundColor: c.orange, borderRadius: 16,
      paddingHorizontal: 16, paddingVertical: 8,
    },
    saveText: {
      fontSize: 15, fontWeight: '700', color: '#FFF', fontFamily: FF,
    },
    sectionTitle: {
      fontSize: 15, fontWeight: '700', color: w(0.5),
      fontFamily: FF, marginBottom: 12, textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    levelGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    levelBtn: {
      width: '30%' as any,
      flexGrow: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: w(0.04),
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    levelEmoji: { fontSize: 28 },
    levelLabel: {
      fontSize: 13, fontWeight: '600', color: w(0.5), fontFamily: FF,
    },
    levelNum: {
      fontSize: 12, fontWeight: '600', color: w(0.3), fontFamily: FF,
    },
    slotRow: {
      flexDirection: 'row',
      gap: 10,
    },
    slotBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: w(0.04),
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    slotBtnActive: {
      backgroundColor: 'rgba(255,116,42,0.1)',
      borderColor: c.orange,
    },
    slotLabel: {
      fontSize: 14, fontWeight: '600', color: w(0.4), fontFamily: FF,
    },
    slotLabelActive: {
      color: c.orange, fontWeight: '700',
    },
    noteInput: {
      backgroundColor: w(0.04),
      borderRadius: 14,
      padding: 14,
      fontSize: 15,
      color: c.textPrimary,
      fontFamily: FF,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: w(0.08),
    },
    entryEmoji: { fontSize: 24 },
    entryLabel: {
      fontSize: 15, fontWeight: '700', color: c.textPrimary, fontFamily: FF,
    },
    entryMeta: {
      fontSize: 13, color: w(0.4), fontFamily: FF, marginTop: 2,
    },
  });
};
