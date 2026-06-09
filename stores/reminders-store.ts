import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  cancelReminder,
  cancelIntervalReminders,
  scheduleDailyReminder,
  scheduleDoseReminder,
  scheduleIntervalReminders,
} from '../lib/notifications';
import {
  buildReminderContent,
  getDoseReminderContent,
  getEngagementTier,
  getHydrationTitles,
  getHydrationBodies,
  getProteinCheckContent,
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

export type HydrationConfig = {
  enabled: boolean;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  intervalHours: number; // 1, 1.5, 2, or 3
};

export type ProteinConfig = {
  enabled: boolean;
  times: [string, string, string]; // breakfast, lunch, dinner "HH:MM"
};

export type CustomReminder = {
  id: string;
  label: string;
  enabled: boolean;
  time: string; // "HH:MM"
  icon: string; // Ionicons name
  color: string; // hex
};

export const ALL_SLOTS: ReminderSlot[] = [
  'meals_morning',
  'meals_evening',
  'weight_morning',
  'side_effects_evening',
  'daily_plan_morning',
];

export const MAX_CUSTOM_REMINDERS = 5;

type RemindersStore = {
  masterEnabled: boolean;
  doseReminderEnabled: boolean;
  slots: Record<ReminderSlot, SlotConfig>;
  hydration: HydrationConfig;
  protein: ProteinConfig;
  customReminders: CustomReminder[];

  setMasterEnabled(v: boolean): void;
  setDoseReminderEnabled(v: boolean): void;
  setSlotEnabled(slot: ReminderSlot, v: boolean): void;
  setSlotTime(slot: ReminderSlot, time: string): void;

  setHydrationEnabled(v: boolean): void;
  setHydrationStartTime(time: string): void;
  setHydrationEndTime(time: string): void;
  setHydrationInterval(hours: number): void;

  setProteinEnabled(v: boolean): void;
  setProteinTime(index: 0 | 1 | 2, time: string): void;

  addCustomReminder(reminder: CustomReminder): void;
  updateCustomReminder(id: string, updates: Partial<Omit<CustomReminder, 'id'>>): void;
  removeCustomReminder(id: string): void;
  setCustomReminderEnabled(id: string, v: boolean): void;
};

// Default fallback content (used if personalization returns null unexpectedly)
const DEFAULT_CONTENT: Record<ReminderSlot, { title: string; body: string; deepLink: string }> = {
  meals_morning: {
    title: 'Log Your Breakfast',
    body: 'Tap to log what you had this morning.',
    deepLink: '/(tabs)?logFood=1',
  },
  meals_evening: {
    title: 'Log Your Dinner',
    body: 'End the day strong - log your evening meal.',
    deepLink: '/(tabs)?logFood=1',
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

const DOSE_IDS = ['dose_reminder_daily', 'dose_reminder_weekly', 'dose_reminder_weekly_eve'];

async function cancelDoseReminders(): Promise<void> {
  for (const id of DOSE_IDS) await cancelReminder(id);
}

/**
 * Single source of truth for dose/medication reminders. Independent of the master
 * "logging nudges" toggle — gated only by `doseReminderEnabled`.
 *
 * Pass `override` with fresh treatment data (onboarding, treatment edits, dose-time
 * change) when the store profile may be stale; otherwise params are derived from the
 * stored profile so every resync re-schedules the next cycle (weekly self-heal).
 */
export async function syncDoseReminder(override?: {
  injFreqDays: number;
  doseTime: string;
  drugName: string;
  lastInjectionDate: string | null;
}): Promise<void> {
  const s = useRemindersStore.getState();
  if (!s.doseReminderEnabled) {
    await cancelDoseReminders();
    return;
  }

  const ctx = gatherContext();
  const p = ctx.profile;

  // Only schedule for an active treatment plan. An explicit override means the caller
  // is mid-treatment-setup, so treat it as active.
  const treatmentOn = override != null || p?.treatment_status === 'on';
  if (!treatmentOn) {
    await cancelDoseReminders();
    return;
  }

  const injFreqDays = override?.injFreqDays ?? p?.injection_frequency_days ?? 7;
  const doseTime = override?.doseTime ?? p?.dose_time ?? '09:00';
  const drugName = override?.drugName ?? p?.medication_brand ?? p?.medication_type ?? 'GLP-1';
  const lastInjectionDate = override?.lastInjectionDate ?? p?.last_injection_date ?? null;

  await scheduleDoseReminder(
    injFreqDays,
    doseTime,
    drugName,
    lastInjectionDate,
    getDoseReminderContent(ctx),
  );
}

/** Cancel only the nudge reminders managed by syncNotifications (NOT dose reminders). */
async function cancelNudgeReminders(s: RemindersStore): Promise<void> {
  for (const slot of ALL_SLOTS) await cancelReminder(slot);
  await cancelIntervalReminders('hydration');
  for (let i = 0; i < 3; i++) await cancelReminder(`protein_check_${i}`);
  for (const cr of s.customReminders) await cancelReminder(`custom_${cr.id}`);
}

/** Sync all notification slots with personalized content. Exported for foreground resync. */
export async function syncNotifications(state?: RemindersStore): Promise<void> {
  const s = state ?? useRemindersStore.getState();

  if (!s.masterEnabled) {
    // Master controls logging nudges only — dose reminders are independent.
    await cancelNudgeReminders(s);
    await syncDoseReminder();
    return;
  }

  const ctx = gatherContext();
  const tier = getEngagementTier(ctx);
  ctx.tier = tier;

  // Standard slots. When the user has gone dormant, back off to a single soft carrier
  // (daily_plan_morning) and cancel the rest to cut notification volume.
  for (const slot of ALL_SLOTS) {
    const cfg = s.slots[slot];
    const backOff = tier === 'dormant' && slot !== 'daily_plan_morning';
    if (cfg.enabled && !backOff) {
      await scheduleSlot(slot, cfg.time, ctx);
    } else {
      await cancelReminder(slot);
    }
  }

  // Hydration interval reminders
  if (s.hydration.enabled) {
    const { hour: startH } = parseHHMM(s.hydration.startTime);
    const { hour: endH } = parseHHMM(s.hydration.endTime);
    await scheduleIntervalReminders(
      'hydration',
      getHydrationTitles(),
      getHydrationBodies(),
      startH,
      endH,
      s.hydration.intervalHours,
      '/(tabs)',
    );
  } else {
    await cancelIntervalReminders('hydration');
  }

  // Protein check reminders (3 daily)
  if (s.protein.enabled) {
    for (let i = 0; i < 3; i++) {
      const content = getProteinCheckContent(ctx, i);
      if (content) {
        const { hour, minute } = parseHHMM(s.protein.times[i]);
        await scheduleDailyReminder(
          `protein_check_${i}`,
          content.title,
          content.body,
          hour,
          minute,
          content.deepLink,
        );
      }
    }
  } else {
    for (let i = 0; i < 3; i++) {
      await cancelReminder(`protein_check_${i}`);
    }
  }

  // Custom reminders
  for (const cr of s.customReminders) {
    if (cr.enabled) {
      const { hour, minute } = parseHHMM(cr.time);
      await scheduleDailyReminder(
        `custom_${cr.id}`,
        cr.label,
        'Tap to open TitraHealth',
        hour,
        minute,
        '/(tabs)',
      );
    } else {
      await cancelReminder(`custom_${cr.id}`);
    }
  }

  // Dose reminders — independent of the master toggle; re-derived from the store every
  // resync so weekly/bi-weekly cycles self-advance after each dose.
  await syncDoseReminder();
}

const DEFAULT_SLOTS: Record<ReminderSlot, SlotConfig> = {
  meals_morning: { enabled: true, time: '08:00' },
  meals_evening: { enabled: true, time: '19:00' },
  weight_morning: { enabled: true, time: '07:30' },
  side_effects_evening: { enabled: true, time: '21:00' },
  daily_plan_morning: { enabled: true, time: '08:00' },
};

const DEFAULT_HYDRATION: HydrationConfig = {
  enabled: false,
  startTime: '08:00',
  endTime: '20:00',
  intervalHours: 2,
};

const DEFAULT_PROTEIN: ProteinConfig = {
  enabled: false,
  times: ['08:00', '12:30', '18:30'],
};

export const useRemindersStore = create<RemindersStore>()(
  persist(
    (set, get) => ({
      masterEnabled: false,
      doseReminderEnabled: true,
      slots: { ...DEFAULT_SLOTS },
      hydration: { ...DEFAULT_HYDRATION },
      protein: { ...DEFAULT_PROTEIN },
      customReminders: [],

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

      // ── Hydration ──────────────────────────────────────────────────────────
      setHydrationEnabled(v) {
        set((s) => ({ hydration: { ...s.hydration, enabled: v } }));
        syncNotifications(get());
      },
      setHydrationStartTime(time) {
        set((s) => ({ hydration: { ...s.hydration, startTime: time } }));
        syncNotifications(get());
      },
      setHydrationEndTime(time) {
        set((s) => ({ hydration: { ...s.hydration, endTime: time } }));
        syncNotifications(get());
      },
      setHydrationInterval(hours) {
        set((s) => ({ hydration: { ...s.hydration, intervalHours: hours } }));
        syncNotifications(get());
      },

      // ── Protein ────────────────────────────────────────────────────────────
      setProteinEnabled(v) {
        set((s) => ({ protein: { ...s.protein, enabled: v } }));
        syncNotifications(get());
      },
      setProteinTime(index, time) {
        set((s) => {
          const times = [...s.protein.times] as [string, string, string];
          times[index] = time;
          return { protein: { ...s.protein, times } };
        });
        syncNotifications(get());
      },

      // ── Custom ─────────────────────────────────────────────────────────────
      addCustomReminder(reminder) {
        set((s) => {
          if (s.customReminders.length >= MAX_CUSTOM_REMINDERS) return s;
          return { customReminders: [...s.customReminders, reminder] };
        });
        syncNotifications(get());
      },
      updateCustomReminder(id, updates) {
        set((s) => ({
          customReminders: s.customReminders.map((cr) =>
            cr.id === id ? { ...cr, ...updates } : cr,
          ),
        }));
        syncNotifications(get());
      },
      removeCustomReminder(id) {
        cancelReminder(`custom_${id}`).catch(() => {});
        set((s) => ({
          customReminders: s.customReminders.filter((cr) => cr.id !== id),
        }));
      },
      setCustomReminderEnabled(id, v) {
        set((s) => ({
          customReminders: s.customReminders.map((cr) =>
            cr.id === id ? { ...cr, enabled: v } : cr,
          ),
        }));
        syncNotifications(get());
      },
    }),
    {
      name: 'reminders-store',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate(persisted: any, version: number) {
        if (version === 0 && persisted) {
          // Migrate from v0 (old shape)
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
          return {
            masterEnabled: old.masterEnabled ?? false,
            doseReminderEnabled: true,
            slots,
            hydration: { ...DEFAULT_HYDRATION },
            protein: { ...DEFAULT_PROTEIN },
            customReminders: [],
          };
        }
        if (version === 1 && persisted) {
          // Migrate from v1: add hydration, protein, customReminders
          return {
            ...persisted,
            hydration: (persisted as any).hydration ?? { ...DEFAULT_HYDRATION },
            protein: (persisted as any).protein ?? { ...DEFAULT_PROTEIN },
            customReminders: (persisted as any).customReminders ?? [],
          };
        }
        return persisted as RemindersStore;
      },
    },
  ),
);
