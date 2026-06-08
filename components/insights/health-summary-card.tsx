import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { ChevronRight, Lock } from 'lucide-react-native';

import { LucideIconByName } from '@/lib/lucide-icon-map';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { Sparkline } from '@/components/insights/sparkline';

const FF = 'System';

export type HealthSummaryCardProps = {
  /** Large illustration that dominates the right side of the card, when provided. */
  image?: ImageSourcePropType;
  iconName: string;
  iconColor: string;
  label: string;
  value: string;
  unit?: string;
  descriptor?: { text: string; color: string };
  /** Max lines for the status descriptor (default 1). */
  descriptorLines?: number;
  sparkline?: { values: (number | null)[]; color: string };
  /** Custom right-side element (e.g. a gauge) used instead of a sparkline. */
  rightSlot?: React.ReactNode;
  locked?: boolean;
  noData?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
};

/**
 * Apple-Health / Bevel-style stacked metric card. Two layouts:
 *  - with `image`: label → value → status → mini graph stacked on the left, with a large
 *    illustration filling (and bleeding off) the right side.
 *  - without `image`: icon + label header, value + status (left), graph/gauge (right).
 */
export function HealthSummaryCard({
  image,
  iconName,
  iconColor,
  label,
  value,
  unit,
  descriptor,
  descriptorLines = 1,
  sparkline,
  rightSlot,
  locked = false,
  noData = false,
  onPress,
  onLongPress,
}: HealthSummaryCardProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [graphW, setGraphW] = useState(0);

  const pressStyle = ({ pressed }: { pressed: boolean }) => [
    s.card,
    noData && { opacity: 0.6 },
    pressed && !!onPress && { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ];

  const commonPress = {
    onPress: locked ? undefined : onPress,
    onLongPress,
    delayLongPress: 400,
    accessibilityRole: onPress ? ('button' as const) : undefined,
    accessibilityLabel: `${label}. ${value}${unit ? ' ' + unit : ''}. ${descriptor?.text ?? ''}`,
  };

  // ── Image layout: stacked text + graph on the left, big illustration on the right ──
  if (image) {
    return (
      <Pressable style={(st) => [pressStyle(st), s.imgCard]} {...commonPress}>
        <View style={s.imgRight} pointerEvents="none">
          <Image source={image} style={s.bigImage} resizeMode="contain" accessibilityIgnoresInvertColors />
        </View>

        <View style={s.imgLeft}>
          <Text style={s.label} numberOfLines={1}>{label}</Text>
          <View style={s.valueRow}>
            <Text style={[s.value, noData && s.valueMuted]}>{value}</Text>
            {!!unit && !noData && <Text style={s.unit}>{unit}</Text>}
          </View>
          {!!descriptor && (
            <Text style={[s.descriptor, { color: descriptor.color }]} numberOfLines={descriptorLines}>
              {descriptor.text}
            </Text>
          )}
          {!noData && sparkline && (
            <View style={s.sparkBelow} onLayout={(e) => setGraphW(e.nativeEvent.layout.width)}>
              <Sparkline values={sparkline.values} color={sparkline.color} width={graphW} height={46} />
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  // ── Default layout (no image): header + value/status left, graph/gauge right ──
  const showChevron = !!onPress && !locked;
  return (
    <Pressable style={pressStyle} {...commonPress}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <LucideIconByName name={iconName} size={15} color={iconColor} />
          <Text style={s.label} numberOfLines={1}>{label}</Text>
        </View>
        {locked ? (
          <Lock size={15} color={colors.textMuted} />
        ) : showChevron ? (
          <ChevronRight size={18} color={colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
        ) : null}
      </View>

      <View style={s.body}>
        <View style={s.bodyLeft}>
          <View style={s.valueRow}>
            <Text style={[s.value, noData && s.valueMuted]}>{value}</Text>
            {!!unit && !noData && <Text style={s.unit}>{unit}</Text>}
          </View>
          {!!descriptor && (
            <Text style={[s.descriptor, { color: descriptor.color }]} numberOfLines={descriptorLines}>
              {descriptor.text}
            </Text>
          )}
        </View>

        {!noData && (
          <View style={s.bodyRight}>
            {rightSlot ?? (sparkline ? <Sparkline values={sparkline.values} color={sparkline.color} /> : null)}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      // overflow defaults to 'visible' so the big illustration can bleed past the edge
      shadowColor: '#000',
      shadowOffset: { width: 0, height: c.isDark ? 8 : 2 },
      shadowOpacity: c.isDark ? 0.3 : 0.06,
      shadowRadius: c.isDark ? 24 : 8,
      elevation: 2,
    },

    // Image layout
    imgCard: {
      minHeight: 150,
      justifyContent: 'center',
    },
    imgRight: {
      position: 'absolute',
      right: 18,
      top: 0,
      bottom: 0,
      width: 118,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bigImage: {
      width: 114,
      height: 114,
    },
    imgLeft: {
      marginRight: 134,
    },
    sparkBelow: {
      marginTop: 10,
      alignSelf: 'stretch',
    },

    // Shared
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textPrimary,
      letterSpacing: -0.2,
      fontFamily: FF,
      flexShrink: 1,
    },
    body: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    bodyLeft: {
      flex: 1,
      justifyContent: 'center',
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 5,
    },
    value: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.6,
      fontFamily: FF,
    },
    valueMuted: {
      color: c.textMuted,
    },
    unit: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textSecondary,
      marginBottom: 3,
      fontFamily: FF,
    },
    descriptor: {
      fontSize: 13,
      fontWeight: '600',
      fontFamily: FF,
      marginTop: 4,
      flexShrink: 1,
    },
    bodyRight: {
      marginLeft: 12,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
  });
