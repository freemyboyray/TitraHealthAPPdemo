import type { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useAppTheme } from '../../contexts/theme-context';
import { useSubscriptionStore, type FeatureKey } from '../../stores/subscription-store';
import { ORANGE } from '../../constants/theme';
import { ChevronRight, Crown, Lock, LockOpen } from 'lucide-react-native';

type GateVariant = 'hard' | 'soft' | 'usage';

type Props = {
  /** Feature identifier for access checking */
  feature: string;
  /** Gate variant: hard=locked card, soft=blurred preview, usage=shows remaining count */
  variant?: GateVariant;
  /** Content to render when access is granted */
  children: ReactNode;
  /** Optional teaser text for soft gates */
  teaser?: string;
  /** Optional title shown above the blurred card when gated */
  title?: string;
  /** Optional callback when the upgrade button is pressed */
  onUpgrade?: () => void;
};

/**
 * Conditional wrapper that gates premium features.
 *
 * - `hard`: Replaces children with a locked card + upgrade CTA
 * - `soft`: Shows title + crown icon, children blurred beneath
 * - `usage`: Shows children normally (limit enforcement happens server-side)
 *
 * Usage:
 * ```tsx
 * <PremiumGate feature="cycle_intelligence" variant="soft" title="Cycle Intelligence">
 *   <CycleIntelligenceCard />
 * </PremiumGate>
 * ```
 */
export function PremiumGate({
  feature,
  variant = 'hard',
  children,
  teaser,
  title,
  onUpgrade,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const access = useSubscriptionStore((s) => s.checkFeatureAccess(feature));
  const handleUpgrade = onUpgrade ?? (() => router.push('/settings/subscription' as any));

  // Premium users or allowed features — render children directly
  if (access === 'allowed') return <>{children}</>;

  // Usage-limited features — render children (server enforces the limit)
  if (access === 'limited' && variant === 'usage') return <>{children}</>;

  // Soft gate: title + crown visible, content blurred
  if (variant === 'soft') {
    return (
      <TouchableOpacity
        style={[styles.softCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={handleUpgrade}
        activeOpacity={0.7}
        accessibilityLabel={title ? `${title} — premium feature, tap to unlock` : 'Premium feature — tap to unlock'}
        accessibilityRole="button"
        accessibilityHint="Opens the subscription upgrade screen"
      >
        {/* Header row — visible, not blurred */}
        <View style={styles.softHeader}>
          {title && (
            <Text style={[styles.softTitle, { color: colors.textPrimary }]}>{title}</Text>
          )}
          <View style={styles.crownCircle}>
            <Crown size={16} color={ORANGE} />
          </View>
        </View>

        {/* Content — blurred */}
        <View style={styles.blurWrap}>
          {children}
          <BlurView
            intensity={25}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </TouchableOpacity>
    );
  }

  // Hard gate: locked card with feature explanation
  return (
    <TouchableOpacity
      style={[styles.hardCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={handleUpgrade}
      activeOpacity={0.7}
      accessibilityLabel={title ? `${title} — locked, unlock with Pro` : 'Premium feature — unlock with Pro'}
      accessibilityRole="button"
      accessibilityHint="Opens the subscription upgrade screen"
    >
      <View style={styles.hardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: colors.orangeDim }]}>
          <Lock size={18} color={ORANGE} />
        </View>
        {title && (
          <Text style={[styles.hardTitle, { color: colors.textPrimary }]}>{title}</Text>
        )}
      </View>
      {teaser && (
        <Text style={[styles.hardTeaser, { color: colors.textSecondary }]}>{teaser}</Text>
      )}
      <View style={styles.upgradeRow}>
        <Text style={styles.upgradeLink}>Unlock with Pro</Text>
        <ChevronRight size={14} color={ORANGE} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Soft gate
  softCard: {
    borderRadius: 20,
    borderWidth: 0.5,
    padding: 16,
    overflow: 'hidden',
  },
  softHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  softTitle: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'System',
    letterSpacing: -0.2,
    flex: 1,
  },
  crownCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
  },

  // Hard gate
  hardCard: {
    borderRadius: 24,
    borderWidth: 0.5,
    padding: 20,
    marginBottom: 16,
  },
  hardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  hardTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontFamily: 'System',
  },
  hardTeaser: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 14,
    fontFamily: 'System',
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  upgradeLink: {
    fontSize: 15,
    fontWeight: '600',
    color: ORANGE,
    fontFamily: 'System',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
