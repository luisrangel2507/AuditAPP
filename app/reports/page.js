'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { api, fmtDate, DEPT, useUrlState } from '@/lib/client';

const PRESETS = [['7', '7 días'], ['28', '4 semanas'], ['90', '3 meses'], ['mes', 'Este mes'], ['mesant', 'Mes pasado'], ['custom', 'Personalizado']];
const BY = [['item', 'Ítem'], ['zone', 'Zona'], ['machine', 'Máquina'], ['part', 'N/P']];
const iso = (d) => d.toISOString().slice(0, 10);
const mxToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

function Inner() {
  const [per, setPer] = useUrlState('p', '28'), [f0, setF0] = useUrlState('f', ''), [t0, setT0] = useUrlState('t', ''), [by, setBy] = useUrlState('by', 'item');
  const [par, setPar] = useState(null), [rep, setRep] = useState(null), [comp, setComp] = useState(null), [err, setErr] = useState(''), [openComp, setOpenComp] = useState(false);
  const today = mxToday();
  // Rango efectivo según el periodo elegido
  let q;
  if (per === 'custom' && f0 && t0) q = `from=${f0}&to=${t0}`;
  else if (per === 'mes') q = `from=${today.slice(0, 8)}01&to=${today}`;
  else if (per === 'mesant') { const d = new Date(`${today.slice(0, 8)}01T12:00:00Z`); d.setUTCDate(0); q = `from=${iso(d).slice(0, 8)}01&to=${iso(d)}`; }
  else q = `days=${['7', '28', '90'].includes(per) ? per : 28}`;
  useEffect(() => { let on = true; setPar(null); api(`/api/admin/reports/pareto?${q}&by=${by}`).then((d) => on && setPar(d)).catch((e) => on && setErr(e.message)); return () => { on = false; }; /* eslint-disable-next-line */ }, [q, by]);
  useEffect(() => {
    let on = true; setRep(null); setComp(null);
    api(`/api/admin/reports/repeats?${q}`).then((d) => on && setRep(d.items)).catch(() => {});
    api(`/api/admin/reports/compliance?${q}`).then((d) => on && setComp(d)).catch(() => {});
    return () => { on = false; };
    // eslint-disable-next-line
  }, [q]);
  const max = par?.rows?.[0]?.n || 1;
  const dl = (type) => <a className="btn alt sm" href={`/api/admin/export?type=${type}&${q}`} download>⬇ {({ compliance: 'Cumplimiento', issues: 'Issues', audits: 'Auditorías', assignments: 'Asignación semanal' })[type]}</a>;
  const rng = par || comp;
  return (
    <>
      <h1 className="title">Reportes</h1>
      <div className="rp-period">
        <div className="seg">{PRESETS.map(([k, l]) => <button key={k} className={per === k ? 'on' : ''} onClick={() => { setPer(k); if (k === 'custom' && !f0) { setF0(`${today.slice(0, 8)}01`); setT0(today); } }}>{l}</button>)}</div>
        {per === 'custom' && <div className="rp-dates"><label>Del<input className="inp" type="date" max={today} value={f0} onChange={(e) => setF0(e.target.value)} /></label><label>Al<input className="inp" type="date" max={today} value={t0} onChange={(e) => setT0(e.target.value)} /></label></div>}
        {rng && <div className="sub" style={{ margin: 0 }}>Periodo: <b>{fmtDate(rng.from, { day: 'numeric', month: 'short', year: 'numeric' })} – {fmtDate(rng.to, { day: 'numeric', month: 'short', year: 'numeric' })}</b></div>}
      </div>
      {err && <div className="err">{err}</div>}

      <div className="rp-sec"><h2>Reportes para imprimir</h2>
        <div className="rp-links">
          <Link href="/reports/weekly" className="rep-link"><b>Reporte semanal (imprimir / PDF)</b></Link>
          <Link href="/reports/qeform" className="rep-link"><b>Formato impreso por Layer (QEs, Gerente de Calidad…)</b></Link>
        </div></div>

      <div className="rp-sec"><h2>Pareto de hallazgos</h2>
        <div className="seg" style={{ margin: '6px 0 10px' }}>{BY.map(([k, l]) => <button key={k} className={by === k ? 'on' : ''} onClick={() => setBy(k)}>{l}</button>)}</div>
        {!par ? <div className="empty">Cargando…</div> : !par.rows.length ? <div className="card empty">Sin hallazgos en el periodo.</div> : (
          <div className="card">
            <div className="sub" style={{ margin: '0 0 8px' }}>{par.total} hallazgo(s)</div>
            {par.rows.map((r, i) => (
              <div className="bar" key={i} style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) auto' }}>
                <span style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{r.label}</span>
                <div className="track"><i className={r.nok ? 'nok' : 'warn'} style={{ width: `${(r.n / max) * 100}%` }} /></div>
                <em>{r.n} · {r.cum}%</em>
              </div>))}
            <div className="sub" style={{ margin: '8px 0 0', fontSize: 11 }}>El % es el acumulado: los primeros renglones concentran la mayor parte de los hallazgos.</div>
          </div>)}</div>

      <div className="rp-sec"><h2>Hallazgos repetidos</h2>
        {!rep ? <div className="empty">Cargando…</div> : !rep.length ? <div className="card empty">Ningún ítem se repitió 2 o más veces en la misma zona.</div> : rep.map((r, i) => (
          <div className="card" key={i} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 14, textAlign: 'justify' }}>{r.item ? <b>Ítem {r.item} · </b> : null}{r.question}</div>
            <div className="row wrap" style={{ marginTop: 6 }}><span className="pill nok">{r.n} veces</span><span className="pill">{r.area}</span><span className="pill">último {fmtDate(String(r.last).slice(0, 10), { day: 'numeric', month: 'short' })}</span></div>
          </div>))}</div>

      <div className="rp-sec"><h2>Cumplimiento por persona</h2>
        {!comp ? <div className="empty">Cargando…</div> : (
          <div className="card rp-comp">
            <button type="button" className="rp-ch" onClick={() => setOpenComp(!openComp)} aria-expanded={openComp}>
              <span>General: <b>{comp.pct}%</b> <small>({comp.done} de {comp.total} auditorías · {comp.rows.length} personas)</small></span>
              <i className={openComp ? 'on' : ''} aria-hidden="true">›</i>
            </button>
            {openComp && <div style={{ marginTop: 10 }}>
              {comp.rows.map((p) => (
                <div className="bar" key={p.id} style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) auto' }}>
                  <span style={{ fontSize: 13 }}>{p.name}<small style={{ display: 'block', color: 'var(--sub)' }}>{DEPT[p.dept]} · L{p.layer}</small></span>
                  <div className="track"><i className={p.pct >= 90 ? 'ok' : p.pct >= 70 ? 'warn' : 'nok'} style={{ width: `${p.pct}%` }} /></div>
                  <em>{p.done}/{p.total} · {p.pct}%</em>
                </div>))}
              {!comp.rows.length && <div className="sub">Sin auditorías programadas en el periodo.</div>}
            </div>}
          </div>)}</div>

      <div className="rp-sec"><h2>Descargas para Excel</h2>
        <div className="row wrap" style={{ gap: 8 }}>{dl('compliance')}{dl('issues')}{dl('audits')}{dl('assignments')}</div>
        <div className="sub" style={{ marginTop: 6 }}>Archivos .csv que abre Excel directo, con el periodo seleccionado.</div></div>

      <div className="rp-sec"><h2>Respaldo</h2>
        <div className="row wrap" style={{ gap: 8 }}>
          <a className="btn alt sm" href="/api/admin/backup" download>⬇ Respaldo completo (JSON)</a>
          <a className="btn alt sm" href="/api/admin/backup?fotos=1" download>⬇ Con fotos (pesa más)</a>
        </div>
        <div className="sub" style={{ marginTop: 6 }}>Incluye usuarios, preguntas y sus versiones, auditorías, respuestas, issues y bitácora. No incluye contraseñas. El respaldo no depende del periodo.</div></div>
    </>
  );
}
export default function ReportsPage() { return <Shell need="admin"><Inner /></Shell>; }
