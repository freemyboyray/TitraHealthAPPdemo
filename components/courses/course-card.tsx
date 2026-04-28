import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { CourseProgressRing } from './course-progress-ring';
import type { CourseRow } from '@/stores/courses-store';

const FF = 'Inter_400Regular';
const ORANGE = '#FF742A';

const CATEGORY_COLORS: Record<string, string> = {
  medical: ORANGE,
  nutrition: '#27AE60',
  mental_health: '#9B59B6',
  lifestyle: '#5B8BF5',
};

const CATEGORY_LABELS: Record<string, string> = {
  medical: 'Medical',
  nutrition: 'Nutrition',
  mental_health: 'Mental Health',
  lifestyle: 'Lifestyle',
};

type Props = {
  course: CourseRow;
  completedCount: number;
};

function renderIcon(name: string, iconSet: string, size: number, color: string) {
  if (iconSet === 'MaterialIcons') return <MaterialIcons name={name as any} size={size} color={color} />;
  if (iconSet === 'MaterialCommunityIcons') return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
  return <Ionicons name={name as any} size={size} color={color} />;
}

export function CourseCard({ course, completedCount }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const catColor = CATEGORY_COLORS[course.category] ?? ORANGE;
  const done = completedCount >= course.lesson_count;

  return (
    <Pressable
      style={s.card}
      onPress={() => router.push(`/courses/${course.slug}` as any)}
    >
      {/* Icon + progress ring */}
      <View style={s.topRow}>
        <View style={[s.iconWrap, { backgroundColor: catColor + '18' }]}>
          {renderIcon(course.icon_name, course.icon_set, 22, catColor)}
        </View>
        <CourseProgressRing
          completed={completedCount}
          total={course.lesson_count}
          size={32}
          strokeWidth={2.5}
          color={done ? '#27AE60' : ORANGE}
          trackColor={colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
        />
      </View>

      {/* Title */}
      <Text style={s.title} numberOfLines={2}>{course.title}</Text>

      {/* Subtitle */}
      {course.subtitle && (
        <Text style={s.subtitle} numberOfLines={2}>{course.subtitle}</Text>
      )}

      {/* Footer: category + lessons */}
      <View style={s.footer}>
        <View style={[s.categoryChip, { backgroundColor: catColor + '18' }]}>
          <Text style={[s.categoryText, { color: catColor }]}>
            {CATEGORY_LABELS[course.category] ?? course.category}
          </Text>
        </View>
        <Text style={s.lessonCount}>
          {completedCount}/{course.lesson_count}
        </Text>
      </View>
    </Pressable>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    card: {
      width: 200,
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 16,
      marginRight: 12,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: 'Inter_700Bold',
      marginBottom: 4,
      lineHeight: 20,
    },
    subtitle: {
      fontSize: 12,
      color: w(0.45),
      fontFamily: FF,
      lineHeight: 16,
      marginBottom: 12,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 'auto',
    },
    categoryChip: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    categoryText: {
      fontSize: 10,
      fontWeight: '700',
      fontFamily: FF,
    },
    lessonCount: {
      fontSize: 11,
      fontWeight: '600',
      color: w(0.35),
      fontFamily: FF,
    },
  });
};
