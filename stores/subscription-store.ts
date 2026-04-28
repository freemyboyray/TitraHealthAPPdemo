import { Platform } from 'react-native';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'none';
export type FeatureKey = 'ai_chat' | 'photo_analysis' | 'voice_log';
export type GateType = 'allowed' | 'limited' | 'locked';

/** Features that require premium (hard paywall) */
const PREMIUM_FEATURES = new Set([
  'cycle_intelligence',
  'provider_report',
  'rtm_link',
  'peer_comparison',
  'weight_projection_advanced',
  'clinical_alerts',
  'courses_all',
  'ai_insights',
  'weekly_ai_summary',
  'coach_notes',
  'metabolic_adaptation',
  'progress_photo_compare',
]);

/** Features that are metered (usage-limited for free users) */
const METERED_FEATURES = new Set<FeatureKey>(['ai_chat', 'photo_analysis', 'voice_log']);

const FEATURE_LIMITS: Record<FeatureKey, number> = {
  ai_chat: 3,
  photo_analysis: 5,
  voice_log: 3,
};

// ─── Store ───────────────────────────────────────────────────────────────────

type SubscriptionStore = {
  // State
  isPremium: boolean;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  loaded: boolean;

  // Actions
  loadSubscription: () => Promise<void>;
  checkFeatureAccess: (feature: string) => GateType;
  getFeatureLimit: (feature: FeatureKey) => number;
  refreshPremiumStatus: () => Promise<void>;
  setPremium: (isPremium: boolean) => void;
};

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  isPremium: false,
  status: 'none',
  trialEndsAt: null,
  currentPeriodEnd: null,
  loaded: false,

  loadSubscription: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fast path: read denormalized flag from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium, trial_ends_at')
      .eq('id', user.id)
      .single();

    if (profile) {
      const isPremium = profile.is_premium ?? false;

      // Also check if trial is still active
      const trialEndsAt = profile.trial_ends_at;
      const trialActive = trialEndsAt ? new Date(trialEndsAt) > new Date() : false;

      set({
        isPremium: isPremium || trialActive,
        trialEndsAt,
        loaded: true,
      });
    }

    // Fetch full subscription details (async, non-blocking for UI)
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, current_period_end, trial_end')
      .eq('user_id', user.id)
      .single();

    if (sub) {
      set({
        status: sub.status as SubscriptionStatus,
        currentPeriodEnd: sub.current_period_end,
      });
    } else {
      set({ status: 'none' });
    }
  },

  checkFeatureAccess: (feature: string): GateType => {
    const { isPremium } = get();
    if (isPremium) return 'allowed';

    // Hard paywalled features
    if (PREMIUM_FEATURES.has(feature)) return 'locked';

    // Metered features
    if (METERED_FEATURES.has(feature as FeatureKey)) return 'limited';

    // Everything else is free
    return 'allowed';
  },

  getFeatureLimit: (feature: FeatureKey): number => {
    return FEATURE_LIMITS[feature] ?? 0;
  },

  refreshPremiumStatus: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('is_premium, trial_ends_at')
      .eq('id', user.id)
      .single();

    if (data) {
      const trialEndsAt = data.trial_ends_at;
      const trialActive = trialEndsAt ? new Date(trialEndsAt) > new Date() : false;
      set({
        isPremium: (data.is_premium ?? false) || trialActive,
        trialEndsAt,
      });
    }
  },

  setPremium: (isPremium: boolean) => set({ isPremium }),
}));
