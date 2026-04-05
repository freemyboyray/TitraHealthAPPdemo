// expo-notifications requires a native dev build; guard import so Expo Go doesn't crash.
let Notifications: typeof import('expo-notifications') | undefined;
try { Notifications = require('expo-notifications'); } catch {}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyReminder(
  id: string,
  title: string,
  body: string,
  hour: number,
  minute: number,
  deepLinkUrl?: string,
): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title,
      body,
      data: deepLinkUrl ? { url: deepLinkUrl } : {},
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelReminder(id: string): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export async function cancelAllReminders(): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleTestNotification(title: string, body: string): Promise<void> {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
    },
  });
}

/**
 * Schedule a dose/injection reminder appropriate for the drug's frequency.
 *
 * Daily drugs (injFreqDays === 1): schedules a recurring daily alarm at doseTime.
 * Weekly/bi-weekly drugs: schedules a one-time notification on the next injection date.
 *
 * @param injFreqDays  Dosing interval in days (1 = daily, 7 = weekly, 14 = bi-weekly)
 * @param doseTime     "HH:MM" — used for daily drugs; for weekly the reminder fires at 9:00 AM
 * @param drugName     Display name of the medication
 * @param lastInjectionDate  YYYY-MM-DD of the last injection (used to compute next shot date for weekly drugs)
 * @param content      Optional personalized content from reminder-content.ts
 */
export async function scheduleDoseReminder(
  injFreqDays: number,
  doseTime: string = '09:00',
  drugName: string = 'GLP-1',
  lastInjectionDate?: string | null,
  content?: {
    dailyTitle: string;
    dailyBody: string;
    shotDayTitle: string;
    shotDayBody: string;
    eveTitle: string;
    eveBody: string;
  },
): Promise<void> {
  if (!Notifications) return;

  const DAILY_ID   = 'dose_reminder_daily';
  const WEEKLY_ID  = 'dose_reminder_weekly';
  const WEEKLY_EVE = 'dose_reminder_weekly_eve';

  const c = content ?? {
    dailyTitle: 'Time for your daily dose',
    dailyBody: 'Log your dose after taking it to keep your cycle accurate.',
    shotDayTitle: 'Today is your injection day',
    shotDayBody: 'Log your shot to keep your cycle on track.',
    eveTitle: 'Injection tomorrow',
    eveBody: 'Your injection is due tomorrow. Prepare your injection and rotation site.',
  };

  if (injFreqDays === 1) {
    // Daily: cancel weekly reminder, set daily reminder at doseTime
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_ID).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_EVE).catch(() => {});
    const [h, m] = doseTime.split(':').map(Number);
    await scheduleDailyReminder(
      DAILY_ID,
      c.dailyTitle,
      c.dailyBody,
      h,
      m ?? 0,
      'titrahealth://entry/log-injection',
    );
  } else {
    // Weekly/bi-weekly: cancel daily reminder, set one-time reminder on injection day
    await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});

    if (!lastInjectionDate) return;
    const lastMs = new Date(lastInjectionDate + 'T00:00:00').getTime();
    const nextMs = lastMs + injFreqDays * 86400000;
    const nextDate = new Date(nextMs);

    // Morning-of reminder (9:00 AM on shot day)
    const shotDayMs = new Date(nextDate);
    shotDayMs.setHours(9, 0, 0, 0);
    if (shotDayMs.getTime() > Date.now()) {
      await Notifications.cancelScheduledNotificationAsync(WEEKLY_ID).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: WEEKLY_ID,
        content: {
          title: c.shotDayTitle,
          body: c.shotDayBody,
          data: { url: 'titrahealth://entry/log-injection' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: shotDayMs,
        },
      });
    }

    // Day-before reminder (8:00 PM the evening before)
    const eveDate = new Date(nextDate);
    eveDate.setDate(eveDate.getDate() - 1);
    eveDate.setHours(20, 0, 0, 0);
    if (eveDate.getTime() > Date.now()) {
      await Notifications.cancelScheduledNotificationAsync(WEEKLY_EVE).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: WEEKLY_EVE,
        content: {
          title: c.eveTitle,
          body: c.eveBody,
          data: { url: 'titrahealth://entry/log-injection' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: eveDate,
        },
      });
    }
  }
}

/**
 * Schedule a one-time check-in reminder exactly 7 days after `lastLoggedAt` at 10:00 AM.
 * Cancels any existing check-in reminder first.
 * If the computed trigger time is already in the past, no notification is scheduled.
 */
export async function scheduleCheckinReminder(lastLoggedAt: string): Promise<void> {
  if (!Notifications) return;
  const CHECKIN_ID = 'weekly-checkin';
  await Notifications.cancelScheduledNotificationAsync(CHECKIN_ID).catch(() => {});

  const triggerDate = new Date(lastLoggedAt);
  triggerDate.setDate(triggerDate.getDate() + 7);
  triggerDate.setHours(10, 0, 0, 0);

  if (triggerDate.getTime() <= Date.now()) return; // already past — skip

  await Notifications.scheduleNotificationAsync({
    identifier: CHECKIN_ID,
    content: {
      title: 'Time for your weekly check-in',
      body: 'Track how this week felt on your dose',
      data: { url: 'titrahealth://entry/weekly-checkin' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

/**
 * Schedule the weekly check-in reminder (every Sunday at 10:00 AM).
 * @deprecated Use scheduleCheckinReminder(lastLoggedAt) for dynamic scheduling.
 * Kept for backward compatibility — delegates to scheduleCheckinReminder.
 */
export async function scheduleWeeklyCheckinReminder(): Promise<void> {
  await scheduleCheckinReminder(new Date().toISOString());
}
