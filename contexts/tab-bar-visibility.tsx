import React, { createContext, useCallback, useContext, useRef } from 'react';
import { Animated } from 'react-native';

interface TabBarVisibilityContextValue {
  minimized: Animated.Value;
  onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
  onScrollEnd: () => void;
  expand: () => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | null>(null);

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  // Pinned at 0 (fully expanded) for the lifetime of the provider — the nav bar
  // no longer collapses into the mini circle on scroll.
  const minimized = useRef(new Animated.Value(0)).current;

  // Tab bar stays fully expanded at all times — scrolling no longer collapses it.
  // Handlers are kept as no-ops so existing scroll wiring throughout the app
  // continues to work without changes.
  const onScroll = useCallback(() => {}, []);
  const onScrollEnd = useCallback(() => {}, []);
  const expand = useCallback(() => {}, []);

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
