'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate } from '@/lib/client';

const SYM = { ok: 'O', partial: 'Δ', nok: 'X', na: 'N/A' };
const DAY = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const dow = (s) => { const d = new Date(s + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; };

function Inner() {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  const [date, setDate] = useState(() => new URLSearchParams(window.location.search).get('date') || '');
  useEffect(() => { setD(null); api(`/api/admin/reports/qeform${date ? `?date=${date}` : ''}`).then(setD).catch((e) => setErr(e.message)); }, [date]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  const shift = (n) => { const t = new Date(d.monday + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n * 7); setDate(t.toISOString().slice(0, 10)); };
  const idxOf = Object.fromEntries(d.columns.map((c, i) => [c.id, i + 1]));
  const csv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const L = [['Ítem', 'Pregunta', ...d.columns.map((c) => `${c.date} ${c.name}`)]];
    L.push(['', 'Zona / máquina', ...d.columns.map((c) => c.area)]); L.push(['', 'No. de parte', ...d.columns.map((c) => c.part)]);
    for (const r of d.rows) L.push([r.item, r.text, ...d.columns.map((c) => SYM[c.answers[r.id]] || '')]);
    L.push([]); L.push(['Hallazgos']); L.push(['Ítem', 'Zona', 'Hallazgo', 'Fecha', 'Acción', 'Cerrado']);
    for (const f of d.findings) L.push([f.item, f.area, f.notes, String(f.date).slice(0, 10), f.action, f.closed_at ? String(f.closed_at).slice(0, 10) : '']);
    const blob = new Blob(['﻿' + L.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `QE-Layer1-${d.monday}.csv`; a.click();
  };
  return (
    <div className="qf">
      <div className="row qf-bar">
        <button className="btn alt sm" onClick={() => shift(-1)}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>Semana del {fmtDate(d.monday, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <button className="btn alt sm" onClick={() => shift(1)}>›</button>
        <button className="btn sm" onClick={() => window.print()}>Imprimir / PDF</button>
        <button className="btn alt sm" onClick={csv}>Excel (.csv)</button>
      </div>
      <div className="qf-sheet">
        <div className="qf-head"><b>Layered Process Audit</b><span>QE Layer 1 Audit · MGMT-015-C Rev.003 · Semana del {fmtDate(d.monday, { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        {!d.columns.length ? <div className="empty">No hay auditorías de proceso esa semana.</div> : <div className="qf-scroll"><table className="qf-t">
          <thead>
            <tr><th className="l" rowSpan={1}>O = Satisfactorio · Δ = Mejorable · X = No satisfactorio · N/A</th>{d.columns.map((c) => <th key={c.id}>{DAY[dow(c.date)]}<br />{fmtDate(c.date, { day: 'numeric', month: 'short' })}</th>)}</tr>
            <tr><td className="l">Iniciales</td>{d.columns.map((c) => <td key={c.id} title={c.name}>{c.initials}{c.late ? ' ⏰' : ''}</td>)}</tr>
            <tr><td className="l">No. de parte</td>{d.columns.map((c) => <td key={c.id} className="sm">{c.part || ''}</td>)}</tr>
            <tr><td className="l">Área</td>{d.columns.map((c) => <td key={c.id} className="sm">{c.status === 'completed' ? c.area : ''}</td>)}</tr>
          </thead>
          <tbody>{d.rows.map((r) => (
            <tr key={r.id}><td className="l"><i>{r.item || ''}</i>{r.text}</td>{d.columns.map((c) => { const v = c.answers[r.id]; return <td key={c.id} className={v ? `r-${v}` : ''}>{SYM[v] || ''}</td>; })}</tr>))}</tbody>
        </table></div>}
        <div className="qf-sign">Firma del Quality Manager: ______________________</div>
        <div className="sect">Hallazgos (X o Δ)</div>
        <table className="qf-t qf-f"><thead><tr><th>Col.</th><th>Ítem</th><th>Área</th><th className="l">Hallazgo</th><th>Fecha</th><th className="l">Acción inmediata / corrección</th><th>Cerrado</th></tr></thead>
          <tbody>{d.findings.length ? d.findings.map((f) => (
            <tr key={f.id}><td>{idxOf[f.audit_id]}</td><td>{f.item || ''}</td><td className="sm">{f.area}</td><td className="l">{f.result === 'partial' ? 'Δ ' : 'X '}{f.notes}</td><td className="sm">{fmtDate(String(f.date).slice(0, 10), { day: 'numeric', month: 'short' })}</td><td className="l">{f.action || ''}</td><td className="sm">{f.closed_at ? fmtDate(String(f.closed_at).slice(0, 10), { day: 'numeric', month: 'short' }) : ''}</td></tr>))
            : <tr><td colSpan={7} className="sub">Sin hallazgos esta semana.</td></tr>}</tbody></table>
      </div>
      <style>{`
        .qf-bar { gap: 6px; margin-bottom: 10px; flex-wrap: wrap }
        .qf-sheet { background: #fff; color: #111; border-radius: 12px; padding: 14px; }
        .qf-head { text-align: center; margin-bottom: 8px } .qf-head b { display: block; font-size: 20px; text-decoration: underline } .qf-head span { font-size: 12px; color: #555 }
        .qf-scroll { overflow-x: auto }
        .qf-t { border-collapse: collapse; width: 100%; font-size: 12px } .qf-t th, .qf-t td { border: 1px solid #222; padding: 3px 5px; text-align: center; vertical-align: middle }
        .qf-t th { background: #e6e6e6 } .qf-t .l { text-align: left } .qf-t .sm { font-size: 10px } .qf-t i { font-style: normal; font-weight: 700; margin-right: 6px }
        .qf-t td.r-nok { color: #c00; font-weight: 800 } .qf-t td.r-partial { color: #b27300; font-weight: 800 } .qf-t td.r-ok { font-weight: 700 }
        .qf-sign { margin: 10px 0; font-size: 12px } .qf-f { margin-top: 4px }
        @media print { @page { size: landscape; margin: 8mm } body * { visibility: hidden } .qf, .qf * { visibility: visible } .qf { position: absolute; left: 0; top: 0; width: 100% } .qf-bar { display: none } .qf-sheet { border-radius: 0; padding: 0 } .qf-t { font-size: 9px } }
      `}</style>
    </div>
  );
}
export default function Page() { return <Shell><Inner /></Shell>; }
