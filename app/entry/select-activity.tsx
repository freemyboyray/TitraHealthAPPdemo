import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { ChevronLeft, Plus, Trash2, X } from 'lucide-react-native';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { cardElevation } from '@/constants/theme';
import { LucideIconByName } from '@/lib/lucide-icon-map';
import { useActivityPicker } from '@/stores/activity-picker-store';
import {
  buildActivityItems,
  CUSTOM_ACTIVITIES_KEY,
  CUSTOM_ICON_CHOICES,
  MET_ARCHETYPES,
  type ActivityItem,
  type CustomActivity,
} from '@/constants/activities';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLS = SCREEN_WIDTH >= 375 ? 3 : 2;
const GRID_GAP = 12;
const ITEM_WIDTH = (SCREEN_WIDTH - 40 - GRID_GAP * (COLS - 1)) / COLS;

export default function SelectActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const setPendingKey = useActivityPicker((st) => st.setPendingKey);

  const [customActivities, setCustomActivities] = useState<CustomActivity[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMetKey, setNewMetKey] = useState('moderate');
  const [newIcon, setNewIcon] = useState('Activity');

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_ACTIVITIES_KEY).then((raw) => {
      if (!raw) return;
      try { setCustomActivities(JSON.parse(raw)); } catch { /* ignore corrupt cache */ }
    });
  }, []);

  const items = buildActivityItems(customActivities);

  // ── Entrance animation ───────────────────────────────────────────────────
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(12);
  const gridOpacity = useSharedValue(0);
  const gridY = useSharedValue(20);
  useEffect(() => {
    const ease = { duration: 360, easing: Easing.out(Easing.quad) };
    headerOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
    headerY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) });
    gridOpacity.value = withDelay(120, withTiming(1, ease));
    gridY.value = withDelay(120, withTiming(0, ease));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);
  const headerAnim = useAnimatedStyle(() => ({ opacity: headerOpacity.value, transform: [{ translateY: headerY.value }] }));
  const gridAnim = useAnimatedStyle(() => ({ opacity: gridOpacity.value, transform: [{ translateY: gridY.value }] }));

  function choose(key: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingKey(key);
    router.back();
  }

  async function persistCustom(next: CustomActivity[]) {
    setCustomActivities(next);
    await AsyncStorage.setItem(CUSTOM_ACTIVITIES_KEY, JSON.stringify(next));
  }

  function closeAdd() {
    setAddOpen(false);
    setNewName('');
    setNewMetKey('moderate');
    setNewIcon('Activity');
  }

  async function handleAddCustom() {
    const label = newName.trim();
    if (!label) return;
    const archetype = MET_ARCHETYPES.find((a) => a.key === newMetKey) ?? MET_ARCHETYPES[1];
    const item: CustomActivity = { id: `custom_${Date.now()}`, label, icon: newIcon, met: archetype.met };
    await persistCustom([...customActivities, item]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddOpen(false);
    setNewName('');
    setNewMetKey('moderate');
    setNewIcon('Activity');
    setPendingKey(item.id);
    router.back();
  }

  function deleteCustom(item: ActivityItem) {
    persistCustom(customActivities.filter((c) => c.id !== item.key));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <Animated.View style={[s.header, headerAnim]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          activeOpacity={0.7}
          style={s.backBtn}
          hitSlop={12}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Workout type</Text>
        </View>
        <View style={s.headerSpacer} />
      </Animated.View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[gridAnim, s.grid]}>
          {items.map((item) => (
            <View key={item.key} style={{ width: ITEM_WIDTH }}>
              <TouchableOpacity
                onPress={() => choose(item.key)}
                activeOpacity={0.8}
                style={s.tile}
                accessibilityLabel={item.label}
                accessibilityRole="button"
              >
                <LucideIconByName name={item.icon} size={24} color={colors.textPrimary} />
                <Text style={s.tileLabel} numberOfLines={1}>{item.label}</Text>
              </TouchableOpacity>
              {item.custom && (
                <TouchableOpacity
                  onPress={() => deleteCustom(item)}
                  style={s.deleteBadge}
                  hitSlop={8}
                  accessibilityLabel={`Delete ${item.label}`}
                  accessibilityRole="button"
                >
                  <Trash2 size={13} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* Add your own */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAddOpen(true); }}
            activeOpacity={0.8}
            style={[s.tile, s.addTile, { width: ITEM_WIDTH }]}
            accessibilityLabel="Add your own exercise"
            accessibilityRole="button"
          >
            <Plus size={24} color={colors.textSecondary} />
            <Text style={[s.tileLabel, { color: colors.textSecondary }]} numberOfLines={1}>Add your own</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* ── Add custom exercise modal ── */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={closeAdd}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeAdd} />
          <View style={[s.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add exercise</Text>
              <TouchableOpacity onPress={closeAdd} hitSlop={12} accessibilityLabel="Close" accessibilityRole="button">
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TextInput
                style={s.modalInput}
                placeholder="Exercise name"
                placeholderTextColor={colors.textMuted}
                value={newName}
                onChangeText={setNewName}
                maxLength={30}
                autoFocus
                returnKeyType="done"
                accessibilityLabel="Exercise name"
              />

              <Text style={s.modalLabel}>How hard is it, typically?</Text>
              <Text style={s.modalHint}>Sets the calorie estimate. You still set intensity per session.</Text>
              {MET_ARCHETYPES.map((a) => {
                const on = a.key === newMetKey;
                return (
                  <TouchableOpacity
                    key={a.key}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNewMetKey(a.key); }}
                    style={[s.archRow, on && s.archRowOn]}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.archLabel, on && s.archLabelOn]}>{a.label}</Text>
                      <Text style={s.archExample}>{a.example}</Text>
                    </View>
                    <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                  </TouchableOpacity>
                );
              })}

              <Text style={s.modalLabel}>Icon</Text>
              <View style={s.iconRow}>
                {CUSTOM_ICON_CHOICES.map((name) => {
                  const on = name === newIcon;
                  return (
                    <TouchableOpacity
                      key={name}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNewIcon(name); }}
                      style={[s.iconChoice, on && s.iconChoiceOn]}
                      activeOpacity={0.8}
                      accessibilityLabel={`Icon ${name}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <LucideIconByName name={name} size={20} color={on ? colors.textPrimary : colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                onPress={handleAddCustom}
                disabled={!newName.trim()}
                style={[s.modalSave, !newName.trim() && s.modalSaveDisabled]}
                activeOpacity={0.85}
                accessibilityLabel="Add exercise"
                accessibilityRole="button"
              >
                <Text style={s.modalSaveText}>Add exercise</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const elevation = cardElevation(c.isDark);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '700', color: c.textPrimary, letterSpacing: -0.4 },
    headerSpacer: { width: 44 },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 12 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
    tile: {
      height: 92,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 8,
      backgroundColor: c.cardBg,
      ...elevation,
    },
    addTile: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
      shadowOpacity: 0,
      elevation: 0,
    },
    tileLabel: { fontSize: 13, fontWeight: '600', color: c.textPrimary, textAlign: 'center' },
    deleteBadge: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },

    // ── Add-exercise modal ──
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 18,
      maxHeight: '88%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: c.textPrimary, letterSpacing: -0.4 },
    modalInput: {
      fontSize: 17,
      fontWeight: '600',
      color: c.textPrimary,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 20,
    },
    modalLabel: { fontSize: 15, fontWeight: '700', color: c.textPrimary, marginBottom: 4 },
    modalHint: { fontSize: 12, color: c.textMuted, marginBottom: 12 },
    archRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    },
    archRowOn: { borderColor: c.orange, backgroundColor: c.orangeDim },
    archLabel: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    archLabelOn: { color: c.orange },
    archExample: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: c.orange },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.orange },
    iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, marginBottom: 24 },
    iconChoice: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    iconChoiceOn: { borderColor: c.orange },
    modalSave: {
      height: 54,
      borderRadius: 16,
      backgroundColor: c.orange,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    modalSaveDisabled: { opacity: 0.4 },
    modalSaveText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  });
};
