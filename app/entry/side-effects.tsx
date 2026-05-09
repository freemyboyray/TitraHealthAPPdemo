import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

import {
  ACTIVE_EFFECTS_KEY,
  CUSTOM_EFFECTS_KEY,
  SIDE_EFFECTS,
  type SideEffectDef,
} from '../../constants/side-effects';
import type { PhaseType, SideEffectType } from '../../stores/log-store';
import { useLogStore } from '../../stores/log-store';
import { readTodaySymptomSeverities } from '../../lib/healthkit';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useProfile } from '@/contexts/profile-context';
import { getSideEffectContext } from '@/lib/side-effect-context';

const ORANGE = '#FF742A';
const GREEN = '#5DB87B';
const THUMB_R = 11;

// ─── Slider ───────────────────────────────────────────────────────────────────

function EffectSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { colors: sliderColors } = useAppTheme();
  const trackRef = useRef(0);
  const [trackPx, setTrackPx] = useState(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastHapticRef = useRef(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  const panStartValueRef = useRef(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const tw = trackRef.current;
        if (tw <= 0) return;
        const next = Math.max(0, Math.min(10, Math.round((evt.nativeEvent.locationX / tw) * 10)));
        panStartValueRef.current = next;
        onChangeRef.current(next);
        if (next !== lastHapticRef.current) {
          lastHapticRef.current = next;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      onPanResponderMove: (_, gs) => {
        const tw = trackRef.current;
        if (tw <= 0) return;
        const delta = (gs.dx / tw) * 10;
        const next = Math.max(0, Math.min(10, Math.round(panStartValueRef.current + delta)));
        onChangeRef.current(next);
        if (next !== lastHapticRef.current) {
          lastHapticRef.current = next;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
    })
  ).current;

  const fillWidth = (value / 10) * trackPx;
  const thumbLeft = fillWidth - THUMB_R;

  return (
    <View
      style={{ height: THUMB_R * 2 + 4, justifyContent: 'center', marginTop: 10 }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        trackRef.current = w;
        setTrackPx(w);
      }}
      {...panResponder.panHandlers}
    >
      <View style={{ height: 4, borderRadius: 2, backgroundColor: sliderColors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
        <View
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: fillWidth, backgroundColor: GREEN, borderRadius: 2,
          }}
        />
      </View>
      {trackPx > 0 && (
        <View
          style={{
            position: 'absolute',
            left: thumbLeft,
            width: THUMB_R * 2,
            height: THUMB_R * 2,
            borderRadius: THUMB_R,
            backgroundColor: value > 0 ? GREEN : '#2C2C2C',
            borderWidth: 2,
            borderColor: value > 0 ? GREEN : (sliderColors.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'),
          }}
        />
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type CustomEffect = { id: string; label: string };
type AnyEffect = { id: string; label: string; dbType: SideEffectType };

export default function SideEffectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addSideEffectLog } = useLogStore();
  const { colors } = useAppTheme();
  const { profile } = useProfile();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [customDefs, setCustomDefs] = useState<CustomEffect[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [hkSuggestedIds, setHkSuggestedIds] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<PhaseType>('balance');
  const [loading, setLoading] = useState(false);

  // ── Entrance animations ──────────────────────────────────────────────────
  const headerOpacity = useSharedValue(0);
  const headerY = useSharedValue(12);
  const labelOpacity = useSharedValue(0);
  const labelY = useSharedValue(16);
  const listOpacity = useSharedValue(0);
  const listY = useSharedValue(24);
  const bottomOpacity = useSharedValue(0);
  const bottomY = useSharedValue(16);
  const ctaOpacity = useSharedValue(0);
  const ctaY = useSharedValue(40);

  useEffect(() => {
    const ease = { duration: 400, easing: Easing.out(Easing.quad) };
    headerOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
    headerY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
    labelOpacity.value = withDelay(100, withTiming(1, ease));
    labelY.value = withDelay(100, withTiming(0, ease));
    listOpacity.value = withDelay(200, withTiming(1, ease));
    listY.value = withDelay(200, withTiming(0, ease));
    bottomOpacity.value = withDelay(350, withTiming(1, ease));
    bottomY.value = withDelay(350, withTiming(0, ease));
    ctaOpacity.value = withDelay(450, withTiming(1, ease));
    ctaY.value = withDelay(450, withTiming(0, ease));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const headerAnim = useAnimatedStyle(() => ({ opacity: headerOpacity.value, transform: [{ translateY: headerY.value }] }));
  const labelAnim = useAnimatedStyle(() => ({ opacity: labelOpacity.value, transform: [{ translateY: labelY.value }] }));
  const listAnim = useAnimatedStyle(() => ({ opacity: listOpacity.value, transform: [{ translateY: listY.value }] }));
  const bottomAnim = useAnimatedStyle(() => ({ opacity: bottomOpacity.value, transform: [{ translateY: bottomY.value }] }));
  const ctaAnim = useAnimatedStyle(() => ({ opacity: ctaOpacity.value, transform: [{ translateY: ctaY.value }] }));

  // ── Data loading ─────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [storedIds, storedCustom, hkSeverities] = await Promise.all([
          AsyncStorage.getItem(ACTIVE_EFFECTS_KEY),
          AsyncStorage.getItem(CUSTOM_EFFECTS_KEY),
          readTodaySymptomSeverities().catch(() => ({} as Record<string, number>)),
        ]);
        let ids: string[];
        try {
          ids = storedIds
            ? JSON.parse(storedIds)
            : SIDE_EFFECTS.filter((e) => e.defaultEnabled).map((e) => e.id);
        } catch {
          ids = SIDE_EFFECTS.filter((e) => e.defaultEnabled).map((e) => e.id);
        }
        let customs: CustomEffect[];
        try {
          customs = storedCustom ? JSON.parse(storedCustom) : [];
        } catch {
          customs = [];
        }
        setActiveIds(ids);
        setCustomDefs(customs);
        const init: Record<string, number> = {};
        [...ids, ...customs.map((c) => c.id)].forEach((id) => { init[id] = 0; });
        const suggested = new Set<string>();
        for (const id of ids) {
          const hkValue = hkSeverities[id];
          if (hkValue && hkValue > 0) {
            init[id] = hkValue;
            suggested.add(id);
          }
        }
        setValues(init);
        setHkSuggestedIds(suggested);
      }
      load();
    }, []),
  );

  const allActive: AnyEffect[] = [
    ...SIDE_EFFECTS.filter((e) => activeIds.includes(e.id)),
    ...customDefs.map((c) => ({ id: c.id, label: c.label, dbType: 'other' as SideEffectType })),
  ];

  const hasAny = allActive.some((e) => (values[e.id] ?? 0) > 0);

  async function handleLog() {
    const toLog = allActive.filter((e) => (values[e.id] ?? 0) > 0);
    if (!toLog.length || loading) return;
    setLoading(true);
    try {
      for (const e of toLog) {
        const notes = e.dbType === 'other' ? e.label : undefined;
        await addSideEffectLog(e.dbType, values[e.id], phase, notes);
      }
      const effectsParam = JSON.stringify(
        toLog.map(e => ({ type: e.dbType, severity: values[e.id] }))
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/entry/side-effect-impact?effects=${encodeURIComponent(effectsParam)}` as any);
    } finally {
      setLoading(false);
    }
  }

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Header ── */}
      <Animated.View style={[s.header, headerAnim]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          activeOpacity={0.7}
          style={s.headerBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Side Effects</Text>
          <Text style={s.dateLabel}>{dateStr}</Text>
        </View>

        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/entry/customize-side-effects' as any); }}
          activeOpacity={0.7}
          style={s.headerBtn}
          hitSlop={12}
        >
          <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Section label ── */}
        <Animated.View style={labelAnim}>
          <Text style={s.sectionLabel}>EFFECTS</Text>
        </Animated.View>

        {/* ── Effect rows (flat, no card) ── */}
        <Animated.View style={listAnim}>
          {allActive.length === 0 ? (
            <Text style={s.emptyText}>
              No effects tracked yet. Tap the settings icon to customize.
            </Text>
          ) : (
            allActive.map((effect, idx) => {
              const val = values[effect.id] ?? 0;
              const isLast = idx === allActive.length - 1;
              const fromHK = hkSuggestedIds.has(effect.id) && val > 0;
              const ctx = val > 0
                ? getSideEffectContext(effect.dbType, profile?.doseStartDate)
                : null;
              return (
                <View key={effect.id} style={[s.effectRow, isLast && s.effectRowLast]}>
                  <View style={s.effectLabelRow}>
                    <View style={s.effectLabelContainer}>
                      <Text style={s.effectLabel}>{effect.label}</Text>
                      {fromHK && (
                        <View style={s.hkBadge}>
                          <Ionicons name="heart" size={9} color="#FF3B30" />
                          <Text style={s.hkBadgeText}>HEALTH</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.effectValue, val === 0 && s.effectValueZero]}>
                      {val}
                    </Text>
                  </View>
                  <EffectSlider
                    value={val}
                    onChange={(v) => setValues((prev) => ({ ...prev, [effect.id]: v }))}
                  />
                  {ctx && (
                    <View style={[
                      s.contextBox,
                      ctx.severity === 'flag' && s.contextBoxFlag,
                      ctx.severity === 'watch' && s.contextBoxWatch,
                      ctx.severity === 'expected' && s.contextBoxOk,
                    ]}>
                      <Text style={[
                        s.contextText,
                        ctx.severity === 'flag' && s.contextTextFlag,
                        ctx.severity === 'watch' && s.contextTextWatch,
                        ctx.severity === 'expected' && s.contextTextOk,
                      ]}>
                        {ctx.message}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </Animated.View>

        {/* ── Customize + Food Noise ── */}
        <Animated.View style={bottomAnim}>
          <TouchableOpacity
            style={s.customizeRow}
            onPress={() => router.push('/entry/customize-side-effects' as any)}
            activeOpacity={0.7}
          >
            <Text style={s.customizeText}>Customize effects</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          {[0, 1].includes(new Date().getDay()) && (
            <TouchableOpacity
              style={s.foodNoiseCard}
              onPress={() => router.push('/entry/food-noise-survey' as any)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.foodNoiseTitle}>Weekly Food Noise Check-In</Text>
                <Text style={s.foodNoiseDesc}>
                  Track how much you're thinking about food this week
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={ORANGE} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── CTA with gradient fade ── */}
      <View style={[s.ctaWrapper, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} pointerEvents="box-none">
        <LinearGradient
          colors={['transparent', colors.bg + 'CC', colors.bg]}
          locations={[0, 0.35, 1]}
          style={s.ctaFade}
          pointerEvents="none"
        />
        <Animated.View style={ctaAnim}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleLog(); }}
            activeOpacity={0.85}
            disabled={!hasAny || loading}
            style={[s.ctaBtn, (!hasAny || loading) && s.ctaBtnDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={s.ctaBtnText}>Log Side Effects</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },

    // ── Header ──
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 4,
    },
    headerBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: c.textPrimary,
      letterSpacing: -0.4,
    },
    dateLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: c.textMuted,
      letterSpacing: 0.3,
      marginTop: 2,
    },

    // ── Scroll ──
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },

    // ── Section label ──
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: ORANGE,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },

    // ── Empty state ──
    emptyText: {
      fontSize: 16,
      color: c.textMuted,
      textAlign: 'center',
      paddingVertical: 40,
    },

    // ── Effect rows ──
    effectRow: {
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    effectRowLast: {
      borderBottomWidth: 0,
    },
    effectLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    effectLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    effectLabel: {
      fontSize: 17,
      fontWeight: '600',
      color: c.textPrimary,
    },
    effectValue: {
      fontSize: 17,
      fontWeight: '800',
      color: GREEN,
      minWidth: 20,
      textAlign: 'right',
    },
    effectValueZero: {
      color: c.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
    },

    // ── HealthKit badge ──
    hkBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(255,59,48,0.12)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    hkBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FF3B30',
      letterSpacing: 0.3,
    },

    // ── Context messages ──
    contextBox: {
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    contextBoxFlag: {
      backgroundColor: 'rgba(245,166,35,0.08)',
    },
    contextBoxWatch: {
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    },
    contextBoxOk: {
      backgroundColor: 'rgba(93,184,123,0.08)',
    },
    contextText: {
      fontSize: 14,
      lineHeight: 18,
    },
    contextTextFlag: {
      color: '#F5A623',
    },
    contextTextWatch: {
      color: c.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
    },
    contextTextOk: {
      color: GREEN,
    },

    // ── Customize prompt ──
    customizeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: 24,
      paddingVertical: 12,
    },
    customizeText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textMuted,
    },

    // ── Food noise card ──
    foodNoiseCard: {
      borderRadius: 20,
      backgroundColor: 'rgba(255,116,42,0.08)',
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 16,
    },
    foodNoiseTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: ORANGE,
      marginBottom: 3,
    },
    foodNoiseDesc: {
      fontSize: 14,
      color: c.textMuted,
    },

    // ── CTA button ──
    ctaWrapper: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
    },
    ctaFade: {
      position: 'absolute',
      top: -40,
      left: 0,
      right: 0,
      height: 40,
    },
    ctaBtn: {
      height: 56,
      borderRadius: 18,
      backgroundColor: ORANGE,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: ORANGE,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    },
    ctaBtnDisabled: {
      opacity: 0.4,
      shadowOpacity: 0,
      elevation: 0,
    },
    ctaBtnText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
  });
