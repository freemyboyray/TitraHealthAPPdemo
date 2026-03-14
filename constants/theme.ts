import { Platform } from 'react-native';

// ─── App color type ────────────────────────────────────────────────────────────

export type AppColors = {
  bg: string;
  surface: string;
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
  blurTint: 'dark' | 'light';
  statusBar: 'light' | 'dark';
  /** true = dark mode, false = light mode. Use to flip rgba(255,255,255,X) → rgba(0,0,0,X) in createStyles factories. */
  isDark: boolean;
};

// ─── Dark palette (default) ────────────────────────────────────────────────────

export const darkColors: AppColors = {
  bg: '#000000',
  surface: '#111111',
  textPrimary: '#FFFFFF',
  textSecondary: '#9A9490',
  textMuted: '#5A5754',
  orange: '#FF742A',
  orangeDim: 'rgba(255,116,42,0.15)',
  border: 'rgba(255,255,255,0.18)',
  borderSubtle: 'rgba(255,255,255,0.08)',
  glassOverlay: 'rgba(255,255,255,0.04)',
  shadowColor: '#000000',
  ringTrack: 'rgba(255,255,255,0.12)',
  blurTint: 'dark',
  statusBar: 'light',
  isDark: true,
};

// ─── Light palette ─────────────────────────────────────────────────────────────

export const lightColors: AppColors = {
  bg: '#FFFFFF',
  surface: '#F5F5F5',
  textPrimary: '#000000',
  textSecondary: '#6B6868',
  textMuted: '#9A9490',
  orange: '#FF742A',
  orangeDim: 'rgba(255,116,42,0.15)',
  border: 'rgba(0,0,0,0.18)',
  borderSubtle: 'rgba(0,0,0,0.08)',
  glassOverlay: 'rgba(0,0,0,0.04)',
  shadowColor: '#000000',
  ringTrack: 'rgba(0,0,0,0.12)',
  blurTint: 'light',
  statusBar: 'dark',
  isDark: false,
};

// ─── Status colors (semantic — unchanged in both modes) ───────────────────────

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
