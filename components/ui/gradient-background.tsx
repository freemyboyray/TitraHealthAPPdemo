import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/contexts/theme-context';
import { usePreferencesStore } from '@/stores/preferences-store';

/**
 * Apple Health-style gradient background (toggleable).
 * When gradient is enabled: renders a multi-stop orange-to-bg gradient.
 * When disabled: renders a solid orange header bar.
 * Place as the first child inside a container with `{ flex: 1, backgroundColor: colors.bg }`.
 */
export function GradientBackground({ height = 320 }: { height?: number }) {
  const { colors } = useAppTheme();
  const useGradient = usePreferencesStore((s) => s.useGradientHeader);

  if (!useGradient) {
    const solidHeight = height * 0.55;
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Orange section at top */}
        <View style={{ height: solidHeight, backgroundColor: colors.orange }} />
        {/* Bg section with rounded top corners — overlaps orange by 28px to create the curve */}
        <View style={{
          flex: 1,
          backgroundColor: colors.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          marginTop: -28,
        }} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={colors.heroGradient as unknown as string[]}
      locations={[0, 0.3, 0.55, 1.0]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.base, { height }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
});
