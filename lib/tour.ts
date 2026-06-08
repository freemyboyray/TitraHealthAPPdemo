import type { TourStep } from '@/contexts/tour-context';
import { useUiStore } from '@/stores/ui-store';

/** Target ids referenced by the walkthrough — kept in one place so the
 *  <TourTarget id="…"> call sites and the step list can't drift apart. */
export const TOUR_IDS = {
  homeTodayCard: 'home-today-card',
  homeFocusRow: 'home-focus-row',
  fab: 'fab',
  entryDescribeFood: 'entry-describe-food',
  entryLogDose: 'entry-log-dose',
  entryAskAi: 'entry-ask-ai',
  tabLog: 'tab-log',
  tabExplore: 'tab-explore',
} as const;

const openSheet = () => useUiStore.getState().setSheetOpen(true);
const closeSheet = () => useUiStore.getState().setSheetOpen(false);

/**
 * The main first-run walkthrough. Steps that target the add-entry grid open the
 * sheet first; steps that target chrome (FAB, tabs, home cards) make sure it's
 * closed. `onTreatment` gates the LOG DOSE step — but even if it's left in, a
 * missing target is skipped gracefully by the runner.
 */
export function buildMainTourSteps(onTreatment: boolean): TourStep[] {
  const steps: TourStep[] = [
    {
      id: TOUR_IDS.homeTodayCard,
      title: 'Track your progress',
      body: 'Watch your weight trend from where you started toward your goal. Tap to open your full insights.',
      placement: 'bottom',
      radius: 24,
      before: closeSheet,
    },
    {
      id: TOUR_IDS.homeFocusRow,
      title: 'Today’s focus',
      body: 'Your energy and daily goals like protein, hydration, and activity live here. Tap any tile to dig into the detail.',
      placement: 'bottom',
      radius: 24,
    },
    {
      id: TOUR_IDS.fab,
      title: 'Log anything',
      body: 'This is your hub. Tap + to log food, doses, weight, water, activity, and more.',
      placement: 'top',
      radius: 'full',
      before: closeSheet,
    },
    {
      id: TOUR_IDS.entryDescribeFood,
      title: 'Describe a meal',
      body: 'Just type what you ate in plain words, and AI estimates the calories and protein for you.',
      placement: 'top',
      radius: 16,
      before: openSheet,
      beforeDelay: 480,
    },
    ...(onTreatment
      ? [{
          id: TOUR_IDS.entryLogDose,
          title: 'Log your dose',
          body: 'Track every shot or pill so your phase timeline and reminders stay accurate.',
          placement: 'top' as const,
          radius: 16,
        }]
      : []),
    {
      id: TOUR_IDS.entryAskAi,
      title: 'Ask AI anything',
      body: 'Your GLP-1 coach. Ask about side effects, what to eat, or how your week is trending.',
      placement: 'top',
      radius: 16,
    },
    {
      id: TOUR_IDS.tabLog,
      title: 'Your insights',
      body: 'The Log tab tracks your trends across medication, lifestyle, and progress over time.',
      placement: 'top',
      radius: 'full',
      before: closeSheet,
    },
    {
      id: TOUR_IDS.tabExplore,
      title: 'Learn & explore',
      body: 'Courses and articles tailored to your GLP-1 journey. That’s it, you’re all set!',
      placement: 'top',
      radius: 'full',
    },
  ];
  return steps;
}
