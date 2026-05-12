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
  const headerStyle = usePreferencesStore((s) => s.headerStyle ?? 'gradient');
  const { top } = useSafeAreaInsets();

  // Total height = desired visible gradient + safe area inset (status bar)
  const totalHeight = height + top;
  // Bleed to screen edges; collapse most of the height so content overlaps.
  // Keep `top` worth of space so the first content item starts below the status bar.
  const base = { marginHorizontal: -20, marginBottom: -height };

  if (headerStyle === 'minimal') {
    // No decorative gradient — just reserve safe-area inset so content clears the status bar
    return (
      <View style={{ height: top, marginHorizontal: -20, backgroundColor: colors.bg }} pointerEvents="none" />
    );
  }

  if (headerStyle === 'solid') {
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
