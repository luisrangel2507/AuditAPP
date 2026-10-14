'use client';
import { useEffect, useState } from 'react';
import Ring from '@/components/Ring';
import ThemeToggle from '@/components/ThemeToggle';

const fmt = (s, o) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', o);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const PAGE_MS = 10000, REFRESH_MS = 60000;
const AV = ['#2f6bff', '#2aa876', '#7c4dde', '#f08a24', '#d6417e', '#e7b416', '#5b6b88', '#12a6b8'];
const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const color = (n) => AV[[...n].reduce((s, c) => s + c.charCodeAt(0), 0) % AV.length];
const pctCls = (p) => (p == null ? '' : p >= 90 ? 'ok' : p >= 75 ? 'warn' : 'nok');

function Slot({ s, n }) {
  if (!s) return <span className="tvx-st"><i />—</span>;
  if (s.status === 'completed') return <span className="tvx-st ok">P{n} · {Math.round(s.score)}%{s.findings ? ` · ${s.findings} hall.` : ''}</span>;
  if (s.window === 'missed') return <span className="tvx-st nok"><i />P{n} · No realizada</span>;
  if (s.window === 'last_day') return <span className="tvx-st warn"><i />P{n} · Último día</span>;
  return <span className="tvx-st pend"><i />P{n} · Pendiente</span>;
}

export default function TVQEs() {
  const [data, setData] = useState(null), [err, setErr] = useState(''), [now, setNow] = useState(null), [tick, setTick] = useState(0), [wall, setWall] = useState(false);
  const [updated, setUpdated] = useState(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const key = sp.get('key') || '', site = sp.get('site') || '';
    const qs = [key && `key=${encodeURIComponent(key)}`, site && `site=${encodeURIComponent(site)}`].filter(Boolean).join('&');
    const load = async () => {
      try {
        const r = await fetch(`/api/tv/qes${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(r.status === 401 ? 'Pantalla no autorizada. Usa la liga /tv/qes?key=…&site=MPQ o inicia sesión como administrador.' : j.error);
        setData(j); setErr(''); setUpdated(new Date());
      } catch (e) { setErr(e.message); }
    };
    const size = () => setWall(window.innerWidth >= 1200);
    load(); setNow(new Date()); size();
    window.addEventListener('resize', size);
    const a = setInterval(load, REFRESH_MS), b = setInterval(() => setNow(new Date()), 1000), c = setInterval(() => setTick((t) => t + 1), PAGE_MS);
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); window.removeEventListener('resize', size); };
  }, []);

  const k = data?.kpi;
  const todayPct = k && k.today_total ? Math.round((k.today_done / k.today_total) * 100) : 0;
  // En pantalla grande la lista rota sola por páginas
  const pageOf = (rows, per) => { if (!wall || rows.length <= per) return [rows, null]; const pages = Math.ceil(rows.length / per), p = tick % pages; return [rows.slice(p * per, p * per + per), `Página ${p + 1} de ${pages} · ${rows.length} registros`]; };
  const [rowsToday, pgToday] = data ? pageOf(data.people, 9) : [[], null];
  const [rowsDone, pgDone] = data ? pageOf(data.doneToday, 5) : [[], null];
  const week = data ? [...data.people].sort((a, b) => b.week_done / (b.week_total || 1) - a.week_done / (a.week_total || 1) || a.name.localeCompare(b.name)) : [];
  const [rowsWeek, pgWeek] = pageOf(week, 6);

  return (
    <div className="tvx tvq">
      <header className="tvx-head">
        <div className="tvx-brand"><img src="/mitchell-logo-light.png" alt="Mitchell Plastics" /><i /><b>LP<span>App</span></b></div>
        <div className="tvx-clock"><b>{now ? now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</b>
          <span>{data ? cap(fmt(data.today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : ''}</span></div>
        <h1>Auditorías de proceso · QEs</h1>
        <div className="tvx-chips"><ThemeToggle className="tvx-theme" defaultTheme="dark" /><span className="tvx-chip">▦ {data?.site ? data.site.name : 'MPQ'}</span><span className="tvx-chip">▤ Etapa de pruebas</span></div>
      </header>

      {err && <div className="tvx-err">{err}</div>}
      {data && (
        <>
          <section className="tvx-kpis">
            <div className={`tvx-kpi ${pctCls(k.week_pct)}`}><Ring value={k.week_pct || 0} size={92} stroke={10} label={k.week_pct == null ? '—' : `${k.week_pct}%`} />
              <div><h3>Cumplimiento semana</h3><b>{k.week_done} / {k.week_total}</b></div></div>
            <div className="tvx-kpi blue"><Ring value={todayPct} size={92} stroke={10} label={`${k.today_done} / ${k.today_total}`} />
              <div><h3>Completadas hoy</h3><div className="tvx-prog"><i style={{ width: `${todayPct}%` }} /></div><b className="sm">{todayPct}%</b></div></div>
            <div className={`tvx-kpi ${pctCls(k.avg_score)}`}><Ring value={k.avg_score || 0} size={92} stroke={10} label={k.avg_score == null ? '—' : `${k.avg_score}%`} />
              <div><h3>Score promedio semana</h3></div></div>
            <div className={`tvx-kpi big ${k.missed ? 'nok' : 'ok'}`}><div><b>{k.missed}</b><h3>No realizadas esta semana</h3></div><span className="tvx-ic">▤</span></div>
            <div className="tvx-kpi wide"><div><b className="sm">{k.findings}</b><h3>Hallazgos encontrados esta semana</h3></div></div>
          </section>

          <section className="tvx-grid">
            <div className="tvx-panel main">
              <h2><span className="tvx-h-ic">▤</span>Hoy<em>{k.today_total - k.today_done} pendientes</em></h2>
              <div className="tvx-th"><span>QE</span><span>Auditorías de proceso de hoy</span><span /><span>Semana</span></div>
              {!rowsToday.length ? <div className="tvx-empty">Sin QEs programados.</div> : rowsToday.map((p) => (
                <div className="tvx-row q" key={p.id}>
                  <span className="tvx-av" style={{ background: color(p.name) }}>{initials(p.name)}</span>
                  <div className="tvx-name">{p.name}<span>Calidad</span></div>
                  <div className="tvx-slot a1" style={{ gridColumn: "a1 / a2" }}><div className="tvq-slots">{p.today.length ? p.today.map((x) => <Slot key={x.slot} s={x} n={x.slot} />) : <span className="tvx-st"><i />—</span>}</div></div>
                  <span className={`tvx-st wk ${p.missed ? 'nok' : p.week_done === p.week_total ? 'ok' : 'pend'}`}>{p.week_done}/{p.week_total}</span>
                </div>))}
              {pgToday && <div className="tvx-pager">{pgToday}</div>}
            </div>
            <div className="tvx-col">
              <div className="tvx-panel">
                <h2>Completadas hoy<em>{data.doneToday.length} registradas</em></h2>
                {!rowsDone.length ? <div className="tvx-empty">Aún no hay auditorías de proceso hoy.</div> : rowsDone.map((a) => (
                  <div className="tvx-row simple" key={a.id}>
                    <span className="tvx-av" style={{ background: color(a.name) }}>{initials(a.name)}</span>
                    <div className="tvx-name">{a.name}<span>Proceso {a.slot}</span></div>
                    <div className="tvx-area">{a.area}</div>
                    <span className="tvx-st ok">{Math.round(a.score)}%{a.findings ? ` · ${a.findings} hall.` : ''}</span>
                  </div>))}
                {pgDone && <div className="tvx-pager">{pgDone}</div>}
              </div>
              <div className="tvx-panel">
                <h2>Avance de la semana</h2>
                {rowsWeek.map((p) => {
                  const pct = p.week_total ? Math.round((p.week_done / p.week_total) * 100) : 0;
                  return (<div className="tvx-bar" key={p.id}><span style={{ minWidth: 110 }}>{p.name.split(' ')[0]}</span><div><i className={pctCls(pct)} style={{ width: `${pct}%` }} /></div><em>{p.week_done}/{p.week_total}</em></div>);
                })}
                {pgWeek && <div className="tvx-pager">{pgWeek}</div>}
              </div>
            </div>
          </section>
          <footer className="tvx-foot">Auditorías de proceso de los QEs · Actualizado {updated?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · se refresca cada minuto</footer>
        </>
      )}
    </div>
  );
}
