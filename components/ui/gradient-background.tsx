import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { useAppTheme } from '@/contexts/theme-context';

/**
 * Apple Health-style gradient background.
 * Renders an absolute-positioned gradient that fades from warm orange to the page bg.
 * Place as the first child inside a container with `{ flex: 1, backgroundColor: colors.bg }`.
 */
export function GradientBackground({ height = 320 }: { height?: number }) {
  const { colors } = useAppTheme();
  return (
    <LinearGradient
      colors={colors.heroGradient as unknown as string[]}
      locations={[0, 0.3, 0.55, 1.0]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.gradient, { height }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
});
