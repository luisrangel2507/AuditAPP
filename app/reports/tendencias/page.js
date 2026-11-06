'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate, DEPT } from '@/lib/client';

function Inner() {
  const [days, setDays] = useState(90), [d, setD] = useState(null), [err, setErr] = useState(''), [only, setOnly] = useState(false);
  useEffect(() => { setD(null); api(`/api/admin/reports/tendencias?days=${days}`).then(setD).catch((e) => setErr(e.message)); }, [days]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  const rows = only ? d.people.filter((p) => p.flags.length) : d.people;
  return (
    <div className="tnd">
      <div className="crumb" style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 8 }}><a href="/admin" style={{ color: 'inherit' }}>Administración</a> › <a href="/reports" style={{ color: 'inherit' }}>Reportes</a> › <b>Tendencias por persona</b></div>
      <h1 className="title">Tendencias por persona</h1>
      <p className="sub">Del {fmtDate(d.from, { day: 'numeric', month: 'short' })} al {fmtDate(d.to, { day: 'numeric', month: 'short', year: 'numeric' })}. Promedio de hallazgos por auditoría: <b>{d.avg_findings}</b>. Las alertas son indicios para revisar, no conclusiones.</p>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>{[[30, '30 días'], [90, '90 días'], [180, '6 meses']].map(([n, l]) => <button key={n} className={`btn sm ${days === n ? '' : 'alt'}`} onClick={() => setDays(n)}>{l}</button>)}
        <button className={`btn sm ${only ? '' : 'alt'}`} onClick={() => setOnly(!only)}>Solo con alertas</button><button className="btn alt sm" onClick={() => window.print()}>Imprimir / PDF</button></div>
      <div style={{ overflowX: 'auto' }}><table className="tnd-t"><thead><tr><th>Persona</th><th>Cumpl.</th><th>Tendencia</th><th>Tarde</th><th>Hallazgos / aud.</th><th>Sin hallazgos</th><th>Duración prom.</th><th>Alertas</th></tr></thead>
        <tbody>{rows.map((p) => <tr key={p.id}><td><b>{p.name}</b><br /><small>{DEPT[p.dept] || p.dept} · L{p.layer}</small></td>
          <td>{p.pct ?? '—'}%<br /><small>{p.done}/{p.total}</small></td>
          <td>{p.trend == null ? '—' : p.trend > 0 ? <span style={{ color: '#0e9f6e' }}>▲ {p.trend} pts</span> : p.trend < 0 ? <span style={{ color: '#d11d2a' }}>▼ {Math.abs(p.trend)} pts</span> : '＝'}</td>
          <td>{p.late_pct ?? '—'}%</td><td>{p.per_audit}</td><td>{p.clean_pct ?? '—'}%</td><td>{p.avg_min ?? '—'} min</td>
          <td>{p.flags.length ? p.flags.map((f) => <span key={f} className="pill warn" style={{ display: 'inline-block', margin: '0 4px 4px 0' }}>{f}</span>) : <span className="sub" style={{ margin: 0 }}>—</span>}</td></tr>)}
          {!rows.length && <tr><td colSpan={8}>Sin datos en el periodo.</td></tr>}</tbody></table></div>
      <style>{`.tnd{max-width:1100px;margin:0 auto}.tnd-t{width:100%;border-collapse:collapse;font-size:13px}.tnd-t th,.tnd-t td{border-bottom:1px solid var(--line2);padding:7px 8px;text-align:left;vertical-align:top}.tnd-t small{color:var(--sub)}@media print{.crumb,.btn{display:none}}`}</style>
    </div>);
}
export default function Page() { return <Shell><Inner /></Shell>; }
