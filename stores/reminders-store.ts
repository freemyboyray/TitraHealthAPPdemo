import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  cancelAllReminders,
  cancelReminder,
  scheduleDailyReminder,
} from '../lib/notifications';

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
};

// Notification metadata per reminder slot
const REMINDER_META: Record<
  string,
  { title: string; body: string; deepLink: string }
> = {
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

async function syncNotifications(state: RemindersStore) {
  if (!state.masterEnabled) {
    await cancelAllReminders();
    return;
  }

  // meals
  if (state.meals.enabled && state.meals.times[0]) {
    const { hour, minute } = parseHHMM(state.meals.times[0]);
    const m = REMINDER_META.meals_morning;
    await scheduleDailyReminder('meals_morning', m.title, m.body, hour, minute, m.deepLink);
  } else {
    await cancelReminder('meals_morning');
  }

  if (state.meals.enabled && state.meals.times[1]) {
    const { hour, minute } = parseHHMM(state.meals.times[1]);
    const m = REMINDER_META.meals_evening;
    await scheduleDailyReminder('meals_evening', m.title, m.body, hour, minute, m.deepLink);
  } else {
    await cancelReminder('meals_evening');
  }

  // weight
  if (state.weight.enabled && state.weight.times[0]) {
    const { hour, minute } = parseHHMM(state.weight.times[0]);
    const m = REMINDER_META.weight_morning;
    await scheduleDailyReminder('weight_morning', m.title, m.body, hour, minute, m.deepLink);
  } else {
    await cancelReminder('weight_morning');
  }

  // side effects
  if (state.sideEffects.enabled && state.sideEffects.times[0]) {
    const { hour, minute } = parseHHMM(state.sideEffects.times[0]);
    const m = REMINDER_META.side_effects_evening;
    await scheduleDailyReminder('side_effects_evening', m.title, m.body, hour, minute, m.deepLink);
  } else {
    await cancelReminder('side_effects_evening');
  }

  // daily plan
  if (state.dailyPlan.enabled && state.dailyPlan.times[0]) {
    const { hour, minute } = parseHHMM(state.dailyPlan.times[0]);
    const m = REMINDER_META.daily_plan_morning;
    await scheduleDailyReminder('daily_plan_morning', m.title, m.body, hour, minute, m.deepLink);
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
    }),
    {
      name: 'reminders-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
