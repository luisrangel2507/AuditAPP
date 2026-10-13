'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Bi from '@/components/Bi';
import { isAdmin } from '@/lib/roles';
import Shell from '@/components/Shell';
import { api, fmtDate, compressImage, useLocal, scoreCls, DEPT, LAYER } from '@/lib/client';
import Ring from '@/components/Ring';
import OwnerPicker, { useUsers } from '@/components/OwnerPicker';
import { useUser } from '@/components/Shell';

const BTN = [
  ['ok', '✓', 'Cumple', 'OK'], ['nok', '✕', 'No cumple', 'NOK'], ['partial', 'Δ', 'Cumple parcialmente', 'Parcial'], ['na', '—', 'No aplica', 'N/A'],
];

function Runner({ audit, onExit, onDone }) {
  const draft = useLocal(`lpa-draft-${audit.id}`, { answers: {}, idx: 0 });
  const [answers, setAnswers] = useState(() => draft.read().answers || {});
  const [idx, setIdx] = useState(() => draft.read().idx || 0);
  const [summary, setSummary] = useState(false);
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

  useEffect(() => { draft.write({ answers, idx, sec: tick.current.sec }); /* eslint-disable-next-line */ }, [answers, idx]);

  const q = qs[Math.min(idx, qs.length - 1)];
  const a = answers[q?.id] || {};
  const needsNote = a.result === 'nok' || a.result === 'partial';
  const valid = (x) => x && x.result && (!(x.result === 'nok' || x.result === 'partial') || (x.notes || '').trim().length >= 3);
  const set = (patch) => setAnswers((s) => ({ ...s, [q.id]: { ...s[q.id], ...patch } }));
  const allValid = qs.every((x) => valid(answers[x.id]));

  async function pickPhoto(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try { set({ evidence: await compressImage(f) }); } catch { setErr('No se pudo procesar la foto'); }
    e.target.value = '';
  }
  async function submit() {
    setBusy(true); setErr('');
    try {
      const responses = qs.map((x) => ({ question_id: x.id, ...answers[x.id] }));
      const res = await api(`/api/audits/${audit.id}/submit`, { method: 'POST', body: { responses, active_sec: tick.current.sec } });
      draft.clear(); onDone(res);
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  if (summary) {
    const c = { ok: 0, nok: 0, partial: 0, na: 0 };
    qs.forEach((x) => c[answers[x.id].result]++);
    const scored = c.ok + c.nok + c.partial;
    const score = scored ? Math.round((c.ok / scored) * 1000) / 10 : 100;
    return (
      <div className="exec">
        <div className="exec-top"><h2>Resumen</h2><div className="sub">{audit.area}{audit.part_number ? ` · N/P ${audit.part_number}` : ''} · {audit.template}</div></div>
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
          {err && <div className="err">{err}</div>}
        </div>
        <div className="exec-foot">
          <button className="btn alt" onClick={() => setSummary(false)}>‹ Revisar</button>
          <button className="btn grow" disabled={busy} onClick={submit}>{busy ? 'Enviando…' : 'Enviar auditoría'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="exec">
      <div className="exec-top">
        <div className="row">
          <button className="btn-ghost" onClick={onExit}>✕ Salir</button>
          <div className="grow" style={{ textAlign: 'center', fontSize: 16, fontWeight: 600 }}>{audit.area}<div className="sub" style={{ margin: 0, fontSize: 12 }}>{audit.part_number ? `N/P ${audit.part_number} · ` : ''}{audit.template}</div></div>
          <div className="sub" style={{ margin: 0 }}>{idx + 1}/{qs.length}</div>
        </div>
        <div className="prog"><i style={{ width: `${((idx + 1) / qs.length) * 100}%` }} /></div>
      </div>
      <div className="exec-body">
        <div className="qcat">{q.category || audit.template}</div>
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
            <label className="lbl">Evidencia</label>
            <div className="photo">
              {a.evidence && <img src={a.evidence} alt="evidencia" />}
              <label className="btn alt sm" style={{ display: 'inline-block' }}>
                {a.evidence ? 'Cambiar foto' : 'Adjuntar foto de evidencia'}
                <input type="file" accept="image/*" capture="environment" hidden onChange={pickPhoto} />
              </label>
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
            <div className="grow" style={{ fontSize: 14 }}><Bi text={r.question} /></div>
            <span className={`pill ${r.result === 'ok' ? 'ok' : r.result === 'nok' ? 'nok' : r.result === 'partial' ? 'warn' : ''}`}>{r.result === 'nok' ? 'X' : r.result === 'partial' ? 'Δ' : r.result === 'na' ? 'N/A' : 'OK'}</span>
          </div>
          {r.notes && <div className="sub">{r.notes}</div>}
          {r.corrective && <div className="sub">Acción: {r.corrective}</div>}
          {r.has_evidence && <img className="thumb" src={`/api/evidence/${r.id}`} alt="evidencia" loading="lazy" />}
        </div>))}
    </>
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
      <button className="btn-ghost" onClick={() => router.push('/')} style={{ marginBottom: 12 }}>‹ Volver</button>
      <h1 className="title">{audit.area}</h1>
      {audit.part_number && <div className="partno">N/P <b>{audit.part_number}</b></div>}
      <div className="sub">{audit.template} · {audit.auditor} ({LAYER[audit.layer]} · {DEPT[audit.dept]}) · {fmtDate(audit.date)}</div>
    </>), [audit, router]);

  if (err) return <Shell><div className="err">{err}</div></Shell>;
  if (!audit) return <Shell><div className="empty">Cargando…</div></Shell>;

  if (done) return (
    <Shell>
      <div className="card" style={{ textAlign: 'center', marginTop: 40 }}>
        <Ring value={done.score} size={120} stroke={10} cls={scoreCls(done.score)} label={`${done.score}%`} sub="Score" />
        <p>Auditoría registrada.{done.findings > 0 ? ` Se abrieron ${done.findings} open issue(s) para seguimiento.` : ' Sin hallazgos.'}</p>
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
      {audit.status === 'completed' ? <Result audit={audit} /> : (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ margin: '0 0 6px' }}>{audit.questions.length} preguntas</p>
          <p className="sub" style={{ margin: '0 0 14px' }}>{audit.date === audit.due_date ? `Solo se puede registrar el ${fmtDate(audit.date)}` : `Se puede registrar del ${fmtDate(audit.date)} al ${fmtDate(audit.closes_on)}`}{audit.window === 'last_day' ? ' · hoy es el último día' : ''}</p>
          {canRun ? <button className="btn block" onClick={() => setRunning(true)}>Iniciar auditoría</button>
            : <div className={audit.window === 'missed' ? 'err' : 'sub'}>{why}</div>}
        </div>
      )}
      {running && <Runner audit={audit} onExit={() => setRunning(false)} onDone={setDone} />}
    </Shell>
  );
}
