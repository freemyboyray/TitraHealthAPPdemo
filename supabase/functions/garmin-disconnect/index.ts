import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GARMIN_REVOKE_URL = 'https://connectapi.garmin.com/oauth-service/oauth/deauthorize';

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

    // Load access token to revoke
    const { data: profileData } = await supabase
      .from('profiles')
      .select('garmin_tokens')
      .eq('id', user.id)
      .single();

    const tokens = profileData?.garmin_tokens;
    if (tokens?.access_token) {
      const clientId = Deno.env.get('GARMIN_CLIENT_ID')!;
      const clientSecret = Deno.env.get('GARMIN_CLIENT_SECRET')!;
      // Best-effort revoke - ignore errors
      await fetch(GARMIN_REVOKE_URL, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token: tokens.access_token }).toString(),
      }).catch(() => {});
    }

    // Clear tokens from profile
    await supabase
      .from('profiles')
      .update({ garmin_tokens: null })
      .eq('id', user.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
