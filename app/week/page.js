'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Shell, { useUser } from '@/components/Shell';
import { isAdmin } from '@/lib/roles';
import { api, fmtDate, DEPT, LAYER, DAYS_SHORT } from '@/lib/client';

const shift = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export default function Week() {
  return <Shell><WeekInner /></Shell>;
}

function WeekInner() {
  const user = useUser();
  const [date, setDate] = useState(null), [data, setData] = useState(null), [err, setErr] = useState('');
  const [dept, setDept] = useState('all'), [layer, setLayer] = useState('all');
  const [mine, setMine] = useState(false);

  const load = (d) => api(`/api/week${d ? `?date=${d}` : ''}`).then((r) => { setData(r); if (!d) setDate(r.monday); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const go = (n) => { const d = shift(data.monday, n * 7); setDate(d); setData(null); load(d); };

  const rows = useMemo(() => {
    if (!data) return [];
    const by = new Map();
    for (const a of data.audits) {
      if (dept !== 'all' && a.dept !== dept) continue;
      if (layer !== 'all' && String(a.layer) !== layer) continue;
      if (mine && a.user_id !== user.id) continue;
      if (!by.has(a.user_id)) by.set(a.user_id, { user: a, cells: {} });
      by.get(a.user_id).cells[a.date] = a;
    }
    return [...by.values()].sort((x, y) => y.user.layer - x.user.layer || (x.user.layer === 1 ? String(DEPT[x.user.dept]).localeCompare(DEPT[y.user.dept]) : 0) || x.user.name.localeCompare(y.user.name));
  }, [data, dept, layer, mine, user.id]);

  if (err) return <div className="err">{err}</div>;
  const today = data?.today;
  const status = (a) => a.status === 'completed' ? (a.late ? 'late' : 'completed') : a.window;

  let lastGroup = null;
  const gkey = (u) => (u.layer >= 2 ? `L${u.layer}` : `L1-${u.dept}`);
  const gcount = (k) => rows.filter((r) => gkey(r.user) === k).length;
  const glabel = (u) => (u.layer === 3 ? 'Layer 3 · GM' : u.layer === 2 ? 'Layer 2 · Gerentes' : u.layer === 4 ? 'Layer 4' : `Layer 1 · ${DEPT[u.dept]}`);
  return (
    <>
      <h1 className="title">{isAdmin(user) ? 'Programa semanal' : 'Mi semana'}</h1>
      <div className="row wrap" style={{ margin: isAdmin(user) ? '10px 0' : '6px 0 10px' }}>
        <button className="btn alt sm" onClick={() => go(-1)} disabled={!data}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>{data ? `${fmtDate(data.days[0], { day: 'numeric', month: 'short' })} – ${fmtDate(data.days[4], { day: 'numeric', month: 'short', year: 'numeric' })}` : '…'}</div>
        <button className="btn alt sm" onClick={() => go(1)} disabled={!data}>›</button>
      </div>
      {isAdmin(user) && (
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <select className="inp" style={{ width: 'auto' }} value={layer} onChange={(e) => setLayer(e.target.value)}>
          <option value="all">Todas las capas</option><option value="1">Layer 1</option><option value="2">Layer 2</option><option value="3">Layer 3</option><option value="4">Layer 4</option>
        </select>
        <select className="inp" style={{ width: 'auto' }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">Todos los depts.</option>
          {Object.entries(DEPT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="row" style={{ fontSize: 14 }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Solo yo</label>
      </div>
      )}
      {data && !isAdmin(user) ? (
        data.audits.length ? (
          <div className="wk-my">
            {(() => {
              const all = [...data.audits].sort((x, y) => x.date.localeCompare(y.date) || (x.slot || 0) - (y.slot || 0));
              const wide = all.filter((x) => x.date !== x.due_date);
              const rowsBy = data.days.map((d) => ({ d, list: all.filter((x) => x.date === d && x.date === x.due_date) })).filter((r) => r.list.length);
              const pillTxt = (x) => x.status === 'completed' ? `${Math.round(x.score_pct)}%` : '';
              const row = (key, lbl, sub, list, isToday) => (
                <div key={key} className={`wk-my-row ${isToday ? 'today' : ''}`}>
                  <div className="wk-my-d"><b>{lbl}</b><span>{sub}</span></div>
                  <div className="wk-my-c">
                    {list.filter((x) => x.kind !== 'process').map((x) => (
                      <Link key={x.id} href={`/audit/${x.id}`} className={`chip wk-lpa ${status(x)}`}><span>{x.area || 'Sin zona'}</span>{pillTxt(x) && <b>{pillTxt(x)}</b>}</Link>))}
                    <div className="wk-procs">{list.filter((x) => x.kind === 'process').map((x) => (
                      <Link key={x.id} href={`/audit/${x.id}`} className={`chip wk-p ${status(x)}`}>P{x.slot}{pillTxt(x) && <b>{pillTxt(x)}</b>}</Link>))}</div>
                  </div>
                </div>);
              return [
                ...wide.map((x) => row('w' + x.id, 'Semana', `vence ${fmtDate(x.due_date, { weekday: 'short', day: 'numeric' })}`, [x], today >= x.date && today <= x.due_date)),
                ...rowsBy.map((r) => row(r.d, fmtDate(r.d, { weekday: 'short' }), fmtDate(r.d, { day: 'numeric', month: 'short' }), r.list, r.d === today)),
              ];
            })()}
          </div>
        ) : <div className="card empty">No tienes auditorías programadas esta semana.</div>
      ) : !data ? <div className="empty">Cargando…</div> : (
        <>
        <div className="wk-cards">
          {(() => { let lg = null; return rows.map(({ user: u, cells }) => {
            const gk = gkey(u), head = lg !== gk ? (lg = gk, <div key={'h' + gk} className="wk-grp">{glabel(u)} <span>({gcount(gk)})</span></div>) : null;
            const wide = u.layer >= 2 ? Object.values(cells)[0] : null;
            return [head, (
              <div key={u.user_id} className="wk-card">
                <div className="wk-name"><b>{u.name}</b><span>{DEPT[u.dept]} · {u.template}</span></div>
                {wide ? (
                  <Link href={`/audit/${wide.id}`} className={`chip wide ${status(wide)}`}>{wide.area}{wide.part_number ? ` · N/P ${wide.part_number}` : ''} · vence {fmtDate(wide.due_date, { weekday: 'short', day: 'numeric' })}{wide.status === 'completed' ? ` · ${Math.round(wide.score_pct)}%` : ''}</Link>
                ) : (
                  <div className="wk-days">{data.days.map((d, i) => {
                    const x = cells[d];
                    return (
                      <div key={d} className={`wk-day ${d === today ? 'today' : ''}`}>
                        <small>{DAYS_SHORT[i]} {Number(d.slice(8))}</small>
                        {x ? <Link href={`/audit/${x.id}`} className={`chip ${status(x)}`}>{x.area || '—'}{x.status === 'completed' ? <b>{Math.round(x.score_pct)}%</b> : null}</Link> : <span className="none">—</span>}
                      </div>);
                  })}</div>
                )}
              </div>)];
          }); })()}
          {!rows.length && <div className="empty">Sin auditorías esta semana</div>}
        </div>
        <div className="matrix-wrap">
          <table className="matrix">
            <thead><tr><th>Auditor</th>{data.days.map((d, i) => <th key={d} className={d === today ? 'today' : ''}>{DAYS_SHORT[i]} {Number(d.slice(8))}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ user: u, cells }) => {
                const gk = gkey(u), head = lastGroup !== gk ? (lastGroup = gk, <tr key={'g' + gk} className="layer"><td colSpan={6}>{glabel(u)} <span style={{ opacity: .6, fontWeight: 500 }}>({gcount(gk)})</span></td></tr>) : null;
                const nameCell = <td className="name">{u.name}<span>{DEPT[u.dept]} · {u.template}</span></td>;
                const wide = u.layer >= 2 ? Object.values(cells)[0] : null;
                return [head,
                  <tr key={u.user_id}>
                    {nameCell}
                    {wide ? (
                      <td colSpan={5} className="cell">
                        <Link href={`/audit/${wide.id}`} className={`chip wide ${status(wide)}`}>{wide.area}{wide.part_number ? ` · N/P ${wide.part_number}` : ''} · vence {fmtDate(wide.due_date, { weekday: 'short', day: 'numeric' })}{wide.status === 'completed' ? ` · ${Math.round(wide.score_pct)}%` : ''}</Link>
                      </td>
                    ) : data.days.map((d) => {
                      const a = cells[d];
                      return (
                        <td key={d} className={`cell ${d === today ? 'today' : ''}`}>
                          {a ? <div>
                            <Link href={`/audit/${a.id}`} className={`chip ${status(a)}`}>{a.area}{a.part_number ? ` · ${a.part_number}` : ''}{a.status === 'completed' && <span> · {Math.round(a.score_pct)}%</span>}</Link>
                          </div> : <span style={{ color: 'var(--line)' }}>—</span>}
                        </td>);
                    })}
                  </tr>];
              })}
            </tbody>
          </table>
          {!rows.length && <div className="empty">Sin auditorías esta semana</div>}
        </div>
        </>
      )}
      {isAdmin(user) && <div className="row wrap" style={{ marginTop: 12, fontSize: 12, color: 'var(--sub)' }}>
        <span><span className="dot completed" />Completada</span><span><span className="dot open" />Programada</span><span><span className="dot last_day" />Último día</span><span><span className="dot missed" />No realizada</span><span><span className="dot" />Próxima</span>
      </div>}
    </>
  );
}
