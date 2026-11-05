'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate } from '@/lib/client';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const addD = (s, n) => { const t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const DEPT = { management: 'GM', quality: 'Quality', production: 'Production', process: 'Process', logistics: 'Logistics', hr: 'HR', maintenance: 'Maintenance', toolroom: 'Tool Room' };

function Inner() {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [date, setDate] = useState('');
  useEffect(() => { setD(null); api(`/api/admin/reports/programa${date ? `?date=${date}` : ''}`).then(setD).catch((e) => setErr(e.message)); }, [date]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  return (
    <div className="pgm-w">
      <div className="crumb" style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 8 }}><a href="/admin" style={{ color: 'inherit' }}>Administración</a> › <a href="/reports" style={{ color: 'inherit' }}>Reportes</a> › <b>Programa Auditoría LPA</b></div>
      <div className="row pgm-bar"><button className="btn alt sm" onClick={() => setDate(addD(d.monday, -7))}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>Semana del {fmtDate(d.monday, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <button className="btn alt sm" onClick={() => setDate(addD(d.monday, 7))}>›</button>
        <button className="btn sm" onClick={() => window.print()}>Imprimir / PDF</button></div>
      <div className="pgm">
        <div className="pgm-h"><h1>Programa Auditoría LPA</h1><div>SEMANA: <b>{fmtDate(d.monday, { day: 'numeric', month: 'short', year: 'numeric' })}</b></div></div>
        <table className="pgm-t"><thead><tr><th>Nivel</th><th>Audit item</th><th>Formato</th><th>Auditor</th>{d.days.map((x, i) => <th key={x}>{DAYS[i]}<small>{fmtDate(x, { day: 'numeric', month: 'short' })}</small></th>)}</tr></thead>
          <tbody>{d.rows.map((r, i) => <tr key={i} className={`L${r.layer}`}>
            <td className="c">{r.layer}</td><td>{r.layer === 2 ? 'Manager' : DEPT[r.dept] || r.dept}</td><td>{r.template.replace(/ Audit$/, '')}</td><td><b>{r.name}</b></td>
            {r.layer >= 2 ? <td colSpan={5} className="c">{r.wide || '—'}</td> : r.cells.map((c, k) => <td key={k} className={c ? 'c' : 'off'}>{c || ''}</td>)}</tr>)}
            {!d.rows.length && <tr><td colSpan={9} className="c">Sin auditorías programadas esta semana</td></tr>}</tbody></table>
        <div className="pgm-f">MPQ</div>
      </div>
      <style>{`
        .pgm-bar { gap: 6px; margin-bottom: 10px; flex-wrap: wrap }
        .pgm { background: #fff; color: #111; font-family: Calibri, Arial, sans-serif; max-width: 1100px; margin: 0 auto; padding: 14px 18px; font-size: 12px }
        .pgm-h { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px } .pgm-h h1 { font-size: 24px; margin: 0 }
        .pgm-t { width: 100%; border-collapse: collapse } .pgm-t th, .pgm-t td { border: 1px solid #555; padding: 3px 6px }
        .pgm-t th { background: #e8e8e8 } .pgm-t th small { display: block; font-weight: 400 } .pgm-t .c { text-align: center }
        .pgm-t .off { background: #8c8c8c } .pgm-t tr.L3 td:not(.off) { background: #d7e8b5 } .pgm-t tr.L2 td:not(.off) { background: #b9c8e6 } .pgm-t tr.L1 td:not(.off) { background: #f4e3a0 }
        .pgm-f { text-align: right; font-weight: 700; margin-top: 4px }
        @media print { @page { size: landscape; margin: 8mm } .pgm-bar, .crumb { display: none } .pgm { padding: 0; max-width: none } }
      `}</style>
    </div>);
}

export default function Page() { return <Shell need="admin"><Inner /></Shell>; }
