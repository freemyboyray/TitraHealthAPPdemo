import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAuth, CORS } from '../_shared/auth.ts';
import { checkUsageLimit, refundUsage } from '../_shared/usage-limit.ts';
import type { FeatureKey } from '../_shared/usage-limit.ts';

// TEMP debug: record OpenAI 502 failures to a table so production failures are
// queryable (the log API only surfaces request lines, not console output).
// Remove this + the openai_error_log table once the camera-scan issue is fixed.
async function logOpenAiError(row: Record<string, unknown>): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    await supabase.from('openai_error_log').insert(row);
  } catch { /* best-effort — never let logging break the response */ }
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ALLOWED_MODELS = ['gpt-4o-mini'];
const MAX_TOKENS_CAP = 2000;
// Text-only chat/parse requests are tiny; keep them tightly capped. Vision
// requests carry a base64-encoded image and are legitimately much larger
// (OpenAI itself accepts base64 images up to 20 MB).
const MAX_TEXT_PAYLOAD_BYTES = 50_000;
const MAX_VISION_PAYLOAD_BYTES = 10_000_000;

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

    // Determine feature key server-side only — never trust client-supplied feature.
    // This prevents abuse where a client sends feature:'food_parse' (30/day) to
    // bypass the ai_chat limit (5/day).
    const isVision = hasVisionContent(body);
    const isJsonMode = body.response_format?.type === 'json_object';
    const featureKey: FeatureKey = isVision
      ? 'photo_analysis'
      : isJsonMode
        ? 'food_parse'
        : 'ai_chat';

    // Build a sanitized body with only allowed fields — prevents abuse via
    // parameters like n (multiple completions), tools, functions, or stream.
    const sanitized: Record<string, unknown> = {
      model: ALLOWED_MODELS.includes(body.model) ? body.model : 'gpt-4o-mini',
      messages: body.messages,
      max_tokens: typeof body.max_tokens === 'number'
        ? Math.min(body.max_tokens, MAX_TOKENS_CAP) : MAX_TOKENS_CAP,
      temperature: typeof body.temperature === 'number'
        ? Math.min(Math.max(body.temperature, 0), 2) : 0.7,
      n: 1, // Always force single completion
    };
    // Only allow response_format if provided (used for JSON mode)
    if (body.response_format && typeof body.response_format === 'object') {
      sanitized.response_format = body.response_format;
    }

    const payload = JSON.stringify(sanitized);

    // Reject oversized payloads — vision requests get a much larger allowance
    // since they carry a base64 image.
    const maxBytes = isVision ? MAX_VISION_PAYLOAD_BYTES : MAX_TEXT_PAYLOAD_BYTES;
    if (payload.length > maxBytes) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Check + charge usage only once the request is valid and about to hit
    // OpenAI. Charging earlier would burn a daily credit on requests that fail
    // local validation (e.g. oversized payload). The charge is refunded below
    // if OpenAI itself errors, so users are only ever charged for a call that
    // actually reached the model.
    const limitResponse = await checkUsageLimit(auth.userId, featureKey);
    if (limitResponse) return limitResponse;

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
      // Surface OpenAI's actual error reason instead of swallowing it. The body
      // is OpenAI's error JSON (e.g. {error:{message,type,code}}) — safe to relay,
      // it never contains the API key. `data` is already the response text.
      let openaiMessage = data.slice(0, 800);
      try {
        const parsed = JSON.parse(data);
        if (parsed?.error?.message) openaiMessage = parsed.error.message;
      } catch { /* non-JSON error body — keep the raw slice */ }
      console.error(`[openai-proxy] OpenAI error ${res.status} (vision=${isVision}):`, openaiMessage);
      // The model never produced a result — refund the credit charged above so a
      // failed analysis (e.g. a 502) doesn't count against the daily limit.
      await refundUsage(auth.userId, featureKey);
      await logOpenAiError({
        user_id: auth.userId,
        is_vision: isVision,
        json_mode: isJsonMode,
        openai_status: res.status,
        openai_message: openaiMessage,
        image_prefix: isVision ? visionImagePrefix(body) : null,
      });
      return new Response(JSON.stringify({
        openai_error: true,
        openai_status: res.status,
        openai_message: openaiMessage,
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

/** TEMP debug: first ~48 chars of the image data URL — reveals declared mime +
 *  base64 magic bytes (so we can see the REAL format the device sent). */
function visionImagePrefix(body: Record<string, unknown>): string | null {
  const messages = body.messages as Array<{ content: unknown }> | undefined;
  if (!messages) return null;
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content as Record<string, any>[]) {
      const url = part?.image_url?.url;
      if (typeof url === 'string') return url.slice(0, 48);
    }
  }
  return null;
}

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
