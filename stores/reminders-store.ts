import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  cancelAllReminders,
  cancelReminder,
  scheduleDailyReminder,
} from '../lib/notifications';
import {
  buildReminderContent,
  type ReminderContext,
  type ReminderSlot,
} from '../lib/reminder-content';
import { useLogStore } from './log-store';
import { useUserStore } from './user-store';

export { type ReminderSlot };

export type SlotConfig = {
  enabled: boolean;
  time: string; // "HH:MM"
};

export const ALL_SLOTS: ReminderSlot[] = [
  'meals_morning',
  'meals_evening',
  'weight_morning',
  'side_effects_evening',
  'daily_plan_morning',
];

type RemindersStore = {
  masterEnabled: boolean;
  doseReminderEnabled: boolean;
  slots: Record<ReminderSlot, SlotConfig>;

  setMasterEnabled(v: boolean): void;
  setDoseReminderEnabled(v: boolean): void;
  setSlotEnabled(slot: ReminderSlot, v: boolean): void;
  setSlotTime(slot: ReminderSlot, time: string): void;
};

// Default fallback content (used if personalization returns null unexpectedly)
const DEFAULT_CONTENT: Record<ReminderSlot, { title: string; body: string; deepLink: string }> = {
  meals_morning: {
    title: 'Log Your Breakfast',
    body: 'Tap to log what you had this morning.',
    deepLink: '/entry/log-food',
  },
  meals_evening: {
    title: 'Log Your Dinner',
    body: 'End the day strong - log your evening meal.',
    deepLink: '/entry/log-food',
  },
  weight_morning: {
    title: 'Morning Weigh-In',
    body: 'Log your weight to track your progress.',
    deepLink: '/entry/log-weight',
  },
  side_effects_evening: {
    title: 'How Are You Feeling?',
    body: 'Log any side effects from today.',
    deepLink: '/entry/side-effects',
  },
  daily_plan_morning: {
    title: 'Your Daily Focus',
    body: "Open TitraHealth to see today's priorities.",
    deepLink: '/(tabs)',
  },
};

function parseHHMM(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { hour: h ?? 8, minute: m ?? 0 };
}

/** Gather current store data for personalization. */
function gatherContext(): ReminderContext {
  const logState = useLogStore.getState();
  const userState = useUserStore.getState();
  return {
    foodLogs: logState.foodLogs,
    weightLogs: logState.weightLogs,
    sideEffectLogs: logState.sideEffectLogs,
    injectionLogs: logState.injectionLogs,
    activityLogs: logState.activityLogs,
    profile: userState.profile ?? logState.profile,
    userGoals: logState.userGoals,
  };
}

async function scheduleSlot(
  slot: ReminderSlot,
  hhmm: string,
  ctx: ReminderContext,
): Promise<void> {
  const content = buildReminderContent(slot, ctx);

  if (content === null) {
    // Smart suppression: user already logged — skip this reminder
    await cancelReminder(slot);
    return;
  }

  const { hour, minute } = parseHHMM(hhmm);
  await scheduleDailyReminder(slot, content.title, content.body, hour, minute, content.deepLink);
}

/** Sync all notification slots with personalized content. Exported for foreground resync. */
export async function syncNotifications(state?: RemindersStore): Promise<void> {
  const s = state ?? useRemindersStore.getState();

  if (!s.masterEnabled) {
    await cancelAllReminders();
    return;
  }

  const ctx = gatherContext();

  for (const slot of ALL_SLOTS) {
    const cfg = s.slots[slot];
    if (cfg.enabled) {
      await scheduleSlot(slot, cfg.time, ctx);
    } else {
      await cancelReminder(slot);
    }
  }
}

const DEFAULT_SLOTS: Record<ReminderSlot, SlotConfig> = {
  meals_morning: { enabled: true, time: '08:00' },
  meals_evening: { enabled: true, time: '19:00' },
  weight_morning: { enabled: true, time: '07:30' },
  side_effects_evening: { enabled: true, time: '21:00' },
  daily_plan_morning: { enabled: true, time: '08:00' },
};

export const useRemindersStore = create<RemindersStore>()(
  persist(
    (set, get) => ({
      masterEnabled: false,
      doseReminderEnabled: true,
      slots: { ...DEFAULT_SLOTS },

      setMasterEnabled(v) {
        set({ masterEnabled: v });
        syncNotifications({ ...get(), masterEnabled: v });
      },

      setDoseReminderEnabled(v) {
        set({ doseReminderEnabled: v });
      },

      setSlotEnabled(slot, v) {
        set((s) => ({
          slots: { ...s.slots, [slot]: { ...s.slots[slot], enabled: v } },
        }));
        syncNotifications(get());
      },

      setSlotTime(slot, time) {
        set((s) => ({
          slots: { ...s.slots, [slot]: { ...s.slots[slot], time } },
        }));
        syncNotifications(get());
      },

      reset() {
        set({
          masterEnabled: false,
          doseReminderEnabled: true,
          slots: { ...DEFAULT_SLOTS },
        });
      },
    }),
    {
      name: 'reminders-store',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      migrate(persisted: any, version: number) {
        if (version === 0 && persisted) {
          // Migrate from old shape { meals: { enabled, times }, weight: {...}, ... }
          const old = persisted as any;
          const slots = { ...DEFAULT_SLOTS };
          if (old.meals) {
            slots.meals_morning = { enabled: old.meals.enabled ?? true, time: old.meals.times?.[0] ?? '08:00' };
            slots.meals_evening = { enabled: old.meals.enabled ?? true, time: old.meals.times?.[1] ?? '19:00' };
          }
          if (old.weight) {
            slots.weight_morning = { enabled: old.weight.enabled ?? true, time: old.weight.times?.[0] ?? '07:30' };
          }
          if (old.sideEffects) {
            slots.side_effects_evening = { enabled: old.sideEffects.enabled ?? true, time: old.sideEffects.times?.[0] ?? '21:00' };
          }
          if (old.dailyPlan) {
            slots.daily_plan_morning = { enabled: old.dailyPlan.enabled ?? true, time: old.dailyPlan.times?.[0] ?? '08:00' };
          }
          return { masterEnabled: old.masterEnabled ?? false, slots };
        }
        return persisted as RemindersStore;
      },
    },
  ),
);
