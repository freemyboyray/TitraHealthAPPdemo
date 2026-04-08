import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useCoursesStore } from '@/stores/courses-store';
import { CourseProgressRing } from '@/components/courses/course-progress-ring';
import { LessonRow } from '@/components/courses/lesson-row';

const FF = 'Helvetica Neue';
const ORANGE = '#FF742A';

const CATEGORY_COLORS: Record<string, string> = {
  medical: ORANGE,
  nutrition: '#27AE60',
  mental_health: '#9B59B6',
  lifestyle: '#5B8BF5',
};

function renderIcon(name: string, iconSet: string, size: number, color: string) {
  if (iconSet === 'MaterialIcons') return <MaterialIcons name={name as any} size={size} color={color} />;
  if (iconSet === 'MaterialCommunityIcons') return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
  return <Ionicons name={name as any} size={size} color={color} />;
}

export default function CourseDetailScreen() {
  const { courseSlug } = useLocalSearchParams<{ courseSlug: string }>();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const courses = useCoursesStore((s) => s.courses);
  const lessonsByCourse = useCoursesStore((s) => s.lessonsByCourse);
  const progress = useCoursesStore((s) => s.progress);
  const fetchLessons = useCoursesStore((s) => s.fetchLessons);

  const course = courses.find((c) => c.slug === courseSlug);
  const lessons = course ? (lessonsByCourse[course.id] ?? []) : [];
  const completedIds = course ? (progress[course.id] ?? []) : [];
  const completedCount = completedIds.length;

  useEffect(() => {
    if (course) fetchLessons(course.id);
  }, [course?.id]);

  if (!course) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator size="large" color={ORANGE} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const catColor = CATEGORY_COLORS[course.category] ?? ORANGE;
  const allDone = completedCount >= course.lesson_count;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        {/* Header */}
        <View style={s.header}>
          <View style={[s.iconWrap, { backgroundColor: catColor + '18' }]}>
            {renderIcon(course.icon_name, course.icon_set, 32, catColor)}
          </View>

          <Text style={s.title}>{course.title}</Text>
          {course.subtitle && <Text style={s.subtitle}>{course.subtitle}</Text>}

          {/* Progress */}
          <View style={s.progressRow}>
            <CourseProgressRing
              completed={completedCount}
              total={course.lesson_count}
              size={44}
              strokeWidth={3}
              color={allDone ? '#27AE60' : ORANGE}
              trackColor={colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
            />
            <View>
              <Text style={s.progressText}>
                {completedCount} of {course.lesson_count} lessons completed
              </Text>
              <Text style={s.progressSub}>~{course.estimated_minutes} min total</Text>
            </View>
          </View>
        </View>

        {/* Lessons */}
        <View style={s.lessonsCard}>
          {lessons.length === 0 ? (
            <ActivityIndicator size="small" color={ORANGE} style={{ paddingVertical: 20 }} />
          ) : (
            lessons.map((lesson, i) => (
              <LessonRow
                key={lesson.id}
                title={lesson.title}
                subtitle={lesson.subtitle}
                estimatedMinutes={lesson.estimated_minutes}
                contentType={lesson.content_type}
                isCompleted={completedIds.includes(lesson.id)}
                isLast={i === lessons.length - 1}
                onPress={() => router.push(`/courses/${courseSlug}/${lesson.slug}` as any)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.bg,
    },
    scroll: {
      padding: 20,
      paddingBottom: 40,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: w(0.06),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    header: {
      alignItems: 'center',
      marginBottom: 28,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      textAlign: 'center',
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      color: w(0.5),
      fontFamily: FF,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: w(0.04),
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    progressText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textPrimary,
      fontFamily: FF,
    },
    progressSub: {
      fontSize: 11,
      color: w(0.4),
      fontFamily: FF,
      marginTop: 2,
    },
    lessonsCard: {
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 4,
    },
  });
};
