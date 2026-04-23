import type { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useAppTheme } from '../../contexts/theme-context';
import { useSubscriptionStore, type FeatureKey } from '../../stores/subscription-store';
import { ORANGE } from '../../constants/theme';

type GateVariant = 'hard' | 'soft' | 'usage';

type Props = {
  /** Feature identifier for access checking */
  feature: string;
  /** Gate variant: hard=locked card, soft=blurred preview, usage=shows remaining count */
  variant?: GateVariant;
  /** Content to render when access is granted */
  children: ReactNode;
  /** Optional teaser text for soft gates (shown above blurred content) */
  teaser?: string;
  /** Optional callback when the upgrade button is pressed */
  onUpgrade?: () => void;
};

/**
 * Conditional wrapper that gates premium features.
 *
 * - `hard`: Replaces children with a locked card + upgrade CTA
 * - `soft`: Shows children blurred with a teaser overlay
 * - `usage`: Shows children normally (limit enforcement happens server-side)
 *
 * Usage:
 * ```tsx
 * <PremiumGate feature="cycle_intelligence" variant="hard">
 *   <CycleIntelligenceCard />
 * </PremiumGate>
 * ```
 */
export function PremiumGate({
  feature,
  variant = 'hard',
  children,
  teaser,
  onUpgrade,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const access = useSubscriptionStore((s) => s.checkFeatureAccess(feature));
  const handleUpgrade = onUpgrade ?? (() => router.push('/settings/subscription' as any));

  // Premium users or allowed features — render children directly
  if (access === 'allowed') return <>{children}</>;

  // Usage-limited features — render children (server enforces the limit)
  if (access === 'limited' && variant === 'usage') return <>{children}</>;

  // Soft gate: blurred preview with teaser
  if (variant === 'soft') {
    return (
      <View style={styles.softContainer}>
        <View style={styles.blurWrap}>
          {children}
          <BlurView
            intensity={20}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.softOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)' }]}>
            {teaser && (
              <Text style={[styles.teaserText, { color: colors.textSecondary }]}>
                {teaser}
              </Text>
            )}
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={handleUpgrade}
              activeOpacity={0.7}
            >
              <Ionicons name="lock-open-outline" size={14} color="#FFF" />
              <Text style={styles.upgradeButtonText}>Unlock with Pro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Hard gate: blurred content with lock overlay
  return (
    <View style={styles.hardContainer}>
      <View style={styles.blurWrap}>
        {children}
        <BlurView
          intensity={30}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.hardOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)' }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.orangeDim }]}>
            <Ionicons name="lock-closed" size={20} color={ORANGE} />
          </View>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={handleUpgrade}
            activeOpacity={0.7}
          >
            <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Soft gate
  softContainer: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  blurWrap: {
    position: 'relative',
  },
  softOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  teaserText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },

  // Hard gate
  hardContainer: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  hardOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  // Shared upgrade button
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ORANGE,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
