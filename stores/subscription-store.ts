import { Platform } from 'react-native';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'none';
export type FeatureKey = 'ai_chat' | 'photo_analysis' | 'voice_log' | 'food_log';
export type GateType = 'allowed' | 'limited' | 'locked';

/** Features that require premium (hard paywall) */
const PREMIUM_FEATURES = new Set([
  'cycle_intelligence',
  'provider_report',
  'rtm_link',
  'weight_projection_advanced',
  'courses_all',
  'ai_insights',
  'weekly_ai_summary',
  'coach_notes',
  'metabolic_adaptation',
  'progress_photo_compare',
]);

/** Features that are metered (usage-limited for free users) */
const METERED_FEATURES = new Set<FeatureKey>(['ai_chat', 'photo_analysis', 'voice_log', 'food_log']);

const FEATURE_LIMITS: Record<FeatureKey, number> = {
  ai_chat: 5,
  photo_analysis: 3,
  voice_log: 3,
  food_log: 5,
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

    // Read profile + subscription together so isPremium can never disagree with status.
    // profiles.is_premium is a denormalized flag that can drift if a webhook half-fires;
    // subscriptions.status is the source of truth.
    const [profileResult, subResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('trial_ends_at')
        .eq('id', user.id)
        .single(),
      supabase
        .from('subscriptions')
        .select('status, current_period_end, trial_end')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const trialEndsAt = profileResult.data?.trial_ends_at ?? null;
    const trialActive = trialEndsAt ? new Date(trialEndsAt) > new Date() : false;

    const sub = subResult.data;
    const status = (sub?.status ?? 'none') as SubscriptionStatus;
    const periodActive = sub?.current_period_end
      ? new Date(sub.current_period_end) > new Date()
      : false;
    const subscriptionActive =
      status === 'active' ||
      status === 'trialing' ||
      (status === 'canceled' && periodActive);

    set({
      isPremium: subscriptionActive || trialActive,
      trialEndsAt,
      status,
      currentPeriodEnd: sub?.current_period_end ?? null,
      loaded: true,
    });
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

    const [profileResult, subResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('trial_ends_at')
        .eq('id', user.id)
        .single(),
      supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const trialEndsAt = profileResult.data?.trial_ends_at ?? null;
    const trialActive = trialEndsAt ? new Date(trialEndsAt) > new Date() : false;

    const sub = subResult.data;
    const status = (sub?.status ?? 'none') as SubscriptionStatus;
    const periodActive = sub?.current_period_end
      ? new Date(sub.current_period_end) > new Date()
      : false;
    const subscriptionActive =
      status === 'active' ||
      status === 'trialing' ||
      (status === 'canceled' && periodActive);

    set({
      isPremium: subscriptionActive || trialActive,
      trialEndsAt,
      status,
      currentPeriodEnd: sub?.current_period_end ?? null,
    });
  },

  setPremium: (isPremium: boolean) => set({ isPremium }),
}));
