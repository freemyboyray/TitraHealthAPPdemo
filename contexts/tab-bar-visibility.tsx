import React, { createContext, useCallback, useContext, useRef } from 'react';
import { Animated } from 'react-native';

interface TabBarVisibilityContextValue {
  translateY: Animated.Value;
  onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | null>(null);

const TAB_BAR_HEIGHT = 100; // approximate pill + safe area height

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isHidden = useRef(false);

  const onScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const delta = currentY - lastScrollY.current;

      if (delta > 4 && !isHidden.current && currentY > 50) {
        // Scrolling down — hide tab bar
        isHidden.current = true;
        Animated.spring(translateY, {
          toValue: TAB_BAR_HEIGHT,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }).start();
      } else if (delta < -4 && isHidden.current) {
        // Scrolling up — show tab bar
        isHidden.current = false;
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }).start();
      }

      lastScrollY.current = currentY;
    },
    [translateY]
  );

  return (
    <TabBarVisibilityContext.Provider value={{ translateY, onScroll }}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) throw new Error('useTabBarVisibility must be used within TabBarVisibilityProvider');
  return ctx;
}
