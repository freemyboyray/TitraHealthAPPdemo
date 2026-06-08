import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/contexts/theme-context';

/**
 * Header background. The decorative gradient header was removed — every screen
 * now uses a solid background (colors.bg). This just reserves the safe-area
 * inset so the first content item clears the status bar. Kept as a component
 * (and keeps the `height` prop) so existing callers don't need to change.
 */
export function GradientBackground({ height: _height = 350 }: { height?: number }) {
  const { colors } = useAppTheme();
  const { top } = useSafeAreaInsets();

  return (
    <View
      style={{ height: top, marginHorizontal: -20, backgroundColor: colors.bg }}
      pointerEvents="none"
    />
  );
}
