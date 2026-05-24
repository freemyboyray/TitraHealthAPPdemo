import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAuth, CORS } from '../_shared/auth.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const auth = await verifyAuth(req);
    if (auth instanceof Response) return auth;

    const { code } = await req.json();
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid demo code' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Use service_role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Look up code in database (case-insensitive)
    const normalizedCode = code.trim().toLowerCase();
    const { data: codeRow, error: lookupErr } = await supabase
      .from('demo_codes')
      .select('*')
      .ilike('code', normalizedCode)
      .single();

    if (lookupErr || !codeRow) {
      return new Response(JSON.stringify({ error: 'Invalid demo code' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Check expiration
    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This code has expired' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Check remaining uses
    if (codeRow.current_uses >= codeRow.max_uses) {
      return new Response(JSON.stringify({ error: 'This code has been fully redeemed' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Increment usage count
    const { error: updateErr } = await supabase
      .from('demo_codes')
      .update({ current_uses: codeRow.current_uses + 1 })
      .eq('id', codeRow.id);

    if (updateErr) {
      console.error('[redeem-demo] Failed to increment usage:', updateErr.message);
    }

    // subscriptions.status is the source of truth for the client and the
    // check_and_increment_usage RPC. Insert a demo row; if the user already
    // has a subscription (real Stripe/Apple), leave it alone.
    const { error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: auth.userId,
        status: 'active',
        plan: 'monthly',
        provider: 'demo',
        provider_subscription_id: `demo-${auth.userId}`,
      });

    // 23505 = unique_violation on user_id; expected when a real sub already exists
    if (subError && subError.code !== '23505') {
      console.error('[redeem-demo] Subscription insert error:', subError.message);
      return new Response(JSON.stringify({ error: 'Failed to activate' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ is_premium: true })
      .eq('id', auth.userId);

    if (error) {
      console.error('[redeem-demo] Update error:', error.message);
      return new Response(JSON.stringify({ error: 'Failed to activate' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[redeem-demo] Internal error:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
