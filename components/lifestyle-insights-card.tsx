import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/contexts/theme-context';
import { useLogStore } from '@/stores/log-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useHealthData } from '@/contexts/health-data';
import { localDateStr } from '@/lib/date-utils';
import { LucideIconByName } from '@/lib/lucide-icon-map';
import {
  runLifestylePipeline,
  type InsightCard,
} from '@/lib/lifestyle-insights';

const H_PAD = 20;             // matches s.content padding in log.tsx
const AUTO_ADVANCE_AFTER_MS = 10_000;
const AUTO_ADVANCE_INTERVAL_MS = 6_000;

export function LifestyleInsightsCard() {
  const { colors } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const foodLogs = useLogStore(s => s.foodLogs);
  const activityLogs = useLogStore(s => s.activityLogs);
  const sideEffectLogs = useLogStore(s => s.sideEffectLogs);
  const injectionLogs = useLogStore(s => s.injectionLogs);
  const hkSteps = useHealthKitStore(s => s.steps);
  const hkSleep = useHealthKitStore(s => s.sleepHours);
  const hkHrv = useHealthKitStore(s => s.hrv);
  const hkRhr = useHealthKitStore(s => s.restingHR);
  const appleHealthEnabled = usePreferencesStore(s => s.appleHealthEnabled);
  const { targets } = useHealthData();

  const todayStr = localDateStr();

  const cards = useMemo(
    () => runLifestylePipeline({
      foodLogs,
      activityLogs,
      sideEffectLogs,
      injectionLogs,
      hk: {
        enabled: appleHealthEnabled,
        steps: hkSteps,
        sleepHours: hkSleep,
        hrv: hkHrv,
        restingHR: hkRhr,
      },
      targets,
      todayStr,
    }),
    [foodLogs, activityLogs, sideEffectLogs, injectionLogs,
     appleHealthEnabled, hkSteps, hkSleep, hkHrv, hkRhr, targets, todayStr],
  );

  if (cards.length === 0) return null;

  return (
    <View style={{ marginBottom: 16, marginTop: 12 }}>
      <Carousel
        cards={cards}
        cardWidth={screenWidth - H_PAD * 2}
        surface={colors.surface}
        border={colors.border}
        textPrimary={colors.textPrimary}
        isDark={colors.isDark}
      />
    </View>
  );
}

function Carousel({
  cards,
  cardWidth,
  surface,
  border,
  textPrimary,
  isDark,
}: {
  cards: InsightCard[];
  cardWidth: number;
  surface: string;
  border: string;
  textPrimary: string;
  isDark: boolean;
}) {
  const [page, setPage] = useState(0);
  const userInteractedAt = useRef<number>(Date.now());
  const listRef = useRef<FlatList<InsightCard>>(null);

  // Reset paging if the card set length changes (avoid out-of-range page index).
  useEffect(() => {
    if (page >= cards.length) {
      setPage(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [cards.length, page]);

  // Auto-advance: rotate to next card every AUTO_ADVANCE_INTERVAL_MS,
  // but only when the user hasn't touched the carousel for AUTO_ADVANCE_AFTER_MS.
  useEffect(() => {
    if (cards.length < 2) return;
    const id = setInterval(() => {
      if (Date.now() - userInteractedAt.current < AUTO_ADVANCE_AFTER_MS) return;
      const next = (page + 1) % cards.length;
      listRef.current?.scrollToOffset({ offset: next * cardWidth, animated: true });
      setPage(next);
    }, AUTO_ADVANCE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [cards.length, cardWidth, page]);

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    if (idx !== page) {
      setPage(idx);
      if (idx >= 0 && idx < cards.length) Haptics.selectionAsync();
    }
  }, [cardWidth, page, cards.length]);

  const onTouchStart = useCallback(() => {
    userInteractedAt.current = Date.now();
  }, []);

  const dotInactive = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';

  const renderItem = useCallback(({ item }: { item: InsightCard }) => (
    <View style={{ width: cardWidth, paddingVertical: 18, paddingHorizontal: 18 }}>
      <CardBody card={item} textPrimary={textPrimary} isDark={isDark} />
    </View>
  ), [cardWidth, textPrimary, isDark]);

  return (
    <View style={{
      borderRadius: 24, backgroundColor: surface,
      borderWidth: 0.5, borderColor: border, overflow: 'hidden',
    }}>
      <FlatList
        ref={listRef}
        data={cards}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        onTouchStart={onTouchStart}
        getItemLayout={(_, index) => ({ length: cardWidth, offset: cardWidth * index, index })}
      />
      {cards.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 14 }}>
          {cards.map((_, i) => (
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
    </View>
  );
}

function CardBody({
  card,
  textPrimary,
  isDark,
}: {
  card: InsightCard;
  textPrimary: string;
  isDark: boolean;
}) {
  const tc = (a: number) => isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const onCtaPress = () => {
    if (!card.cta) return;
    Haptics.selectionAsync();
    router.push(card.cta.route as never);
  };

  return (
    <View>
      {/* Tagline + icon row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <View style={{
          width: 32, height: 32, borderRadius: 10,
          backgroundColor: `${card.iconColor}22`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <LucideIconByName name={card.icon as never} size={18} color={card.iconColor} />
        </View>
        <Text style={{
          fontSize: 11, fontWeight: '800', color: card.iconColor,
          letterSpacing: 1.4, fontFamily: 'System',
        }}>
          {card.tagline}
        </Text>
      </View>

      {/* Title */}
      <Text style={{
        fontSize: 18, fontWeight: '800', color: textPrimary,
        letterSpacing: -0.4, fontFamily: 'System', marginBottom: 6, lineHeight: 24,
      }}>
        {card.title}
      </Text>

      {/* Body */}
      {card.body && (
        <Text style={{
          fontSize: 14, color: tc(0.6), fontFamily: 'System',
          lineHeight: 20, marginBottom: card.stats?.length || card.cta ? 14 : 0,
        }}>
          {card.body}
        </Text>
      )}

      {/* Stat pills */}
      {card.stats && card.stats.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: card.cta ? 14 : 0 }}>
          {card.stats.map((s, i) => (
            <View
              key={i}
              style={{
                flex: 1, paddingVertical: 10, paddingHorizontal: 12,
                borderRadius: 12, backgroundColor: tc(0.06), alignItems: 'center',
              }}
            >
              <Text style={{
                fontSize: 15, fontWeight: '800', color: textPrimary,
                fontFamily: 'System', letterSpacing: -0.3,
              }}>
                {s.value}
              </Text>
              <Text style={{
                fontSize: 11, color: tc(0.5), fontFamily: 'System',
                marginTop: 2, textAlign: 'center',
              }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* CTA */}
      {card.cta && (
        <TouchableOpacity
          onPress={onCtaPress}
          activeOpacity={0.85}
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 14, paddingVertical: 9,
            borderRadius: 12, backgroundColor: card.iconColor,
          }}
        >
          <Text style={{
            fontSize: 14, fontWeight: '700', color: '#FFF',
            fontFamily: 'System',
          }}>
            {card.cta.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
