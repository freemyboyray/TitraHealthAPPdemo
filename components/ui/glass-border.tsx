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
        borderTopColor:    isDark ? 'rgba(210,190,170,0.13)' : 'rgba(80,60,40,0.10)',
        borderLeftColor:   isDark ? 'rgba(210,190,170,0.08)' : 'rgba(80,60,40,0.06)',
        borderRightColor:  isDark ? 'rgba(210,190,170,0.03)' : 'rgba(80,60,40,0.02)',
        borderBottomColor: isDark ? 'rgba(210,190,170,0.02)' : 'rgba(80,60,40,0.01)',
      }}
    />
  );
}
