import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ClipPath, Defs, Path, Rect, Svg } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHealthData } from '@/contexts/health-data';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const BLUE   = '#5B8BF5';
const ORANGE = '#FF742A';
const FF     = 'Helvetica Neue';

const CUP_PATH = 'M 10 10 L 190 10 L 170 230 Q 170 240 160 240 L 40 240 Q 30 240 30 230 Z';

const STEP_SIZES = [4, 8, 12, 16] as const;

const QUICK_PRESETS = [
  { oz: 8,  label: '8oz',  icon: 'water-outline'      as const },
  { oz: 12, label: '12oz', icon: 'cafe-outline'        as const },
  { oz: 16, label: '16oz', icon: 'wine-outline'        as const },
  { oz: 24, label: '24oz', icon: 'fitness-outline'     as const },
  { oz: 34, label: '34oz', icon: 'flask-outline'       as const },
  { oz: 40, label: '40oz', icon: 'thermometer-outline' as const },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function WaterLogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { dispatch, targets } = useHealthData();

  const [sessionOz, setSessionOz]     = useState(0);
  const [stepSizeIdx, setStepSizeIdx] = useState(1); // default 8oz
  const stepSize = STEP_SIZES[stepSizeIdx];

  const dailyTargetOz = targets.waterMl / 29.5735;

  // Reset session each time sheet opens
  useEffect(() => {
    if (visible) {
      setSessionOz(0);
      fillY.value = 240;
    }
  }, [visible]);

  // SVG fill level: y=240 fully empty, y=10 fully full
  const fillY = useSharedValue(240);

  useEffect(() => {
    const pct = Math.min(sessionOz / dailyTargetOz, 1);
    fillY.value = withSpring(240 - pct * 230, { damping: 15, stiffness: 120 });
  }, [sessionOz, dailyTargetOz]);

  const fillProps = useAnimatedProps(() => ({ y: fillY.value }));

  const handleUpdate = () => {
    if (sessionOz > 0) {
      dispatch({ type: 'LOG_WATER', ml: Math.round(sessionOz * 29.5735) });
    }
    onClose();
  };

  const cycleStepSize = () => setStepSizeIdx(i => (i + 1) % STEP_SIZES.length);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>

        {/* Backdrop */}
        <Pressable style={s.backdrop} onPress={onClose} />

        {/* Sheet */}
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View pointerEvents="none" style={s.topBorder} />

          {/* Drag handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
            <Text style={s.title}>Water Log</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Cup card */}
          <View style={s.cupCard}>

            {/* Label row */}
            <View style={s.cupLabelRow}>
              <Text style={s.cupLabel}>Water</Text>
              <Text style={[s.cupCounter, sessionOz > 0 && { color: BLUE }]}>
                {sessionOz}oz
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

                {/* Animated fill, clipped to cup interior */}
                <AnimatedRect
                  x={0}
                  width={200}
                  height={260}
                  fill={BLUE}
                  opacity={0.72}
                  clipPath="url(#wls-cup-clip)"
                  animatedProps={fillProps}
                />

                {/* Cup outline */}
                <Path
                  d={CUP_PATH}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth={2}
                  fill="rgba(255,255,255,0.03)"
                />
              </Svg>

              {/* Centered oz overlay */}
              <View style={s.cupTextOverlay} pointerEvents="none">
                <Text style={s.cupOzNum}>{sessionOz}</Text>
                <Text style={s.cupOzUnit}>oz</Text>
              </View>
            </View>

            {/* Stepper */}
            <View style={s.stepper}>
              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => setSessionOz(o => Math.max(0, o - stepSize))}
                activeOpacity={0.7}
              >
                <Text style={s.stepBtnText}>−</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={cycleStepSize} activeOpacity={0.7} style={s.stepLabelWrap}>
                <Text style={s.stepLabelMain}>{stepSize}oz</Text>
                <Text style={s.stepLabelHint}>tap to change</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.stepBtn}
                onPress={() => setSessionOz(o => o + stepSize)}
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
            {QUICK_PRESETS.map(preset => (
              <TouchableOpacity
                key={preset.oz}
                style={s.chip}
                onPress={() => setSessionOz(o => o + preset.oz)}
                activeOpacity={0.75}
              >
                <Ionicons name={preset.icon} size={26} color={BLUE} />
                <Text style={s.chipLabel}>+{preset.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Update CTA */}
          <TouchableOpacity style={s.updateBtn} onPress={handleUpdate} activeOpacity={0.85}>
            <Text style={s.updateBtnText}>Update</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  sheet: {
    backgroundColor: '#000000',
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
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  handle: {
    width: 44,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    fontFamily: FF,
  },

  // Cup card
  cupCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    color: 'rgba(255,255,255,0.55)',
    fontFamily: FF,
  },
  cupCounter: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.30)',
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
    color: '#FFFFFF',
    letterSpacing: -2,
    fontFamily: FF,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cupOzUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: FF,
    marginTop: -4,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 32,
    fontFamily: FF,
  },
  stepLabelWrap: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(91,139,245,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(91,139,245,0.25)',
    minWidth: 80,
  },
  stepLabelMain: {
    fontSize: 18,
    fontWeight: '800',
    color: BLUE,
    fontFamily: FF,
    letterSpacing: -0.3,
  },
  stepLabelHint: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(91,139,245,0.55)',
    fontFamily: FF,
    marginTop: 1,
    letterSpacing: 0.2,
  },

  // Quick Add
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.30)',
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
    width: 76,
    height: 84,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BLUE,
    fontFamily: FF,
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
