'use client';
import { useEffect, useState } from 'react';
import Shell, { useUser } from '@/components/Shell';
import { api, fmtDate } from '@/lib/client';
import { canPanel } from '@/lib/roles';

// Layout de planta digitalizado: cada zona es un bloque que se pinta según los hallazgos recientes
const BLOCKS = [
  ['Shipping', 10, 60, 170, 300, 'Shipping / Docks'], ['Receiving', 190, 200, 70, 160, 'Receiving'],
  ['E2', 270, 60, 120, 145, 'E2'], ['E1', 270, 215, 120, 145, 'E1'], ['D2', 400, 60, 120, 145, 'D2'], ['D1', 400, 215, 120, 145, 'D1'],
  ['C2', 530, 60, 58, 145, 'C2'], ['C3', 592, 60, 58, 145, 'C3'], ['C1', 530, 215, 120, 145, 'C1'],
  ['B2', 660, 60, 120, 145, 'B2'], ['B1', 660, 215, 120, 145, 'B1'], ['A2', 790, 60, 120, 145, 'A2'], ['A1', 790, 215, 120, 145, 'A1'],
  ['Toolroom', 660, 6, 120, 44, 'Tool Shop'], ['PL4', 790, 6, 120, 44, 'PL4'], ['PL1', 920, 60, 70, 70, 'PL1'], ['PL3', 920, 140, 70, 70, 'PL3'],
  ['QIA', 270, 372, 200, 34, 'QIA'], ['Proveedores', 480, 372, 200, 34, 'Proveedores'],
];
const heat = (z) => !z ? '#c9ced8' : !z.audits ? '#c9ced8' : z.findings === 0 ? '#2e9e5b' : z.findings <= 2 ? '#e7c23a' : z.findings <= 5 ? '#f08a24' : '#d11d2a';

function Heat() {
  const [d, setD] = useState(null), [days, setDays] = useState(30), [sel, setSel] = useState(''), [err, setErr] = useState('');
  useEffect(() => { setD(null); api(`/api/heatmap?days=${days}`).then(setD).catch((e) => setErr(e.message)); }, [days]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  const z = sel ? d.zones[sel] : null;
  return (
    <>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '4px 0 8px' }}>{[[7, '7 días'], [30, '30 días'], [90, '90 días']].map(([n, l]) => <button key={n} type="button" className={`btn sm ${days === n ? '' : 'alt'}`} onClick={() => setDays(n)}>{l}</button>)}</div>
      <div className="lyt-box"><svg viewBox="0 0 1000 415" width="100%" role="img" aria-label="Mapa de calor de la planta">
        {BLOCKS.map(([k, x, y, w, h, label]) => { const v = d.zones[k]; return (
          <g key={k} onClick={() => setSel(k)} style={{ cursor: 'pointer' }}>
            <rect x={x} y={y} width={w} height={h} rx="10" fill={heat(v)} stroke={sel === k ? '#0b3a8c' : '#fff'} strokeWidth={sel === k ? 4 : 2} />
            <text x={x + w / 2} y={y + h / 2 - 2} textAnchor="middle" fontSize={w < 80 ? 13 : 17} fontWeight="700" fill="#fff">{label}</text>
            <text x={x + w / 2} y={y + h / 2 + 18} textAnchor="middle" fontSize="12" fill="#fff">{v?.audits ? `${v.findings} hallazgo(s)` : 'sin auditar'}</text>
          </g>); })}
      </svg></div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', fontSize: 12, margin: '8px 0' }}>
        {[['#2e9e5b', 'Sin hallazgos'], ['#e7c23a', '1–2'], ['#f08a24', '3–5'], ['#d11d2a', '6 o más'], ['#c9ced8', 'Sin auditorías en el periodo']].map(([c, t]) => <span key={t}><i style={{ display: 'inline-block', width: 12, height: 12, background: c, borderRadius: 3, marginRight: 4 }} />{t}</span>)}</div>
      {z ? <div className="card">
        <b>{sel}</b> · {z.audits} auditoría(s) y {z.findings} hallazgo(s) en {days} días · {z.open} abierto(s){z.unaudited ? ` · ${z.unaudited} máquina(s) sin auditar en 90 días` : ''}
        <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>{z.machines.length ? z.machines.map((m) => (
          <div key={m.name} className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}><b>{m.name}</b>
            <span className="sub" style={{ margin: 0 }}>{m.findings} hallazgo(s){m.open ? ` (${m.open} abiertos)` : ''} · {m.last ? `última ${fmtDate(m.last, { day: 'numeric', month: 'short' })}` : 'sin auditar en 90 días'}</span></div>)) : <span className="sub">Esta zona no tiene máquinas registradas.</span>}</div>
      </div> : <div className="sub">Toca una zona para ver sus máquinas.</div>}
    </>);
}

function Photo() {
  const [z, setZ] = useState(1);
  return (
    <>
      <div className="row" style={{ gap: 6, marginBottom: 8 }}>
        <button type="button" className="btn alt sm" onClick={() => setZ((v) => Math.max(1, v - 0.5))}>−</button>
        <button type="button" className="btn alt sm" onClick={() => setZ((v) => Math.min(5, v + 0.5))}>+</button>
        <button type="button" className="btn alt sm" onClick={() => setZ(1)}>Restablecer</button>
        <a className="btn alt sm" href="/layout-mpq.jpg" target="_blank" rel="noreferrer">Abrir imagen</a>
      </div>
      <div className="lyt-box"><img src="/layout-mpq.jpg" alt="Layout MPQ" style={{ width: `${z * 100}%`, maxWidth: 'none' }} /></div>
    </>);
}

function Inner() {
  const user = useUser(), heatOk = canPanel(user), [tab, setTab] = useState(heatOk ? 'heat' : 'photo');
  return (
    <>
      <div className="sect">Layout de planta MPQ</div>
      {heatOk && <div className="row" style={{ gap: 6, marginBottom: 8 }}>
        <button type="button" className={`btn sm ${tab === 'heat' ? '' : 'alt'}`} onClick={() => setTab('heat')}>Mapa de calor</button>
        <button type="button" className={`btn sm ${tab === 'photo' ? '' : 'alt'}`} onClick={() => setTab('photo')}>Plano original</button></div>}
      {tab === 'heat' ? <Heat /> : <Photo />}
      <style>{`.lyt-box{overflow:auto;border:1px solid var(--line,#ddd);border-radius:12px;background:#fff;max-height:70vh;touch-action:pan-x pan-y pinch-zoom}.lyt-box img{display:block}`}</style>
    </>);
}

export default function Page() { return <Shell><Inner /></Shell>; }
