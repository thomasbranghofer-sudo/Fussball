import { extractYouTubeId } from './utils.js';

const SCHEMA = `{
  "titel": "string",
  "trainingsteil": "Aufwärmen|Hauptteil|Spielphase|null",
  "schwerpunkt": "Koordination|Passspiel|Dribbling|Abschluss|Taktik|Kondition|Spielform|Sonstiges|null",
  "tags": "string|null",
  "niveau": "U8|U10|U12|U14|U16|U19|Erwachsene|Alle|null",
  "dauer": "number|null",
  "anzahlSpieler": "number|null",
  "aufstellungsform": "Kreis|Reihen gegenüber|Freie Verteilung|Linie|Viereck|null",
  "bewegungsstruktur": "Mit Ball|Ohne Ball|Passdreiecke|1v1|2v1|Rondo|Spielform|null",
  "intensitaet": "Niedrig|Mittel|Hoch|null",
  "anzahlHuetchen": "number|null",
  "anzahlTore": "number|null",
  "sonstigeDetails": "string|null",
  "notizen": "string|null",
  "skizze": {
    "spieler": [{"x": "number 0-1", "y": "number 0-1", "team": "A|B|N"}],
    "pfeile":  [{"x1": "number 0-1", "y1": "number 0-1", "x2": "number 0-1", "y2": "number 0-1"}],
    "huetchen":[{"x": "number 0-1", "y": "number 0-1"}]
  }
}`;

const SYSTEM_PROMPT = `Du bist ein erfahrener Fußball-Trainer und Experte für Trainingsplanung. Analysiere Fußball-Trainingsvideos oder -bilder anhand von Titel, Beschreibung, Untertitel/Transkript und Screenshots und leite die Eigenschaften präzise ab.

Hinweise zur Analyse:
- titel: Kurzer, prägnanter Name der gezeigten Übung (max. 60 Zeichen, keine Kanal-/Videonamen)
- trainingsteil: Aufwärmen bei lockeren Koordinations-/Passspielen; Hauptteil bei intensiven Übungen; Spielphase bei freien Spielformen
- schwerpunkt: Den dominanten Trainingsfokus wählen – bei Spielformen meist "Spielform" oder "Taktik"
- tags: 3–6 kommagetrennte Schlagwörter, die die Übung beschreiben (z.B. "pressing, ballbesitz, 4v2, rondo")
- niveau: Aus Titel oder Beschreibung ableiten, sonst "Alle"
- dauer: Aus Beschreibung entnehmen oder aus Videostruktur schätzen (in Minuten)
- anzahlSpieler: Nur die aktiv spielenden Feldspieler zählen (nur Zahl, kein Text)
- aufstellungsform: Startaufstellung zu Beginn der Übung (z.B. "Kreis" bei Rondos, "Reihen gegenüber" bei Passstaffeln)
- bewegungsstruktur: Dominantes Muster – z.B. "Rondo" bei Ballbesitz im Kreis, "1v1" bei Zweikämpfen, "Spielform" bei freiem Spiel
- intensitaet: Niedrig = Passspiele/Koordination; Mittel = Positionsspiele; Hoch = Pressing/Kondition/Zweikämpfe
- anzahlHuetchen: Geschätzte Anzahl Hütchen im Einsatz (nur Zahl, null wenn keine erkennbar)
- anzahlTore: Anzahl regulärer Tore (nur große Tore zählen, keine Minitore, null wenn keine)
- sonstigeDetails: Alle weiteren relevanten Infos die nicht in andere Felder passen – z.B. Feldgröße, Taktikhinweise, Besonderheiten der Übung, verwendetes Material außer Hütchen/Tore
- notizen: Coaching-Hinweise, Varianten und Fehlerbilder aus Beschreibung oder Untertiteln
- skizze: Schematische Draufsicht der Übung als Koordinaten-Objekt:
    • spieler: Positionen aller Spieler. x/y = 0..1 (0,0 = oben-links, 1,1 = unten-rechts, Mitte = 0.5/0.5).
      team: "A" = angreifende/ballführende Gruppe (blau), "B" = verteidigende Gruppe (rot), "N" = neutral.
    • pfeile: Bewegungsrichtungen (Laufwege, Passpfade). Zeigen wohin sich Spieler oder der Ball bewegen.
    • huetchen: Hütchen-Positionen als Feldmarkierungen.
    Wichtig: Nutze den gesamten Feldbereich sinnvoll. Bei Rondos: Spieler im Kreis um Mitte. Bei Spielformen: Spieler auf beiden Hälften verteilen. Hütchen als Eckpunkte des Übungsfelds.
    null nur wenn kein sinnvolles Layout möglich.

Antworte NUR mit einem validen JSON-Objekt ohne Markdown-Formatierung. Setze unbekannte Felder auf null. Schema:\n${SCHEMA}`;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchVideoTitle(youtubeUrl, log) {
  try {
    log('🔎 Hole Video-Titel via YouTube oEmbed...');
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    log(`📋 Titel: „${data.title}"`);
    return data.title || null;
  } catch (e) {
    log(`⚠️ Titel nicht verfügbar: ${e.message}`);
    return null;
  }
}

async function toBase64Direct(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function fetchVideoPageInfo(videoId, proxyUrl, log) {
  if (!proxyUrl) return { description: null, transcript: null };
  try {
    log('📄 Lade Beschreibung + Untertitel...');
    const res = await fetch(`${proxyUrl.replace(/\/$/, '')}?pageinfo=${videoId}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.description) {
      const preview = data.description.substring(0, 80).replace(/\n/g, ' ');
      log(`📄 Beschreibung: „${preview}${data.description.length > 80 ? '…' : ''}"`);
    } else {
      log('ℹ️ Keine Beschreibung gefunden');
    }
    if (data.transcript) {
      const words = data.transcript.split(' ').length;
      log(`🎙️ Untertitel (${data.transcriptLang ?? '?'}): ${words} Wörter`);
    } else {
      log('ℹ️ Keine Untertitel verfügbar');
    }
    return {
      description: data.description || null,
      transcript: data.transcript
        ? data.transcript.substring(0, 2500) + (data.transcript.length > 2500 ? ' […]' : '')
        : null,
    };
  } catch (e) {
    log(`⚠️ Seiteninfo nicht verfügbar: ${e.message}`);
    return { description: null, transcript: null };
  }
}

async function fetchFrames(videoId, proxyUrl, log) {
  log('🖼️ Lade Video-Frames (Anfang, 25%, 50%, 75%)...');
  try {
    if (proxyUrl) {
      const res = await fetch(`${proxyUrl.replace(/\/$/, '')}?frames=${videoId}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      log(`✅ ${data.frames.length} Frame(s) über Proxy geladen`);
      return data.frames;
    } else {
      const urls = [
        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        `https://img.youtube.com/vi/${videoId}/1.jpg`,
        `https://img.youtube.com/vi/${videoId}/2.jpg`,
        `https://img.youtube.com/vi/${videoId}/3.jpg`,
      ];
      const results = await Promise.all(
        urls.map(async (url, i) => {
          let base64 = await toBase64Direct(url).catch(() => null);
          if (!base64 && i === 0) {
            base64 = await toBase64Direct(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`).catch(() => null);
          }
          return base64 ? { base64, mediaType: 'image/jpeg', index: i } : null;
        })
      );
      const frames = results.filter(Boolean);
      log(`✅ ${frames.length} Frame(s) direkt geladen`);
      return frames;
    }
  } catch (e) {
    log(`⚠️ Frames konnten nicht geladen werden: ${e.message}`);
    return [];
  }
}

// Resize an image File to max 1280px and return base64 JPEG
function resizeImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.88).split(',')[1]);
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

// Shared Claude API call
async function sendToClaude(userContent, apiKey, proxyUrl, log) {
  const usingProxy = !!proxyUrl.trim();
  log('📡 Sende Anfrage an Claude...');

  const body = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
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

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeVideo(youtubeUrl, apiKey, proxyUrl = '', log = () => {}) {
  const videoId = extractYouTubeId(youtubeUrl);

  const [title, pageInfo, frames] = await Promise.all([
    fetchVideoTitle(youtubeUrl, log),
    videoId ? fetchVideoPageInfo(videoId, proxyUrl, log) : Promise.resolve({ description: null, transcript: null }),
    videoId ? fetchFrames(videoId, proxyUrl, log) : Promise.resolve([]),
  ]);

  const { description, transcript } = pageInfo;
  const descTrimmed = description
    ? description.substring(0, 800) + (description.length > 800 ? '\n[…gekürzt]' : '')
    : null;

  const labels = ['Anfang', '25%', '50%', '75%'];
  const textContent = [
    title ? `Video-Titel: „${title}"` : '',
    descTrimmed ? `Video-Beschreibung:\n${descTrimmed}` : '',
    transcript ? `Gesprochener Inhalt (Auto-Untertitel):\n${transcript}` : '',
    `YouTube-URL: ${youtubeUrl}`,
    frames.length > 0
      ? `Es wurden ${frames.length} Screenshots beigefügt: ${frames.map(f => labels[f.index] ?? `Frame ${f.index}`).join(', ')}.`
      : 'Keine Screenshots verfügbar.',
    '\nAnalysiere dieses Fußball-Trainingsvideo und gib die Eigenschaften als JSON zurück.',
  ].filter(Boolean).join('\n');

  const imageBlocks = frames.map((f) => ({
    type: 'image',
    source: { type: 'base64', media_type: f.mediaType, data: f.base64 },
  }));

  const userContent = frames.length > 0
    ? [...imageBlocks, { type: 'text', text: textContent }]
    : textContent;

  log(`📝 Kontext:\n${textContent}`);
  return sendToClaude(userContent, apiKey, proxyUrl, log);
}

export async function analyzeImages(imageFiles, context, apiKey, proxyUrl = '', log = () => {}) {
  log(`🖼️ Verarbeite ${imageFiles.length} Bild(er)...`);

  const imageBlocks = await Promise.all(
    imageFiles.map(async (file, i) => {
      const base64 = await resizeImageToBase64(file);
      log(`✅ Bild ${i + 1}: ${file.name} (${Math.round(file.size / 1024)} KB)`);
      return {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
      };
    })
  );

  const textParts = [
    context?.trim() ? `Kontext / Hinweise: ${context.trim()}` : '',
    `Es wurden ${imageFiles.length} Bild(er) zur Analyse hochgeladen.`,
    'Analysiere diese Fußball-Trainingsbilder und gib die Eigenschaften als JSON zurück.',
  ].filter(Boolean).join('\n');

  log(`📝 Kontext:\n${textParts}`);
  return sendToClaude([...imageBlocks, { type: 'text', text: textParts }], apiKey, proxyUrl, log);
}

export async function saveToSheet(youtubeUrl, fields, proxyUrl) {
  const endpoint = `${proxyUrl.replace(/\/$/, '')}?save=1`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ url: youtubeUrl, ...fields }),
  });
  if (!res.ok) throw new Error(`HTTP-Fehler ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || data.error);
  if (!data.success) throw new Error(data.error || 'Unbekannter Fehler');
  return data.row;
}
