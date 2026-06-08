import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Easing,
  createAnimatedComponent,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ClipPath, Defs, Path, Svg } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import { HEALTH_SERVICE_NAME } from '@/lib/health-service';
import type { AppColors } from '@/constants/theme';
import { useHealthData } from '@/contexts/health-data';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { useUiStore } from '@/stores/ui-store';
import { X } from 'lucide-react-native';

const AnimatedPath = createAnimatedComponent(Path);

const FF = 'System';
const ML_PER_OZ = 29.5735;

// ─── Glass geometry (SVG viewBox 0 0 200 270, rendered smaller) ───────────────
const GLASS_TOP = 24;      // y of the rim (fully full)
const GLASS_BOTTOM = 250;  // y of the base (empty)
const GLASS_PATH =
  'M 44 24 L 156 24 Q 166 24 165 34 L 145 240 Q 144 250 134 250 L 66 250 Q 56 250 55 240 L 35 34 Q 34 24 44 24 Z';
const GLASS_VB_H = 270;
const GLASS_RENDER_W = 168;
const GLASS_RENDER_H = 226;
const GLASS_SCALE = GLASS_RENDER_H / GLASS_VB_H;

/** Visual capacity of the glass in oz — a pour at/above this shows a full glass. */
const GLASS_CAP_OZ = 24;

// ─── Amount carousel ─────────────────────────────────────────────────────────
const MAX_OZ = 32;
const OZ_VALUES = Array.from({ length: MAX_OZ }, (_, i) => i + 1); // 1..32 oz
const DEFAULT_OZ_INDEX = 7; // 8 oz
const ITEM_WIDTH = 128;

const WIN = Dimensions.get('window');
const SHEET_PAD = 20;
const CONTENT_W = WIN.width - SHEET_PAD * 2;
const CAROUSEL_SIDE_PAD = (CONTENT_W - ITEM_WIDTH) / 2;

// ─── Beverage carousel ───────────────────────────────────────────────────────
const BEV_ITEM_W = 92;
const BEV_SIDE_PAD = (CONTENT_W - BEV_ITEM_W) / 2;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const scrollNode = (ref: React.MutableRefObject<any>, x: number, animated: boolean) => {
  const node = ref.current;
  if (!node) return;
  if (typeof node.scrollTo === 'function') node.scrollTo({ x, y: 0, animated });
  else if (typeof node.getNode === 'function') node.getNode().scrollTo({ x, y: 0, animated });
};

// ─── Beverage Types ──────────────────────────────────────────────────────────
// Hydration factors based on Beverage Hydration Index (Maughan et al. 2015, AJCN)

type BeverageKey = 'water' | 'coffee' | 'tea' | 'sparkling' | 'electrolytes' | 'juice';

type Beverage = {
  key: BeverageKey;
  label: string;
  image: any;
  /** Counter-rotation (deg) applied to straighten the tilted source art. */
  iconRotation?: string;
  color: string;
  /** Effective hydration per oz consumed (1.0 = same as water). */
  hydrationFactor: number;
};

const BEVERAGES: Beverage[] = [
  { key: 'water',        label: 'Water',        image: require('@/assets/images/beverages/water.png'),        iconRotation: '-12deg', color: '#5B8BF5', hydrationFactor: 1.0  },
  { key: 'coffee',       label: 'Coffee',       image: require('@/assets/images/beverages/coffee.png'),       iconRotation: '0deg',   color: '#A0795D', hydrationFactor: 0.85 },
  { key: 'tea',          label: 'Tea',          image: require('@/assets/images/beverages/tea.png'),          iconRotation: '0deg',   color: '#7DB87D', hydrationFactor: 0.90 },
  { key: 'sparkling',    label: 'Sparkling',    image: require('@/assets/images/beverages/sparkling.png'),    iconRotation: '0deg',   color: '#68C8D7', hydrationFactor: 1.0  },
  { key: 'electrolytes', label: 'Electrolytes', image: require('@/assets/images/beverages/electrolytes.png'), iconRotation: '12deg',  color: '#E8C547', hydrationFactor: 1.20 },
  { key: 'juice',        label: 'Juice',        image: require('@/assets/images/beverages/juice.png'),        iconRotation: '-14deg', color: '#E88B47', hydrationFactor: 0.90 },
];

const HYDRATION_FACTOR_MAP: Record<BeverageKey, number> = Object.fromEntries(
  BEVERAGES.map(b => [b.key, b.hydrationFactor])
) as Record<BeverageKey, number>;

// ─── Component ────────────────────────────────────────────────────────────────

export function WaterLogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const { dispatch, targets, actuals } = useHealthData();

  const alreadyLoggedOz = Math.round(actuals.waterMl / ML_PER_OZ);
  const initialHydrationOz = useRef(0);

  // Running session total of hydration-adjusted oz (preloaded with today's logged water)
  const [effectiveHydrationOz, setEffectiveHydrationOz] = useState(0);

  // The amount currently "in the glass" (carousel + glass-drag, decimal precision)
  const [pourOz, setPourOz] = useState<number>(OZ_VALUES[DEFAULT_OZ_INDEX]);
  const pourOzRef = useRef(pourOz);
  const setPour = (v: number) => { pourOzRef.current = v; setPourOz(v); };

  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedIdxRef = useRef(0);
  const activeBeverage = BEVERAGES[selectedIdx];

  // Last addition info for the transient feedback line
  const [lastAdd, setLastAdd] = useState<{ rawOz: number; bevKey: BeverageKey } | null>(null);

  const dailyTargetOz = targets.waterMl / ML_PER_OZ;
  const displayTotalOz = Math.round(effectiveHydrationOz);
  const goalPct = dailyTargetOz > 0 ? Math.round((effectiveHydrationOz / dailyTargetOz) * 100) : 0;

  const amountRef = useRef<any>(null);
  const bevRef = useRef<any>(null);

  // ─── Liquid animation (sine-wave surface + spring level) ───────────────────
  const phase = useSharedValue(0);
  const surfaceY = useSharedValue(GLASS_BOTTOM);

  useEffect(() => {
    phase.value = withRepeat(withTiming(Math.PI * 2, { duration: 2000, easing: Easing.linear }), -1, false);
  }, []);

  useEffect(() => {
    const frac = Math.min(pourOz / GLASS_CAP_OZ, 1);
    surfaceY.value = withSpring(GLASS_BOTTOM - frac * (GLASS_BOTTOM - GLASS_TOP), { damping: 14, stiffness: 90 });
  }, [pourOz]);

  const frontWaveProps = useAnimatedProps(() => {
    'worklet';
    const y = surfaceY.value;
    const amp = 7;
    const k = (2 * Math.PI) / 140;
    let d = `M 0 ${y + Math.sin(phase.value) * amp}`;
    for (let x = 0; x <= 200; x += 8) {
      d += ` L ${x} ${y + Math.sin(k * x + phase.value) * amp}`;
    }
    d += ` L 200 ${GLASS_BOTTOM + 40} L 0 ${GLASS_BOTTOM + 40} Z`;
    return { d };
  });

  const backWaveProps = useAnimatedProps(() => {
    'worklet';
    const y = surfaceY.value + 3;
    const amp = 5;
    const k = (2 * Math.PI) / 110;
    const off = Math.PI;
    let d = `M 0 ${y + Math.sin(phase.value + off) * amp}`;
    for (let x = 0; x <= 200; x += 8) {
      d += ` L ${x} ${y + Math.sin(k * x + phase.value + off) * amp}`;
    }
    d += ` L 200 ${GLASS_BOTTOM + 40} L 0 ${GLASS_BOTTOM + 40} Z`;
    return { d };
  });

  // ─── Amount carousel ───────────────────────────────────────────────────────
  const draggingGlass = useRef(false);
  const scrollX = useRef(new Animated.Value(DEFAULT_OZ_INDEX * ITEM_WIDTH)).current;
  const onAmountScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (e: any) => {
        if (draggingGlass.current) return; // glass drag is driving the scroll
        const idx = clamp(Math.round(e.nativeEvent.contentOffset.x / ITEM_WIDTH), 0, OZ_VALUES.length - 1);
        const v = OZ_VALUES[idx];
        if (v !== Math.round(pourOzRef.current)) {
          setPour(v);
          Haptics.selectionAsync();
        }
      },
    }
  );

  // ─── Beverage carousel ─────────────────────────────────────────────────────
  const bevScrollX = useRef(new Animated.Value(0)).current;
  const onBevScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: bevScrollX } } }],
    {
      useNativeDriver: true,
      listener: (e: any) => {
        const idx = clamp(Math.round(e.nativeEvent.contentOffset.x / BEV_ITEM_W), 0, BEVERAGES.length - 1);
        if (idx !== selectedIdxRef.current) {
          selectedIdxRef.current = idx;
          setSelectedIdx(idx);
          Haptics.selectionAsync();
        }
      },
    }
  );

  // ─── Glass drag → exact decimal amount ─────────────────────────────────────
  const [dragY, setDragY] = useState<number | null>(null);
  const dragStartOz = useRef(0);
  const dragRangePx = (GLASS_BOTTOM - GLASS_TOP) * GLASS_SCALE;

  const movedRef = useRef(false);
  const glassPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        draggingGlass.current = true;
        movedRef.current = false;
        dragStartOz.current = pourOzRef.current;
      },
      onPanResponderMove: (e, gs) => {
        if (!movedRef.current && Math.abs(gs.dy) < 2) return; // ignore micro-jitter on tap
        if (!movedRef.current) { movedRef.current = true; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
        const dOz = (-gs.dy / dragRangePx) * GLASS_CAP_OZ;
        let v = clamp(dragStartOz.current + dOz, 0.5, MAX_OZ);
        v = Math.round(v * 10) / 10; // one decimal
        setPour(v);
        setDragY(e.nativeEvent.locationY);
        scrollNode(amountRef, (v - 1) * ITEM_WIDTH, false);
      },
      onPanResponderRelease: () => {
        draggingGlass.current = false;
        setDragY(null);
      },
      onPanResponderTerminate: () => {
        draggingGlass.current = false;
        setDragY(null);
      },
    })
  ).current;

  // Drag-to-dismiss (handle only)
  const sheetY = useRef(new Animated.Value(0)).current;

  const commitAndClose = () => {
    const deltaOz = effectiveHydrationOz - initialHydrationOz.current;
    if (deltaOz !== 0) {
      const ml = Math.round(deltaOz * ML_PER_OZ);
      dispatch({ type: 'LOG_WATER', ml });
      if (ml > 0) {
        useHealthKitStore.getState().writeWater(ml).then(synced => {
          if (synced) useUiStore.getState().showHealthSyncToast(`Water saved to ${HEALTH_SERVICE_NAME}`);
        });
      }
    }
    sheetY.setValue(0);
    onClose();
  };

  const handlePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) sheetY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          commitAndClose();
        } else {
          Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
        }
      },
    })
  ).current;

  // Pre-load with today's already-logged amount each time sheet opens
  useEffect(() => {
    if (visible) {
      initialHydrationOz.current = alreadyLoggedOz;
      setEffectiveHydrationOz(alreadyLoggedOz);
      setSelectedIdx(0);
      selectedIdxRef.current = 0;
      setLastAdd(null);
      setPour(OZ_VALUES[DEFAULT_OZ_INDEX]);
      setDragY(null);
      requestAnimationFrame(() => {
        scrollNode(amountRef, DEFAULT_OZ_INDEX * ITEM_WIDTH, false);
        scrollNode(bevRef, 0, false);
      });
    }
  }, [visible]);

  const addBeverage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const factor = HYDRATION_FACTOR_MAP[activeBeverage.key];
    const effective = Math.round(pourOz * factor * 10) / 10;
    setEffectiveHydrationOz(prev => Math.round((prev + effective) * 10) / 10);
    setLastAdd({ rawOz: pourOz, bevKey: activeBeverage.key });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={commitAndClose}>
      <View style={s.container}>

        {/* Backdrop */}
        <Pressable style={s.backdrop} onPress={commitAndClose} />

        {/* Sheet */}
        <Animated.View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: sheetY }] }]}>
          <View pointerEvents="none" style={s.topBorder} />

          {/* Drag handle */}
          <View {...handlePan.panHandlers} style={s.handleHitArea}>
            <View style={s.handle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <View style={{ width: 32 }} />
            <Text style={s.title}>Hydration Log</Text>
            <TouchableOpacity onPress={commitAndClose} style={s.closeBtn} activeOpacity={0.7}>
              <X size={18} color={colors.isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)'} />
            </TouchableOpacity>
          </View>

          {/* Running total */}
          <View style={s.summaryWrap}>
            <Text style={s.summaryTotal} numberOfLines={1}>{displayTotalOz}oz</Text>
            <Text style={s.summarySub} numberOfLines={1}>{goalPct}% of your goal</Text>
            <Text style={[s.feedbackLine, lastAdd ? { color: BEVERAGES.find(b => b.key === lastAdd.bevKey)!.color } : { opacity: 0 }]} numberOfLines={1}>
              {lastAdd ? `Added ${lastAdd.rawOz}oz ${BEVERAGES.find(b => b.key === lastAdd.bevKey)!.label.toLowerCase()}` : ' '}
            </Text>
          </View>

          {/* Glass with animated liquid — drag up/down to set exact amount */}
          <View style={s.glassWrap}>
            <Svg pointerEvents="none" width={GLASS_RENDER_W} height={GLASS_RENDER_H} viewBox="0 0 200 270">
              <Defs>
                <ClipPath id="wls-glass">
                  <Path d={GLASS_PATH} />
                </ClipPath>
              </Defs>

              {/* Empty glass body */}
              <Path d={GLASS_PATH} fill={colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'} />

              {/* Liquid (clipped to glass) */}
              <AnimatedPath animatedProps={backWaveProps} fill={activeBeverage.color} opacity={0.4} clipPath="url(#wls-glass)" />
              <AnimatedPath animatedProps={frontWaveProps} fill={activeBeverage.color} opacity={0.85} clipPath="url(#wls-glass)" />

              {/* Glass outline */}
              <Path
                d={GLASS_PATH}
                stroke={colors.isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.18)'}
                strokeWidth={2.5}
                fill="none"
              />
            </Svg>

            {/* Value bubble that follows the finger while dragging */}
            {dragY !== null && (
              <View pointerEvents="none" style={[s.dragBubble, { top: clamp(dragY - 16, 0, GLASS_RENDER_H - 32), backgroundColor: activeBeverage.color }]}>
                <Text style={s.dragBubbleText}>{pourOz.toFixed(1)}oz</Text>
              </View>
            )}

            {/* Transparent touch overlay — captures the drag gesture */}
            <View style={StyleSheet.absoluteFill} {...glassPan.panHandlers} />
          </View>

          {/* Amount carousel (swipe to choose) */}
          <View style={s.carouselWrap}>
            <Animated.ScrollView
              ref={amountRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM_WIDTH}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={onAmountScroll}
              contentOffset={{ x: DEFAULT_OZ_INDEX * ITEM_WIDTH, y: 0 }}
              contentContainerStyle={{ paddingHorizontal: CAROUSEL_SIDE_PAD }}
            >
              {OZ_VALUES.map((oz, i) => {
                const inputRange = [(i - 1) * ITEM_WIDTH, i * ITEM_WIDTH, (i + 1) * ITEM_WIDTH];
                const opacity = scrollX.interpolate({ inputRange, outputRange: [0.25, 1, 0.25], extrapolate: 'clamp' });
                const scale = scrollX.interpolate({ inputRange, outputRange: [0.55, 1, 0.55], extrapolate: 'clamp' });
                return (
                  <Animated.View key={oz} style={[s.carouselItem, { opacity, transform: [{ scale }] }]}>
                    <Text style={s.carouselText} numberOfLines={1} allowFontScaling={false}>{oz}.0oz</Text>
                  </Animated.View>
                );
              })}
            </Animated.ScrollView>
          </View>

          {/* Add CTA */}
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: activeBeverage.color }]}
            onPress={addBeverage}
            activeOpacity={0.85}
          >
            <Text style={s.addBtnText} numberOfLines={1}>+ {activeBeverage.label}</Text>
          </TouchableOpacity>

          {/* Beverage carousel — centered item is selected */}
          <View style={s.bevCarouselWrap}>
            <Animated.ScrollView
              ref={bevRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={BEV_ITEM_W}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={onBevScroll}
              contentContainerStyle={{ paddingHorizontal: BEV_SIDE_PAD }}
            >
              {BEVERAGES.map((bev, i) => {
                const inputRange = [(i - 1) * BEV_ITEM_W, i * BEV_ITEM_W, (i + 1) * BEV_ITEM_W];
                const opacity = bevScrollX.interpolate({ inputRange, outputRange: [0.45, 1, 0.45], extrapolate: 'clamp' });
                const scale = bevScrollX.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });
                const isActive = i === selectedIdx;
                return (
                  <TouchableOpacity
                    key={bev.key}
                    activeOpacity={0.8}
                    onPress={() => { Haptics.selectionAsync(); scrollNode(bevRef, i * BEV_ITEM_W, true); }}
                  >
                    <Animated.View style={[s.bevItem, { opacity, transform: [{ scale }] }]}>
                      <Image
                        source={bev.image}
                        style={[s.bevIcon, { transform: [{ rotate: bev.iconRotation ?? '0deg' }] }]}
                        resizeMode="contain"
                      />
                      <Text style={[s.bevLabel, isActive && { color: bev.color }]} numberOfLines={1} allowFontScaling={false}>
                        {bev.label}
                      </Text>
                    </Animated.View>
                  </TouchableOpacity>
                );
              })}
            </Animated.ScrollView>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  sheet: {
    backgroundColor: c.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SHEET_PAD,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 16,
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: w(0.10),
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  handleHitArea: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 10,
  },
  handle: {
    width: 44,
    height: 4,
    backgroundColor: c.ringTrack,
    borderRadius: 2,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -0.3,
    fontFamily: FF,
  },

  // Running total
  summaryWrap: {
    alignItems: 'center',
    marginBottom: 2,
  },
  summaryTotal: {
    fontSize: 32,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -1,
    fontFamily: FF,
  },
  summarySub: {
    fontSize: 14,
    fontWeight: '600',
    color: w(0.45),
    fontFamily: FF,
    marginTop: 1,
  },
  feedbackLine: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FF,
    marginTop: 4,
  },

  // Glass
  glassWrap: {
    width: GLASS_RENDER_W,
    height: GLASS_RENDER_H,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dragBubble: {
    position: 'absolute',
    right: -8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  dragBubbleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: FF,
  },

  // Amount carousel
  carouselWrap: {
    marginBottom: 14,
  },
  carouselItem: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselText: {
    fontSize: 32,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -1,
    fontFamily: FF,
    textAlign: 'center',
  },

  // Add CTA
  addBtn: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  addBtnText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    fontFamily: FF,
  },

  // Beverage carousel
  bevCarouselWrap: {
    marginBottom: 4,
  },
  bevItem: {
    width: BEV_ITEM_W,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  bevIcon: {
    width: 60,
    height: 60,
  },
  bevLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: w(0.45),
    fontFamily: FF,
  },
  });
};
