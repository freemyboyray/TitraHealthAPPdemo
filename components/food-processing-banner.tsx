import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFoodTaskStore, type FoodTask } from '../stores/food-task-store';
import { useAppTheme } from '@/contexts/theme-context';

const ORANGE = '#FF742A';

export function FoodProcessingBanner() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tasks = useFoodTaskStore((s) => s.tasks);
  const retryTask = useFoodTaskStore((s) => s.retryTask);
  const removeTask = useFoodTaskStore((s) => s.removeTask);

  // Find the most relevant task to display
  const activeTask: FoodTask | undefined =
    tasks.find((t) => t.status === 'processing') ??
    tasks.find((t) => t.status === 'ready') ??
    tasks.find((t) => t.status === 'failed');

  const slideAnim = useRef(new Animated.Value(-100)).current;
  const prevTaskId = useRef<string | null>(null);

  useEffect(() => {
    if (activeTask) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();

      // Haptic when transitioning to ready
      if (activeTask.status === 'ready' && prevTaskId.current === activeTask.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      prevTaskId.current = activeTask.id;
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start();
      prevTaskId.current = null;
    }
  }, [activeTask?.id, activeTask?.status]);

  if (!activeTask) return null;

  const handlePress = () => {
    if (activeTask.status === 'ready') {
      router.push(`/entry/review-food?taskId=${activeTask.id}` as any);
    } else if (activeTask.status === 'failed') {
      retryTask(activeTask.id);
    }
  };

  const handleDismiss = () => {
    if (activeTask.status !== 'processing') {
      removeTask(activeTask.id);
    }
  };

  const isProcessing = activeTask.status === 'processing';
  const isReady = activeTask.status === 'ready';
  const isFailed = activeTask.status === 'failed';

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Pressable onPress={handlePress} disabled={isProcessing}>
        <BlurView
          intensity={60}
          tint={colors.blurTint}
          style={styles.blur}
        >
          <View style={[styles.inner, { backgroundColor: colors.glassOverlay, borderColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)' }]}>
            <View style={styles.content}>
              {isProcessing && (
                <>
                  <ActivityIndicator size="small" color={ORANGE} />
                  <Text style={[styles.text, { color: colors.textPrimary }]}>
                    Analyzing your food...
                  </Text>
                </>
              )}
              {isReady && (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
                  <Text style={[styles.text, { color: colors.textPrimary }]}>
                    Food analysis ready
                  </Text>
                  <View style={styles.tapBadge}>
                    <Text style={styles.tapText}>Tap to review</Text>
                  </View>
                </>
              )}
              {isFailed && (
                <>
                  <Ionicons name="alert-circle" size={18} color="#E74C3C" />
                  <Text style={[styles.text, { color: colors.textPrimary }]}>
                    Analysis failed
                  </Text>
                  <View style={[styles.tapBadge, { backgroundColor: 'rgba(231,76,60,0.15)' }]}>
                    <Text style={[styles.tapText, { color: '#E74C3C' }]}>Tap to retry</Text>
                  </View>
                </>
              )}
            </View>

            {/* Dismiss button for ready/failed */}
            {!isProcessing && (
              <Pressable onPress={handleDismiss} hitSlop={12} style={styles.dismiss}>
                <Ionicons
                  name="close"
                  size={14}
                  color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
                />
              </Pressable>
            )}
          </View>
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  blur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'System',
  },
  tapBadge: {
    backgroundColor: 'rgba(39,174,96,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tapText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#27AE60',
    fontFamily: 'System',
  },
  dismiss: {
    marginLeft: 8,
    padding: 4,
  },
});
