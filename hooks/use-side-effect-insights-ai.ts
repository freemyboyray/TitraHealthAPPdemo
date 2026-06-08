// Reads today's side-effect AI insights for the Side Effect Insights screen and
// the Symptom Changes sub-page. Loads the persisted set instantly (no shimmer on
// the common path) and only shows loading when a fresh generation is actually
// needed. The heavy lifting (build/generate/persist) lives in
// lib/side-effect-insights-ai.ts and is usually pre-warmed from the Lifestyle tab.

import { useEffect, useState } from 'react';

import { useProfile } from '@/contexts/profile-context';
import { usePreferencesStore } from '@/stores/preferences-store';
import type { SideEffectDigest, SideEffectInsightSet } from '@/lib/openai';
import {
  EMPTY_SE_INSIGHTS,
  ensureSideEffectInsights,
  loadPersistedInsights,
} from '@/lib/side-effect-insights-ai';

export type SideEffectAiState = SideEffectInsightSet & { loading: boolean; consented: boolean };

export function useSideEffectInsightsAi(digest: SideEffectDigest | null): SideEffectAiState {
  const { profile } = useProfile();
  const aiDataConsent = usePreferencesStore(s => s.aiDataConsent);

  const [result, setResult] = useState<SideEffectInsightSet>(EMPTY_SE_INSIGHTS);
  const [loading, setLoading] = useState(false);

  const signature = digest
    ? `${new Date().toDateString()}|${digest.symptoms.map(s => `${s.type}:${s.count}:${s.trend}`).join(',')}|${digest.cyclePeakLabel ?? ''}`
    : null;

  useEffect(() => {
    let cancelled = false;
    if (!digest || !profile || digest.symptoms.length === 0) {
      setResult(EMPTY_SE_INSIGHTS);
      setLoading(false);
      return;
    }

    (async () => {
      const today = new Date().toDateString();
      const persisted = await loadPersistedInsights();
      if (cancelled) return;

      if (persisted?.day === today) {
        setResult(persisted.set);
        setLoading(false);
        return;
      }
      // Show any stale set immediately; only spin if we'll actually regenerate.
      if (persisted?.set) setResult(persisted.set);
      if (!aiDataConsent) { setLoading(false); return; }

      setLoading(true);
      const set = await ensureSideEffectInsights(digest, profile);
      if (cancelled) return;
      setResult(set);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [signature, profile, aiDataConsent]);

  return { ...result, loading, consented: aiDataConsent };
}
