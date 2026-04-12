import React, { useRef, useEffect, useState, useCallback } from 'react';

const W = 640;
const H = 400;

const TOOLS = [
  { id: 'pen',    label: 'Stift',    icon: '✏️' },
  { id: 'player', label: 'Spieler',  icon: '⬤' },
  { id: 'cone',   label: 'Hütchen',  icon: '▲' },
  { id: 'arrow',  label: 'Pfeil',    icon: '→' },
  { id: 'eraser', label: 'Radierer', icon: '◻' },
];

const COLORS = [
  '#ffffff', '#ef5350', '#42a5f5', '#ffee58', '#ff9800', '#69f0ae',
];

// ── Canvas drawing helpers ────────────────────────────────────────────────────

function drawField(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Grass
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, w, h);

  // Subtle alternating stripes
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(i * w / 8, 0, w / 8, h);
    }
  }

  // Field lines
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  const p = 20;

  ctx.strokeRect(p, p, w - p * 2, h - p * 2);

  // Center line (vertical)
  ctx.beginPath();
  ctx.moveTo(w / 2, p);
  ctx.lineTo(w / 2, h - p);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.13, 0, Math.PI * 2);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Goal areas
  const gaw = (w - p * 2) * 0.11;
  const gah = (h - p * 2) * 0.38;
  const gay = (h - gah) / 2;
  ctx.strokeRect(p, gay, gaw, gah);
  ctx.strokeRect(w - p - gaw, gay, gaw, gah);

  // Goals (thick lines)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  const gl = gah * 0.45;
  ctx.beginPath();
  ctx.moveTo(p, h / 2 - gl / 2);
  ctx.lineTo(p, h / 2 + gl / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w - p, h / 2 - gl / 2);
  ctx.lineTo(w - p, h / 2 + gl / 2);
  ctx.stroke();
}

function getPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const src = e.touches?.[0] ?? e.changedTouches?.[0] ?? e;
  return {
    x: (src.clientX - rect.left) * scaleX,
    y: (src.clientY - rect.top) * scaleY,
  };
}

function drawArrowShape(ctx, x1, y1, x2, y2, color, lw) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 4) return;
  const angle = Math.atan2(dy, dx);
  const head = Math.min(22, len * 0.38);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(angle) * head * 0.45, y2 - Math.sin(angle) * head * 0.45);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPlayerShape(ctx, x, y, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawConeShape(ctx, x, y) {
  const s = 11;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x - s * 0.75, y + s * 0.5);
  ctx.lineTo(x + s * 0.75, y + s * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#ff9800';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  toolbar: {
    display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center',
  },
  toolBtn: (active) => ({
    padding: '7px 11px', borderRadius: 7, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    background: active ? '#3949ab' : 'rgba(255,255,255,0.1)',
    color: active ? '#fff' : 'rgba(255,255,255,0.7)',
    whiteSpace: 'nowrap',
  }),
  colorDot: (active, c) => ({
    width: 26, height: 26, borderRadius: '50%', border: active ? '3px solid #fff' : '2px solid rgba(255,255,255,0.25)',
    background: c, cursor: 'pointer', outline: 'none',
  }),
  lwBtn: (active) => ({
    width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: active ? '#3949ab' : 'rgba(255,255,255,0.1)',
  }),
  actionBtn: (green) => ({
    padding: '7px 13px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13,
    background: green ? '#1b5e20' : 'rgba(255,255,255,0.1)',
    color: green ? '#69f0ae' : 'rgba(255,255,255,0.7)',
    fontWeight: green ? 600 : 400,
  }),
  canvasWrap: {
    position: 'relative', width: '100%', borderRadius: 10,
    overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)',
    touchAction: 'none', userSelect: 'none',
  },
  fieldCanvas: { display: 'block', width: '100%' },
  drawCanvas: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    touchAction: 'none', cursor: 'crosshair',
  },
  hint: {
    marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.25)',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SketchCanvas() {
  const fieldRef = useRef(null);
  const drawRef  = useRef(null);

  const [tool, setTool]   = useState('pen');
  const [color, setColor] = useState('#ffffff');
  const [lw, setLw]       = useState(3);

  const isDown   = useRef(false);
  const startXY  = useRef(null);
  const snapshot = useRef(null); // saved pixels for arrow preview

  // Initialize canvases
  useEffect(() => {
    const fc = fieldRef.current;
    const dc = drawRef.current;
    fc.width = W; fc.height = H;
    dc.width = W; dc.height = H;
    drawField(fc);
  }, []);

  const ctx = () => drawRef.current?.getContext('2d');

  // ── Pointer handlers ────────────────────────────────────────────────────

  const onDown = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(drawRef.current, e);
    isDown.current = true;
    startXY.current = pos;
    const c = ctx();

    if (tool === 'player') {
      drawPlayerShape(c, pos.x, pos.y, color);
      isDown.current = false;
      return;
    }
    if (tool === 'cone') {
      drawConeShape(c, pos.x, pos.y);
      isDown.current = false;
      return;
    }
    if (tool === 'arrow') {
      snapshot.current = c.getImageData(0, 0, W, H);
      return;
    }
    // pen / eraser
    c.beginPath();
    c.moveTo(pos.x, pos.y);
    if (tool === 'eraser') {
      c.globalCompositeOperation = 'destination-out';
      c.lineWidth = 22;
    } else {
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = color;
      c.lineWidth = lw;
      c.lineCap = 'round';
      c.lineJoin = 'round';
    }
  }, [tool, color, lw]);

  const onMove = useCallback((e) => {
    e.preventDefault();
    if (!isDown.current) return;
    const pos = getPos(drawRef.current, e);
    const c = ctx();

    if (tool === 'pen' || tool === 'eraser') {
      c.lineTo(pos.x, pos.y);
      c.stroke();
    } else if (tool === 'arrow' && snapshot.current) {
      c.putImageData(snapshot.current, 0, 0);
      drawArrowShape(c, startXY.current.x, startXY.current.y, pos.x, pos.y, color, lw + 1);
    }
  }, [tool, color, lw]);

  const onUp = useCallback((e) => {
    e.preventDefault();
    if (!isDown.current) return;
    isDown.current = false;
    const c = ctx();
    c.globalCompositeOperation = 'source-over';

    if (tool === 'arrow' && snapshot.current) {
      const pos = getPos(drawRef.current, e);
      c.putImageData(snapshot.current, 0, 0);
      drawArrowShape(c, startXY.current.x, startXY.current.y, pos.x, pos.y, color, lw + 1);
      snapshot.current = null;
    }
  }, [tool, color, lw]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const clearAll = () => {
    ctx().clearRect(0, 0, W, H);
  };

  const downloadPng = () => {
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const c = out.getContext('2d');
    c.drawImage(fieldRef.current, 0, 0);
    c.drawImage(drawRef.current, 0, 0);
    const a = document.createElement('a');
    a.download = 'trainingsskizze.png';
    a.href = out.toDataURL('image/png');
    a.click();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Tools + Colors + Actions */}
      <div style={S.toolbar}>
        {TOOLS.map(t => (
          <button key={t.id} style={S.toolBtn(tool === t.id)} onClick={() => setTool(t.id)} title={t.label}>
            {t.icon} {t.label}
          </button>
        ))}

        <div style={{ display: 'flex', gap: 5, marginLeft: 4 }}>
          {COLORS.map(c => (
            <button key={c} style={S.colorDot(color === c, c)} onClick={() => setColor(c)} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 5 }}>
          {[2, 4, 7].map(w => (
            <button key={w} style={S.lwBtn(lw === w)} onClick={() => setLw(w)} title={`Stärke ${w}`}>
              <div style={{ width: w * 2.2, height: w * 2.2, borderRadius: '50%', background: '#fff' }} />
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
          <button style={S.actionBtn(false)} onClick={clearAll}>🗑️ Löschen</button>
          <button style={S.actionBtn(true)} onClick={downloadPng}>⬇️ PNG</button>
        </div>
      </div>

      {/* Canvas */}
      <div style={S.canvasWrap}>
        <canvas ref={fieldRef} style={S.fieldCanvas} />
        <canvas
          ref={drawRef}
          style={S.drawCanvas}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
        />
      </div>

      <p style={S.hint}>
        ● Spieler platzieren · ▲ Hütchen setzen · → Bewegungspfeil ziehen · ✏️ Freihand zeichnen
      </p>
    </div>
  );
}
