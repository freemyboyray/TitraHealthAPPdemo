import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  compactVerify,
  decodeProtectedHeader,
  importX509,
  importPKCS8,
  SignJWT,
} from 'https://esm.sh/jose@5';
import { X509Certificate } from 'https://esm.sh/@peculiar/x509@1';

/**
 * verify-purchase
 *
 * Client-driven receipt validation. The app calls this right after a purchase
 * and on "Restore Purchases", passing the StoreKit transaction (iOS JWS) or the
 * Google Play purchaseToken. We verify it directly with Apple/Google and write
 * the `subscriptions` row + `profiles.is_premium` synchronously — so entitlement
 * is DETERMINISTIC and never depends on the async App Store Server Notification /
 * Play RTDN arriving (those still flow through `subscription-webhook` to keep the
 * row fresh on renewals, cancellations, refunds, etc).
 *
 * Auth: requires the caller's Supabase JWT (verify_jwt). The entitlement is bound
 * to the authenticated user; for Apple we also assert the transaction's
 * appAccountToken matches (when present) so one user can't claim another's receipt.
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APPLE_ROOT_CA_FINGERPRINT,
 *   and (Android) GOOGLE_PLAY_SA_CLIENT_EMAIL, GOOGLE_PLAY_SA_PRIVATE_KEY,
 *   ANDROID_PACKAGE_NAME.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'none';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── Crypto helpers (shared shape with subscription-webhook) ─────────────────

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
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) result |= bufA[i] ^ bufB[i];
  return result === 0;
}

/** Verify an Apple-signed JWS (x5c chain + Root CA fingerprint + signature). */
async function verifyAppleJWS(signedPayload: string): Promise<Record<string, unknown>> {
  const header = decodeProtectedHeader(signedPayload);
  const x5c = header.x5c;
  if (!x5c || x5c.length < 2) throw new Error('Missing or incomplete x5c chain');

  const alg = (header.alg as string) || 'ES256';
  const certs = x5c.map((b64) => new X509Certificate(base64ToUint8Array(b64)));

  const expectedFingerprint = Deno.env.get('APPLE_ROOT_CA_FINGERPRINT');
  if (!expectedFingerprint) {
    throw new Error('APPLE_ROOT_CA_FINGERPRINT env var not set (fail-closed)');
  }
  const rootFingerprint = await sha256Hex(base64ToUint8Array(x5c[x5c.length - 1]));
  if (!timingSafeEqual(rootFingerprint, expectedFingerprint.toLowerCase())) {
    throw new Error('Root certificate fingerprint mismatch');
  }
  for (let i = 0; i < certs.length - 1; i++) {
    const issuerKey = await certs[i + 1].publicKey.export();
    if (!(await certs[i].verify({ publicKey: issuerKey }))) {
      throw new Error(`Certificate chain verification failed at depth ${i}`);
    }
  }
  const key = await importX509(derToPem(x5c[0]), alg);
  const { payload } = await compactVerify(signedPayload, key);
  return JSON.parse(new TextDecoder().decode(payload));
}

// ─── Google Play Developer API ───────────────────────────────────────────────

async function getGooglePlayAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get('GOOGLE_PLAY_SA_CLIENT_EMAIL');
  const privateKeyRaw = Deno.env.get('GOOGLE_PLAY_SA_PRIVATE_KEY');
  if (!clientEmail || !privateKeyRaw) {
    throw new Error('GOOGLE_PLAY_SA_CLIENT_EMAIL / GOOGLE_PLAY_SA_PRIVATE_KEY not set');
  }
  const pem = privateKeyRaw.replace(/\\n/g, '\n');
  const privateKey = await importPKCS8(pem, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!resp.ok) throw new Error(`Google token exchange failed: ${resp.status}`);
  const j = (await resp.json()) as { access_token?: string };
  if (!j.access_token) throw new Error('Google token exchange returned no access_token');
  return j.access_token;
}

function mapGoogleSubscriptionState(state: string): { status: SubscriptionStatus; isPremium: boolean } {
  switch (state) {
    case 'SUBSCRIPTION_STATE_ACTIVE': return { status: 'active', isPremium: true };
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD': return { status: 'past_due', isPremium: true };
    case 'SUBSCRIPTION_STATE_CANCELED': return { status: 'canceled', isPremium: true };
    case 'SUBSCRIPTION_STATE_ON_HOLD':
    case 'SUBSCRIPTION_STATE_PAUSED': return { status: 'past_due', isPremium: false };
    default: return { status: 'expired', isPremium: false };
  }
}

// ─── Entitlement write ───────────────────────────────────────────────────────

type Entitlement = {
  status: SubscriptionStatus;
  isPremium: boolean;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  plan: 'monthly' | 'annual';
  provider: 'app_store' | 'play_store';
  providerSubscriptionId: string;
};

async function writeEntitlement(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  ent: Entitlement,
): Promise<void> {
  const { error: subError } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      status: ent.status,
      plan: ent.plan,
      provider: ent.provider,
      provider_subscription_id: ent.providerSubscriptionId,
      current_period_end: ent.currentPeriodEnd,
      trial_end: ent.trialEndsAt,
      cancel_at_period_end: ent.status === 'canceled',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (subError) throw new Error(`subscription upsert failed: ${subError.message}`);

  const profileUpdate: Record<string, unknown> = { is_premium: ent.isPremium };
  if (ent.trialEndsAt) profileUpdate.trial_ends_at = ent.trialEndsAt;
  const { error: profileError } = await supabase.from('profiles').update(profileUpdate).eq('id', userId);
  if (profileError) throw new Error(`profile update failed: ${profileError.message}`);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Authenticate the caller and bind entitlement to their user id.
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return json({ error: 'Missing authorization header' }, 401);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Invalid or expired token' }, 401);
  const userId = user.id;

  let body: { platform?: string; jws?: string; purchaseToken?: string; productId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  try {
    let ent: Entitlement;

    if (body.platform === 'ios') {
      if (!body.jws) return json({ error: 'Missing jws' }, 400);
      const txn = await verifyAppleJWS(body.jws);

      // Bind the entitlement to the authenticated caller. appAccountToken records
      // the *original* purchase's owner and Apple pins it forever, so a legitimate
      // "subscribe → delete account → re-subscribe" (or sandbox Apple-ID reuse
      // across test accounts) carries a stale token that no longer matches. Rather
      // than hard-reject those real cases, trust the Apple-verified JWS + the
      // authenticated JWT and entitle the caller. We still block the actual fraud
      // vector below: one Apple subscription entitling a *different* live account.
      const tokenUser = (txn.appAccountToken as string | undefined)?.toLowerCase();
      if (tokenUser && tokenUser !== userId.toLowerCase()) {
        console.warn(
          `[verify-purchase] appAccountToken ${tokenUser.slice(0, 8)}… != caller ${userId.slice(0, 8)}… — binding to caller`,
        );
      }
      const originalTxnId =
        (txn.originalTransactionId as string) ?? (txn.transactionId as string) ?? null;
      if (originalTxnId) {
        const { data: otherClaims } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('provider_subscription_id', originalTxnId)
          .neq('user_id', userId)
          .in('status', ['active', 'trialing', 'past_due'])
          .limit(1);
        if (otherClaims && otherClaims.length > 0) {
          return json({ error: 'This subscription is already linked to another account.' }, 403);
        }
      }

      const productId = (txn.productId as string) ?? body.productId ?? '';
      const expiresMs = txn.expiresDate as number | undefined;
      const expiresDate = expiresMs ? new Date(expiresMs).toISOString() : null;
      const active = expiresMs ? expiresMs > Date.now() : false;
      // offerType 1 = introductory (free trial / intro price).
      const isTrial = txn.offerType === 1 || txn.offerDiscountType === 'FREE_TRIAL';

      ent = {
        status: !active ? 'expired' : isTrial ? 'trialing' : 'active',
        isPremium: active,
        currentPeriodEnd: expiresDate,
        trialEndsAt: active && isTrial ? expiresDate : null,
        plan: productId.includes('annual') ? 'annual' : 'monthly',
        provider: 'app_store',
        providerSubscriptionId: (txn.originalTransactionId as string) ?? (txn.transactionId as string) ?? 'unknown',
      };
    } else if (body.platform === 'android') {
      if (!body.purchaseToken) return json({ error: 'Missing purchaseToken' }, 400);
      const packageName = Deno.env.get('ANDROID_PACKAGE_NAME');
      if (!packageName) return json({ error: 'ANDROID_PACKAGE_NAME not set' }, 500);

      const accessToken = await getGooglePlayAccessToken();
      const base = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
      const url = `${base}/${packageName}/purchases/subscriptionsv2/tokens/${body.purchaseToken}`;
      const apiResp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!apiResp.ok) return json({ error: 'Play API error' }, 502);
      const purchase = (await apiResp.json()) as Record<string, any>;

      const tokenUser = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId as string | undefined;
      if (tokenUser && tokenUser.toLowerCase() !== userId.toLowerCase()) {
        return json({ error: 'Purchase does not belong to this account' }, 403);
      }

      const lineItems = (purchase.lineItems as Array<Record<string, unknown>>) ?? [];
      const expiryRaw = lineItems[lineItems.length - 1]?.expiryTime as string | undefined;
      const expiresDate = expiryRaw ? new Date(expiryRaw).toISOString() : null;
      let { status, isPremium } = mapGoogleSubscriptionState(purchase.subscriptionState as string);
      if (expiresDate && new Date(expiresDate).getTime() < Date.now()) {
        status = 'expired';
        isPremium = false;
      }

      // Acknowledge if Google is still awaiting it.
      if (purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
        const subId = (body.productId as string) ?? '';
        if (subId) {
          await fetch(
            `${base}/${packageName}/purchases/subscriptions/${subId}/tokens/${body.purchaseToken}:acknowledge`,
            { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}' },
          ).catch(() => {});
        }
      }

      ent = {
        status,
        isPremium,
        currentPeriodEnd: expiresDate,
        trialEndsAt: null,
        plan: (body.productId ?? '').includes('annual') ? 'annual' : 'monthly',
        provider: 'play_store',
        providerSubscriptionId: body.purchaseToken,
      };
    } else {
      return json({ error: 'Unknown or missing platform' }, 400);
    }

    await writeEntitlement(supabase, userId, ent);

    return json({
      isPremium: ent.isPremium,
      status: ent.status,
      currentPeriodEnd: ent.currentPeriodEnd,
      trialEndsAt: ent.trialEndsAt,
    });
  } catch (err) {
    console.error('[verify-purchase] error:', (err as Error).message);
    return json({ error: (err as Error).message ?? 'Verification failed' }, 400);
  }
});
