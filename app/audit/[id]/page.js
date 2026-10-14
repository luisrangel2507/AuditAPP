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

const BTN = [
  ['ok', '✓', 'Cumple', 'OK'], ['nok', '✕', 'No cumple', 'NOK'], ['partial', 'Δ', 'Cumple parcialmente', 'Parcial'], ['na', '—', 'No aplica', 'N/A'],
];

// Inicio de toda auditoría. Layer 1 y QEs: zona → máquina (salvo PL) → N/P (con segundo N/P para piezas espejo RH / LH).
// Layer 2, 3 y 4 (All Areas): solo escogen el área que auditan.
const ZTONE = (z) => (z.startsWith('PL') ? 'g' : ({ A: 'b', B: 'e', C: 'o', D: 'v', E: 't' })[z[0]] || 'b');
const fac = <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20V9l5 3V9l5 3V5h3v15z" /><path d="M3 20h18M7 16h2M12 16h2" /></svg>;
const wh = <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10 12 4l9 6v10H3z" /><path d="M8 20v-6h8v6M8 17h8" /></svg>;
const cube = <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>;
const chev = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;

function Setup({ audit, onSaved, onExit }) {
  const full = audit.layer === 1 || audit.kind === 'process';
  const hint = audit.area && audit.area !== 'All Areas' ? audit.area : '';
  const [step, setStep] = useState('zone');
  const [zone, setZone] = useState(''), [machine, setMachine] = useState(''), [p1, setP1] = useState(''), [p2, setP2] = useState(''), [mirror, setMirror] = useState(false);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const noMach = NO_MACHINE.includes(zone);
  const list = (audit.machines && audit.machines[zone]) || [];
  const partOk = p1.trim() && (!mirror || p2.trim());
  const sub = step === 'zone' ? (full ? 'Selecciona la zona donde realizarás la auditoría' : 'Selecciona el área que vas a auditar')
    : step === 'machine' ? `Zona ${zone}: selecciona la máquina` : `Zona ${zone}${machine ? ' · ' + machine : ''}: captura el número de parte`;
  async function go() {
    setBusy(true); setErr('');
    try { const r = await api(`/api/audits/${audit.id}/setup`, { method: 'POST', body: { zone, machine: noMach ? '' : machine, part_number: p1, part_number2: mirror ? p2 : '' } }); onSaved(r); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  const pickZone = (z) => { setZone(z); setMachine(''); if (!full) return; setStep(NO_MACHINE.includes(z) ? 'part' : 'machine'); };
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
          <div className="ztiles">{ZONES.map((z) => (
            <button key={z} type="button" className={`ztile t-${ZTONE(z)} ${zone === z ? 'on' : ''}`} onClick={() => pickZone(z)}>
              <span className="zi">{z.startsWith('PL') ? wh : fac}</span><b>{z}</b><span className="zc">{chev}</span>
            </button>))}</div>
          {!full && zone && <div className="setup-note">Área elegida: <b>{zone}</b></div>}
        </>}
        {step === 'machine' && <>
          <div className="setup-h"><i />2. Máquina <span>Zona {zone}</span></div>
          <div className="ztiles m">{list.map((m) => (
            <button key={m} type="button" className={`ztile t-${ZTONE(zone)} ${machine === m ? 'on' : ''}`} onClick={() => { setMachine(m); setStep('part'); }}>
              <span className="zi">{fac}</span><b>{m}</b><span className="zc">{chev}</span>
            </button>))}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <input className="inp" placeholder="Otra máquina…" maxLength={40} value={list.includes(machine) ? '' : machine} onChange={(e) => setMachine(e.target.value)} />
            <button className="btn sm" disabled={!machine.trim() || list.includes(machine)} onClick={() => setStep('part')}>Usar</button>
          </div>
        </>}
        {step === 'part' && <>
          <div className="setup-h"><i />{noMach ? '2' : '3'}. Número de parte</div>
          <label className="npcard"><span className="npi">{cube}</span><i className="npsep" /><input placeholder="No. de parte" maxLength={40} autoCapitalize="characters" value={p1} onChange={(e) => setP1(e.target.value)} /></label>
          {mirror
            ? <label className="npcard"><span className="npi">{cube}</span><i className="npsep" /><input placeholder="Segundo N/P (RH / LH)" maxLength={40} autoCapitalize="characters" value={p2} onChange={(e) => setP2(e.target.value)} /><button type="button" className="npx" onClick={() => { setMirror(false); setP2(''); }} aria-label="Quitar segundo N/P">✕</button></label>
            : <button className="npadd" type="button" onClick={() => setMirror(true)}><span className="npplus">+</span><i className="npsep" /><b>Segundo N/P (pieza espejo RH / LH)</b></button>}
        </>}
        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
      </div>
      <div className="setup-foot">
        <button className="setup-go" disabled={busy || (full ? !(step === 'part' && partOk) : !zone)} onClick={go}><span>→</span><b>{busy ? 'Guardando…' : 'Comenzar preguntas'}</b></button>
      </div>
    </div>
  );
}

// Zona, máquina y N/P con opción de corregirlos (quedan marcados como corregidos)
function PartEdit({ audit, onSaved }) {
  const full = audit.layer === 1 || audit.kind === 'process';
  const [open, setOpen] = useState(false), [zone, setZone] = useState(''), [machine, setMachine] = useState(''), [p1, setP1] = useState(''), [p2, setP2] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const edited = !!audit.part_edited_at;
  const noMach = NO_MACHINE.includes(zone);
  const list = (audit.machines && audit.machines[zone]) || [];
  const start = () => { const [a, b] = String(audit.part_number).split(' / '); setP1(a || ''); setP2(b || ''); setZone(audit.zone || ''); setMachine(audit.machine || ''); setErr(''); setOpen(true); };
  async function save() {
    setBusy(true); setErr('');
    try { const r = await api(`/api/audits/${audit.id}/part`, { method: 'POST', body: { part_number: p1, part_number2: p2, ...(full ? { zone, machine: noMach ? '' : machine } : {}) } }); onSaved(r); setOpen(false); }
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
          <input className="inp" placeholder="No. de parte" maxLength={40} autoCapitalize="characters" value={p1} onChange={(e) => setP1(e.target.value)} />
          <input className="inp" style={{ marginTop: 8 }} placeholder="Segundo N/P (pieza espejo, opcional)" maxLength={40} autoCapitalize="characters" value={p2} onChange={(e) => setP2(e.target.value)} />
          {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn alt grow" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn grow" disabled={busy || !p1.trim() || (full && (!zone || (!noMach && !machine.trim())))} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div></div>)}
    </>
  );
}

function Runner({ audit, onExit, onDone, onSetup }) {
  const needSetup = !audit.zone;
  if (needSetup) return <Setup audit={audit} onSaved={onSetup} onExit={onExit} />;
  return <RunnerInner audit={audit} onExit={onExit} onDone={onDone} />;
}

function RunnerInner({ audit, onExit, onDone }) {
  const draft = useLocal(`lpa-draft-${audit.id}`, { answers: {}, idx: 0 });
  const [answers, setAnswers] = useState(() => draft.read().answers || {});
  const [idx, setIdx] = useState(() => draft.read().idx || 0);
  const [marking, setMarking] = useState(null), [summary, setSummary] = useState(false), [area, setArea] = useState(() => draft.read().area || '');
  const needArea = false, needPart = false;
  const [part, setPart] = useState(() => draft.read().part || audit.part_number || '');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const qs = audit.questions;
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

  useEffect(() => { draft.write({ answers, idx, area, part, sec: tick.current.sec }); /* eslint-disable-next-line */ }, [answers, idx, area, part]);

  const q = qs[Math.min(idx, qs.length - 1)];
  const a = answers[q?.id] || {};
  const needsNote = a.result === 'nok' || a.result === 'partial';
  const valid = (x) => x && x.result && (!(x.result === 'nok' || x.result === 'partial') || (x.notes || '').trim().length >= 3);
  const set = (patch) => setAnswers((s) => ({ ...s, [q.id]: { ...s[q.id], ...patch } }));
  const allValid = qs.every((x) => valid(answers[x.id]));

  async function pickPhoto(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try { setMarking(await compressImage(f)); } catch { setErr('No se pudo procesar la foto'); }
    e.target.value = '';
  }
  async function submit() {
    setBusy(true); setErr('');
    try {
      const responses = qs.map((x) => ({ question_id: x.id, ...answers[x.id] }));
      const res = await api(`/api/audits/${audit.id}/submit`, { method: 'POST', body: { responses, active_sec: tick.current.sec, area: needArea ? area.trim() : undefined, part_number: needPart ? part.trim() : undefined } });
      draft.clear(); onDone(res);
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  const marker = marking ? <PhotoMark src={marking} onCancel={() => setMarking(null)} onDone={(d) => { set({ evidence: d }); setMarking(null); }} /> : null;
  if (summary) {
    const c = { ok: 0, nok: 0, partial: 0, na: 0 };
    qs.forEach((x) => c[answers[x.id].result]++);
    const scored = c.ok + c.nok + c.partial;
    const score = scored ? Math.round((c.ok / scored) * 1000) / 10 : 100;
    return (
      <div className="exec">
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
          {needPart && <div className="card" style={{ marginBottom: 12 }}>
            <div className="sect" style={{ marginTop: 0 }}>¿Qué número de parte revisaste?</div>
            <input className="inp" placeholder="No. de parte" maxLength={40} autoCapitalize="characters" value={part} onChange={(e) => setPart(e.target.value)} />
          </div>}
          {needArea && <div className="card" style={{ marginBottom: 12 }}>
            <div className="sect" style={{ marginTop: 0 }}>¿Qué área auditaste?</div>
            <datalist id="aud-zones">{(audit.zones || []).map((z) => <option key={z} value={z} />)}</datalist>
            <input className="inp" list="aud-zones" placeholder="Área auditada" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>}
          {err && <div className="err">{err}</div>}
        </div>
        <div className="exec-foot">
          <button className="btn alt" onClick={() => setSummary(false)}>‹ Revisar</button>
          <button className="btn grow" disabled={busy || (needArea && !area.trim()) || (needPart && !part.trim())} onClick={submit}>{busy ? 'Enviando…' : 'Enviar auditoría'}</button>
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
          <div className="grow" style={{ textAlign: 'center', fontSize: 16, fontWeight: 600 }}>{audit.area}<div className="sub" style={{ margin: 0, fontSize: 12 }}>{audit.part_number ? `N/P ${audit.part_number} · ` : ''}{audit.template}</div></div>
          <div className="sub" style={{ margin: 0 }}>{idx + 1}/{qs.length}</div>
        </div>
        <div className="prog"><i style={{ width: `${((idx + 1) / qs.length) * 100}%` }} /></div>
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
            <label className="lbl">Descripción del hallazgo (obligatorio)</label>
            <textarea className="inp" rows={3} value={a.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Describe el hallazgo…" />
            <label className="lbl">Contención / acción inmediata</label>
            <textarea className="inp" rows={2} value={a.corrective || ''} onChange={(e) => set({ corrective: e.target.value })} placeholder="Contención / corrección en sitio…" />
            <OwnerPicker value={a.owners || []} onChange={(owners) => set({ owners })} />
            <div className="sub" style={{ marginTop: 6 }}>Al enviar se abre un open issue; cada responsable que agregues deberá darle seguimiento hasta cerrarlo.</div>
            <label className="lbl">Foto del hallazgo</label>
            <div className="photo">
              {a.evidence && <Photo src={a.evidence} />}
              <label className="btn alt sm" style={{ display: 'inline-block' }}>
                {a.evidence ? 'Cambiar foto' : 'Adjuntar foto de evidencia'}
                <input type="file" accept="image/*" capture="environment" hidden onChange={pickPhoto} />
              </label>
              {a.evidence && <button className="btn-ghost" onClick={() => setMarking(a.evidence)}>✎ Marcar</button>}
              {a.evidence && <button className="btn-ghost" onClick={() => set({ evidence: '' })}>Quitar</button>}
            </div>
          </div>
        )}
        {err && <div className="err">{err}</div>}
      </div>
      <div className="exec-foot">
        <button className="btn alt" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>‹</button>
        {idx < qs.length - 1
          ? <button className="btn grow" disabled={!valid(a)} onClick={() => setIdx(idx + 1)}>Siguiente ›</button>
          : <button className="btn grow" disabled={!allValid} onClick={() => setSummary(true)}>Ver resumen</button>}
      </div>
    </div>
  );
}

function Result({ audit }) {
  const user = useUser();
  const mx = (ts) => new Date(ts).toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false });
  const dur = (s) => s == null ? '—' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  return (
    <>
      {isAdmin(user) && audit.completed_at && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="sub" style={{ margin: 0 }}>Registrada a las <b>{mx(audit.completed_at)}</b>{audit.started_at ? ` · inició ${mx(audit.started_at)}` : ''} · duración activa <b>{dur(audit.active_sec)}</b></div>
        </div>)}
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
      {audit.status === 'completed' && (audit.zone || audit.area) && <div className="zm"><b>Zona {audit.zone || audit.area}</b>{audit.machine ? <><i>/</i><b>Máquina {audit.machine}</b></> : null}</div>}
      {audit.part_number && <PartEdit audit={audit} onSaved={(r) => (r.unchanged ? null : setAudit({ ...audit, part_number: r.part_number, area: r.area ?? audit.area, zone: r.zone ?? audit.zone, machine: r.machine ?? audit.machine, part_edited_at: new Date().toISOString(), part_original: r.part_number !== audit.part_number ? (audit.part_original || audit.part_number) : audit.part_original, area_original: (r.area ?? audit.area) !== audit.area ? (audit.area_original || audit.area) : audit.area_original }))} />}
      <div className="audit-meta"><span>{G.doc}{audit.template}</span>{!audit.editable && <span>{G.user}{audit.auditor}</span>}<span>{G.layers}{LAYER[audit.layer]}</span>{!audit.editable && <span>{G.shield}{DEPT[audit.dept]}</span>}</div>
    </>), [audit, router]);

  if (err) return <Shell><div className="err">{err}</div></Shell>;
  if (!audit) return <Shell><div className="empty">Cargando…</div></Shell>;

  if (done) return (
    <Shell>
      <div className="card" style={{ textAlign: 'center', marginTop: 40 }}>
        <Ring value={done.score} size={120} stroke={10} cls={scoreCls(done.score)} label={`${done.score}%`} sub="Score" />
        <p>Auditoría registrada.{done.findings > 0 ? ` Se abrieron ${done.findings} open issue(s) para seguimiento.` : ' Sin hallazgos.'}</p>
        {audit.kind === 'process' && <Link href={`/audit/${audit.id}/report`} className="rep-link" style={{ marginBottom: 12 }}>{G.doc}<b>Descargar reporte</b>{G.arrow}</Link>}
        <button className="btn block" onClick={() => router.replace('/')}>Listo</button>
      </div>
    </Shell>
  );

  const canRun = audit.editable && (audit.window === 'open' || audit.window === 'last_day');
  const why = !audit.editable ? 'Solo el auditor asignado puede realizarla.'
    : audit.window === 'upcoming' ? `Se habilita el ${fmtDate(audit.date)}.`
    : audit.window === 'missed' ? `No realizada. Solo se podía registrar el ${fmtDate(audit.closes_on)} (día programado).` : '';
  return (
    <Shell>
      {header}
      {audit.status === 'completed' && audit.kind === 'process' && <Link href={`/audit/${audit.id}/report`} className="rep-link">{G.doc}<b>Descargar reporte</b>{G.arrow}</Link>}
      {audit.status === 'completed' ? <Result audit={audit} /> : (
        <>
          {canRun ? <button className="audit-go" onClick={() => setRunning(true)}><i>{G.play}</i><b>Iniciar auditoría</b>{G.arrow}</button>
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
