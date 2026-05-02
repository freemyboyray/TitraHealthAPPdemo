import { verifyAuth, CORS } from '../_shared/auth.ts';
import { checkUsageLimit } from '../_shared/usage-limit.ts';
import type { FeatureKey } from '../_shared/usage-limit.ts';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ALLOWED_MODELS = ['gpt-4o-mini'];
const MAX_TOKENS_CAP = 2000;
const MAX_PAYLOAD_BYTES = 50_000;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // Verify caller is authenticated
    const auth = await verifyAuth(req);
    if (auth instanceof Response) return auth;

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    // Validate messages array structure
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    const ALLOWED_ROLES = ['system', 'user', 'assistant'];
    const systemCount = body.messages.filter((m: { role: string }) => m.role === 'system').length;
    if (systemCount > 1) {
      return new Response(JSON.stringify({ error: 'Multiple system messages not allowed' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    for (const msg of body.messages) {
      if (!msg.role || !ALLOWED_ROLES.includes(msg.role)) {
        return new Response(JSON.stringify({ error: 'Invalid message role' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    // Determine feature key for usage tracking. Prefer client-supplied feature
    // (allowlisted), fall back to "image present? → photo_analysis, else ai_chat".
    // voice_log is owned by whisper-proxy and not selectable here.
    const CLIENT_SELECTABLE: FeatureKey[] = ['ai_chat', 'photo_analysis', 'food_parse'];
    const requestedFeature = typeof body.feature === 'string' ? body.feature : undefined;
    const featureKey: FeatureKey =
      requestedFeature && CLIENT_SELECTABLE.includes(requestedFeature as FeatureKey)
        ? (requestedFeature as FeatureKey)
        : hasVisionContent(body)
          ? 'photo_analysis'
          : 'ai_chat';

    // Strip our internal field before forwarding to OpenAI.
    delete body.feature;

    // Check usage limit for non-premium users
    const limitResponse = await checkUsageLimit(auth.userId, featureKey);
    if (limitResponse) return limitResponse;

    // Enforce model whitelist
    if (!ALLOWED_MODELS.includes(body.model)) {
      body.model = 'gpt-4o-mini';
    }

    // Cap max_tokens
    if (typeof body.max_tokens === 'number') {
      body.max_tokens = Math.min(body.max_tokens, MAX_TOKENS_CAP);
    }

    const payload = JSON.stringify(body);

    // Reject oversized payloads
    if (payload.length > MAX_PAYLOAD_BYTES) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
    });

    const data = await res.text();

    if (!res.ok) {
      console.error('[openai-proxy] OpenAI error:', res.status);
      return new Response(JSON.stringify({
        openai_error: true,
        openai_status: res.status,
      }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(data, {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[openai-proxy] Internal error:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});

/** Detect if the request includes an image (vision API call = photo_analysis) */
function hasVisionContent(body: Record<string, unknown>): boolean {
  const messages = body.messages as Array<{ content: unknown }> | undefined;
  if (!messages) return false;
  return messages.some((msg) => {
    if (Array.isArray(msg.content)) {
      return msg.content.some(
        (part: Record<string, unknown>) => part.type === 'image_url',
      );
    }
    return false;
  });
}
