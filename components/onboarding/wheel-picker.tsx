import React, { useCallback, useRef } from 'react';
import { FlatList, Text, View, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

const DEFAULT_ITEM_HEIGHT = 52;
const DEFAULT_VISIBLE_COUNT = 5;

type WheelPickerProps = {
  data: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  itemHeight?: number;
  visibleCount?: number;
};

export function WheelPicker({
  data,
  selectedIndex,
  onSelect,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  visibleCount = DEFAULT_VISIBLE_COUNT,
}: WheelPickerProps) {
  const listRef = useRef<FlatList>(null);
  const containerHeight = itemHeight * visibleCount;
  const padding = itemHeight * Math.floor(visibleCount / 2);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const index = Math.max(0, Math.min(data.length - 1, Math.round(offset / itemHeight)));
      onSelect(index);
    },
    [data.length, itemHeight, onSelect],
  );

  const getOpacity = (index: number) => {
    const diff = Math.abs(index - selectedIndex);
    if (diff === 0) return 1;
    if (diff === 1) return 0.55;
    return 0.25;
  };

  const getFontSize = (index: number) => {
    return Math.abs(index - selectedIndex) === 0 ? 20 : 17;
  };

  return (
    <View style={[s.container, { height: containerHeight }]}>
      {/* Center selector lines */}
      <View pointerEvents="none" style={[s.centerLine, s.topLine, { top: padding - 0.5 }]} />
      <View pointerEvents="none" style={[s.centerLine, s.bottomLine, { top: padding + itemHeight - 0.5 }]} />

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: padding }}
        initialScrollIndex={selectedIndex}
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
                  fontWeight: Math.abs(index - selectedIndex) === 0 ? '700' : '400',
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

const s = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    color: '#1A1A1A',
  },
  centerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.12)',
    zIndex: 1,
  },
  topLine: {},
  bottomLine: {},
});
