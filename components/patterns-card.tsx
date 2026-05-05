import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, ListRenderItemInfo } from 'react-native';
// FlatList from gesture-handler integrates with the parent ScrollView's pan
// gesture, so horizontal paging swipes don't get stolen by the vertical scroll.
import { FlatList } from 'react-native-gesture-handler';
import { useAppTheme } from '@/contexts/theme-context';
import { useLogStore } from '@/stores/log-store';
import { computeNutritionPatterns, type NutritionPattern } from '@/stores/insights-store';
import { ComparisonRings } from './comparison-rings';
import { PremiumGate } from './ui/premium-gate';

const HORIZONTAL_PADDING = 20; // matches s.content padding in log.tsx

export function PatternsCard() {
  const { colors } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const foodLogs = useLogStore(s => s.foodLogs);
  const sideEffectLogs = useLogStore(s => s.sideEffectLogs);
  const injectionLogs = useLogStore(s => s.injectionLogs);

  const result = useMemo(
    () => computeNutritionPatterns(foodLogs, sideEffectLogs, injectionLogs),
    [foodLogs, sideEffectLogs, injectionLogs],
  );

  // Hide entirely until user has at least some logging activity to motivate it
  const totalFoodDays = useMemo(
    () => new Set(foodLogs.map(f => f.logged_at?.slice(0, 10))).size,
    [foodLogs],
  );
  const totalSeDays = useMemo(
    () => new Set(sideEffectLogs.map(s => s.logged_at?.slice(0, 10))).size,
    [sideEffectLogs],
  );
  if (totalFoodDays < 3 && totalSeDays < 3) return null;

  return (
    <PremiumGate
      feature="patterns"
      variant="soft"
      title="Trends"
      teaser="See how your eating affects side effects"
    >
      <PatternsCardInner
        result={result}
        screenWidth={screenWidth}
        textPrimary={colors.textPrimary}
        surface={colors.surface}
        border={colors.border}
        isDark={colors.isDark}
      />
    </PremiumGate>
  );
}

function PatternsCardInner({
  result,
  screenWidth,
  textPrimary,
  surface,
  border,
  isDark,
}: {
  result: ReturnType<typeof computeNutritionPatterns>;
  screenWidth: number;
  textPrimary: string;
  surface: string;
  border: string;
  isDark: boolean;
}) {
  const [page, setPage] = useState(0);
  const cardWidth = screenWidth - HORIZONTAL_PADDING * 2;

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    if (idx !== page) setPage(idx);
  }, [cardWidth, page]);

  const renderItem = useCallback(({ item: p }: ListRenderItemInfo<NutritionPattern>) => (
    <View style={{ width: cardWidth, paddingVertical: 22, paddingHorizontal: 18 }}>
      <ComparisonRings
        pctWith={p.pctWith}
        pctWithout={p.pctWithout}
        daysWith={p.daysWith}
        daysWithEffect={p.daysWithEffect}
        daysWithout={p.daysWithout}
        daysWithoutEffect={p.daysWithoutEffect}
        triggerLabel={p.triggerLabel}
        effectLabel={p.effectLabel}
      />
    </View>
  ), [cardWidth]);

  const dotInactive = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 20, fontWeight: '800', color: textPrimary,
          letterSpacing: -0.5, marginTop: 12, marginBottom: 16,
          fontFamily: 'System',
        }}
      >
        Trends
      </Text>
      <View style={{
        borderRadius: 24, backgroundColor: surface,
        borderWidth: 0.5, borderColor: border, overflow: 'hidden',
      }}>
        {result.hasEnoughData && result.patterns.length > 0 ? (
          <>
            <FlatList
              data={result.patterns}
              keyExtractor={(p) => `${p.triggerKey}-${p.effectType}`}
              renderItem={renderItem}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardWidth}
              snapToAlignment="start"
              decelerationRate="fast"
              onMomentumScrollEnd={onMomentumEnd}
              getItemLayout={(_, index) => ({ length: cardWidth, offset: cardWidth * index, index })}
            />
            {result.patterns.length > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 14 }}>
                {result.patterns.map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: i === page ? textPrimary : dotInactive,
                    }}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={{ paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center' }}>
            <Text style={{ fontSize: 15, color: textPrimary, opacity: 0.5, textAlign: 'center', lineHeight: 21, fontFamily: 'System' }}>
              Not enough data yet. Trends show up after 5 days with and 5 days without a trigger.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
