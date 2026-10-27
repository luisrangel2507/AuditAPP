'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Ring from '@/components/Ring';
import ThemeToggle from '@/components/ThemeToggle';
import { zoneRank } from '@/lib/zones';

const DEPT = { quality: 'Calidad', process: 'Procesos', production: 'Producción', logistics: 'Logística', hr: 'RH',
  maintenance: 'Mantenimiento', toolroom: 'Tool Room', program: 'Programas', management: 'Gerencia' };
const fmt = (s, o) => new Date(s + 'T12:00:00').toLocaleDateString('es-MX', o);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const PAGE_MS = 10000, REFRESH_MS = 60000;
const AV = ['#2f6bff', '#2aa876', '#7c4dde', '#f08a24', '#d6417e', '#e7b416', '#5b6b88', '#12a6b8'];
const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const color = (n) => AV[[...n].reduce((s, c) => s + c.charCodeAt(0), 0) % AV.length];

function Delta({ now, before, unit = ' pts', label = 'semana anterior' }) {
  if (now == null || before == null) return <small className="tvx-delta flat">sin {label === 'ayer' ? 'día anterior' : 'semana anterior'}</small>;
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return <small className="tvx-delta flat">= vs. {label}</small>;
  return <small className={`tvx-delta ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'} {d > 0 ? '+' : ''}{d} pts<i> vs. {label}</i></small>;
}

function Status({ a }) {
  if (a.status === 'completed') return <span className="tvx-st ok">✓ Realizada · {Math.round(a.score)}%{a.findings ? ` · ${a.findings} hall.` : ''}</span>;
  if (a.window === 'missed') return <span className="tvx-st nok"><i />No realizada</span>;
  if (a.window === 'last_day') return <span className="tvx-st warn"><i />Último día</span>;
  if (a.window === 'upcoming') return <span className="tvx-st"><i />Programada</span>;
  return <span className="tvx-st pend"><i />Pendiente</span>;
}

// Lista: en pantalla grande se acomoda al alto disponible (sin scroll) y rota sola por páginas; en celular muestra 8 y "Ver todas"
function List({ id, rows, per, render, empty, wall, tick, more, setMore, onPages }) {
  const ref = useRef(null);
  const [cap, setCap] = useState(per);
  const nPages = wall ? Math.max(1, Math.ceil(rows.length / cap)) : 1;
  useEffect(() => { if (onPages) onPages(id, nPages); /* eslint-disable-next-line */ }, [nPages]);
  useLayoutEffect(() => {
    const el = ref.current; if (!wall || !el) return undefined;
    const calc = () => {
      const first = el.querySelector('.tvx-row');
      const rh = first ? first.getBoundingClientRect().height : 56;
      setCap(Math.max(1, Math.floor(el.clientHeight / (rh || 56))));
    };
    calc();
    const ro = new ResizeObserver(calc); ro.observe(el);
    return () => ro.disconnect();
  }, [wall, rows.length]);
  if (!rows.length) return <div className="tvx-empty">{empty}</div>;
  if (wall) {
    const pages = Math.ceil(rows.length / cap), p = tick % pages;
    return <><div className="tvx-list" ref={ref}>{rows.slice(p * cap, p * cap + cap).map(render)}</div>
      <div className="tvx-pager">{pages > 1 ? `Página ${p + 1} de ${pages} · ${rows.length} registros` : ''}</div></>;
  }
  const open = more[id], lim = Math.min(per, 8), shown = open ? rows : rows.slice(0, lim);
  return <>{shown.map(render)}{rows.length > lim && <button className="tvx-more" onClick={() => setMore({ ...more, [id]: !open })}>{open ? 'Ver menos' : `Ver todas (${rows.length})`}</button>}</>;
}

export default function TV() {
  const [data, setData] = useState(null), [err, setErr] = useState(''), [now, setNow] = useState(null), [tick, setTick] = useState(0);
  const [updated, setUpdated] = useState(null), [tab, setTab] = useState(0), [wall, setWall] = useState(false), [more, setMore] = useState({}), [pg, setPg] = useState({});

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const key = sp.get('key') || '', site = sp.get('site') || '';
    const qs = [key && `key=${encodeURIComponent(key)}`, site && `site=${encodeURIComponent(site)}`].filter(Boolean).join('&');
    const load = async () => {
      try {
        const r = await fetch(`/api/tv${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
        const j = await r.json();
        if (!r.ok) throw new Error(r.status === 401 ? 'Pantalla no autorizada. Usa la liga /tv?key=…&site=MPQ o inicia sesión como administrador.' : j.error);
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
  const pctCls = (p) => (p == null ? '' : p >= 90 ? 'ok' : p >= 75 ? 'warn' : 'nok');
  const sorted = (l) => [...l].sort((a, b) => (a.status === 'completed') - (b.status === 'completed') || zoneRank(a.area) - zoneRank(b.area) || String(a.area).localeCompare(String(b.area)) || a.layer - b.layer || a.name.localeCompare(b.name));
  const tabs = useMemo(() => data ? [
    { l: 0, label: 'Todas', n: Object.values(data.layerCounts).reduce((s, x) => s + x, 0) },
    ...[1, 2, 3, 4].map((l) => ({ l, label: `Layer ${l}`, n: data.layerCounts[l] })),
  ] : [], [data]);
  const todayRows = useMemo(() => data ? sorted([...data.scheduled, ...data.mgmt]).filter((a) => !tab || a.layer === tab) : [], [data, tab]);
  const pendingN = todayRows.filter((a) => a.status !== 'completed').length;
  const missedBy = data ? Object.values(data.missed.reduce((m, a) => { (m[a.name] ||= { ...a, days: [] }).days.push(a.date); return m; }, {}))
    .sort((a, b) => b.days.length - a.days.length || a.name.localeCompare(b.name)) : [];

  const listProps = { wall, more, setMore, onPages: (id, n) => setPg((o) => (o[id] === n ? o : { ...o, [id]: n })) };

  const row = (a) => (
    <div className="tvx-row" key={a.id}>
      <span className="tvx-av" style={{ background: color(a.name) }}>{initials(a.name)}</span>
      <div className="tvx-name">{a.name}<span>{DEPT[a.dept] || a.dept} · L{a.layer}</span></div>
      <div className="tvx-area">{a.area}{a.part ? <small>N/P {a.part}</small> : null}</div>
      <span className={`tvx-cap l${a.layer}`}>L{a.layer}</span>
      <Status a={a} />
    </div>
  );

  // Tres pantallas completas que rotan: 1) a quienes les toca hoy, 2) quienes no la hicieron, 3) open issues abiertos
  const ISS_PER = wall ? 6 : 8, issAll = data?.issues || [], issPages = Math.max(1, Math.ceil(issAll.length / ISS_PER));
  const qIss = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('issues') : null; // ?issues=0 la oculta
  const slides = ['hoy', ...(missedBy.length ? ['miss'] : []), ...(issAll.length && qIss !== '0' ? ['iss'] : [])];
  const pgOf = (sl) => (sl === 'iss' ? issPages : Math.max(1, pg[sl] || 1));
  const steps = slides.flatMap((sl) => Array.from({ length: pgOf(sl) }, (_, p) => ({ sl, p })));
  const cur = steps[tick % Math.max(1, steps.length)] || { sl: 'hoy', p: 0 };
  const forced = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('slide') : null; // ?slide=hoy|miss|iss para fijar una
  const act = forced && slides.includes(forced) ? { sl: forced, p: tick % pgOf(forced) } : cur;
  const slideCls = (sl) => `tvx-slide ${!wall || act.sl === sl ? 'on' : ''}`;
  const tk = (sl) => (act.sl === sl ? act.p : 0);
  return (
    <div className={`tvx ${wall ? 'wall' : ''}`}>
      <header className="tvx-head">
        <div className="tvx-brand"><img src="/mitchell-logo-light.png" alt="Mitchell Plastics" /><i /><b>LP<span>App</span></b></div>
        <h1>Estatus de auditorías por capas</h1>
        <div className="tvx-right">
          <div className="tvx-chips"><ThemeToggle className="tvx-theme" defaultTheme="dark" /><span className="tvx-chip">▦ {data?.site ? data.site.name : data?.multi ? 'Todas las plantas' : data?.home}</span><span className="tvx-chip">▤ Esta semana</span></div>
          <div className="tvx-clock"><b>{now ? now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}</b>
            <span>{data ? cap(fmt(data.today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : ''}</span></div>
        </div>
      </header>

      {err && <div className="tvx-err">{err}</div>}
      {data && (
        <>
          <section className="tvx-kpis">
            <div className={`tvx-kpi ${pctCls(k.day_pct)}`}><Ring value={k.day_pct || 0} size={wall ? 70 : 92} stroke={10} label={k.day_pct == null ? '—' : `${k.day_pct}%`} />
              <div><h3>Cumplimiento diario</h3><b>{k.today_done} / {k.today_total}</b></div></div>
            <div className={`tvx-kpi ${pctCls(k.week_pct)}`}><Ring value={k.week_pct || 0} size={wall ? 70 : 92} stroke={10} label={k.week_pct == null ? '—' : `${k.week_pct}%`} />
              <div><h3>Cumplimiento semana</h3><b>{k.week_done} / {k.week_counted}</b></div></div>
            <div className={`tvx-kpi ${pctCls(k.avg_score)}`}><Ring value={k.avg_score || 0} size={wall ? 70 : 92} stroke={10} label={k.avg_score == null ? '—' : `${k.avg_score}%`} />
              <div><h3>Score promedio semana</h3><Delta now={k.avg_score} before={data.prev.avg_score} /></div></div>
            <div className={`tvx-kpi big ${data.missed.length ? 'nok' : 'ok'}`}><div><b>{data.missed.length}</b><h3>No realizadas esta semana</h3></div><span className="tvx-ic">▤</span></div>
            <div className={`tvx-kpi wide ${k.findings_overdue ? 'nok' : ''}`}><div><b className="sm">{k.findings_open}</b><h3>Hallazgos abiertos · {k.findings_overdue} vencidos</h3></div></div>
          </section>

          <div className="tvx-slides">
            <div className={slideCls('hoy')}>
              <nav className="tvx-tabs" aria-label="Capas">
                {tabs.map((t) => <button key={t.l} className={tab === t.l ? 'on' : ''} onClick={() => setTab(t.l)}>{t.label}<em className={`n${t.l}`}>{t.n}</em></button>)}
              </nav>
              <div className="tvx-panel main full">
                <h2><span className="tvx-h-ic">▤</span>Le toca hoy<em>{pendingN} pendientes</em></h2>
                <div className="tvx-th"><span>Auditor</span><span>Área / línea</span><span>Capa</span><span>Estatus</span></div>
                <List {...listProps} tick={tk('hoy')} id="hoy" rows={todayRows} per={9} render={row} empty="Sin auditorías programadas." />
              </div>
            </div>
            {missedBy.length > 0 && <div className={slideCls('miss')}>
              <div className="tvx-panel alert full">
                <h2>No realizadas esta semana<em>{missedBy.length} auditores</em></h2>
                <List {...listProps} tick={tk('miss')} id="miss" rows={missedBy} per={5} empty="Ninguna. Programa al corriente."
                  render={(a) => (
                    <div className="tvx-row simple" key={a.name}>
                      <span className="tvx-av" style={{ background: color(a.name) }}>{initials(a.name)}</span>
                      <div className="tvx-name">{a.name}<span>{DEPT[a.dept] || a.dept} · L{a.layer}</span></div>
                      <div className="tvx-area">{[...a.days].sort().map((d) => fmt(d, { weekday: 'short' })).join(', ')}</div>
                      <span className="tvx-st nok">{a.days.length}</span>
                    </div>)} />
              </div>
            </div>}
            {issAll.length > 0 && qIss !== '0' && <div className={slideCls('iss')}>
              <section className="tvx-iss">
                <h2><span className="tvx-h-ic">⚠</span>Open issues abiertos<em>{issAll.length} abiertos · {issAll.filter((f) => f.over).length} vencidos{wall ? ` · página ${tk('iss') + 1} de ${issPages}` : ''}</em></h2>
                <div className="tvx-ith"><span>OI</span><span>Ubicación</span><span>Hallazgo</span><span>Responsable y acción</span><span>Compromiso</span></div>
                {(wall ? issAll.slice(tk('iss') * ISS_PER, tk('iss') * ISS_PER + ISS_PER) : issAll.slice(0, 8)).map((f) => (
                  <div key={f.id} className={`tvx-irow ${f.over ? 'over' : ''}`}>
                    <b>OI-{String(f.id).padStart(4, '0')}</b>
                    <span>{f.area}{f.np ? <small>N/P {f.np}</small> : null}</span>
                    <span><i className={f.result === 'nok' ? 'x' : 'd'}>{f.result === 'nok' ? 'X' : 'Δ'}</i>{f.q}{f.notes ? <small>“{f.notes}”</small> : null}</span>
                    <span>{f.owners.length ? f.owners.map((o) => <span key={o.name} className="own"><b>{o.name}</b>{o.plan ? <small>{o.plan}</small> : <small className="no">Sin acción registrada</small>}</span>) : <small className="no">Sin responsable</small>}</span>
                    <span className="due">{f.due ? fmt(String(f.due).slice(0, 10), { day: 'numeric', month: 'short' }) : '—'}{f.over ? <small>vencido</small> : null}</span>
                  </div>))}
              </section>
            </div>}
          </div>
          <footer className="tvx-foot">La auditoría solo se registra el mismo día programado · Actualizado {updated?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · se refresca cada minuto</footer>
        </>
      )}
    </div>
  );
}
