import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAuth, CORS } from '../_shared/auth.ts';

// Applying a referral code creates a `referrals` row (status='pending'). It does
// NOT grant any credit here — the reward is granted by the qualification trigger
// on `subscriptions` when this referee later converts to paid. Eligibility:
// account < 7 days old AND has never had a real (non-demo) paid subscription.
const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PAID_PROVIDERS = ['app_store', 'play_store', 'stripe'];
// A real-money row in any of these states means they've paid at some point.
const PAID_STATUSES = ['active', 'past_due', 'canceled', 'expired'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  try {
    const auth = await verifyAuth(req);
    if (auth instanceof Response) return auth;

    const { code } = await req.json();
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return json(400, { error: 'Please enter a referral code.' });
    }

    // Use service_role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ── Eligibility: brand-new account ──────────────────────────────────────
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', auth.userId)
      .single();

    if (profileErr || !profile) {
      return json(400, { error: 'Could not verify your account.' });
    }

    const accountAgeMs = Date.now() - new Date(profile.created_at as string).getTime();
    if (accountAgeMs > NEW_ACCOUNT_WINDOW_MS) {
      return json(400, {
        error: 'Referral codes can only be applied within 7 days of creating your account.',
      });
    }

    // ── Eligibility: has never had a real paid subscription ─────────────────
    const { data: paidSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', auth.userId)
      .in('provider', PAID_PROVIDERS)
      .in('status', PAID_STATUSES)
      .maybeSingle();

    if (paidSub) {
      return json(400, { error: "This account isn't eligible for a referral code." });
    }

    // ── Validate the code ───────────────────────────────────────────────────
    const normalizedCode = code.trim();
    const { data: codeRow, error: lookupErr } = await supabase
      .from('referral_codes')
      .select('user_id, code')
      .ilike('code', normalizedCode)
      .maybeSingle();

    if (lookupErr || !codeRow) {
      return json(400, { error: "We couldn't find that referral code." });
    }

    if (codeRow.user_id === auth.userId) {
      return json(400, { error: "You can't use your own referral code." });
    }

    // ── Record the referral (status pending; trigger rewards on conversion) ──
    const { error: insertErr } = await supabase.from('referrals').insert({
      referrer_id: codeRow.user_id,
      referee_id: auth.userId,
      code: codeRow.code,
      status: 'pending',
    });

    if (insertErr) {
      // 23505 = unique_violation on referee_id → this account was already referred.
      if (insertErr.code === '23505') {
        return json(400, { error: "You've already applied a referral code." });
      }
      console.error('[redeem-referral] Insert error:', insertErr.message);
      return json(500, { error: 'Could not apply that code right now.' });
    }

    return json(200, { success: true });
  } catch (err) {
    console.error('[redeem-referral] Internal error:', (err as Error).message);
    return json(500, { error: 'Internal server error' });
  }
});
