'use client';
import { useEffect, useState } from 'react';

import Ring from '@/components/Ring';
import Brand from '@/components/Brand';

const DEPT = { quality: 'Calidad', process: 'Procesos', production: 'Producción', logistics: 'Logística', hr: 'RH',
  maintenance: 'Mantenimiento', toolroom: 'Tool Room', program: 'Programas', management: 'Gerencia' };
const fmt = (s, o) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', o);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const PAGE_MS = 10000, REFRESH_MS = 60000;

// Muestra una lista larga en páginas que rotan solas
function Paged({ rows, per, tick, render, empty }) {
  if (!rows.length) return <div className="tv-empty">{empty}</div>;
  const pages = Math.ceil(rows.length / per);
  const p = tick % pages;
  return (
    <>
      {rows.slice(p * per, p * per + per).map(render)}
      {pages > 1 && <div className="tv-pager">Página {p + 1} de {pages} · {rows.length} registros</div>}
    </>
  );
}

function Status({ a }) {
  if (a.status === 'completed') return <span className={`tv-st ok`}>{Math.round(a.score)}%{a.findings ? ` · ${a.findings} hall.` : ''}</span>;
  if (a.window === 'missed') return <span className="tv-st nok">No realizada</span>;
  if (a.window === 'last_day') return <span className="tv-st warn">Último día</span>;
  if (a.window === 'upcoming') return <span className="tv-st">Programada</span>;
  return <span className="tv-st pend">Pendiente</span>;
}

export default function TV() {
  const [data, setData] = useState(null), [err, setErr] = useState(''), [now, setNow] = useState(null), [tick, setTick] = useState(0);
  const [updated, setUpdated] = useState(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const key = sp.get('key') || '', site = sp.get('site') || '';
    const qs = [key && `key=${encodeURIComponent(key)}`, site && `site=${encodeURIComponent(site)}`].filter(Boolean).join('&');
    const load = async () => {
      try {
        const r = await fetch(`/api/tv${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(r.status === 401 ? 'Pantalla no autorizada. Usa la liga /tv?key=…&site=MPQ o inicia sesión como líder.' : j.error);
        setData(j); setErr(''); setUpdated(new Date());
      } catch (e) { setErr(e.message); }
    };
    load(); setNow(new Date());
    const a = setInterval(load, REFRESH_MS), b = setInterval(() => setNow(new Date()), 1000), c = setInterval(() => setTick((t) => t + 1), PAGE_MS);
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); };
  }, []);

  const k = data?.kpi;
  const pctCls = (p) => (p == null ? '' : p >= 90 ? 'ok' : p >= 75 ? 'warn' : 'nok');
  // No realizadas: agrupadas por auditor (quién falta y cuántas)
  const missedBy = data ? Object.values(data.missed.reduce((m, a) => {
    (m[a.name] ||= { ...a, days: [] }).days.push(a.date); return m;
  }, {})).sort((a, b) => b.days.length - a.days.length || a.name.localeCompare(b.name)) : [];
  const row = (a) => (
    <div className="tv-row" key={a.id}>
      <div className="tv-name">{a.name}<span>{DEPT[a.dept] || a.dept} · L{a.layer}</span></div>
      <div className="tv-area">{a.area}{a.part ? <span className="tv-part">N/P {a.part}</span> : null}</div>
      <Status a={a} />
    </div>
  );

  return (
    <div className="tv">
      <header className="tv-head">
        <Brand />
        <div className="tv-title">Estatus de auditorías por capas{data?.site ? ` · ${data.site.code}` : ''}</div>
        <div className="tv-clock">
          <b>{now ? now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</b>
          <span>{data ? cap(fmt(data.today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : ''}</span>
        </div>
      </header>

      {err && <div className="tv-err">{err}</div>}
      {data && (
        <>
          <section className="tv-kpis">
            <div className={`tv-kpi ${pctCls(k.week_pct)}`}><Ring value={k.week_pct || 0} size={74} stroke={8} label="" /><div><b>{k.week_pct == null ? '—' : `${k.week_pct}%`}</b><span>Cumplimiento semana ({k.week_done}/{k.week_counted})</span></div></div>
            <div className="tv-kpi"><Ring value={k.today_total ? (k.today_done / k.today_total) * 100 : 0} size={74} stroke={8} label="" /><div><b>{k.today_done}/{k.today_total}</b><span>Layer 1 · completadas hoy</span></div></div>
            <div className={`tv-kpi ${pctCls(k.avg_score)}`}><Ring value={k.avg_score || 0} size={74} stroke={8} label="" /><div><b>{k.avg_score == null ? '—' : `${k.avg_score}%`}</b><span>Score promedio semana</span></div></div>
            <div className={`tv-kpi ${data.missed.length ? 'nok' : 'ok'}`}><div><b>{data.missed.length}</b><span>No realizadas esta semana</span></div></div>
            <div className={`tv-kpi ${k.findings_overdue ? 'nok' : ''}`}><div><b>{k.findings_open}</b><span>Hallazgos abiertos · {k.findings_overdue} vencidos</span></div></div>
          </section>

          <section className="tv-grid">
            <div className="tv-panel">
              <h2>Le toca hoy <em>{data.scheduled.filter((a) => a.status !== 'completed').length} pendientes</em></h2>
              <Paged rows={[...data.scheduled].sort((a, b) => (a.status === 'completed') - (b.status === 'completed'))} per={12} tick={tick} render={row}
                empty="Sin auditorías Layer 1 programadas hoy." />
            </div>
            <div className="tv-col">
              <div className="tv-panel">
                <h2>Completadas hoy <em>{data.doneToday.length} registradas</em></h2>
                <Paged rows={data.doneToday} per={4} tick={tick} render={row} empty="Aún no hay auditorías registradas hoy." />
              </div>
              <div className="tv-panel">
                <h2>Gerencia · Layer 2 / 3 <em>semanal</em></h2>
                <Paged rows={[...data.mgmt].sort((a, b) => (a.status === 'completed') - (b.status === 'completed'))} per={4} tick={tick} render={row} empty="Sin auditorías de gerencia." />
              </div>
            </div>
            <div className="tv-col">
              <div className="tv-panel alert">
                <h2>No realizadas esta semana <em>{missedBy.length} auditores</em></h2>
                <Paged rows={missedBy} per={4} tick={tick} empty="Ninguna. Programa al corriente."
                  render={(a) => (
                    <div className="tv-row" key={a.name}>
                      <div className="tv-name">{a.name}<span>{DEPT[a.dept] || a.dept} · L{a.layer}</span></div>
                      <div className="tv-area">{[...a.days].sort().map((d) => fmt(d, { weekday: 'short' })).join(', ')}</div>
                      <span className="tv-st nok">{a.days.length}</span>
                    </div>)} />
              </div>
              <div className="tv-panel">
                <h2>Cumplimiento por capa</h2>
                {data.byLayer.map((l) => {
                  const p = l.counted ? Math.round((l.done / l.counted) * 100) : null;
                  return (
                    <div className="tv-bar" key={l.layer}>
                      <span>Layer {l.layer}</span>
                      <div className="tv-track"><i className={pctCls(p)} style={{ width: `${p ?? 0}%` }} /></div>
                      <em>{p == null ? '—' : `${p}%`}</em>
                    </div>);
                })}
              </div>
            </div>
          </section>
          <footer className="tv-foot">
            Regla: la auditoría solo se registra el mismo día programado. · Actualizado {updated?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · se refresca cada minuto
          </footer>
        </>
      )}
    </div>
  );
}
