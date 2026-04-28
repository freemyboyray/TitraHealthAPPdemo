import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { contentCategoryColor } from '@/constants/theme';
import { CourseProgressRing } from './course-progress-ring';
import type { CourseRow } from '@/stores/courses-store';

const FF = 'System';
const ORANGE = '#FF742A';

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
  const catColor = contentCategoryColor(colors.isDark, course.category);
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
      backgroundColor: c.isDark ? c.surface : '#FFFFFF',
      borderRadius: 20,
      borderWidth: c.isDark ? 0.5 : 1,
      borderColor: c.isDark ? c.border : 'rgba(0,0,0,0.06)',
      padding: 16,
      marginRight: 12,
      shadowColor: c.isDark ? '#000000' : 'rgba(0,0,0,0.08)',
      shadowOffset: { width: 0, height: c.isDark ? 6 : 2 },
      shadowOpacity: c.isDark ? 0.2 : 1,
      shadowRadius: c.isDark ? 16 : 8,
      elevation: c.isDark ? 6 : 2,
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
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: 'System',
      marginBottom: 4,
      lineHeight: 20,
    },
    subtitle: {
      fontSize: 14,
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
      fontSize: 12,
      fontWeight: '700',
      fontFamily: FF,
    },
    lessonCount: {
      fontSize: 13,
      fontWeight: '600',
      color: w(0.35),
      fontFamily: FF,
    },
  });
};
