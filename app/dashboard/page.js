'use client';
import { useEffect, useState } from 'react';
import Bi from '@/components/Bi';
import Shell from '@/components/Shell';
import { api, fmtDate, useUrlState, DEPT, LAYER, scoreCls, getSiteCookie } from '@/lib/client';

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function Bars({ rows, label, value, sub, cls }) {
  return rows.map((r, i) => (
    <div className="bar" key={i}>
      <span>{label(r)}</span>
      <div className="track"><i className={cls ? cls(r) : ''} style={{ width: `${Math.min(100, value(r))}%` }} /></div>
      <em>{sub(r)}</em>
    </div>));
}

const oiNo = (id) => 'OI-' + String(id).padStart(4, '0');
const SLICES = [
  { k: 'ok', label: 'OK', color: 'var(--ok)' },
  { k: 'na', label: 'N/A', color: '#9aa6bd' },
  { k: 'partial', label: 'Puede mejorar (Δ)', color: '#e2a42b' },
  { k: 'nok', label: 'No OK (X)', color: 'var(--nok)' },
];

// Gráfica de pastel: % de respuestas OK, N/A, puede mejorar y no OK
function ResultsPie({ results }) {
  const total = SLICES.reduce((s, x) => s + results[x.k], 0);
  if (!total) return <div className="sub">Aún sin respuestas registradas en el periodo.</div>;
  const R = 80, C = 100;
  let a0 = -Math.PI / 2;
  const arcs = SLICES.filter((s) => results[s.k] > 0).map((s) => {
    const frac = results[s.k] / total, a1 = a0 + frac * 2 * Math.PI;
    const p = (a) => [C + R * Math.cos(a), C + R * Math.sin(a)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1), mid = (a0 + a1) / 2;
    const d = frac >= 0.9999 ? null : `M${C},${C} L${x0},${y0} A${R},${R} 0 ${frac > 0.5 ? 1 : 0} 1 ${x1},${y1} Z`;
    const out = { ...s, frac, d, lx: C + R * 0.62 * Math.cos(mid), ly: C + R * 0.62 * Math.sin(mid) };
    a0 = a1; return out;
  });
  const fmt = (f) => `${(f * 100).toFixed(f < 0.1 && f > 0 ? 1 : 0)}%`;
  return (
    <div className="pie">
      <svg viewBox="0 0 200 200" role="img" aria-label={`Resultados: ${SLICES.map((s) => `${s.label} ${fmt(results[s.k] / total)}`).join(', ')}`}>
        {arcs.map((s) => s.d ? <path key={s.k} d={s.d} fill={s.color} stroke="#fff" strokeWidth="1.5" /> : <circle key={s.k} cx={C} cy={C} r={R} fill={s.color} />)}
        {arcs.filter((s) => s.frac >= 0.07).map((s) => <text key={'t' + s.k} x={s.lx} y={s.ly} textAnchor="middle" dominantBaseline="middle" className="pie-t">{fmt(s.frac)}</text>)}
      </svg>
      <table className="pie-legend"><tbody>
        {SLICES.map((s) => (
          <tr key={s.k}><td><i style={{ background: s.color }} /></td><td>{s.label}</td>
            <td className="n">{results[s.k]}</td><td className="n"><b>{fmt(results[s.k] / total)}</b></td></tr>))}
        <tr className="tot"><td /><td>Total de respuestas</td><td className="n">{total}</td><td /></tr>
      </tbody></table>
    </div>
  );
}

// Avance PDCA de un issue: P registrado · D acción en curso · C todos terminaron · A cerrado
function Pdca({ f }) {
  const o = f.owners || [];
  const steps = [
    ['P', 'Plan: hallazgo registrado', true],
    ['D', 'Do: acción en ejecución', o.some((x) => x.status !== 'open' || (x.action || '').trim())],
    ['C', 'Check: todos los responsables terminaron', o.length > 0 && o.every((x) => x.status === 'done')],
    ['A', 'Act: issue cerrado', f.status === 'closed'],
  ];
  const cur = steps.findIndex((s) => !s[2]);
  return <div className="pdca" aria-label="Avance PDCA">{steps.map(([l, t, ok], i) => <span key={l} title={t} className={ok ? 'done' : i === cur ? 'cur' : ''}>{l}</span>)}</div>;
}

function OpenIssues({ issues, today }) {
  if (!issues.length) return <div className="card"><div className="sub">Sin open issues. 🎉</div></div>;
  return (
    <div className="oi-list">
      <div className="oi-head"><span>OI / Fecha</span><span>Ubicación</span><span>Hallazgo (Plan)</span><span>Responsables y acción (Do)</span><span>Compromiso</span><span>PDCA</span></div>
      {issues.map((f) => {
        const over = f.due_date && f.due_date < today;
        return (
          <div key={f.id} className={`oi-row ${over ? 'over' : ''}`}>
            <div data-l="OI / Fecha"><b className="oi-no">{oiNo(f.id)}</b><div className="sub">{fmtDate(f.audit_date, { day: 'numeric', month: 'short' })}</div></div>
            <div data-l="Ubicación">{f.area}{f.part_number && <div className="partno">N/P <b>{f.part_number}</b></div>}</div>
            <div data-l="Hallazgo (Plan)"><span className={`pill ${f.result === 'nok' ? 'nok' : 'warn'}`}>{f.result === 'nok' ? 'X' : 'Δ'}</span> <Bi text={f.question} />
              {f.notes && <div className="sub" style={{ marginTop: 4 }}>“{f.notes}”</div>}</div>
            <div data-l="Responsables y acción (Do)">{(f.owners || []).length ? f.owners.map((o, i) => (
              <div key={i} className="oi-owner"><span className="sub">Responsable:</span> <b>{o.name}</b> <span className={`pill ${o.status === 'done' ? 'ok' : o.status === 'in_progress' ? 'warn' : ''}`}>{o.status === 'done' ? 'Terminó' : o.status === 'in_progress' ? 'En proceso' : 'Pendiente'}</span>
                <div className="sub"><b>Acción:</b> {(o.plan_action || '').trim() || <i>sin registrar</i>}{o.plan_date ? ` · cierre ${fmtDate(String(o.plan_date).slice(0, 10), { day: 'numeric', month: 'short' })}` : ''}</div>
                {(o.action || '').trim() && <div className="sub">Avance: {o.action}</div>}</div>)) : <span className="sub">Sin responsable asignado</span>}</div>
            <div data-l="Compromiso" className={over ? 'oi-over' : ''}>{f.due_date ? fmtDate(f.due_date, { day: 'numeric', month: 'short' }) : '—'}{over && <div className="sub" style={{ color: 'inherit' }}>vencido</div>}</div>
            <div data-l="PDCA"><Pdca f={f} /></div>
          </div>);
      })}
    </div>
  );
}

// Descargar PDF: usa la impresión del navegador solo con el reporte (en celular: Compartir → Guardar como PDF)
function printReport() {
  document.body.classList.add('print-report');
  const done = () => { document.body.classList.remove('print-report'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}

function Inner() {
  const [weeks, setWeeks] = useUrlState('w', 4), [d, setD] = useState(null), [err, setErr] = useState(''), [siteTv, setSiteTv] = useState('');
  // La TV usa la planta que ve el admin; un líder siempre ve la suya (lo resuelve el servidor)
  useEffect(() => { const c = getSiteCookie(); setSiteTv(c !== 'ALL' ? `?site=${c}` : ''); }, []);
  useEffect(() => { setD(null); api(`/api/dashboard?weeks=${weeks}`).then(setD).catch((e) => setErr(e.message)); }, [weeks]);
  return (
    <>
      <div className="row wrap norep"><h1 className="title grow">Panel de cumplimiento</h1><a className="btn alt sm" href={`/tv${siteTv}`} target="_blank" rel="noreferrer">Abrir pantalla TV</a></div>
      <div className="seg norep" style={{ margin: '12px 0' }}>
        {[1, 4, 8, 12].map((w) => <button key={w} className={weeks === w ? 'on' : ''} onClick={() => setWeeks(w)}>{w === 1 ? 'Esta semana' : `${w} semanas`}</button>)}
      </div>
      {err && <div className="err norep">{err}</div>}
      {!d ? <div className="empty">Cargando…</div> : (
        <>
          <div className="kpis norep">
            <div className="kpi"><b>{pct(d.kpi.completed, d.kpi.scheduled)}%</b><span>Cumplimiento ({d.kpi.completed}/{d.kpi.scheduled})</span></div>
            <div className="kpi"><b className={`score ${scoreCls(d.kpi.avg_score || 0)}`}>{d.kpi.avg_score ?? '—'}{d.kpi.avg_score != null && '%'}</b><span>Score promedio</span></div>
            <div className="kpi"><b>{pct(d.users.completed, d.users.total)}%</b><span>Usuarios al corriente ({d.users.completed}/{d.users.total})</span></div>
            <div className="kpi"><b>{d.openFindings.n}</b><span>Hallazgos abiertos ({d.openFindings.overdue} vencidos)</span></div>
            <div className="kpi"><b>{d.kpi.late}</b><span>Hechas tarde</span></div>
          </div>

          <div className="two norep">
            <div>
              <div className="sect">Cumplimiento por capa</div>
              <div className="card"><Bars rows={d.layer} label={(r) => LAYER[r.layer]} value={(r) => pct(r.completed, r.scheduled)}
                sub={(r) => `${pct(r.completed, r.scheduled)}%`} cls={(r) => { const p = pct(r.completed, r.scheduled); return p >= 90 ? 'good' : p >= 70 ? 'mid' : 'bad'; }} /></div>
              <div className="sect">Cumplimiento por departamento</div>
              <div className="card"><Bars rows={d.dept} label={(r) => DEPT[r.dept] || r.dept} value={(r) => pct(r.completed, r.scheduled)}
                sub={(r) => `${pct(r.completed, r.scheduled)}%`} cls={(r) => { const p = pct(r.completed, r.scheduled); return p >= 90 ? 'good' : p >= 70 ? 'mid' : 'bad'; }} /></div>
            </div>
            <div>
              <div className="sect">Tendencia semanal (cumplimiento)</div>
              <div className="card"><Bars rows={d.week} label={(r) => fmtDate(r.week, { day: 'numeric', month: 'short' })} value={(r) => pct(r.completed, r.scheduled)}
                sub={(r) => `${pct(r.completed, r.scheduled)}%`} cls={(r) => { const p = pct(r.completed, r.scheduled); return p >= 90 ? 'good' : p >= 70 ? 'mid' : 'bad'; }} /></div>
              <div className="sect">Áreas con menor score</div>
              <div className="card">{d.area.length ? <Bars rows={d.area} label={(r) => r.area} value={(r) => Number(r.avg_score)}
                sub={(r) => `${r.avg_score}%`} cls={(r) => scoreCls(Number(r.avg_score))} /> : <div className="sub">Aún sin auditorías completadas</div>}</div>
            </div>
          </div>

          <div className="sect norep">Preguntas que más fallan</div>
          <div className="card norep">{d.topFailing.length ? d.topFailing.map((r, i) => (
            <div key={i} className="row" style={{ padding: '6px 0', borderBottom: i < d.topFailing.length - 1 ? '1px solid var(--line)' : 0 }}>
              <span className="pill nok">{r.fails}×</span><span style={{ fontSize: 14 }}><Bi text={r.question} /></span></div>)) : <div className="sub">Sin hallazgos en el periodo</div>}</div>

          <div className="sect norep">No realizadas — ventana cerrada ({d.missing.length})</div>
          <div className="card norep">{d.missing.length ? d.missing.map((m) => (
            <div key={m.id} className="row" style={{ padding: '6px 0', fontSize: 14 }}>
              <span className="pill nok">{fmtDate(m.date, { day: 'numeric', month: 'short' })}</span>
              <span className="grow">{m.name} <span className="sub">· {LAYER[m.layer]} {DEPT[m.dept]}</span></span><span className="sub">{m.area}</span></div>)) : <div className="sub">Sin auditorías faltantes.</div>}</div>

          <div className="row wrap" style={{ marginTop: 22 }}>
            <span className="grow" />
            <button className="btn sm" onClick={printReport}>Descargar PDF</button>
          </div>
          <div id="report">
            <div className="rep-head">
              <img src="/mitchell-logo.png" alt="Mitchell Plastics" />
              <div><h1>LPA Summary · {d.siteName}</h1>
                <div>{weeks === 1 ? 'Semana en curso' : `Últimas ${weeks} semanas`} · al {fmtDate(d.today, { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
              <div className="rep-kpis">
                <span><b>{pct(d.kpi.completed, d.kpi.scheduled)}%</b> cumplimiento ({d.kpi.completed}/{d.kpi.scheduled})</span>
                <span><b>{pct(d.users.completed, d.users.total)}%</b> usuarios al corriente ({d.users.completed} de {d.users.total})</span>
                <span><b>{d.kpi.avg_score ?? '—'}{d.kpi.avg_score != null && '%'}</b> score promedio</span>
                <span><b>{d.openFindings.n}</b> hallazgos abiertos ({d.openFindings.overdue} vencidos)</span>
              </div>
            </div>
          <div className="sect">Resultados de las auditorías · {weeks === 1 ? 'esta semana' : `últimas ${weeks} semanas`} (al {fmtDate(d.today, { day: 'numeric', month: 'short', year: 'numeric' })})</div>
            <div className="card"><ResultsPie results={d.results} />
            <div className="syscomp"><small>System Compliance</small><b className={pct(d.users.completed, d.users.total) >= 90 ? 'ok' : pct(d.users.completed, d.users.total) >= 70 ? 'warn' : 'nok'}>{pct(d.users.completed, d.users.total)}%</b><span>{d.users.completed} de {d.users.total} usuarios han hecho su auditoría</span></div>
            <div className="usr-bar"><div className="usr-top"><span>Usuarios al corriente</span><b>{pct(d.users.completed, d.users.total)}% · {d.users.completed} de {d.users.total}</b></div>
              <div className="track"><i style={{ width: `${pct(d.users.completed, d.users.total)}%` }} /></div>
              <div className="sub">Completaron al menos una auditoría en el periodo y no tienen ninguna vencida sin hacer.{d.users.with_missed > 0 && ` ${d.users.with_missed} usuario(s) con auditorías no realizadas.`}</div></div></div>
  
</div>
        </>
      )}
    </>
  );
}
export default function Dashboard() { return <Shell need="lead"><Inner /></Shell>; }
