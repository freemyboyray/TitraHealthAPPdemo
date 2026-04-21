import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Subscription Webhook Handler
 *
 * Receives and processes subscription events from:
 * 1. Apple App Store Server Notifications V2
 * 2. Stripe Webhooks (for web/future billing)
 *
 * Updates the `subscriptions` table and `profiles.is_premium` flag.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'none';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();

    // Route based on payload shape
    if (body.signedPayload) {
      // Apple App Store Server Notifications V2
      return await handleAppleNotification(supabase, body);
    } else if (body.type && body.data?.object) {
      // Stripe webhook event
      return await handleStripeEvent(supabase, req, body);
    } else {
      console.error('[subscription-webhook] Unknown payload shape:', Object.keys(body));
      return new Response(JSON.stringify({ error: 'Unknown event source' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('[subscription-webhook] Error:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});

// ─── Apple App Store Server Notifications V2 ─────────────────────────────────

async function handleAppleNotification(
  supabase: ReturnType<typeof createClient>,
  body: { signedPayload: string },
): Promise<Response> {
  // Decode the JWS payload (base64url-encoded JSON in the second segment)
  // In production, you should verify the JWS signature with Apple's certificate chain.
  // For now, we decode and process the notification type.
  const parts = body.signedPayload.split('.');
  if (parts.length !== 3) {
    return new Response(JSON.stringify({ error: 'Invalid JWS format' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  const notificationType: string = payload.notificationType;
  const subtype: string | undefined = payload.subtype;

  console.log(`[apple-webhook] type=${notificationType} subtype=${subtype ?? 'none'}`);

  // Decode the transaction info from the signed renewal/transaction
  let transactionInfo: Record<string, unknown> = {};
  const signedTransactionInfo = payload.data?.signedTransactionInfo;
  if (signedTransactionInfo) {
    const txParts = signedTransactionInfo.split('.');
    if (txParts.length === 3) {
      transactionInfo = JSON.parse(atob(txParts[1].replace(/-/g, '+').replace(/_/g, '/')));
    }
  }

  // The appAccountToken is the Supabase user ID we set at purchase time
  const userId = transactionInfo.appAccountToken as string | undefined;
  if (!userId) {
    console.error('[apple-webhook] No appAccountToken in transaction');
    return new Response(JSON.stringify({ error: 'No user mapping' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const originalTransactionId = transactionInfo.originalTransactionId as string;
  const expiresDate = transactionInfo.expiresDate
    ? new Date(transactionInfo.expiresDate as number).toISOString()
    : null;

  // Map Apple notification types to our subscription status
  let status: SubscriptionStatus;
  let isPremium: boolean;

  switch (notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
      status = 'active';
      isPremium = true;
      break;

    case 'OFFER_REDEEMED':
      // Free trial started
      status = 'trialing';
      isPremium = true;
      break;

    case 'DID_FAIL_TO_RENEW':
      status = 'past_due';
      isPremium = true; // Keep access during grace period
      break;

    case 'EXPIRED':
      status = 'expired';
      isPremium = false;
      break;

    case 'DID_CHANGE_RENEWAL_STATUS':
      if (subtype === 'AUTO_RENEW_DISABLED') {
        status = 'canceled';
        isPremium = true; // Still active until period end
      } else {
        status = 'active';
        isPremium = true;
      }
      break;

    case 'REVOKE':
    case 'REFUND':
      status = 'expired';
      isPremium = false;
      break;

    default:
      console.log(`[apple-webhook] Unhandled type: ${notificationType}`);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
  }

  // Upsert subscription record
  const { error: subError } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        status,
        plan: 'monthly',
        provider: 'app_store',
        provider_subscription_id: originalTransactionId,
        current_period_end: expiresDate,
        cancel_at_period_end: status === 'canceled',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (subError) {
    console.error('[apple-webhook] Subscription upsert error:', subError.message);
  }

  // Update denormalized premium flag
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ is_premium: isPremium })
    .eq('id', userId);

  if (profileError) {
    console.error('[apple-webhook] Profile update error:', profileError.message);
  }

  console.log(`[apple-webhook] Updated user=${userId} status=${status} premium=${isPremium}`);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── Stripe Webhooks ─────────────────────────────────────────────────────────

async function handleStripeEvent(
  supabase: ReturnType<typeof createClient>,
  req: Request,
  body: { type: string; data: { object: Record<string, unknown> } },
): Promise<Response> {
  // Verify Stripe webhook signature
  const stripeSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (stripeSecret) {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing Stripe signature' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    // Note: Full Stripe signature verification requires the raw body and crypto.
    // For production, use Stripe's official library or implement HMAC-SHA256 verification.
    // For now we check the signature header exists.
    // TODO: Implement full Stripe signature verification with crypto.subtle
  }

  const event = body;
  const subscription = event.data.object as Record<string, unknown>;

  console.log(`[stripe-webhook] type=${event.type}`);

  // Extract user ID from metadata (set when creating checkout session)
  const userId = (subscription.metadata as Record<string, string>)?.supabase_user_id;
  if (!userId) {
    console.error('[stripe-webhook] No supabase_user_id in metadata');
    return new Response(JSON.stringify({ error: 'No user mapping' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let status: SubscriptionStatus;
  let isPremium: boolean;

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const stripeStatus = subscription.status as string;
      if (stripeStatus === 'trialing') {
        status = 'trialing';
        isPremium = true;
      } else if (stripeStatus === 'active') {
        status = 'active';
        isPremium = true;
      } else if (stripeStatus === 'past_due') {
        status = 'past_due';
        isPremium = true;
      } else if (stripeStatus === 'canceled') {
        status = 'canceled';
        isPremium = false;
      } else {
        status = 'expired';
        isPremium = false;
      }
      break;
    }

    case 'customer.subscription.deleted':
      status = 'expired';
      isPremium = false;
      break;

    default:
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
  }

  const periodEnd = subscription.current_period_end
    ? new Date((subscription.current_period_end as number) * 1000).toISOString()
    : null;
  const periodStart = subscription.current_period_start
    ? new Date((subscription.current_period_start as number) * 1000).toISOString()
    : null;
  const trialEnd = subscription.trial_end
    ? new Date((subscription.trial_end as number) * 1000).toISOString()
    : null;

  // Upsert subscription record
  const { error: subError } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        status,
        plan: 'monthly',
        provider: 'stripe',
        provider_subscription_id: subscription.id as string,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        trial_end: trialEnd,
        cancel_at_period_end: (subscription.cancel_at_period_end as boolean) ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (subError) {
    console.error('[stripe-webhook] Subscription upsert error:', subError.message);
  }

  // Update denormalized premium flag
  const updateData: Record<string, unknown> = { is_premium: isPremium };
  if (trialEnd) updateData.trial_ends_at = trialEnd;

  const { error: profileError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (profileError) {
    console.error('[stripe-webhook] Profile update error:', profileError.message);
  }

  console.log(`[stripe-webhook] Updated user=${userId} status=${status} premium=${isPremium}`);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
