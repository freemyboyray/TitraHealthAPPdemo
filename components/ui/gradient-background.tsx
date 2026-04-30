import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/contexts/theme-context';
import { usePreferencesStore } from '@/stores/preferences-store';

/**
 * Apple Health-style gradient background.
 * Place as the first child inside a ScrollView (no SafeAreaView top edge).
 * The gradient includes the safe area height so it fills behind the status bar.
 * Uses negative marginBottom so content overlaps the gradient.
 */
export function GradientBackground({ height = 350 }: { height?: number }) {
  const { colors } = useAppTheme();
  const useGradient = usePreferencesStore((s: { useGradientHeader: boolean }) => s.useGradientHeader);
  const { top } = useSafeAreaInsets();

  // Total height = desired visible gradient + safe area inset (status bar)
  const totalHeight = height + top;
  // Bleed to screen edges; collapse most of the height so content overlaps.
  // Keep `top` worth of space so the first content item starts below the status bar.
  const base = { marginHorizontal: -20, marginBottom: -height };

  if (!useGradient) {
    // Solid orange header. The gradient version fades orange → bg across its
    // full height, but for solid mode we need an explicit split: orange on top
    // (status bar + header content area) then the page bg colour for the rest.
    // This keeps the orange from bleeding behind cards further down the page.
    // Orange is flat (no radius). The bg area curves up into the orange
    // with rounded top corners — matching the reference design.
    // Content starts overlapping at Y = `top` (due to marginBottom: -height).
    // Header area is ~70px (paddingTop 6 + text ~50px + paddingBottom 14).
    // White curve must start before the first card, so orange = header only.
    const orangeHeight = top + 65;
    return (
      <View style={{ height: totalHeight, ...base, backgroundColor: colors.orange }} pointerEvents="none">
        <View style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: orangeHeight,
          bottom: 0,
          backgroundColor: colors.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={colors.heroGradient as unknown as [string, string, ...string[]]}
      locations={[0, 0.3, 0.55, 1.0]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ height: totalHeight, ...base }}
      pointerEvents="none"
    />
  );
}
