'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Bi from '@/components/Bi';
import { isAdmin } from '@/lib/roles';
import Shell from '@/components/Shell';
import { api, fmtDate, compressImage, useLocal, scoreCls, DEPT, LAYER } from '@/lib/client';
import Ring from '@/components/Ring';
import Photo from '@/components/Photo';
import PhotoMark from '@/components/PhotoMark';
import { ZONES, NO_MACHINE } from '@/lib/zones';
import OwnerPicker, { useUsers } from '@/components/OwnerPicker';
import { useUser } from '@/components/Shell';
import { queueAudit } from '@/lib/outbox';
import BarcodeScan from '@/components/BarcodeScan';

const BTN = [
  ['ok', '✓', 'Cumple', 'OK'], ['nok', '✕', 'No cumple', 'NOK'], ['partial', 'Δ', 'Cumple parcialmente', 'Parcial'], ['na', '—', 'No aplica', 'N/A'],
];

// Inicio de toda auditoría. Layer 1 y QEs: zona → máquina (salvo PL) → N/P (con segundo N/P para piezas espejo RH / LH).
// Layer 2, 3 y 4 (All Areas): solo escogen el área que auditan.
const ZTONE = (z) => (z.startsWith('PL') || ['Toolroom', 'Shipping', 'Receiving', 'QIA', 'Proveedores'].includes(z) ? 'g' : ({ A: 'b', B: 'e', C: 'o', D: 'v', E: 't' })[z[0]] || 'b');
const fac = <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20V9l5 3V9l5 3V5h3v15z" /><path d="M3 20h18M7 16h2M12 16h2" /></svg>;
const wh = <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10 12 4l9 6v10H3z" /><path d="M8 20v-6h8v6M8 17h8" /></svg>;
const cube = <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>;
const chev = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;

function Setup({ audit, onSaved, onExit }) {
  const full = audit.layer === 1 || audit.kind === 'process';
  const hint = audit.area && audit.area !== 'All Areas' ? audit.area : '';
  // Si el admin asignó zona y máquina ("B1 · B1-5"), ya vienen elegidas; el auditor puede cambiarlas con "Atrás"
  const pre = (() => { const [z, ...m] = String(hint).split(' · '); return ZONES.includes(z) && m.length && (audit.layer === 1 || audit.kind === 'process') ? { z, m: m.join(' · ') } : null; })();
  // Zonas que el admin le asignó: una específica ("B1") o una zona completa ("ZONA B", "ZONA D-E" → B1, B2 / D1, D2, E2). Solo aparecen esas; "Otra zona" muestra todas
  const assigned = (() => {
    if (!full || !hint || pre) return [];
    if (ZONES.includes(hint)) return [hint];
    const m = /^ZONA ([A-E](?:-[A-E])?)$/i.exec(hint.trim());
    return m ? ZONES.filter((z) => m[1].toUpperCase().replace('-', '').includes(z[0]) && !NO_MACHINE.includes(z)) : [];
  })();
  const [showAll, setShowAll] = useState(false);
  const start1 = pre ? 'part' : assigned.length === 1 ? (NO_MACHINE.includes(assigned[0]) ? 'part' : 'machine') : 'zone';
  const [step, setStep] = useState(start1);
  const [zone, setZone] = useState(pre?.z || (assigned.length === 1 ? assigned[0] : (!full && ZONES.includes(hint) ? hint : ''))), [machine, setMachine] = useState(pre?.m || ''), [nps, setNps] = useState(['']);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [scan, setScan] = useState('');
  const noMach = NO_MACHINE.includes(zone);
  const list = (audit.machines && audit.machines[zone]) || [];
  const noPart = audit.template === 'QE Proveedores (LPA)'; // auditoría especial: solo zona
  const partOk = noPart || (nps.length > 0 && nps.every((x) => x.trim()));
  const sub = step === 'zone' ? (full ? 'Selecciona la zona donde realizarás la auditoría' : 'Selecciona el área que vas a auditar')
    : step === 'machine' ? `Zona ${zone}: selecciona la máquina` : `Zona ${zone}${machine ? ' · ' + machine : ''}: captura el número de parte`;
  async function go() {
    setBusy(true); setErr('');
    try { const r = await api(`/api/audits/${audit.id}/setup`, { method: 'POST', body: { zone, machine: noMach ? '' : machine, part_numbers: nps.map((x) => x.trim()).filter(Boolean) } }); onSaved(r); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  const pickZone = (z) => { setZone(z); setMachine(''); if (!full) return; setStep(noPart || NO_MACHINE.includes(z) ? 'part' : 'machine'); };
  const back = () => { if (step === 'part') setStep(noMach ? 'zone' : 'machine'); else if (step === 'machine') setStep('zone'); };
  return (
    <div className="exec setup">
      <div className="setup-hero">
        <img src="/app-hero.webp" alt="" />
        <div className="setup-top">
          <button className="setup-pill" onClick={step === 'zone' ? onExit : back}>{step === 'zone' ? '✕ Salir' : '‹ Atrás'}</button>
          {step !== 'zone' && <button className="setup-pill" onClick={onExit}>✕</button>}
        </div>
        <h2>Antes de empezar</h2><p>{sub}</p>
      </div>
      <div className="setup-body">
        {hint && step === 'zone' && <div className="sub" style={{ margin: '0 0 6px' }}>Zona asignada por el administrador: <b>{hint}</b></div>}
        {step === 'zone' && <>
          <div className="setup-h"><i />1. Zona</div>
          <div className="ztiles">{(assigned.length && !showAll ? assigned : ZONES).map((z) => (
            <button key={z} type="button" className={`ztile t-${ZTONE(z)} ${zone === z ? 'on' : ''}`} onClick={() => pickZone(z)}>
              <span className="zi">{z.startsWith('PL') || z === 'Shipping' || z === 'Receiving' ? wh : fac}</span><b className={z.length > 4 ? 'zlong' : ''}>{z}</b><span className="zc">{chev}</span>
            </button>))}</div>
          {assigned.length > 0 && !showAll && <button type="button" className="linkbtn" style={{ marginTop: 10 }} onClick={() => setShowAll(true)}>Otra zona…</button>}
          {!full && zone && <div className="setup-note">Área elegida: <b>{zone}</b></div>}
        </>}
        {step === 'machine' && <>
          <div className="setup-h"><i />2. Máquina <span>Zona {zone}</span></div>
          <div className="ztiles m">{list.map((m) => (
            <button key={m} type="button" className={`ztile t-${ZTONE(zone)} ${machine === m ? 'on' : ''}`} onClick={() => { setMachine(m); setStep('part'); }}>
              <span className="zi">{fac}</span><b className={m.length > 12 ? 'mlong' : ''}>{m}</b><span className="zc">{chev}</span>
            </button>))}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <input className="inp" placeholder="Otra máquina…" maxLength={40} value={list.includes(machine) ? '' : machine} onChange={(e) => setMachine(e.target.value)} />
            <button className="btn sm" disabled={!machine.trim() || list.includes(machine)} onClick={() => setStep('part')}>Usar</button>
          </div>
        </>}
        {step === 'part' && <>
          <div className="setup-h"><i />{noMach ? '2' : '3'}. Número de parte</div>
          {noPart && <div className="setup-note">Esta auditoría especial no lleva número de parte ni máquina. Solo confirma la zona y comienza.</div>}
          {!noPart && nps.map((v, i) => (
            <label key={i} className="npcard"><span className="npi">{cube}</span><i className="npsep" /><input placeholder={i ? 'Otro N/P' : 'No. de parte'} maxLength={40} autoCapitalize="characters" value={v} onChange={(e) => setNps((l) => l.map((x, k) => (k === i ? e.target.value : x)))} />
              <button type="button" className="npscan" onClick={() => setScan(i)} aria-label="Escanear código">{i ? '📷' : '📷 Escanear'}</button>
              {i > 0 && <button type="button" className="npx" onClick={() => setNps((l) => l.filter((_, k) => k !== i))} aria-label="Quitar">×</button>}</label>))}
          {!noPart && nps.length < 8 && <button className="npadd" type="button" onClick={() => setNps((l) => [...l, ''])}><span className="npplus">+</span><i className="npsep" /><b>Agregar otro N/P (RH / LH u otros)</b></button>}
        </>}
        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
        {typeof scan === 'number' && <BarcodeScan onClose={() => setScan('')} onResult={(t) => { setNps((l) => l.map((x, k) => (k === scan ? t : x))); setScan(''); }} />}
      </div>
      <div className="setup-foot">
        <button className="setup-go" disabled={busy || (full ? !(step === 'part' && partOk) : !zone)} onClick={go}><span>→</span><b>{busy ? 'Guardando…' : 'Comenzar preguntas'}</b></button>
      </div>
    </div>
  );
}

// Zona, máquina y N/P con opción de corregirlos (quedan marcados como corregidos)
// Gerentes (capa 2+): corregir la zona aun después de iniciar o terminar
function ZoneEdit({ audit, onSaved }) {
  const [open, setOpen] = useState(false), [zone, setZone] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const edited = !!audit.part_edited_at;
  async function save() {
    setBusy(true); setErr('');
    try { const r = await api(`/api/audits/${audit.id}/part`, { method: 'POST', body: { zone } }); onSaved(r); setOpen(false); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <>
      <div className={`partno ${edited ? 'edited' : ''}`}>Zona <b>{audit.zone || audit.area || 'All Areas'}</b>{edited ? <em> ✎ corregido</em> : null}
        {audit.editable && <button type="button" className="pe-btn" onClick={() => { setZone(audit.zone || ''); setErr(''); setOpen(true); }}>✎ Corregir</button>}</div>
      {edited && audit.area_original && <div className="pe-was">Antes: <s>{audit.area_original}</s></div>}
      {open && (
        <div className="sheet-bg" onClick={() => setOpen(false)}><div className="sheet" onClick={(e) => e.stopPropagation()}>
          <h2>Corregir zona</h2>
          <p className="sub">Quedará marcado como corregido y se conserva lo original.</p>
          <div className="zchips">{ZONES.map((z) => <button key={z} type="button" className={`zchip ${zone === z ? 'on' : ''}`} onClick={() => setZone(z)}>{z}</button>)}</div>
          {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn alt grow" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn grow" disabled={busy || !zone} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div></div>)}
    </>
  );
}

function PartEdit({ audit, onSaved }) {
  const full = audit.layer === 1 || audit.kind === 'process';
  const [open, setOpen] = useState(false), [zone, setZone] = useState(''), [machine, setMachine] = useState(''), [nps, setNps] = useState(['']), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [scan, setScan] = useState('');
  const edited = !!audit.part_edited_at;
  const noMach = NO_MACHINE.includes(zone);
  const list = (audit.machines && audit.machines[zone]) || [];
  const start = () => { setNps(String(audit.part_number).split(' / ').filter(Boolean).length ? String(audit.part_number).split(' / ').filter(Boolean) : ['']); setZone(audit.zone || ''); setMachine(audit.machine || ''); setErr(''); setOpen(true); };
  async function save() {
    setBusy(true); setErr('');
    try { const r = await api(`/api/audits/${audit.id}/part`, { method: 'POST', body: { part_numbers: nps.map((x) => x.trim()).filter(Boolean), ...(full ? { zone, machine: noMach ? '' : machine } : {}) } }); onSaved(r); setOpen(false); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <>
      <div className={`partno ${edited ? 'edited' : ''}`}>N/P <b>{audit.part_number}</b>{edited ? <em> ✎ corregido</em> : null}
        {audit.editable && <button type="button" className="pe-btn" onClick={start}>✎ Corregir</button>}</div>
      {edited && (audit.part_original || audit.area_original) && <div className="pe-was">Antes: {audit.area_original ? <s>{audit.area_original}</s> : null}{audit.area_original && audit.part_original ? ' · ' : ''}{audit.part_original ? <s>N/P {audit.part_original}</s> : null}</div>}
      {open && (
        <div className="sheet-bg" onClick={() => setOpen(false)}><div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
          <h2>Corregir datos</h2>
          <p className="sub">Quedará marcado como corregido y se conserva lo original.</p>
          {full && <>
            <label className="lbl">Zona</label>
            <div className="zchips">{ZONES.map((z) => <button key={z} type="button" className={`zchip ${zone === z ? 'on' : ''}`} onClick={() => { setZone(z); if (z !== audit.zone) setMachine(''); }}>{z}</button>)}</div>
            {zone && !noMach && <>
              <label className="lbl">Máquina</label>
              <div className="zchips">{list.map((m) => <button key={m} type="button" className={`zchip ${machine === m ? 'on' : ''}`} onClick={() => setMachine(m)}>{m}</button>)}</div>
              <input className="inp" placeholder="Otra máquina…" maxLength={40} value={list.includes(machine) ? '' : machine} onChange={(e) => setMachine(e.target.value)} />
            </>}
          </>}
          <label className="lbl">Número de parte</label>
          {nps.map((v, i) => (
            <div key={i} className="row" style={{ gap: 6, marginTop: i ? 8 : 0 }}><input className="inp grow" placeholder={i ? 'Otro N/P' : 'No. de parte'} maxLength={40} autoCapitalize="characters" value={v} onChange={(e) => setNps((l) => l.map((x, k) => (k === i ? e.target.value : x)))} /><button type="button" className="npscan" onClick={() => setScan(i)}>📷</button>
              {i > 0 && <button type="button" className="npx" onClick={() => setNps((l) => l.filter((_, k) => k !== i))} aria-label="Quitar">×</button>}</div>))}
          {nps.length < 8 && <button type="button" className="btn alt sm" style={{ marginTop: 8 }} onClick={() => setNps((l) => [...l, ''])}>＋ Agregar otro N/P</button>}
          {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
          {typeof scan === 'number' && <BarcodeScan onClose={() => setScan('')} onResult={(t) => { setNps((l) => l.map((x, k) => (k === scan ? t : x))); setScan(''); }} />}
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn alt grow" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn grow" disabled={busy || !nps.some((x) => x.trim()) || (full && (!zone || (!noMach && !machine.trim())))} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div></div>)}
    </>
  );
}

function Runner({ audit, onExit, onDone, onSetup }) {
  const needSetup = !audit.zone && !(audit.layer >= 3 && audit.kind !== 'process'); // Layer 2 elige la zona que auditará antes de iniciar; Layer 3-4: All Areas
  if (needSetup) return <Setup audit={audit} onSaved={onSetup} onExit={onExit} />;
  return <RunnerInner audit={audit} onExit={onExit} onDone={onDone} />;
}

// Etapas de la auditoría: la de piso y, para la LPA de los QEs, dos etapas adicionales al terminar (cada una por separado)
const STAGE = (c) => (c === 'Auditoría gerencial' ? 'gerencial' : c === 'Dock Audit' ? 'dock' : 'piso');
const RANK = { piso: 0, gerencial: 1, dock: 2 };
const STAGE_LABEL = { piso: 'Auditoría en piso', gerencial: 'Auditoría gerencial', dock: 'Dock Audit' };
const EMPTY_PART = { name: '', number: '', color: '', freq: '' };

function RunnerInner({ audit, onExit, onDone }) {
  const draft = useLocal(`lpa-draft-${audit.id}`, { answers: {}, idx: 0 });
  const [answers, setAnswers] = useState(() => draft.read().answers || {});
  const [idx, setIdx_] = useState(() => Math.max(0, Math.min(draft.read().idx || 0, audit.questions.length - 1)));
  const [marking, setMarking] = useState(null), [summary, setSummary] = useState(false), [area, setArea] = useState(() => draft.read().area || '');
  const needArea = false, needPart = false;
  const [part, setPart] = useState(() => draft.read().part || audit.part_number || '');
  const [shipper, setShipper] = useState(() => draft.read().shipper || '');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [extras, setExtras] = useState(() => draft.read().extras || []), [pickOpen, setPickOpen] = useState(false), [pickQ, setPickQ] = useState('');
  const setIdx = (n) => setIdx_(Math.max(0, Math.min(n, qs.length - 1)));
  const qs = useMemo(() => [...audit.questions, ...extras.map((x) => ({ ...x, extra: true }))].sort((x, y) => RANK[STAGE(x.category)] - RANK[STAGE(y.category)]), [audit.questions, extras]);
  const [parts, setParts] = useState(() => draft.read().parts || [{ ...EMPTY_PART }]);
  const [introDone, setIntroDone] = useState(() => draft.read().introDone || {});
  const users = useUsers();

  // Tiempo activo: solo cuenta con la pantalla visible y actividad reciente (≤ 60 s sin tocar)
  const tick = useRef({ sec: 0, last: Date.now() });
  useEffect(() => {
    const t0 = draft.read().sec; if (t0) tick.current.sec = t0;
    api(`/api/audits/${audit.id}/start`, { method: 'POST' }).catch(() => {});
    const touch = () => { tick.current.last = Date.now(); };
    const evs = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - tick.current.last < 60000) tick.current.sec += 1;
    }, 1000);
    return () => { clearInterval(iv); evs.forEach((e) => window.removeEventListener(e, touch)); };
    // eslint-disable-next-line
  }, []);

  useEffect(() => { draft.write({ answers, idx, area, part, shipper, parts, introDone, extras, sec: tick.current.sec }); /* eslint-disable-next-line */ }, [answers, idx, area, part, shipper, parts, introDone, extras]);

  const q = qs[Math.min(idx, qs.length - 1)];
  const cleanParts = parts.filter((x) => x.name.trim() && x.number.trim());
  const a = answers[q?.id] || {};
  const needsNote = a.result === 'nok' || a.result === 'partial';
  // Todo hallazgo (X / Δ) lleva descripción y foto; si se corrigió en el momento, también la acción y la foto del cierre
  const valid = (x) => x && x.result && (!x._extra || x.result === 'nok' || x.result === 'partial') && (!(x.result === 'nok' || x.result === 'partial') || ((x.notes || '').trim().length >= 3 && !!x.evidence
    && (!x.closed_now || ((x.corrective || '').trim().length >= 3 && !!x.close_evidence))
    && (x._cat !== 'Auditoría gerencial' || (!!x.sticker && !!(x.operator || '').trim() && !!(x.shift || '').trim() && (cleanParts.length <= 1 || !!x.part)))));
  const set = (patch) => setAnswers((s) => ({ ...s, [q.id]: { ...s[q.id], _cat: q.category, ...(q.extra ? { _extra: true } : {}), ...patch } }));
  const hasDock = qs.some((x) => x.category === 'Dock Audit');
  const allValid = qs.every((x) => valid(answers[x.id]));
  // Etapas: cada una se completa por separado; dentro de una etapa se puede saltar y al final regresan las pendientes
  const stage = STAGE(q.category);
  const stages = [...new Set(qs.map((x) => STAGE(x.category)))];
  const sIdx = stages.indexOf(stage);
  const sQ = qs.map((x, i) => ({ x, i })).filter((o) => STAGE(o.x.category) === stage);
  const sFirst = sQ[0].i, sLast = sQ[sQ.length - 1].i;
  const [looped, setLooped] = useState(false);
  const pending = sQ.filter((o) => !valid(answers[o.x.id])).length;
  const hasGer = qs.some((x) => x.category === 'Auditoría gerencial');
  const partsOk = cleanParts.length > 0;
  const needIntro = stage !== 'piso' && !introDone[stage];
  function next() {
    const miss = (i) => !valid(answers[qs[i].id]);
    if (!looped && idx < sLast) return setIdx(idx + 1);
    const pos = sQ.findIndex((o) => o.i === idx);
    for (let k = 1; k <= sQ.length; k++) {
      const o = sQ[(pos + k) % sQ.length];
      if (o.i !== idx && miss(o.i)) { setLooped(true); setErr(''); return setIdx(o.i); }
    }
    if (miss(idx)) return setErr('Falta contestar esta pregunta para poder continuar.');
    setLooped(false); setErr('');
    if (sLast < qs.length - 1) return setIdx(sLast + 1); // hay otra etapa
    if (allValid) setSummary(true);
    else setErr('Faltan preguntas por contestar para poder enviar la auditoría.');
  }

  async function pickClosePhoto(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try { set({ close_evidence: await compressImage(f) }); } catch { setErr('No se pudo procesar la foto'); }
    e.target.value = '';
  }
  async function pickPhoto(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try { setMarking(await compressImage(f)); } catch { setErr('No se pudo procesar la foto'); }
    e.target.value = '';
  }
  async function submit() {
    setBusy(true); setErr('');
    try {
      const responses = qs.map((x) => ({ question_id: x.id, ...answers[x.id], extra: { sticker: answers[x.id]?.sticker, operator: answers[x.id]?.operator, shift: answers[x.id]?.shift, part: answers[x.id]?.part } }));
      const res = await api(`/api/audits/${audit.id}/submit`, { method: 'POST', body: { responses, active_sec: tick.current.sec, area: needArea ? area.trim() : undefined, part_number: needPart ? part.trim() : undefined, shipper: hasDock ? shipper.trim() : undefined, parts: hasGer ? cleanParts : undefined, extra_ids: extras.map((x) => x.id) } });
      draft.clear(); onDone(res);
    } catch (e) {
      if (e.network) {
        // Sin señal: se guarda en el teléfono y se envía sola al volver la conexión
        const responses = qs.map((x) => ({ question_id: x.id, ...answers[x.id], extra: { sticker: answers[x.id]?.sticker, operator: answers[x.id]?.operator, shift: answers[x.id]?.shift, part: answers[x.id]?.part } }));
        const c = { ok: 0, nok: 0, partial: 0, na: 0 }; qs.forEach((x) => { c[answers[x.id]?.result]++; });
        const scored = c.ok + c.nok + c.partial;
        queueAudit(audit.id, { responses, active_sec: tick.current.sec, area: needArea ? area.trim() : undefined, part_number: needPart ? part.trim() : undefined, shipper: hasDock ? shipper.trim() : undefined, parts: hasGer ? cleanParts : undefined, extra_ids: extras.map((x) => x.id) }, `${audit.kind === 'process' ? 'Auditoría de proceso' : 'Auditoría'} · ${audit.date}`);
        draft.clear(); onDone({ queued: true, score: scored ? Math.round((c.ok / scored) * 1000) / 10 : 100, findings: c.nok + c.partial });
        return;
      }
      setErr(e.message); setBusy(false);
    }
  }

  const marker = marking ? <PhotoMark src={marking} onCancel={() => setMarking(null)} onDone={(d) => { set({ evidence: d }); setMarking(null); }} /> : null;
  const pickSheet = pickOpen && (
    <div className="sheet-bg" onClick={() => setPickOpen(false)}><div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
      <h2>Agregar hallazgo en otro ítem</h2>
      <p className="sub">Elige el ítem donde encontraste el problema. Solo se usa para reportar hallazgos (X o Δ) con foto.</p>
      <input className="inp" placeholder="Buscar por texto o número de ítem…" value={pickQ} onChange={(e) => setPickQ(e.target.value)} />
      <div style={{ marginTop: 8 }}>{(audit.others || []).filter((o) => !extras.some((x) => x.id === o.id) && (`${o.item || ''} ${o.text}`).toLowerCase().includes(pickQ.trim().toLowerCase())).slice(0, 60).map((o) => (
        <button key={o.id} type="button" className="card" style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6 }} onClick={() => {
          const nx = [...extras, o];
          const list = [...audit.questions, ...nx.map((x) => ({ ...x, extra: true }))].sort((x, y) => RANK[STAGE(x.category)] - RANK[STAGE(y.category)]);
          setExtras(nx); setAnswers((st) => ({ ...st, [o.id]: { _cat: o.category, _extra: true, result: 'nok' } }));
          setIdx_(list.findIndex((x) => x.id === o.id)); setLooped(false); setSummary(false); setPickOpen(false);
        }}>{o.item ? <b>#{o.item} · </b> : null}<Bi text={o.text} /></button>))}</div>
      <button className="btn alt" style={{ width: '100%', marginTop: 6 }} onClick={() => setPickOpen(false)}>Cancelar</button>
    </div></div>);
  if (summary) {
    const c = { ok: 0, nok: 0, partial: 0, na: 0 };
    qs.forEach((x) => c[answers[x.id].result]++);
    const scored = c.ok + c.nok + c.partial;
    const score = scored ? Math.round((c.ok / scored) * 1000) / 10 : 100;
    return (
      <div className="exec">
        {pickSheet}
        <div className="exec-top"><h2>Resumen</h2><div className="sub">{needArea && !area ? "All Areas" : (needArea ? area : audit.area)}{audit.part_number ? ` · N/P ${audit.part_number}` : ''} · {audit.template}</div></div>
        <div className="exec-body">
          <div className="card" style={{ textAlign: 'center' }}>
            <Ring value={score} size={120} stroke={10} cls={scoreCls(score)} label={`${score}%`} sub="Score" />
            <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
              <span className="pill ok">{c.ok} OK</span><span className="pill nok">{c.nok} X</span>
              <span className="pill warn">{c.partial} Δ</span><span className="pill">{c.na} N/A</span>
            </div>
          </div>
          {c.nok + c.partial > 0 && <>
            <div className="sect">Se abrirán {c.nok + c.partial} open issue(s)</div>
            {qs.filter((x) => ['nok', 'partial'].includes(answers[x.id].result)).map((x) => (
              <div key={x.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 14 }}>{x.text}</div>
                <div className="sub">{answers[x.id].notes}</div>
                <div className="sub">{(answers[x.id].owners || []).length ? 'Responsables: ' + answers[x.id].owners.map((id) => users.find((u) => u.id === id)?.name || id).join(', ') : 'Sin responsable asignado (un líder lo asignará)'}</div>
              </div>))}
          </>}
          {(audit.others || []).length > 0 && <div style={{ marginBottom: 12 }}>
            {extras.length > 0 && <div className="sub" style={{ margin: '0 0 6px' }}>Ítems agregados: {extras.map((x) => (
              <span key={x.id} className="pill warn" style={{ marginRight: 6 }}>{x.item ? `#${x.item}` : 'Ítem'}<button type="button" className="linkbtn" style={{ marginLeft: 6 }} onClick={() => { setExtras((l) => l.filter((y) => y.id !== x.id)); setAnswers((s) => { const n = { ...s }; delete n[x.id]; return n; }); }}>✕</button></span>))}</div>}
            <button type="button" className="btn alt" style={{ width: '100%' }} onClick={() => { setPickQ(''); setPickOpen(true); }}>＋ Agregar hallazgo en otro ítem</button>
          </div>}
          {needPart && <div className="card" style={{ marginBottom: 12 }}>
            <div className="sect" style={{ marginTop: 0 }}>¿Qué número de parte revisaste?</div>
            <input className="inp" placeholder="No. de parte" maxLength={40} autoCapitalize="characters" value={part} onChange={(e) => setPart(e.target.value)} />
          </div>}
          {needArea && <div className="card" style={{ marginBottom: 12 }}>
            <div className="sect" style={{ marginTop: 0 }}>¿Qué área auditaste?</div>
            <datalist id="aud-zones">{(audit.zones || []).map((z) => <option key={z} value={z} />)}</datalist>
            <input className="inp" list="aud-zones" placeholder="Área auditada" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>}
          {hasDock && !shipper.trim() && <div className="card" style={{ marginBottom: 12 }}><div className="sect" style={{ marginTop: 0 }}>Shipper # del Dock Audit</div><input className="inp" placeholder="Ej. QQ13497283" maxLength={40} autoCapitalize="characters" value={shipper} onChange={(e) => setShipper(e.target.value)} /></div>}
          {err && <div className="err">{err}</div>}
        </div>
        <div className="exec-foot">
          <button className="btn alt" onClick={() => setSummary(false)}>‹ Revisar</button>
          <button className="btn grow" disabled={busy || (needArea && !area.trim()) || (needPart && !part.trim()) || (hasDock && !shipper.trim())} onClick={submit}>{busy ? 'Enviando…' : 'Enviar auditoría'}</button>
        </div>
      </div>
    );
  }

  if (needIntro) {
    const stageBar = <div className="stagechip">Etapa {sIdx + 1} de {stages.length} · {STAGE_LABEL[stage]}</div>;
    const setPart_ = (i, k, v) => setParts((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
    const ok = stage === 'gerencial' ? partsOk : !!shipper.trim();
    return (
      <div className="exec">
        <div className="exec-top">
          <div className="row"><button className="btn-ghost" onClick={onExit}>✕ Salir</button>
            <div className="grow" style={{ textAlign: 'center', fontSize: 16, fontWeight: 600 }}>{audit.zone ? `Zona ${audit.zone}` : audit.area}<div className="sub" style={{ margin: 0, fontSize: 12 }}>{audit.template}</div></div><span /></div>
          {stageBar}
        </div>
        <div className="exec-body">
          <div className="stageintro">
            <b>Terminaste la auditoría en piso{stage === 'dock' && stages.includes('gerencial') ? ' y la auditoría gerencial' : ''}.</b>
            <span>{stage === 'gerencial' ? 'Ahora, al terminar las auditorías gerenciales, revisa lo siguiente (QA-062-C). Los hallazgos se registran como en QA-075-C.' : 'Ahora realiza el Dock Audit (QA-076-C). Plan de reacción: los hallazgos se turnan a los Gerentes de Logística.'}</span>
          </div>
          {stage === 'gerencial' && <>
            <div className="sect">El producto en la auditoría gerencial</div>
            {parts.map((x, i) => (
              <div key={i} className="card partcard">
                <div className="row" style={{ gap: 8 }}>
                  <input className="inp grow" placeholder="Nombre de la parte" maxLength={80} value={x.name} onChange={(e) => setPart_(i, 'name', e.target.value)} />
                  {parts.length > 1 && <button type="button" className="btn-ghost" aria-label="Quitar parte" onClick={() => setParts((l) => l.filter((_, j) => j !== i))}>✕</button>}
                </div>
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <input className="inp grow" placeholder="Número de parte" maxLength={40} autoCapitalize="characters" value={x.number} onChange={(e) => setPart_(i, 'number', e.target.value)} />
                  <input className="inp grow" placeholder="Color" maxLength={30} value={x.color} onChange={(e) => setPart_(i, 'color', e.target.value)} />
                </div>
                <input className="inp" style={{ marginTop: 8 }} placeholder="Frecuencia / Shipper (ej. QQ13497283)" maxLength={40} autoCapitalize="characters" value={x.freq} onChange={(e) => setPart_(i, 'freq', e.target.value)} />
              </div>))}
            {parts.length < 10 && <button type="button" className="npadd" onClick={() => setParts((l) => [...l, { ...EMPTY_PART }])}><span className="npplus">+</span><i className="npsep" /><b>Agregar otra parte</b></button>}
            <div className="sub" style={{ marginTop: 6 }}>Nombre y número de parte son obligatorios.</div>
          </>}
          {stage === 'dock' && <>
            <label className="lbl">Shipper # revisado (obligatorio)</label>
            <input className="inp" placeholder="Ej. QQ13497283" maxLength={40} autoCapitalize="characters" value={shipper} onChange={(e) => setShipper(e.target.value)} />
          </>}
        </div>
        <div className="exec-foot">
          <button className="btn alt" disabled={sFirst === 0} onClick={() => setIdx(sFirst - 1)}>‹</button>
          <button className="btn grow" disabled={!ok} onClick={() => { setIntroDone({ ...introDone, [stage]: true }); setLooped(false); }}>Comenzar etapa ›</button>
        </div>
      </div>
    );
  }

  return (
    <div className="exec">
      {marker}
      <div className="exec-top">
        <div className="row">
          <button className="btn-ghost" onClick={onExit}>✕ Salir</button>
          <div className="grow" style={{ textAlign: 'center', fontSize: 16, fontWeight: 600 }}>{audit.zone ? `Zona ${audit.zone}${audit.machine ? ` · Máquina ${audit.machine}` : ''}` : audit.area}<div className="sub" style={{ margin: 0, fontSize: 12 }}>{audit.part_number ? `N/P ${audit.part_number} · ` : ''}{audit.template}</div></div>
          <div className="sub" style={{ margin: 0 }}>{idx - sFirst + 1}/{sQ.length}</div>
        </div>
        {stages.length > 1 && <div className="stagechip">Etapa {sIdx + 1} de {stages.length} · {STAGE_LABEL[stage]}</div>}
        {pending > 0 && (looped || idx === sLast) && <div className="sub" style={{ margin: '6px 0 0', textAlign: 'center' }}>Faltan {pending} pregunta{pending === 1 ? '' : 's'} por contestar</div>}
        <div className="prog"><i style={{ width: `${((idx - sFirst + 1) / sQ.length) * 100}%` }} /></div>
      </div>
      <div className="exec-body">
        <div className="qcat">{q.category || audit.template}{q.item ? <span className="qitem">Ítem {q.item}</span> : null}</div>
        <div className="qtext"><Bi text={q.text} /></div>
        <div className="answers">
          {BTN.map(([k, sym, lbl, code]) => (
            <button key={k} className={`ans ${k} ${a.result === k ? 'sel' : ''}`} onClick={() => set({ result: k })}>
              <span className="sym">{sym}</span>{code}<small>{lbl}</small>
            </button>))}
        </div>
        {needsNote && (
          <div style={{ marginTop: 18 }}>
            {q.category === 'Auditoría gerencial' && <div className="qextra">
              {cleanParts.length > 1 && <>
                <label className="lbl">Parte (obligatorio)</label>
                <div className="zchips">{cleanParts.map((pp) => <button key={pp.number} type="button" className={`zchip ${a.part === pp.number ? 'on' : ''}`} onClick={() => set({ part: pp.number })}>{pp.number}</button>)}</div>
              </>}
              <label className="lbl">Sticker (obligatorio)</label>
              <div className="zchips">{[['White', 'Blanco'], ['Green', 'Verde'], ['Yellow', 'Amarillo'], ['Orange', 'Naranja'], ['Pink', 'Rosa']].map(([k, l]) => <button key={k} type="button" className={`zchip stk-${k} ${a.sticker === k ? 'on' : ''}`} onClick={() => set({ sticker: k })}>{l}</button>)}</div>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <input className="inp grow" placeholder="Número de operador" maxLength={30} inputMode="numeric" value={a.operator || ''} onChange={(e) => set({ operator: e.target.value })} />
                <select className="inp" style={{ width: 110 }} value={a.shift || ''} onChange={(e) => set({ shift: e.target.value })}><option value="">Turno</option><option value="1">1er</option><option value="2">2do</option><option value="3">3er</option></select>
              </div>
            </div>}
            <label className="lbl">Descripción del hallazgo (obligatorio)</label>
            <textarea className="inp" rows={3} value={a.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Describe el hallazgo…" />
            <label className="lbl">{a.closed_now ? 'Acción realizada en el momento (obligatorio)' : 'Contención / acción inmediata'}</label>
            <textarea className="inp" rows={2} value={a.corrective || ''} onChange={(e) => set({ corrective: e.target.value })} placeholder="Contención / corrección en sitio…" />
            <OwnerPicker value={a.owners || []} onChange={(owners) => set({ owners })} />
            <div className="sub" style={{ marginTop: 6 }}>Al enviar se abre un open issue; cada responsable que agregues deberá darle seguimiento hasta cerrarlo.</div>
            <label className="lbl">Foto del hallazgo (obligatoria)</label>
            <div className="photo">
              {a.evidence && <Photo src={a.evidence} />}
              <label className="btn alt sm" style={{ display: 'inline-block' }}>
                {a.evidence ? 'Cambiar foto' : 'Adjuntar foto de evidencia'}
                <input type="file" accept="image/*" hidden onChange={pickPhoto} />
              </label>
              {a.evidence && <button className="btn-ghost" onClick={() => setMarking(a.evidence)}>✎ Marcar</button>}
              {a.evidence && <button className="btn-ghost" onClick={() => set({ evidence: '' })}>Quitar</button>}
            </div>
            <label className="closenow"><input type="checkbox" checked={!!a.closed_now} onChange={(e) => set({ closed_now: e.target.checked, ...(e.target.checked ? {} : { close_evidence: '' }) })} /> <span>✅ Se corrigió en el momento (el issue queda cerrado)</span></label>
            {a.closed_now && <>
              <label className="lbl">Foto de la corrección (obligatoria)</label>
              <div className="photo">
                {a.close_evidence && <Photo src={a.close_evidence} />}
                <label className="btn alt sm" style={{ display: 'inline-block' }}>
                  {a.close_evidence ? 'Cambiar foto' : '📷 Subir evidencia de cierre'}
                  <input type="file" accept="image/*" hidden onChange={pickClosePhoto} />
                </label>
                {a.close_evidence && <button className="btn-ghost" onClick={() => set({ close_evidence: '' })}>Quitar</button>}
              </div>
            </>}
          </div>
        )}
        {err && <div className="err">{err}</div>}
      </div>
      <div className="exec-foot">
        <button className="btn alt" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>‹</button>
        <button className="btn grow" onClick={next}>
          {(() => { const atEnd = looped || idx === sLast; const last = sLast === qs.length - 1;
            return valid(a) ? (atEnd ? (pending ? 'Siguiente pendiente ›' : last ? 'Ver resumen' : stages.length > 1 ? 'Terminar etapa ›' : 'Siguiente ›') : 'Siguiente ›') : (atEnd ? 'Siguiente pendiente ›' : 'Saltar ›'); })()}
        </button>
      </div>
    </div>
  );
}

function Result({ audit }) {
  return (
    <>
      <div className="card" style={{ textAlign: 'center' }}>
        <Ring value={audit.score_pct} size={110} stroke={10} cls={scoreCls(audit.score_pct)} label={`${Math.round(audit.score_pct)}%`} sub="Score" />
        <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
          <span className="pill ok">{audit.ok_count} OK</span><span className="pill nok">{audit.nok_count} X</span>
          <span className="pill warn">{audit.partial_count} Δ</span><span className="pill">{audit.na_count} N/A</span>
        </div>
      </div>
      <div className="sect">Respuestas</div>
      {audit.responses.map((r) => (
        <div key={r.id} className="card" style={{ marginBottom: 8 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="grow" style={{ fontSize: 14 }}>{r.item ? <b className="qitem-s">#{r.item}</b> : null}<Bi text={r.question} /></div>
            <span className={`pill ${r.result === 'ok' ? 'ok' : r.result === 'nok' ? 'nok' : r.result === 'partial' ? 'warn' : ''}`}>{r.result === 'nok' ? 'X' : r.result === 'partial' ? 'Δ' : r.result === 'na' ? 'N/A' : 'OK'}</span>
          </div>
          {r.notes && <div className="sub">{r.notes}</div>}
          {r.corrective && <div className="sub">Acción: {r.corrective}</div>}
          {r.has_evidence && <Photo className="thumb" src={`/api/evidence/${r.id}`} />}
        </div>))}
    </>
  );
}

const gi = (d) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const G = {
  cal: gi(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>),
  doc: gi(<><path d="M7 3.5h7.5L19 8v12.5H7z" /><path d="M14 3.5V8h5M10 12.5h6M10 16h6" /></>),
  user: gi(<><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" /></>),
  layers: gi(<><path d="m12 3 9 4.5-9 4.5-9-4.5z" /><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" /></>),
  shield: gi(<><path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6z" /><path d="m8.8 12 2.4 2.4 4-4.4" /></>),
  clock: gi(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>),
  play: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>,
  arrow: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
};

// El admin puede eliminar una auditoría realizada (p. ej. de prueba) para que se vuelva a hacer
function ResetAudit({ audit, onDone }) {
  const user = useUser();
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  async function go() {
    const n = audit.nok_count + audit.partial_count;
    const reason = (prompt(`Razón por la que se elimina (obligatoria):\n\nSe borran las respuestas de ${audit.auditor}${n ? ` y ${n} hallazgo(s) en Issues` : ''}; la auditoría queda pendiente. No se puede deshacer.`) || '').trim();
    if (!reason) return;
    if (reason.length < 5) { setErr('Escribe la razón por la que se elimina'); return; }
    setBusy(true); setErr('');
    try { await api(`/api/admin/audits/${audit.id}/reset`, { method: 'POST', body: { reason } }); onDone(); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  if (!isAdmin(user)) return null;
  return (
    <div style={{ margin: '4px 0 12px' }}>
      <button type="button" className="reset-btn" disabled={busy} onClick={go}>{busy ? 'Eliminando…' : '🗑 Eliminar para que se vuelva a hacer'}</button>
      {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

export default function AuditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [audit, setAudit] = useState(null), [err, setErr] = useState(''), [running, setRunning] = useState(false), [done, setDone] = useState(null);
  const load = () => api(`/api/audits/${id}`).then(setAudit).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const header = useMemo(() => audit && (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn-ghost" onClick={() => router.push('/')}>← Volver</button>
        <span className="grow" />
        <span className="btn-ghost audit-date">{G.cal}{fmtDate(audit.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      </div>
      <h1 className="title">{audit.status === 'completed' ? 'Auditoría realizada' : (audit.layer === 1 || audit.kind === 'process') && !audit.zone && (!audit.area || audit.area === 'All Areas') ? (audit.kind === 'process' ? 'Auditoría de proceso' : audit.template) : audit.area}</h1>
      {audit.status === 'completed' && audit.late && <div className="latetag">⏰ Realizada tarde · programada {fmtDate(audit.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>}
      {audit.status === 'completed' && (audit.zone || audit.area) && <div className="zm"><b>Zona {audit.zone || audit.area}</b>{audit.shift ? <><i>/</i><b>Turno {audit.shift}</b></> : null}{audit.machine ? <><i>/</i><b>Máquina {audit.machine}</b></> : null}</div>}
      {((audit.layer >= 2 && audit.kind !== 'process') || audit.template === 'QE Proveedores (LPA)') && <ZoneEdit audit={audit} onSaved={(r) => (r.unchanged ? null : setAudit({ ...audit, area: r.area, zone: r.zone, machine: '', part_edited_at: new Date().toISOString(), area_original: audit.area_original || audit.area }))} />}
      {audit.part_number && <PartEdit audit={audit} onSaved={(r) => (r.unchanged ? null : setAudit({ ...audit, part_number: r.part_number, area: r.area ?? audit.area, zone: r.zone ?? audit.zone, machine: r.machine ?? audit.machine, part_edited_at: new Date().toISOString(), part_original: r.part_number !== audit.part_number ? (audit.part_original || audit.part_number) : audit.part_original, area_original: (r.area ?? audit.area) !== audit.area ? (audit.area_original || audit.area) : audit.area_original }))} />}
      <div className="audit-meta"><span>{G.doc}{audit.template}</span>{audit.shipper && <span>📦 Shipper {audit.shipper}</span>}{!audit.editable && <span>{G.user}{audit.auditor}</span>}<span>{G.layers}{LAYER[audit.layer]}</span>{!audit.editable && <span>{G.shield}{DEPT[audit.dept]}</span>}</div>
    </>), [audit, router]);

  if (err) return <Shell><div className="err">{err}</div></Shell>;
  if (!audit) return <Shell><div className="empty">Cargando…</div></Shell>;

  if (done) return (
    <Shell>
      <div className="card" style={{ textAlign: 'center', marginTop: 40 }}>
        <Ring value={done.score} size={120} stroke={10} cls={scoreCls(done.score)} label={`${done.score}%`} sub="Score" />
        <p>{done.queued ? 'Guardada en tu teléfono porque no hay señal. Se enviará sola cuando vuelva la conexión (deja la app abierta o vuelve a abrirla con señal).' : 'Auditoría registrada.'}{done.queued ? '' : done.findings > 0 ? ` Se abrieron ${done.findings} open issue(s) para seguimiento.` : ' Sin hallazgos.'}</p>
        {audit.kind === 'process' && <Link href={`/audit/${audit.id}/report`} className="rep-link" style={{ marginBottom: 12 }}>{G.doc}<b>Descargar reporte</b>{G.arrow}</Link>}
        <button className="btn block" onClick={() => router.replace('/')}>Listo</button>
      </div>
    </Shell>
  );

  const lateOk = audit.kind === 'process' && audit.window === 'missed'; // proceso: se puede hacer tarde
  const canRun = audit.editable && (audit.window === 'open' || audit.window === 'last_day' || lateOk);
  const why = !audit.editable ? (audit.status === 'pending' ? 'Aún no realizado' : 'Solo el auditor asignado puede realizarla.')
    : audit.window === 'upcoming' ? `Se habilita el ${fmtDate(audit.date)}.`
    : audit.window === 'missed' ? `No realizada. Solo se podía registrar el ${fmtDate(audit.closes_on)} (día programado).` : '';
  return (
    <Shell>
      {header}
      {audit.status === 'completed' && audit.kind === 'process' && <Link href={`/audit/${audit.id}/report`} className="rep-link">{G.doc}<b>Descargar reporte</b>{G.arrow}</Link>}
      {audit.status === 'completed' && <ResetAudit audit={audit} onDone={() => router.push('/admin')} />}
      {audit.status === 'completed' ? <Result audit={audit} /> : (
        <>
          {canRun ? <>{lateOk && <div className="offbar" style={{ marginTop: 14 }}>⏰ Esta auditoría estaba programada para el {fmtDate(audit.date, { weekday: 'long', day: 'numeric', month: 'short' })}. Puedes hacerla ahora; quedará registrada como <b>tardía</b>.</div>}<button className="audit-go" onClick={() => setRunning(true)}><i>{G.play}</i><b>{lateOk ? 'Realizar de forma tardía' : 'Iniciar auditoría'}</b>{G.arrow}</button></>
            : !audit.editable && audit.status === 'pending' ? <div className="notyet"><i>{G.clock}</i><b>Aún no realizado</b><span>{audit.auditor} todavía no la realiza.</span></div>
            : <div className={audit.window === 'missed' ? 'err' : 'card sub'} style={{ marginTop: 14 }}>{why}</div>}
          <div className="audit-info">
            <div><i className="b">{G.doc}</i><b className="big">{audit.questions.length}</b><b>Preguntas</b><span>en esta auditoría</span></div>
            <div><i className="o">{G.clock}</i><span>{audit.date === audit.due_date ? 'Solo disponible' : 'Disponible'}</span>
              <b className="when">{audit.date === audit.due_date ? fmtDate(audit.date, { weekday: 'short', day: 'numeric', month: 'short' }) : `${fmtDate(audit.date, { day: 'numeric', month: 'short' })} – ${fmtDate(audit.closes_on, { day: 'numeric', month: 'short' })}`}</b>
              {audit.window === 'last_day' && <span className="warnx">hoy es el último día</span>}</div>
            <div><i className="v">{G.layers}</i><b>{audit.layer === 1 || audit.kind === 'process' ? (audit.zone ? audit.area : 'Zona y máquina') : audit.area}</b><span>{audit.layer === 1 || audit.kind === 'process' ? 'se escoge al iniciar' : 'Área de evaluación'}</span></div>
            <div><i className="g">{G.shield}</i><b>{audit.kind === 'process' ? 'Proceso' : LAYER[audit.layer]}</b><span>Tipo de auditoría</span></div>
          </div>
        </>
      )}
      {running && <Runner audit={audit} onExit={() => setRunning(false)} onDone={setDone} onSetup={(r) => setAudit({ ...audit, ...r })} />}
    </Shell>
  );
}
