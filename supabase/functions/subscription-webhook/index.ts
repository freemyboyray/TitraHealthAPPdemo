import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { compactVerify, decodeProtectedHeader, importX509 } from 'https://esm.sh/jose@5';
import { X509Certificate } from 'https://esm.sh/@peculiar/x509@1';

/**
 * Subscription Webhook Handler
 *
 * Receives and processes subscription events from:
 * 1. Apple App Store Server Notifications V2 (JWS signature + x5c chain verification)
 * 2. Stripe Webhooks (HMAC-SHA256 signature verification)
 *
 * Updates the `subscriptions` table and `profiles.is_premium` flag.
 *
 * Required environment variables:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   APPLE_ROOT_CA_FINGERPRINT  — SHA-256 hex of Apple Root CA - G3 DER certificate
 *     (curl -sO https://www.apple.com/certificateauthority/AppleRootCA-G3.cer && shasum -a 256 AppleRootCA-G3.cer)
 *   STRIPE_WEBHOOK_SECRET      — whsec_... from Stripe dashboard
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'none';

// ─── Crypto Helpers ─────────────────────────────────────────────────────────

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function derToPem(b64Der: string): string {
  const lines = b64Der.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) result |= bufA[i] ^ bufB[i];
  return result === 0;
}

// ─── Apple JWS Verification ─────────────────────────────────────────────────

/**
 * Verify an Apple-signed JWS payload:
 * 1. Validate x5c certificate chain (each cert signed by the next)
 * 2. Verify root certificate fingerprint against Apple Root CA - G3
 * 3. Verify JWS signature using the leaf certificate's public key
 *
 * Fails closed: rejects if APPLE_ROOT_CA_FINGERPRINT env var is missing.
 */
async function verifyAppleJWS(signedPayload: string): Promise<Record<string, unknown>> {
  const header = decodeProtectedHeader(signedPayload);
  const x5c = header.x5c;
  if (!x5c || x5c.length < 2) {
    throw new Error('Missing or incomplete x5c certificate chain in JWS header');
  }

  const alg = (header.alg as string) || 'ES256';

  // Parse the certificate chain
  const certs = x5c.map((b64) => new X509Certificate(base64ToUint8Array(b64)));

  // Verify root certificate fingerprint matches Apple's known Root CA - G3
  const expectedFingerprint = Deno.env.get('APPLE_ROOT_CA_FINGERPRINT');
  if (!expectedFingerprint) {
    throw new Error(
      'APPLE_ROOT_CA_FINGERPRINT env var not set — webhook verification disabled (fail-closed)',
    );
  }

  const rootCertDer = base64ToUint8Array(x5c[x5c.length - 1]);
  const rootFingerprint = await sha256Hex(rootCertDer);
  if (!timingSafeEqual(rootFingerprint, expectedFingerprint.toLowerCase())) {
    throw new Error(
      `Root certificate fingerprint mismatch: expected ${expectedFingerprint}, got ${rootFingerprint}`,
    );
  }

  // Verify certificate chain: each cert[i] must be signed by cert[i+1]
  for (let i = 0; i < certs.length - 1; i++) {
    const issuerKey = await certs[i + 1].publicKey.export();
    const valid = await certs[i].verify({ publicKey: issuerKey });
    if (!valid) {
      throw new Error(`Certificate chain verification failed at depth ${i}`);
    }
  }

  // Verify JWS signature using the leaf certificate's public key
  const leafPem = derToPem(x5c[0]);
  const key = await importX509(leafPem, alg);
  const { payload } = await compactVerify(signedPayload, key);

  return JSON.parse(new TextDecoder().decode(payload));
}

// ─── Stripe Signature Verification ──────────────────────────────────────────

/**
 * Verify a Stripe webhook signature (HMAC-SHA256):
 * 1. Parse Stripe-Signature header ("t=timestamp,v1=sig1,v1=sig2,...")
 * 2. Reject if timestamp is outside 5-minute tolerance (replay protection)
 * 3. Compute HMAC-SHA256 of "timestamp.rawBody" with webhook secret
 * 4. Timing-safe compare against all provided v1 signatures
 *
 * Fails closed: rejects if STRIPE_WEBHOOK_SECRET env var is missing.
 */
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<void> {
  const elements: Record<string, string[]> = {};
  for (const part of signatureHeader.split(',')) {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=');
    if (!elements[key]) elements[key] = [];
    elements[key].push(value);
  }

  const timestamp = elements['t']?.[0];
  const signatures = elements['v1'] || [];
  if (!timestamp || signatures.length === 0) {
    throw new Error('Invalid Stripe-Signature header format');
  }

  // Reject stale timestamps (5-minute tolerance prevents replay attacks)
  const TOLERANCE_SECONDS = 300;
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > TOLERANCE_SECONDS) {
    throw new Error(`Stripe webhook timestamp outside ${TOLERANCE_SECONDS}s tolerance`);
  }

  // Compute expected HMAC-SHA256 signature
  const signed = `${timestamp}.${rawBody}`;
  const keyData = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(signed));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison against all provided v1 signatures
  const verified = signatures.some((s) => timingSafeEqual(s, expected));
  if (!verified) {
    throw new Error('Stripe webhook signature verification failed');
  }
}

// ─── Main Handler ───────────────────────────────────────────────────────────

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

    // Read raw body as text first — Stripe HMAC needs the exact raw bytes
    const rawBody = await req.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Route based on payload shape
    if (body.signedPayload) {
      return await handleAppleNotification(
        supabase,
        body as { signedPayload: string },
      );
    } else if (body.type && (body.data as Record<string, unknown>)?.object) {
      return await handleStripeEvent(
        supabase,
        req,
        rawBody,
        body as { type: string; data: { object: Record<string, unknown> } },
      );
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
  // Verify the outer JWS signature and certificate chain
  let payload: Record<string, unknown>;
  try {
    payload = await verifyAppleJWS(body.signedPayload);
  } catch (err) {
    console.error('[apple-webhook] JWS verification failed:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'Signature verification failed' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const notificationType = payload.notificationType as string;
  const subtype = payload.subtype as string | undefined;

  console.log(`[apple-webhook] type=${notificationType} subtype=${subtype ?? 'none'}`);

  // Verify and decode the signed transaction info (also a JWS)
  let transactionInfo: Record<string, unknown> = {};
  const signedTransactionInfo = (payload.data as Record<string, unknown>)
    ?.signedTransactionInfo as string | undefined;
  if (signedTransactionInfo) {
    try {
      transactionInfo = await verifyAppleJWS(signedTransactionInfo);
    } catch (err) {
      console.error(
        '[apple-webhook] Transaction info verification failed:',
        (err as Error).message,
      );
      return new Response(
        JSON.stringify({ error: 'Transaction signature verification failed' }),
        { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
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

  console.log(`[apple-webhook] Updated user=${userId.slice(0, 8)}… status=${status} premium=${isPremium}`);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── Stripe Webhooks ─────────────────────────────────────────────────────────

async function handleStripeEvent(
  supabase: ReturnType<typeof createClient>,
  req: Request,
  rawBody: string,
  body: { type: string; data: { object: Record<string, unknown> } },
): Promise<Response> {
  // Verify Stripe webhook signature (required — fail closed)
  const stripeSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET env var not set');
    return new Response(
      JSON.stringify({ error: 'Webhook signature verification not configured' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing Stripe-Signature header' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    await verifyStripeSignature(rawBody, signature, stripeSecret);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'Signature verification failed' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
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

  console.log(`[stripe-webhook] Updated user=${userId.slice(0, 8)}… status=${status} premium=${isPremium}`);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
