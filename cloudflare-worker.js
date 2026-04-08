/**
 * Cloudflare Worker – Anthropic API Proxy (no-preflight mode)
 *
 * Deployment:
 * 1. cloudflare.com → Workers & Pages → Create Application → Start with Hello World
 * 2. Diesen Code einfügen → Deploy
 * 3. Die Worker-URL in der App unter ⚙ Proxy-Einstellungen eintragen
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'GET') {
      return new Response('Anthropic Proxy aktiv', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...CORS_HEADERS },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let bodyText;
    try {
      bodyText = await request.text();
    } catch {
      return new Response(JSON.stringify({ error: { message: 'Body konnte nicht gelesen werden' } }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response(JSON.stringify({ error: { message: 'Ungültiges JSON' } }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const { apiKey, ...anthropicParams } = payload;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: 'apiKey fehlt im Request-Body' } }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicParams),
    });

    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  },
};
