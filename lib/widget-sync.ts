/**
 * Widget data sync — gathers current app state and pushes it to the
 * WidgetKit shared storage so the home screen widget stays current.
 *
 * Call after: app open, injection log, weight log, food log, any log action.
 */
import { syncWidgetData, type WidgetDataPayload } from '@/modules/widget-sync';
import { useLogStore, computeStreak } from '@/stores/log-store';
import { daysSinceInjection, getShotPhase } from '@/constants/scoring';
import { BRAND_DISPLAY_NAMES } from '@/constants/user-profile';
import { isOralDrug } from '@/constants/drug-pk';
import type { ProfileRow } from '@/stores/log-store';

/** Phase display names for the widget. */
const PHASE_LABELS: Record<string, string> = {
  shot: 'Shot',
  peak: 'Peak',
  balance: 'Balance',
  reset: 'Reset',
};

/**
 * Build the widget data payload from current app state and push it to shared storage.
 * This is fire-and-forget — errors are silently swallowed.
 */
export function pushWidgetData(profile: Partial<ProfileRow> | null): void {
  if (!profile) return;

  const store = useLogStore.getState();
  const oral = isOralDrug(profile.glp1Type as any);

  // -- Medication label --
  const brandDisplay = BRAND_DISPLAY_NAMES[(profile as any).medicationBrand ?? ''];
  const medName = (brandDisplay && brandDisplay !== 'Other')
    ? brandDisplay
    : profile.glp1Type === 'semaglutide' ? 'Semaglutide'
    : profile.glp1Type === 'tirzepatide' ? 'Tirzepatide'
    : profile.glp1Type === 'liraglutide' ? 'Liraglutide'
    : profile.glp1Type === 'oral_semaglutide' ? 'Semaglutide (oral)'
    : 'GLP-1';
  const dosePart = profile.doseMg != null ? ` ${profile.doseMg}mg` : '';
  const medicationLabel = `${medName}${dosePart}`;

  // -- Injection / dose schedule --
  const freq = (profile as any).injectionFrequencyDays ?? 7;
  const profileLastInj = (profile as any).lastInjectionDate || null;
  const logStoreLastInj = store.injectionLogs[0]?.injection_date || null;
  const lastInjDate = (() => {
    if (!profileLastInj) return logStoreLastInj;
    if (!logStoreLastInj) return profileLastInj;
    return profileLastInj >= logStoreLastInj ? profileLastInj : logStoreLastInj;
  })();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const dayNum = daysSinceInjection(lastInjDate, today, freq);
  const phase = getShotPhase(dayNum, freq);

  // Uncapped days-until for accurate countdown
  const uncappedDaysUntil = lastInjDate
    ? freq - Math.floor(
        ((() => { const t = new Date(today); t.setHours(0,0,0,0); return t.getTime(); })()
          - new Date(lastInjDate + 'T00:00:00').getTime()) / 86400000
      )
    : null;
  const daysUntil = uncappedDaysUntil != null ? Math.max(0, uncappedDaysUntil) : freq;

  // Check if today's injection is logged
  const todayInjLogged = store.injectionLogs.some(
    (l) => l.injection_date === todayStr
  );

  // Dose status label + urgency
  let doseStatusLabel: string;
  let doseUrgency: WidgetDataPayload['doseUrgency'];

  if (todayInjLogged) {
    doseStatusLabel = oral ? 'Dosed' : 'Logged today';
    doseUrgency = 'logged';
  } else if (!lastInjDate) {
    doseStatusLabel = oral ? 'Log first dose' : 'Log first shot';
    doseUrgency = 'dueToday';
  } else if (uncappedDaysUntil != null && uncappedDaysUntil < 0) {
    doseStatusLabel = 'Overdue';
    doseUrgency = 'overdue';
  } else if (daysUntil === 0) {
    doseStatusLabel = oral ? 'Dose day' : 'Shot day';
    doseUrgency = 'dueToday';
  } else if (daysUntil === 1) {
    doseStatusLabel = 'Due tomorrow';
    doseUrgency = 'soon';
  } else {
    doseStatusLabel = `Due in ${daysUntil} days`;
    doseUrgency = 'upcoming';
  }

  // Cycle day
  const displayDay = dayNum === 0 ? 1 : dayNum;
  const cycleDayLabel = `Day ${displayDay} of ${freq}`;
  const cycleProgress = Math.min(1, Math.max(0, dayNum / freq));

  // -- Weight progress --
  const startWeight = (profile as any).startWeightLbs > 0 ? (profile as any).startWeightLbs : null;
  const currentWeight = (profile as any).currentWeightLbs > 0
    ? (profile as any).currentWeightLbs
    : (store.weightLogs[0]?.weight_lbs ?? null);
  const weightDeltaLbs = (startWeight != null && currentWeight != null)
    ? Math.round((currentWeight - startWeight) * 10) / 10
    : null;

  const goalWeight = (profile as any).goalWeightLbs > 0 ? (profile as any).goalWeightLbs : null;
  const percentToGoal = (startWeight != null && goalWeight != null && currentWeight != null && startWeight !== goalWeight)
    ? Math.max(0, Math.min(100, Math.round(((startWeight - currentWeight) / (startWeight - goalWeight)) * 100)))
    : null;

  // -- Streak --
  const streakCount = computeStreak(store);

  // -- Push --
  const payload: WidgetDataPayload = {
    doseStatusLabel,
    doseUrgency,
    cycleDayLabel,
    cycleProgress,
    phaseName: PHASE_LABELS[phase] ?? 'Balance',
    medicationLabel,
    weightDeltaLbs,
    percentToGoal,
    streakCount,
    lastUpdated: new Date().toISOString(),
  };

  console.warn('[WidgetSync] Pushing:', JSON.stringify(payload));
  syncWidgetData(payload);
}
