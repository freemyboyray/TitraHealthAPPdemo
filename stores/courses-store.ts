import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { supabase } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CourseRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  icon_name: string;
  icon_set: string;
  accent_color: string;
  category: string;
  lesson_count: number;
  estimated_minutes: number;
  sort_order: number;
  phase_unlock: string | null;
  is_published: boolean;
};

export type LessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  sort_order: number;
  estimated_minutes: number;
  content_type: string;
  body_markdown: string | null;
  content_json: any | null;
  is_published: boolean;
};

type CoursesState = {
  courses: CourseRow[];
  lessonsByCourse: Record<string, LessonRow[]>;
  // courseId → Set of completed lessonIds (stored as arrays for JSON serialization)
  progress: Record<string, string[]>;
  lastFetched: number | null;

  fetchCourses: () => Promise<void>;
  fetchLessons: (courseId: string) => Promise<void>;
  completeLesson: (lessonId: string, courseId: string) => Promise<void>;
  getCompletedCount: (courseId: string) => number;
  isLessonCompleted: (lessonId: string, courseId: string) => boolean;
};

const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useCoursesStore = create<CoursesState>()(
  persist(
    (set, get) => ({
      courses: [],
      lessonsByCourse: {},
      progress: {},
      lastFetched: null,

      fetchCourses: async () => {
        const state = get();
        const now = Date.now();

        // Stale-while-revalidate: return cached if fresh, fetch in background if stale
        const shouldFetch = !state.lastFetched || now - state.lastFetched > STALE_MS || state.courses.length === 0;
        if (!shouldFetch) return;

        const [coursesRes, progressRes] = await Promise.all([
          supabase
            .from('courses')
            .select('*')
            .eq('is_published', true)
            .order('sort_order', { ascending: true }),
          supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) return { data: [] };
            return supabase
              .from('lesson_progress')
              .select('lesson_id, course_id')
              .eq('user_id', user.id);
          }),
        ]);

        const courses = (coursesRes.data ?? []) as CourseRow[];

        // Build progress map
        const progress: Record<string, string[]> = {};
        for (const row of (progressRes.data ?? []) as { lesson_id: string; course_id: string }[]) {
          if (!progress[row.course_id]) progress[row.course_id] = [];
          progress[row.course_id].push(row.lesson_id);
        }

        set({ courses, progress, lastFetched: now });
      },

      fetchLessons: async (courseId: string) => {
        const cached = get().lessonsByCourse[courseId];
        if (cached && cached.length > 0) return;

        const { data } = await supabase
          .from('lessons')
          .select('*')
          .eq('course_id', courseId)
          .eq('is_published', true)
          .order('sort_order', { ascending: true });

        if (data) {
          set((s) => ({
            lessonsByCourse: { ...s.lessonsByCourse, [courseId]: data as LessonRow[] },
          }));
        }
      },

      completeLesson: async (lessonId: string, courseId: string) => {
        // Optimistic local update
        set((s) => {
          const existing = s.progress[courseId] ?? [];
          if (existing.includes(lessonId)) return s;
          return {
            progress: { ...s.progress, [courseId]: [...existing, lessonId] },
          };
        });

        // Persist to Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('lesson_progress').upsert(
          { user_id: user.id, lesson_id: lessonId, course_id: courseId },
          { onConflict: 'user_id,lesson_id' },
        );
      },

      getCompletedCount: (courseId: string) => {
        return (get().progress[courseId] ?? []).length;
      },

      isLessonCompleted: (lessonId: string, courseId: string) => {
        return (get().progress[courseId] ?? []).includes(lessonId);
      },
    }),
    {
      name: 'courses-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        courses: state.courses,
        lessonsByCourse: state.lessonsByCourse,
        progress: state.progress,
        lastFetched: state.lastFetched,
      }),
    },
  ),
);
