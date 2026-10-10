'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate, DEPT, LAYER, scoreCls, getSiteCookie } from '@/lib/client';

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function Bars({ rows, label, value, sub, cls }) {
  return rows.map((r, i) => (
    <div className="bar" key={i}>
      <span>{label(r)}</span>
      <div className="track"><i className={cls ? cls(r) : ''} style={{ width: `${Math.min(100, value(r))}%` }} /></div>
      <em>{sub(r)}</em>
    </div>));
}

function Inner() {
  const [weeks, setWeeks] = useState(4), [d, setD] = useState(null), [err, setErr] = useState(''), [siteTv, setSiteTv] = useState('');
  // La TV usa la planta que ve el admin; un líder siempre ve la suya (lo resuelve el servidor)
  useEffect(() => { const c = getSiteCookie(); setSiteTv(c !== 'ALL' ? `?site=${c}` : ''); }, []);
  useEffect(() => { setD(null); api(`/api/dashboard?weeks=${weeks}`).then(setD).catch((e) => setErr(e.message)); }, [weeks]);
  return (
    <>
      <div className="row wrap"><h1 className="title grow">Panel de cumplimiento</h1><a className="btn alt sm" href={`/tv${siteTv}`} target="_blank" rel="noreferrer">Abrir pantalla TV</a></div>
      <div className="seg" style={{ margin: '12px 0' }}>
        {[1, 4, 8, 12].map((w) => <button key={w} className={weeks === w ? 'on' : ''} onClick={() => setWeeks(w)}>{w === 1 ? 'Esta semana' : `${w} semanas`}</button>)}
      </div>
      {err && <div className="err">{err}</div>}
      {!d ? <div className="empty">Cargando…</div> : (
        <>
          <div className="kpis">
            <div className="kpi"><b>{pct(d.kpi.completed, d.kpi.scheduled)}%</b><span>Cumplimiento ({d.kpi.completed}/{d.kpi.scheduled})</span></div>
            <div className="kpi"><b className={`score ${scoreCls(d.kpi.avg_score || 0)}`}>{d.kpi.avg_score ?? '—'}{d.kpi.avg_score != null && '%'}</b><span>Score promedio</span></div>
            <div className="kpi"><b>{d.openFindings.n}</b><span>Hallazgos abiertos ({d.openFindings.overdue} vencidos)</span></div>
            <div className="kpi"><b>{d.kpi.late}</b><span>Hechas tarde</span></div>
          </div>

          <div className="two">
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

          <div className="sect">Preguntas que más fallan</div>
          <div className="card">{d.topFailing.length ? d.topFailing.map((r, i) => (
            <div key={i} className="row" style={{ padding: '6px 0', borderBottom: i < d.topFailing.length - 1 ? '1px solid var(--line)' : 0 }}>
              <span className="pill nok">{r.fails}×</span><span style={{ fontSize: 14 }}>{r.question}</span></div>)) : <div className="sub">Sin hallazgos en el periodo</div>}</div>

          <div className="sect">No realizadas — ventana cerrada ({d.missing.length})</div>
          <div className="card">{d.missing.length ? d.missing.map((m) => (
            <div key={m.id} className="row" style={{ padding: '6px 0', fontSize: 14 }}>
              <span className="pill nok">{fmtDate(m.date, { day: 'numeric', month: 'short' })}</span>
              <span className="grow">{m.name} <span className="sub">· {LAYER[m.layer]} {DEPT[m.dept]}</span></span><span className="sub">{m.area}</span></div>)) : <div className="sub">Sin auditorías faltantes.</div>}</div>
        </>
      )}
    </>
  );
}
export default function Dashboard() { return <Shell need="lead"><Inner /></Shell>; }
