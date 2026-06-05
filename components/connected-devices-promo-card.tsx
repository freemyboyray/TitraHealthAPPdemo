import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '@/contexts/theme-context';
import { HEALTH_SERVICE_NAME } from '@/lib/health-service';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { Smartphone, X } from 'lucide-react-native';

const FF = 'System';

// ─── Dotted Ring + Smartphone Icon ──────────────────────────────────────────

function DevicesIcon({ isDark }: { isDark: boolean }) {
  const size = 72;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 32;
  const innerR = 26;
  const ringColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)';
  const dotColor = isDark ? 'rgba(255,149,0,0.6)' : 'rgba(255,149,0,0.8)';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        {/* Outer ring */}
        <Circle cx={cx} cy={cy} r={outerR} stroke={ringColor} strokeWidth={1.5} fill="none" />
        {/* Dotted ring */}
        <Circle
          cx={cx} cy={cy} r={innerR}
          stroke={dotColor} strokeWidth={2}
          strokeDasharray="3 5" strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <Smartphone size={28} color="#FF9500" />
    </View>
  );
}

// ─── Card Component ─────────────────────────────────────────────────────────

type Props = {
  onExplore: () => void;
  onDismiss: () => void;
};

export function ConnectedDevicesPromoCard({ onExplore, onDismiss }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={s.wrap}
      onPress={onExplore}
      activeOpacity={0.82}
      accessibilityLabel="Explore compatible devices"
      accessibilityRole="button"
      accessibilityHint="Opens the connected devices directory"
    >
      <View style={s.inner}>
        {/* Dismiss button */}
        <TouchableOpacity
          style={s.dismissBtn}
          onPress={(e) => { e.stopPropagation(); onDismiss(); }}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Dismiss connected devices prompt"
          accessibilityRole="button"
        >
          <X size={18} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} />
        </TouchableOpacity>

        {/* Content row */}
        <View style={s.row}>
          <DevicesIcon isDark={colors.isDark} />
          <View style={s.textWrap}>
            <Text style={s.title}>Supercharge Your Tracking</Text>
            <Text style={s.subtitle}>
              Connect a smart scale, CGM, or fitness tracker — data flows into Titra automatically via {HEALTH_SERVICE_NAME}.
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: {
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: c.isDark ? c.surface : '#FFFFFF',
      borderWidth: 0.5,
      borderColor: c.borderSubtle,
      ...cardElevation(c.isDark),
    },
    inner: {
      padding: 18,
    },
    dismissBtn: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 2,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: w(0.06),
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingRight: 28,
    },
    textWrap: {
      flex: 1,
      gap: 4,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: FF,
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '400',
      color: w(0.45),
      fontFamily: FF,
      lineHeight: 19,
    },
  });
};
