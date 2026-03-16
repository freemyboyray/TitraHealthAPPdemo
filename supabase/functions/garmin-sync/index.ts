import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GARMIN_TOKEN_URL = 'https://connectapi.garmin.com/oauth-service/oauth/token';
const GARMIN_WELLNESS_URL = 'https://apis.garmin.com/wellness-api/rest/dailies';
const GARMIN_WEIGHT_URL = 'https://apis.garmin.com/wellness-api/rest/bodyComps';

type GarminTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

async function refreshTokenIfNeeded(
  tokens: GarminTokens,
  clientId: string,
  clientSecret: string
): Promise<GarminTokens> {
  const expiresAt = new Date(tokens.expires_at).getTime();
  // Refresh if within 5 minutes of expiry
  if (Date.now() < expiresAt - 5 * 60 * 1000) return tokens;

  const res = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const refreshed = await res.json();
  return {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
    expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Load stored tokens
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('garmin_tokens')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData?.garmin_tokens) {
      return new Response(JSON.stringify({ error: 'Garmin not connected' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get('GARMIN_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET')!;

    // Refresh token if needed
    const tokens = await refreshTokenIfNeeded(
      profileData.garmin_tokens as GarminTokens,
      clientId,
      clientSecret
    );

    // Persist refreshed tokens back if changed
    if (tokens.access_token !== (profileData.garmin_tokens as GarminTokens).access_token) {
      await supabase
        .from('profiles')
        .update({ garmin_tokens: tokens })
        .eq('id', user.id);
    }

    // Compute today's time window in epoch seconds
    const now = Math.floor(Date.now() / 1000);
    const startOfDay = now - (now % 86400); // UTC midnight

    // Fetch daily wellness summary
    const wellnessRes = await fetch(
      `${GARMIN_WELLNESS_URL}?startTimeInSeconds=${startOfDay}&endTimeInSeconds=${now}`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    let steps: number | null = null;
    let activeCalories: number | null = null;
    let sleepHours: number | null = null;
    let restingHR: number | null = null;

    if (wellnessRes.ok) {
      const wellnessJson = await wellnessRes.json();
      const daily = Array.isArray(wellnessJson) ? wellnessJson[0] : wellnessJson?.dailies?.[0];
      if (daily) {
        steps = daily.steps ?? null;
        activeCalories = daily.activeKilocalories ?? null;
        restingHR = daily.restingHeartRateInBeatsPerMinute ?? null;
        const sleepSeconds = daily.sleepingSeconds ?? null;
        sleepHours = sleepSeconds != null ? sleepSeconds / 3600 : null;
      }
    }

    // Fetch body composition (weight)
    const weightRes = await fetch(
      `${GARMIN_WEIGHT_URL}?startTimeInSeconds=${startOfDay}&endTimeInSeconds=${now}`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    let weight: number | null = null;

    if (weightRes.ok) {
      const weightJson = await weightRes.json();
      const comp = Array.isArray(weightJson) ? weightJson[0] : weightJson?.bodyComps?.[0];
      if (comp?.weightInGrams != null) {
        // Convert grams → lbs (1 g = 0.00220462 lbs)
        weight = Math.round(comp.weightInGrams * 0.00220462 * 10) / 10;
      }
    }

    // Upsert activity_logs row for today
    const todayStr = new Date().toISOString().slice(0, 10);
    if (steps != null || activeCalories != null) {
      await supabase.from('activity_logs').upsert(
        {
          user_id: user.id,
          date: todayStr,
          exercise_type: 'Garmin Sync',
          source: 'garmin',
          steps: steps ?? 0,
          active_calories: activeCalories ?? 0,
          duration_min: 0,
        },
        { onConflict: 'user_id,date,source' }
      );
    }

    // Upsert weight_logs if weight data available
    if (weight != null) {
      await supabase.from('weight_logs').upsert(
        {
          user_id: user.id,
          weight_lbs: weight,
          logged_at: new Date().toISOString(),
          source: 'garmin',
        },
        { onConflict: 'user_id,source,logged_at' }
      );
    }

    return new Response(
      JSON.stringify({ steps, activeCalories, sleepHours, restingHR, weight }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
