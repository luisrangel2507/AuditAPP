'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Bi from '@/components/Bi';
import Shell, { useUser } from '@/components/Shell';
import { api, peek, fmtDate, scoreCls, DEPT } from '@/lib/client';
import { zoneRank } from '@/lib/zones';
import Ring from '@/components/Ring';
import { I } from '@/components/Icons';
import { isAdmin, isMaster } from '@/lib/roles';

const STATE = {
  open: ['Programada', 'gold'], last_day: ['Último día', 'warn'], missed: ['No realizada', 'nok'],
  completed: ['Completada', 'ok'], upcoming: ['Próxima', ''],
};

function Ticket({ a, today }) {
  const [label0, cls0] = STATE[a.window];
  const inProg = a.started && (a.window === 'open' || a.window === 'last_day');
  const [label, cls] = inProg ? ['En proceso', 'warn'] : [label0, cls0];
  const multi = a.date !== a.due_date;
  return (
    <Link href={`/audit/${a.id}`} className={`ticket s-${a.window}`}>
      <div className="main">
        <div className="day">
          <span className="d-ico">{I.calendar(16)}</span>
          <span>{a.date === today ? 'Hoy' : multi ? `Semana ${fmtDate(a.date, { day: 'numeric', month: 'short' })} – ${fmtDate(a.due_date, { day: 'numeric', month: 'short' })}` : fmtDate(a.date)}</span>
          <span className={`pill ${cls}`}>{label}</span>
        </div>
        <div className="area"><span className={`ktag ${a.kind === 'process' ? 'proc' : 'lpa'}`}>{a.kind === 'process' ? 'Auditoría de proceso' : 'LPA'}</span>{a.kind === 'process' && a.status !== 'completed' ? `Proceso ${a.slot}` : a.area || 'Sin zona asignada'}</div>
        {a.part_number && <div className={`partno ${a.part_edited ? 'edited' : ''}`}>N/P <b>{a.part_number}</b>{a.part_edited ? <em> ✎ corregido</em> : null}</div>}
        <div className="meta">
          {a.kind === 'process' ? (a.status === 'completed' ? `${a.area} · ` : 'Zona y máquina al iniciar · ') : ''}{a.template} · {a.total_questions} preguntas
          {a.window === 'last_day' && ` · cierra hoy`}{a.window === 'open' && a.date === a.due_date && ` · solo hoy`}
          {a.window === 'open' && a.date !== a.due_date && ` · disponible hasta ${fmtDate(a.closes_on, { weekday: 'short', day: 'numeric' })}`}
          {a.window === 'completed' && a.nok_count + a.partial_count > 0 && ` · ${a.nok_count + a.partial_count} open issue(s)`}
        </div>
      </div>
      <div className="stub">
        <span className="chev">{I.chevron(18)}</span>
        {a.window === 'completed' ? <Ring value={a.score_pct} size={60} stroke={7} cls={scoreCls(a.score_pct)} label={`${Math.round(a.score_pct)}%`} />
          : a.window === 'open' || a.window === 'last_day' ? <span className="go">{I.play(18)}{inProg ? 'Continuar' : 'Iniciar'}</span>
          : a.window === 'missed' ? (a.kind === 'process' ? <span className="go">{I.play(18)}Hacer tarde</span> : <div className="meta">Ventana cerrada</div>)
          : <div className="meta">{fmtDate(a.date, { weekday: 'short', day: 'numeric' })}</div>}
      </div>
    </Link>
  );
}

function MyHome() {
  const user = useUser(), router = useRouter(), [newBusy, setNewBusy] = useState(false);
  async function newProcess() { setNewBusy(true); try { const r = await api('/api/audits/extra', { method: 'POST' }); router.push(`/audit/${r.id}`); } catch (e) { setErr(e.message); setNewBusy(false); } }
  const [data, setData] = useState(null), [err, setErr] = useState('');
  useEffect(() => { const c = peek('/api/my'); if (c) setData(c); api('/api/my').then(setData).catch((e) => setErr(e.message)); }, []);
  if (err) return <Shell><div className="err">{err}</div></Shell>;
  const list = data?.audits || [];
  const by = (w) => list.filter((a) => w.includes(a.window));
  const todo = by(['last_day', 'open']).sort((a, b) => (b.window === 'last_day') - (a.window === 'last_day') || (b.kind === 'process') - (a.kind === 'process') || (a.slot || 0) - (b.slot || 0));
  return (
    <>
      <div className="row"><h1 className="title grow">Mis auditorías</h1><Link href="/week" className="ico-btn" aria-label="Programa semanal">{I.calendar(22)}</Link></div>
      <div className="sub">{data ? fmtDate(data.today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ' '}</div>
      {user.dept === 'quality' && Number(user.layer) === 1 && <button type="button" className="btn alt" style={{ width: '100%', margin: '8px 0 4px' }} disabled={newBusy} onClick={newProcess}>{newBusy ? 'Creando…' : '＋ Hacer una auditoría de proceso'}</button>}
      {!data ? <div className="empty">Cargando…</div> : (
        <>
          <div className="sect">Por realizar</div>
          {todo.length ? todo.map((a) => <Ticket key={a.id} a={a} today={data.today} />)
            : <div className="card empty">No tienes auditorías pendientes.</div>}
          {by(['upcoming']).length > 0 && <><div className="sect">Próximas</div>{by(['upcoming']).map((a) => <Ticket key={a.id} a={a} today={data.today} />)}</>}
          {by(['completed']).filter((a) => a.done_day === data.today).length > 0 && <><div className="sect">Completadas hoy</div>{by(['completed']).filter((a) => a.done_day === data.today).map((a) => <Ticket key={a.id} a={a} today={data.today} />)}</>}
          {by(['completed']).length > 0 && <><div className="sect">Completadas esta semana</div>{by(['completed']).map((a) => <Ticket key={a.id} a={a} today={data.today} />)}</>}
          {by(['missed']).length > 0 && <><div className="sect">No realizadas</div>{by(['missed']).map((a) => <Ticket key={a.id} a={a} today={data.today} />)}</>}
        </>
      )}
    </>
  );
}

// Inicio del admin: no audita, así que ve el resumen del día de la planta
// Admin que también audita (interruptor "Hace LPA" en su perfil): sus pendientes de hoy aparecen arriba
function MyAuditsForAdmin() {
  const [d, setD] = useState(null);
  useEffect(() => { api('/api/my').then(setD).catch(() => {}); }, []);
  const todo = (d?.audits || []).filter((a) => ['last_day', 'open'].includes(a.window));
  if (!todo.length) return null;
  return <><div className="sect">Mis auditorías por hacer</div>{todo.map((a) => <Ticket key={a.id} a={a} today={d.today} />)}</>;
}

function AdminHome() {
  const user = useUser(), master = isMaster(user);
  const [w, setW] = useState(null), [iss, setIss] = useState(null), [err, setErr] = useState(''), [plants, setPlants] = useState(null), [qs, setQs] = useState('');
  useEffect(() => {
    if (master && user.multi_site) api('/api/admin/sites').then(setPlants).catch(() => {});
    { const c = peek('/api/week'); if (c) setW(c); }
    api('/api/week').then(setW).catch((e) => setErr(e.message));
    api('/api/findings?status=open').then((d) => setIss(d)).catch(() => {});
  }, []);
  if (err) return <div className="err">{err}</div>;
  if (!w) return <div className="empty">Cargando…</div>;
  const today = w.today;
  const l1 = w.audits.filter((a) => a.layer === 1 && a.date === today);
  // Ordenadas por zona: A, B, C, D, E, PL1, PL3, PL4, Toolroom, Shipping, Receiving…
  const byZone = (x, y) => zoneRank(x.area) - zoneRank(y.area) || String(x.area).localeCompare(String(y.area)) || x.name.localeCompare(y.name);
  const done = l1.filter((a) => a.status === 'completed').sort(byZone), pend = l1.filter((a) => a.status !== 'completed').sort(byZone);
  const mg = w.audits.filter((a) => a.layer >= 2), mgDone = mg.filter((a) => a.status === 'completed');
  const missed = w.audits.filter((a) => a.window === 'missed');
  const noPart = pend.filter((a) => !a.area);
  const open = iss?.findings || [], overdue = open.filter((f) => f.due_date && f.due_date < (iss?.today || today));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const unassigned = pend.filter((a) => !a.area).length;
  const dayPct = pct(done.length, l1.length);
  const rows = pend.filter((a) => !qs || `${a.name} ${a.area || ''} ${a.part_number || ''}`.toLowerCase().includes(qs.toLowerCase()));
  const ic = (d) => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
  const P = {
    cal: ic(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>),
    ok: ic(<><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16.5 9.5" /></>),
    clock: ic(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>),
    bars: ic(<path d="M6 20v-7M12 20V6M18 20v-11" />),
    warn: ic(<><path d="M12 3.5 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.2v.1" /></>),
    plus: ic(<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>),
    pin: ic(<><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>),
    doc: ic(<><path d="M7 3.5h7.5L19 8v12.5H7z" /><path d="M14 3.5V8h5M10 12.5h6M10 16h6" /></>),
    dots: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>,
  };
  return (
    <div className="ah">
      <div className="row"><h1 className="title grow">Resumen de hoy</h1><Link href="/week" className="ico-btn" aria-label="Programa semanal">{I.calendar(22)}</Link></div>
      <div className="sub">{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <MyAuditsForAdmin />
      {master && user.multi_site && plants && (
        <Link href="/admin" className="plants-strip">
          <div className="ps-top"><b>Plantas activas: {plants.filter((p) => p.active).length} de {plants.length}</b><span>Gestionar ›</span></div>
          <div className="ps-chips">{plants.map((p) => <span key={p.id} className={`ps-chip ${p.active ? 'on' : ''}`}>{p.code}<i>{p.active ? 'activa' : `${p.users} usuarios`}</i></span>)}</div>
        </Link>)}
      <div className="ah-kpis">
        <div className="ah-kpi"><i className="b">{P.cal}</i><div><b>{l1.length}</b><span>Programadas</span></div></div>
        <div className="ah-kpi"><i className="g">{P.ok}</i><div><b>{done.length}</b><span>Completadas</span></div></div>
        <div className="ah-kpi"><i className="o">{P.clock}</i><div><b>{pend.length}</b><span>Pendientes</span></div></div>
        <div className="ah-kpi ah-ring"><Ring value={dayPct} size={64} stroke={8} cls="good" label={`${dayPct}%`} /><div><b>Progreso</b><span>{done.length} de {l1.length} del día</span></div></div>
      </div>
      {unassigned > 0 && <Link href="/admin" className="ah-alert"><i>{P.warn}</i><b>{unassigned} sin zona o máquina asignada</b><span className="btn sm">Asignar ›</span></Link>}
      {missed.length > 0 && <Link href="/dashboard" className="ah-alert red"><i>{P.warn}</i><b>{missed.length} no realizada(s) esta semana</b><span className="btn sm">Ver Panel ›</span></Link>}
      {overdue.length > 0 && <Link href="/findings" className="ah-alert red"><i>{P.warn}</i><b>{overdue.length} issue(s) vencido(s)</b><span className="btn sm">Ver Issues ›</span></Link>}
      <section className="ah-card ah-main">
        <div className="ah-head"><h2>Pendientes <small>({pend.length})</small></h2>
          <input className="inp ah-search" placeholder="Buscar auditor o zona…" value={qs} onChange={(e) => setQs(e.target.value)} /></div>
        {rows.length ? (
          <div className="ah-table ah-simple">
            {rows.map((a) => (
              <Link key={a.id} href={`/audit/${a.id}`} className="ah-tr">
                <b className="ahwho">{a.name}<small>{DEPT[a.dept] || a.dept} · L{a.layer}</small></b>
                <span className="z"><span className={`ktag inl ${a.kind === 'process' ? 'proc' : 'lpa'}`}>{a.kind === 'process' ? `Proceso ${a.slot}` : 'LPA'}</span>{a.kind === 'process' ? <em className="gray">zona al iniciar</em> : (a.area || <em>Sin zona</em>)}</span>
                <span className={`pill ${a.window === 'last_day' ? 'warn' : 'gold'}`}>{a.window === 'last_day' ? 'Último día' : 'Programada'}</span>
              </Link>))}
          </div>
        ) : <div className="empty">{pend.length ? 'Sin resultados.' : l1.length ? 'Todas las auditorías de hoy están completadas. 🎉' : 'Hoy no hay auditorías programadas.'}</div>}
        {done.length > 0 && <>
          <h3 className="ah-sub">Completadas ({done.length})</h3>
          <div className="ah-table ah-simple">{done.map((a) => (
            <Link key={a.id} href={`/audit/${a.id}`} className="ah-tr done">
              <b className="ahwho">{a.name}<small>{DEPT[a.dept] || a.dept} · L{a.layer}</small></b>
              <span className="z"><span className={`ktag inl ${a.kind === 'process' ? 'proc' : 'lpa'}`}>{a.kind === 'process' ? `Proceso ${a.slot}` : 'LPA'}</span>{a.area}{a.part_number ? <small> · N/P {a.part_number}</small> : null}</span>
              <b className={`score ${scoreCls(a.score_pct)}`}>{Math.round(a.score_pct)}%</b>
            </Link>))}</div></>}
      </section>
    </div>
  );
}

function HomeSwitch() { const user = useUser(); return isAdmin(user) ? <AdminHome /> : <MyHome />; }
export default function Home() { return <Shell><HomeSwitch /></Shell>; }
