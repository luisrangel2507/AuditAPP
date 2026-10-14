'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, fmtDate } from '@/lib/client';

// Reporte de media hoja (carta/2) de una auditoría de proceso: resumen y hallazgos con ítem, acción e imagen
export default function Report() {
  const { id } = useParams();
  const router = useRouter();
  const [a, setA] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => { api(`/api/audits/${id}`).then(setA).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <div style={{ padding: 24 }}>{err}</div>;
  if (!a) return <div style={{ padding: 24 }}>Cargando…</div>;
  if (a.status !== 'completed') return <div style={{ padding: 24 }}>La auditoría aún no se completa.</div>;
  const finds = (a.responses || []).filter((r) => r.result === 'nok' || r.result === 'partial');
  const hr = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', hour12: false }).format(new Date(a.completed_at || Date.now())));
  const hi = hr < 12 ? 'Buen día' : hr < 19 ? 'Buena tarde' : 'Buena noche';
  const es = (t) => String(t || '').split('\n')[0];
  async function print() {
    setBusy(true);
    // Espera a que carguen las imágenes antes de abrir el diálogo de impresión / PDF
    const imgs = [...(ref.current?.querySelectorAll('img') || [])];
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((ok) => { i.onload = ok; i.onerror = ok; }))));
    setBusy(false); window.print();
  }
  const Ic = ({ d }) => <span className="ric"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg></span>;
  const I = {
    user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" /></>,
    cal: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>,
    mach: <><path d="M4 20h9M8 20v-5l5-6" /><circle cx="14.5" cy="7.5" r="2" /><path d="m16 6 3-2M13 11h4" /></>,
    doc: <><path d="M7 3.5h7.5L19 8v12.5H7z" /><path d="M14 3.5V8h5M10 12.5h6M10 16h6" /></>,
    list: <><path d="M10 7h9M10 12h9M10 17h9" /><path d="m4.5 7 1 1 2-2M4.5 12l1 1 2-2M4.5 17l1 1 2-2" /></>,
    clip: <><rect x="6" y="4.5" width="12" height="16" rx="2" /><path d="M9 4.5h6v2H9zM9 11h6M9 14.5h6" /></>,
    wrench: <path d="M14.5 6.5a4 4 0 0 0 4.7 5.2l-8.4 8.4a2 2 0 0 1-2.8-2.8l8.4-8.4A4 4 0 0 0 14.5 6.5z" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>,
  };
  return (
    <div className="rep-wrap">
      <div className="rep-bar">
        <button onClick={() => router.back()}>‹ Volver</button>
        <button className="go" onClick={print} disabled={busy}><span className="ric w">{I.doc && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I.doc}</svg>}</span>{busy ? 'Preparando…' : 'Descargar reporte (PDF)'}</button>
      </div>
      <div className="rep" ref={ref}>
        <header>
          <img src="/mitchell-logo.png" alt="Mitchell Plastics" />
          <div className="t"><b>Reporte de auditoría de proceso</b><span>LPApp · {a.template}</span></div>
          <div className={`sc ${a.score_pct >= 90 ? 'ok' : a.score_pct >= 75 ? 'warn' : 'nok'}`}><b>{Math.round(a.score_pct)}%</b><span>Score</span></div>
        </header>
        <p className="hi">{hi}. Realicé una auditoría y estos son los resultados:</p>
        <div className="meta">
          <div><Ic d={I.user} /><p><i>Auditor</i><b>{a.auditor}</b></p></div>
          <div><Ic d={I.cal} /><p><i>Fecha</i><b>{fmtDate(a.date, { day: 'numeric', month: 'short', year: 'numeric' })}</b></p></div>
          <div><Ic d={I.mach} /><p><i>Zona / máquina</i><b>{a.area}</b></p></div>
          <div><Ic d={I.doc} /><p><i>N/P</i><b>{a.part_number || '—'}</b></p></div>
          <div className="res"><Ic d={I.list} /><p><i>Resultado</i><b><u className="g">{a.ok_count} OK</u> · <u className="r">{a.nok_count} X</u> · <u className="y">{a.partial_count} Δ</u> · <u className="n">{a.na_count} N/A</u></b></p></div>
        </div>
        {!finds.length ? (
          <div className="none"><b>✓ No hay hallazgos</b><span>Todas las preguntas de esta auditoría cumplen.</span></div>
        ) : finds.map((r) => (
          <section className="find" key={r.id}>
            <div className="ft">
              <h4><em>{r.result === 'nok' ? 'X' : 'Δ'}</em><span>Hallazgo · Ítem {r.item ?? '—'}</span></h4>
              <p className="q">{es(r.question)}</p>
              <div className="fr"><Ic d={I.clip} /><p><i>Hallazgo</i>{r.notes || '—'}</p></div>
              <div className="fr w"><Ic d={I.wrench} /><p><i>Acción correctiva</i>{r.corrective || 'Sin acción registrada'}</p></div>
            </div>
            <div className="fi">{r.has_evidence ? <img src={`/api/evidence/${r.id}`} alt="Imagen del hallazgo" /> : <span>Sin imagen</span>}</div>
          </section>))}
        <footer><Ic d={I.clock} />Generado por LPApp · {new Date().toLocaleDateString('es-MX')}</footer>
      </div>
      <style>{`
        .rep-wrap { background: #eef2fb; min-height: 100vh; padding: 14px; font-family: system-ui, -apple-system, sans-serif; color: #0b1f4d; }
        .rep-bar { max-width: 760px; margin: 0 auto 12px; display: flex; gap: 10px; justify-content: space-between; }
        .rep-bar button { display: inline-flex; align-items: center; gap: 10px; border: 1px solid #dfe6f4; background: #fff; border-radius: 999px; padding: 12px 22px; font-weight: 700; font-size: 17px; color: #0b1f4d; box-shadow: 0 8px 18px -12px rgba(11,31,77,.5); }
        .rep-bar .go { background: linear-gradient(90deg, #0a49b8, #1f6bf0); color: #fff; border: 0; padding: 10px 20px 10px 12px; }
        .rep-bar .ric.w { background: rgba(255,255,255,.2); color: #fff; width: 34px; height: 34px; }
        .rep { background: #fff; max-width: 760px; margin: 0 auto; padding: 22px; border-radius: 22px; box-shadow: 0 14px 34px -18px rgba(11,31,77,.5); }
        .rep header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #f26a21; padding-bottom: 14px; }
        .rep header img { height: 44px; } .rep .t { flex: 1; display: flex; flex-direction: column; } .rep .t b { font-size: 24px; line-height: 1.1; letter-spacing: -.01em; } .rep .t span { font-size: 15px; color: #6b7a9b; margin-top: 4px; }
        .rep .sc { text-align: center; border-radius: 14px; padding: 8px 18px; color: #fff; } .rep .sc b { display: block; font-size: 32px; line-height: 1.05; } .rep .sc span { font-size: 14px; }
        .rep .sc.ok { background: #22a867; } .rep .sc.warn { background: #e3a21a; } .rep .sc.nok { background: #d92f3a; }
        .ric { width: 44px; height: 44px; border-radius: 50%; background: #eef2fb; color: #2c3a5e; display: grid; place-items: center; flex: none; }
        .rep .hi { margin: 12px 0 0; font-size: 18px; font-weight: 600; }
        .rep .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 10px; margin: 16px 0; }
        .rep .meta > div { display: flex; align-items: center; gap: 10px; min-width: 0; } .rep .meta .res { grid-column: span 2; }
        .rep .meta p { margin: 0; display: flex; flex-direction: column; min-width: 0; } .rep .meta i { font-style: normal; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6b7a9b; } .rep .meta b { font-size: 18px; overflow-wrap: anywhere; }
        .rep .meta u { text-decoration: none; } .rep .meta .g { color: #1f9a5a; } .rep .meta .r { color: #d92f3a; } .rep .meta .y { color: #e3a21a; } .rep .meta .n { color: #6b7a9b; }
        .rep .none { border: 1px solid #bfe6d1; background: #eefaf3; border-radius: 16px; padding: 22px; text-align: center; } .rep .none b { display: block; font-size: 24px; color: #17803f; } .rep .none span { font-size: 15px; color: #3c6b50; }
        .rep .find { display: flex; gap: 16px; border: 1px solid #f4c9cd; background: #fff3f3; border-radius: 18px; padding: 16px; margin-bottom: 10px; break-inside: avoid; }
        .rep .ft { flex: 1; min-width: 0; } .rep .ft h4 { margin: 0 0 8px; display: flex; align-items: center; gap: 8px; font-size: 18px; color: #d11d2a; }
        .rep .ft h4 em { font-style: normal; background: #e0182d; color: #fff; border-radius: 10px; padding: 8px 15px; font-size: 22px; font-weight: 800; } .rep .ft h4 span { background: #ffe0e2; border-radius: 12px; padding: 8px 14px; font-weight: 700; }
        .rep .ft .q { margin: 6px 0 12px; font-weight: 800; font-size: 22px; line-height: 1.25; }
        .rep .fr { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 10px; } .rep .fr .ric { background: #ffe0e2; color: #d11d2a; } .rep .fr.w .ric { background: #e6ebf6; color: #2c3a5e; }
        .rep .fr p { margin: 0; font-size: 17px; line-height: 1.3; } .rep .fr i { display: block; font-style: normal; font-weight: 700; color: #5a6a8c; font-size: 17px; }
        .rep .fi { width: 190px; height: 150px; flex: none; border: 4px solid #fff; border-radius: 14px; box-shadow: 0 0 0 1px #f0b9be; position: relative; overflow: hidden; background: #fff; font-size: 13px; color: #8b97b2; } .rep .fi img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; } .rep .fi > span { position: absolute; inset: 0; display: grid; place-items: center; }
        .rep footer { margin-top: 12px; display: flex; align-items: center; justify-content: flex-end; gap: 8px; font-size: 14px; color: #6b7a9b; border-top: 1px solid #e3e9f5; padding-top: 10px; } .rep footer .ric { width: 28px; height: 28px; background: none; } .rep footer svg { width: 20px; height: 20px; }
        @media (max-width: 560px) { .rep header { gap: 10px; } .rep header img { height: 28px !important; } .rep .t b { font-size: 17px !important; } .rep .t span { display: none; } .rep .sc { padding: 6px 12px; } .rep .sc b { font-size: 24px; } .rep .find { flex-direction: column; } .rep .fi { width: 100%; height: 190px; } .rep .meta { grid-template-columns: 1fr 1fr; } .rep .meta .res { grid-column: span 2; } .rep .t b { font-size: 20px; } .rep header img { height: 36px; } .rep-bar button { padding: 10px 16px; font-size: 15px; } }
        @page { margin: .3in; }
        @media print {
          html, body { background: #fff !important; height: auto !important; min-height: 0 !important; overflow: visible !important; } .rep-wrap { background: none; padding: 0 !important; min-height: 0 !important; height: auto !important; } .rep { max-width: 7.4in !important; margin: 0 auto !important; break-after: avoid; page-break-after: avoid; } .rep, .rep * { box-sizing: border-box; } .rep footer { break-after: avoid; } .rep-bar { display: none; }
          .rep { box-shadow: none; max-width: none; padding: 0; border-radius: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .rep header { padding-bottom: 7px; gap: 10px; } .rep header img { height: 28px; } .rep .t b { font-size: 16px; } .rep .t span { font-size: 11px; margin-top: 1px; } .rep .sc { padding: 3px 11px; border-radius: 9px; } .rep .sc b { font-size: 19px; } .rep .sc span { font-size: 9px; }
          .rep .hi { font-size: 12px; margin: 6px 0 0; }
          .ric { width: 26px; height: 26px; } .ric svg { width: 14px; height: 14px; } .rep .meta { grid-template-columns: repeat(3, 1fr) !important; gap: 6px 8px; margin: 8px 0; } .rep .meta .res { grid-column: span 2 !important; } .rep .meta i { font-size: 8.5px; } .rep .meta b { font-size: 12px; }
          .rep .none { padding: 10px; border-radius: 10px; } .rep .none b { font-size: 16px; } .rep .none span { font-size: 11px; }
          .rep .find { padding: 8px; gap: 10px; border-radius: 10px; margin-bottom: 6px; flex-direction: row !important; } .rep .ft h4 { font-size: 11px; margin-bottom: 3px; } .rep .ft h4 em { font-size: 12px; padding: 2px 8px; border-radius: 6px; } .rep .ft h4 span { padding: 2px 8px; border-radius: 7px; }
          .rep .ft .q { font-size: 12px; margin: 3px 0 5px; } .rep .fr { gap: 7px; margin-bottom: 4px; } .rep .fr p, .rep .fr i { font-size: 11px; line-height: 1.25; }
          .rep .fi { width: 140px !important; height: 100px !important; border-width: 2px; border-radius: 8px; } .rep footer { margin-top: 5px; padding-top: 4px; font-size: 9px; } .rep footer .ric { width: 16px; height: 16px; } .rep footer svg { width: 12px; height: 12px; }
        }
      `}</style>
    </div>
  );
}
