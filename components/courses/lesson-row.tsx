import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
const ORANGE = '#FF742A';

type Props = {
  title: string;
  subtitle: string | null;
  estimatedMinutes: number;
  contentType: string;
  isCompleted: boolean;
  isLast: boolean;
  onPress: () => void;
};

const CONTENT_TYPE_ICONS: Record<string, string> = {
  article: 'document-text-outline',
  checklist: 'checkbox-outline',
  exercise: 'pencil-outline',
  breathing: 'leaf-outline',
};

export function LessonRow({ title, subtitle, estimatedMinutes, contentType, isCompleted, isLast, onPress }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  return (
    <Pressable onPress={onPress} style={[s.row, !isLast && s.rowBorder]}>
      {/* Status icon */}
      <View style={[s.statusCircle, isCompleted && s.statusDone]}>
        {isCompleted ? (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        ) : (
          <Ionicons
            name={(CONTENT_TYPE_ICONS[contentType] ?? 'document-text-outline') as any}
            size={14}
            color={w(0.4)}
          />
        )}
      </View>

      {/* Text */}
      <View style={s.textWrap}>
        <Text style={[s.title, isCompleted && s.titleDone]} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>

      {/* Duration */}
      <Text style={s.duration}>{estimatedMinutes} min</Text>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={16} color={w(0.2)} />
    </Pressable>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 12,
    },
    rowBorder: {
      borderBottomWidth: 0.5,
      borderBottomColor: w(0.06),
    },
    statusCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: w(0.06),
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusDone: {
      backgroundColor: '#27AE60',
    },
    textWrap: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
      fontFamily: FF,
    },
    titleDone: {
      color: w(0.4),
    },
    subtitle: {
      fontSize: 13,
      color: w(0.35),
      fontFamily: FF,
      marginTop: 1,
    },
    duration: {
      fontSize: 13,
      fontWeight: '600',
      color: w(0.3),
      fontFamily: FF,
    },
  });
};
