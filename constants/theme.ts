import { Platform } from 'react-native';

// ─── Dark-first palette ────────────────────────────────────────────────────────

export const BG_BASE        = '#000000';
export const BG_SURFACE     = '#000000';
export const BG_SURFACE2    = '#000000';
export const FONT_FAMILY    = 'Helvetica Neue';
export const CARD_BORDER_WIDTH = 0.5;
export const CARD_BORDER_COLOR = 'rgba(255,255,255,0.18)';
export const ORANGE         = '#FF742A';
export const ORANGE_DIM     = 'rgba(255,116,42,0.15)';
export const TEXT_PRIMARY   = '#FFFFFF';
export const TEXT_SECONDARY = '#9A9490';
export const TEXT_MUTED     = '#5A5754';
export const BORDER_SUBTLE  = 'rgba(255,255,255,0.08)';
export const GLASS_OVERLAY  = 'rgba(255,255,255,0.04)';
export const SHADOW_COLOR   = '#000000';

// ─── Status colors (semantic, unchanged) ──────────────────────────────────────

export const STATUS_GOOD     = '#27AE60';
export const STATUS_LOW      = '#F39C12';
export const STATUS_BAD      = '#E74C3C';

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
