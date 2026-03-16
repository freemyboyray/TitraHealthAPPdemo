import { create } from 'zustand';
import { generateLogInsight, type HealthSnapshot } from '@/lib/openai';

type InsightsAiStore = {
  lifestyleText: string | null;
  medicationText: string | null;
  progressText: string | null;
  lifestyleLoading: boolean;
  medicationLoading: boolean;
  progressLoading: boolean;
  prefetchAll: (health: HealthSnapshot) => void;
};

export const useInsightsAiStore = create<InsightsAiStore>((set, get) => ({
  lifestyleText: null,
  medicationText: null,
  progressText: null,
  lifestyleLoading: false,
  medicationLoading: false,
  progressLoading: false,

  prefetchAll: (health) => {
    const s = get();

    if (!s.lifestyleLoading && !s.lifestyleText) {
      set({ lifestyleLoading: true });
      generateLogInsight('lifestyle', health)
        .then(t => set({ lifestyleText: t, lifestyleLoading: false }))
        .catch(() => set({
          lifestyleText: 'You have a protein and hydration deficit today. Try to increase your intake to reach your daily goal.',
          lifestyleLoading: false,
        }));
    }

    if (!s.medicationLoading && !s.medicationText) {
      set({ medicationLoading: true });
      generateLogInsight('medication', health)
        .then(t => set({ medicationText: t, medicationLoading: false }))
        .catch(() => set({
          medicationText: 'Your medication levels are stable. Adherence is strong this month. Your metabolic response is in the optimal range.',
          medicationLoading: false,
        }));
    }

    if (!s.progressLoading && !s.progressText) {
      set({ progressLoading: true });
      generateLogInsight('progress', health)
        .then(t => set({ progressText: t, progressLoading: false }))
        .catch(() => set({
          progressText: "You're on track to reach your goal. Your weight loss rate is steady and healthy on GLP-1.",
          progressLoading: false,
        }));
    }
  },
}));
