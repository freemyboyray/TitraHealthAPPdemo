import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { VoiceButton } from '../../components/ui/voice-button';
import { parseVoiceLog, type VoiceWeightResult } from '../../lib/openai';

const BG     = '#000000';
const ORANGE = '#FF742A';
const DARK   = '#FFFFFF';
const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 8 } as const, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 };
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
  const containerWidthRef = useRef(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const currentValueRef = useRef(value);
  currentValueRef.current = value;
  const panStartValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
        onChangeRef.current(clamp(snapped, min, max));
      },
    })
  ).current;

  function renderTicks() {
    const ticks: React.ReactElement[] = [];
    const halfUnits = (containerWidth / RULER_PPU / 2) + 1.5;
    const rawStart = value - halfUnits;
    const rawEnd   = value + halfUnits;
    // step 0.1 — iterate integers of (rawStart*10)..(rawEnd*10)
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
            backgroundColor: 'rgba(255,255,255,0.25)',
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
              fontSize: 10,
              fontWeight: '500',
              color: 'rgba(255,255,255,0.35)',
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
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFF' }}>
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

  const [lbs, setLbs]   = useState(185.0);
  const [unit, setUnit] = useState<Unit>('lbs');

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
    setUnit(toMetric ? 'kg' : 'lbs');
    // lbs state unchanged — disp auto-converts
  }

  async function handleVoiceTranscription(text: string) {
    try {
      const result = await parseVoiceLog('weight', text) as VoiceWeightResult;
      if (result.weight_lbs) {
        setLbs(parseFloat(result.weight_lbs.toFixed(1)));
        if (result.unit === 'kg') setUnit('kg');
      }
    } catch {
      // ignore parse errors — user can still adjust manually
    }
  }

  async function handleLog() {
    if (loading) return;
    await addWeightLog(parseFloat(lbs.toFixed(1)));
    hkStore.writeWeight(parseFloat(lbs.toFixed(1)));
    router.back();
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ height: insets.top, backgroundColor: BG }} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={s.back}
        >
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <GlassBorder r={22} />
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        <Text style={s.title}>Log Weight</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ flex: 1 }}>
        {/* Date card */}
        <View style={[s.dateCard, SHADOW]}>
          <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
          <GlassBorder r={20} />
          <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.45)" />
          <Text style={s.dateText}>{dateStr}</Text>
        </View>

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
          <Text style={[s.toggleLabel, { color: unit === 'lbs' ? DARK : 'rgba(255,255,255,0.3)' }]}>
            imperial
          </Text>
          <Switch
            value={unit === 'kg'}
            onValueChange={handleUnitToggle}
            trackColor={{ false: 'rgba(255,255,255,0.2)', true: ORANGE }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="rgba(255,255,255,0.2)"
          />
          <Text style={[s.toggleLabel, { color: unit === 'kg' ? DARK : 'rgba(255,255,255,0.3)' }]}>
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

const s = StyleSheet.create({
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
  title: { fontSize: 18, fontWeight: '700', color: DARK },
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
    backgroundColor: '#111111',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  currentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
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
    color: DARK,
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
    fontSize: 14,
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
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
  },
});
