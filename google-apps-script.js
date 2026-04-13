/**
 * Google Apps Script – Trainings-Video Analyzer Sheet Writer + Drive Uploader
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
 *
 * Bilder/Skizzen werden im Google Drive-Ordner „Trainingsskizzen" abgelegt.
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
  skizzeLink:       18, // R
  bilderLinks:      19, // S
  notizen:          22, // V
};

// ── Drive-Upload ──────────────────────────────────────────────────────────────

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function uploadBase64(folder, base64, mimeType, filename) {
  const bytes = Utilities.base64Decode(base64);
  const blob  = Utilities.newBlob(bytes, mimeType, filename);
  const file  = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

// ── doPost ────────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const data    = JSON.parse(e.postData.contents);
    const sheet   = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const nextRow = Math.max(sheet.getLastRow() + 1, 2);
    const stamp   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    // Skizze hochladen
    if (data.skizzeBase64) {
      try {
        const folder = getOrCreateFolder('Trainingsskizzen');
        data.skizzeLink = uploadBase64(folder, data.skizzeBase64, 'image/png', `Skizze_${stamp}.png`);
      } catch (err) {
        Logger.log('Drive-Upload Skizze fehlgeschlagen: ' + err.message);
      }
    }

    // Bilder hochladen
    if (Array.isArray(data.bilderBase64) && data.bilderBase64.length > 0) {
      try {
        const folder = getOrCreateFolder('Trainingsskizzen');
        const links  = data.bilderBase64.map((b64, i) =>
          uploadBase64(folder, b64, 'image/jpeg', `Bild_${stamp}_${i + 1}.jpg`)
        );
        data.bilderLinks = links.join('\n');
      } catch (err) {
        Logger.log('Drive-Upload Bilder fehlgeschlagen: ' + err.message);
      }
    }

    // Felder in Sheet schreiben
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
