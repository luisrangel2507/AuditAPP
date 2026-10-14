'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Editor para marcar la foto del hallazgo: círculo, flecha y trazo libre en rojo. Devuelve la foto con las marcas.
const COLORS = ['#ff2b2b', '#ffd400', '#22e06b', '#ffffff'];

export default function PhotoMark({ src, onDone, onCancel }) {
  const cv = useRef(null), img = useRef(null), box = useRef(null);
  const [tool, setTool] = useState('circle'), [color, setColor] = useState(COLORS[0]);
  const [shapes, setShapes] = useState([]), [live, setLive] = useState(null), [ready, setReady] = useState(false);

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
  useEffect(() => { if (ready) draw(shapes, live); /* eslint-disable-next-line */ }, [ready, shapes, live]);

  const pt = (e) => { const r = cv.current.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * cv.current.width, y: ((e.clientY - r.top) / r.height) * cv.current.height }; };
  const down = (e) => { e.preventDefault(); cv.current.setPointerCapture(e.pointerId); const p = pt(e); setLive(tool === 'free' ? { t: 'free', color, p: [p] } : { t: tool, color, a: p, b: p }); };
  const move = (e) => { if (!live) return; const p = pt(e); setLive(live.t === 'free' ? { ...live, p: [...live.p, p] } : { ...live, b: p }); };
  const up = () => { if (!live) return; setShapes((s) => [...s, live]); setLive(null); };
  const done = () => { draw(shapes, null); onDone(cv.current.toDataURL('image/jpeg', 0.8)); };

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
        {[['circle', '◯', 'Círculo'], ['arrow', '↗', 'Flecha'], ['free', '✎', 'Libre']].map(([k, ic, l]) => (
          <button key={k} type="button" className={`pm-t ${tool === k ? 'on' : ''}`} onClick={() => setTool(k)}><i>{ic}</i><span>{l}</span></button>))}
        <span className="pm-sep" />
        {COLORS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} className={`pm-c ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />)}
        <span className="pm-sep" />
        <button type="button" className="pm-t" disabled={!shapes.length} onClick={() => setShapes((s) => s.slice(0, -1))}><i>↶</i><span>Deshacer</span></button>
      </div>
    </div>, document.body);
}
