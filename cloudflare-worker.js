/**
 * Cloudflare Worker – Anthropic API Proxy + YouTube Frame Proxy + Google Sheet Writer
 *
 * Secrets (Workers & Pages → Settings → Variables and Secrets):
 *   ANTHROPIC_API_KEY  → Anthropic API Key
 *   GOOGLE_SHEET_URL   → Google Apps Script Web-App URL
 *
 * Endpoints:
 *   POST /            → Leitet Anfrage an Anthropic API weiter
 *   POST /?save=1     → Speichert Zeile in Google Sheet
 *   GET /?pageinfo=ID → Gibt Beschreibung + Untertitel zurück (1 YouTube-Seitenaufruf)
 *   GET /?frames=ID   → Gibt alle 4 YouTube-Frames als base64 JSON-Array zurück
 *   GET /             → Statuscheck
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function toBase64(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    // ── GET /?pageinfo=VIDEO_ID → Beschreibung + Untertitel (1 Seitenaufruf) ─
    if (request.method === 'GET') {
      const pageId = url.searchParams.get('pageinfo');
      if (pageId) {
        try {
          const pageRes = await fetch(`https://www.youtube.com/watch?v=${pageId}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
              'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
            },
          });
          const html = await pageRes.text();

          // --- Beschreibung aus ytInitialPlayerResponse ---
          let description = null;
          const descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
          if (descMatch) {
            description = descMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, ' ')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')
              .trim();
          }

          // --- Untertitel/Transcript ---
          let transcript = null;
          let transcriptLang = null;
          const trackRegex = /"baseUrl":"(https:[^"]*timedtext[^"]*)","vssId":"[^"]*","languageCode":"([^"]+)"/g;
          const tracks = [];
          let m;
          while ((m = trackRegex.exec(html)) !== null) {
            tracks.push({
              url: m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'),
              lang: m[2],
            });
          }

          if (tracks.length > 0) {
            // Bevorzuge: de → de-* → en → en-* → erste verfügbare
            const track =
              tracks.find(t => t.lang === 'de') ||
              tracks.find(t => t.lang.startsWith('de')) ||
              tracks.find(t => t.lang === 'en') ||
              tracks.find(t => t.lang.startsWith('en')) ||
              tracks[0];
            try {
              const tRes = await fetch(track.url + '&fmt=json3');
              if (tRes.ok) {
                const tData = await tRes.json();
                if (tData.events) {
                  transcript = tData.events
                    .filter(e => e.segs)
                    .map(e => e.segs.map(s => (s.utf8 || '').replace(/\n/g, ' ')).join(''))
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                  transcriptLang = track.lang;
                }
              }
            } catch (_) { /* Transcript optional */ }
          }

          return json({ description, transcript, transcriptLang });
        } catch (e) {
          return json({ description: null, transcript: null, error: e.message });
        }
      }
    }

    // ── GET /?frames=VIDEO_ID → alle 4 Frames als base64 ────────────────────
    if (request.method === 'GET') {
      const videoId = url.searchParams.get('frames');
      if (videoId) {
        // YouTube stellt Frames bei 0%, 25%, 50%, 75% bereit
        const frameUrls = [
          `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          `https://img.youtube.com/vi/${videoId}/1.jpg`,
          `https://img.youtube.com/vi/${videoId}/2.jpg`,
          `https://img.youtube.com/vi/${videoId}/3.jpg`,
        ];

        const results = await Promise.all(
          frameUrls.map(async (frameUrl, i) => {
            let base64 = await toBase64(frameUrl);
            // Fallback für Frame 0: hqdefault wenn maxresdefault fehlt
            if (!base64 && i === 0) base64 = await toBase64(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
            return base64 ? { base64, mediaType: 'image/jpeg', index: i } : null;
          })
        );

        const frames = results.filter(Boolean);
        if (frames.length === 0) return json({ error: 'Keine Frames gefunden' }, 404);
        return json({ frames });
      }

      return new Response('Anthropic Proxy aktiv ✓', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...CORS },
      });
    }

    // ── POST /?save=1 → Google Sheet Writer ──────────────────────────────────
    if (request.method === 'POST' && url.searchParams.get('save') === '1') {
      const sheetUrl = env.GOOGLE_SHEET_URL;
      if (!sheetUrl) return json({ error: { message: 'GOOGLE_SHEET_URL ist nicht als Worker-Secret konfiguriert.' } }, 500);
      const body = await request.text();
      const res = await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    // ── POST / → Anthropic API Proxy ─────────────────────────────────────────
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return json({ error: { message: 'ANTHROPIC_API_KEY ist nicht als Worker-Secret konfiguriert.' } }, 500);
    }

    let payload;
    try {
      payload = JSON.parse(await request.text());
    } catch {
      return json({ error: { message: 'Ungültiges JSON im Request-Body' } }, 400);
    }

    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  },
};
