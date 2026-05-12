import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import type { EnergyBankResult } from '@/constants/scoring';
import { useSubscriptionStore } from '@/stores/subscription-store';

const FF = 'System';

function energyColor(pct: number): string {
  if (pct >= 70) return '#27AE60';
  if (pct >= 45) return '#F6CB45';
  if (pct >= 20) return '#E8960C';
  return '#E53E3E';
}

// ─── Battery Shape (SVG) ─────────────────────────────────────────────────────

function BatteryIcon({ pct, color, isDark }: { pct: number; color: string; isDark: boolean }) {
  const W = 72;
  const H = 32;
  const R = 8;
  const tipW = 4;
  const tipH = 12;
  const pad = 3;
  const fillW = Math.max(0, ((W - pad * 2) * pct) / 100);
  const borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
  const bgColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Svg width={W} height={H}>
        <Rect x={0} y={0} width={W} height={H} rx={R} ry={R}
          stroke={borderColor} strokeWidth={1.5} fill={bgColor} />
        {fillW > 0 && (
          <Rect x={pad} y={pad} width={fillW} height={H - pad * 2}
            rx={R - 2} ry={R - 2} fill={color} opacity={0.85} />
        )}
      </Svg>
      <View style={{
        width: tipW, height: tipH, borderTopRightRadius: 2, borderBottomRightRadius: 2,
        backgroundColor: borderColor, marginLeft: 1.5,
      }} />
    </View>
  );
}

// ─── Segmented Bar ───────────────────────────────────────────────────────────

const COMPONENT_COLORS: Record<string, string> = {
  sleep: '#5856D6',
  drugLevel: '#FF742A',
  hrv: '#AF52DE',
  nutrition: '#34C759',
  hydration: '#5AC8FA',
  sideEffects: '#FF3B30',
};

function SegmentedBar({ result, isDark }: { result: EnergyBankResult; isDark: boolean }) {
  const w = (a: number) => isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  // Show top 3 available components by weight
  const sorted = [...result.components]
    .filter(c => c.available)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
  const total = sorted.reduce((s, c) => s + c.score * c.weight, 0) || 1;

  return (
    <View style={{ gap: 6 }}>
      <View style={{
        flexDirection: 'row', height: 6, borderRadius: 3,
        backgroundColor: w(0.06), overflow: 'hidden',
      }}>
        {sorted.map((c, i) => (
          <View key={c.id} style={{
            flex: Math.max(c.score * c.weight, 0.01) / total,
            backgroundColor: COMPONENT_COLORS[c.id] ?? '#999',
            opacity: 0.8,
            marginRight: i < sorted.length - 1 ? 1.5 : 0,
          }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {sorted.map(c => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{
              width: 6, height: 6, borderRadius: 3,
              backgroundColor: COMPONENT_COLORS[c.id] ?? '#999', opacity: 0.8,
            }} />
            <Text style={{ fontSize: 11, color: w(0.4), fontFamily: FF, fontWeight: '600' }}>
              {c.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Card Component ──────────────────────────────────────────────────────────

type Props = {
  result: EnergyBankResult;
  phase: string;
};

export function EnergyBankCard({ result, phase }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const isPremium = useSubscriptionStore(st => st.isPremium);

  const color = energyColor(result.score);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const phaseLabels: Record<string, string> = {
    shot: 'Dose Day', peak: 'Peak Phase', balance: 'Balance', reset: 'Reset Phase',
  };

  // ── Locked state for free users ──────────────────────────────────────────
  if (!isPremium) {
    return (
      <TouchableOpacity
        style={s.wrap}
        onPress={() => router.push('/paywall' as any)}
        activeOpacity={0.82}
      >
        <View style={s.inner}>
          <View style={s.topRow}>
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="flash" size={16} color={w(0.25)} />
                <Text style={[s.title, { color: w(0.35) }]}>Energy Bank</Text>
              </View>
              <Text style={s.phaseTag}>Premium Feature</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="lock-closed" size={18} color={w(0.25)} />
              <Text style={[s.pctText, { color: w(0.2) }]}>--%</Text>
            </View>
          </View>
          <View style={{
            height: 6, borderRadius: 3, backgroundColor: w(0.06),
          }} />
          <Text style={{ fontSize: 13, color: w(0.35), fontFamily: FF }}>
            Unlock to see your computed energy level based on sleep, nutrition, and medication phase.
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Premium state ────────────────────────────────────────────────────────
  return (
    <TouchableOpacity
      style={s.wrap}
      onPress={() => router.push('/energy-detail' as any)}
      activeOpacity={0.82}
    >
      <View style={s.inner}>
        <View style={s.topRow}>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="flash" size={16} color={color} />
              <Text style={s.title}>Energy Bank</Text>
            </View>
            <Text style={s.phaseTag}>{phaseLabels[phase] ?? 'Active'}</Text>
          </View>

          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BatteryIcon pct={result.score} color={color} isDark={colors.isDark} />
              <Text style={[s.pctText, { color }]}>{result.score}%</Text>
            </View>
            <Text style={s.labelText}>{result.label}</Text>
          </View>
        </View>

        <SegmentedBar result={result} isDark={colors.isDark} />

        {result.missingCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="information-circle-outline" size={14} color={w(0.3)} />
            <Text style={{ fontSize: 12, color: w(0.3), fontFamily: FF, flex: 1 }}>
              Based on {6 - result.missingCount}/6 factors — tap for details
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: {
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: c.isDark ? c.surface : '#FFFFFF',
      ...cardElevation(c.isDark),
    },
    inner: {
      padding: 18,
      gap: 16,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    title: {
      fontSize: 17, fontWeight: '800', color: c.textPrimary,
      fontFamily: FF, letterSpacing: -0.2,
    },
    phaseTag: {
      fontSize: 12, fontWeight: '600', color: w(0.35),
      fontFamily: FF, textTransform: 'uppercase', letterSpacing: 0.6,
    },
    pctText: {
      fontSize: 24, fontWeight: '800', fontFamily: FF,
    },
    labelText: {
      fontSize: 13, fontWeight: '600', color: w(0.4), fontFamily: FF,
    },
  });
};
