import { useMemo } from 'react';
import { Gesture, type GestureType, type ComposedGesture } from 'react-native-gesture-handler';
import {
  useSharedValue,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export type ScrubPoint = { x: number; y: number };

type UseChartScrubOptions = {
  /** SVG-coordinate points to snap to */
  points: ScrubPoint[];
  /** Total chart container width (px) */
  chartWidth: number;
  /** Left margin before plot area begins */
  marginLeft: number;
  /** Right margin after plot area ends */
  marginRight: number;
  /**
   * 'longpress-or-tap' — compact views where tap opens modal, long-press scrubs
   * 'longpress-only' — expanded views / weight chart (scrub only)
   */
  mode: 'longpress-or-tap' | 'longpress-only';
  /** Fires on simple tap (compact mode only, e.g. open modal) */
  onTap?: () => void;
  /** Disable gesture entirely */
  enabled?: boolean;
  /** Indices to skip (null-value points in lifestyle chart) */
  validIndices?: number[];
};

type UseChartScrubReturn = {
  gesture: ComposedGesture | GestureType;
  activeIndex: SharedValue<number>;
  isActive: SharedValue<boolean>;
  crosshairX: SharedValue<number>;
  crosshairY: SharedValue<number>;
};

function triggerHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function triggerStartHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function useChartScrub(options: UseChartScrubOptions): UseChartScrubReturn {
  const {
    points,
    chartWidth,
    marginLeft,
    marginRight,
    mode,
    onTap,
    enabled = true,
    validIndices,
  } = options;

  const activeIndex = useSharedValue(-1);
  const isActive = useSharedValue(false);
  const crosshairX = useSharedValue(0);
  const crosshairY = useSharedValue(0);

  // Cache points as shared-value-compatible data (plain arrays for worklet compat)
  const pointsXArr = useMemo(() => points.map(p => p.x), [points]);
  const pointsYArr = useMemo(() => points.map(p => p.y), [points]);
  // Boolean array: validMask[i] = true if point i is valid (worklet-safe, no Set)
  const validMask = useMemo(() => {
    if (!validIndices) return null;
    const mask = new Array(points.length).fill(false);
    for (const i of validIndices) mask[i] = true;
    return mask;
  }, [validIndices, points.length]);

  const findNearestIndex = (fingerX: number): number => {
    'worklet';
    const n = pointsXArr.length;
    if (n === 0) return -1;
    const plotW = chartWidth - marginLeft - marginRight;
    if (plotW <= 0) return 0;
    const clamped = Math.max(marginLeft, Math.min(chartWidth - marginRight, fingerX));
    const rawIdx = Math.round(((clamped - marginLeft) / plotW) * (n - 1));
    return Math.max(0, Math.min(n - 1, rawIdx));
  };

  const snapToValid = (idx: number): number => {
    'worklet';
    if (!validMask) return idx;
    if (validMask[idx]) return idx;
    let lo = idx - 1;
    let hi = idx + 1;
    while (lo >= 0 || hi < pointsXArr.length) {
      if (lo >= 0 && validMask[lo]) return lo;
      if (hi < pointsXArr.length && validMask[hi]) return hi;
      lo--;
      hi++;
    }
    return idx;
  };

  const updateScrub = (fingerX: number, prevIdx: number): number => {
    'worklet';
    let idx = findNearestIndex(fingerX);
    if (validMask) idx = snapToValid(idx);
    if (idx >= 0 && idx < pointsXArr.length) {
      crosshairX.value = pointsXArr[idx];
      crosshairY.value = pointsYArr[idx];
      if (idx !== prevIdx) {
        activeIndex.value = idx;
        runOnJS(triggerHaptic)();
      }
    }
    return idx;
  };

  const gesture = useMemo(() => {
    const longPress = Gesture.LongPress()
      .minDuration(mode === 'longpress-or-tap' ? 250 : 200)
      .enabled(enabled && points.length > 0)
      .onStart((e) => {
        'worklet';
        isActive.value = true;
        runOnJS(triggerStartHaptic)();
        updateScrub(e.x, -1);
      });

    const pan = Gesture.Pan()
      .enabled(enabled && points.length > 0)
      .minDistance(0)
      .onUpdate((e) => {
        'worklet';
        if (!isActive.value) return;
        updateScrub(e.x, activeIndex.value);
      })
      .onEnd(() => {
        'worklet';
        isActive.value = false;
        activeIndex.value = -1;
      })
      .onFinalize(() => {
        'worklet';
        isActive.value = false;
        activeIndex.value = -1;
      });

    const scrubSequence = Gesture.Simultaneous(longPress, pan);

    if (mode === 'longpress-or-tap' && onTap) {
      const tap = Gesture.Tap()
        .enabled(enabled)
        .onEnd(() => {
          'worklet';
          if (!isActive.value) {
            runOnJS(onTap)();
          }
        });
      return Gesture.Exclusive(scrubSequence, tap);
    }

    return scrubSequence;
  }, [enabled, points.length, mode, onTap, pointsXArr, pointsYArr]);

  return { gesture, activeIndex, isActive, crosshairX, crosshairY };
}
