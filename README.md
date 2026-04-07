# Trainings-Video Analyzer ⚽

Eine Single-Page-Webanwendung, die YouTube-Links von Fußball-Trainingsvideos per KI automatisch analysiert und die Übungseigenschaften als strukturierte Daten ausfüllt. Die Ergebnisse können als Tab-getrennte Zeile direkt in eine Excel-Datenbank eingefügt werden.

## Was die App macht

1. Du gibst einen YouTube-Link eines Fußball-Trainingsvideos ein
2. Die KI (Claude von Anthropic) analysiert das Video und füllt 17 Felder aus:
   - Titel, Trainingsteil, Schwerpunkt, Tags, Alter/Niveau, Dauer, Spieleranzahl
   - Aufstellungsform, Bewegungsstruktur, Intensität, Raumgröße, Feldform
   - Mit Tor?, Material, Bewertung, Notizen
3. Du kannst die Felder manuell korrigieren
4. Mit einem Klick kopierst du alle Daten als Tab-getrennte Zeile und fügst sie in Excel ein

## Anthropic API-Key

Du benötigst einen persönlichen API-Key von Anthropic:

1. Gehe zu [console.anthropic.com](https://console.anthropic.com)
2. Erstelle ein Konto oder melde dich an
3. Navigiere zu **API Keys** und erstelle einen neuen Key
4. Kopiere den Key (beginnt mit `sk-ant-api03-...`)
5. Füge ihn in das gelbe Eingabefeld der App ein

## Lokale Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten (http://localhost:5173)
npm run dev

# Produktions-Build erstellen
npm run build
```

## GitHub Pages Deployment

Das Deployment auf GitHub Pages erfolgt automatisch über GitHub Actions:

- Bei jedem Push auf den `main`-Branch wird die App automatisch gebaut und deployed
- Der Build-Output (`dist/`) wird auf den `gh-pages`-Branch gepusht
- Die App ist dann unter `https://<username>.github.io/<repo-name>/` erreichbar

**Einmalige Einrichtung in den Repository-Einstellungen:**
- Settings → Pages → Source: `Deploy from a branch` → Branch: `gh-pages` / `/ (root)`

## Datenschutz

- Der Anthropic API-Key wird **ausschließlich lokal im Browser-State** gespeichert
- Er wird **nicht** in LocalStorage, Cookies oder anderswo gespeichert
- Er wird **nicht** an Dritte weitergegeben — nur direkt an die Anthropic API
- Nach dem Schließen des Browser-Tabs ist der Key weg

## Tech Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) (JSX)
- Reines Inline-Styling, kein CSS-Framework
- [Anthropic Claude API](https://docs.anthropic.com/) (direkt vom Browser)
- Kein Backend erforderlich
