'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { api, fmtDate, DEPT, useUrlState } from '@/lib/client';

const PERIODS = [[7, '7 días'], [28, '4 semanas'], [90, '3 meses']];
const BY = [['item', 'Ítem'], ['zone', 'Zona'], ['machine', 'Máquina'], ['part', 'N/P']];

function Inner() {
  const [days, setDays] = useUrlState('d', 28), [by, setBy] = useUrlState('by', 'item');
  const [par, setPar] = useState(null), [rep, setRep] = useState(null), [comp, setComp] = useState(null), [err, setErr] = useState('');
  useEffect(() => { setPar(null); api(`/api/admin/reports/pareto?days=${days}&by=${by}`).then(setPar).catch((e) => setErr(e.message)); }, [days, by]);
  useEffect(() => {
    setRep(null); setComp(null);
    api(`/api/admin/reports/repeats?days=${days}`).then((d) => setRep(d.items)).catch(() => {});
    api(`/api/admin/reports/compliance?days=${days}`).then(setComp).catch(() => {});
  }, [days]);
  const max = par?.rows?.[0]?.n || 1;
  const dl = (type) => <a className="btn alt sm" href={`/api/admin/export?type=${type}&days=${days}`} download>⬇ {({ compliance: 'Cumplimiento', issues: 'Issues', audits: 'Auditorías', assignments: 'Asignación semanal' })[type]}</a>;
  return (
    <>
      <h1 className="title">Reportes</h1>
      <div className="seg" style={{ margin: '10px 0' }}>{PERIODS.map(([n, l]) => <button key={n} className={days === n ? 'on' : ''} onClick={() => setDays(n)}>{l}</button>)}</div>
      {err && <div className="err">{err}</div>}

      <Link href="/reports/weekly" className="rep-link" style={{ marginBottom: 12 }}><b>Reporte semanal (imprimir / PDF)</b></Link>

      <div className="sect">Descargas para Excel</div>
      <div className="row wrap" style={{ gap: 8 }}>{dl('compliance')}{dl('issues')}{dl('audits')}{dl('assignments')}</div>
      <div className="sub" style={{ marginTop: 6 }}>Archivos .csv que abre Excel directo, con el periodo seleccionado.</div>

      <div className="sect" style={{ marginTop: 18 }}>Respaldo</div>
      <div className="row wrap" style={{ gap: 8 }}>
        <a className="btn alt sm" href="/api/admin/backup" download>⬇ Respaldo completo (JSON)</a>
        <a className="btn alt sm" href="/api/admin/backup?fotos=1" download>⬇ Con fotos (pesa más)</a>
      </div>
      <div className="sub" style={{ marginTop: 6 }}>Incluye usuarios, preguntas y sus versiones, auditorías, respuestas, issues y bitácora. No incluye contraseñas.</div>

      <div className="sect" style={{ marginTop: 18 }}>Pareto de hallazgos</div>
      <div className="seg" style={{ margin: '6px 0 10px' }}>{BY.map(([k, l]) => <button key={k} className={by === k ? 'on' : ''} onClick={() => setBy(k)}>{l}</button>)}</div>
      {!par ? <div className="empty">Cargando…</div> : !par.rows.length ? <div className="card empty">Sin hallazgos en el periodo.</div> : (
        <div className="card">
          <div className="sub" style={{ margin: '0 0 8px' }}>{par.total} hallazgo(s) · {fmtDate(par.from, { day: 'numeric', month: 'short' })} – {fmtDate(par.to, { day: 'numeric', month: 'short' })}</div>
          {par.rows.map((r, i) => (
            <div className="bar" key={i} style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) auto' }}>
              <span style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{r.label}</span>
              <div className="track"><i className={r.nok ? 'nok' : 'warn'} style={{ width: `${(r.n / max) * 100}%` }} /></div>
              <em>{r.n} · {r.cum}%</em>
            </div>))}
          <div className="sub" style={{ margin: '8px 0 0', fontSize: 11 }}>El % es el acumulado: los primeros renglones concentran la mayor parte de los hallazgos.</div>
        </div>)}

      <div className="sect" style={{ marginTop: 18 }}>Hallazgos repetidos</div>
      {!rep ? <div className="empty">Cargando…</div> : !rep.length ? <div className="card empty">Ningún ítem se repitió 2 o más veces en la misma zona.</div> : rep.map((r, i) => (
        <div className="card" key={i} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, textAlign: 'justify' }}>{r.item ? <b>Ítem {r.item} · </b> : null}{r.question}</div>
          <div className="row wrap" style={{ marginTop: 6 }}><span className="pill nok">{r.n} veces</span><span className="pill">{r.area}</span><span className="pill">último {fmtDate(String(r.last).slice(0, 10), { day: 'numeric', month: 'short' })}</span></div>
        </div>))}

      <div className="sect" style={{ marginTop: 18 }}>Cumplimiento por persona</div>
      {!comp ? <div className="empty">Cargando…</div> : (
        <div className="card">
          <div className="sub" style={{ margin: '0 0 8px' }}>General: <b>{comp.pct}%</b> ({comp.done} de {comp.total} auditorías)</div>
          {comp.rows.map((p) => (
            <div className="bar" key={p.id} style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) auto' }}>
              <span style={{ fontSize: 13 }}>{p.name}<small style={{ display: 'block', color: 'var(--sub)' }}>{DEPT[p.dept]} · L{p.layer}</small></span>
              <div className="track"><i className={p.pct >= 90 ? 'ok' : p.pct >= 70 ? 'warn' : 'nok'} style={{ width: `${p.pct}%` }} /></div>
              <em>{p.done}/{p.total} · {p.pct}%</em>
            </div>))}
          {!comp.rows.length && <div className="sub">Sin auditorías programadas en el periodo.</div>}
        </div>)}
    </>
  );
}
export default function ReportsPage() { return <Shell need="admin"><Inner /></Shell>; }
