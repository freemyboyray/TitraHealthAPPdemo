import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import type { EnergyBankResult } from '@/constants/scoring';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { HelpCircle, Lock, X } from 'lucide-react-native';

const FF = 'System';
const TOTAL_SEGMENTS = 16;

function energyColor(pct: number): string {
  if (pct >= 70) return '#27AE60';
  if (pct >= 45) return '#F6CB45';
  if (pct >= 20) return '#E8960C';
  return '#E53E3E';
}

// ─── Segmented Block Bar (like the reference image) ─────────────────────────

function SegmentBlockBar({ pct, color, isDark }: { pct: number; color: string; isDark: boolean }) {
  const w = (a: number) => isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const filledCount = Math.round((pct / 100) * TOTAL_SEGMENTS);

  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: TOTAL_SEGMENTS }, (_, i) => {
        const filled = i < filledCount;
        // Gradient: lighter on the left, full color on the right
        const opacity = filled
          ? 0.45 + (0.55 * (i / Math.max(filledCount - 1, 1)))
          : 1;

        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: 22,
              borderRadius: 4,
              backgroundColor: filled ? color : w(0.08),
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── "How this is estimated" explainer ───────────────────────────────────────

function InfoModal({
  visible,
  onClose,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  colors: AppColors;
}) {
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 28 }}
        onPress={onClose}
      >
        {/* Stop taps inside the card from dismissing */}
        <Pressable
          onPress={() => {}}
          style={{
            borderRadius: 20,
            backgroundColor: colors.isDark ? colors.surface : '#FFFFFF',
            borderWidth: 0.5,
            borderColor: colors.borderSubtle,
            padding: 22,
            gap: 12,
            ...cardElevation(colors.isDark),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HelpCircle size={18} color="#FF742A" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, fontFamily: FF, letterSpacing: -0.2 }}>
                How this is estimated
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} activeOpacity={0.6}>
              <X size={18} color={w(0.4)} />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13.5, color: w(0.6), fontFamily: FF, lineHeight: 20 }}>
            Energy Bank is an <Text style={{ fontWeight: '700', color: w(0.75) }}>estimate</Text>, not a medical reading.
            It blends the things that most affect energy on GLP-1s — your sleep, recovery (HRV & resting heart rate),
            where you are in your dose cycle, nutrition, hydration, and recent side effects.
          </Text>

          <Text style={{ fontSize: 13.5, color: w(0.6), fontFamily: FF, lineHeight: 20 }}>
            Factors you haven't tracked yet are left out and the rest are reweighted, so logging more — or connecting
            Apple Health — makes it more accurate. Tap the card for the full breakdown.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Card Component ──────────────────────────────────────────────────────────

type Props = {
  result: EnergyBankResult;
  phase: string;
  bare?: boolean;
};

export function EnergyBankCard({ result, phase, bare = false }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const isPremium = useSubscriptionStore(st => st.isPremium);
  const [infoOpen, setInfoOpen] = useState(false);

  const color = energyColor(result.score);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  // ── Locked state for free users ──────────────────────────────────────────
  if (!isPremium) {
    const lockedInner = (
      <View style={s.inner}>
        <View style={s.header}>
          <Text style={[s.title, { color: w(0.35) }]}>Energy Bank</Text>
          <View style={s.iconCircle}>
            <Lock size={16} color={w(0.3)} />
          </View>
        </View>

        <Text style={[s.scoreText, { color: w(0.15) }]}>
          --<Text style={s.pctSuffix}>%</Text>
        </Text>

        <SegmentBlockBar pct={0} color={w(0.12)} isDark={colors.isDark} />

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
      {/* Header: title + info button */}
      <View style={s.header}>
        <Text style={s.title}>Energy Bank</Text>
        <TouchableOpacity
          style={[s.iconCircle, { backgroundColor: w(0.06) }]}
          onPress={() => setInfoOpen(true)}
          hitSlop={10}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="How the Energy Bank is estimated"
        >
          <HelpCircle size={16} color={w(0.4)} />
        </TouchableOpacity>
      </View>

      {/* Score */}
      <Text style={[s.scoreText, { color }]}>
        {result.score}<Text style={[s.pctSuffix, { color }]}>%</Text>
      </Text>

      {/* Segmented block bar */}
      <SegmentBlockBar pct={result.score} color={color} isDark={colors.isDark} />

      <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} colors={colors} />
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
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 16,
      gap: 14,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: 17, fontWeight: '700', color: c.textPrimary,
      fontFamily: FF, letterSpacing: -0.3,
    },
    iconCircle: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: w(0.06),
      alignItems: 'center', justifyContent: 'center',
    },
    scoreText: {
      fontSize: 38, fontWeight: '800', fontFamily: FF, letterSpacing: -1.5,
    },
    pctSuffix: {
      fontSize: 22, fontWeight: '700',
    },
  });
};
