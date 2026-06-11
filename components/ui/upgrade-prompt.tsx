import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../../contexts/theme-context';
import { GlassBorder } from './glass-border';
import { ORANGE } from '../../constants/theme';
import { X, Zap } from 'lucide-react-native';
import { LucideIconByName } from '@/lib/lucide-icon-map';

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  /** Context-specific headline */
  title?: string;
  /** Context-specific description */
  description?: string;
  /** Which feature triggered this */
  feature?: string;
  /**
   * Whether to frame the CTA as a free trial. When false (user already used
   * their one Apple/Google trial), we promise an upgrade instead of a trial we
   * can't actually deliver. Defaults to true.
   */
  trialEligible?: boolean;
};

const BENEFITS = [
  { icon: 'MessageCircle' as const, text: 'Unlimited AI coaching' },
  { icon: 'BarChart3' as const, text: 'Cycle Intelligence & forecasting' },
  { icon: 'Dumbbell' as const, text: 'Extended HealthKit (HRV, CGM, SpO₂)' },
  { icon: 'FileText' as const, text: 'Provider reports & RTM' },
];

export function UpgradePrompt({
  visible,
  onClose,
  onUpgrade,
  title = 'Unlock Titra Pro',
  description = 'Get unlimited AI coaching and advanced health intelligence for just $4.99/month.',
  feature,
  trialEligible = true,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 8, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
      scale.setValue(0.9);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.cardBg, opacity, transform: [{ scale }] },
        ]}
      >
        <GlassBorder r={28} isDark={isDark} />

        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <X size={22} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Icon */}
        <View style={[styles.proIcon, { backgroundColor: colors.orangeDim }]}>
          <Zap size={28} color={ORANGE} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{description}</Text>

        {/* Benefits list */}
        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.text} style={styles.benefitRow}>
              <LucideIconByName name={b.icon} size={18} color={ORANGE} />
              <Text style={[styles.benefitText, { color: colors.textPrimary }]}>{b.text}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={onUpgrade}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>
            {trialEligible ? 'Start your free trial' : 'Upgrade to Titra Pro'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.priceNote, { color: colors.textMuted }]}>
          {trialEligible ? 'Then $4.99/month. Cancel anytime.' : '$4.99/month. Cancel anytime.'}
        </Text>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  proIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  desc: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 300,
  },
  benefits: {
    alignSelf: 'stretch',
    marginBottom: 28,
    gap: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 12,
  },
  benefitText: {
    fontSize: 16,
    fontWeight: '500',
  },
  ctaButton: {
    backgroundColor: ORANGE,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  priceNote: {
    fontSize: 14,
    marginTop: 12,
  },
});
