import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  createAnimatedComponent,
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ClipPath, Defs, Path, Rect, Svg } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useHealthData } from '@/contexts/health-data';

const AnimatedRect = createAnimatedComponent(Rect);

const ORANGE = '#FF742A';
const FF     = 'Inter_400Regular';

const CUP_PATH = 'M 10 10 L 190 10 L 170 230 Q 170 240 160 240 L 40 240 Q 30 240 30 230 Z';

const STEP_SIZES = [4, 8, 12, 16] as const;

// ─── Beverage Types ──────────────────────────────────────────────────────────
// Hydration factors based on Beverage Hydration Index (Maughan et al. 2015, AJCN)

type BeverageKey = 'water' | 'coffee' | 'tea' | 'sparkling' | 'electrolytes' | 'juice';

type Beverage = {
  key: BeverageKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  defaultOz: number;
  /** Effective hydration per oz consumed (1.0 = same as water). */
  hydrationFactor: number;
};

const BEVERAGES: Beverage[] = [
  { key: 'water',        label: 'Water',        icon: 'water-outline',       color: '#5B8BF5', defaultOz: 8,  hydrationFactor: 1.0  },
  { key: 'coffee',       label: 'Coffee',       icon: 'cafe-outline',        color: '#A0795D', defaultOz: 12, hydrationFactor: 0.85 },
  { key: 'tea',          label: 'Tea',          icon: 'leaf-outline',        color: '#7DB87D', defaultOz: 8,  hydrationFactor: 0.90 },
  { key: 'sparkling',    label: 'Sparkling',    icon: 'sparkles-outline',    color: '#68C8D7', defaultOz: 12, hydrationFactor: 1.0  },
  { key: 'electrolytes', label: 'Electrolytes', icon: 'flash-outline',       color: '#E8C547', defaultOz: 20, hydrationFactor: 1.20 },
  { key: 'juice',        label: 'Juice',        icon: 'nutrition-outline',   color: '#E88B47', defaultOz: 8,  hydrationFactor: 0.90 },
];

const HYDRATION_FACTOR_MAP: Record<BeverageKey, number> = Object.fromEntries(
  BEVERAGES.map(b => [b.key, b.hydrationFactor])
) as Record<BeverageKey, number>;

// ─── Quick-Add Presets (beverage-specific) ───────────────────────────────────

type QuickPreset = {
  oz: number;
  icon: keyof typeof Ionicons.glyphMap;
  beverageKey: BeverageKey;
};

const QUICK_PRESETS: QuickPreset[] = [
  { oz: 8,  icon: 'water-outline',     beverageKey: 'water'        },
  { oz: 12, icon: 'cafe-outline',      beverageKey: 'coffee'       },
  { oz: 8,  icon: 'leaf-outline',      beverageKey: 'tea'          },
  { oz: 12, icon: 'sparkles-outline',  beverageKey: 'sparkling'    },
  { oz: 20, icon: 'flash-outline',     beverageKey: 'electrolytes' },
  { oz: 16, icon: 'nutrition-outline', beverageKey: 'juice'        },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function WaterLogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const { dispatch, targets, actuals } = useHealthData();

  const alreadyLoggedOz = Math.round(actuals.waterMl / 29.5735);
  const initialHydrationOz = useRef(0);

  // effectiveHydrationOz is the running total of hydration-adjusted oz
  const [effectiveHydrationOz, setEffectiveHydrationOz] = useState(0);
  const [stepSizeIdx, setStepSizeIdx] = useState(1); // default 8oz
  const stepSize = STEP_SIZES[stepSizeIdx];

  const [selectedBeverage, setSelectedBeverage] = useState<BeverageKey>('water');
  const activeBeverage = BEVERAGES.find(b => b.key === selectedBeverage)!;

  // Last addition info for the feedback badge
  const [lastAdd, setLastAdd] = useState<{ rawOz: number; effectiveOz: number; bevKey: BeverageKey } | null>(null);

  // Drag-to-dismiss
  const sheetY = useRef(new Animated.Value(0)).current;
  const closeSheet = () => { sheetY.setValue(0); onClose(); };
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) sheetY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
        }
      },
    })
  ).current;

  const dailyTargetOz = targets.waterMl / 29.5735;

  // Pre-load with today's already-logged amount each time sheet opens
  useEffect(() => {
    if (visible) {
      initialHydrationOz.current = alreadyLoggedOz;
      setEffectiveHydrationOz(alreadyLoggedOz);
      setSelectedBeverage('water');
      setLastAdd(null);
    }
  }, [visible]);

  // SVG fill level: y=240 fully empty, y=10 fully full
  const fillY = useSharedValue(240);

  useEffect(() => {
    const pct = Math.min(effectiveHydrationOz / dailyTargetOz, 1);
    fillY.value = withSpring(240 - pct * 230, { damping: 15, stiffness: 120 });
  }, [effectiveHydrationOz, dailyTargetOz]);

  const fillProps = useAnimatedProps(() => ({ y: fillY.value }));

  const addBeverage = (rawOz: number, bevKey: BeverageKey) => {
    const factor = HYDRATION_FACTOR_MAP[bevKey];
    const effective = Math.round(rawOz * factor * 10) / 10; // 1 decimal
    setEffectiveHydrationOz(prev => Math.round((prev + effective) * 10) / 10);
    setLastAdd({ rawOz, effectiveOz: effective, bevKey });
  };

  const subtractHydration = (rawOz: number) => {
    const factor = HYDRATION_FACTOR_MAP[selectedBeverage];
    const effective = Math.round(rawOz * factor * 10) / 10;
    setEffectiveHydrationOz(prev => Math.max(0, Math.round((prev - effective) * 10) / 10));
    setLastAdd(null);
  };

  const handleUpdate = () => {
    const deltaOz = effectiveHydrationOz - initialHydrationOz.current;
    if (deltaOz !== 0) {
      dispatch({ type: 'LOG_WATER', ml: Math.round(deltaOz * 29.5735) });
    }
    closeSheet();
  };

  const cycleStepSize = () => setStepSizeIdx(i => (i + 1) % STEP_SIZES.length);

  // Display effective oz rounded for the big number
  const displayOz = Math.round(effectiveHydrationOz);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeSheet}>
      <View style={s.container}>

        {/* Backdrop */}
        <Pressable style={s.backdrop} onPress={closeSheet} />

        {/* Sheet */}
        <Animated.View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20), transform: [{ translateY: sheetY }] }]}>
          <View pointerEvents="none" style={s.topBorder} />

          {/* Drag handle */}
          <View {...panResponder.panHandlers} style={s.handleHitArea}>
            <View style={s.handle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={closeSheet} style={s.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={colors.isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)'} />
            </TouchableOpacity>
            <Text style={s.title}>Hydration Log</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Beverage selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.beverageRow}
            style={s.beverageScroll}
          >
            {BEVERAGES.map(bev => {
              const isActive = bev.key === selectedBeverage;
              return (
                <TouchableOpacity
                  key={bev.key}
                  style={[
                    s.beveragePill,
                    isActive && { backgroundColor: bev.color + '22', borderColor: bev.color },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedBeverage(bev.key);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={bev.icon} size={18} color={isActive ? bev.color : colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'} />
                  <Text style={[
                    s.beveragePillLabel,
                    isActive && { color: bev.color },
                  ]}>
                    {bev.label}
                  </Text>
                  {bev.hydrationFactor !== 1.0 && (
                    <Text style={[
                      s.beverageFactorBadge,
                      isActive && { color: bev.color, opacity: 1 },
                    ]}>
                      {bev.hydrationFactor > 1 ? '+' : ''}{Math.round((bev.hydrationFactor - 1) * 100)}%
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Cup card */}
          <View style={s.cupCard}>

            {/* Label row */}
            <View style={s.cupLabelRow}>
              <Text style={s.cupLabel}>Hydration</Text>
              <Text style={[s.cupCounter, displayOz > 0 && { color: activeBeverage.color }]}>
                {displayOz}oz
              </Text>
            </View>

            {/* SVG cup */}
            <View style={s.cupWrap}>
              <Svg width={200} height={240} viewBox="0 0 200 240">
                <Defs>
                  <ClipPath id="wls-cup-clip">
                    <Path d={CUP_PATH} />
                  </ClipPath>
                </Defs>

                {/* Animated fill */}
                <AnimatedRect
                  x={0}
                  width={200}
                  height={260}
                  fill={activeBeverage.color}
                  opacity={0.72}
                  clipPath="url(#wls-cup-clip)"
                  animatedProps={fillProps}
                />

                {/* Cup outline */}
                <Path
                  d={CUP_PATH}
                  stroke={colors.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)'}
                  strokeWidth={2}
                  fill={colors.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}
                />
              </Svg>

              {/* Centered oz overlay */}
              <View style={s.cupTextOverlay} pointerEvents="none">
                <Text style={s.cupOzNum}>{displayOz}</Text>
                <Text style={s.cupOzUnit}>oz hydration</Text>
              </View>
            </View>

            {/* Feedback badge — shows conversion after adding a beverage */}
            {lastAdd && lastAdd.rawOz !== lastAdd.effectiveOz && (
              <View style={[s.feedbackBadge, { backgroundColor: BEVERAGES.find(b => b.key === lastAdd.bevKey)!.color + '1A' }]}>
                <Text style={[s.feedbackText, { color: BEVERAGES.find(b => b.key === lastAdd.bevKey)!.color }]}>
                  {lastAdd.rawOz}oz {BEVERAGES.find(b => b.key === lastAdd.bevKey)!.label} → {lastAdd.effectiveOz}oz hydration
                </Text>
              </View>
            )}

            {/* Stepper */}
            <View style={s.stepper}>
              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); subtractHydration(stepSize); }}
                activeOpacity={0.7}
              >
                <Text style={s.stepBtnText}>−</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); cycleStepSize(); }} activeOpacity={0.7} style={[s.stepLabelWrap, { backgroundColor: activeBeverage.color + '1F', borderColor: activeBeverage.color + '40' }]}>
                <Text style={[s.stepLabelMain, { color: activeBeverage.color }]}>{stepSize}oz</Text>
                <Text style={[s.stepLabelHint, { color: activeBeverage.color + '88' }]}>tap to change</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); addBeverage(stepSize, selectedBeverage); }}
                activeOpacity={0.7}
              >
                <Text style={s.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>

          </View>

          {/* Quick Add */}
          <Text style={s.sectionLabel}>Quick Add</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsRow}
            style={s.chipsScroll}
          >
            {QUICK_PRESETS.map((preset, idx) => {
              const bev = BEVERAGES.find(b => b.key === preset.beverageKey)!;
              const effectiveOz = Math.round(preset.oz * bev.hydrationFactor * 10) / 10;
              return (
                <TouchableOpacity
                  key={`${preset.beverageKey}-${preset.oz}-${idx}`}
                  style={s.chip}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSelectedBeverage(preset.beverageKey);
                    addBeverage(preset.oz, preset.beverageKey);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name={preset.icon} size={24} color={bev.color} />
                  <Text style={[s.chipLabel, { color: bev.color }]}>+{preset.oz}oz</Text>
                  <Text style={s.chipSublabel}>{bev.label}</Text>
                  {bev.hydrationFactor !== 1.0 && (
                    <Text style={[s.chipEffective, { color: bev.color }]}>→ {effectiveOz}oz</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Update CTA */}
          <TouchableOpacity style={s.updateBtn} onPress={handleUpdate} activeOpacity={0.85}>
            <Text style={s.updateBtnText}>Update</Text>
          </TouchableOpacity>

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
    paddingHorizontal: 20,
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
    paddingBottom: 14,
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
    marginBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -0.3,
    fontFamily: FF,
  },

  // Beverage selector
  beverageScroll: { marginBottom: 16 },
  beverageRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  beveragePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: w(0.08),
    backgroundColor: w(0.03),
  },
  beveragePillLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: w(0.40),
    fontFamily: FF,
  },
  beverageFactorBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: w(0.30),
    fontFamily: FF,
    opacity: 0.7,
  },

  // Cup card
  cupCard: {
    backgroundColor: w(0.05),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  cupLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  cupLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: w(0.55),
    fontFamily: FF,
  },
  cupCounter: {
    fontSize: 22,
    fontWeight: '800',
    color: w(0.30),
    fontFamily: FF,
    letterSpacing: -0.5,
  },

  // Cup SVG area
  cupWrap: {
    width: 200,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cupTextOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cupOzNum: {
    fontSize: 52,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -2,
    fontFamily: FF,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cupOzUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: w(0.50),
    fontFamily: FF,
    marginTop: -4,
  },

  // Feedback badge
  feedbackBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 14,
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FF,
    textAlign: 'center',
  },

  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.borderSubtle,
    borderWidth: 1,
    borderColor: c.ringTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 28,
    fontWeight: '300',
    color: c.textPrimary,
    lineHeight: 32,
    fontFamily: FF,
  },
  stepLabelWrap: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
  },
  stepLabelMain: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FF,
    letterSpacing: -0.3,
  },
  stepLabelHint: {
    fontSize: 9,
    fontWeight: '500',
    fontFamily: FF,
    marginTop: 1,
    letterSpacing: 0.2,
  },

  // Quick Add
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: w(0.30),
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    fontFamily: FF,
    marginBottom: 10,
  },
  chipsScroll: { marginBottom: 20 },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 4,
  },
  chip: {
    width: 82,
    height: 92,
    borderRadius: 16,
    backgroundColor: c.glassOverlay,
    borderWidth: 1,
    borderColor: w(0.09),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FF,
  },
  chipSublabel: {
    fontSize: 9,
    fontWeight: '600',
    color: w(0.35),
    fontFamily: FF,
  },
  chipEffective: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: FF,
    opacity: 0.7,
  },

  // Update CTA
  updateBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  updateBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    fontFamily: FF,
  },
  });
};
