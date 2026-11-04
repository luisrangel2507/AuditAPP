'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate } from '@/lib/client';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const addD = (s, n) => { const t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

function Inner() {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [date, setDate] = useState('');
  useEffect(() => { setD(null); api(`/api/admin/reports/qa062${date ? `?date=${date}` : ''}`).then(setD).catch((e) => setErr(e.message)); }, [date]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  const wk = d.monday.split('-'), sem = `${wk[2]}/${wk[1]}/${wk[0]}`;
  const rows = Math.max(12, d.products.length), tr = Math.max(4, ...d.team.map((t) => t.length));
  return (
    <div className="qf">
      <div className="crumb" style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 8 }}><a href="/admin" style={{ color: 'inherit' }}>Administración</a> › <a href="/reports" style={{ color: 'inherit' }}>Reportes</a> › <b>QA-062-C</b></div>
      <div className="row qf-bar"><button className="btn alt sm" onClick={() => setDate(addD(d.monday, -7))}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>Semana del {fmtDate(d.monday, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <button className="btn alt sm" onClick={() => setDate(addD(d.monday, 7))}>›</button>
        <button className="btn sm" onClick={() => window.print()}>Imprimir / PDF</button></div>
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
      <style>{`
        .qf-bar { gap: 6px; margin-bottom: 10px; flex-wrap: wrap }
        .q62 { background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; max-width: 820px; margin: 0 auto; padding: 22px 26px; font-size: 12px }
        .q62 h1 { text-align: center; font-size: 17px; font-weight: 600; margin: 0 0 10px } .q62-w { font-size: 14px; margin: 6px 0 } .q62-w span { margin-left: 70px } .q62 p { font-weight: 700; margin: 6px 0 10px }
        .q62-t { width: 100%; border-collapse: collapse } .q62-t th, .q62-t td { border: 1.5px solid #111; padding: 3px 6px; text-align: center; height: 22px } .q62-t th { background: #d9d9d9; font-size: 13px } .q62-t th.g { font-size: 14px }
        .q62-t td { font-size: 11px; color: #b00 }
        .q62-n { border: 1.5px solid #111; padding: 6px 8px; margin-top: 14px; font-size: 12px; line-height: 1.5 } .q62-n b { font-size: 14px }
        .q62-f { display: flex; justify-content: space-between; margin-top: 18px; font-size: 12px }
        @media print { @page { size: letter portrait; margin: 10mm } body * { visibility: hidden } .qf, .qf * { visibility: visible } .qf { position: absolute; left: 0; top: 0; width: 100% } .qf-bar, .crumb { display: none } .q62 { max-width: none; padding: 0 } }
      `}</style>
    </div>
  );
}
export default function Page() { return <Shell need="admin"><Inner /></Shell>; }
