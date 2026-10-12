'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Bi from '@/components/Bi';
import Shell from '@/components/Shell';
import { api, fmtDate, scoreCls } from '@/lib/client';
import Ring from '@/components/Ring';
import { I } from '@/components/Icons';

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

export default function Home() {
  const [data, setData] = useState(null), [err, setErr] = useState(''), [iss, setIss] = useState([]);
  useEffect(() => { api('/api/my').then(setData).catch((e) => setErr(e.message)); api('/api/findings?status=mine').then((d) => setIss(d.findings.slice(0, 3).map((f) => ({ ...f, overdue: f.due_date && f.due_date < d.today })))).catch(() => {}); }, []);
  if (err) return <Shell><div className="err">{err}</div></Shell>;
  const list = data?.audits || [];
  const by = (w) => list.filter((a) => w.includes(a.window));
  const todo = by(['last_day', 'open']).sort((a, b) => (a.window === 'last_day' ? -1 : 1) - (b.window === 'last_day' ? -1 : 1));
  return (
    <Shell>
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
    </Shell>
  );
}
