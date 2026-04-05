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

export type ReminderType = 'meals' | 'weight' | 'sideEffects' | 'dailyPlan';

type ReminderConfig = {
  enabled: boolean;
  times: string[]; // "HH:MM"
};

type RemindersStore = {
  masterEnabled: boolean;
  meals: ReminderConfig;
  weight: ReminderConfig;
  sideEffects: ReminderConfig;
  dailyPlan: ReminderConfig;

  setMasterEnabled(v: boolean): void;
  setEnabled(type: ReminderType, v: boolean): void;
  setTime(type: ReminderType, index: number, hhmm: string): void;
  reset(): void;
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

  // meals
  if (s.meals.enabled && s.meals.times[0]) {
    await scheduleSlot('meals_morning', s.meals.times[0], ctx);
  } else {
    await cancelReminder('meals_morning');
  }

  if (s.meals.enabled && s.meals.times[1]) {
    await scheduleSlot('meals_evening', s.meals.times[1], ctx);
  } else {
    await cancelReminder('meals_evening');
  }

  // weight
  if (s.weight.enabled && s.weight.times[0]) {
    await scheduleSlot('weight_morning', s.weight.times[0], ctx);
  } else {
    await cancelReminder('weight_morning');
  }

  // side effects
  if (s.sideEffects.enabled && s.sideEffects.times[0]) {
    await scheduleSlot('side_effects_evening', s.sideEffects.times[0], ctx);
  } else {
    await cancelReminder('side_effects_evening');
  }

  // daily plan
  if (s.dailyPlan.enabled && s.dailyPlan.times[0]) {
    await scheduleSlot('daily_plan_morning', s.dailyPlan.times[0], ctx);
  } else {
    await cancelReminder('daily_plan_morning');
  }
}

export const useRemindersStore = create<RemindersStore>()(
  persist(
    (set, get) => ({
      masterEnabled: false,
      meals: { enabled: true, times: ['08:00', '19:00'] },
      weight: { enabled: true, times: ['07:30'] },
      sideEffects: { enabled: true, times: ['21:00'] },
      dailyPlan: { enabled: true, times: ['08:00'] },

      setMasterEnabled(v) {
        set({ masterEnabled: v });
        syncNotifications({ ...get(), masterEnabled: v });
      },

      setEnabled(type, v) {
        set((s) => ({ [type]: { ...s[type], enabled: v } }));
        syncNotifications(get());
      },

      setTime(type, index, hhmm) {
        set((s) => {
          const times = [...s[type].times];
          times[index] = hhmm;
          return { [type]: { ...s[type], times } };
        });
        syncNotifications(get());
      },

      reset() {
        set({
          masterEnabled: false,
          meals: { enabled: true, times: ['08:00', '19:00'] },
          weight: { enabled: true, times: ['07:30'] },
          sideEffects: { enabled: true, times: ['21:00'] },
          dailyPlan: { enabled: true, times: ['08:00'] },
        });
      },
    }),
    {
      name: 'reminders-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
