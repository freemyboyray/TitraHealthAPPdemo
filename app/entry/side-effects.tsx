import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
} from '../../constants/side-effects';
import type { PhaseType, SideEffectType } from '../../stores/log-store';
import { useLogStore } from '../../stores/log-store';
import { readTodaySymptomSeverities } from '../../lib/healthkit';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { ChevronLeft, ChevronRight, Heart, Settings } from 'lucide-react-native';


// ─── Severity buckets ─────────────────────────────────────────────────────────
// Storage stays 0–10 (DB, HealthKit, insights). UI cycles through 4 buckets.
type Bucket = 0 | 1 | 2 | 3;
const BUCKET_VALUE: Record<Bucket, number> = { 0: 0, 1: 3, 2: 6, 3: 9 };
const BUCKET_LABEL: Record<Bucket, string> = { 0: '', 1: 'Mild', 2: 'Moderate', 3: 'Severe' };

function numericToBucket(n: number): Bucket {
  if (n <= 0) return 0;
  if (n <= 3) return 1;
  if (n <= 6) return 2;
  return 3;
}
function nextBucket(b: Bucket): Bucket {
  return ((b + 1) % 4) as Bucket;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type CustomEffect = { id: string; label: string };
type AnyEffect = { id: string; label: string; dbType: SideEffectType };

export default function SideEffectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addSideEffectLog } = useLogStore();
  const { colors } = useAppTheme();
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
        toLog.map(e => ({ type: e.dbType, severity: values[e.id], label: e.label }))
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
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ChevronLeft size={24} color={colors.textSecondary} />
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
          accessibilityLabel="Customize side effects"
          accessibilityRole="button"
        >
          <Settings size={20} color={colors.textSecondary} />
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
          <Text style={s.sectionHint}>Tap to cycle: mild → moderate → severe</Text>
        </Animated.View>

        {/* ── Effect chips (2-col grid) ── */}
        <Animated.View style={[listAnim, s.grid]}>
          {allActive.length === 0 ? (
            <Text style={s.emptyText}>
              No effects tracked yet. Tap the settings icon to customize.
            </Text>
          ) : (
            allActive.map((effect) => {
              const val = values[effect.id] ?? 0;
              const bucket = numericToBucket(val);
              const fromHK = hkSuggestedIds.has(effect.id) && val > 0;
              return (
                <TouchableOpacity
                  key={effect.id}
                  activeOpacity={0.85}
                  style={[s.chip, s[`chip_${bucket}`]]}
                  onPress={() => {
                    const next = nextBucket(bucket);
                    setValues((prev) => ({ ...prev, [effect.id]: BUCKET_VALUE[next] }));
                    Haptics.impactAsync(
                      next === 3
                        ? Haptics.ImpactFeedbackStyle.Medium
                        : Haptics.ImpactFeedbackStyle.Light
                    );
                  }}
                  accessibilityLabel={`${effect.label}, ${bucket === 0 ? 'none' : BUCKET_LABEL[bucket]}`}
                  accessibilityRole="button"
                  accessibilityHint="Tap to cycle severity"
                >
                  <View style={s.chipTopRow}>
                    <Text style={[s.chipLabel, s[`chipLabel_${bucket}`]]} numberOfLines={2}>
                      {effect.label}
                    </Text>
                    {fromHK && (
                      <Heart size={11} color="#FF3B30" />
                    )}
                  </View>
                  <View style={s.chipBottomRow}>
                    <View style={s.dotRow}>
                      {[1, 2, 3].map((i) => (
                        <View
                          key={i}
                          style={[
                            s.dot,
                            bucket >= i && s[`dot_${bucket}`],
                          ]}
                        />
                      ))}
                    </View>
                    {bucket > 0 && (
                      <Text style={[s.chipSev, s[`chipSev_${bucket}`]]}>
                        {BUCKET_LABEL[bucket]}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
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
            accessibilityLabel="Customize effects"
            accessibilityRole="button"
          >
            <Text style={s.customizeText}>Customize effects</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
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
            accessibilityLabel="Log side effects"
            accessibilityRole="button"
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
      color: c.orange,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    sectionHint: {
      fontSize: 12,
      color: c.textMuted,
      marginBottom: 14,
    },

    // ── Empty state ──
    emptyText: {
      fontSize: 16,
      color: c.textMuted,
      textAlign: 'center',
      paddingVertical: 40,
      width: '100%',
    },

    // ── Chip grid ──
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    chip: {
      width: '48%',
      minHeight: 86,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      justifyContent: 'space-between',
      borderWidth: 1,
    },
    chip_0: {
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      borderColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    },
    chip_1: {
      backgroundColor: 'rgba(245,200,80,0.14)',
      borderColor: 'rgba(245,200,80,0.35)',
    },
    chip_2: {
      backgroundColor: 'rgba(255,116,42,0.18)',
      borderColor: 'rgba(255,116,42,0.45)',
    },
    chip_3: {
      backgroundColor: 'rgba(255,69,58,0.22)',
      borderColor: 'rgba(255,69,58,0.55)',
    },

    chipTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 6,
    },
    chipLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    chipLabel_0: { color: c.textPrimary },
    chipLabel_1: { color: c.textPrimary },
    chipLabel_2: { color: c.textPrimary },
    chipLabel_3: { color: c.textPrimary },

    chipBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    dotRow: {
      flexDirection: 'row',
      gap: 4,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    },
    dot_0: {},
    dot_1: { backgroundColor: '#F5C850' },
    dot_2: { backgroundColor: c.orange },
    dot_3: { backgroundColor: '#FF453A' },

    chipSev: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    chipSev_0: {},
    chipSev_1: { color: '#F5C850' },
    chipSev_2: { color: c.orange },
    chipSev_3: { color: '#FF453A' },


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
      backgroundColor: c.orange,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.orange,
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
