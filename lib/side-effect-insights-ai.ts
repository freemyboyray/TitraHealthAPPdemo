// Builds the side-effect AI digest and manages day-cached, persisted insights so
// the Side Effect Insights screen shows a ready insight rather than generating one
// on open. Generation is pre-warmed from the Lifestyle tab (premium + consent),
// persisted to AsyncStorage per user, and de-duped via an in-flight guard.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import type { FullUserProfile } from '@/constants/user-profile';
import type { InjectionLog, SideEffectLog } from '@/stores/log-store';
import { isOralDrug, hasMeaningfulCycle } from '@/constants/drug-pk';
import { SEVERITY_TIERS, severityTier } from '@/constants/side-effects';
import {
  computeCoOccurrence,
  computeCycleVolume,
  computeSymptomTrends,
  detectInjectionWeekday,
  type CycleVolume,
} from '@/lib/side-effect-insights';
import {
  generateSideEffectInsights,
  type SideEffectDigest,
  type SideEffectInsightSet,
} from '@/lib/openai';
import { effectLabel } from '@/components/insights/effect-icon';
import { useLogStore } from '@/stores/log-store';
import { useProfile } from '@/contexts/profile-context';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { useUserStore } from '@/stores/user-store';

export const EMPTY_SE_INSIGHTS: SideEffectInsightSet = { overall: '', perSymptom: {} };

// ─── Digest ───────────────────────────────────────────────────────────────────

function peakLabel(volume: CycleVolume, freqDays: number, oral: boolean, weekday: number | null): string | null {
  if (volume.peakIndex < 0) return null;
  const label = volume.buckets[volume.peakIndex].label;
  if (freqDays <= 1) return `${label} after the ${oral ? 'dose' : 'injection'}`;
  if (freqDays === 7 && weekday != null) return label;
  if (label === 'Next') return `just before the next ${oral ? 'dose' : 'injection'}`;
  return label.replace(/^D/, 'Day ');
}

function freqLabelOf(oral: boolean, freqDays: number): string {
  if (oral || freqDays <= 1) return 'daily dose';
  if (freqDays === 7) return 'weekly injection';
  if (freqDays === 14) return 'biweekly injection';
  return `${freqDays}-day injection cycle`;
}

/** Builds the AI digest from raw logs + profile. Cheap; safe to call per render. */
export function buildSideEffectDigest(
  sideEffectLogs: SideEffectLog[],
  injectionLogs: InjectionLog[],
  profile: FullUserProfile | null,
): SideEffectDigest {
  const freqDays = profile?.injectionFrequencyDays ?? 7;
  const oral = isOralDrug(profile?.glp1Type);
  const meaningfulCycle = hasMeaningfulCycle(profile?.glp1Type, freqDays);
  const weekday = detectInjectionWeekday(injectionLogs);

  const volume = computeCycleVolume(sideEffectLogs, injectionLogs, freqDays, weekday);
  const trends = computeSymptomTrends(sideEffectLogs);
  const pairs = computeCoOccurrence(sideEffectLogs);

  return {
    freqLabel: freqLabelOf(oral, freqDays),
    cyclePeakLabel: meaningfulCycle ? peakLabel(volume, freqDays, oral, weekday) : null,
    symptoms: trends.map(t => ({
      type: t.type,
      label: effectLabel(t.type),
      count: t.count,
      avgTier: SEVERITY_TIERS[severityTier(t.avgSev)].label,
      mild: t.breakdown.mild,
      moderate: t.breakdown.moderate,
      severe: t.breakdown.severe,
      trend: t.trend === 'improving' ? 'improving'
        : t.trend === 'worsening' ? 'worsening'
        : t.trend === 'insufficient' ? 'new' : 'steady',
    })),
    clusters: pairs.map(p => ({ a: effectLabel(p.a), b: effectLabel(p.b), daysTogether: p.daysTogether })),
  };
}

// ─── Persistence ───────────────────────────────────────────────────────────────

type Persisted = { day: string; set: SideEffectInsightSet };

function storageKey(): string {
  const uid = useUserStore.getState().session?.user?.id ?? 'anon';
  return `@titrahealth_se_insights_${uid}`;
}

export async function loadPersistedInsights(): Promise<Persisted | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey());
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.day === 'string' && p.set) return p as Persisted;
  } catch { /* ignore */ }
  return null;
}

async function savePersisted(p: Persisted): Promise<void> {
  try { await AsyncStorage.setItem(storageKey(), JSON.stringify(p)); } catch { /* ignore */ }
}

// ─── Ensure (generate once per day, de-duped) ───────────────────────────────────

const _inflight = new Map<string, Promise<SideEffectInsightSet>>();

/**
 * Returns today's insight set, generating + persisting it once per day. Concurrent
 * callers (prewarm + screen) share a single in-flight generation. No-ops to a
 * stale/empty set without AI consent.
 */
export async function ensureSideEffectInsights(
  digest: SideEffectDigest,
  profile: FullUserProfile | null,
): Promise<SideEffectInsightSet> {
  if (!profile || digest.symptoms.length === 0) return EMPTY_SE_INSIGHTS;

  const day = new Date().toDateString();
  const persisted = await loadPersistedInsights();
  if (persisted?.day === day) return persisted.set;

  if (!usePreferencesStore.getState().aiDataConsent) return persisted?.set ?? EMPTY_SE_INSIGHTS;

  if (_inflight.has(day)) return _inflight.get(day)!;
  const p = (async () => {
    const set = await generateSideEffectInsights(digest, profile);
    await savePersisted({ day, set });
    return set;
  })();
  _inflight.set(day, p);
  try { return await p; }
  finally { _inflight.delete(day); }
}

// ─── Prewarm hook (call from the Lifestyle tab) ─────────────────────────────────

/**
 * Pre-generates today's insight in the background so the premium Side Effect
 * Insights screen opens with it already in place. Gated to premium + consent so
 * we never spend tokens for users who can't see it.
 */
export function useSideEffectInsightsPrewarm() {
  const { profile } = useProfile();
  const sideEffectLogs = useLogStore(s => s.sideEffectLogs);
  const injectionLogs = useLogStore(s => s.injectionLogs);
  const aiDataConsent = usePreferencesStore(s => s.aiDataConsent);
  const isPremium = useSubscriptionStore(s => s.isPremium);

  useEffect(() => {
    if (!profile || !isPremium || !aiDataConsent) return;
    if (sideEffectLogs.length === 0) return;
    const digest = buildSideEffectDigest(sideEffectLogs, injectionLogs, profile);
    if (digest.symptoms.length === 0) return;
    ensureSideEffectInsights(digest, profile).catch(() => {});
  }, [profile, isPremium, aiDataConsent, sideEffectLogs, injectionLogs]);
}
