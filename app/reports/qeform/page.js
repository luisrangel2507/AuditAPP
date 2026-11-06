'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate } from '@/lib/client';
import { Sheet, Sheet2, QeForm, QF_CSS, SYM, MONTHS, addD, chunk } from '@/components/forms/QeSheets';

// Réplica del formato impreso "QE Layer 1 Audit" (MGMT-015-C Rev.003): una hoja por "carril" (1.ª auditoría de cada día, 2.ª, …)

function Inner() {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  const [date, setDate] = useState(() => new URLSearchParams(window.location.search).get('date') || ''), [tpl, setTpl] = useState(() => new URLSearchParams(window.location.search).get('tpl') || '');
  useEffect(() => { setD(null); api(`/api/admin/reports/qeform?${new URLSearchParams({ ...(date ? { date } : {}), ...(tpl ? { tpl } : {}) })}`).then(setD).catch((e) => setErr(e.message)); }, [date, tpl]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  const shift = (n) => { if (d.weeks) { const t = new Date(d.weeks[0] + 'T12:00:00Z'); t.setUTCDate(1); t.setUTCMonth(t.getUTCMonth() + n); setDate(t.toISOString().slice(0, 10)); } else setDate(addD(d.monday, n * 7)); };
  const csv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const L = [['Ítem', 'Pregunta', ...d.columns.map((c) => `${c.date} ${c.name}`)]];
    L.push(['', 'Área', ...d.columns.map((c) => c.area)]); L.push(['', 'No. de parte', ...d.columns.map((c) => c.part)]);
    for (const r of d.rows) L.push([r.item, r.text, ...d.columns.map((c) => SYM[c.answers[r.id]] || '')]);
    L.push([]); L.push(['Hallazgos']); L.push(['Item #', 'Area', 'Finding', 'Date', 'Immediate Action', 'Closed']);
    for (const f of d.findings) L.push([f.item, f.area, f.notes, String(f.date).slice(0, 10), f.action, f.closed_at ? String(f.closed_at).slice(0, 10) : '']);
    const blob = new Blob(['﻿' + L.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `LPA-${d.tplName.replace(/\s+/g, '')}-${d.monday}.csv`; a.click();
  };
  return (
    <div className="qf">
      <div className="crumb" style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 8 }}><a href="/admin" style={{ color: 'inherit' }}>Administración</a> › <a href="/reports" style={{ color: 'inherit' }}>Reportes</a> › <b>{'Formato impreso por Layer'}</b></div>
      <div className="row qf-bar">
        <button className="btn alt sm" onClick={() => shift(-1)}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>{d.weeks ? `Mes de ${MONTHS[new Date(d.weeks[0] + 'T12:00:00Z').getUTCMonth()]} ${d.weeks[0].slice(0, 4)}` : `Semana del ${fmtDate(d.monday, { day: 'numeric', month: 'long', year: 'numeric' })}`}</div>
        <button className="btn alt sm" onClick={() => shift(1)}>›</button>
        <button className="btn sm" onClick={() => window.print()}>Imprimir / PDF</button>
        <button className="btn alt sm" onClick={csv}>Excel (.csv)</button>
      </div>
      <div className="row qf-bar"><select className="inp grow" value={tpl || d.tpl || ''} onChange={(e) => setTpl(e.target.value)}>
        {d.templates.map((t) => <option key={t.id} value={t.id}>{t.name === 'Quality Engineer' ? 'QEs · Layer 1 (LPA)' : t.name === 'QA Layer 2 Audit' ? 'Gerente de Calidad · Layer 2' : t.name}</option>)}</select></div>
      <p className="sub qf-hint">Solo auditorías normales (LPA); las de proceso no llenan formato. Cada día es una columna con las iniciales de quien auditó; si dos personas coinciden en un día, comparten columna (cada pregunta muestra el peor resultado). En el celular, desliza de lado.</p>
      <QeForm d={d} />
      <style>{QF_CSS}</style>
    </div>
  );
}
export default function Page() { return <Shell><Inner /></Shell>; }
