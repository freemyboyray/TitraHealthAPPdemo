import { verifyAuth, CORS } from '../_shared/auth.ts';

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
