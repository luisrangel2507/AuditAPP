'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell, { useUser } from '@/components/Shell';
import { api, fmtDate } from '@/lib/client';

const ST = { open: ['Iniciar', 'gold'], last_day: ['Último día', 'warn'], missed: ['No realizada', 'nok'], completed: ['Completada', 'ok'], upcoming: ['Próxima', ''] };
const shift = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

function Inner() {
  const user = useUser();
  const [data, setData] = useState(null), [err, setErr] = useState('');
  const load = (d) => { setData(null); api(`/api/qes${d ? `?date=${d}` : ''}`).then(setData).catch((e) => setErr(e.message)); };
  useEffect(() => { load(); }, []);
  if (err) return <div className="err">{err}</div>;
  const days = data?.days || [];
  return (
    <>
      <h1 className="title">QEs · Auditorías de proceso</h1>
      <p className="sub" style={{ margin: '4px 0 10px' }}>Auditorías de proceso del día. Al terminar escoges el área auditada. Si hay hallazgos (X / Δ) se abren en Issues.</p>
      <div className="row wrap" style={{ margin: '10px 0' }}>
        <button className="btn alt sm" onClick={() => load(shift(data.monday, -7))} disabled={!data}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>{data ? `${fmtDate(days[0], { day: 'numeric', month: 'short' })} – ${fmtDate(days[4], { day: 'numeric', month: 'short', year: 'numeric' })}` : '…'}</div>
        <button className="btn alt sm" onClick={() => load(shift(data.monday, 7))} disabled={!data}>›</button>
      </div>
      {!data ? <div className="empty">Cargando…</div> : !data.audits.length ? <div className="card empty">Sin auditorías de proceso esta semana.</div> : days.map((d) => {
        const list = data.audits.filter((a) => a.date === d);
        if (!list.length) return null;
        return (
          <div key={d} className="qes-day">
            <div className={`qes-d ${d === data.today ? 'today' : ''}`}>{fmtDate(d, { weekday: 'long' })} <span>{fmtDate(d, { day: 'numeric', month: 'short' })}</span></div>
            <div className="qes-slots">
              {list.map((a) => {
                const [label, cls] = ST[a.window] || ['', ''];
                const go = a.window === 'open' || a.window === 'last_day' || a.window === 'completed';
                const inner = (<>
                  <b>Proceso {a.slot}</b>
                  <span className="sub">{a.status === 'completed' ? a.area : `${a.total_questions} preguntas`}</span>
                  <span className={`pill ${cls}`}>{a.window === 'completed' ? `${Math.round(a.score_pct)}%` : label}</span>
                </>);
                return go ? <Link key={a.id} href={`/audit/${a.id}`} className="qes-slot">{inner}</Link> : <div key={a.id} className="qes-slot off">{inner}</div>;
              })}
            </div>
          </div>);
      })}
    </>
  );
}
export default function QEs() { return <Shell><Inner /></Shell>; }
