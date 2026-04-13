import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

const CW = 360, CH = 540, PAD = 20;
const PLAYER_R = 14, CONE_S = 12, BALL_R = 10, RING_R = 16;
const LADDER_W = 24, LADDER_H = 80;
const TEAM_COLOR = { A: '#42a5f5', B: '#ef5350', N: '#e0e0e0' };

// ── Field background ──────────────────────────────────────────────────────────

function drawField(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, CW, CH);
  // Horizontal stripes
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(0, i * CH / 8, CW, CH / 8); }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  // Outer boundary
  ctx.strokeRect(PAD, PAD, CW - PAD * 2, CH - PAD * 2);
  // Horizontal midline
  ctx.beginPath(); ctx.moveTo(PAD, CH / 2); ctx.lineTo(CW - PAD, CH / 2); ctx.stroke();
  // Center circle
  ctx.beginPath(); ctx.arc(CW / 2, CH / 2, Math.min(CW, CH) * 0.1, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.arc(CW / 2, CH / 2, 3, 0, Math.PI * 2); ctx.fill();
  // Penalty areas (top & bottom)
  const gaw = (CW - PAD * 2) * 0.55, gah = (CH - PAD * 2) * 0.12, gax = (CW - gaw) / 2;
  ctx.strokeRect(gax, PAD, gaw, gah);
  ctx.strokeRect(gax, CH - PAD - gah, gaw, gah);
  // Goals (top & bottom)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4;
  const gl = gaw * 0.42;
  ctx.beginPath(); ctx.moveTo(CW / 2 - gl / 2, PAD); ctx.lineTo(CW / 2 + gl / 2, PAD); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CW / 2 - gl / 2, CH - PAD); ctx.lineTo(CW / 2 + gl / 2, CH - PAD); ctx.stroke();
}

// ── Object rendering ──────────────────────────────────────────────────────────

function drawArrowFn(ctx, x1, y1, x2, y2, color, lw) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < 5) return;
  const angle = Math.atan2(dy, dx), head = Math.min(20, len * 0.38);
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(angle) * head * 0.45, y2 - Math.sin(angle) * head * 0.45);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function renderObjects(canvas, objects, selectedId, arrowPreview) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, CW, CH);

  // Arrows behind
  objects.filter(o => o.type === 'arrow').forEach(o => {
    drawArrowFn(ctx, o.x1, o.y1, o.x2, o.y2, o.id === selectedId ? '#fff176' : '#ffee58', 2.5);
    [[o.x1, o.y1], [o.x2, o.y2]].forEach(([px, py]) => {
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = o.id === selectedId ? '#fff' : 'rgba(255,255,255,0.35)';
      ctx.fill();
    });
  });

  // Players and cones in front
  objects.filter(o => o.type !== 'arrow').forEach(o => {
    const sel = o.id === selectedId;
    ctx.save();
    if (sel) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 14; }
    if (o.type === 'player') {
      ctx.beginPath(); ctx.arc(o.x, o.y, PLAYER_R, 0, Math.PI * 2);
      ctx.fillStyle = TEAM_COLOR[o.team] ?? '#fff'; ctx.fill();
      ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = sel ? 2.5 : 1.5; ctx.stroke();
    } else if (o.type === 'cone') {
      ctx.beginPath();
      ctx.moveTo(o.x, o.y - CONE_S);
      ctx.lineTo(o.x - CONE_S * 0.75, o.y + CONE_S * 0.5);
      ctx.lineTo(o.x + CONE_S * 0.75, o.y + CONE_S * 0.5);
      ctx.closePath(); ctx.fillStyle = '#ff9800'; ctx.fill();
      ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = sel ? 2 : 1; ctx.stroke();
    } else if (o.type === 'ball') {
      ctx.beginPath(); ctx.arc(o.x, o.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = sel ? '#aef' : '#222'; ctx.lineWidth = sel ? 2 : 1.5; ctx.stroke();
      // Simple ball panel lines
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(o.x, o.y, BALL_R * 0.45, 0, Math.PI * 2); ctx.stroke();
      for (let a = 0; a < 5; a++) {
        const ang = (a * Math.PI * 2 / 5) - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(o.x + Math.cos(ang) * BALL_R * 0.45, o.y + Math.sin(ang) * BALL_R * 0.45);
        ctx.lineTo(o.x + Math.cos(ang) * BALL_R * 0.92, o.y + Math.sin(ang) * BALL_R * 0.92);
        ctx.stroke();
      }
    } else if (o.type === 'ring') {
      ctx.beginPath(); ctx.arc(o.x, o.y, RING_R, 0, Math.PI * 2);
      ctx.strokeStyle = sel ? '#fff' : '#ffd740';
      ctx.lineWidth = sel ? 4 : 3; ctx.stroke();
    } else if (o.type === 'ladder') {
      const x0 = o.x - LADDER_W / 2, y0 = o.y - LADDER_H / 2;
      ctx.strokeStyle = sel ? '#fff' : '#ce93d8'; ctx.lineWidth = sel ? 2.5 : 2;
      // Rails
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + LADDER_H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 + LADDER_W, y0); ctx.lineTo(x0 + LADDER_W, y0 + LADDER_H); ctx.stroke();
      // Rungs
      const numRungs = 5;
      for (let i = 0; i <= numRungs; i++) {
        const ry = y0 + (i * LADDER_H / numRungs);
        ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(x0 + LADDER_W, ry); ctx.stroke();
      }
    }
    ctx.restore();
  });

  if (arrowPreview) {
    drawArrowFn(ctx, arrowPreview.x1, arrowPreview.y1, arrowPreview.x2, arrowPreview.y2, 'rgba(255,238,88,0.55)', 2);
  }
}

// ── Hit testing ───────────────────────────────────────────────────────────────

function hitTest(objects, x, y) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.type === 'player' && Math.hypot(x - o.x, y - o.y) <= PLAYER_R + 6)
      return { id: o.id, handle: 'move' };
    if (o.type === 'cone' && Math.hypot(x - o.x, y - o.y) <= CONE_S + 8)
      return { id: o.id, handle: 'move' };
    if (o.type === 'ball' && Math.hypot(x - o.x, y - o.y) <= BALL_R + 6)
      return { id: o.id, handle: 'move' };
    if (o.type === 'ring' && Math.hypot(x - o.x, y - o.y) <= RING_R + 8)
      return { id: o.id, handle: 'move' };
    if (o.type === 'ladder') {
      const x0 = o.x - LADDER_W / 2 - 6, y0 = o.y - LADDER_H / 2 - 6;
      if (x >= x0 && x <= x0 + LADDER_W + 12 && y >= y0 && y <= y0 + LADDER_H + 12)
        return { id: o.id, handle: 'move' };
    }
    if (o.type === 'arrow') {
      if (Math.hypot(x - o.x1, y - o.y1) <= 12) return { id: o.id, handle: 'start' };
      if (Math.hypot(x - o.x2, y - o.y2) <= 12) return { id: o.id, handle: 'end' };
      const len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
      if (len > 0) {
        const t = Math.max(0, Math.min(1, ((x - o.x1) * (o.x2 - o.x1) + (y - o.y1) * (o.y2 - o.y1)) / (len * len)));
        if (Math.hypot(x - (o.x1 + t * (o.x2 - o.x1)), y - (o.y1 + t * (o.y2 - o.y1))) <= 10)
          return { id: o.id, handle: 'move' };
      }
    }
  }
  return null;
}

function getPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches?.[0] ?? e.changedTouches?.[0] ?? e;
  return {
    x: (src.clientX - rect.left) * (canvas.width / rect.width),
    y: (src.clientY - rect.top) * (canvas.height / rect.height),
  };
}

// ── Palette definition ────────────────────────────────────────────────────────

const PALETTE_TYPES = [
  { key: 'playerA', label: 'Spieler A', color: '#42a5f5', type: 'player', team: 'A' },
  { key: 'playerB', label: 'Spieler B', color: '#ef5350', type: 'player', team: 'B' },
  { key: 'playerN', label: 'Neutral',   color: '#e0e0e0', type: 'player', team: 'N' },
  { key: 'cone',    label: 'Hütchen',   color: '#ff9800', type: 'cone' },
  { key: 'ball',    label: 'Ball',      color: '#ffffff', type: 'ball',   icon: 'ball' },
  { key: 'ring',    label: 'Ring',      color: '#ffd740', type: 'ring',   icon: 'ring' },
  { key: 'ladder',  label: 'Ko-Leiter', color: '#ce93d8', type: 'ladder', icon: 'ladder' },
];

function PaletteIcon({ def }) {
  if (def.icon === 'ring')
    return <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'transparent', border: `3px solid ${def.color}`, flexShrink: 0 }} />;
  if (def.icon === 'ladder')
    return (
      <div style={{ width: 10, height: 16, border: `2px solid ${def.color}`, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1px 0', boxSizing: 'border-box' }}>
        {[0, 1, 2].map(i => <div key={i} style={{ height: 1, background: def.color }} />)}
      </div>
    );
  return <div style={{ width: 16, height: 16, borderRadius: '50%', background: def.color, flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.4)' }} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  palette: {
    width: 86, flexShrink: 0,
    background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  paletteTitle: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  paletteBtn: (color) => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
    borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: '#fff', fontSize: 12,
  }),
  paletteDot: (color) => ({
    width: 16, height: 16, borderRadius: '50%', background: color, flexShrink: 0,
    border: '1.5px solid rgba(255,255,255,0.4)',
  }),
  paletteSep: { height: 1, background: 'rgba(255,255,255,0.08)', margin: '3px 0' },
  paletteArrowBtn: (active) => ({
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
    borderRadius: 7, border: `1px solid ${active ? '#ffee58' : 'rgba(255,255,255,0.1)'}`,
    background: active ? 'rgba(255,238,88,0.15)' : 'rgba(255,255,255,0.05)',
    cursor: 'pointer', color: active ? '#ffee58' : '#fff', fontSize: 12, fontWeight: active ? 700 : 400,
  }),
  right: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  toolbar: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  tbBtn: (disabled) => ({
    padding: '7px 12px', borderRadius: 7, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)',
    color: disabled ? 'rgba(255,255,255,0.25)' : '#fff', fontSize: 13,
  }),
  tbBtnRed: {
    padding: '7px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
    background: 'rgba(198,40,40,0.3)', color: '#ef9a9a', fontSize: 13,
  },
  tbBtnGreen: {
    padding: '7px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
    background: '#1b5e20', color: '#69f0ae', fontSize: 13, fontWeight: 600,
  },
  selInfo: {
    fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 6,
    marginLeft: 'auto',
  },
  canvasWrap: {
    position: 'relative', width: '100%', borderRadius: 10,
    overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', touchAction: 'none',
  },
  fieldCanvas: { display: 'block', width: '100%' },
  objCanvas:   { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', touchAction: 'none' },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.22)', marginTop: 4 },
};

// ── Component ─────────────────────────────────────────────────────────────────

const SketchCanvas = forwardRef(function SketchCanvas({ skizzeData }, ref) {
  const fieldRef = useRef(null);
  const objRef   = useRef(null);

  const [objects, setObjects]     = useState([]);
  const [selectedId, setSelected] = useState(null);
  const [addArrow, setAddArrow]   = useState(false);
  const [arrowPrev, setArrowPrev] = useState(null);

  const historyRef = useRef([[]]);
  const histIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const drag    = useRef(null); // active drag on canvas
  const arrowP1 = useRef(null); // first click of arrow
  const idCnt   = useRef(0);

  const nextId = () => `o${++idCnt.current}`;

  const updateUndoRedo = () => {
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
  };

  const commit = useCallback((newObjs) => {
    historyRef.current = historyRef.current.slice(0, histIdxRef.current + 1);
    historyRef.current.push(newObjs.map(o => ({ ...o })));
    histIdxRef.current = historyRef.current.length - 1;
    setObjects(newObjs);
    updateUndoRedo();
  }, []);

  const undo = () => {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current--;
    setObjects(historyRef.current[histIdxRef.current].map(o => ({ ...o })));
    setSelected(null);
    updateUndoRedo();
  };

  const redo = () => {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current++;
    setObjects(historyRef.current[histIdxRef.current].map(o => ({ ...o })));
    setSelected(null);
    updateUndoRedo();
  };

  // Init canvases
  useEffect(() => {
    const fc = fieldRef.current, oc = objRef.current;
    fc.width = CW; fc.height = CH;
    oc.width = CW; oc.height = CH;
    drawField(fc);
  }, []);

  // Re-render objects whenever state changes
  useEffect(() => {
    if (objRef.current) renderObjects(objRef.current, objects, selectedId, arrowPrev);
  }, [objects, selectedId, arrowPrev]);

  // Apply skizzeData: objects placed at AI positions
  useEffect(() => {
    if (!skizzeData) return;
    const fx = x => PAD + x * (CW - PAD * 2);
    const fy = y => PAD + y * (CH - PAD * 2);
    const newObjs = [
      ...(skizzeData.spieler  || []).map(p => ({ id: nextId(), type: 'player', x: fx(p.x), y: fy(p.y), team: p.team || 'N' })),
      ...(skizzeData.huetchen || []).map(h => ({ id: nextId(), type: 'cone',   x: fx(h.x), y: fy(h.y) })),
      ...(skizzeData.pfeile   || []).map(a => ({ id: nextId(), type: 'arrow',  x1: fx(a.x1), y1: fy(a.y1), x2: fx(a.x2), y2: fy(a.y2) })),
    ];
    commit(newObjs);
  }, [skizzeData]);

  // ── Add from palette ────────────────────────────────────────────────────────

  const addObject = (def) => {
    const offset = () => (Math.random() - 0.5) * 60;
    const base = { id: nextId(), type: def.type, x: CW / 2 + offset(), y: CH / 2 + offset() };
    const newObj = def.type === 'player' ? { ...base, team: def.team } : base;
    commit([...objects, newObj]);
    setSelected(newObj.id);
  };

  // ── Canvas interactions ─────────────────────────────────────────────────────

  const deleteSelected = () => {
    if (!selectedId) return;
    commit(objects.filter(o => o.id !== selectedId));
    setSelected(null);
  };

  const onCanvasDown = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(objRef.current, e);

    // Arrow drawing mode
    if (addArrow) {
      if (!arrowP1.current) {
        arrowP1.current = pos;
        setArrowPrev({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
      } else {
        const newArrow = { id: nextId(), type: 'arrow', x1: arrowP1.current.x, y1: arrowP1.current.y, x2: pos.x, y2: pos.y };
        commit([...objects, newArrow]);
        setSelected(newArrow.id);
        arrowP1.current = null;
        setArrowPrev(null);
        setAddArrow(false);
      }
      return;
    }

    const hit = hitTest(objects, pos.x, pos.y);
    if (hit) {
      setSelected(hit.id);
      const obj = objects.find(o => o.id === hit.id);
      drag.current = { id: hit.id, handle: hit.handle, startX: pos.x, startY: pos.y, orig: { ...obj } };
    } else {
      setSelected(null);
    }
  }, [objects, addArrow]);

  const onCanvasMove = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(objRef.current, e);

    if (addArrow && arrowP1.current) {
      setArrowPrev({ x1: arrowP1.current.x, y1: arrowP1.current.y, x2: pos.x, y2: pos.y });
      return;
    }

    if (!drag.current) return;
    const { id, handle, startX, startY, orig } = drag.current;
    const dx = pos.x - startX, dy = pos.y - startY;

    setObjects(prev => prev.map(o => {
      if (o.id !== id) return o;
      if (handle === 'move') {
        if (o.type === 'arrow') return { ...o, x1: orig.x1 + dx, y1: orig.y1 + dy, x2: orig.x2 + dx, y2: orig.y2 + dy };
        return { ...o, x: orig.x + dx, y: orig.y + dy };
      }
      if (handle === 'start') return { ...o, x1: pos.x, y1: pos.y };
      if (handle === 'end')   return { ...o, x2: pos.x, y2: pos.y };
      return o;
    }));
  }, [addArrow]);

  const onCanvasUp = useCallback((e) => {
    e.preventDefault();
    if (drag.current) {
      // Commit final position to history
      setObjects(prev => {
        commit(prev);
        return prev;
      });
      drag.current = null;
    }
  }, [commit]);

  // Delete key
  useEffect(() => {
    const handler = (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) deleteSelected(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, objects]);

  // Download
  const downloadPng = () => {
    const out = document.createElement('canvas');
    out.width = CW; out.height = CH;
    const ctx = out.getContext('2d');
    ctx.drawImage(fieldRef.current, 0, 0);
    ctx.drawImage(objRef.current, 0, 0);
    const a = document.createElement('a');
    a.download = 'trainingsskizze.png';
    a.href = out.toDataURL('image/png');
    a.click();
  };

  const clearAll = () => { commit([]); setSelected(null); setAddArrow(false); arrowP1.current = null; setArrowPrev(null); };

  const selectedObj = objects.find(o => o.id === selectedId);

  useImperativeHandle(ref, () => ({
    getPng() {
      if (!fieldRef.current || !objRef.current) return null;
      const out = document.createElement('canvas');
      out.width = CW; out.height = CH;
      const ctx = out.getContext('2d');
      ctx.drawImage(fieldRef.current, 0, 0);
      ctx.drawImage(objRef.current, 0, 0);
      return out.toDataURL('image/png').split(',')[1];
    },
  }), []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={S.root}>
      {/* Left Palette */}
      <div style={S.palette}>
        <div style={S.paletteTitle}>Objekte</div>
        {PALETTE_TYPES.map(def => (
          <button key={def.key} style={S.paletteBtn(def.color)} onClick={() => addObject(def)} title={`${def.label} hinzufügen`}>
            <PaletteIcon def={def} />
            <span style={{ fontSize: 11 }}>{def.label}</span>
          </button>
        ))}
        <div style={S.paletteSep} />
        <button
          style={S.paletteArrowBtn(addArrow)}
          onClick={() => { setAddArrow(v => !v); arrowP1.current = null; setArrowPrev(null); }}
          title="Pfeil zeichnen (2× klicken)"
        >
          <span>→</span>
          <span style={{ fontSize: 11 }}>Pfeil</span>
        </button>
      </div>

      {/* Right: Toolbar + Canvas */}
      <div style={S.right}>
        <div style={S.toolbar}>
          <button style={S.tbBtn(!canUndo)} onClick={undo} disabled={!canUndo} title="Rückgängig">↩ Undo</button>
          <button style={S.tbBtn(!canRedo)} onClick={redo} disabled={!canRedo} title="Wiederholen">↪ Redo</button>
          <button style={S.tbBtn(false)} onClick={clearAll}>🗑️ Alles löschen</button>
          <button style={S.tbBtnGreen} onClick={downloadPng}>⬇️ PNG</button>
          {selectedObj && (
            <div style={S.selInfo}>
              <button style={S.tbBtnRed} onClick={deleteSelected}>✕ Entfernen</button>
            </div>
          )}
        </div>

        {addArrow && (
          <div style={{ fontSize: 12, color: '#ffee58', padding: '4px 8px', background: 'rgba(255,238,88,0.1)', borderRadius: 6, border: '1px solid rgba(255,238,88,0.3)' }}>
            {arrowP1.current ? '2. Klick: Endpunkt setzen' : '1. Klick: Startpunkt setzen'}
          </div>
        )}

        <div style={S.canvasWrap}>
          <canvas ref={fieldRef} style={S.fieldCanvas} />
          <canvas
            ref={objRef} style={{ ...S.objCanvas, cursor: addArrow ? 'crosshair' : drag.current ? 'grabbing' : 'grab' }}
            onMouseDown={onCanvasDown} onMouseMove={onCanvasMove} onMouseUp={onCanvasUp} onMouseLeave={onCanvasUp}
            onTouchStart={onCanvasDown} onTouchMove={onCanvasMove} onTouchEnd={onCanvasUp}
          />
        </div>

        <p style={S.hint}>
          Objekte aus der Palette hinzufügen · ziehen zum Positionieren · Klick zum Auswählen · Entf/✕ zum Löschen
        </p>
      </div>
    </div>
  );
});

export default SketchCanvas;
