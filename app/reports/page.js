'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Shell, { useUser } from '@/components/Shell';
import AdminTabs from '@/components/AdminTabs';
import { api, fmtDate, DEPT, useUrlState } from '@/lib/client';
import { isMaster } from '@/lib/roles';

const PRESETS = [['7', '7 días'], ['28', '4 semanas'], ['90', '3 meses'], ['mes', 'Este mes'], ['mesant', 'Mes pasado'], ['custom', 'Personalizado']];
const BY = [['item', 'Ítem'], ['zone', 'Zona'], ['machine', 'Máquina'], ['part', 'N/P']];
const iso = (d) => d.toISOString().slice(0, 10);
const mxToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
const PRINT = '🖨 PDF';

function Inner() {
  const me = useUser(), router = useRouter();
  const [per, setPer] = useUrlState('p', '28'), [f0, setF0] = useUrlState('f', ''), [t0, setT0] = useUrlState('t', ''), [by, setBy] = useUrlState('by', 'item');
  const [par, setPar] = useState(null), [rep, setRep] = useState(null), [comp, setComp] = useState(null), [abs, setAbs] = useState(null), [err, setErr] = useState(''), [openComp, setOpenComp] = useState(false), [printing, setPrinting] = useState('');
  const today = mxToday();
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
    api('/api/admin/absences').then((d) => on && setAbs(d.rows)).catch(() => {});
    return () => { on = false; };
    // eslint-disable-next-line
  }, [q]);
  const rng = par || comp;
  const absIn = (abs || []).filter((a) => !rng || (a.date_to >= rng.from && a.date_from <= rng.to));
  const max = par?.rows?.[0]?.n || 1;
  const dl = (type) => <a className="btn alt sm" href={`/api/admin/export?type=${type}&${q}`} download>⬇ {({ compliance: 'Cumplimiento', issues: 'Issues', audits: 'Auditorías', assignments: 'Asignación semanal' })[type]}</a>;
  // Impresión / PDF de un reporte (o de todos): se oculta lo demás y se agrega el encabezado corporativo
  const root = useRef(null);
  function printIt(id) {
    setPrinting(id); setOpenComp(true);
    setTimeout(() => {
      const secs = [...root.current.querySelectorAll('.rp-sec')];
      secs.forEach((el) => el.classList.toggle('rp-on', id === 'all' ? !el.classList.contains('rp-skip') : el.dataset.sec === id));
      document.body.classList.add('rp-printing');
      const done = () => { document.body.classList.remove('rp-printing'); secs.forEach((el) => el.classList.remove('rp-on')); setPrinting(''); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done); window.print();
    }, 200);
  }
  const Head = ({ id, title, sub, noPdf }) => <div className="rp-h"><div><h2>{title}</h2>{sub && <div className="sub" style={{ margin: 0 }}>{sub}</div>}</div>{!noPdf && <button type="button" className="btn alt sm rp-pdf" onClick={() => printIt(id)} disabled={!!printing}>{PRINT}</button>}</div>;
  const period = rng ? `${fmtDate(rng.from, { day: 'numeric', month: 'short', year: 'numeric' })} – ${fmtDate(rng.to, { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
  const kp = comp ? [[`${comp.pct}%`, 'Cumplimiento general', `${comp.done} de ${comp.total} auditorías`], [par?.total ?? '—', 'Hallazgos (X y Δ)', 'en el periodo'], [rep?.length ?? '—', 'Hallazgos repetidos', 'ítems 2+ veces'], [absIn.length, 'Ausencias justificadas', 'no penalizan']] : [];
  return (
    <div ref={root}>
      <h1 className="title">Administración</h1>
      <AdminTabs active="reports" onSelect={(k) => router.push(`/admin?tab=${k}`)} me={me} master={isMaster(me)} />
      <div className="rp-crumb">Administración › <b>Reportes</b></div>

      <div className="rp-period norep">
        <div className="seg">{PRESETS.map(([k, l]) => <button key={k} className={per === k ? 'on' : ''} onClick={() => { setPer(k); if (k === 'custom' && !f0) { setF0(`${today.slice(0, 8)}01`); setT0(today); } }}>{l}</button>)}</div>
        {per === 'custom' && <div className="rp-dates"><label>Del<input className="inp" type="date" max={today} value={f0} onChange={(e) => setF0(e.target.value)} /></label><label>Al<input className="inp" type="date" max={today} value={t0} onChange={(e) => setT0(e.target.value)} /></label></div>}
        <span className="grow" />
        <button type="button" className="btn sm" onClick={() => printIt('all')} disabled={!!printing}>🖨 Imprimir todos los reportes (PDF)</button>
      </div>
      {err && <div className="err">{err}</div>}

      <div className="rp-phead"><img src="/mitchell-logo.png" alt="Mitchell Plastics" /><div><b>LPApp · Reporte de cumplimiento LPA</b><span>Periodo: {period} · {me.site_name || me.site_code || ''}</span><span>Generado: {new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'long', timeStyle: 'short' })} por {me.name}</span></div></div>

      <div className="rp-sec" data-sec="resumen">
        <Head id="resumen" title="Resumen ejecutivo" sub={period && `Periodo: ${period}`} />
        <div className="rp-kpis">{kp.map(([v, l, s]) => <div key={l}><b>{v}</b><span>{l}</span><small>{s}</small></div>)}{!kp.length && <div className="empty">Cargando…</div>}</div>
      </div>

      <div className="rp-sec" data-sec="pareto">
        <Head id="pareto" title="Pareto de hallazgos" sub="Dónde se concentran los hallazgos" />
        <div className="seg norep" style={{ margin: '6px 0 10px' }}>{BY.map(([k, l]) => <button key={k} className={by === k ? 'on' : ''} onClick={() => setBy(k)}>{l}</button>)}</div>
        {!par ? <div className="empty">Cargando…</div> : !par.rows.length ? <div className="card empty">Sin hallazgos en el periodo.</div> : (
          <div className="card">
            <div className="sub" style={{ margin: '0 0 8px' }}>{par.total} hallazgo(s) · por {BY.find((x) => x[0] === by)[1]}</div>
            {par.rows.map((r, i) => (
              <div className="bar" key={i} style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) auto' }}>
                <span style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{r.label}</span>
                <div className="track"><i className={r.nok ? 'nok' : 'warn'} style={{ width: `${(r.n / max) * 100}%` }} /></div>
                <em>{r.n} · {r.cum}%</em>
              </div>))}
            <div className="sub" style={{ margin: '8px 0 0', fontSize: 11 }}>El % es el acumulado: los primeros renglones concentran la mayor parte de los hallazgos.</div>
          </div>)}
      </div>

      <div className="rp-sec" data-sec="repetidos">
        <Head id="repetidos" title="Hallazgos repetidos" sub="Ítems que fallaron 2 o más veces en la misma zona" />
        {!rep ? <div className="empty">Cargando…</div> : !rep.length ? <div className="card empty">Ningún ítem se repitió 2 o más veces en la misma zona.</div> : rep.map((r, i) => (
          <div className="card rp-keep" key={i} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 14, textAlign: 'justify' }}>{r.item ? <b>Ítem {r.item} · </b> : null}{r.question}</div>
            <div className="row wrap" style={{ marginTop: 6 }}><span className="pill nok">{r.n} veces</span><span className="pill">{r.area}</span><span className="pill">último {fmtDate(String(r.last).slice(0, 10), { day: 'numeric', month: 'short' })}</span></div>
          </div>))}
      </div>

      <div className="rp-sec" data-sec="cumplimiento">
        <Head id="cumplimiento" title="Cumplimiento por persona" sub="Auditorías hechas contra programadas (las justificadas no cuentan)" />
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
          </div>)}
      </div>

      <div className="rp-sec" data-sec="ausencias">
        <Head id="ausencias" title="Ausencias justificadas" sub="Vacaciones, permisos, incapacidades… no penalizan el cumplimiento" />
        {!abs ? <div className="empty">Cargando…</div> : !absIn.length ? <div className="card empty">Sin ausencias justificadas en el periodo. <Link href="/admin?tab=abs" className="linkbtn">Administrar ausencias ›</Link></div> : (
          <table className="rp-table"><thead><tr><th>Persona</th><th>Motivo</th><th>Del</th><th>Al</th><th>Justificación</th><th>Auditorías</th></tr></thead>
            <tbody>{absIn.map((a) => <tr key={a.id}><td>{a.name}<small>{DEPT[a.dept] || a.dept} · L{a.layer}</small></td><td>{a.kind}</td><td>{fmtDate(a.date_from, { day: 'numeric', month: 'short' })}</td><td>{fmtDate(a.date_to, { day: 'numeric', month: 'short' })}</td><td>{a.note || '—'}</td><td>{a.audits}</td></tr>)}</tbody></table>)}
      </div>

      <div className="rp-sec rp-skip" data-sec="formatos">
        <Head id="formatos" title="Formatos corporativos impresos" sub="Hoja de evidencia con los resultados llenos (se imprime en PDF)" noPdf />
        <div className="rp-links">
          <Link href="/reports/weekly" className="rep-link"><b>Reporte semanal (imprimir / PDF)</b></Link>
          <Link href="/reports/qeform" className="rep-link"><b>Formato impreso por Layer (QEs, Gerente de Calidad…)</b></Link>
          <Link href="/reports/qa062" className="rep-link"><b>QA-062-C · Gestión de Programa de Auditorías (gerencial)</b></Link>
          <Link href="/reports/qa075" className="rep-link"><b>QA-075-C · Management Audit Findings (hallazgos gerenciales)</b></Link>
          <Link href="/reports/qa076" className="rep-link"><b>QA-076-C · Dock Audit Findings</b></Link>
          <Link href="/reports/programa" className="rep-link"><b>Programa Auditoría LPA (semanal, como el cartel de planta)</b></Link>
        </div>
      </div>

      <div className="rp-sec rp-skip" data-sec="excel">
        <Head id="excel" title="Descargas para Excel" sub="Archivos .csv con el periodo seleccionado" noPdf />
        <div className="row wrap" style={{ gap: 8 }}>{dl('compliance')}{dl('issues')}{dl('audits')}{dl('assignments')}</div>
      </div>

      <div className="rp-sec rp-skip" data-sec="respaldo">
        <Head id="respaldo" title="Respaldo" sub="No depende del periodo y no incluye contraseñas" noPdf />
        <div className="row wrap" style={{ gap: 8 }}>
          <a className="btn alt sm" href="/api/admin/backup" download>⬇ Respaldo completo (JSON)</a>
          <a className="btn alt sm" href="/api/admin/backup?fotos=1" download>⬇ Con fotos (pesa más)</a>
        </div>
      </div>
    </div>
  );
}
export default function ReportsPage() { return <Shell need="admin"><Inner /></Shell>; }
