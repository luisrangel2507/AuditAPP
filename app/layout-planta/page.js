'use client';
import { useState } from 'react';
import Shell from '@/components/Shell';

function Inner() {
  const [z, setZ] = useState(1);
  return (
    <>
      <div className="sect">Layout de planta MPQ</div>
      <div className="sub" style={{ marginBottom: 8 }}>Referencia de zonas (A a E, Tool Shop, PL4, Shipping Docks, Receiving, Resin Storage). Acerca con los botones o con los dedos.</div>
      <div className="row" style={{ gap: 6, marginBottom: 8 }}>
        <button type="button" className="btn alt sm" onClick={() => setZ((v) => Math.max(1, v - 0.5))}>−</button>
        <button type="button" className="btn alt sm" onClick={() => setZ((v) => Math.min(5, v + 0.5))}>+</button>
        <button type="button" className="btn alt sm" onClick={() => setZ(1)}>Restablecer</button>
        <a className="btn alt sm" href="/layout-mpq.jpg" target="_blank" rel="noreferrer">Abrir imagen</a>
      </div>
      <div className="lyt-box"><img src="/layout-mpq.jpg" alt="Layout MPQ" style={{ width: `${z * 100}%`, maxWidth: 'none' }} /></div>
      <style>{`.lyt-box{overflow:auto;border:1px solid var(--line,#ddd);border-radius:12px;background:#fff;max-height:70vh;touch-action:pan-x pan-y pinch-zoom}.lyt-box img{display:block}`}</style>
    </>);
}

export default function Page() { return <Shell><Inner /></Shell>; }
