/**
 * Cloudflare Worker – Anthropic API Proxy + YouTube Thumbnail Proxy
 *
 * Endpoints:
 *   POST /          → Leitet Anfrage an Anthropic API weiter
 *   GET /?thumb=ID  → Gibt YouTube-Thumbnail als base64 JSON zurück
 *   GET /           → Statuscheck
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ── GET /?thumb=VIDEO_ID → Thumbnail als base64 ──────────────────────────
    if (request.method === 'GET') {
      const videoId = url.searchParams.get('thumb');
      if (videoId) {
        // maxresdefault zuerst, dann hqdefault als Fallback
        for (const quality of ['maxresdefault', 'hqdefault']) {
          const thumbUrl = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
          const res = await fetch(thumbUrl);
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            return json({ base64, mediaType: 'image/jpeg', quality });
          }
        }
        return json({ error: 'Thumbnail nicht gefunden' }, 404);
      }
      return new Response('Anthropic Proxy aktiv ✓', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...CORS_HEADERS },
      });
    }

    // ── POST / → Anthropic API Proxy ─────────────────────────────────────────
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let payload;
    try {
      const bodyText = await request.text();
      payload = JSON.parse(bodyText);
    } catch {
      return json({ error: { message: 'Ungültiges JSON im Request-Body' } }, 400);
    }

    const { apiKey, ...anthropicParams } = payload;
    if (!apiKey) {
      return json({ error: { message: 'apiKey fehlt im Request-Body' } }, 400);
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
