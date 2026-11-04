'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate } from '@/lib/client';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SYM = { ok: 'O', nok: 'X', partial: 'X', na: 'N/A' };
const addD = (s, n) => { const t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

function Inner() {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [date, setDate] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('date')) || '');
  useEffect(() => { setD(null); api(`/api/admin/reports/qa076${date ? `?date=${date}` : ''}`).then(setD).catch((e) => setErr(e.message)); }, [date]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  const wk = d.monday.split('-');
  const rows = Math.max(14, d.questions.length);
  return (
    <div className="qf">
      <div className="crumb" style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 8 }}><a href="/admin" style={{ color: 'inherit' }}>Administración</a> › <a href="/reports" style={{ color: 'inherit' }}>Reportes</a> › <b>QA-076-C</b></div>
      <div className="row qf-bar"><button className="btn alt sm" onClick={() => setDate(addD(d.monday, -7))}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>Semana del {fmtDate(d.monday, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <button className="btn alt sm" onClick={() => setDate(addD(d.monday, 7))}>›</button>
        <button className="btn sm" onClick={() => window.print()}>Imprimir / PDF</button></div>
      <div className="q76">
        <div className="q76-top"><div className="ultra"><b>Ultr<i>▲</i></b><span>MANUFACTURING</span></div><h1>Dock Audit Findings</h1><img src="/mitchell-logo.png" alt="Mitchell Plastics" /></div>
        <div className="q76-mid">
          <div className="l"><div>Auditor: <span>QE</span></div><div>Date: <span>{Number(wk[1])}/{Number(wk[2])}/{wk[0]}</span></div><div>Shift: <span /></div></div>
          <div className="lg"><div>Legend</div><div><b>O</b> &nbsp; Good, no issues</div><div><b>X</b> &nbsp; No Good, issues found</div></div>
        </div>
        <table className="q76-t"><thead>
          <tr><th className="n" /><th className="qq" />{DAYS.map((x, i) => <th key={x} className="sh">Shipper #{d.cols[i] ? <small>{d.cols[i].shipper}{d.cols[i].part ? ` · N/P ${d.cols[i].part}` : ''}</small> : null}</th>)}</tr>
          <tr><th className="n" /><th className="qq" />{DAYS.map((x) => <th key={x} className="dy">{x}</th>)}</tr></thead>
          <tbody>{[...Array(rows)].map((_, i) => { const qn = d.questions[i]; return <tr key={i}><td className="n">{i + 1}</td><td className="qq">{qn?.text || ''}</td>
            {d.cols.map((c, k) => <td key={k} className={`mk ${qn && c?.answers[qn.id] ? 'r-' + c.answers[qn.id] : ''}`}>{qn && c ? SYM[c.answers[qn.id]] || '' : ''}</td>)}</tr>; })}</tbody></table>
        <div className="q76-rp"><u>Reaction Plan</u><p>When issues are found they are to be brought to the Logistics Managers attention for resolution.</p></div>
        <div className="q76-f"><span>QA-076-C &nbsp; Rev: Rel</span><span>Effective Date: 30-Mar-15</span><span>Approver: Director of Quality</span></div>
      </div>
      <style>{`
        .qf-bar { gap: 6px; margin-bottom: 10px; flex-wrap: wrap }
        .q76 { background: #fff; color: #111; font-family: Calibri, Arial, sans-serif; max-width: 980px; margin: 0 auto; padding: 18px 24px; font-size: 12px }
        .q76-top { display: grid; grid-template-columns: 1fr 1.2fr 1fr; align-items: center } .q76-top h1 { font: 700 20px Georgia, serif; text-align: center; margin: 0 } .q76-top img { height: 28px; justify-self: end }
        .q76 .ultra { background: #111; color: #fff; display: inline-block; padding: 4px 8px 2px; width: 118px } .q76 .ultra b { font-size: 22px } .q76 .ultra i { color: #e0301e; font-style: normal; font-size: 14px } .q76 .ultra span { display: block; font-size: 6px; letter-spacing: 1.6px }
        .q76-mid { display: grid; grid-template-columns: 1fr 1fr; margin: 18px 0 8px } .q76-mid .l div { margin: 8px 0; font-weight: 700 } .q76-mid .l span { display: inline-block; min-width: 190px; border-bottom: 1px solid #111; text-align: center; font-weight: 400; color: #b00; margin-left: 10px } .q76-mid .lg { justify-self: center; font-size: 13px } .q76-mid .lg div { margin: 3px 0 }
        .q76-t { width: 100%; border-collapse: collapse; table-layout: fixed } .q76-t th, .q76-t td { border: 1.5px solid #111; padding: 1px 5px; height: 21px } .q76-t th.n, .q76-t td.n { width: 28px; text-align: center } .q76-t th.qq { width: 37%; border-top: 0; border-left: 0; background: none } .q76-t td.qq { text-align: justify; hyphens: auto; font-size: 11.5px; line-height: 1.15 }
        .q76-t th.sh { background: #d9d9d9; font-size: 13px; text-align: center; border-bottom: 0 } .q76-t th.sh small { display: block; font-weight: 400; color: #b00; font-size: 10px } .q76-t th.dy { background: #d9d9d9; font-size: 12px; font-weight: 400; text-align: center } .q76-t th.n { border: 0; background: none }
        .q76-t td.mk { text-align: center; color: #b00; font-weight: 700; font-size: 15px } .q76-t td.mk.r-nok, .q76-t td.mk.r-partial { color: #c00 }
        .q76-rp { margin: 34px 0 0 12px; font-size: 12px } .q76-rp p { margin: 6px 0 0 20px; font-weight: 600; text-align: justify }
        .q76-f { display: flex; justify-content: space-between; margin-top: 70px; font-size: 11px }
        @media print { @page { size: letter landscape; margin: 8mm } body * { visibility: hidden } .qf, .qf * { visibility: visible } .qf { position: absolute; left: 0; top: 0; width: 100% } .qf-bar, .crumb { display: none } .q76 { max-width: none; padding: 0 } }
      `}</style>
    </div>
  );
}
export default function Page() { return <Shell need="admin"><Inner /></Shell>; }
