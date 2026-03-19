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
