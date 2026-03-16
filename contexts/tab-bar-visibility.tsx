import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface TabBarVisibilityContextValue {
  minimized: Animated.Value;
  onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
  onScrollEnd: () => void;
  expand: () => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | null>(null);

const COLLAPSE_RANGE = 80; // px of downward scroll = full collapse

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const minimized = useRef(new Animated.Value(0)).current;
  const minimizedValue = useRef(0);
  const lastScrollY = useRef(0);
  const springAnim = useRef<Animated.CompositeAnimation | null>(null);

  // Keep mirror perfectly in sync (catches spring updates too)
  useEffect(() => {
    const id = minimized.addListener(({ value }) => {
      minimizedValue.current = value;
    });
    return () => minimized.removeListener(id);
  }, [minimized]);

  const onScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const delta = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      // At the top: always expand
      if (currentY <= 0) {
        springAnim.current?.stop();
        minimized.setValue(0);
        return;
      }

      // Only collapse on downward scroll — ignore upward/bounce events entirely
      if (delta <= 0) return;

      springAnim.current?.stop();
      const next = Math.min(1, minimizedValue.current + delta / COLLAPSE_RANGE);
      minimized.setValue(next);
    },
    [minimized],
  );

  // Snap to nearest end when finger lifts / momentum ends
  const onScrollEnd = useCallback(() => {
    const target = minimizedValue.current >= 0.5 ? 1 : 0;
    springAnim.current = Animated.spring(minimized, {
      toValue: target,
      useNativeDriver: false,
      damping: 24,
      stiffness: 260,
      mass: 0.8,
    });
    springAnim.current.start();
  }, [minimized]);

  // Tap on mini circle → spring back to fully expanded
  const expand = useCallback(() => {
    springAnim.current?.stop();
    springAnim.current = Animated.spring(minimized, {
      toValue: 0,
      useNativeDriver: false,
      damping: 24,
      stiffness: 260,
      mass: 0.8,
    });
    springAnim.current.start();
  }, [minimized]);

  return (
    <TabBarVisibilityContext.Provider value={{ minimized, onScroll, onScrollEnd, expand }}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) throw new Error('useTabBarVisibility must be used within TabBarVisibilityProvider');
  return ctx;
}
