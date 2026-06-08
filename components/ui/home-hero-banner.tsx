import type { ReactNode } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';

// Atmospheric home header — a calm dawn/night horizon at the top of the home
// screen. The greeting + calendar (children) render ON the image; the scene
// resolves to the solid app background at its bottom edge so the first card
// below sits on a clean plain background. Dawn in light mode, night in dark.
const IMG_DARK = require('@/assets/images/home-hero-dark.png');
const IMG_LIGHT = require('@/assets/images/home-hero-light.png');

// Fixed scene height below the status bar (greeting sits at the bottom of it).
const BAND_HEIGHT = 200;

// Negative pulls the image UP within the band so the low sun (~0.65 down the
// art) clears the greeting. Flow margins (unlike absolute `top`) are honoured.
const IMAGE_MARGIN_TOP = -52;

// Build an rgba() from the theme bg hex (not the keyword `transparent`, which is
// transparent *black* and would leave a grey smear).
function bgAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Place as the FIRST child inside the home ScrollView's content (which has
 * 20pt horizontal padding). The negative horizontal margin bleeds the banner
 * to the screen edges and behind the status bar. Pass the greeting/calendar
 * row as children — they render over the bottom of the scene.
 */
export function HomeHeroBanner({ children, topRight, topLeft }: { children?: ReactNode; topRight?: ReactNode; topLeft?: ReactNode }) {
  const { colors } = useAppTheme();
  const { top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const bandHeight = top + BAND_HEIGHT;
  // Fill the whole band (image bottom = band bottom) so the foreground reaches
  // the bottom edge — no hard image seam — and the scrim can melt it into bg.
  const imageHeight = bandHeight - IMAGE_MARGIN_TOP;

  // Colour of the sky at the top of each scene — used to fill the bounce-
  // overscroll area above the header so it continues the sky instead of
  // flashing the stark page background.
  const skyTop = colors.isDark ? '#1D182C' : '#DACAE4';

  return (
    <View style={{ marginHorizontal: -20 }}>
      {/* Overscroll fill above the header. */}
      <View
        style={{ position: 'absolute', top: -800, left: 0, right: 0, height: 800, backgroundColor: skyTop }}
        pointerEvents="none"
      />
      <View style={{ height: bandHeight, backgroundColor: colors.bg, overflow: 'hidden' }}>
        {/* In normal flow with a negative top margin so it's pulled up to reveal
            the sun/horizon; the art's near-black foreground blends into the bg
            for any gap left below it. */}
        <Image
          source={colors.isDark ? IMG_DARK : IMG_LIGHT}
          style={{ width, height: imageHeight, marginTop: IMAGE_MARGIN_TOP }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        {/* Scene clear up top, resolving to the solid app bg toward the bottom —
            keeps the greeting legible and the bottom edge a seamless plain
            background for the first card below. */}
        <LinearGradient
          colors={[bgAlpha(colors.bg, 0), bgAlpha(colors.bg, 0), colors.bg]}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {topLeft && (
          <View style={{ position: 'absolute', top: top + 8, left: 20 }} pointerEvents="box-none">
            {topLeft}
          </View>
        )}
        {topRight && (
          <View style={{ position: 'absolute', top: top + 8, right: 20 }} pointerEvents="box-none">
            {topRight}
          </View>
        )}
        {children && <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>{children}</View>}
      </View>
    </View>
  );
}
