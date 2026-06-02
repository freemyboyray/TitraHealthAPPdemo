import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { HelpCircle } from 'lucide-react-native';

import { useAppTheme } from '@/contexts/theme-context';

type Props = {
  /** Icon color. Defaults to theme-aware (white on dark, near-black on light). */
  color?: string;
  /** Icon size in px. */
  size?: number;
  /** 'chip' = filled circular button (e.g. next to the home calendar);
   *  'plain' = bare icon (e.g. trailing a hero title). */
  variant?: 'chip' | 'plain';
  /** Diameter of the chip circle (only used when variant === 'chip'). */
  diameter?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Opens the in-app tutorial (/settings/tutorial). Shared across tab screens so
 * help is always one tap away from the top-right of the page.
 */
export function HelpButton({ color, size = 24, variant = 'plain', diameter = 44, style }: Props) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const iconColor = color ?? (colors.isDark ? '#FFFFFF' : '#1A1A1A');

  return (
    <Pressable
      onPress={() => router.push('/settings/tutorial' as any)}
      hitSlop={10}
      accessibilityLabel="Help and app tutorial"
      accessibilityRole="button"
      style={[
        variant === 'chip' && {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: colors.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.9)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <HelpCircle size={size} color={iconColor} strokeWidth={2} />
    </Pressable>
  );
}
