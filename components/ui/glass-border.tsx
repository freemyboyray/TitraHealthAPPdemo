import { View } from 'react-native';

export function GlassBorder({ r = 24, isDark = true }: { r?: number; isDark?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: r,
        borderWidth: 1,
        borderTopColor:    isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.10)',
        borderLeftColor:   isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        borderRightColor:  isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        borderBottomColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      }}
    />
  );
}
