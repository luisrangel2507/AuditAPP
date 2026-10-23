'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate } from '@/lib/client';

// Réplica del formato impreso "QE Layer 1 Audit" (MGMT-015-C Rev.003): una hoja por "carril" (1.ª auditoría de cada día, 2.ª, …)
const SYM = { ok: 'O', partial: 'Δ', nok: 'X', na: 'NA' };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dmy = (s) => `${Number(s.slice(8))}-${MON[Number(s.slice(5, 7)) - 1]}-${s.slice(2, 4)}`;
const addD = (s, n) => { const t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

// Texto exactamente como viene impreso en el formato (por orden y número de ítem)
const FIRST = ['Conduct a Control Plan audit and specify part number audited in Notes area of this form.', 'Does the Control Plan audited align with the PFMEA and QIR/PIR? Confirm if Critical Characteristics are homologated.'];
const TXT = {
  1033: 'Entrevista. Todos los operadores han sido formados en las instrucciones de trabajo, conocimiento en las desviaciones del proceso  (alertas de calidad)',
  1341: 'Revisar el fechador en la pieza moldeada. Coincide al mes en curso',
  2290: 'Está el operador colocando las partes en el empaque adecuado de WIP y PT, así como las etiquetas?',
  106: '¿Hay IPL impresas y adicionales en la celda?',
  1031: 'El número de parte cuenta con Verificación de arranque de proceso con los datos correcto y firmade por los responsables.',
  100: '*¿Están los QIR / PIR completos y actualizados?', 1032: 'Lista de defectos con nivel ok/nok. Boundary samples',
  173: 'Se cuenta con primera pieza liberada y etiquetada correctamente', 2102: '¿Están los Red/Green Rabbits disponibles para probar los Poke-Yokes?',
  1042: 'Los Red/Green Rabbit están correctamente identificados', 453: 'Verificar Control de documentos vigentes. Uso de formatos vigentes internos y de PLEX',
  2304: '¿La Instrucción de trabajo está actualizada en Ripple?', 455: 'Revisar que instrumentos estén dentro de su vigencia de calibración y correctamente identificados.',
  458: '5S. Validar condiciones de orden, limpieza, señalización en el área de trabajo.', 459: 'ECN. Asegurar que cualquier cambio de ingeniería o desviación esté autorizado, documentado y comunicado en piso.',
  448: 'Las Instrucciones de Operación del CF están actualizadas', 449: 'Las Instrucciones de Operación del CF cuentan con la simbología de las características especiales',
};
const NOTES = { 0: 'Control Plan Audited :', 1: '* Registre número de nómina del operador en apartado hallazgo si no se cumple', 1341: 'Moldeo', 1032: 'Verificar PLEX', 455: 'Formato MFG-071-C vigente PLEX', 449: 'Formato MFG-006-C vigente PLEX' };

function Sheet({ d, k, cols, finds, total }) {
  const days = [...Array(7)].map((_, i) => addD(d.monday, i - 1)); // domingo … sábado
  const cell = (day) => cols.find((c) => c.date === day);
  const wm = new Date(d.monday + 'T12:00:00Z');
  return (
    <div className="qfs">
      <div className="qfs-top">
        <div className="ultra"><b>Ultr<i>▲</i></b><span>MANUFACTURING</span></div>
        <h1>Layered Process Audit</h1>
        <img src="/mitchell-logo.png" alt="Mitchell Plastics" />
      </div>
      <div className="qfs-ins">
        <div className="l"><div className="cd">Content Date:</div>
          <p><b>1. QE:</b> Perform Layer 1 audit daily and document any findings and corrections made below.</p>
          <p><b>2. Quality Manager:</b> Reviews Layer 1 Audit Daily &amp; Signs-off</p>
          <p><b>3. QE:</b> Document any findings and corrections made below.</p></div>
        <div className="r"><u>Instructions</u>
          <p><b>4. Quality Manager:</b> Perform Layer 2 audit weekly and document any findings and corrections on that form.</p>
          <p><b>5. General Manager:</b> Perform Layer 3 audit monthly and document any findings and corrections on that form.</p>
          <p><b>6. Director of Quality:</b> Perform Layer 4 audit quarterly and document any findings and corrections on that form.</p></div>
      </div>
      <table className="qfs-t">
        <colgroup><col style={{ width: '2.2%' }} /><col style={{ width: '27.4%' }} /><col style={{ width: '7.2%' }} />{days.map((x) => <col key={x} style={{ width: '6.45%' }} />)}<col style={{ width: '18.05%' }} /></colgroup>
        <thead>
          <tr><th colSpan={2} rowSpan={7} className="hl"><div className="hl-in"><div className="ai"><b><u>Audit Items</u></b><div className="lg"><div>O = Satisfactory</div><div>Δ – Needs Improvement</div><div>X = Not Satisfactory</div><div>N/A – Not Applicable</div></div></div><div className="tt">QE Layer 1 Audit</div></div></th>
            <th colSpan={8} className="sh">Layer 1 – Daily by QE <small>(initials)</small></th><th rowSpan={7} className="sh nt">Notes</th></tr>
          <tr><th colSpan={8} className="sh">Week of: &nbsp; <b>{MONTHS[wm.getUTCMonth()]} {wm.getUTCDate()}, {wm.getUTCFullYear()}</b></th></tr>
          <tr><th className="sh" />{days.map((x, i) => <th key={x} className="sh dn">{DAYS[i]}</th>)}</tr>
          <tr><td className="lb">Initials →</td>{days.map((x) => <td key={x} className="in">{cell(x)?.initials || ''}</td>)}</tr>
          <tr><td className="lb">Part Number →</td>{days.map((x) => <td key={x} className="in sm">{cell(x)?.part || ''}</td>)}</tr>
          <tr><td className="lb">AREA →</td>{days.map((x) => <td key={x} className="in sm">{cell(x)?.status === 'completed' ? cell(x).area : ''}</td>)}</tr>
          <tr><td className="lb">Audit Date →</td>{days.map((x, i) => <td key={x} className="in sm">{i === 0 ? '' : dmy(x)}</td>)}</tr>
        </thead>
        <tbody>
          {d.rows.map((r, i) => (
            <tr key={r.id} className="q"><td className="it">{i < 2 ? '' : r.item}</td><td colSpan={2} className="qt">{i < 2 ? FIRST[i] : TXT[r.item] || r.text}</td>
              {days.map((x) => { const v = cell(x)?.answers[r.id]; return <td key={x} className={`mk ${v ? 'r-' + v : ''}`}>{v ? SYM[v] : ''}</td>; })}
              <td className="nn">{NOTES[i < 2 ? i : r.item] || ''}</td></tr>))}
          <tr className="so"><td colSpan={3} className="qs">Quality Manager Sign Off</td>{days.map((x) => <td key={x} />)}<td /></tr>
        </tbody>
      </table>
      <table className="qfs-t qfs-f">
        <colgroup><col style={{ width: '2.8%' }} /><col style={{ width: '2.8%' }} /><col style={{ width: '38%' }} /><col style={{ width: '7%' }} /><col style={{ width: '43%' }} /><col style={{ width: '6.4%' }} /></colgroup>
        <thead><tr><th>Item #</th><th>Area</th><th>Finding for any X or Δ Items</th><th>Date &amp; Time</th><th>Immediate Action/Correction Taken</th><th>Closed</th></tr></thead>
        <tbody>{[...Array(Math.max(11, finds.length))].map((_, i) => { const f = finds[i]; return (
          <tr key={i}><td>{f?.item || ''}</td><td className="sm">{f?.area || ''}</td><td className="ft">{f ? `${f.result === 'partial' ? 'Δ ' : ''}${f.notes}` : ''}</td>
            <td className="sm">{f ? `${dmy(String(f.date).slice(0, 10))}` : ''}</td><td className="ft">{f?.action || ''}</td><td className="sm">{f?.closed_at ? dmy(String(f.closed_at).slice(0, 10)) : ''}</td></tr>); })}</tbody>
      </table>
      <div className="qfs-ft"><div>MGMT-015-C &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <small>Rev:003</small></div><div>Effective Date: 26-Jul-21{total > 1 ? <em> · hoja {k} de {total}</em> : null}</div><div>Approved By:Director of Quality</div></div>
    </div>
  );
}

function Inner() {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  const [date, setDate] = useState(() => new URLSearchParams(window.location.search).get('date') || '');
  useEffect(() => { setD(null); api(`/api/admin/reports/qeform${date ? `?date=${date}` : ''}`).then(setD).catch((e) => setErr(e.message)); }, [date]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  const shift = (n) => { setDate(addD(d.monday, n * 7)); };
  // carriles: la 1.ª auditoría de cada día en la hoja 1, la 2.ª en la hoja 2…
  const perDay = {}; const lanes = [];
  for (const c of d.columns) { const n = (perDay[c.date] = (perDay[c.date] || 0) + 1); (lanes[n - 1] ||= []).push(c); }
  if (!lanes.length) lanes.push([]);
  const csv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const L = [['Ítem', 'Pregunta', ...d.columns.map((c) => `${c.date} ${c.name}`)]];
    L.push(['', 'Área', ...d.columns.map((c) => c.area)]); L.push(['', 'No. de parte', ...d.columns.map((c) => c.part)]);
    for (const r of d.rows) L.push([r.item, r.text, ...d.columns.map((c) => SYM[c.answers[r.id]] || '')]);
    L.push([]); L.push(['Hallazgos']); L.push(['Item #', 'Area', 'Finding', 'Date', 'Immediate Action', 'Closed']);
    for (const f of d.findings) L.push([f.item, f.area, f.notes, String(f.date).slice(0, 10), f.action, f.closed_at ? String(f.closed_at).slice(0, 10) : '']);
    const blob = new Blob(['﻿' + L.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `QE-Layer1-${d.monday}.csv`; a.click();
  };
  return (
    <div className="qf">
      <div className="row qf-bar">
        <button className="btn alt sm" onClick={() => shift(-1)}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>Semana del {fmtDate(d.monday, { day: 'numeric', month: 'long', year: 'numeric' })} · {lanes.length} hoja(s)</div>
        <button className="btn alt sm" onClick={() => shift(1)}>›</button>
        <button className="btn sm" onClick={() => window.print()}>Imprimir / PDF</button>
        <button className="btn alt sm" onClick={csv}>Excel (.csv)</button>
      </div>
      <p className="sub qf-hint">Cada hoja es un formato completo. La hoja 1 lleva la primera auditoría de cada día, la hoja 2 la segunda, etc. En el celular, desliza de lado para ver toda la hoja.</p>
      {lanes.map((cols, i) => <div className="qf-wrap" key={i}><Sheet d={d} k={i + 1} total={lanes.length} cols={cols} finds={d.findings.filter((f) => cols.some((c) => c.id === f.audit_id))} /></div>)}
      <style>{`
        .qf-bar { gap: 6px; margin-bottom: 8px; flex-wrap: wrap } .qf-hint { margin: 0 0 10px }
        .qf-wrap { overflow-x: auto; margin-bottom: 18px } 
        .qfs { background: #fff; color: #000; width: 1100px; padding: 14px 18px 10px; font-family: Arial, Helvetica, sans-serif; font-size: 9px; box-sizing: border-box }
        .qfs-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin-bottom: 4px } .qfs-top h1 { font-size: 18px; text-decoration: underline; margin: 0; font-weight: 700 } .qfs-top img { height: 30px; justify-self: end }
        .ultra { background: #111; color: #fff; display: inline-block; padding: 4px 8px 2px; width: 118px; justify-self: start } .ultra b { font-size: 22px; letter-spacing: -1px } .ultra i { font-style: normal; color: #e0301e; font-size: 14px } .ultra span { display: block; font-size: 6px; letter-spacing: 1.6px }
        .qfs-ins { display: grid; grid-template-columns: 1.1fr 1fr; gap: 24px; margin: 6px 0 6px; font-size: 8px } .qfs-ins p { margin: 2px 0 } .qfs-ins .r u { display: block; text-align: center; font-weight: 700; font-size: 10px; margin-bottom: 3px }
        .cd { border: 1px solid #000; width: 180px; height: 14px; text-align: center; margin-bottom: 4px; font-size: 10px; line-height: 14px }
        .qfs-t { border-collapse: collapse; width: 100%; table-layout: fixed } .qfs-t th, .qfs-t td { border: 1px solid #000; padding: 1px 3px; overflow: hidden }
        .qfs-t .sh, .qfs-t .hl { background: #d4d4d4; background-image: radial-gradient(#9a9a9a .6px, transparent .7px); background-size: 3px 3px; text-align: center; font-size: 9px }
        .qfs-t .hl { padding: 0 } .hl-in { display: grid; grid-template-columns: 38% 62%; height: 100%; min-height: 100px } .ai { padding: 6px 4px; text-align: left; font-size: 9px } .ai b { font-size: 11px; display: block; text-align: center; margin-bottom: 8px }
        .lg div { font-weight: 700; font-size: 9px; line-height: 1.5 } .tt { background: #fff; margin: 8px 0; display: grid; place-items: center; font-size: 17px; border-left: 1px solid #000; border-right: 1px solid #000; background-image: none }
        .qfs-t .nt { font-size: 10px; vertical-align: middle } .qfs-t .dn { font-size: 7.5px; font-weight: 700 }
        .qfs-t .lb { text-align: right; font-weight: 700; font-size: 7.5px; background: #fff; border: 1px solid #000; white-space: nowrap }
        .qfs-t .in { text-align: center; height: 13px; font-size: 9px; color: #12328f; font-weight: 700; background: #fff } .qfs-t .in.sm { font-size: 7px; line-height: 1 }
        .qfs-t .q td { height: 16px; vertical-align: middle } .qfs-t .it { text-align: center; font-size: 8px } .qfs-t .qt { font-size: 7.5px; line-height: 1.12 }
        .qfs-t .mk { text-align: center; color: #12328f; font-weight: 700; font-size: 13px } .qfs-t .mk.r-na { font-size: 10px } .qfs-t .mk.r-nok { color: #c00; font-size: 14px } .qfs-t .mk.r-partial { color: #b27300 }
        .qfs-t .nn { font-size: 7px; line-height: 1.15 } .qfs-t .so td { height: 17px } .qfs-t .qs { text-align: center; font-size: 10px; border-left: 0; border-bottom: 0 } .qfs-t .so td:first-child { border: 0 }
        .qfs-f { margin-top: 8px } .qfs-f th { background: #d4d4d4; background-image: radial-gradient(#9a9a9a .6px, transparent .7px); background-size: 3px 3px; font-size: 7.5px; height: 12px } .qfs-f td { height: 20px; font-size: 8px; color: #12328f } .qfs-f .sm { font-size: 7px; text-align: center } .qfs-f .ft { font-size: 8px }
        .qfs-ft { display: grid; grid-template-columns: 1fr 1fr 1fr; margin-top: 14px; font-size: 8px } .qfs-ft div:nth-child(2) { text-align: center } .qfs-ft div:nth-child(3) { text-align: right } .qfs-ft em { font-style: normal; color: #666 }
        @media print { @page { size: letter landscape; margin: 6mm } body * { visibility: hidden } .qf, .qf * { visibility: visible } .qf { position: absolute; left: 0; top: 0; width: 100% } .qf-bar, .qf-hint { display: none } .qf-wrap { overflow: visible; margin: 0; page-break-after: always; break-after: page } .qf-wrap:last-of-type { page-break-after: auto } .qfs { width: 100%; padding: 0 } }
      `}</style>
    </div>
  );
}
export default function Page() { return <Shell><Inner /></Shell>; }
