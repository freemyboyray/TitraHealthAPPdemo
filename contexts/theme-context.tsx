import React, { createContext, useContext } from 'react';
import { usePreferencesStore } from '@/stores/preferences-store';
import { darkColors, lightColors, type AppColors } from '@/constants/theme';

type ThemeContextValue = { colors: AppColors; isDark: boolean };

const ThemeContext = createContext<ThemeContextValue>({ colors: darkColors, isDark: true });

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const isLightMode = usePreferencesStore((s) => s.isLightMode);
  return (
    <ThemeContext.Provider value={{ colors: isLightMode ? lightColors : darkColors, isDark: !isLightMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useAppTheme = () => useContext(ThemeContext);
