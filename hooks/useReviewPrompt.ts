import { useEffect, useState } from 'react';
import { usePreferencesStore } from '@/stores/preferences-store';

const MIN_APP_OPENS = 5;
const MIN_STREAK = 7;
const MIN_DAYS_SINCE_INSTALL = 7;
const COOLDOWN_DAYS = 90;
const MAX_PROMPTS = 3;
const SHOW_DELAY_MS = 3000;

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useReviewPrompt() {
  const [ready, setReady] = useState(false);

  const {
    hasReviewedApp,
    reviewPromptLastShown,
    reviewPromptDismissCount,
    appOpenCount,
    firstOpenDate,
    streakCount,
    markReviewed,
    markReviewPromptShown,
  } = usePreferencesStore();

  // Delay before allowing the prompt to show (avoid interrupting user flow)
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const today = todayKey();

  let shouldShowReview = false;

  if (ready && !hasReviewedApp && reviewPromptDismissCount < MAX_PROMPTS) {
    const hasEnoughOpens = appOpenCount >= MIN_APP_OPENS;
    const hasEnoughStreak = streakCount >= MIN_STREAK;
    const hasEnoughDays = firstOpenDate
      ? daysBetween(firstOpenDate, today) >= MIN_DAYS_SINCE_INSTALL
      : false;
    const cooldownPassed = reviewPromptLastShown
      ? daysBetween(reviewPromptLastShown, today) >= COOLDOWN_DAYS
      : true;

    shouldShowReview = hasEnoughOpens && hasEnoughStreak && hasEnoughDays && cooldownPassed;
  }

  const onReview = () => {
    markReviewed();
  };

  const onDismiss = () => {
    markReviewPromptShown();
  };

  return { shouldShowReview, onReview, onDismiss };
}
