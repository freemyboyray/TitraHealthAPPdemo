import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAuth, CORS } from '../_shared/auth.ts';

const VALID_DEMO_CODES = new Set(['demo123']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const auth = await verifyAuth(req);
    if (auth instanceof Response) return auth;

    const { code } = await req.json();
    if (!code || !VALID_DEMO_CODES.has(code.trim().toLowerCase())) {
      return new Response(JSON.stringify({ error: 'Invalid demo code' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Use service_role to bypass the protect_premium_columns trigger
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

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
