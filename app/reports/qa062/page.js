'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate } from '@/lib/client';
import { Q62, Q62_CSS } from '@/components/forms/QaSheets';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const addD = (s, n) => { const t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

function Inner() {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [date, setDate] = useState('');
  useEffect(() => { setD(null); api(`/api/admin/reports/qa062${date ? `?date=${date}` : ''}`).then(setD).catch((e) => setErr(e.message)); }, [date]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  return (
    <div className="qf">
      <div className="crumb" style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 8 }}><a href="/admin" style={{ color: 'inherit' }}>Administración</a> › <a href="/reports" style={{ color: 'inherit' }}>Reportes</a> › <b>QA-062-C</b></div>
      <div className="row qf-bar"><button className="btn alt sm" onClick={() => setDate(addD(d.monday, -7))}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>Semana del {fmtDate(d.monday, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <button className="btn alt sm" onClick={() => setDate(addD(d.monday, 7))}>›</button>
        <button className="btn sm" onClick={() => window.print()}>Imprimir / PDF</button></div>
      <Q62 d={d} />
      <style>{Q62_CSS}</style>
    </div>
  );
}
export default function Page() { return <Shell need="admin"><Inner /></Shell>; }
