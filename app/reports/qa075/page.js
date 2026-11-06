'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, fmtDate } from '@/lib/client';
import { Q75, Q75_CSS } from '@/components/forms/QaSheets';

const ST = ['White', 'Green', 'Yellow', 'Orange', 'Pink'];
const addD = (s, n) => { const t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const dmy = (s) => `${Number(s.slice(8))}/${Number(s.slice(5, 7))}/${s.slice(0, 4)}`;

function Inner() {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [date, setDate] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('date')) || '');
  useEffect(() => { setD(null); api(`/api/admin/reports/qa075${date ? `?date=${date}` : ''}`).then(setD).catch((e) => setErr(e.message)); }, [date]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="empty">Cargando…</div>;
  return (
    <div className="qf">
      <div className="crumb" style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 8 }}><a href="/admin" style={{ color: 'inherit' }}>Administración</a> › <a href="/reports" style={{ color: 'inherit' }}>Reportes</a> › <b>QA-075-C</b></div>
      <div className="row qf-bar"><button className="btn alt sm" onClick={() => setDate(addD(d.date, -1))}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>{fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <button className="btn alt sm" onClick={() => setDate(addD(d.date, 1))}>›</button>
        <button className="btn sm" onClick={() => window.print()} disabled={!d.sheets.length}>Imprimir / PDF</button></div>
      <Q75 d={d} />
      <style>{Q75_CSS}</style>
    </div>
  );
}
export default function Page() { return <Shell need="admin"><Inner /></Shell>; }
