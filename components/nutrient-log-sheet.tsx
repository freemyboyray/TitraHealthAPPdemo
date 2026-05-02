import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const ORANGE = '#FF742A';
const FF = 'System';

type NutrientConfig = {
  label: string;
  unit: string;
  color: string;
  stepSizes: readonly number[];
  defaultStepIdx: number;
};

const NUTRIENT_CONFIGS: Record<string, NutrientConfig> = {
  protein: {
    label: 'Protein',
    unit: 'g',
    color: '#FF742A',
    stepSizes: [1, 5, 10, 25],
    defaultStepIdx: 1,
  },
  fiber: {
    label: 'Fiber',
    unit: 'g',
    color: '#27AE60',
    stepSizes: [1, 2, 5, 10],
    defaultStepIdx: 1,
  },
  hydration: {
    label: 'Hydration',
    unit: 'oz',
    color: '#5B8BF5',
    stepSizes: [1, 4, 8, 16],
    defaultStepIdx: 2,
  },
  carbs: {
    label: 'Carbs',
    unit: 'g',
    color: '#5B8BF5',
    stepSizes: [1, 5, 10, 25],
    defaultStepIdx: 1,
  },
  fat: {
    label: 'Fat',
    unit: 'g',
    color: '#F6CB45',
    stepSizes: [1, 5, 10, 25],
    defaultStepIdx: 1,
  },
  calories: {
    label: 'Calories',
    unit: 'cal',
    color: '#C084FC',
    stepSizes: [10, 50, 100, 250],
    defaultStepIdx: 1,
  },
};

export type NutrientKey = 'protein' | 'fiber' | 'hydration' | 'carbs' | 'fat' | 'calories';

type Props = {
  visible: boolean;
  onClose: () => void;
  nutrient: NutrientKey;
  currentValue: number;
  targetValue: number;
  onUpdate: (delta: number) => void;
};

export function NutrientLogSheet({ visible, onClose, nutrient, currentValue, targetValue, onUpdate }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const config = NUTRIENT_CONFIGS[nutrient];
  const [value, setValue] = useState(0);
  const [stepIdx, setStepIdx] = useState(config.defaultStepIdx);
  const step = config.stepSizes[stepIdx];
  const initialValue = useRef(0);

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

  useEffect(() => {
    if (visible) {
      initialValue.current = currentValue;
      setValue(currentValue);
      setStepIdx(config.defaultStepIdx);
    }
  }, [visible]);

  const pct = targetValue > 0 ? Math.min(value / targetValue, 1) : 0;

  const handleUpdate = () => {
    const delta = value - initialValue.current;
    if (delta !== 0) {
      onUpdate(delta);
    }
    closeSheet();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeSheet}>
      <View style={s.container}>
        <Pressable style={s.backdrop} onPress={closeSheet} />

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
            <Text style={s.title}>{config.label} Log</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Value display */}
          <View style={s.valueCard}>
            <View style={s.valueLabelRow}>
              <Text style={s.valueLabel}>{config.label}</Text>
              <Text style={[s.valueTarget, { color: config.color }]}>{Math.round(value)}{config.unit} / {targetValue}{config.unit}</Text>
            </View>

            <Text style={[s.valueBig, { color: config.color }]}>{Math.round(value)}</Text>
            <Text style={s.valueUnit}>{config.unit} logged today</Text>

            {/* Progress bar */}
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${pct * 100}%`, backgroundColor: config.color }]} />
            </View>
            <Text style={s.progressLabel}>
              {pct >= 1 ? 'Target reached!' : `${Math.round(pct * 100)}% of daily goal`}
            </Text>

            {/* Stepper */}
            <View style={s.stepper}>
              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setValue(v => Math.max(0, v - step)); }}
                activeOpacity={0.7}
              >
                <Text style={s.stepBtnText}>−</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStepIdx(i => (i + 1) % config.stepSizes.length); }}
                activeOpacity={0.7}
                style={[s.stepLabelWrap, { backgroundColor: config.color + '1F', borderColor: config.color + '40' }]}
              >
                <Text style={[s.stepLabelMain, { color: config.color }]}>{step}{config.unit}</Text>
                <Text style={[s.stepLabelHint, { color: config.color + '88' }]}>tap to change</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setValue(v => v + step); }}
                activeOpacity={0.7}
              >
                <Text style={s.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick add presets */}
          <Text style={s.sectionLabel}>Quick Add</Text>
          <View style={s.quickRow}>
            {config.stepSizes.map(amt => (
              <TouchableOpacity
                key={amt}
                style={s.quickChip}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setValue(v => v + amt);
                }}
                activeOpacity={0.75}
              >
                <Text style={[s.quickChipLabel, { color: config.color }]}>+{amt}{config.unit}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Update CTA */}
          <TouchableOpacity style={s.updateBtn} onPress={handleUpdate} activeOpacity={0.85}>
            <Text style={s.updateBtnText}>Update</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
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
      position: 'absolute', top: 0, left: 0, right: 0, height: 1,
      backgroundColor: w(0.10),
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
    },
    handleHitArea: { alignItems: 'center', paddingTop: 4, paddingBottom: 14 },
    handle: { width: 44, height: 4, backgroundColor: c.ringTrack, borderRadius: 2 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
    },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.borderSubtle, alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: 20, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3, fontFamily: FF },

    // Value card
    valueCard: {
      backgroundColor: w(0.05), borderRadius: 20, borderWidth: 1, borderColor: c.borderSubtle,
      padding: 20, alignItems: 'center', marginBottom: 20,
    },
    valueLabelRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 16,
    },
    valueLabel: { fontSize: 17, fontWeight: '700', color: w(0.55), fontFamily: FF },
    valueTarget: { fontSize: 15, fontWeight: '700', fontFamily: FF },
    valueBig: { fontSize: 56, fontWeight: '800', letterSpacing: -2, fontFamily: FF },
    valueUnit: { fontSize: 16, fontWeight: '600', color: w(0.50), fontFamily: FF, marginTop: -4, marginBottom: 16 },

    // Progress
    progressTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: w(0.08), marginBottom: 6, overflow: 'hidden' },
    progressFill: { height: 6, borderRadius: 3 },
    progressLabel: { fontSize: 13, fontWeight: '600', color: w(0.40), fontFamily: FF, marginBottom: 20 },

    // Stepper
    stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 8 },
    stepBtn: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: c.borderSubtle, borderWidth: 1, borderColor: c.ringTrack,
      alignItems: 'center', justifyContent: 'center',
    },
    stepBtnText: { fontSize: 28, fontWeight: '300', color: c.textPrimary, lineHeight: 32, fontFamily: FF },
    stepLabelWrap: {
      alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, minWidth: 80,
    },
    stepLabelMain: { fontSize: 20, fontWeight: '800', fontFamily: FF, letterSpacing: -0.3 },
    stepLabelHint: { fontSize: 11, fontWeight: '500', fontFamily: FF, marginTop: 1, letterSpacing: 0.2 },

    // Quick add
    sectionLabel: {
      fontSize: 13, fontWeight: '700', color: w(0.30), letterSpacing: 1.0,
      textTransform: 'uppercase', fontFamily: FF, marginBottom: 10,
    },
    quickRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    quickChip: {
      flex: 1, height: 48, borderRadius: 14,
      backgroundColor: w(0.05), borderWidth: 1, borderColor: w(0.09),
      alignItems: 'center', justifyContent: 'center',
    },
    quickChipLabel: { fontSize: 16, fontWeight: '700', fontFamily: FF },

    // Update CTA
    updateBtn: {
      height: 54, borderRadius: 16, backgroundColor: ORANGE,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
    },
    updateBtnText: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2, fontFamily: FF },
  });
};
