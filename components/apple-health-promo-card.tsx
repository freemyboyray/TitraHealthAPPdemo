import { useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { Heart, X } from 'lucide-react-native';

const FF = 'System';
const HEALTH_NAME = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
const HEALTH_COLOR = Platform.OS === 'ios' ? '#FF2D55' : '#4285F4';

// ─── Icon ─────────────────────────────────────────────────────────────────────

function SyncIcon({ isDark }: { isDark: boolean }) {
  const size = 72;
  const cx = size / 2;
  const cy = size / 2;
  const ringColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)';
  const dotColor = isDark ? 'rgba(90,200,250,0.6)' : 'rgba(90,200,250,0.8)';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <Circle cx={cx} cy={cy} r={32} stroke={ringColor} strokeWidth={1.5} fill="none" />
        <Circle cx={cx} cy={cy} r={26} stroke={dotColor} strokeWidth={2}
          strokeDasharray="3 5" strokeLinecap="round" fill="none" />
      </Svg>
      <Heart size={28} color={HEALTH_COLOR} />
    </View>
  );
}

// ─── Card Component ─────────────────────────────────────────────────────────

type Props = {
  onConnect: () => void;
  onDismiss: () => void;
};

export function AppleHealthPromoCard({ onConnect, onDismiss }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={s.wrap}
      onPress={onConnect}
      activeOpacity={0.82}
      accessibilityLabel={`Sync with ${HEALTH_NAME}`}
      accessibilityRole="button"
    >
      {/* Dismiss button */}
      <TouchableOpacity
        style={s.dismissBtn}
        onPress={(e) => { e.stopPropagation(); onDismiss(); }}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={`Dismiss ${HEALTH_NAME} prompt`}
        accessibilityRole="button"
      >
        <X size={18} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} />
      </TouchableOpacity>

      <View style={s.slideInner}>
        <View style={s.row}>
          <SyncIcon isDark={colors.isDark} />
          <View style={s.textWrap}>
            <Text style={s.title}>Sync with {HEALTH_NAME}</Text>
            <Text style={s.subtitle}>
              Pull in weight, activity, sleep, and vitals automatically for smarter insights and personalized tracking.
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
    slideInner: {
      padding: 18,
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
