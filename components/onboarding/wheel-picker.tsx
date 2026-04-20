import React, { useCallback, useMemo, useRef } from 'react';
import { FlatList, Text, View, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const DEFAULT_ITEM_HEIGHT = 52;
const DEFAULT_VISIBLE_COUNT = 5;
const LOOP_MULTIPLIER = 100; // repeat data this many times for circular effect

type WheelPickerProps = {
  data: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  itemHeight?: number;
  visibleCount?: number;
  /** When true, the picker wraps around so scrolling past the end loops to the start. */
  circular?: boolean;
};

export function WheelPicker({
  data,
  selectedIndex,
  onSelect,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  visibleCount = DEFAULT_VISIBLE_COUNT,
  circular = false,
}: WheelPickerProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const listRef = useRef<FlatList>(null);
  const containerHeight = itemHeight * visibleCount;
  const padding = itemHeight * Math.floor(visibleCount / 2);

  const len = data.length;
  const loopedData = useMemo(() => {
    if (!circular) return data;
    const result: string[] = [];
    for (let i = 0; i < LOOP_MULTIPLIER; i++) {
      result.push(...data);
    }
    return result;
  }, [data, circular]);

  // Start in the middle of the looped data so user can scroll both directions
  const middleOffset = circular ? Math.floor(LOOP_MULTIPLIER / 2) * len : 0;
  const initialIndex = middleOffset + selectedIndex;

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const totalLen = circular ? loopedData.length : data.length;
      const rawIndex = Math.max(0, Math.min(totalLen - 1, Math.round(offset / itemHeight)));
      const realIndex = circular ? rawIndex % len : rawIndex;
      onSelect(realIndex);
    },
    [data.length, len, loopedData.length, itemHeight, onSelect, circular],
  );

  const getRealIndex = (index: number) => circular ? index % len : index;

  const getOpacity = (index: number) => {
    const realIdx = getRealIndex(index);
    const diff = Math.abs(realIdx - selectedIndex);
    // For circular, also check wrapping distance
    const wrappedDiff = circular ? Math.min(diff, len - diff) : diff;
    if (wrappedDiff === 0) return 1;
    if (wrappedDiff === 1) return 0.45;
    return 0.2;
  };

  const getFontSize = (index: number) => {
    const realIdx = getRealIndex(index);
    const diff = Math.abs(realIdx - selectedIndex);
    const wrappedDiff = circular ? Math.min(diff, len - diff) : diff;
    return wrappedDiff === 0 ? 20 : 17;
  };

  const getFontWeight = (index: number): '700' | '400' => {
    const realIdx = getRealIndex(index);
    const diff = Math.abs(realIdx - selectedIndex);
    const wrappedDiff = circular ? Math.min(diff, len - diff) : diff;
    return wrappedDiff === 0 ? '700' : '400';
  };

  return (
    <View style={[s.container, { height: containerHeight }]}>
      <View
        pointerEvents="none"
        style={[s.selectedHighlight, { top: padding, height: itemHeight }]}
      />
      <View pointerEvents="none" style={[s.centerLine, s.topLine, { top: padding - 0.5 }]} />
      <View pointerEvents="none" style={[s.centerLine, s.bottomLine, { top: padding + itemHeight - 0.5 }]} />

      <FlatList
        ref={listRef}
        data={loopedData}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: padding }}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item, index }) => (
          <View style={[s.item, { height: itemHeight }]}>
            <Text
              style={[
                s.itemText,
                {
                  opacity: getOpacity(index),
                  fontSize: getFontSize(index),
                  fontWeight: getFontWeight(index),
                },
              ]}>
              {item}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  selectedHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,116,42,0.10)',
    borderRadius: 8,
    zIndex: 0,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    color: c.textPrimary,
  },
  centerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,116,42,0.25)',
    zIndex: 1,
  },
  topLine: {},
  bottomLine: {},
});
