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
  recovery: '#AF52DE',
  nutrition: '#34C759',
  hydration: '#5AC8FA',
  sideEffects: '#FF3B30',
};

function SegmentedBar({ result, isDark }: { result: EnergyBankResult; isDark: boolean }) {
  const w = (a: number) => isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const sorted = [...result.components]
    .filter(c => c.available)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
  const total = sorted.reduce((s, c) => s + c.score * c.weight, 0) || 1;

  return (
    <View style={{ gap: 8 }}>
      <View style={{
        flexDirection: 'row', height: 8, borderRadius: 4,
        backgroundColor: w(0.06), overflow: 'hidden',
      }}>
        {sorted.map((c, i) => (
          <View key={c.id} style={{
            flex: Math.max(c.score * c.weight, 0.01) / total,
            backgroundColor: COMPONENT_COLORS[c.id] ?? '#999',
            marginRight: i < sorted.length - 1 ? 1.5 : 0,
          }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {sorted.map(c => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{
              width: 2, height: 10, borderRadius: 1,
              backgroundColor: COMPONENT_COLORS[c.id] ?? '#999',
            }} />
            <Text style={{ fontSize: 10, color: w(0.35), fontFamily: FF, fontWeight: '600', letterSpacing: 0.3 }}>
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
  /** When true, render inner content only (no TouchableOpacity wrapper, no outer chrome).
   *  Caller is responsible for providing its own container and tap handler. */
  bare?: boolean;
};

export function EnergyBankCard({ result, phase, bare = false }: Props) {
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
    const lockedInner = (
      <View style={s.inner}>
        {/* Header */}
        <View style={s.header}>
          <Text style={[s.sectionLabel, { color: w(0.35) }]}>ENERGY BANK</Text>
          <View style={s.phasePill}>
            <Text style={s.phaseText}>Premium Feature</Text>
          </View>
        </View>

        {/* Hero row */}
        <View style={s.heroRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="lock-closed" size={18} color={w(0.25)} />
            <Text style={[s.scoreText, { color: w(0.15) }]}>
              --<Text style={s.pctSuffix}>%</Text>
            </Text>
          </View>
        </View>

        {/* Empty bar */}
        <View style={{ height: 8, borderRadius: 4, backgroundColor: w(0.06) }} />

        <Text style={{ fontSize: 12, color: w(0.35), fontFamily: FF, lineHeight: 17 }}>
          Unlock to see your computed energy level based on sleep, nutrition, and medication phase.
        </Text>
      </View>
    );
    if (bare) return lockedInner;
    return (
      <TouchableOpacity
        style={s.wrap}
        onPress={() => router.push('/settings/subscription' as any)}
        activeOpacity={0.82}
        accessibilityLabel="Energy Bank — premium feature, tap to unlock"
        accessibilityRole="button"
      >
        {lockedInner}
      </TouchableOpacity>
    );
  }

  // ── Premium state ────────────────────────────────────────────────────────
  const premiumInner = (
    <View style={s.inner}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.sectionLabel}>ENERGY BANK</Text>
        <View style={s.phasePill}>
          <Text style={s.phaseText}>{phaseLabels[phase] ?? 'Active'}</Text>
        </View>
      </View>

      {/* Hero row */}
      <View style={s.heroRow}>
        <BatteryIcon pct={result.score} color={color} isDark={colors.isDark} />
        <View style={{ gap: 2 }}>
          <Text style={[s.scoreText, { color }]}>
            {result.score}<Text style={[s.pctSuffix, { color }]}>%</Text>
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color, fontFamily: FF }}>
            {result.label}
          </Text>
        </View>
      </View>

      <SegmentedBar result={result} isDark={colors.isDark} />
    </View>
  );
  if (bare) return premiumInner;
  return (
    <TouchableOpacity
      style={s.wrap}
      onPress={() => router.push('/energy-detail' as any)}
      activeOpacity={0.82}
      accessibilityLabel={`Energy Bank ${result.score}%, ${result.label}`}
      accessibilityRole="button"
      accessibilityHint="View energy bank details"
    >
      {premiumInner}
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
      borderWidth: 0.5,
      borderColor: c.borderSubtle,
      ...cardElevation(c.isDark),
    },
    inner: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 12,
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionLabel: {
      fontSize: 13, fontWeight: '700', color: c.textPrimary,
      fontFamily: FF, letterSpacing: 0.8,
    },
    phasePill: {
      backgroundColor: w(0.06),
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    phaseText: {
      fontSize: 11, fontWeight: '600', color: w(0.35),
      fontFamily: FF,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    scoreText: {
      fontSize: 32, fontWeight: '800', fontFamily: FF, letterSpacing: -1.5,
    },
    pctSuffix: {
      fontSize: 18, fontWeight: '700',
    },
  });
};
