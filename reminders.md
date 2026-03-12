# Reminders Feature Plan

## Overview
Push notification reminders for key daily logging behaviors. Fully configurable from Settings.

## Reminder Types

### 1. Log Meals (2x/day)
- Morning reminder (default: 8:00 AM)
- Evening reminder (default: 7:00 PM)
- User can set each time independently

### 2. Log Weight (1x/day)
- Morning reminder (default: 7:30 AM)

### 3. Log Side Effects (1x/day)
- Default: 9:00 PM (end of day check-in)

### 4. Check Daily Plan (1x/day)
- Default: 8:00 AM

---

## Settings UI

### Settings Screen (existing)
- Add a "Reminders" row with a toggle (on/off)
- When toggled ON: row shows an arrow/chevron indicating it's expandable → navigates to full Reminders Settings page

### Reminders Settings Page (full screen, not modal)
Route: `/settings/reminders`

Layout per reminder type:
```
[Toggle]  Log Meals
          ↳ (expanded when on)
             Morning  [Time Picker]
             Evening  [Time Picker]

[Toggle]  Log Weight
          ↳ Morning  [Time Picker]

[Toggle]  Log Side Effects
          ↳ Time  [Time Picker]

[Toggle]  Check Daily Plan
          ↳ Time  [Time Picker]
```

Each reminder section:
- Main toggle (enable/disable this specific reminder)
- Expandable sub-section (inline, not a modal) showing time pickers
- Collapsed when toggle is off

---

## Technical Plan

### Notifications
- `expo-notifications` for local push notifications
- Request permissions on first toggle ON
- Schedule/cancel notifications whenever settings change
- Persist schedules in AsyncStorage (or Supabase user prefs table)

### Scheduling Logic
- On save: cancel existing scheduled notifications for that type, reschedule with new time
- Repeating daily triggers (not one-shot)
- Notification IDs stored per type so they can be cancelled individually

### State / Storage
- `stores/reminders-store.ts` — Zustand store
  - `remindersEnabled: boolean` (master toggle)
  - Per type: `{ enabled: boolean, times: string[] }` (ISO time strings "HH:MM")
- Persist to AsyncStorage via `zustand/middleware` persist

### Files to Create/Modify
| File | Action |
|------|--------|
| `stores/reminders-store.ts` | New — Zustand store with persist |
| `lib/notifications.ts` | New — schedule/cancel helpers wrapping expo-notifications |
| `app/settings/reminders.tsx` | New — full settings page |
| `app/settings/_layout.tsx` | New or modify — add reminders route |
| `app/(tabs)/settings.tsx` | Modify — add Reminders row with master toggle + chevron nav |

### Notification Payloads
Each notification deep-links into the relevant entry screen:
- Log Meals → `/entry/log-food`
- Log Weight → `/entry/log-weight`
- Log Side Effects → `/entry/side-effects`
- Check Daily Plan → `/(tabs)/index` (home)

---

## Build Order
1. Install `expo-notifications`, configure in `app.json`
2. `lib/notifications.ts` — permission request, schedule, cancel helpers
3. `stores/reminders-store.ts` — state + persistence
4. Settings screen: add Reminders toggle row
5. `app/settings/reminders.tsx` — full config page
6. Wire store → lib/notifications (reschedule on any settings change)
7. Handle notification tap → deep link navigation
