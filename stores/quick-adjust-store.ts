import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { localDateStr } from '@/lib/date-utils';

export type QuickAdj = {
  proteinG: number;
  fiberG: number;
  carbsG: number;
  fatG: number;
  calories: number;
  steps: number;
  activeCal: number;
  sodiumMg: number;
  sugarG: number;
  satFatG: number;
  cholesterolMg: number;
};

const ZERO_ADJ: QuickAdj = {
  proteinG: 0, fiberG: 0, carbsG: 0, fatG: 0, calories: 0,
  steps: 0, activeCal: 0,
  sodiumMg: 0, sugarG: 0, satFatG: 0, cholesterolMg: 0,
};

const storageKey = (dateStr: string) => `@titrahealth_quickadjust_${dateStr}`;

type QuickAdjustStore = {
  qa: QuickAdj;
  hydratedFor: string | null;
  hydrate: () => Promise<void>;
  adjust: (field: keyof QuickAdj, delta: number) => void;
};

export const useQuickAdjustStore = create<QuickAdjustStore>((set, get) => ({
  qa: ZERO_ADJ,
  hydratedFor: null,
  hydrate: async () => {
    const today = localDateStr();
    if (get().hydratedFor === today) return;
    try {
      const raw = await AsyncStorage.getItem(storageKey(today));
      const parsed = raw ? { ...ZERO_ADJ, ...(JSON.parse(raw) as Partial<QuickAdj>) } : ZERO_ADJ;
      set({ qa: parsed, hydratedFor: today });
    } catch {
      set({ qa: ZERO_ADJ, hydratedFor: today });
    }
  },
  adjust: (field, delta) => {
    set(prev => {
      const next = { ...prev.qa, [field]: Math.max(0, prev.qa[field] + delta) };
      const today = localDateStr();
      AsyncStorage.setItem(storageKey(today), JSON.stringify(next)).catch(() => {});
      return { qa: next, hydratedFor: today };
    });
  },
}));
