import React, { useState, useCallback, useRef } from 'react';
import { FIELDS } from './fields.js';
import { analyzeVideo, saveToSheet } from './api.js';
import { extractYouTubeId } from './utils.js';

// ── Styles ──────────────────────────────────────────────────────────────────

const S = {
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #060f1e 0%, #0c1f3d 100%)',
    padding: '0 0 60px',
  },
  header: {
    textAlign: 'center',
    padding: '40px 20px 28px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  logo: { fontSize: 48, lineHeight: 1 },
  title: { fontSize: 28, fontWeight: 700, color: '#fff', margin: '10px 0 6px', letterSpacing: '-0.5px' },
  subtitle: { fontSize: 14, color: '#7986cb' },
  container: { maxWidth: 880, margin: '0 auto', padding: '0 20px' },

  apiBanner: {
    background: '#1a1400', border: '1px solid #f9a825', borderRadius: 10,
    padding: '14px 18px', marginTop: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  },
  apiBannerLabel: { color: '#f9a825', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' },
  apiInput: {
    flex: 1, minWidth: 220, background: '#0d1a2e', border: '1px solid #f9a82566',
    borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 13, outline: 'none',
  },

  settingsToggle: {
    marginTop: 10, display: 'flex', alignItems: 'center', gap: 6,
    cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 12, userSelect: 'none',
  },
  settingsBox: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: '12px 14px', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10,
  },
  settingsLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4, display: 'block' },
  settingsInput: {
    width: '100%', background: '#0d1a2e', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 13, outline: 'none',
  },
  settingsHint: { fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5, marginTop: 4 },

  urlSection: { marginTop: 24 },
  urlRow: { display: 'flex', gap: 10 },
  urlInput: {
    flex: 1, background: '#0d1a2e', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8, color: '#fff', padding: '12px 16px', fontSize: 15, outline: 'none',
  },
  analyzeBtn: {
    background: '#3949ab', color: '#fff', border: 'none', borderRadius: 8,
    padding: '12px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  analyzeBtnLoading: { background: '#1a237e', cursor: 'not-allowed' },

  progressWrap: { height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressBar: {
    height: '100%', background: 'linear-gradient(90deg, #3949ab, #7986cb)',
    borderRadius: 2, animation: 'progress-indeterminate 1.4s ease-in-out infinite',
  },

  errorBox: {
    background: '#1a0a0a', border: '1px solid #c62828', borderRadius: 8,
    padding: '12px 16px', marginTop: 16, color: '#ef9a9a', fontSize: 14, whiteSpace: 'pre-line',
  },

  // Log panel
  logToggle: {
    marginTop: 12, display: 'flex', alignItems: 'center', gap: 6,
    cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, userSelect: 'none',
  },
  logPanel: {
    background: '#020a14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
    padding: '12px 14px', marginTop: 6, maxHeight: 320, overflowY: 'auto',
  },
  logLine: { fontSize: 12, color: '#90caf9', fontFamily: 'monospace', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all' },

  emptyState: { textAlign: 'center', padding: '64px 20px', color: 'rgba(255,255,255,0.25)' },
  emptyIcon: { fontSize: 56 },
  emptyText: { marginTop: 16, fontSize: 16 },

  resultsSection: { marginTop: 28 },
  scoreRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 12, marginBottom: 18,
  },
  scoreText: { fontSize: 18, fontWeight: 700, color: '#fff' },
  scoreNum: { color: '#69f0ae' },
  copyBtn: {
    background: '#1b5e20', color: '#69f0ae', border: '1px solid #388e3c',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  sheetBtn: {
    background: '#0d47a1', color: '#90caf9', border: '1px solid #1565c0',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  sheetBtnDone: { background: '#0a3d15', color: '#69f0ae', border: '1px solid #388e3c' },
  sheetBtnError: { background: '#3e0000', color: '#ef9a9a', border: '1px solid #c62828' },
  sheetBtnBusy: { background: '#0a1f3d', color: '#5c7099', cursor: 'not-allowed' },
  copyBtnDone: { background: '#0a3d15' },

  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12, marginTop: 4 },
  fieldCard: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, padding: '12px 14px',
  },
  fieldHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot: (filled) => ({ width: 9, height: 9, borderRadius: '50%', background: filled ? '#69f0ae' : 'rgba(255,255,255,0.2)', flexShrink: 0 }),
  fieldLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 },
  fieldInput: {
    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, color: '#fff', padding: '7px 10px', fontSize: 14, outline: 'none',
  },
  fieldSelect: {
    width: '100%', background: '#0d1a2e', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, color: '#fff', padding: '7px 10px', fontSize: 14, outline: 'none',
  },
  fieldTextarea: {
    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, color: '#fff', padding: '7px 10px', fontSize: 14, outline: 'none',
    resize: 'vertical', minHeight: 72,
  },

  excelHint: {
    background: 'rgba(57,73,171,0.12)', border: '1px solid rgba(57,73,171,0.3)',
    borderRadius: 10, padding: '14px 18px', marginTop: 20, fontSize: 13, color: '#9fa8da', lineHeight: 1.6,
  },
};

const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes progress-indeterminate {
    0%   { transform: translateX(-100%) scaleX(0.5); }
    50%  { transform: translateX(0%)   scaleX(0.5); }
    100% { transform: translateX(200%) scaleX(0.5); }
  }
`;
document.head.appendChild(styleTag);

// ── FieldInput ────────────────────────────────────────────────────────────────

function FieldInput({ field, value, onChange }) {
  const val = value ?? '';
  if (field.type === 'select') {
    return (
      <select style={S.fieldSelect} value={val} onChange={(e) => onChange(field.key, e.target.value || null)}>
        <option value="">— nicht erkannt —</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === 'textarea') {
    return (
      <textarea style={S.fieldTextarea} value={val} rows={3}
        onChange={(e) => onChange(field.key, e.target.value || null)} />
    );
  }
  return (
    <input style={S.fieldInput} type={field.type === 'number' ? 'number' : 'text'} value={val}
      onChange={(e) => {
        const v = e.target.value;
        onChange(field.key, field.type === 'number' ? (v === '' ? null : Number(v)) : (v || null));
      }} />
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [apiKey, setApiKey]         = useState('');
  const [proxyUrl, setProxyUrl]     = useState('https://snowy-sunset-969a.thomas-branghofer.workers.dev/');
  const [showSettings, setShowSettings] = useState(false);
  const [url, setUrl]               = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [edited, setEdited]         = useState(null);
  const [copied, setCopied]         = useState(false);
  const [sheetState, setSheetState] = useState('idle'); // idle | saving | saved | error
  const [sheetMsg, setSheetMsg]     = useState('');
  const [logs, setLogs]             = useState([]);
  const [showLog, setShowLog]       = useState(false);
  const logRef = useRef(null);

  const score = edited
    ? FIELDS.filter((f) => edited[f.key] !== null && edited[f.key] !== undefined && edited[f.key] !== '').length
    : 0;

  const addLog = useCallback((msg) => {
    setLogs((prev) => [...prev, msg]);
    setTimeout(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, 50);
  }, []);

  const handleAnalyze = useCallback(async () => {
    setError(null);
    setLogs([]);

    if (!proxyUrl.trim() && !apiKey.trim()) { setError('Bitte zuerst den Anthropic API-Key eingeben.'); return; }
    const videoId = extractYouTubeId(url.trim());
    if (!videoId) { setError('Kein gültiger YouTube-Link erkannt.'); return; }

    addLog(`🎬 Starte Analyse für: ${url.trim()}`);
    addLog(`🆔 Video-ID: ${videoId}`);

    setLoading(true);
    setShowLog(true);
    try {
      const data = await analyzeVideo(url.trim(), apiKey.trim(), proxyUrl, addLog);
      setEdited({ ...data });
      addLog('🎉 Analyse abgeschlossen!');
    } catch (e) {
      setError(e.message);
      addLog(`❌ Fehler: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [apiKey, proxyUrl, url, addLog]);

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleAnalyze(); };
  const handleFieldChange = (key, value) => setEdited((prev) => ({ ...prev, [key]: value }));

  const handleSaveToSheet = async () => {
    if (!proxyUrl.trim()) { setSheetState('error'); setSheetMsg('Kein Proxy konfiguriert.'); return; }
    setSheetState('saving');
    setSheetMsg('');
    try {
      const row = await saveToSheet(url, edited, proxyUrl);
      setSheetState('saved');
      setSheetMsg(`✓ Zeile ${row} gespeichert`);
      setTimeout(() => setSheetState('idle'), 4000);
    } catch (e) {
      setSheetState('error');
      setSheetMsg(e.message);
    }
  };

  const handleCopy = async () => {
    const values = [url, ...FIELDS.map((f) => {
      const v = edited[f.key];
      return v === null || v === undefined ? '' : String(v);
    })];
    await navigator.clipboard.writeText(values.join('\t'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.logo}>⚽</div>
        <h1 style={S.title}>Trainings-Video Analyzer</h1>
        <p style={S.subtitle}>YouTube-Links analysieren · Übungsdaten per KI ausfüllen · In Excel einfügen</p>
      </header>

      <div style={S.container}>
        {/* API Key — nur anzeigen wenn kein Proxy aktiv */}
        {!proxyUrl.trim() && (
          <div style={S.apiBanner}>
            <span style={S.apiBannerLabel}>🔑 Anthropic API-Key</span>
            <input style={S.apiInput} type="password" placeholder="sk-ant-api03-..."
              value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
          </div>
        )}

        {/* Settings */}
        <div style={S.settingsToggle} onClick={() => setShowSettings((v) => !v)}>
          <span>{showSettings ? '▾' : '▸'}</span>
          <span>⚙ Einstellungen (Proxy für iOS/Safari)</span>
          {proxyUrl.trim() && <span style={{ color: '#69f0ae' }}>● aktiv</span>}
        </div>
        {showSettings && (
          <div style={S.settingsBox}>
            <div>
              <label style={S.settingsLabel}>Cloudflare Worker URL (optional — nur für iOS/Safari nötig)</label>
              <input style={S.settingsInput} type="url"
                placeholder="https://snowy-sunset-969a.thomas-branghofer.workers.dev"
                value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} autoComplete="off" />
              <p style={S.settingsHint}>
                Anleitung: <code>cloudflare-worker.js</code> aus dem GitHub-Repo als Cloudflare Worker deployen.
              </p>
            </div>
          </div>
        )}

        {/* URL Input */}
        <div style={S.urlSection}>
          <div style={S.urlRow}>
            <input style={S.urlInput} type="url" placeholder="https://www.youtube.com/watch?v=..."
              value={url} onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown} disabled={loading} />
            <button
              style={{ ...S.analyzeBtn, ...(loading ? S.analyzeBtnLoading : {}) }}
              onClick={handleAnalyze} disabled={loading}>
              {loading ? 'Analysiere…' : 'Analysieren'}
            </button>
          </div>

          {loading && <div style={S.progressWrap}><div style={S.progressBar} /></div>}
          {error && <div style={S.errorBox}>⚠ {error}</div>}

          {/* Log Panel */}
          {logs.length > 0 && (
            <>
              <div style={S.logToggle} onClick={() => setShowLog((v) => !v)}>
                <span>{showLog ? '▾' : '▸'}</span>
                <span>🔍 Analyse-Log ({logs.length} Schritte)</span>
              </div>
              {showLog && (
                <div style={S.logPanel} ref={logRef}>
                  {logs.map((line, i) => (
                    <div key={i} style={S.logLine}>{line}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Results */}
        {edited ? (
          <div style={S.resultsSection}>
            <div style={S.scoreRow}>
              <span style={S.scoreText}>
                <span style={S.scoreNum}>{score}</span> / {FIELDS.length} Felder erkannt
              </span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button style={{ ...S.copyBtn, ...(copied ? S.copyBtnDone : {}) }} onClick={handleCopy}>
                  {copied ? '✓ Kopiert!' : '📋 Tab-Zeile kopieren'}
                </button>
                {/* Google Sheet Button deaktiviert */}
              </div>
            </div>

            <div style={S.fieldGrid}>
              {FIELDS.map((field) => {
                const val = edited[field.key];
                const filled = val !== null && val !== undefined && val !== '';
                return (
                  <div key={field.key} style={S.fieldCard}>
                    <div style={S.fieldHeader}>
                      <div style={S.dot(filled)} />
                      <span style={S.fieldLabel}>{field.label} (Spalte {field.col})</span>
                    </div>
                    <FieldInput field={field} value={edited[field.key]} onChange={handleFieldChange} />
                  </div>
                );
              })}
            </div>

            <div style={S.excelHint}>
              <strong style={{ color: '#c5cae9' }}>Excel-Einfüge-Anleitung:</strong><br />
              1. Klicke auf „Tab-Zeile für Excel kopieren"<br />
              2. Wechsle zu deiner Excel-Datei und klicke in Spalte B der gewünschten Zeile<br />
              3. Drücke <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 3 }}>Strg+V</kbd>
            </div>
          </div>
        ) : (
          <div style={S.emptyState}>
            <div style={S.emptyIcon}>🎬</div>
            <p style={S.emptyText}>YouTube-Link eingeben und auf „Analysieren" klicken</p>
          </div>
        )}
      </div>
    </div>
  );
}
