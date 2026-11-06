'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate, DEPT } from '@/lib/client';

const addD = (s, n) => { const t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const oi = (id) => 'OI-' + String(id).padStart(4, '0');

function Inner() {
  const q0 = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [period, setPeriod] = useState(q0.get('period') === 'month' ? 'month' : 'week'), [date, setDate] = useState(q0.get('date') || ''), [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => { setD(null); api(`/api/reports/resumen?period=${period}${date ? `&date=${date}` : ''}`).then(setD).catch((e) => setErr(e.message)); }, [period, date]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  const step = (n) => setDate(period === 'month' ? (() => { const t = new Date(d.from + 'T12:00:00Z'); t.setUTCMonth(t.getUTCMonth() + n); return t.toISOString().slice(0, 10); })() : addD(d.from, n * 7));
  const title = period === 'month' ? `Mes de ${fmtDate(d.from, { month: 'long', year: 'numeric' })}` : `Semana ${fmtDate(d.from, { day: 'numeric', month: 'short' })} – ${fmtDate(d.to, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const sm = d.summary, f = d.findings;
  return (
    <div className="rsm">
      <div className="row rsm-bar"><button className="btn alt sm" onClick={() => step(-1)}>‹</button><div className="grow" style={{ textAlign: 'center' }}>{title}</div><button className="btn alt sm" onClick={() => step(1)}>›</button>
        <button className="btn sm" onClick={() => window.print()}>Imprimir / PDF</button></div>
      <div className="row rsm-bar"><button className={`btn sm ${period === 'week' ? '' : 'alt'}`} onClick={() => { setPeriod('week'); setDate(''); }}>Semanal</button><button className={`btn sm ${period === 'month' ? '' : 'alt'}`} onClick={() => { setPeriod('month'); setDate(''); }}>Mensual</button></div>
      <h1 className="title">Reporte {period === 'month' ? 'mensual' : 'semanal'} · {DEPT[d.scope] || d.scope}</h1>
      <div className="wk-kpis">
        <div><b>{sm.pct}%</b><span>Cumplimiento ({sm.done}/{sm.total})</span></div>
        <div><b>{sm.missed}</b><span>No realizadas</span></div>
        <div><b>{f.opened}</b><span>Hallazgos nuevos</span></div>
        <div><b>{f.closed}</b><span>Issues cerrados</span></div>
        <div><b>{f.open_now}</b><span>Abiertos ({f.overdue} vencidos{f.review ? `, ${f.review} en revisión` : ''})</span></div>
        <div><b>{sm.score ?? '—'}{sm.score != null ? '%' : ''}</b><span>Calificación promedio</span></div>
      </div>
      <div className="rp-sec"><h2>Cumplimiento por persona</h2>
        <table className="rsm-t"><thead><tr><th>Persona</th><th>Hechas</th><th>Programadas</th><th>Tarde</th><th>No realizadas</th><th>Hallazgos</th><th>%</th></tr></thead>
          <tbody>{d.people.map((p) => <tr key={p.id} className={p.pct < 80 ? 'bad' : ''}><td>{p.name}</td><td>{p.done}</td><td>{p.total}</td><td>{p.late}</td><td>{p.missed}</td><td>{p.findings}</td><td><b>{p.pct}%</b></td></tr>)}
            {!d.people.length && <tr><td colSpan={7}>Sin auditorías en el periodo.</td></tr>}</tbody></table></div>
      {d.zones.length > 0 && <div className="rp-sec"><h2>Zonas y máquinas con más hallazgos</h2>
        <table className="rsm-t"><tbody>{d.zones.map((z, i) => <tr key={i}><td>{z.zone}{z.machine ? ` · ${z.machine}` : ''}</td><td><b>{z.n}</b></td></tr>)}</tbody></table></div>}
      {d.repeats.length > 0 && <div className="rp-sec"><h2>Hallazgos repetidos</h2>
        <table className="rsm-t"><tbody>{d.repeats.map((r, i) => <tr key={i}><td>{r.question}</td><td>{r.area}</td><td><b>{r.n}×</b></td></tr>)}</tbody></table></div>}
      <div className="rp-sec"><h2>Issues vencidos</h2>
        {d.overdue.length ? <table className="rsm-t"><tbody>{d.overdue.map((o) => <tr key={o.id}><td>{oi(o.id)}</td><td>{o.question}</td><td>{o.area}</td><td>{o.owners}</td><td>vencía {fmtDate(o.due, { day: 'numeric', month: 'short' })}</td></tr>)}</tbody></table> : <div className="sub">Sin issues vencidos.</div>}</div>
      <style>{`.rsm{max-width:1000px;margin:0 auto}.rsm-bar{gap:6px;margin-bottom:8px;flex-wrap:wrap}.rsm-t{width:100%;border-collapse:collapse;font-size:13px}.rsm-t th,.rsm-t td{border-bottom:1px solid var(--line2);padding:6px 8px;text-align:left}.rsm-t tr.bad td{background:rgba(209,29,42,.08)}
        @media print{.rsm-bar,.crumb{display:none}}`}</style>
    </div>);
}
export default function Page() { return <Shell><Inner /></Shell>; }
