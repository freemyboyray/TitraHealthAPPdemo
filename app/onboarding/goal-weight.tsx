import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
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
import { useProfile } from '@/contexts/profile-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_W = 32;
const TICK_SPACING = 8;
const UNIT_W = ITEM_W + TICK_SPACING;

export default function GoalWeightScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const unit = draft.unitSystem ?? 'imperial';

  // Build ruler range: current - 60 to current - 5
  const currentLbs = draft.weightLbs ?? 180;
  const minLbs = Math.max(80, Math.round(currentLbs - 80));
  const maxLbs = Math.round(currentLbs - 5);
  const count = maxLbs - minLbs + 1;

  const [selectedLbs, setSelectedLbs] = useState(Math.round(currentLbs - 20));
  const listRef = useRef<FlatList>(null);

  const displayValue =
    unit === 'imperial'
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

  const [metricUnit, setMetricUnit] = useState(unit);

  const handleContinue = () => {
    const goalWeightKg = Math.round(selectedLbs * 0.453592 * 10) / 10;
    updateDraft({ goalWeightLbs: selectedLbs, goalWeightKg });
    router.push('/onboarding/goal-speed');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={10} total={14} onBack={() => router.back()} />

        <Text style={s.title}>Set your goal weight.</Text>
        <Text style={s.subtitle}>We'll use this to guide your progress and keep your plan on track.</Text>

        <View style={s.display}>
          <Text style={s.displaySmall}>Dream Weight</Text>
          <Text style={s.displayValue}>{displayValue}</Text>
        </View>

        {/* Unit toggle */}
        <View style={s.toggle}>
          <TouchableOpacity
            style={[s.toggleBtn, metricUnit === 'imperial' && s.toggleBtnActive]}
            onPress={() => setMetricUnit('imperial')}>
            <Text style={[s.toggleText, metricUnit === 'imperial' && s.toggleTextActive]}>lbs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, metricUnit === 'metric' && s.toggleBtnActive]}
            onPress={() => setMetricUnit('metric')}>
            <Text style={[s.toggleText, metricUnit === 'metric' && s.toggleTextActive]}>kg</Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal ruler */}
        <View style={s.rulerContainer}>
          {/* Center indicator */}
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
            initialScrollIndex={selectedLbs - minLbs}
            getItemLayout={(_, index) => ({ length: UNIT_W, offset: UNIT_W * index, index })}
            onMomentumScrollEnd={handleScroll}
            renderItem={({ item, index }) => {
              const isMajor = item % 10 === 0;
              const isMid = item % 5 === 0;
              return (
                <View style={[s.tick, { width: UNIT_W }]}>
                  <View
                    style={[
                      s.tickLine,
                      isMajor && s.tickMajor,
                      isMid && !isMajor && s.tickMid,
                    ]}
                  />
                  {isMajor && <Text style={s.tickLabel}>{item}</Text>}
                </View>
              );
            }}
          />
        </View>

        <ContinueButton onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#1A1A1A', marginBottom: 8, lineHeight: 34 },
  subtitle: { fontSize: 15, color: '#666666', marginBottom: 24, lineHeight: 22 },
  display: { alignItems: 'center', marginBottom: 16 },
  displaySmall: { fontSize: 13, color: '#888', letterSpacing: 0.5 },
  displayValue: { fontSize: 42, fontWeight: '800', color: '#1A1A1A', marginTop: 4 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    padding: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#1A1A1A' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#888' },
  toggleTextActive: { color: '#FFFFFF' },
  rulerContainer: {
    height: 72,
    position: 'relative',
    marginBottom: 32,
    marginHorizontal: -24,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: '50%',
    width: 2,
    height: 48,
    backgroundColor: '#1A1A1A',
    zIndex: 2,
    marginLeft: -1,
  },
  tick: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  tickLine: {
    width: 1.5,
    height: 18,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  tickMid: { height: 26, backgroundColor: 'rgba(0,0,0,0.3)' },
  tickMajor: { height: 36, backgroundColor: '#1A1A1A', width: 2 },
  tickLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
});
