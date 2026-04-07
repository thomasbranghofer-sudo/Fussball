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

export async function analyzeVideo(youtubeUrl, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-calls': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `Du bist ein Fußball-Trainingsexperte. Analysiere YouTube-Trainingsvideos anhand ihrer URL und deines Fachwissens. Antworte NUR mit einem validen JSON-Objekt ohne Markdown-Formatierung. Unbekannte Felder setze auf null. Halte dich exakt an dieses Schema:\n${SCHEMA}`,
      messages: [
        {
          role: 'user',
          content: `Analysiere dieses Fußball-Trainingsvideo und gib die Eigenschaften als JSON zurück:\n${youtubeUrl}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API-Fehler ${response.status}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text ?? '';

  // Strip potential markdown code fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('KI-Antwort konnte nicht verarbeitet werden.');
  }
}
