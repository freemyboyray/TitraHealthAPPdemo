import { useCallback, useMemo, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { Heart, Smartphone, X } from 'lucide-react-native';

const FF = 'System';

// ─── Icons ──────────────────────────────────────────────────────────────────

function SyncIcon({ isDark }: { isDark: boolean }) {
  const size = 72;
  const cx = size / 2;
  const cy = size / 2;
  const ringColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)';
  const dotColor = isDark ? 'rgba(90,200,250,0.6)' : 'rgba(90,200,250,0.8)';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <Circle cx={cx} cy={cy} r={32} stroke={ringColor} strokeWidth={1.5} fill="none" />
        <Circle cx={cx} cy={cy} r={26} stroke={dotColor} strokeWidth={2}
          strokeDasharray="3 5" strokeLinecap="round" fill="none" />
      </Svg>
      <Heart size={28} color="#FF2D55" />
    </View>
  );
}

function DevicesIcon({ isDark }: { isDark: boolean }) {
  const size = 72;
  const cx = size / 2;
  const cy = size / 2;
  const ringColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)';
  const dotColor = isDark ? 'rgba(255,149,0,0.6)' : 'rgba(255,149,0,0.8)';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <Circle cx={cx} cy={cy} r={32} stroke={ringColor} strokeWidth={1.5} fill="none" />
        <Circle cx={cx} cy={cy} r={26} stroke={dotColor} strokeWidth={2}
          strokeDasharray="3 5" strokeLinecap="round" fill="none" />
      </Svg>
      <Smartphone size={28} color="#FF9500" />
    </View>
  );
}

// ─── Slide data ─────────────────────────────────────────────────────────────

type Slide = {
  key: string;
  icon: 'health' | 'devices';
  title: string;
  subtitle: string;
  accessibilityLabel: string;
};

const SLIDES: Slide[] = [
  {
    key: 'apple-health',
    icon: 'health',
    title: 'Sync with Apple Health',
    subtitle: 'Pull in weight, activity, sleep, and vitals automatically for smarter insights and personalized tracking.',
    accessibilityLabel: 'Sync with Apple Health',
  },
  {
    key: 'devices',
    icon: 'devices',
    title: 'Supercharge Your Tracking',
    subtitle: 'Connect a smart scale, CGM, or fitness tracker — data flows into Titra automatically via Apple Health.',
    accessibilityLabel: 'Explore compatible devices',
  },
];

// ─── Card Component ─────────────────────────────────────────────────────────

type Props = {
  onConnect: () => void;
  onExplore: () => void;
  onDismiss: () => void;
};

export function AppleHealthPromoCard({ onConnect, onExplore, onDismiss }: Props) {
  const { colors } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [page, setPage] = useState(0);

  // Card width = screen width minus the homepage's horizontal padding (20 each side)
  const cardWidth = screenWidth - 40;

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    if (idx !== page) setPage(idx);
  }, [cardWidth, page]);

  const renderItem = useCallback(({ item }: { item: Slide }) => (
    <TouchableOpacity
      style={{ width: cardWidth }}
      onPress={item.key === 'apple-health' ? onConnect : onExplore}
      activeOpacity={0.82}
      accessibilityLabel={item.accessibilityLabel}
      accessibilityRole="button"
    >
      <View style={s.slideInner}>
        <View style={s.row}>
          {item.icon === 'health'
            ? <SyncIcon isDark={colors.isDark} />
            : <DevicesIcon isDark={colors.isDark} />
          }
          <View style={s.textWrap}>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.subtitle}>{item.subtitle}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  ), [cardWidth, colors.isDark, s, onConnect, onExplore]);

  const dotInactive = colors.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';

  return (
    <View style={s.wrap}>
      {/* Dismiss button */}
      <TouchableOpacity
        style={s.dismissBtn}
        onPress={onDismiss}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Dismiss health promo cards"
        accessibilityRole="button"
      >
        <X size={18} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} />
      </TouchableOpacity>

      <FlatList
        data={SLIDES}
        keyExtractor={(item) => item.key}
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

      {/* Dot indicators */}
      <View style={s.dots}>
        {SLIDES.map((slide, i) => (
          <View
            key={slide.key}
            style={[s.dot, { backgroundColor: i === page ? colors.textPrimary : dotInactive }]}
          />
        ))}
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: {
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: c.isDark ? c.surface : '#FFFFFF',
      borderWidth: 0.5,
      borderColor: c.borderSubtle,
      ...cardElevation(c.isDark),
    },
    dismissBtn: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 2,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: w(0.06),
      alignItems: 'center',
      justifyContent: 'center',
    },
    slideInner: {
      padding: 18,
      paddingBottom: 6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingRight: 28,
    },
    textWrap: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: FF,
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '400',
      color: w(0.45),
      fontFamily: FF,
      lineHeight: 19,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      paddingBottom: 14,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
  });
};
