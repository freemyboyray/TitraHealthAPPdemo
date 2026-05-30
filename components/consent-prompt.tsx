import React, { useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/contexts/theme-context';
import { ShieldCheck } from 'lucide-react-native';

type Props = {
  missingAi: boolean;
  missingFood: boolean;
  onReview: () => void;
  onDismiss: () => void;
};

export function ConsentPrompt({ missingAi, missingFood, onReview, onDismiss }: Props) {
  const { colors, isDark } = useAppTheme();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const subtitle = missingAi && missingFood
    ? 'AI features and the food database are currently disabled. Enable data sharing to log meals with AI and search the food database.'
    : missingAi
      ? 'AI features are currently disabled. Enable AI data sharing to use Ask AI, voice logging, and AI meal descriptions.'
      : 'The food database is currently disabled. Enable it to search foods and scan barcodes.';

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      <View style={StyleSheet.absoluteFill}>
        <BlurView
          intensity={40}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)' },
          ]}
        />
      </View>

      <Pressable style={styles.centerer} onPress={onDismiss}>
        <Pressable style={[styles.card, { backgroundColor: colors.cardBg }]} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: '#FF742A1F' }]}>
            <ShieldCheck size={32} color="#FF742A" />
          </View>

          <View style={styles.textWrap}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Enable data sharing
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          </View>

          <View style={styles.btnWrap}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: '#FF742A', opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={onReview}
            >
              <Text style={styles.primaryBtnText}>Review & enable</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                { opacity: pressed ? 0.5 : 1 },
              ]}
              onPress={onDismiss}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
                Not now
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centerer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  textWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'System',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
  },
  btnWrap: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '500',
  },
});
