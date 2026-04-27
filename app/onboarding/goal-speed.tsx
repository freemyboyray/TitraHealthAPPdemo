import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { addWeeks } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const SNAP_VALUES = [0.2, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
const ITEM_W = 56;
const ITEM_MARGIN = 8;
const UNIT_W = ITEM_W + ITEM_MARGIN * 2;

const CONTEXT_NOTES: Record<string, string> = {
  '0.2': 'This slower pace is gentle and sustainable for your journey.',
  '0.5': 'A gentle, sustainable pace - great for long-term success.',
  '1.0': 'A moderate pace with good results.',
  '1.5': 'A moderate pace with good results.',
  '2.0': 'Aggressive - ensure adequate protein and recovery.',
  '2.5': 'Aggressive - ensure adequate protein and recovery.',
  '3.0': 'Aggressive - ensure adequate protein and recovery.',
};

export default function GoalSpeedScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const isStarting = draft.glp1Status !== 'active';
  const total = isStarting ? 10 : 16;
  const stepNum = isStarting ? 9 : 15;
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [speedIdx, setSpeedIdx] = useState(2);
  const speed = SNAP_VALUES[speedIdx];

  const lbsToLose = Math.max(1, (draft.weightLbs ?? 180) - (draft.goalWeightLbs ?? 160));
  const weeks = lbsToLose / speed;
  const goalDate = addWeeks(new Date(), weeks);
  const dateStr = goalDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleContinue = () => {
    updateDraft({ targetWeeklyLossLbs: speed });
    router.push('/onboarding/activity');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={stepNum} total={total} onBack={() => router.back()} />

        <Text style={s.title}>How quickly do you want to reach your goal?</Text>
        <Text style={s.subtitle}>
          (Don't worry - we'll help you stay healthy whatever pace you choose.)
        </Text>

        {/* Forecast chip */}
        <View style={s.chip}>
          <Text style={s.chipText}>Est. Goal Date: {dateStr}</Text>
        </View>

        {/* Big speed display */}
        <View style={s.display}>
          <Text style={s.displayLabel}>Weekly Change</Text>
          <Text style={s.displayValue}>{speed.toFixed(1)} lbs</Text>
        </View>

        {/* Context note */}
        <Text style={s.contextNote}>{CONTEXT_NOTES[speed.toFixed(1)]}</Text>

        {/* Snap selector */}
        <View style={s.selectorRow}>
          {SNAP_VALUES.map((v, i) => {
            const isSelected = i === speedIdx;
            return (
              <TouchableOpacity
                key={v}
                onPress={() => {
                  if (i !== speedIdx) Haptics.selectionAsync();
                  setSpeedIdx(i);
                }}
                activeOpacity={0.7}
                style={[s.snapItem, isSelected && s.snapItemSelected]}>
                <Text style={[s.snapLabel, isSelected && s.snapLabelSelected]}>
                  {v.toFixed(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Track markers */}
        <View style={s.markerRow}>
          <Text style={s.markerText}>Gentle</Text>
          <Text style={s.markerText}>Moderate</Text>
          <Text style={s.markerText}>Fast</Text>
        </View>

        <View style={s.spacer} />
        <ContinueButton onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'Inter_800ExtraBold' },
  subtitle: { fontSize: 15, color: c.textSecondary, marginBottom: 20, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: c.glassOverlay,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 24,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: c.textPrimary, fontFamily: 'Inter_400Regular' },
  display: { alignItems: 'center', marginBottom: 12 },
  displayLabel: { fontSize: 13, color: c.textSecondary, letterSpacing: 0.5, fontFamily: 'Inter_400Regular' },
  displayValue: { fontSize: 52, fontWeight: '800', color: c.textPrimary, marginTop: 4, fontFamily: 'Inter_800ExtraBold' },
  contextNote: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 12,
  },
  snapItem: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.bg,
  },
  snapItemSelected: {
    backgroundColor: '#FF742A',
    borderColor: '#FF742A',
  },
  snapLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_400Regular',
    color: c.textSecondary,
  },
  snapLabelSelected: {
    color: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
  },
  markerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  markerText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
  },
  spacer: { flex: 1 },
});
