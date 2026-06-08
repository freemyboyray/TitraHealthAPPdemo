import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { usePreferencesStore } from '@/stores/preferences-store';
import { darkColors, lightColors, type AppColors } from '@/constants/theme';

type ThemeContextValue = { colors: AppColors; isDark: boolean };

const ThemeContext = createContext<ThemeContextValue>({ colors: darkColors, isDark: true });

export function AppThemeProvider({
  children,
  force,
}: {
  children: React.ReactNode;
  /** Pin this subtree to a fixed scheme, ignoring the user's preference/system. */
  force?: 'light' | 'dark';
}) {
  const themeMode = usePreferencesStore((s: { themeMode: string }) => s.themeMode);
  const systemScheme = useColorScheme();

  const isDark =
    force === 'light' ? false
    : force === 'dark' ? true
    : themeMode === 'light' ? false
    : themeMode === 'dark' ? true
    : systemScheme !== 'light'; // 'system' mode — follow phone setting

  return (
    <ThemeContext.Provider value={{ colors: isDark ? darkColors : lightColors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useAppTheme = () => useContext(ThemeContext);
