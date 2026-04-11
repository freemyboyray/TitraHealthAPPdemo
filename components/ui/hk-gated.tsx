import type { ReactNode } from 'react';
import { useHealthKitStore } from '../../stores/healthkit-store';
import type { HKCategoryKey } from '../../lib/healthkit';

type Props = {
  category: HKCategoryKey | HKCategoryKey[];
  // Render this when at least one category in `category` is live.
  children: ReactNode;
  // Render this when none of the categories are live. Default: null.
  fallback?: ReactNode;
  // If true, require ALL categories live instead of ANY. Default: false.
  requireAll?: boolean;
};

// Conditional wrapper for HealthKit-dependent UI. Renders children only when
// the given category (or any of a list) has returned data in the last 30
// days. Keeps empty "no VO2Max yet" cards out of the app for users who don't
// own a watch, without needing platform or permission checks at the callsite.
export function HKGated({ category, children, fallback = null, requireAll = false }: Props) {
  const keys = Array.isArray(category) ? category : [category];
  const live = useHealthKitStore((s) => {
    if (requireAll) return keys.every((k) => s.liveCategories.has(k));
    return keys.some((k) => s.liveCategories.has(k));
  });
  return <>{live ? children : fallback}</>;
}
