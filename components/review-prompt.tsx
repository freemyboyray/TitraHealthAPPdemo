import React, { useEffect } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
// App Store ID — update this once the app is live on the App Store
const APP_STORE_ID = '6746837369';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/contexts/theme-context';

type Props = {
  onReview: () => void;
  onDismiss: () => void;
};

export function ReviewPrompt({ onReview, onDismiss }: Props) {
  const { colors, isDark } = useAppTheme();

  const backdropOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0.5);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(12);
  const btnOpacity = useSharedValue(0);
  const btnTranslateY = useSharedValue(16);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    backdropOpacity.value = withTiming(1, { duration: 200 });
    iconScale.value = withDelay(100, withSpring(1, { damping: 14, stiffness: 150 }));
    contentOpacity.value = withDelay(250, withTiming(1, { duration: 300 }));
    contentTranslateY.value = withDelay(250, withTiming(0, { duration: 300 }));
    btnOpacity.value = withDelay(450, withTiming(1, { duration: 250 }));
    btnTranslateY.value = withDelay(450, withSpring(0, { damping: 14, stiffness: 120 }));
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnTranslateY.value }],
  }));

  const handleReview = async () => {
    onReview();
    // Open the App Store review page directly so the user can always leave a review
    const url = Platform.select({
      ios: `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id${APP_STORE_ID}?action=write-review`,
      android: 'market://details?id=com.titrahealth.app',
    });
    if (url) {
      Linking.openURL(url);
    }
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
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
      </Animated.View>

      {/* Content card */}
      <Pressable style={styles.centerer} onPress={onDismiss}>
        <Pressable style={[styles.card, { backgroundColor: colors.cardBg }]} onPress={() => {}}>
          {/* Icon */}
          <Animated.View style={iconStyle}>
            <View style={[styles.iconCircle, { backgroundColor: '#FF742A1F' }]}>
              <Ionicons name="star" size={32} color="#FF742A" />
            </View>
          </Animated.View>

          {/* Title & subtitle */}
          <Animated.View style={[styles.textWrap, contentStyle]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Enjoying Titra?
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Your feedback helps us improve and helps others discover Titra.
            </Text>
          </Animated.View>

          {/* Buttons */}
          <Animated.View style={[styles.btnWrap, btnStyle]}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: '#FF742A', opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleReview}
            >
              <Ionicons name="star" size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryBtnText}>Yes, Love It!</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                { opacity: pressed ? 0.5 : 1 },
              ]}
              onPress={onDismiss}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
                Not Now
              </Text>
            </Pressable>
          </Animated.View>
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
