import { Platform } from 'react-native';

// ─── App color type ────────────────────────────────────────────────────────────

export type AppColors = {
  bg: string;
  surface: string;
  /** Card background — #111111 dark / #FFFFFF light. Cards stand out from the page bg. */
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  orange: string;
  orangeDim: string;
  border: string;
  borderSubtle: string;
  glassOverlay: string;
  shadowColor: string;
  ringTrack: string;
  blurTint: 'dark' | 'light' | 'systemThinMaterialDark' | 'systemThinMaterialLight' | 'systemChromeMaterialDark' | 'systemChromeMaterialLight' | 'systemUltraThinMaterialDark' | 'systemUltraThinMaterialLight' | 'systemMaterialDark' | 'systemMaterialLight';
  statusBar: 'light' | 'dark';
  /** true = dark mode, false = light mode. Use to flip rgba(255,255,255,X) → rgba(0,0,0,X) in createStyles factories. */
  isDark: boolean;
};

// ─── Dark palette (default) ────────────────────────────────────────────────────

export const darkColors: AppColors = {
  bg: '#000000',
  surface: '#111111',
  cardBg: '#111111',
  textPrimary: '#FFFFFF',
  textSecondary: '#9A9490',
  textMuted: '#5A5754',
  orange: '#FF742A',
  orangeDim: 'rgba(255,116,42,0.15)',
  border: 'rgba(255,255,255,0.18)',
  borderSubtle: 'rgba(255,255,255,0.08)',
  glassOverlay: 'rgba(255,255,255,0.02)',
  shadowColor: '#000000',
  ringTrack: 'rgba(255,255,255,0.06)',
  blurTint: 'systemThinMaterialDark',
  statusBar: 'light',
  isDark: true,
};

// ─── Light palette ─────────────────────────────────────────────────────────────

export const lightColors: AppColors = {
  bg: '#F2F1EF',
  surface: '#FFFFFF',
  cardBg: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#6B6868',
  textMuted: '#6B6562',
  orange: '#FF742A',
  orangeDim: 'rgba(255,116,42,0.15)',
  border: 'rgba(0,0,0,0.14)',
  borderSubtle: 'rgba(0,0,0,0.10)',
  glassOverlay: 'rgba(0,0,0,0.03)',
  shadowColor: '#000000',
  ringTrack: 'rgba(0,0,0,0.08)',
  blurTint: 'systemThinMaterialLight',
  statusBar: 'dark',
  isDark: false,
};

// ─── Status colors (semantic - unchanged in both modes) ───────────────────────

export const STATUS_GOOD = '#27AE60';
export const STATUS_LOW  = '#F39C12';
export const STATUS_BAD  = '#E74C3C';

// ─── Back-compat named exports ────────────────────────────────────────────────

export const ORANGE       = '#FF742A';
export const FONT_FAMILY  = 'Helvetica Neue';

// ─── Back-compat flat exports (dark values) ───────────────────────────────────

export const BG_BASE        = '#000000';
export const BG_SURFACE     = '#000000';
export const BG_SURFACE2    = '#000000';
export const CARD_BORDER_WIDTH = 0.5;
export const CARD_BORDER_COLOR = 'rgba(255,255,255,0.18)';
export const ORANGE_DIM     = 'rgba(255,116,42,0.15)';
export const TEXT_PRIMARY   = '#FFFFFF';
export const TEXT_SECONDARY = '#9A9490';
export const TEXT_MUTED     = '#5A5754';
export const BORDER_SUBTLE  = 'rgba(255,255,255,0.08)';
export const GLASS_OVERLAY  = 'rgba(255,255,255,0.04)';
export const SHADOW_COLOR   = '#000000';

// ─── Legacy Colors object (kept for compatibility) ────────────────────────────

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
  },
};

// ─── Card elevation helper ─────────────────────────────────────────────────────
// Dark: glass shadow. Light: thin border only — no shadow on white backgrounds.

export function cardElevation(isDark: boolean): {
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
  borderWidth?: number;
  borderColor?: string;
} {
  if (isDark) {
    return {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.20,
      shadowRadius: 20,
      elevation: 6,
    };
  }
  return {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  };
}

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
