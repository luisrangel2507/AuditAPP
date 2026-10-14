'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Editor para marcar la foto del hallazgo: círculo, flecha y trazo libre en rojo. Devuelve la foto con las marcas.
const COLORS = ['#ff2b2b', '#ffd400', '#22e06b', '#ffffff'];

// Geometría de las marcas: caja, mover, escalar y detectar el toque
const pts = (s) => (s.t === 'free' ? s.p : [s.a, s.b]);
const bbox = (s) => { const P = pts(s); const xs = P.map((p) => p.x), ys = P.map((p) => p.y); return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }; };
const mapPts = (s, f) => (s.t === 'free' ? { ...s, p: s.p.map(f) } : { ...s, a: f(s.a), b: f(s.b) });
const moveS = (s, dx, dy) => mapPts(s, (p) => ({ x: p.x + dx, y: p.y + dy }));
const scaleS = (s, k) => { const b = bbox(s), cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2; return mapPts(s, (p) => ({ x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k })); };
const segDist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); };
function hit(s, p, tol) {
  if (s.t === 'free') return s.p.some((q, i) => (i ? segDist(p, s.p[i - 1], q) : Math.hypot(p.x - q.x, p.y - q.y)) < tol);
  if (s.t === 'arrow') return segDist(p, s.a, s.b) < tol;
  const b = bbox(s), rx = (b.x2 - b.x1) / 2 || 1, ry = (b.y2 - b.y1) / 2 || 1, cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
  const d = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry); // 1 = justo sobre la línea
  return Math.abs(d - 1) * Math.min(rx, ry) < tol || d < 0.35;
}

export default function PhotoMark({ src, onDone, onCancel }) {
  const cv = useRef(null), img = useRef(null), box = useRef(null);
  const [tool, setTool] = useState('circle'), [color, setColor] = useState(COLORS[0]);
  const [shapes, setShapes] = useState([]), [live, setLive] = useState(null), [ready, setReady] = useState(false);
  const [sel, setSel] = useState(-1), drag = useRef(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => { img.current = i; setReady(true); };
    i.src = src;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [src]);

  const lw = () => Math.max(5, Math.round((img.current?.width || 800) / 120));
  function draw(list, extra) {
    const c = cv.current, i = img.current; if (!c || !i) return;
    c.width = i.width; c.height = i.height;
    const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    g.lineCap = 'round'; g.lineJoin = 'round';
    [...list, ...(extra ? [extra] : [])].forEach((s) => {
      g.strokeStyle = s.color; g.fillStyle = s.color; g.lineWidth = lw(); g.beginPath();
      if (s.t === 'free') { s.p.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); }
      else if (s.t === 'circle') { const cx = (s.a.x + s.b.x) / 2, cy = (s.a.y + s.b.y) / 2; g.ellipse(cx, cy, Math.abs(s.b.x - s.a.x) / 2 || 1, Math.abs(s.b.y - s.a.y) / 2 || 1, 0, 0, Math.PI * 2); g.stroke(); }
      else if (s.t === 'arrow') {
        const { a, b } = s, ang = Math.atan2(b.y - a.y, b.x - a.x), h = lw() * 5;
        g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.beginPath();
        g.moveTo(b.x, b.y); g.lineTo(b.x - h * Math.cos(ang - 0.45), b.y - h * Math.sin(ang - 0.45)); g.lineTo(b.x - h * Math.cos(ang + 0.45), b.y - h * Math.sin(ang + 0.45)); g.closePath(); g.fill();
      }
    });
  }
  useEffect(() => {
    if (!ready) return; draw(shapes, live);
    if (sel >= 0 && shapes[sel]) { // marco punteado de la marca seleccionada (solo en pantalla, no en la foto final)
      const b = bbox(shapes[sel]), m = lw() * 2, g = cv.current.getContext('2d');
      g.save(); g.strokeStyle = '#1f6bf0'; g.lineWidth = Math.max(3, lw() / 2); g.setLineDash([lw() * 2, lw() * 1.5]);
      g.strokeRect(b.x1 - m, b.y1 - m, b.x2 - b.x1 + 2 * m, b.y2 - b.y1 + 2 * m); g.restore();
    }
    /* eslint-disable-next-line */
  }, [ready, shapes, live, sel]);

  const pt = (e) => { const r = cv.current.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * cv.current.width, y: ((e.clientY - r.top) / r.height) * cv.current.height }; };
  const down = (e) => {
    e.preventDefault(); cv.current.setPointerCapture(e.pointerId); const p = pt(e);
    if (tool === 'select') {
      let k = -1; for (let i = shapes.length - 1; i >= 0; i--) if (hit(shapes[i], p, lw() * 3)) { k = i; break; }
      setSel(k); drag.current = k >= 0 ? p : null; return;
    }
    setSel(-1); setLive(tool === 'free' ? { t: 'free', color, p: [p] } : { t: tool, color, a: p, b: p }); };
  const move = (e) => {
    if (tool === 'select') { if (drag.current && sel >= 0) { const p = pt(e), d = drag.current; drag.current = p; setShapes((l) => l.map((x, i) => (i === sel ? moveS(x, p.x - d.x, p.y - d.y) : x))); } return; }
    if (!live) return; const p = pt(e); setLive(live.t === 'free' ? { ...live, p: [...live.p, p] } : { ...live, b: p }); };
  const up = () => { drag.current = null; if (!live) return; setShapes((s) => [...s, live]); setLive(null); };
  const done = () => { setSel(-1); draw(shapes, null); onDone(cv.current.toDataURL('image/jpeg', 0.8)); };

  return createPortal(
    <div className="pm" role="dialog" aria-label="Marcar foto">
      <div className="pm-top">
        <button type="button" className="photo-back" style={{ position: 'static' }} onClick={onCancel}>✕ Cancelar</button>
        <b>Marca el hallazgo</b>
        <button type="button" className="pm-ok" onClick={done} disabled={!ready}>Listo ✓</button>
      </div>
      <div className="pm-stage" ref={box}>
        <canvas ref={cv} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      </div>
      <div className="pm-bar">
        {[['circle', '◯', 'Círculo'], ['arrow', '↗', 'Flecha'], ['free', '✎', 'Libre'], ['select', '✥', 'Mover']].map(([k, ic, l]) => (
          <button key={k} type="button" className={`pm-t ${tool === k ? 'on' : ''}`} onClick={() => { setTool(k); if (k !== 'select') setSel(-1); }}><i>{ic}</i><span>{l}</span></button>))}
        <span className="pm-sep" />
        {COLORS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} className={`pm-c ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />)}
        <span className="pm-sep" />
        <button type="button" className="pm-t" disabled={sel < 0} onClick={() => setShapes((l) => l.map((x, i) => (i === sel ? scaleS(x, 1.2) : x)))}><i>＋</i><span>Agrandar</span></button>
        <button type="button" className="pm-t" disabled={sel < 0} onClick={() => setShapes((l) => l.map((x, i) => (i === sel ? scaleS(x, 1 / 1.2) : x)))}><i>－</i><span>Achicar</span></button>
        <button type="button" className="pm-t" disabled={sel < 0} onClick={() => { setShapes((l) => l.filter((_, i) => i !== sel)); setSel(-1); }}><i>🗑</i><span>Borrar</span></button>
        <button type="button" className="pm-t" disabled={!shapes.length} onClick={() => { setShapes((l) => l.slice(0, -1)); setSel(-1); }}><i>↶</i><span>Deshacer</span></button>
      </div>
    </div>, document.body);
}
