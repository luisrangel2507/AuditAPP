'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate, DEPT } from '@/lib/client';

const oi = (id) => 'OI-' + String(id).padStart(4, '0');
function Inner() {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  const [date, setDate] = useState(() => new URLSearchParams(window.location.search).get('date') || '');
  useEffect(() => { setD(null); api(`/api/admin/reports/weekly${date ? `?date=${date}` : ''}`).then(setD).catch((e) => setErr(e.message)); }, [date]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  const shift = (n) => { const t = new Date(d.monday + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n * 7); setDate(t.toISOString().slice(0, 10)); };
  return (
    <div className="wk">
      <div className="row wk-bar">
        <button className="btn alt sm" onClick={() => shift(-1)}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>Semana {fmtDate(d.monday, { day: 'numeric', month: 'short' })} – {fmtDate(d.friday, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        <button className="btn alt sm" onClick={() => shift(1)}>›</button>
        <button className="btn sm" onClick={() => window.print()}>Imprimir / PDF</button>
      </div>
      <h1 className="title">Reporte semanal LPA</h1>
      <div className="wk-kpis">
        <div><b>{d.summary.pct}%</b><span>Cumplimiento ({d.summary.done}/{d.summary.total})</span></div>
        <div><b>{d.findings.opened}</b><span>Hallazgos nuevos</span></div>
        <div><b>{d.findings.closed}</b><span>Issues cerrados</span></div>
        <div><b>{d.findings.open_now}</b><span>Abiertos ({d.findings.overdue} vencidos)</span></div>
      </div>

      <div className="sect">Hallazgos principales</div>
      {!d.top.length ? <div className="sub">Sin hallazgos esta semana.</div> : <ol className="wk-list">{d.top.map((r, i) => <li key={i}><span>{r.label}</span><b>{r.n}</b></li>)}</ol>}

      <div className="sect">Issues vencidos</div>
      {!d.overdue.length ? <div className="sub">Ninguno.</div> : <ol className="wk-list">{d.overdue.map((o) => <li key={o.id}><span><b>{oi(o.id)}</b> · {o.question}<small>{o.area} · {o.owners} · venció {fmtDate(String(o.due_date).slice(0, 10), { day: 'numeric', month: 'short' })}</small></span></li>)}</ol>}

      <div className="sect">Cumplimiento por persona</div>
      <table className="wk-table"><thead><tr><th>Persona</th><th>Depto</th><th>Hechas</th><th>%</th><th>Score</th><th>Hallazgos</th></tr></thead>
        <tbody>{d.people.map((p) => <tr key={p.id} className={p.pct < 70 ? 'bad' : p.pct < 90 ? 'mid' : ''}><td>{p.name}</td><td>{DEPT[p.dept]}</td><td>{p.done}/{p.total}</td><td>{p.pct}%</td><td>{p.score ?? '—'}</td><td>{p.findings}</td></tr>)}</tbody></table>
    </div>
  );
}
export default function WeeklyPage() { return <Shell need="admin"><Inner /></Shell>; }
