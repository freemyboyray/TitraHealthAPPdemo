import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAuth, CORS } from '../_shared/auth.ts';

// Validates a provider/doctor code entered during onboarding. Mirrors
// redeem-demo: looks the code up case-insensitively, checks expiry + remaining
// uses, increments usage, and returns the resolved provider name. The client
// stores the code on the draft; completeOnboarding persists it to the profile.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const auth = await verifyAuth(req);
    if (auth instanceof Response) return auth;

    const { code } = await req.json();
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid code' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Use service_role to bypass RLS (doctor_codes has no client policies).
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const normalizedCode = code.trim();
    const { data: codeRow, error: lookupErr } = await supabase
      .from('doctor_codes')
      .select('*')
      .ilike('code', normalizedCode)
      .single();

    if (lookupErr || !codeRow) {
      return new Response(JSON.stringify({ error: 'Invalid code' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This code has expired' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (codeRow.current_uses >= codeRow.max_uses) {
      return new Response(JSON.stringify({ error: 'This code has been fully redeemed' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateErr } = await supabase
      .from('doctor_codes')
      .update({ current_uses: codeRow.current_uses + 1 })
      .eq('id', codeRow.id);

    if (updateErr) {
      console.error('[verify-doctor-code] Failed to increment usage:', updateErr.message);
    }

    return new Response(
      JSON.stringify({ success: true, providerName: codeRow.provider_name ?? null }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[verify-doctor-code] Internal error:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
