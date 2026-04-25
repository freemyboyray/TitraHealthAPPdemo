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
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../../contexts/theme-context';
import { GlassBorder } from './glass-border';
import { ORANGE } from '../../constants/theme';

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
};

const BENEFITS = [
  { icon: 'chatbubble-ellipses-outline' as const, text: 'Unlimited AI coaching' },
  { icon: 'analytics-outline' as const, text: 'Cycle Intelligence & forecasting' },
  { icon: 'fitness-outline' as const, text: 'Extended HealthKit (HRV, CGM, SpO₂)' },
  { icon: 'document-text-outline' as const, text: 'Provider reports & RTM' },
];

export function UpgradePrompt({
  visible,
  onClose,
  onUpgrade,
  title = 'Unlock Titra Pro',
  description = 'Get unlimited AI coaching and advanced health intelligence for just $4.99/month.',
  feature,
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
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Icon */}
        <View style={[styles.proIcon, { backgroundColor: colors.orangeDim }]}>
          <Ionicons name="flash" size={28} color={ORANGE} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>{description}</Text>

        {/* Benefits list */}
        <View style={styles.benefits}>
          {BENEFITS.map((b) => (
            <View key={b.text} style={styles.benefitRow}>
              <Ionicons name={b.icon} size={18} color={ORANGE} />
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
          <Text style={styles.ctaText}>Start 7-Day Free Trial</Text>
        </TouchableOpacity>

        <Text style={[styles.priceNote, { color: colors.textMuted }]}>
          Then $4.99/month. Cancel anytime.
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
    fontSize: 14,
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
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: '700',
  },
  priceNote: {
    fontSize: 12,
    marginTop: 12,
  },
});
