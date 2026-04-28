import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLogStore } from '../../stores/log-store';
import { useHealthKitStore } from '../../stores/healthkit-store';
import { useUiStore } from '../../stores/ui-store';
import { readLatestWeightWithSource, type WeightSampleWithSource } from '../../lib/healthkit';
import { VoiceButton } from '../../components/ui/voice-button';
import { parseVoiceLog, type VoiceWeightResult } from '../../lib/openai';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useProfile } from '@/contexts/profile-context';

const ORANGE = '#FF742A';
const LB_TO_KG = 0.453592;

function clamp(v: number, mn: number, mx: number) { return Math.min(Math.max(v, mn), mx); }

function GlassBorder({ r = 28 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: r, borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.13)',
        borderLeftColor: 'rgba(255,255,255,0.08)',
        borderRightColor: 'rgba(255,255,255,0.03)',
        borderBottomColor: 'rgba(255,255,255,0.02)',
      }}
    />
  );
}

type Unit = 'lbs' | 'kg';
const RULER_PPU = 80;   // pixels per display unit

interface WeightRulerProps {
  value: number;
  unit: Unit;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

function WeightRuler({ value, unit, min, max, onChange }: WeightRulerProps) {
  const { colors: rulerColors } = useAppTheme();
  const containerWidthRef = useRef(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const currentValueRef = useRef(value);
  currentValueRef.current = value;
  const panStartValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastHapticRef = useRef(Math.round(value * 2)); // half-unit buckets

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: () => {
        panStartValueRef.current = currentValueRef.current;
      },
      onPanResponderMove: (_, gs) => {
        // drag right → lower weight, drag left → higher weight
        const raw = panStartValueRef.current - gs.dx / RULER_PPU;
        const snapped = Math.round(raw * 10) / 10;
        const clamped = clamp(snapped, min, max);
        onChangeRef.current(clamped);
        const bucket = Math.round(clamped * 2);
        if (bucket !== lastHapticRef.current) {
          lastHapticRef.current = bucket;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
    })
  ).current;

  function renderTicks() {
    const ticks: React.ReactElement[] = [];
    const halfUnits = (containerWidth / RULER_PPU / 2) + 1.5;
    const rawStart = value - halfUnits;
    const rawEnd   = value + halfUnits;
    // step 0.1 - iterate integers of (rawStart*10)..(rawEnd*10)
    const iStart = Math.ceil(rawStart * 10);
    const iEnd   = Math.floor(rawEnd * 10);
    for (let i = iStart; i <= iEnd; i++) {
      const t = i / 10;
      const x = containerWidth / 2 + (t - value) * RULER_PPU;
      if (x < -10 || x > containerWidth + 10) continue;
      const isInteger = i % 10 === 0;
      const isHalf    = i % 5 === 0 && !isInteger;
      const tickH     = isInteger ? 30 : isHalf ? 20 : 12;
      ticks.push(
        <View
          key={i}
          style={{
            position: 'absolute',
            left: x - 1,
            top: 0,
            width: 1.5,
            height: tickH,
            backgroundColor: rulerColors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.55)',
            borderRadius: 1,
          }}
        />
      );
      if (isInteger) {
        ticks.push(
          <Text
            key={`lbl-${i}`}
            style={{
              position: 'absolute',
              left: x - 16,
              top: 34,
              width: 32,
              textAlign: 'center',
              fontSize: 12,
              fontWeight: '500',
              color: rulerColors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.65)',
            }}
          >
            {Math.round(t)}
          </Text>
        );
      }
    }
    return ticks;
  }

  return (
    <View
      style={{ height: 88, width: '100%', overflow: 'hidden' }}
      onLayout={e => {
        containerWidthRef.current = e.nativeEvent.layout.width;
        setContainerWidth(e.nativeEvent.layout.width);
      }}
      {...panResponder.panHandlers}
    >
      {containerWidth > 0 && renderTicks()}

      {/* Center indicator */}
      <View
        style={{
          position: 'absolute',
          left: containerWidth / 2 - 1,
          top: 0,
          width: 2,
          height: 40,
          backgroundColor: ORANGE,
          borderRadius: 1,
        }}
      />

      {/* Value pill */}
      <View
        style={{
          position: 'absolute',
          left: containerWidth / 2 - 50,
          top: 50,
          width: 100,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            backgroundColor: ORANGE,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 4,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF' }}>
            {value.toFixed(1)} {unit}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function LogWeightScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, addWeightLog } = useLogStore();
  const hkStore = useHealthKitStore();
  const { colors } = useAppTheme();
  const { profile, updateProfile } = useProfile();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [lbs, setLbs]   = useState(() => {
    // Use last logged weight, fall back to onboarding weight, then 185
    return profile?.currentWeightLbs ?? profile?.weightLbs ?? 185.0;
  });
  const [unit, setUnit] = useState<Unit>('lbs');
  const [hkSuggestion, setHkSuggestion] = useState<WeightSampleWithSource | null>(null);

  // Pull the most recent scale reading from Apple Health (with source info)
  // and, if it's within the last 24h, offer it as a one-tap auto-fill.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const sample = await readLatestWeightWithSource();
        if (cancelled || !sample) return;
        const ageMs = Date.now() - sample.recordedAt.getTime();
        if (ageMs > 24 * 60 * 60 * 1000) return;
        setHkSuggestion(sample);
      })();
      return () => { cancelled = true; };
    }, []),
  );

  function handleUseHKSuggestion() {
    if (!hkSuggestion) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLbs(hkSuggestion.lbs);
  }

  function formatAge(recordedAt: Date): string {
    const mins = Math.round((Date.now() - recordedAt.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    return hrs === 1 ? '1 hr ago' : `${hrs} hrs ago`;
  }

  const disp = unit === 'lbs' ? lbs : parseFloat((lbs * LB_TO_KG).toFixed(1));
  const min  = unit === 'lbs' ? 50  : 22;
  const max  = unit === 'lbs' ? 999 : 453;

  function handleRulerChange(newDisp: number) {
    if (unit === 'lbs') {
      setLbs(newDisp);
    } else {
      // convert displayed kg back to lbs for storage
      setLbs(parseFloat((newDisp / LB_TO_KG).toFixed(4)));
    }
  }

  function handleUnitToggle(toMetric: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUnit(toMetric ? 'kg' : 'lbs');
    // lbs state unchanged - disp auto-converts
  }

  async function handleVoiceTranscription(text: string) {
    try {
      const result = await parseVoiceLog('weight', text) as VoiceWeightResult;
      if (result.weight_lbs != null && result.weight_lbs > 0) {
        setLbs(parseFloat(result.weight_lbs.toFixed(1)));
        if (result.unit === 'kg') setUnit('kg');
      } else {
        Alert.alert('Voice Input', 'Could not detect a weight - try saying something like "185 pounds" or "84 kilograms".');
      }
    } catch {
      Alert.alert('Voice Input', 'Could not parse your weight. Please try again.');
    }
  }

  async function doLog() {
    const weightLbs = parseFloat(lbs.toFixed(1));
    await addWeightLog(weightLbs);
    const synced = await hkStore.writeWeight(weightLbs);
    if (synced) useUiStore.getState().showHealthSyncToast('Weight saved to Apple Health');
    await updateProfile({ weightLbs, currentWeightLbs: weightLbs });
    router.back();
  }

  async function handleLog() {
    if (loading) return;
    // If HK has a recent scale reading and the user's entry differs by > 1 lb,
    // confirm they intend to override the scale measurement.
    if (hkSuggestion && hkSuggestion.bundleId !== 'com.titrahealth.app') {
      const diff = Math.abs(lbs - hkSuggestion.lbs);
      if (diff >= 1.0) {
        Alert.alert(
          'Different from scale',
          `Your ${hkSuggestion.sourceName} recorded ${hkSuggestion.lbs.toFixed(1)} lbs ${formatAge(hkSuggestion.recordedAt)}.\n\nYou're logging ${lbs.toFixed(1)} lbs (${diff.toFixed(1)} lbs ${lbs > hkSuggestion.lbs ? 'higher' : 'lower'}).\n\nUse your entry?`,
          [
            { text: 'Use Scale', onPress: () => { setLbs(hkSuggestion.lbs); } },
            { text: 'Use Mine', style: 'destructive', onPress: doLog },
          ],
        );
        return;
      }
    }
    await doLog();
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ height: insets.top, backgroundColor: colors.bg }} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={s.back}
        >
          <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 22, backgroundColor: colors.borderSubtle }]} />
          <GlassBorder r={22} />
          <Ionicons name="chevron-back" size={22} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
        </TouchableOpacity>
        <Text style={s.title}>Log Weight</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ flex: 1 }}>
        {/* Date card */}
        <View style={[s.dateCard, s.shadow]}>
          <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={20} />
          <Ionicons name="calendar-outline" size={16} color={colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'} />
          <Text style={s.dateText}>{dateStr}</Text>
        </View>

        {/* HK scale auto-fill chip */}
        {hkSuggestion && (
          <TouchableOpacity
            onPress={handleUseHKSuggestion}
            activeOpacity={0.75}
            style={{
              marginHorizontal: 20,
              marginTop: 8,
              borderRadius: 14,
              overflow: 'hidden',
              backgroundColor: 'rgba(255,59,48,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,59,48,0.22)',
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Ionicons name="heart" size={16} color="#FF3B30" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FF3B30', letterSpacing: 0.4 }}>
                {hkSuggestion.sourceName?.toUpperCase() || 'FROM YOUR SCALE'}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginTop: 1 }}>
                {(unit === 'lbs' ? hkSuggestion.lbs : hkSuggestion.lbs * LB_TO_KG).toFixed(1)} {unit} · {formatAge(hkSuggestion.recordedAt)}
              </Text>
            </View>
            <View style={{
              borderRadius: 12,
              backgroundColor: '#FF3B30',
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 }}>USE</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Weight display */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={s.currentLabel}>Current Weight</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <Text style={s.weightValue}>{disp.toFixed(1)}</Text>
            <Text style={s.weightUnit}>{unit}</Text>
          </View>
          <VoiceButton onTranscription={handleVoiceTranscription} size="md" style={{ marginTop: 16 }} />
        </View>

        {/* Ruler */}
        <View style={{ paddingHorizontal: 0, marginBottom: 4 }}>
          <WeightRuler
            value={disp}
            unit={unit}
            min={min}
            max={max}
            onChange={handleRulerChange}
          />
        </View>

        {/* Unit toggle */}
        <View style={s.toggleRow}>
          <Text style={[s.toggleLabel, { color: unit === 'lbs' ? colors.textPrimary : (colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)') }]}>
            imperial
          </Text>
          <Switch
            value={unit === 'kg'}
            onValueChange={handleUnitToggle}
            trackColor={{ false: colors.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', true: ORANGE }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={colors.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
          />
          <Text style={[s.toggleLabel, { color: unit === 'kg' ? colors.textPrimary : (colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)') }]}>
            metric
          </Text>
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
          <TouchableOpacity
            onPress={handleLog}
            activeOpacity={0.85}
            disabled={loading}
            style={[s.logBtn, loading && { opacity: 0.75 }]}
          >
            {loading
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.logBtnText}>Log Weight</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: AppColors) => {
  const SHADOW = { shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 8 } as const, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 };
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    back: {
      width: 44, height: 44, borderRadius: 22,
      overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
      ...SHADOW, shadowOpacity: 0.08, shadowRadius: 12,
    },
    shadow: SHADOW,
    title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
    dateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginTop: 4,
      borderRadius: 20,
      overflow: 'hidden',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: c.surface,
    },
    dateText: {
      fontSize: 16,
      fontWeight: '600',
      color: w(0.6),
    },
    currentLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: w(0.45),
      marginBottom: 8,
      letterSpacing: 0.3,
    },
    weightValue: {
      fontSize: 72,
      fontWeight: '800',
      color: ORANGE,
      letterSpacing: -3,
      lineHeight: 78,
    },
    weightUnit: {
      fontSize: 24,
      fontWeight: '600',
      color: c.textPrimary,
      marginBottom: 10,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 20,
    },
    toggleLabel: {
      fontSize: 16,
      fontWeight: '600',
    },
    logBtn: {
      height: 56,
      borderRadius: 28,
      backgroundColor: ORANGE,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: ORANGE,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 8,
    },
    logBtnText: {
      fontSize: 19,
      fontWeight: '700',
      color: '#000000',
      letterSpacing: 0.5,
    },
  });
};
