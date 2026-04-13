import React, { useState, useCallback, useRef } from 'react';
import { FIELDS } from './fields.js';
import { analyzeVideo, analyzeImages, saveToSheet, resizeImageToBase64 } from './api.js';
import { extractYouTubeId } from './utils.js';
import SketchCanvas from './SketchCanvas.jsx';

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

  // Mode toggle
  modeToggle: {
    display: 'flex', marginTop: 24,
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden',
  },
  modeBtn: (active) => ({
    flex: 1, padding: '11px 16px', background: active ? '#1a2a4e' : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.4)',
    border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: active ? 600 : 400,
    transition: 'background 0.15s, color 0.15s',
  }),
  modeDivider: { width: 1, background: 'rgba(255,255,255,0.1)', flexShrink: 0 },

  inputSection: { marginTop: 16 },
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

  // Image upload
  uploadZone: (active) => ({
    border: `2px dashed ${active ? '#3949ab' : 'rgba(255,255,255,0.18)'}`,
    borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
    color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.6,
    background: active ? 'rgba(57,73,171,0.08)' : 'transparent',
    transition: 'border-color 0.15s, background 0.15s',
  }),
  uploadIcon: { fontSize: 32, marginBottom: 8 },
  previewGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  previewItem: { position: 'relative', width: 76, height: 76 },
  previewImg: {
    width: 76, height: 76, objectFit: 'cover', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)', display: 'block',
  },
  previewRemove: {
    position: 'absolute', top: -7, right: -7, width: 20, height: 20,
    borderRadius: '50%', background: '#c62828', color: '#fff',
    border: '2px solid #060f1e', cursor: 'pointer', fontSize: 11,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
    lineHeight: 1,
  },
  contextInput: {
    width: '100%', background: '#0d1a2e', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14, outline: 'none',
    marginTop: 10, boxSizing: 'border-box',
  },
  imageAnalyzeBtn: {
    marginTop: 12, width: '100%', background: '#3949ab', color: '#fff', border: 'none',
    borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },

  progressWrap: { height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressBar: {
    height: '100%', background: 'linear-gradient(90deg, #3949ab, #7986cb)',
    borderRadius: 2, animation: 'progress-indeterminate 1.4s ease-in-out infinite',
  },

  errorBox: {
    background: '#1a0a0a', border: '1px solid #c62828', borderRadius: 8,
    padding: '12px 16px', marginTop: 16, color: '#ef9a9a', fontSize: 14, whiteSpace: 'pre-line',
  },

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
  copyBtnDone: { background: '#0a3d15' },
  saveBtn: {
    background: '#1a237e', color: '#9fa8da', border: '1px solid #3949ab',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  saveBtnActive: { background: '#283593', color: '#fff' },
  saveBtnLoading: { opacity: 0.6, cursor: 'not-allowed' },
  saveSuccess: {
    marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 13,
    background: 'rgba(27,94,32,0.3)', border: '1px solid #388e3c', color: '#69f0ae',
  },
  saveErrBox: {
    marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 13,
    background: 'rgba(198,40,40,0.15)', border: '1px solid #c62828', color: '#ef9a9a',
  },

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

const MAX_IMAGES = 8;

export default function App() {
  const [mode, setMode]             = useState('youtube'); // 'youtube' | 'images'
  const [apiKey, setApiKey]         = useState('');
  const [proxyUrl, setProxyUrl]     = useState('https://snowy-sunset-969a.thomas-branghofer.workers.dev/');
  const [showSettings, setShowSettings] = useState(false);

  // YouTube mode
  const [url, setUrl]               = useState('');

  // Images mode
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [dragOver, setDragOver]     = useState(false);
  const [imageContext, setImageContext] = useState('');
  const fileInputRef                = useRef(null);

  // Shared
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [edited, setEdited]         = useState(null);
  const [copied, setCopied]         = useState(false);
  const [logs, setLogs]             = useState([]);
  const [showLog, setShowLog]       = useState(false);
  const [showSketch, setShowSketch] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const logRef    = useRef(null);
  const sketchRef = useRef(null);

  const score = edited
    ? FIELDS.filter((f) => edited[f.key] !== null && edited[f.key] !== undefined && edited[f.key] !== '').length
    : 0;

  const addLog = useCallback((msg) => {
    setLogs((prev) => [...prev, msg]);
    setTimeout(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, 50);
  }, []);

  // ── Image helpers ────────────────────────────────────────────────────────

  const addImages = useCallback((files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    setImageFiles(prev => {
      const combined = [...prev, ...valid].slice(0, MAX_IMAGES);
      return combined;
    });
    setImagePreviews(prev => {
      const newPreviews = valid.map(f => URL.createObjectURL(f));
      return [...prev, ...newPreviews].slice(0, MAX_IMAGES);
    });
  }, []);

  const removeImage = useCallback((index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null);
    setEdited(null);
    setLogs([]);
  };

  // ── Analyze handlers ─────────────────────────────────────────────────────

  const handleAnalyzeVideo = useCallback(async () => {
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
      if (data.skizze) setShowSketch(true);
      addLog('🎉 Analyse abgeschlossen!');
    } catch (e) {
      setError(e.message);
      addLog(`❌ Fehler: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [apiKey, proxyUrl, url, addLog]);

  const handleAnalyzeImages = useCallback(async () => {
    setError(null);
    setLogs([]);
    if (!proxyUrl.trim() && !apiKey.trim()) { setError('Bitte zuerst den Anthropic API-Key eingeben.'); return; }
    if (imageFiles.length === 0) { setError('Bitte mindestens ein Bild auswählen.'); return; }
    addLog(`🖼️ Starte Analyse für ${imageFiles.length} Bild(er)...`);
    setLoading(true);
    setShowLog(true);
    try {
      const data = await analyzeImages(imageFiles, imageContext, apiKey.trim(), proxyUrl, addLog);
      setEdited({ ...data });
      if (data.skizze) setShowSketch(true);
      addLog('🎉 Analyse abgeschlossen!');
    } catch (e) {
      setError(e.message);
      addLog(`❌ Fehler: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [apiKey, proxyUrl, imageFiles, imageContext, addLog]);

  const handleFieldChange = (key, value) => setEdited((prev) => ({ ...prev, [key]: value }));

  const handleCopy = async () => {
    const srcUrl = mode === 'youtube' ? url : '';
    const values = [srcUrl, ...FIELDS.map((f) => {
      const v = edited[f.key];
      return v === null || v === undefined ? '' : String(v);
    })];
    await navigator.clipboard.writeText(values.join('\t'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = useCallback(async () => {
    if (!proxyUrl.trim()) {
      setSaveError('Bitte zuerst die Cloudflare Worker URL in den Einstellungen eintragen.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const skizzeBase64 = showSketch ? (sketchRef.current?.getPng() ?? null) : null;
      const bilderBase64 = mode === 'images' && imageFiles.length > 0
        ? await Promise.all(imageFiles.map(f => resizeImageToBase64(f)))
        : null;
      const srcUrl = mode === 'youtube' ? url : '';
      const row = await saveToSheet(srcUrl, edited, proxyUrl, skizzeBase64, bilderBase64);
      setSaveSuccess(`In Zeile ${row} gespeichert${skizzeBase64 ? ' · Skizze in Drive' : ''}${bilderBase64 ? ` · ${bilderBase64.length} Bild(er) in Drive` : ''}`);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }, [proxyUrl, showSketch, mode, url, edited, imageFiles]);

  // ── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    addImages(e.dataTransfer.files);
  }, [addImages]);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.logo}>⚽</div>
        <h1 style={S.title}>Trainings-Video Analyzer</h1>
        <p style={S.subtitle}>YouTube-Links oder eigene Bilder analysieren · Übungsdaten per KI ausfüllen · In Excel einfügen</p>
      </header>

      <div style={S.container}>
        {/* API Key */}
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

        {/* Mode Toggle */}
        <div style={S.modeToggle}>
          <button style={S.modeBtn(mode === 'youtube')} onClick={() => switchMode('youtube')}>
            🎬 YouTube-Video
          </button>
          <div style={S.modeDivider} />
          <button style={S.modeBtn(mode === 'images')} onClick={() => switchMode('images')}>
            🖼️ Bilder hochladen
          </button>
        </div>

        {/* Input Section */}
        <div style={S.inputSection}>
          {mode === 'youtube' ? (
            /* ── YouTube Mode ── */
            <div style={S.urlRow}>
              <input style={S.urlInput} type="url" placeholder="https://www.youtube.com/watch?v=..."
                value={url} onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyzeVideo(); }}
                disabled={loading} />
              <button
                style={{ ...S.analyzeBtn, ...(loading ? S.analyzeBtnLoading : {}) }}
                onClick={handleAnalyzeVideo} disabled={loading}>
                {loading ? 'Analysiere…' : 'Analysieren'}
              </button>
            </div>
          ) : (
            /* ── Images Mode ── */
            <>
              {/* Drop Zone */}
              <div
                style={S.uploadZone(dragOver)}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div style={S.uploadIcon}>📁</div>
                <div>Bilder hier reinziehen oder <strong style={{ color: '#7986cb' }}>klicken zum Auswählen</strong></div>
                <div style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,0.25)' }}>
                  JPG, PNG, HEIC · max. {MAX_IMAGES} Bilder
                </div>
              </div>
              <input
                ref={fileInputRef} type="file" accept="image/*" multiple
                style={{ display: 'none' }}
                onChange={(e) => addImages(e.target.files)}
              />

              {/* Previews */}
              {imagePreviews.length > 0 && (
                <div style={S.previewGrid}>
                  {imagePreviews.map((src, i) => (
                    <div key={i} style={S.previewItem}>
                      <img src={src} alt={`Bild ${i + 1}`} style={S.previewImg} />
                      <button style={S.previewRemove} onClick={() => removeImage(i)}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Optional context */}
              <input
                style={S.contextInput}
                type="text"
                placeholder="Kontext / Übungsname (optional) – z.B. 4v2 Rondo, U14"
                value={imageContext}
                onChange={(e) => setImageContext(e.target.value)}
              />

              <button
                style={{ ...S.imageAnalyzeBtn, ...(loading ? S.analyzeBtnLoading : {}) }}
                onClick={handleAnalyzeImages}
                disabled={loading}
              >
                {loading ? 'Analysiere…' : `${imageFiles.length > 0 ? `${imageFiles.length} Bild${imageFiles.length > 1 ? 'er' : ''} ` : ''}Analysieren`}
              </button>
            </>
          )}

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
                {proxyUrl.trim() && (
                  <button
                    style={{ ...S.saveBtn, ...(saving ? S.saveBtnLoading : S.saveBtnActive) }}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? '⏳ Speichern…' : '☁️ In Sheet + Drive speichern'}
                  </button>
                )}
              </div>
            </div>
            {saveSuccess && <div style={S.saveSuccess}>✓ {saveSuccess}</div>}
            {saveError   && <div style={S.saveErrBox}>⚠ {saveError}</div>}

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
            <div style={S.emptyIcon}>{mode === 'youtube' ? '🎬' : '🖼️'}</div>
            <p style={S.emptyText}>
              {mode === 'youtube'
                ? 'YouTube-Link eingeben und auf „Analysieren" klicken'
                : 'Bilder hochladen und auf „Analysieren" klicken'}
            </p>
          </div>
        )}

        {/* Sketch Section – always available */}
        <div style={{ marginTop: 36, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', marginBottom: showSketch ? 16 : 0 }}
            onClick={() => setShowSketch(v => !v)}
          >
            <span style={{ fontSize: 20, color: '#7986cb' }}>{showSketch ? '▾' : '▸'}</span>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>🖊️ Übungsskizze</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>
              Spielfeld zeichnen · Spieler & Hütchen setzen · als PNG speichern
            </span>
          </div>
          {showSketch && <SketchCanvas ref={sketchRef} skizzeData={edited?.skizze ?? null} />}
        </div>
      </div>
    </div>
  );
}
