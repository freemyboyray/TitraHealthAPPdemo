import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/contexts/theme-context';

/**
 * Apple Health-style condensed title that fades in at the top when scrolled.
 * Clear/transparent background — just the title text.
 */
export function ScrollTitle({ title, scrollY }: { title: string; scrollY: Animated.Value }) {
  const { colors } = useAppTheme();
  const { top } = useSafeAreaInsets();

  const opacity = scrollY.interpolate({
    inputRange: [60, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { paddingTop: top, height: top + 44 }]} pointerEvents="none">
      <Animated.Text style={[styles.title, { color: colors.textPrimary, opacity }]}>
        {title}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
});
