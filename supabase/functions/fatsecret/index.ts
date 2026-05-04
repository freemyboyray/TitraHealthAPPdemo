import { verifyAuth, CORS } from '../_shared/auth.ts';

const FS_BASE = 'https://platform.fatsecret.com/rest/server.api';
const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const MAX_QUERY_LENGTH = 200;
const MAX_ID_LENGTH = 20;
const MAX_BARCODE_LENGTH = 30;
const MAX_RECIPE_QUERY_LENGTH = 200;
const MAX_RECIPE_ID_LENGTH = 20;
const VALID_ACTIONS = ['search', 'food', 'barcode', 'autocomplete', 'recipe_search', 'recipe_get', 'food_categories'];

async function requestToken(scope: string, clientId: string, clientSecret: string): Promise<Response> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope,
    client_id: clientId,
    client_secret: clientSecret,
  });
  return fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

async function getToken(): Promise<{ token: string; tier: 'premier' | 'basic' }> {
  const clientId = Deno.env.get('FATSECRET_CLIENT_ID')!;
  const clientSecret = Deno.env.get('FATSECRET_CLIENT_SECRET')!;

  // Premier scope unlocks food_attributes (allergens), food_images, and richer
  // food.get.v4 responses, plus the autocomplete/recipe endpoints. `barcode` is
  // required for find_id_for_barcode. If Premier isn't activated yet, fall
  // back to basic so existing flows stay alive.
  const premierRes = await requestToken('premier basic barcode', clientId, clientSecret);
  if (premierRes.ok) {
    const json = await premierRes.json();
    return { token: json.access_token as string, tier: 'premier' };
  }

  console.warn(`[fatsecret] Premier token request failed (${premierRes.status}); falling back to basic`);
  const basicRes = await requestToken('basic barcode', clientId, clientSecret);
  if (!basicRes.ok) {
    console.error(`[fatsecret] Basic token request also failed: ${basicRes.status}`);
    throw new Error('Token fetch failed');
  }
  const json = await basicRes.json();
  return { token: json.access_token as string, tier: 'basic' };
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
    console.error(`[fatsecret] API error: ${res.status}`);
    throw new Error('FatSecret API error');
  }

  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // Verify caller is authenticated
    const auth = await verifyAuth(req);
    if (auth instanceof Response) return auth;

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Validate action
    if (!action || !VALID_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { token, tier } = await getToken();

    // Premier-only flags add allergen/image/default-serving data to food.get.v4
    // responses. Omitted on basic to avoid 400s on fields the account isn't
    // entitled to.
    const premierFlags: Record<string, string> = tier === 'premier' ? {
      include_food_attributes: 'true',
      include_food_images: 'true',
      flag_default_serving: 'true',
    } : {};

    let data: unknown;

    if (action === 'search') {
      const q = (url.searchParams.get('q') ?? '').slice(0, MAX_QUERY_LENGTH);
      if (!q) {
        return new Response(JSON.stringify({ error: 'Missing search query' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      data = await callFS(token, {
        method: 'foods.search',
        search_expression: q,
        max_results: '20',
        page_number: '0',
      });
    } else if (action === 'food') {
      const id = (url.searchParams.get('id') ?? '').slice(0, MAX_ID_LENGTH);
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing food id' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      data = await callFS(token, {
        method: 'food.get.v4',
        food_id: id,
        ...premierFlags,
      });
    } else if (action === 'barcode') {
      const code = (url.searchParams.get('code') ?? '').slice(0, MAX_BARCODE_LENGTH);
      if (!code) {
        return new Response(JSON.stringify({ error: 'Missing barcode' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      const barcodeRes = await callFS(token, {
        method: 'food.find_id_for_barcode',
        barcode: code,
      }) as { food_id?: { value: string } };

      const foodId = barcodeRes?.food_id?.value;
      if (!foodId) {
        return new Response(JSON.stringify({ error: 'not_found' }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      data = await callFS(token, {
        method: 'food.get.v4',
        food_id: foodId,
        ...premierFlags,
      });
    } else if (action === 'autocomplete') {
      const q = (url.searchParams.get('q') ?? '').slice(0, MAX_QUERY_LENGTH);
      if (!q) {
        return new Response(JSON.stringify({ error: 'Missing search query' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      data = await callFS(token, {
        method: 'foods.autocomplete',
        expression: q,
        max_results: '8',
      });
    } else if (action === 'recipe_search') {
      const q = (url.searchParams.get('q') ?? '').slice(0, MAX_RECIPE_QUERY_LENGTH);
      if (!q) {
        return new Response(JSON.stringify({ error: 'Missing recipe search query' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      data = await callFS(token, {
        method: 'recipes.search',
        search_expression: q,
        max_results: '10',
        page_number: '0',
      });
    } else if (action === 'recipe_get') {
      const id = (url.searchParams.get('id') ?? '').slice(0, MAX_RECIPE_ID_LENGTH);
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing recipe id' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      data = await callFS(token, {
        method: 'recipe.get.v2',
        recipe_id: id,
      });
    } else if (action === 'food_categories') {
      data = await callFS(token, {
        method: 'food_categories.get',
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[fatsecret] Error:', (err as Error).message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
