import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
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

import {
  ACTIVE_EFFECTS_KEY,
  CUSTOM_EFFECTS_KEY,
  SIDE_EFFECTS,
  type SideEffectDef,
} from '../../constants/side-effects';
import type { PhaseType, SideEffectType } from '../../stores/log-store';
import { useLogStore } from '../../stores/log-store';
import { VoiceButton } from '../../components/ui/voice-button';
import { parseVoiceLog, type VoiceSideEffectsResult } from '../../lib/openai';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const ORANGE = '#FF742A';
const GREEN = '#5DB87B';
const THUMB_R = 11;

function GB({ r = 24 }: { r?: number }) {
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

// ─── Slider ───────────────────────────────────────────────────────────────────

function EffectSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { colors: sliderColors } = useAppTheme();
  const trackRef = useRef(0);
  const [trackPx, setTrackPx] = useState(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: (evt) => {
        const tw = trackRef.current;
        if (tw <= 0) return;
        onChangeRef.current(
          Math.max(0, Math.min(10, Math.round((evt.nativeEvent.locationX / tw) * 10))),
        );
      },
      onPanResponderMove: (evt) => {
        const tw = trackRef.current;
        if (tw <= 0) return;
        onChangeRef.current(
          Math.max(0, Math.min(10, Math.round((evt.nativeEvent.locationX / tw) * 10))),
        );
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
      {/* Track */}
      <View style={{ height: 4, borderRadius: 2, backgroundColor: sliderColors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
        {/* Fill */}
        <View
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: fillWidth, backgroundColor: GREEN, borderRadius: 2,
          }}
        />
      </View>
      {/* Thumb */}
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
  const s = useMemo(() => createStyles(colors), [colors]);

  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [customDefs, setCustomDefs] = useState<CustomEffect[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<PhaseType>('balance');
  const [loading, setLoading] = useState(false);

  async function handleVoiceTranscription(text: string) {
    try {
      const result = await parseVoiceLog('side_effects', text) as VoiceSideEffectsResult;
      if (result.phase) setPhase(result.phase);
      if (result.symptoms?.length) {
        setValues(prev => {
          const next = { ...prev };
          for (const sym of result.symptoms) {
            // find by dbType or id match
            const found = SIDE_EFFECTS.find(e => e.id === sym || e.id.includes(sym));
            const id = found?.id ?? sym;
            next[id] = result.severity ?? 5;
          }
          return next;
        });
      }
    } catch {
      // ignore — user can adjust manually
    }
  }

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [storedIds, storedCustom] = await Promise.all([
          AsyncStorage.getItem(ACTIVE_EFFECTS_KEY),
          AsyncStorage.getItem(CUSTOM_EFFECTS_KEY),
        ]);
        const ids: string[] = storedIds
          ? JSON.parse(storedIds)
          : SIDE_EFFECTS.filter((e) => e.defaultEnabled).map((e) => e.id);
        const customs: CustomEffect[] = storedCustom ? JSON.parse(storedCustom) : [];
        setActiveIds(ids);
        setCustomDefs(customs);
        // Reset all values to 0 on each focus
        const init: Record<string, number> = {};
        [...ids, ...customs.map((c) => c.id)].forEach((id) => { init[id] = 0; });
        setValues(init);
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
      router.back();
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
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14,
          backgroundColor: colors.bg,
        }}
      >
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.borderSubtle }]} />
          <GB r={20} />
          <Ionicons name="chevron-back" size={22} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
        </TouchableOpacity>

        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>Side Effects Log</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <VoiceButton onTranscription={handleVoiceTranscription} size="sm" />
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => router.push('/entry/customize-side-effects' as any)}
            activeOpacity={0.7}
          >
            <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.borderSubtle }]} />
            <GB r={20} />
            <Ionicons name="settings-outline" size={20} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Date card */}
        <View style={[s.card, { marginBottom: 4 }]}>
          <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
          <GB r={20} />
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 }}>
            <Ionicons name="calendar-outline" size={18} color={colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
              {dateStr}
            </Text>
          </View>
        </View>

        {/* Effect rows */}
        <View style={[s.card, { marginTop: 12 }]}>
          <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
          <GB r={20} />
          <View style={{ padding: 20 }}>
            {allActive.length === 0 ? (
              <Text style={{ fontSize: 14, color: colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', textAlign: 'center', paddingVertical: 20 }}>
                No effects tracked yet. Tap the settings icon to customize.
              </Text>
            ) : (
              allActive.map((effect, idx) => {
                const val = values[effect.id] ?? 0;
                const isLast = idx === allActive.length - 1;
                return (
                  <View
                    key={effect.id}
                    style={{
                      paddingVertical: 16,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{effect.label}</Text>
                      <Text
                        style={{
                          fontSize: 15, fontWeight: '800',
                          color: val > 0 ? GREEN : (colors.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
                          minWidth: 20, textAlign: 'right',
                        }}
                      >
                        {val}
                      </Text>
                    </View>
                    <EffectSlider
                      value={val}
                      onChange={(v) => setValues((prev) => ({ ...prev, [effect.id]: v }))}
                    />
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Customize prompt */}
        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', marginBottom: 14, textAlign: 'center' }}>
            Any other side effects you'd like to track?
          </Text>
          <TouchableOpacity
            style={s.customizeBtn}
            onPress={() => router.push('/entry/customize-side-effects' as any)}
            activeOpacity={0.75}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', letterSpacing: 0.2 }}>
              Customize side effects
            </Text>
          </TouchableOpacity>
        </View>

        {/* Food Noise FNQ prompt (Sunday or Monday) */}
        {[0, 1].includes(new Date().getDay()) && (
          <View style={{ marginTop: 20, marginBottom: 8 }}>
            <TouchableOpacity
              style={{
                borderRadius: 16,
                backgroundColor: 'rgba(255,116,42,0.08)',
                borderWidth: 1, borderColor: 'rgba(255,116,42,0.2)',
                padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
              }}
              onPress={() => router.push('/entry/food-noise-survey' as any)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: ORANGE, marginBottom: 3 }}>
                  Weekly Food Noise Check-In
                </Text>
                <Text style={{ fontSize: 12, color: colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
                  Track how much you're thinking about food this week · 2 min
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={ORANGE} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
      <View
        style={{
          paddingHorizontal: 20, paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        }}
      >
        <TouchableOpacity
          style={{
            backgroundColor: hasAny ? ORANGE : 'rgba(255,116,42,0.2)',
            borderRadius: 28, paddingVertical: 17,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 },
            shadowOpacity: hasAny ? 0.35 : 0, shadowRadius: 20, elevation: hasAny ? 10 : 0,
          }}
          onPress={handleLog}
          activeOpacity={hasAny ? 0.8 : 1}
          disabled={!hasAny || loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={{ fontSize: 16, fontWeight: '800', color: hasAny ? '#FFF' : (colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'), letterSpacing: 0.4 }}>
                Log Side Effects
              </Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c: AppColors) => {
  const SHADOW = {
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 8 } as const,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  };
  return StyleSheet.create({
    headerBtn: {
      width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center',
      ...SHADOW, shadowOpacity: 0.08, shadowRadius: 12,
    },
    card: {
      borderRadius: 20, overflow: 'hidden', backgroundColor: c.surface,
      ...SHADOW,
    },
    customizeBtn: {
      borderWidth: 1, borderColor: c.border,
      borderRadius: 24, paddingVertical: 12, paddingHorizontal: 24,
    },
  });
};
