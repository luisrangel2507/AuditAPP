'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate } from '@/lib/client';

const ST = ['White', 'Green', 'Yellow', 'Orange', 'Pink'];
const addD = (s, n) => { const t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const dmy = (s) => `${Number(s.slice(8))}/${Number(s.slice(5, 7))}/${s.slice(0, 4)}`;

function Inner() {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [date, setDate] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('date')) || '');
  useEffect(() => { setD(null); api(`/api/admin/reports/qa075${date ? `?date=${date}` : ''}`).then(setD).catch((e) => setErr(e.message)); }, [date]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  const pages = d.sheets.flatMap((s) => { const out = []; for (let i = 0; i < Math.max(1, s.blocks.length); i += 5) out.push({ s, blocks: s.blocks.slice(i, i + 5), off: i }); return out; });
  return (
    <div className="qf">
      <div className="crumb" style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 8 }}><a href="/admin" style={{ color: 'inherit' }}>Administración</a> › <a href="/reports" style={{ color: 'inherit' }}>Reportes</a> › <b>QA-075-C</b></div>
      <div className="row qf-bar"><button className="btn alt sm" onClick={() => setDate(addD(d.date, -1))}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>{fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <button className="btn alt sm" onClick={() => setDate(addD(d.date, 1))}>›</button>
        <button className="btn sm" onClick={() => window.print()} disabled={!pages.length}>Imprimir / PDF</button></div>
      {!d.sheets.length && <div className="card empty">No hay auditorías gerenciales realizadas ese día.</div>}
      {pages.map(({ s, blocks, off }, pi) => (
        <div className="q75" key={pi}>
          <div className="q75-h"><div className="l"><div>Auditor: <span>{s.auditor}</span></div><div>Date: <span>{dmy(s.date)}</span></div><div>Shift: <span>{s.shift || ''}</span></div></div>
            <h1>Management Audit Findings</h1><div className="r">Program: <span>{s.date.slice(0, 4)}</span></div></div>
          {[...Array(5)].map((_, i) => { const b = blocks[i]; return (
            <div className="q75-b" key={i}><div className="n">{off + i + 1}</div>
              <table><thead><tr><th>Issue(s)</th><th>Part Number</th><th>Part Name</th><th colSpan={4}>Sticker</th></tr></thead>
                <tbody><tr><td rowSpan={6} className="iss">{b?.issue || ''}</td><td rowSpan={6}>{b?.number || ''}</td><td rowSpan={6}>{b?.name || ''}</td><td className="sn" /><td className="h">Date</td><td className="h">Operator</td><td className="h">Shift</td></tr>
                  {ST.map((c) => { const on = b?.sticker === c; return <tr key={c}><td className="sn">{c}</td><td>{on ? dmy(b.date) : ''}</td><td>{on ? b.operator : ''}</td><td>{on ? b.shift : ''}</td></tr>; })}</tbody></table></div>); })}
          <div className="q75-f"><span>QA-075-C &nbsp; Rev: Rel</span><span>Effective Date: 30-Mar-15</span><span>Approver: Director of Quality</span></div>
        </div>))}
      <style>{`
        .qf-bar { gap: 6px; margin-bottom: 10px; flex-wrap: wrap }
        .q75 { background: #fff; color: #111; font-family: Calibri, Arial, sans-serif; max-width: 980px; margin: 0 auto 16px; padding: 18px 22px; font-size: 12px }
        .q75-h { display: grid; grid-template-columns: 1fr 1.4fr 1fr; align-items: start; margin-bottom: 8px } .q75-h h1 { font: 700 18px Georgia, serif; text-align: center; margin: 0 } .q75-h .l div, .q75-h .r { margin: 3px 0; font-size: 12px } .q75-h span { display: inline-block; min-width: 130px; border-bottom: 1px solid #111; text-align: center; color: #b00 } .q75-h .r { text-align: right }
        .q75-b { display: grid; grid-template-columns: 30px 1fr; border: 1.5px solid #111; margin-bottom: 8px } .q75-b .n { display: grid; place-items: center; font-weight: 700; border-right: 1.5px solid #111 }
        .q75-b table { border-collapse: collapse; width: 100% } .q75-b th, .q75-b td { border: 1px solid #111; padding: 2px 4px; text-align: center; height: 18px; font-size: 11px } .q75-b th { background: #d9d9d9 } .q75-b td.h { background: #d9d9d9; font-weight: 700 } .q75-b td { color: #b00 } .q75-b td.sn, .q75-b td.h { color: #111 } .q75-b td.iss { width: 38%; font-size: 13px }
        .q75-f { display: flex; justify-content: space-between; font-size: 11px; margin-top: 8px }
        @media print { @page { size: letter landscape; margin: 8mm } body * { visibility: hidden } .qf, .qf * { visibility: visible } .qf { position: absolute; left: 0; top: 0; width: 100% } .qf-bar, .crumb { display: none } .q75 { max-width: none; margin: 0; padding: 0; break-after: page } }
      `}</style>
    </div>
  );
}
export default function Page() { return <Shell need="admin"><Inner /></Shell>; }
