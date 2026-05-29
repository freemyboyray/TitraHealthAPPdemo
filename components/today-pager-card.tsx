import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import type { EnergyBankResult } from '@/constants/scoring';

import { MedicationStatusTile } from '@/components/today/medication-status-tile';
import type { TransitionPhase } from '@/components/today/medication-status-tile';
import { EnergyBankTile } from '@/components/today/energy-bank-tile';
import { LifestyleHighlightTile } from '@/components/today/lifestyle-highlight-tile';
import { ArticleOfDayTile } from '@/components/today/article-of-day-tile';

import type { FullUserProfile } from '@/constants/user-profile';
import type { ShotPhase, IntradayPhase } from '@/constants/scoring';

const H_PAD = 24;                       // matches the screen content padding
const SLIDE_HEIGHT = 187;
const AUTO_ADVANCE_AFTER_MS = 10_000;
const AUTO_ADVANCE_INTERVAL_MS = 6_000;

type MedicationProps = {
  onTreatment: boolean;
  profile: FullUserProfile;
  medName: string;
  medDose: string | null;
  treatmentDisplayVal: string | null;
  treatmentDisplayLbl: string;
  weightDelta: number | null;
  stat3Val: string;
  stat3Lbl: string;
  todayDayNum: number | null;
  freq: number | null;
  todayInjLogged: boolean;
  rawDaysUntil: number | null;
  daysUntil: number;
  oral: boolean;
  effectiveLastInjectionDate: string | null;
  transitionPhase: TransitionPhase;
  intradayPhase: IntradayPhase | null;
  shotPhaseForLabel: ShotPhase;
  isPast: boolean;
  selectedDate: Date;
  today: Date;
  onPhaseLongPress: () => void;
};

type Props = {
  medication: MedicationProps;
  /** When null (e.g. viewing a past day), the Energy slide is omitted. */
  energy: { result: EnergyBankResult; phase: string } | null;
};

type Slide = { key: string; render: () => React.ReactElement };

export function TodayPagerCard({ medication, energy }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();

  const cardWidth = screenWidth - H_PAD * 2;

  const slides = useMemo<Slide[]>(() => {
    const arr: Slide[] = [
      {
        key: 'medication',
        render: () => (
          <MedicationStatusTile
            onTreatment={medication.onTreatment}
            profile={medication.profile}
            medName={medication.medName}
            medDose={medication.medDose}
            treatmentDisplayVal={medication.treatmentDisplayVal}
            treatmentDisplayLbl={medication.treatmentDisplayLbl}
            weightDelta={medication.weightDelta}
            stat3Val={medication.stat3Val}
            stat3Lbl={medication.stat3Lbl}
            todayDayNum={medication.todayDayNum}
            freq={medication.freq}
            todayInjLogged={medication.todayInjLogged}
            rawDaysUntil={medication.rawDaysUntil}
            daysUntil={medication.daysUntil}
            oral={medication.oral}
            effectiveLastInjectionDate={medication.effectiveLastInjectionDate}
            transitionPhase={medication.transitionPhase}
            intradayPhase={medication.intradayPhase}
            shotPhaseForLabel={medication.shotPhaseForLabel}
            isPast={medication.isPast}
            selectedDate={medication.selectedDate}
            today={medication.today}
            onLongPress={medication.onPhaseLongPress}
          />
        ),
      },
    ];
    if (energy) {
      arr.push({
        key: 'energy',
        render: () => <EnergyBankTile result={energy.result} phase={energy.phase} />,
      });
    }
    arr.push({
      key: 'lifestyle',
      render: () => <LifestyleHighlightTile />,
    });
    arr.push({
      key: 'article',
      render: () => <ArticleOfDayTile />,
    });
    return arr;
  }, [medication, energy]);

  return (
    <View style={s.cardWrap}>
      <View style={[s.cardBody, { backgroundColor: colors.surface }]}>
        <Carousel
          slides={slides}
          cardWidth={cardWidth}
          isDark={colors.isDark}
          textPrimary={colors.textPrimary}
        />
      </View>
    </View>
  );
}

function Carousel({
  slides,
  cardWidth,
  isDark,
  textPrimary,
}: {
  slides: Slide[];
  cardWidth: number;
  isDark: boolean;
  textPrimary: string;
}) {
  const [page, setPage] = useState(0);
  const userInteractedAt = useRef<number>(Date.now());
  const listRef = useRef<FlatList<Slide>>(null);

  // Reset to medication anchor every time the home tab gains focus.
  useFocusEffect(
    useCallback(() => {
      setPage(0);
      // Defer the scroll until after the layout settles.
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }, []),
  );

  // Keep page index in range if the slides count changes (e.g. lifestyle pipeline
  // appears/disappears between renders).
  useEffect(() => {
    if (page >= slides.length) {
      setPage(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [slides.length, page]);

  // Auto-advance: rotate to next slide every AUTO_ADVANCE_INTERVAL_MS, but only
  // when the user hasn't touched the pager for AUTO_ADVANCE_AFTER_MS.
  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => {
      if (Date.now() - userInteractedAt.current < AUTO_ADVANCE_AFTER_MS) return;
      const next = (page + 1) % slides.length;
      listRef.current?.scrollToOffset({ offset: next * cardWidth, animated: true });
      setPage(next);
    }, AUTO_ADVANCE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [slides.length, cardWidth, page]);

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    if (idx !== page) {
      setPage(idx);
      if (idx >= 0 && idx < slides.length) Haptics.selectionAsync();
    }
  }, [cardWidth, page, slides.length]);

  const onTouchStart = useCallback(() => {
    userInteractedAt.current = Date.now();
  }, []);

  const dotInactive = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';

  const renderItem = useCallback(({ item }: { item: Slide }) => (
    <View style={{ width: cardWidth, height: SLIDE_HEIGHT }}>
      {item.render()}
    </View>
  ), [cardWidth]);

  return (
    <View>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(it) => it.key}
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
      {slides.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 14, paddingTop: 4 }}>
          {slides.map((_, i) => (
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

const createStyles = (c: AppColors) => StyleSheet.create({
  cardWrap: {
    borderRadius: 28,
    marginTop: 16,
    marginBottom: 20,
    ...(c.isDark
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }),
  },
  cardBody: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: c.border,
  },
});
