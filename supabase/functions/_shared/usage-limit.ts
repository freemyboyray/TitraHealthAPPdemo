import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS } from './auth.ts';

export type FeatureKey = 'ai_chat' | 'photo_analysis' | 'voice_log';

const LIMITS: Record<FeatureKey, number> = {
  ai_chat: 5,
  photo_analysis: 3,
  voice_log: 3,
};

export type UsageCheckResult = {
  allowed: boolean;
  remaining: number | null;
  used: number;
  limit: number;
  is_premium: boolean;
};

/**
 * Checks and increments usage for a metered feature.
 * Returns null if allowed (premium or under limit).
 * Returns a 429 Response if the limit is exceeded.
 */
export async function checkUsageLimit(
  userId: string,
  featureKey: FeatureKey,
): Promise<Response | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const limit = LIMITS[featureKey];

  const { data, error } = await supabase.rpc('check_and_increment_usage', {
    p_user_id: userId,
    p_feature_key: featureKey,
    p_limit: limit,
  });

  if (error) {
    console.error(`[usage-limit] RPC error for ${featureKey}:`, error.message);
    // On error, allow the request (fail open to avoid blocking paying users)
    return null;
  }

  const result = data as UsageCheckResult;

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'USAGE_LIMIT',
        feature: featureKey,
        limit: result.limit,
        used: result.used,
        remaining: 0,
        is_premium: false,
      }),
      {
        status: 429,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      },
    );
  }

  return null;
}
