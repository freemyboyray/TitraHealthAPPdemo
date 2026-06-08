import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';

import { GlassBorder } from '@/components/ui/glass-border';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';

const FF = 'System';

export type RecapTone = 'orange' | 'neutral' | 'positive';

// Editorial recap/highlight card (DESIGN.md "Recap / highlight card"), theme-honest.
// A calm surface card: status pill + small eyebrow + one big headline, an optional
// real-data accent, and a "view" affordance. A faint warm flourish bleeds off the
// right edge. Used for the weekly check-in + weekly summary on the home feed.
export function RecapCard({
  badge,
  tone = 'orange',
  eyebrow,
  headline,
  caption,
  accent,
  cta = 'View',
  onPress,
  onDismiss,
  fill,
}: {
  /** Status pill text. Omit to hide the pill entirely (e.g. an already-viewed card). */
  badge?: string;
  tone?: RecapTone;
  /** Small uppercase label above the headline (e.g. "Weekly Summary"). */
  eyebrow?: string;
  headline: string;
  /** One muted line under the headline. */
  caption?: string;
  /** Optional small visual (delta chip, sparkline, dots) shown above the CTA. */
  accent?: React.ReactNode;
  cta?: string;
  onPress: () => void;
  onDismiss?: () => void;
  /** Stretch to fill the parent's height (CTA anchored to the bottom). Used to
   *  equalize heights when shown side-by-side in the home recap carousel. */
  fill?: boolean;
}) {
  const { colors } = useAppTheme();
  const s = React.useMemo(() => createStyles(colors), [colors]);

  const toneStyle =
    tone === 'positive'
      ? { bg: 'rgba(39,174,96,0.14)', fg: '#27AE60' }
      : tone === 'neutral'
        ? { bg: colors.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)', fg: colors.textSecondary }
        : { bg: colors.orangeDim, fg: colors.orange };

  return (
    <Pressable
      style={[s.card, fill && { flex: 1 }]}
      onPress={onPress}
      accessibilityLabel={`${eyebrow ? eyebrow + '. ' : ''}${headline}`}
      accessibilityRole="button"
    >
      {/* Warm decorative flourish bleeding off the right edge */}
      <View pointerEvents="none" style={[s.blob, { backgroundColor: colors.orangeDim }]} />

      {(badge || onDismiss) && (
        <View style={s.topRow}>
          {badge ? (
            <View style={[s.badge, { backgroundColor: toneStyle.bg }]}>
              <Text style={[s.badgeText, { color: toneStyle.fg }]}>{badge}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {onDismiss && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onDismiss(); }}
              hitSlop={10}
              accessibilityLabel="Dismiss"
              accessibilityRole="button"
            >
              <X size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
      <Text style={s.headline}>{headline}</Text>
      {caption ? <Text style={s.caption}>{caption}</Text> : null}

      {accent ? <View style={s.accent}>{accent}</View> : null}

      <View style={[s.ctaRow, fill && { marginTop: 'auto' }]}>
        <Text style={s.ctaText}>{cta}</Text>
        <ChevronRight size={16} color={colors.orange} />
      </View>
    </Pressable>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    overflow: 'hidden',
    ...cardElevation(c.isDark),
  },
  blob: {
    position: 'absolute',
    width: 150, height: 150, borderRadius: 999,
    right: -46, top: -34,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  badge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '800', fontFamily: FF, letterSpacing: 1, textTransform: 'uppercase' },
  eyebrow: {
    fontSize: 12, fontWeight: '800', color: c.textMuted,
    fontFamily: FF, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4,
  },
  headline: {
    fontSize: 26, fontWeight: '800', color: c.textPrimary,
    fontFamily: FF, letterSpacing: -0.6, lineHeight: 30,
  },
  caption: {
    fontSize: 14, fontWeight: '500', color: c.textSecondary,
    fontFamily: FF, marginTop: 6, lineHeight: 19,
  },
  accent: { marginTop: 14 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 16 },
  ctaText: { fontSize: 14, fontWeight: '700', color: c.orange, fontFamily: FF },
});
