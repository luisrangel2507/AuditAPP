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
  const es = (t) => String(t || '').split('\n')[0];
  async function print() {
    setBusy(true);
    // Espera a que carguen las imágenes antes de abrir el diálogo de impresión / PDF
    const imgs = [...(ref.current?.querySelectorAll('img') || [])];
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((ok) => { i.onload = ok; i.onerror = ok; }))));
    setBusy(false); window.print();
  }
  return (
    <div className="rep-wrap">
      <div className="rep-bar">
        <button onClick={() => router.back()}>‹ Volver</button>
        <button className="go" onClick={print} disabled={busy}>{busy ? 'Preparando…' : 'Descargar reporte (PDF)'}</button>
      </div>
      <div className="rep" ref={ref}>
        <header>
          <img src="/mitchell-logo.png" alt="Mitchell Plastics" />
          <div className="t"><b>Reporte de auditoría de proceso</b><span>LPApp · {a.template}</span></div>
          <div className={`sc ${a.score_pct >= 90 ? 'ok' : a.score_pct >= 75 ? 'warn' : 'nok'}`}><b>{Math.round(a.score_pct)}%</b><span>Score</span></div>
        </header>
        <div className="meta">
          <span><i>Auditor</i>{a.auditor}</span>
          <span><i>Fecha</i>{fmtDate(a.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span><i>Zona / máquina</i>{a.area}</span>
          <span><i>N/P</i>{a.part_number || '—'}</span>
          <span><i>Resultado</i>{a.ok_count} OK · {a.nok_count} X · {a.partial_count} Δ · {a.na_count} N/A</span>
        </div>
        {!finds.length ? (
          <div className="none"><b>✓ No hay hallazgos</b><span>Todas las preguntas de esta auditoría cumplen.</span></div>
        ) : finds.map((r) => (
          <section className="find" key={r.id}>
            <div className="ft">
              <h4><em>{r.result === 'nok' ? 'X' : 'Δ'}</em> Hallazgo · Ítem {r.item ?? '—'}</h4>
              <p className="q">{es(r.question)}</p>
              <p><i>Hallazgo:</i> {r.notes || '—'}</p>
              <p><i>Acción correctiva:</i> {r.corrective || 'Sin acción registrada'}</p>
            </div>
            <div className="fi">{r.has_evidence ? <img src={`/api/evidence/${r.id}`} alt="Imagen del hallazgo" /> : <span>Sin imagen</span>}</div>
          </section>))}
        <footer>Generado por LPApp · {new Date().toLocaleDateString('es-MX')}</footer>
      </div>
      <style>{`
        .rep-wrap { background: #e9edf5; min-height: 100vh; padding: 12px; font-family: system-ui, sans-serif; color: #0b1f4d; }
        .rep-bar { max-width: 760px; margin: 0 auto 10px; display: flex; gap: 10px; justify-content: space-between; }
        .rep-bar button { border: 1px solid #c9d4ea; background: #fff; border-radius: 999px; padding: 10px 16px; font-weight: 600; font-size: 15px; }
        .rep-bar .go { background: #1f5bd6; color: #fff; border: 0; }
        .rep { background: #fff; max-width: 760px; margin: 0 auto; padding: 18px 20px; border-radius: 10px; box-shadow: 0 8px 24px -12px rgba(11,31,77,.4); }
        .rep header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #f26a21; padding-bottom: 8px; }
        .rep header img { height: 30px; } .rep .t { flex: 1; display: flex; flex-direction: column; } .rep .t b { font-size: 17px; } .rep .t span { font-size: 12px; color: #5a6a8c; }
        .rep .sc { text-align: center; border-radius: 10px; padding: 4px 12px; color: #fff; } .rep .sc b { display: block; font-size: 20px; line-height: 1.1; } .rep .sc span { font-size: 10px; }
        .rep .sc.ok { background: #22a867; } .rep .sc.warn { background: #e3a21a; } .rep .sc.nok { background: #d92f3a; }
        .rep .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 12px; margin: 10px 0; font-size: 12.5px; }
        .rep .meta i { display: block; font-style: normal; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #6b7a9b; }
        .rep .none { border: 1px solid #bfe6d1; background: #eefaf3; border-radius: 10px; padding: 18px; text-align: center; } .rep .none b { display: block; font-size: 20px; color: #17803f; } .rep .none span { font-size: 13px; color: #3c6b50; }
        .rep .find { display: flex; gap: 12px; border: 1px solid #f1c9cd; background: #fff7f7; border-radius: 10px; padding: 10px; margin-bottom: 8px; break-inside: avoid; }
        .rep .ft { flex: 1; min-width: 0; font-size: 12.5px; } .rep .ft h4 { margin: 0 0 4px; font-size: 14px; color: #b3202a; } .rep .ft h4 em { font-style: normal; background: #d92f3a; color: #fff; border-radius: 6px; padding: 1px 7px; margin-right: 4px; }
        .rep .ft p { margin: 3px 0; } .rep .ft .q { font-weight: 600; } .rep .ft i { font-style: normal; font-weight: 700; color: #6b7a9b; }
        .rep .fi { width: 150px; height: 112px; flex: none; border: 1px dashed #d6a9ae; border-radius: 8px; display: grid; place-items: center; overflow: hidden; background: #fff; font-size: 11px; color: #8b97b2; } .rep .fi img { width: 100%; height: 100%; object-fit: cover; }
        .rep footer { margin-top: 8px; text-align: right; font-size: 10px; color: #8b97b2; }
        @page { size: 8.5in 5.5in; margin: .25in; }
        @media print { html, body { background: #fff !important; } .rep-wrap { background: none; padding: 0; min-height: 0; } .rep-bar { display: none; } .rep { box-shadow: none; max-width: none; padding: 0; border-radius: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      `}</style>
    </div>
  );
}
