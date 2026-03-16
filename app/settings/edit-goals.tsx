import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent,
  Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppColors } from '@/constants/theme';
import { addWeeks } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';

const ORANGE = '#FF742A';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_W = 32;
const TICK_SPACING = 8;
const UNIT_W = ITEM_W + TICK_SPACING;

const SNAP_VALUES = [0.2, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

const CONTEXT_NOTES: Record<string, string> = {
  '0.2': 'This slower pace is gentle and sustainable for your journey.',
  '0.5': 'A gentle, sustainable pace — great for long-term success.',
  '1.0': 'A moderate pace with good results.',
  '1.5': 'A moderate pace with good results.',
  '2.0': 'Aggressive — ensure adequate protein and recovery.',
  '2.5': 'Aggressive — ensure adequate protein and recovery.',
  '3.0': 'Aggressive — ensure adequate protein and recovery.',
};

export default function EditGoalsScreen() {
  const { profile, updateProfile } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  if (!profile) return null;

  const currentLbs = profile.weightLbs ?? 180;
  const minLbs = Math.max(80, Math.round(currentLbs - 80));
  const maxLbs = Math.round(currentLbs - 5);
  const count = maxLbs - minLbs + 1;

  const initialGoalLbs = Math.min(Math.max(profile.goalWeightLbs ?? Math.round(currentLbs - 20), minLbs), maxLbs);
  const [selectedLbs, setSelectedLbs] = useState(initialGoalLbs);

  const defaultSpeedIdx = Math.max(0, SNAP_VALUES.indexOf(profile.targetWeeklyLossLbs ?? 1.0));
  const [speedIdx, setSpeedIdx] = useState(defaultSpeedIdx === -1 ? 2 : defaultSpeedIdx);

  const [saving, setSaving] = useState(false);
  const listRef = useRef<FlatList>(null);

  const speed = SNAP_VALUES[speedIdx];
  const lbsToLose = Math.max(1, currentLbs - selectedLbs);
  const weeks = lbsToLose / speed;
  const goalDate = addWeeks(new Date(), weeks);
  const dateStr = goalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const unit = profile.unitSystem ?? 'imperial';
  const displayValue = unit === 'imperial'
    ? `${selectedLbs} lbs`
    : `${Math.round(selectedLbs * 0.453592)} kg`;

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.x;
      const idx = Math.max(0, Math.min(count - 1, Math.round(offset / UNIT_W)));
      setSelectedLbs(minLbs + idx);
    },
    [count, minLbs],
  );

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    await updateProfile({
      goalWeightLbs: selectedLbs,
      goalWeightKg: Math.round(selectedLbs * 0.453592 * 10) / 10,
      targetWeeklyLossLbs: SNAP_VALUES[speedIdx],
    });
    router.back();
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>GOALS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Goal Weight */}
        <Text style={s.sectionLabel}>Goal Weight</Text>

        <View style={s.display}>
          <Text style={s.displaySmall}>Dream Weight</Text>
          <Text style={s.displayValue}>{displayValue}</Text>
        </View>

        <View style={s.rulerContainer}>
          <View style={s.indicator} />
          <FlatList
            ref={listRef}
            data={Array.from({ length: count }, (_, i) => minLbs + i)}
            keyExtractor={(item) => String(item)}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={UNIT_W}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: SCREEN_WIDTH / 2 - UNIT_W / 2 }}
            initialScrollIndex={initialGoalLbs - minLbs}
            getItemLayout={(_, index) => ({ length: UNIT_W, offset: UNIT_W * index, index })}
            onMomentumScrollEnd={handleScroll}
            renderItem={({ item }) => {
              const isMajor = item % 10 === 0;
              const isMid = item % 5 === 0;
              return (
                <View style={[s.tick, { width: UNIT_W }]}>
                  <View style={[s.tickLine, isMajor && s.tickMajor, isMid && !isMajor && s.tickMid]} />
                  {isMajor && <Text style={s.tickLabel}>{item}</Text>}
                </View>
              );
            }}
          />
        </View>

        {/* Weekly Loss Rate */}
        <Text style={[s.sectionLabel, { marginTop: 8 }]}>Weekly Loss Rate</Text>

        <View style={s.chip}>
          <Text style={s.chipText}>Est. Goal Date: {dateStr}</Text>
        </View>

        <View style={s.goalDisplay}>
          <Text style={s.goalDisplayLabel}>Weekly Change</Text>
          <Text style={s.goalDisplayValue}>{speed.toFixed(1)} lbs</Text>
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
          <Text style={s.markerText}>🚶 Gentle</Text>
          <Text style={s.markerText}>🚗 Moderate</Text>
          <Text style={s.markerText}>🚀 Fast</Text>
        </View>

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
  sectionLabel: { fontSize: 16, fontWeight: '700', color: c.textPrimary, marginBottom: 16 },
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
  goalDisplayValue: { fontSize: 48, fontWeight: '800', color: c.textPrimary, marginTop: 4 },
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
  footer: { padding: 16, paddingBottom: 8 },
  saveBtn: {
    backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
