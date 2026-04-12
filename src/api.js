import { extractYouTubeId } from './utils.js';

const SCHEMA = `{
  "titel": "string",
  "trainingsteil": "Aufwärmen|Hauptteil|Spielphase|null",
  "schwerpunkt": "Koordination|Passspiel|Dribbling|Abschluss|Taktik|Kondition|Spielform|Sonstiges|null",
  "tags": "string|null",
  "niveau": "U8|U10|U12|U14|U16|U19|Erwachsene|Alle|null",
  "dauer": "number|null",
  "spieleranzahl": "number|null",
  "aufstellungsform": "Kreis|Reihen gegenüber|Freie Verteilung|Linie|Viereck|null",
  "bewegungsstruktur": "Mit Ball|Ohne Ball|Passdreiecke|1v1|2v1|Rondo|Spielform|null",
  "intensitaet": "Niedrig|Mittel|Hoch|null",
  "raumgroesse": "string|null",
  "feldform": "Rechteck|Quadrat|Kreis|Freiform|null",
  "mitTor": "Ja|Nein|null",
  "materialSpieler": "string|null",
  "materialGruppe": "string|null",
  "bewertung": null,
  "notizen": "string|null"
}`;

const SYSTEM_PROMPT = `Du bist ein Fußball-Trainingsexperte. Analysiere YouTube-Trainingsvideos anhand ihrer URL, dem Vorschaubild und deines Fachwissens. Antworte NUR mit einem validen JSON-Objekt ohne Markdown-Formatierung. Unbekannte Felder setze auf null. Halte dich exakt an dieses Schema:\n${SCHEMA}`;

// Holt Video-Titel via YouTube oEmbed (CORS-frei)
async function fetchVideoTitle(youtubeUrl, log) {
  try {
    log('🔎 Hole Video-Titel via YouTube oEmbed...');
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    log(`📋 Titel gefunden: „${data.title}"`);
    return data.title || null;
  } catch (e) {
    log(`⚠️ Titel konnte nicht geladen werden: ${e.message}`);
    return null;
  }
}

// Holt Thumbnail: via Worker (Proxy-Modus) oder direkt (Desktop)
async function fetchThumbnail(videoId, proxyUrl, log) {
  try {
    log('🖼️ Lade Video-Thumbnail...');
    let base64, mediaType;

    if (proxyUrl) {
      const res = await fetch(`${proxyUrl.replace(/\/$/, '')}?thumb=${videoId}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      base64 = data.base64;
      mediaType = data.mediaType;
    } else {
      // Direkt von YouTube (funktioniert auf Desktop)
      const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const res = await fetch(thumbUrl);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      base64 = btoa(binary);
      mediaType = 'image/jpeg';
    }

    log('✅ Thumbnail geladen — wird an Claude übergeben');
    return { base64, mediaType };
  } catch (e) {
    log(`⚠️ Thumbnail konnte nicht geladen werden: ${e.message}`);
    return null;
  }
}

export async function analyzeVideo(youtubeUrl, apiKey, proxyUrl = '', log = () => {}) {
  const usingProxy = !!proxyUrl.trim();
  const videoId = extractYouTubeId(youtubeUrl);

  // Titel und Thumbnail parallel laden
  const [title, thumbnail] = await Promise.all([
    fetchVideoTitle(youtubeUrl, log),
    videoId ? fetchThumbnail(videoId, proxyUrl, log) : Promise.resolve(null),
  ]);

  // User-Message aufbauen
  const textContent = [
    title ? `Video-Titel: „${title}"` : '',
    `YouTube-URL: ${youtubeUrl}`,
    thumbnail ? 'Das Vorschaubild des Videos ist beigefügt.' : '',
    '\nAnalysiere dieses Fußball-Trainingsvideo und gib die Eigenschaften als JSON zurück.',
  ].filter(Boolean).join('\n');

  const userContent = thumbnail
    ? [
        { type: 'image', source: { type: 'base64', media_type: thumbnail.mediaType, data: thumbnail.base64 } },
        { type: 'text', text: textContent },
      ]
    : textContent;

  log('📡 Sende Anfrage an Claude...');
  log(`📝 Prompt:\n${textContent}`);

  const body = JSON.stringify({
    ...(usingProxy ? { apiKey } : {}),
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const endpoint = usingProxy ? proxyUrl.trim() : 'https://api.anthropic.com/v1/messages';
  const headers = usingProxy
    ? { 'Content-Type': 'text/plain' }
    : {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-calls': 'true',
      };

  let response;
  try {
    response = await fetch(endpoint, { method: 'POST', headers, body });
  } catch (networkErr) {
    const detail = networkErr?.message ? ` (${networkErr.message})` : '';
    throw new Error(usingProxy
      ? `Proxy-Verbindung fehlgeschlagen${detail}.\nWorker-URL: ${proxyUrl.trim()}`
      : `Direkte API-Verbindung fehlgeschlagen${detail}.\nTipp: Cloudflare Worker Proxy einrichten (⚙ Einstellungen).`
    );
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API-Fehler ${response.status}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text ?? '';
  log(`📥 Antwort erhalten:\n${text}`);

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('KI-Antwort konnte nicht verarbeitet werden.');
  }
}
