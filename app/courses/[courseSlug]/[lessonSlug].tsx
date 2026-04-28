import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useCoursesStore } from '@/stores/courses-store';
import { LessonContentRenderer } from '@/components/courses/lesson-content-renderer';

const FF = 'System';
const ORANGE = '#FF742A';

export default function LessonScreen() {
  const { courseSlug, lessonSlug } = useLocalSearchParams<{ courseSlug: string; lessonSlug: string }>();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const courses = useCoursesStore((s) => s.courses);
  const lessonsByCourse = useCoursesStore((s) => s.lessonsByCourse);
  const progress = useCoursesStore((s) => s.progress);
  const fetchLessons = useCoursesStore((s) => s.fetchLessons);
  const completeLesson = useCoursesStore((s) => s.completeLesson);

  const course = courses.find((c) => c.slug === courseSlug);
  const lessons = course ? (lessonsByCourse[course.id] ?? []) : [];
  const lesson = lessons.find((l) => l.slug === lessonSlug);
  const isCompleted = course && lesson ? (progress[course.id] ?? []).includes(lesson.id) : false;

  // Find next lesson
  const currentIndex = lesson ? lessons.indexOf(lesson) : -1;
  const nextLesson = currentIndex >= 0 && currentIndex < lessons.length - 1
    ? lessons[currentIndex + 1]
    : null;

  useEffect(() => {
    if (course && lessons.length === 0) fetchLessons(course.id);
  }, [course?.id]);

  const handleComplete = async () => {
    if (!course || !lesson || isCompleted) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeLesson(lesson.id, course.id);
  };

  const handleNext = () => {
    if (!nextLesson) {
      router.back();
      return;
    }
    router.replace(`/courses/${courseSlug}/${nextLesson.slug}` as any);
  };

  if (!course || !lesson) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator size="large" color={ORANGE} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={s.headerMeta}>
            <Text style={s.lessonNumber}>
              Lesson {currentIndex + 1} of {lessons.length}
            </Text>
            <Text style={s.estimatedTime}>{lesson.estimated_minutes} min read</Text>
          </View>
        </View>

        {/* Education disclaimer */}
        <View style={s.disclaimerBanner}>
          <Ionicons name="information-circle-outline" size={14} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
          <Text style={s.disclaimerText}>
            Educational content only — not medical advice. Always consult your healthcare provider.
          </Text>
        </View>

        {/* Title */}
        <Text style={s.title}>{lesson.title}</Text>
        {lesson.subtitle && <Text style={s.subtitle}>{lesson.subtitle}</Text>}

        {/* Content */}
        <View style={s.content}>
          <LessonContentRenderer
            bodyMarkdown={lesson.body_markdown}
            contentJson={lesson.content_json}
            contentType={lesson.content_type}
          />
        </View>

        {/* Completion CTA */}
        <View style={s.ctaSection}>
          {isCompleted ? (
            <>
              <View style={s.completedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                <Text style={s.completedText}>Lesson completed</Text>
              </View>
              {nextLesson && (
                <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.8}>
                  <Text style={s.nextBtnText}>Next: {nextLesson.title}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity style={s.completeBtn} onPress={handleComplete} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text style={s.completeBtnText}>Mark as Complete</Text>
            </TouchableOpacity>
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
      paddingBottom: 60,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 24,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: w(0.06),
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerMeta: {
      flex: 1,
    },
    lessonNumber: {
      fontSize: 14,
      fontWeight: '700',
      color: ORANGE,
      fontFamily: FF,
      letterSpacing: 0.5,
    },
    estimatedTime: {
      fontSize: 13,
      color: w(0.35),
      fontFamily: FF,
      marginTop: 1,
    },
    disclaimerBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: w(0.04),
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 16,
    },
    disclaimerText: {
      fontSize: 13,
      color: w(0.4),
      fontFamily: FF,
      flex: 1,
      lineHeight: 15,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: 'System',
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 16,
      color: w(0.5),
      fontFamily: FF,
      lineHeight: 20,
      marginBottom: 8,
    },
    content: {
      marginTop: 8,
    },
    ctaSection: {
      marginTop: 32,
      gap: 12,
    },
    completeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: ORANGE,
      borderRadius: 16,
      paddingVertical: 16,
    },
    completeBtnText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: FF,
    },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
    },
    completedText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#27AE60',
      fontFamily: FF,
    },
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: w(0.08),
      borderRadius: 16,
      paddingVertical: 14,
    },
    nextBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
      fontFamily: FF,
    },
  });
};
