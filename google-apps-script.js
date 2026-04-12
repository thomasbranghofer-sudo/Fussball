/**
 * Google Apps Script – Trainings-Video Analyzer Sheet Writer
 *
 * Setup:
 * 1. Google Sheet öffnen → Erweiterungen → Apps Script
 * 2. Diesen Code einfügen (alten Code ersetzen)
 * 3. Speichern → Deployen → Neue Bereitstellung
 *    - Typ: Web-App
 *    - Ausführen als: Ich (dein Google-Konto)
 *    - Zugriff: Jeder
 * 4. URL der Web-App kopieren
 * 5. In Cloudflare Worker Settings als Secret hinterlegen:
 *    Name: GOOGLE_SHEET_URL  Value: <die kopierte URL>
 * 6. Worker-Code neu deployen
 */

// Spalten-Mapping: Feldname → Spaltennummer (A=1, B=2, ...)
const COL = {
  url:              2,  // B
  titel:            3,  // C
  trainingsteil:    4,  // D
  schwerpunkt:      5,  // E
  tags:             6,  // F
  niveau:           7,  // G
  dauer:            8,  // H
  anzahlSpieler:    9,  // I
  aufstellungsform: 12, // L
  bewegungsstruktur:13, // M
  intensitaet:      14, // N
  anzahlHuetchen:   15, // O
  anzahlTore:       16, // P
  sonstigeDetails:  17, // Q
  notizen:          22, // V
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Nächste freie Zeile (min. Zeile 2, damit Kopfzeile erhalten bleibt)
    const nextRow = Math.max(sheet.getLastRow() + 1, 2);

    for (const [key, col] of Object.entries(COL)) {
      const val = data[key];
      if (val !== null && val !== undefined && val !== '') {
        sheet.getRange(nextRow, col).setValue(val);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, row: nextRow }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
