import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { usePreferencesStore } from '@/stores/preferences-store';

// How long before the prompt may reappear after being shown/dismissed.
const COOLDOWN_DAYS = 14;
// Delay after the app becomes active (or the tutorial completes) before the
// screen is allowed to appear, so we never interrupt the user mid-launch.
const SHOW_DELAY_MS = 60_000;

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Decides when to surface the full-screen "Rate Titra" prompt.
 *
 * Eligibility: the user has finished onboarding + the interactive tutorial
 * (`tourCompleted`), has not already rated, and the 14-day cooldown has passed
 * (or it has never been shown). When eligible, a 60-second timer arms the
 * prompt — restarted whenever the app foregrounds or the tutorial completes in
 * the current session, so a brand-new user sees it ~60s after finishing setup.
 *
 * The caller is responsible for the final gate (not on a logging screen, no
 * milestone celebration in progress) before rendering.
 */
export function useReviewPrompt() {
  const [armed, setArmed] = useState(false);

  const hasReviewedApp = usePreferencesStore((s) => s.hasReviewedApp);
  const reviewPromptLastShown = usePreferencesStore((s) => s.reviewPromptLastShown);
  const tourCompleted = usePreferencesStore((s) => s.tourCompleted);
  const markReviewed = usePreferencesStore((s) => s.markReviewed);
  const markReviewPromptShown = usePreferencesStore((s) => s.markReviewPromptShown);

  const today = todayKey();
  const cooldownPassed = reviewPromptLastShown
    ? daysBetween(reviewPromptLastShown, today) >= COOLDOWN_DAYS
    : true;
  const eligible = tourCompleted && !hasReviewedApp && cooldownPassed;

  // Arm a 60s timer while eligible. Re-arm on each foreground so the timer is
  // measured from when the user is actually in the app, and so the prompt can
  // appear on a later session if the first window was missed.
  useEffect(() => {
    if (!eligible) {
      setArmed(false);
      return;
    }
    let timer = setTimeout(() => setArmed(true), SHOW_DELAY_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        clearTimeout(timer);
        timer = setTimeout(() => setArmed(true), SHOW_DELAY_MS);
      }
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [eligible]);

  // Tapping "Rate" assumes a review — stop prompting permanently and start the
  // cooldown. The component fires the native sheet / store deep link itself.
  const onReview = () => {
    markReviewed();
    markReviewPromptShown();
    setArmed(false);
  };

  // "Maybe later" — restart the 14-day cooldown.
  const onDismiss = () => {
    markReviewPromptShown();
    setArmed(false);
  };

  return { shouldShowReview: armed && eligible, onReview, onDismiss };
}
