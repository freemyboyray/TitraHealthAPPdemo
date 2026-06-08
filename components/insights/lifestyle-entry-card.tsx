import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { LucideIconByName } from '@/lib/lucide-icon-map';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { Sparkline } from '@/components/insights/sparkline';
import { SeverityBars } from '@/components/insights/severity-bars';

const FF = 'System';

export type LifestyleEntryCardProps = {
  /** Illustration that sits in the card background; falls back to the lucide icon. */
  image?: ImageSourcePropType;
  iconName: string;
  color: string;
  title: string;
  description: string;
  value: string;
  unit?: string;
  sparkline?: { values: (number | null)[]; color: string };
  /** 7-day severity bar graph; rendered in place of the sparkline when provided. */
  bars?: { values: (number | null)[] };
  onPress?: () => void;
  onLongPress?: () => void;
};

/**
 * Large "entry" card for the Lifestyle tab: a titled hub (e.g. Nutrition) that opens a
 * detail screen. The illustration bleeds into the card background (top-right), and the
 * mini graph spans the full width, centered below the text.
 */
export function LifestyleEntryCard({
  image,
  iconName,
  color,
  title,
  description,
  value,
  unit,
  sparkline,
  bars,
  onPress,
  onLongPress,
}: LifestyleEntryCardProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [graphW, setGraphW] = useState(0);

  return (
    <Pressable
      style={({ pressed }) => [s.card, bars && s.cardBars, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${value}${unit ? ' ' + unit : ''}. ${description}`}
    >
      {/* Illustration as part of the card background (bleeds off the top-right) */}
      {image ? (
        <Image source={image} style={s.bgArt} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : null}

      <View style={s.headerRow}>
        {!image && (
          <View style={[s.iconWrap, { backgroundColor: color + '1F' }]}>
            <LucideIconByName name={iconName} size={18} color={color} />
          </View>
        )}
        <Text style={s.title}>{title}</Text>
      </View>

      <View style={s.valueRow}>
        <Text style={s.value}>{value}</Text>
        {!!unit && <Text style={s.unit}>{unit}</Text>}
      </View>
      <Text style={s.description} numberOfLines={2}>{description}</Text>

      {bars ? (
        <View style={s.barsWrap} onLayout={(e) => setGraphW(e.nativeEvent.layout.width)}>
          <SeverityBars values={bars.values} width={graphW} height={44} />
        </View>
      ) : (
        !!sparkline && sparkline.values.filter((v) => v != null).length >= 2 && (
          <View style={s.graphWrap} onLayout={(e) => setGraphW(e.nativeEvent.layout.width)}>
            <Sparkline values={sparkline.values} color={sparkline.color} width={graphW} height={46} />
          </View>
        )
      )}
    </Pressable>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 12,
      minHeight: 148,
      justifyContent: 'center',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: c.isDark ? 8 : 6 },
      shadowOpacity: c.isDark ? 0.3 : 0.1,
      shadowRadius: c.isDark ? 24 : 16,
      elevation: 4,
    },
    bgArt: {
      position: 'absolute',
      top: 12,
      right: 6,
      width: 104,
      height: 104,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
      // leave room so the title never runs under the illustration
      paddingRight: 118,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: c.textPrimary,
      letterSpacing: -0.3,
      fontFamily: FF,
    },
    valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
    value: {
      fontSize: 30,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.8,
      fontFamily: FF,
    },
    unit: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textSecondary,
      marginBottom: 4,
      fontFamily: FF,
    },
    description: {
      fontSize: 13,
      fontWeight: '500',
      color: c.textSecondary,
      lineHeight: 18,
      marginTop: 6,
      paddingRight: 118,
      fontFamily: FF,
    },
    graphWrap: {
      marginTop: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Symptom Log variant: stack from the top so the bars can own the bottom edge.
    cardBars: {
      justifyContent: 'flex-start',
    },
    // Pin the bar strip to the bottom and push it down past the card's edge so
    // the bars' bottoms are clipped — they read as rising out of the card.
    barsWrap: {
      marginTop: 'auto',
      paddingTop: 14,
      transform: [{ translateY: 18 }],
    },
  });
