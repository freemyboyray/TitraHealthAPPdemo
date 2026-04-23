const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN');
if (!allowedOrigin) {
  throw new Error('ALLOWED_ORIGIN environment variable is required but not set');
}

const CORS = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const FS_BASE = 'https://platform.fatsecret.com/rest/server.api';
const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';

async function getToken(): Promise<string> {
  const clientId = Deno.env.get('FATSECRET_CLIENT_ID')!;
  const clientSecret = Deno.env.get('FATSECRET_CLIENT_SECRET')!;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'basic',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token fetch failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.access_token as string;
}

async function callFS(token: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(FS_BASE);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FatSecret API error: ${res.status} ${text}`);
  }

  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  // Auth check — verify Supabase JWT from Authorization header
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[fatsecret-proxy] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseServiceKey,
    },
  });
  if (!verifyRes.ok) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const token = await getToken();

    let data: unknown;

    if (action === 'search') {
      const q = url.searchParams.get('q') ?? '';
      data = await callFS(token, {
        method: 'foods.search',
        search_expression: q,
        max_results: '20',
        page_number: '0',
      });
    } else if (action === 'food') {
      const id = url.searchParams.get('id') ?? '';
      data = await callFS(token, {
        method: 'food.get.v4',
        food_id: id,
      });
    } else if (action === 'barcode') {
      const code = url.searchParams.get('code') ?? '';
      const barcodeRes = (await callFS(token, {
        method: 'food.find_id_for_barcode',
        barcode: code,
      })) as { food_id?: { value: string } };

      const foodId = barcodeRes?.food_id?.value;
      if (!foodId) {
        return new Response(JSON.stringify({ error: 'not_found' }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      data = await callFS(token, {
        method: 'food.get.v4',
        food_id: foodId,
      });
    } else {
      return new Response(JSON.stringify({ error: 'unknown action' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[fatsecret-proxy] Error:', message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
