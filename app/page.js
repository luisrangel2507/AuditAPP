'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Bi from '@/components/Bi';
import Shell, { useUser } from '@/components/Shell';
import { api, fmtDate, scoreCls } from '@/lib/client';
import Ring from '@/components/Ring';
import { I } from '@/components/Icons';
import { isAdmin, isMaster } from '@/lib/roles';

const STATE = {
  open: ['Programada', 'gold'], last_day: ['Último día', 'warn'], missed: ['No realizada', 'nok'],
  completed: ['Completada', 'ok'], upcoming: ['Próxima', ''],
};

function Ticket({ a, today }) {
  const [label, cls] = STATE[a.window];
  const multi = a.date !== a.due_date;
  return (
    <Link href={`/audit/${a.id}`} className={`ticket s-${a.window}`}>
      <div className="main">
        <div className="day">
          <span className="d-ico">{I.calendar(16)}</span>
          <span>{a.date === today ? 'Hoy' : multi ? `Semana ${fmtDate(a.date, { day: 'numeric', month: 'short' })} – ${fmtDate(a.due_date, { day: 'numeric', month: 'short' })}` : fmtDate(a.date)}</span>
          <span className={`pill ${cls}`}>{label}</span>
        </div>
        <div className="area">{a.area || 'Sin zona asignada'}</div>
        {a.part_number && <div className="partno">N/P <b>{a.part_number}</b></div>}
        <div className="meta">
          {a.template} · {a.total_questions} preguntas
          {a.window === 'last_day' && ` · cierra hoy`}{a.window === 'open' && a.date === a.due_date && ` · solo hoy`}
          {a.window === 'open' && a.date !== a.due_date && ` · disponible hasta ${fmtDate(a.closes_on, { weekday: 'short', day: 'numeric' })}`}
          {a.window === 'completed' && a.nok_count + a.partial_count > 0 && ` · ${a.nok_count + a.partial_count} open issue(s)`}
        </div>
      </div>
      <div className="stub">
        <span className="chev">{I.chevron(18)}</span>
        {a.window === 'completed' ? <Ring value={a.score_pct} size={60} stroke={7} cls={scoreCls(a.score_pct)} label={`${Math.round(a.score_pct)}%`} />
          : a.window === 'open' || a.window === 'last_day' ? <span className="go">{I.play(18)}Iniciar</span>
          : a.window === 'missed' ? <div className="meta">Ventana cerrada</div>
          : <div className="meta">{fmtDate(a.date, { weekday: 'short', day: 'numeric' })}</div>}
      </div>
    </Link>
  );
}

function MyHome() {
  const [data, setData] = useState(null), [err, setErr] = useState(''), [iss, setIss] = useState([]);
  useEffect(() => { api('/api/my').then(setData).catch((e) => setErr(e.message)); api('/api/findings?status=mine').then((d) => setIss(d.findings.slice(0, 3).map((f) => ({ ...f, overdue: f.due_date && f.due_date < d.today })))).catch(() => {}); }, []);
  if (err) return <Shell><div className="err">{err}</div></Shell>;
  const list = data?.audits || [];
  const by = (w) => list.filter((a) => w.includes(a.window));
  const todo = by(['last_day', 'open']).sort((a, b) => (a.window === 'last_day' ? -1 : 1) - (b.window === 'last_day' ? -1 : 1));
  return (
    <>
      <div className="row"><h1 className="title grow">Mis auditorías</h1><Link href="/week" className="ico-btn" aria-label="Programa semanal">{I.calendar(22)}</Link></div>
      <div className="sub">{data ? fmtDate(data.today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ' '}</div>
      {!data ? <div className="empty">Cargando…</div> : (
        <>
          {iss.length > 0 && <>
            <div className="sect">Open issues a tu cargo</div>
            {iss.map((f) => (
              <Link key={f.id} href={`/findings?oi=${f.id}`} className={`ticket s-${f.overdue ? 'missed' : 'open'}`}>
                <div className="main">
                  <div className="day"><span className="oi-no">OI-{String(f.id).padStart(4, '0')}</span><span className={`pill ${f.overdue ? 'nok' : 'gold'}`}>{f.overdue ? 'Vencido' : 'Pendiente'}</span></div>
                  <div className="area" style={{ fontSize: 17 }}><Bi text={f.question} /></div>
                  <div className="meta">{f.area} · compromiso {fmtDate(f.due_date, { day: 'numeric', month: 'short' })}</div>
                </div>
                <div className="stub"><span className="chev">{I.chevron(18)}</span></div>
              </Link>))}
            <Link href="/findings" className="btn-ghost" style={{ display: 'inline-block', margin: '2px 0 4px' }}>Ver todos mis issues ›</Link>
          </>}
          <div className="sect">Por realizar</div>
          {todo.length ? todo.map((a) => <Ticket key={a.id} a={a} today={data.today} />)
            : <div className="card empty">No tienes auditorías pendientes.</div>}
          {by(['upcoming']).length > 0 && <><div className="sect">Próximas</div>{by(['upcoming']).map((a) => <Ticket key={a.id} a={a} today={data.today} />)}</>}
          {by(['completed']).length > 0 && <><div className="sect">Completadas esta semana</div>{by(['completed']).map((a) => <Ticket key={a.id} a={a} today={data.today} />)}</>}
          {by(['missed']).length > 0 && <><div className="sect">No realizadas</div>{by(['missed']).map((a) => <Ticket key={a.id} a={a} today={data.today} />)}</>}
        </>
      )}
    </>
  );
}

// Inicio del admin: no audita, así que ve el resumen del día de la planta
function AdminHome() {
  const user = useUser(), master = isMaster(user);
  const [w, setW] = useState(null), [iss, setIss] = useState(null), [err, setErr] = useState(''), [plants, setPlants] = useState(null);
  useEffect(() => {
    if (master && user.multi_site) api('/api/admin/sites').then(setPlants).catch(() => {});
    api('/api/week').then(setW).catch((e) => setErr(e.message));
    api('/api/findings?status=open').then((d) => setIss(d)).catch(() => {});
  }, []);
  if (err) return <div className="err">{err}</div>;
  if (!w) return <div className="empty">Cargando…</div>;
  const today = w.today;
  const l1 = w.audits.filter((a) => a.layer === 1 && a.date === today);
  const done = l1.filter((a) => a.status === 'completed'), pend = l1.filter((a) => a.status !== 'completed');
  const mg = w.audits.filter((a) => a.layer >= 2), mgDone = mg.filter((a) => a.status === 'completed');
  const missed = w.audits.filter((a) => a.window === 'missed');
  const noPart = pend.filter((a) => !a.part_number || !a.area);
  const open = iss?.findings || [], overdue = open.filter((f) => f.due_date && f.due_date < (iss?.today || today));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  return (
    <>
      <div className="row"><h1 className="title grow">Resumen de hoy</h1><Link href="/week" className="ico-btn" aria-label="Programa semanal">{I.calendar(22)}</Link></div>
      <div className="sub">{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      {master && user.multi_site && plants && (
        <Link href="/admin" className="plants-strip">
          <div className="ps-top"><b>Plantas activas: {plants.filter((p) => p.active).length} de {plants.length}</b><span>Gestionar ›</span></div>
          <div className="ps-chips">{plants.map((p) => <span key={p.id} className={`ps-chip ${p.active ? 'on' : ''}`}>{p.code}<i>{p.active ? 'activa' : `${p.users} usuarios`}</i></span>)}</div>
          {plants.some((p) => !p.active) && <div className="sub">Faltan por poner en marcha: {plants.filter((p) => !p.active).map((p) => p.code).join(', ')}</div>}
        </Link>)}
      <div className="kpis" style={{ marginTop: 14 }}>
        <div className="kpi"><b>{l1.length}</b><span>Auditorías programadas hoy</span></div>
        <div className="kpi"><b className="score good">{done.length}</b><span>Completadas hoy ({pct(done.length, l1.length)}%)</span></div>
        <div className="kpi"><b>{pend.length}</b><span>Pendientes hoy</span></div>
        <div className="kpi"><b>{mgDone.length}/{mg.length}</b><span>Gerencia: auditoría semanal</span></div>
      </div>
      {(noPart.length > 0 || missed.length > 0 || overdue.length > 0) && (
        <div className="admin-alerts">
          {noPart.length > 0 && <Link href="/admin" className="alert-row warn"><b>{noPart.length}</b> auditoría(s) de hoy sin zona o número de parte <span>Asignar ›</span></Link>}
          {missed.length > 0 && <Link href="/dashboard" className="alert-row nok"><b>{missed.length}</b> auditoría(s) no realizada(s) esta semana <span>Ver Panel ›</span></Link>}
          {overdue.length > 0 && <Link href="/findings" className="alert-row nok"><b>{overdue.length}</b> issue(s) vencido(s) <span>Ver Issues ›</span></Link>}
        </div>)}
      <div className="sect">Pendientes hoy ({pend.length})</div>
      {pend.length ? (
        <div className="card">{pend.map((a) => (
          <Link key={a.id} href={`/audit/${a.id}`} className="row adm-pend">
            <span className="grow"><b>{a.name}</b><span className="sub"> · {a.area || 'Sin zona'}{a.part_number ? ` · N/P ${a.part_number}` : ''}</span></span>
            <span className={`pill ${a.window === 'last_day' ? 'warn' : 'gold'}`}>{a.window === 'last_day' ? 'Último día' : 'Programada'}</span>
          </Link>))}</div>
      ) : <div className="card empty">{l1.length ? 'Todas las auditorías de hoy están completadas. 🎉' : 'Hoy no hay auditorías programadas.'}</div>}
      {done.length > 0 && <>
        <div className="sect">Completadas hoy ({done.length})</div>
        <div className="card">{done.map((a) => (
          <Link key={a.id} href={`/audit/${a.id}`} className="row adm-pend">
            <span className="grow"><b>{a.name}</b><span className="sub"> · {a.area}{a.part_number ? ` · N/P ${a.part_number}` : ''}</span></span>
            <b className={`score ${scoreCls(a.score_pct)}`}>{Math.round(a.score_pct)}%</b>
          </Link>))}</div></>}
      <div className="row wrap" style={{ marginTop: 18 }}>
        <Link href="/admin" className="btn sm">Asignar zonas y N/P</Link>
        <Link href="/dashboard" className="btn alt sm">Abrir Panel</Link>
      </div>
    </>
  );
}

function HomeSwitch() { const user = useUser(); return isAdmin(user) ? <AdminHome /> : <MyHome />; }
export default function Home() { return <Shell><HomeSwitch /></Shell>; }
