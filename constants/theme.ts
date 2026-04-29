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
  /** Hero header gradient stops (top → bottom), used with expo-linear-gradient. */
  heroGradient: readonly string[];
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
  heroGradient: ['#5C3324', '#8B4A2B', '#C4652A', '#000000'] as const,
  isDark: true,
};

// ─── Light palette ─────────────────────────────────────────────────────────────

export const lightColors: AppColors = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  cardBg: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6965',
  textMuted: '#9A9690',
  orange: '#E8652A',
  orangeDim: 'rgba(232,101,42,0.10)',
  border: 'rgba(0,0,0,0.06)',
  borderSubtle: 'rgba(0,0,0,0.03)',
  glassOverlay: 'rgba(0,0,0,0.02)',
  shadowColor: 'rgba(30,40,80,1)',
  ringTrack: 'rgba(0,0,0,0.04)',
  blurTint: 'systemThinMaterialLight',
  statusBar: 'dark',
  heroGradient: ['#D4845A', '#E8975A', '#F2A96B', '#F2F2F7'] as const,
  isDark: false,
};

// ─── Status colors (semantic) ─────────────────────────────────────────────────
// Dark mode uses lighter tones; light mode uses deeper tones for WCAG AA on white.

export const STATUS_GOOD = '#27AE60';
export const STATUS_LOW  = '#F39C12';
export const STATUS_BAD  = '#E74C3C';

export const STATUS_GOOD_LIGHT = '#1D9A54';
export const STATUS_LOW_LIGHT  = '#D4860A';
export const STATUS_BAD_LIGHT  = '#D63031';

/** Pick the right semantic color based on mode */
export function statusColor(isDark: boolean) {
  return {
    good: isDark ? STATUS_GOOD : STATUS_GOOD_LIGHT,
    low:  isDark ? STATUS_LOW  : STATUS_LOW_LIGHT,
    bad:  isDark ? STATUS_BAD  : STATUS_BAD_LIGHT,
  };
}

// ─── Apple Health-inspired category colors ───────────────────────────────────

export const CATEGORY_COLORS: Record<string, { dark: string; light: string }> = {
  medication:  { dark: '#FF742A', light: '#E8652A' },
  nutrition:   { dark: '#34C759', light: '#28A745' },
  hydration:   { dark: '#5AC8FA', light: '#2A9FD6' },
  activity:    { dark: '#5B8BF5', light: '#3D6FE0' },
  vitals:      { dark: '#FF3B30', light: '#D63031' },
  body:        { dark: '#AF52DE', light: '#9B37C4' },
  sleep:       { dark: '#5856D6', light: '#4A48B8' },
  mindfulness: { dark: '#FF9500', light: '#E8860A' },
  glucose:     { dark: '#FF2D55', light: '#E0264A' },
};

/** Get the category color for the current mode */
export function categoryColor(isDark: boolean, key: string): string {
  const entry = CATEGORY_COLORS[key];
  if (!entry) return isDark ? '#FF742A' : '#E8652A';
  return isDark ? entry.dark : entry.light;
}

/** Map FocusCategory id to category key */
const FOCUS_TO_CATEGORY: Record<string, string> = {
  injection: 'medication',
  hydration: 'hydration',
  protein:   'nutrition',
  fiber:     'nutrition',
  activity:  'activity',
  sleep:     'sleep',
  recovery:  'vitals',
  rest:      'mindfulness',
};

export function focusCategoryColor(isDark: boolean, focusId: string): string {
  return categoryColor(isDark, FOCUS_TO_CATEGORY[focusId] ?? 'medication');
}

// ─── Typography scale (Apple HIG-aligned) ──────────────────────────────────

export const TYPE = {
  display:  { fontSize: 28, fontWeight: '800' as const, lineHeight: 34 },
  title1:   { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  title2:   { fontSize: 20, fontWeight: '700' as const, lineHeight: 25 },
  title3:   { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body:     { fontSize: 15, fontWeight: '400' as const, lineHeight: 20 },
  callout:  { fontSize: 14, fontWeight: '600' as const, lineHeight: 19 },
  caption1: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  caption2: { fontSize: 11, fontWeight: '600' as const, lineHeight: 13 },
};

// ─── Spacing scale (8px base) ──────────────────────────────────────────────

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

/** Map content categories (courses/articles) to category key */
const CONTENT_TO_CATEGORY: Record<string, string> = {
  medical:       'medication',
  nutrition:     'nutrition',
  mental_health: 'sleep',
  lifestyle:     'activity',
};

export function contentCategoryColor(isDark: boolean, contentCategory: string): string {
  return categoryColor(isDark, CONTENT_TO_CATEGORY[contentCategory] ?? 'medication');
}

/** Map health monitor groups to category key */
const HM_TO_CATEGORY: Record<string, string> = {
  'Vitals':           'vitals',
  'Body Composition': 'body',
  'Activity':         'activity',
  'Workouts':         'activity',
  'Mindfulness':      'mindfulness',
  'Glucose (24h)':    'glucose',
};

export function healthCategoryColor(isDark: boolean, groupName: string): string {
  return categoryColor(isDark, HM_TO_CATEGORY[groupName] ?? 'vitals');
}

// ─── Back-compat named exports ────────────────────────────────────────────────

export const ORANGE       = '#FF742A';
export const FONT_FAMILY  = 'System';

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
    shadowColor: 'rgba(30,40,80,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  };
}

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'System',
    serif: 'serif',
    rounded: 'System',
    mono: 'monospace',
  },
  web: {
    sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
