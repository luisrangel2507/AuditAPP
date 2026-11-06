// Formatos QA-062-C, QA-075-C y QA-076-C ya llenos (pantalla y paquete de migración)

export function Q62({ d }) {
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const wk = d.monday.split('-'), sem = `${wk[2]}/${wk[1]}/${wk[0]}`;
  const rows = Math.max(12, d.products.length), tr = Math.max(4, ...d.team.map((t) => t.length));
  return (
    <>
      <div className="q62">
        <h1>Gestión de Programa de Auditorias</h1>
        <div className="q62-w"><b>Semana de:</b> <span>{sem}</span></div>
        <p>- Cada día consiste en un equipo de 2 personas. El miembro en la parte superior es el líder, ellos son responsables de que las auditorias se realicen y hacer los arreglos de los sustitutos del equipo cuando un miembro esté ausente.</p>
        <table className="q62-t"><thead><tr><th colSpan={5} className="g">El producto en una auditoria gerencial</th></tr>
          <tr><th>Nombre de la parte</th><th>Número de parte</th><th>Color</th><th>Frecuencia</th><th>Reporte</th></tr></thead>
          <tbody>{[...Array(rows)].map((_, i) => { const p = d.products[i]; return <tr key={i}><td>{p?.name || ''}</td><td>{p?.number || ''}</td><td>{p?.color || ''}</td><td>{p?.freq || ''}</td><td>{p?.report || ''}</td></tr>; })}</tbody></table>
        <table className="q62-t" style={{ marginTop: 14 }}><thead><tr><th colSpan={5} className="g">Equipo Auditor</th></tr><tr>{DAYS.map((x) => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>{[...Array(tr)].map((_, i) => <tr key={i}>{d.team.map((t, k) => <td key={k}>{t[i] || ''}</td>)}</tr>)}</tbody></table>
        <div className="q62-n"><b><i>Cuando se terminen las auditorias gerenciales por favor revisar lo siguiente:</i></b>
          <div>- Inspeccione presencia de todos los defectos Visuales y de Pintura.</div>
          <div>Asegurar que todas la partes que han sido 100% lanzadas como nuevos proyectos sean inspeccionadas e identificadas con una etiqueta verde de lanzamiento (Partes y Etiqueta)</div>
          <div>Verificar empaque / Etiqueta por:</div>
          {['LHD o RHD', 'color', 'Cantidad empacada', 'Carta de Cambio de Ingeniería', 'Cada caja etiquetada con 2 etiquetas y números de serial deben coincidir', 'Todos los códigos de barras deben ser legibles y claros', 'Empaque apropiado en condiciones aceptables', 'Pick list', 'Packing slip', 'Etiquetas especiales / Documentación'].map((x) => <div key={x}>• {x}</div>)}</div>
        <div className="q62-f"><span>QA-062-C &nbsp; Rev: Rel</span><span>Fecha Efectiva: 20-Dic-10</span><span>Aprobó: Director de Calidad</span></div>
      </div>
    </>
  );
}
export const Q62_CSS = `
        .qf-bar { gap: 6px; margin-bottom: 10px; flex-wrap: wrap }
        .q62 { background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; max-width: 820px; margin: 0 auto; padding: 22px 26px; font-size: 12px }
        .q62 h1 { text-align: center; font-size: 17px; font-weight: 600; margin: 0 0 10px } .q62-w { font-size: 14px; margin: 6px 0 } .q62-w span { margin-left: 70px } .q62 p { font-weight: 700; margin: 6px 0 10px }
        .q62-t { width: 100%; border-collapse: collapse } .q62-t th, .q62-t td { border: 1.5px solid #111; padding: 3px 6px; text-align: center; height: 22px } .q62-t th { background: #d9d9d9; font-size: 13px } .q62-t th.g { font-size: 14px }
        .q62-t td { font-size: 11px; color: #b00 }
        .q62-n { border: 1.5px solid #111; padding: 6px 8px; margin-top: 14px; font-size: 12px; line-height: 1.5 } .q62-n b { font-size: 14px }
        .q62-f { display: flex; justify-content: space-between; margin-top: 18px; font-size: 12px }
        @media print { @page { size: letter portrait; margin: 10mm } body * { visibility: hidden } .qf, .qf * { visibility: visible } .qf { position: absolute; left: 0; top: 0; width: 100% } .qf-bar, .crumb { display: none } .q62 { max-width: none; padding: 0 } }
`;

export function Q75({ d }) {
const ST = ['White', 'Green', 'Yellow', 'Orange', 'Pink'];
const dmy = (s) => `${Number(s.slice(8))}/${Number(s.slice(5, 7))}/${s.slice(0, 4)}`;
  const pages = d.sheets.flatMap((s) => { const out = []; for (let i = 0; i < Math.max(1, s.blocks.length); i += 5) out.push({ s, blocks: s.blocks.slice(i, i + 5), off: i }); return out; });
  return (
    <>
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
    </>
  );
}
export const Q75_CSS = `
        .qf-bar { gap: 6px; margin-bottom: 10px; flex-wrap: wrap }
        .q75 { background: #fff; color: #111; font-family: Calibri, Arial, sans-serif; max-width: 980px; margin: 0 auto 16px; padding: 18px 22px; font-size: 12px }
        .q75-h { display: grid; grid-template-columns: 1fr 1.4fr 1fr; align-items: start; margin-bottom: 8px } .q75-h h1 { font: 700 18px Georgia, serif; text-align: center; margin: 0 } .q75-h .l div, .q75-h .r { margin: 3px 0; font-size: 12px } .q75-h span { display: inline-block; min-width: 130px; border-bottom: 1px solid #111; text-align: center; color: #b00 } .q75-h .r { text-align: right }
        .q75-b { display: grid; grid-template-columns: 30px 1fr; border: 1.5px solid #111; margin-bottom: 8px } .q75-b .n { display: grid; place-items: center; font-weight: 700; border-right: 1.5px solid #111 }
        .q75-b table { border-collapse: collapse; width: 100% } .q75-b th, .q75-b td { border: 1px solid #111; padding: 2px 4px; text-align: center; height: 18px; font-size: 11px } .q75-b th { background: #d9d9d9 } .q75-b td.h { background: #d9d9d9; font-weight: 700 } .q75-b td { color: #b00 } .q75-b td.sn, .q75-b td.h { color: #111 } .q75-b td.iss { width: 38%; font-size: 13px }
        .q75-f { display: flex; justify-content: space-between; font-size: 11px; margin-top: 8px }
        @media print { @page { size: letter landscape; margin: 8mm } body * { visibility: hidden } .qf, .qf * { visibility: visible } .qf { position: absolute; left: 0; top: 0; width: 100% } .qf-bar, .crumb { display: none } .q75 { max-width: none; margin: 0; padding: 0; break-after: page } }
`;

export function Q76({ d }) {
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SYM = { ok: 'O', nok: 'X', partial: 'X', na: 'N/A' };
  const wk = d.monday.split('-');
  const rows = Math.max(14, d.questions.length);
  return (
    <>
      <div className="q76">
        <div className="q76-top"><img className="ultra-img" src="/ultra-logo.png" alt="Ultra Manufacturing" /><h1>Dock Audit Findings</h1><img src="/mitchell-logo.png" alt="Mitchell Plastics" /></div>
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
    </>
  );
}
export const Q76_CSS = `
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
`;
