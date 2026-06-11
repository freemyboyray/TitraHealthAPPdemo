import React, { useEffect } from 'react';
import {
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Star } from 'lucide-react-native';
import { usePostHog } from '@/lib/posthog';

// App Store ID — used only for the deep-link fallback when the native rating
// sheet isn't available (e.g. already shown the OS-throttled max this year).
const APP_STORE_ID = '6746837369';

const ORANGE = '#FF742A';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Props = {
  onReview: () => void;
  onDismiss: () => void;
};

// Faint star field rendered behind the content, echoing the mockup. Positions
// are deterministic (no RNG) so the layout is stable across renders.
const FIELD_ROWS = 9;
const FIELD_COLS = 5;
const BACKDROP_STARS = Array.from({ length: FIELD_ROWS * FIELD_COLS }, (_, i) => {
  const row = Math.floor(i / FIELD_COLS);
  const col = i % FIELD_COLS;
  // Offset alternate rows for a scattered, non-grid feel.
  const x = (col + (row % 2 === 0 ? 0 : 0.5)) * (SCREEN_W / FIELD_COLS);
  const y = row * (SCREEN_H / FIELD_ROWS) + 40;
  const size = 38 + ((i * 7) % 22);
  return { x, y, size };
});

export function ReviewPrompt({ onReview, onDismiss }: Props) {
  const posthog = usePostHog();
  const clusterScale = useSharedValue(0.6);
  const clusterOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(14);
  const ctaOpacity = useSharedValue(0);
  const ctaTranslateY = useSharedValue(18);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    posthog?.capture('review_prompt_shown');

    clusterScale.value = withDelay(80, withSpring(1, { damping: 13, stiffness: 140 }));
    clusterOpacity.value = withDelay(80, withTiming(1, { duration: 300 }));
    contentOpacity.value = withDelay(260, withTiming(1, { duration: 320 }));
    contentTranslateY.value = withDelay(260, withTiming(0, { duration: 320 }));
    ctaOpacity.value = withDelay(460, withTiming(1, { duration: 260 }));
    ctaTranslateY.value = withDelay(460, withSpring(0, { damping: 14, stiffness: 120 }));
  }, []);

  const clusterStyle = useAnimatedStyle(() => ({
    opacity: clusterOpacity.value,
    transform: [{ scale: clusterScale.value }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaTranslateY.value }],
  }));

  // Wrap the dismiss so "Maybe later" and the OS back gesture both record it.
  const handleDismiss = () => {
    posthog?.capture('review_prompt_dismissed');
    onDismiss();
  };

  const handleReview = async () => {
    posthog?.capture('review_prompt_accepted');
    onReview();
    try {
      // Native in-app rating sheet — one tap, counts toward the public star
      // average. The OS may decline to show it (throttled ~3x/year).
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
        return;
      }
    } catch {
      // fall through to deep link
    }
    const url = Platform.select({
      ios: `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id${APP_STORE_ID}?action=write-review`,
      android: 'market://details?id=com.titrahealth.app',
    });
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.root}>
        {/* Faint star field backdrop */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {BACKDROP_STARS.map((s, i) => (
            <Star
              key={i}
              size={s.size}
              color="#FFFFFF"
              fill="#FFFFFF"
              style={{ position: 'absolute', left: s.x, top: s.y, opacity: 0.035 }}
            />
          ))}
        </View>

        <SafeAreaView style={styles.safe}>
          <View style={styles.center}>
            {/* Star cluster */}
            <Animated.View style={[styles.cluster, clusterStyle]}>
              <Star size={34} color={ORANGE} fill={ORANGE} style={{ marginTop: 14 }} />
              <Star size={44} color={ORANGE} fill={ORANGE} style={{ marginTop: 6 }} />
              <Star size={56} color={ORANGE} fill={ORANGE} />
              <Star size={44} color={ORANGE} fill={ORANGE} style={{ marginTop: 6 }} />
              <Star size={34} color={ORANGE} fill={ORANGE} style={{ marginTop: 14 }} />
            </Animated.View>

            {/* Headline + subtitle */}
            <Animated.View style={[styles.textWrap, contentStyle]}>
              <Text style={styles.title}>Enjoying Titra?</Text>
              <Text style={styles.subtitle}>
                Rate us on the App Store and show your support.
              </Text>
            </Animated.View>
          </View>

          {/* CTAs pinned to the bottom */}
          <Animated.View style={[styles.ctaWrap, ctaStyle]}>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={handleReview}
            >
              <Star size={18} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Rate on App Store</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.5 : 1 }]}
              onPress={handleDismiss}
            >
              <Text style={styles.secondaryBtnText}>Maybe later</Text>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 28,
  },
  textWrap: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  title: {
    fontFamily: 'System',
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaWrap: {
    paddingBottom: 12,
    gap: 14,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    paddingVertical: 17,
    borderRadius: 16,
  },
  primaryBtnText: {
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  secondaryBtnText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    textDecorationLine: 'underline',
  },
});
