'use client';
import Photo from '@/components/Photo';
import { useEffect, useState } from 'react';
import Bi from '@/components/Bi';
import Shell, { useUser } from '@/components/Shell';
import OwnerPicker from '@/components/OwnerPicker';
import { api, fmtDate, peek, compressImage, useUrlState } from '@/lib/client';
import { isAdmin } from '@/lib/roles';

const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const OWN = { open: ['Pendiente', ''], in_progress: ['En proceso', 'gold'], done: ['Terminó', 'ok'] };
const KIND = { opened: '●', assign: '＋', unassign: '－', progress: '◐', done: '✓', comment: '✎', closed: '■', reopened: '↺' };
const no = (id) => 'OI-' + String(id).padStart(4, '0');
const when = (ts) => new Date(ts).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

// Adjuntar foto de evidencia (cierre del issue)
function EvidencePick({ value, onChange, setErr }) {
  async function pick(e) {
    const file = e.target.files?.[0]; if (!file) return;
    try { onChange(await compressImage(file)); } catch { setErr('No se pudo procesar la foto'); }
    e.target.value = '';
  }
  return (
    <div className="photo" style={{ marginTop: 8 }}>
      {value && <Photo src={value} />}
      <label className="btn alt sm" style={{ display: 'inline-block' }}>
        {value ? 'Cambiar foto' : '📷 Subir evidencia de cierre (obligatoria)'}
        <input type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      </label>
      {value && <button type="button" className="btn-ghost" onClick={() => onChange('')}>Quitar</button>}
    </div>
  );
}

function Item({ f, today, lead, user, reload, startOpen }) {
  const [open, setOpen] = useState(!!startOpen), [err, setErr] = useState(''), [tl, setTl] = useState(null);
  const mine = f.owners.find((o) => o.user_id === user.id);
  const [action, setAction] = useState(mine?.action || ''), [comment, setComment] = useState(''), [evid, setEvid] = useState(''), [closeAct, setCloseAct] = useState('');
  const canClose = lead || f.auditor_id === user.id;
  const closed = f.status === 'closed';
  const overdue = !closed && f.due_date && f.due_date < today;
  const soon = !closed && !overdue && f.due_date && f.due_date <= addDays(today, 2);
  const stCls = closed ? 'ok' : overdue ? 'nok' : soon ? 'warn' : 'ok';
  const stTxt = closed ? 'Cerrado' : overdue ? 'Vencido' : soon ? 'Por vencer' : f.status === 'in_progress' ? 'En proceso' : 'Abierto';
  const canAdd = lead || f.auditor_id === user.id || !!mine;
  const loadTl = () => api(`/api/findings/${f.id}`).then((d) => setTl(d.updates)).catch(() => {});
  useEffect(() => { if (open && !tl) loadTl(); /* eslint-disable-next-line */ }, [open]);
  async function patch(body) {
    setErr('');
    try { await api(`/api/findings/${f.id}`, { method: 'PATCH', body }); setComment(''); setEvid(''); setCloseAct(''); await loadTl(); reload(); }
    catch (e) { setErr(e.message); }
  }
  const pend = f.owners.filter((o) => o.status !== 'done').length;
  return (
    <div id={`oi-${f.id}`} className="card issue" style={{ marginBottom: 10, borderColor: overdue ? 'rgba(200,60,50,.5)' : undefined }}>
      <div style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div className="row oi-top"><span className={`pill ${f.result === 'nok' ? 'nok' : 'warn'}`}>{f.result === 'nok' ? 'X' : 'Δ'}</span><span className="oi-no">{no(f.id)}</span>{f.item ? <span className="oi-item">Ítem {f.item}</span> : null}</div>
        <div className="oi-q"><Bi text={f.question} /></div>
      </div>
      <div className="oi-meta">
        <span><i>Zona / Máquina</i><b>{f.area || '—'}</b></span>
        {f.part_number && <span><i>N/P</i><b>{f.part_number}</b></span>}
        <span><i>Fecha</i><b>{fmtDate(f.audit_date, { day: 'numeric', month: 'short' })}</b></span>
        <span><i>Auditor</i><b>{f.auditor}</b></span>
      </div>
      <div className="row wrap" style={{ marginTop: 8 }}>
        <span className={`pill ${stCls}`}>{stTxt}</span>
        {f.owners.length === 0 && !closed && <span className="pill nok">Sin responsable</span>}
        {f.owners.map((o) => <span key={o.user_id} className={`pill ${o.status === 'done' ? 'ok' : ''}`}>{o.name}{o.status === 'done' ? ' ✓' : ''}</span>)}
        {f.due_date && <span className={`pill ${overdue ? 'nok' : soon ? 'warn' : ''}`}>{'Compromiso '}{fmtDate(f.due_date, { day: 'numeric', month: 'short' })}</span>}
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          {f.notes && <div style={{ fontSize: 14 }}><b>Hallazgo:</b> {f.notes}</div>}
          {f.evidence_id && <Photo className="thumb" src={`/api/evidence/${f.evidence_id}`} />}

          {(f.closure || []).length > 0 && <>
            <div className="sect" style={{ marginTop: 14 }}>Evidencia de cierre</div>
            <div className="row wrap" style={{ gap: 10, alignItems: 'flex-start' }}>
              {f.closure.map((c) => <div key={c.id}><Photo className="thumb" src={`/api/findings/${f.id}/evidence/${c.id}`} /><div className="sub" style={{ margin: '2px 0 0', fontSize: 11 }}>{c.name || '—'}</div></div>)}
            </div>
          </>}

          <div className="sect" style={{ marginTop: 14 }}>Responsables</div>
          {f.owners.length === 0 && <div className="sub">Nadie asignado todavía.</div>}
          {f.owners.map((o) => (
            <div key={o.user_id} className="owner-row">
              <div className="grow"><b>{o.name}</b>{o.user_id === user.id ? ' (tú)' : ''}
                {o.action && <div className="sub" style={{ margin: 0 }}>{o.action}</div>}</div>
              <span className={`pill ${OWN[o.status][1]}`}>{OWN[o.status][0]}</span>
              {lead && !closed && <button className="btn-ghost" aria-label="Quitar" onClick={() => patch({ remove_owner: o.user_id })}>✕</button>}
            </div>))}
          {canAdd && <div style={{ marginTop: 6 }}><OwnerPicker label="" value={[]} onChange={(v) => v[0] && patch({ add_owner: v[0] })} exclude={f.owners.map((o) => o.user_id)} /></div>}

          {mine && mine.status !== 'done' && !closed && <>
            <div className="sect" style={{ marginTop: 14 }}>Tu seguimiento</div>
            <textarea className="inp" rows={2} value={action} onChange={(e) => setAction(e.target.value)} placeholder="Acción / contramedida que tomaste o tomarás…" />
            <EvidencePick value={evid} onChange={setEvid} setErr={setErr} />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn alt sm grow" onClick={() => patch({ my_status: 'in_progress', action })}>En proceso</button>
              <button className="btn sm grow" disabled={!evid && !(f.closure || []).length} onClick={() => patch({ my_status: 'done', action, evidence: evid || undefined })}>Terminé mi parte</button>
            </div>
          </>}
          {mine && mine.status === 'done' && <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => patch({ my_status: 'open' })}>Reabrir mi parte</button>}

          {lead && <div style={{ marginTop: 14 }}>
            <label className="lbl">Compromiso</label>
            <input className="inp" type="date" value={f.due_date || ''} onChange={(e) => patch({ due_date: e.target.value })} />
          </div>}

          {canClose && !closed && <div className="oi-close">
            <div className="sect" style={{ marginTop: 14 }}>{lead ? 'Cerrar como líder' : 'Cerrar este hallazgo'}</div>
            <textarea className="inp" rows={2} value={closeAct} onChange={(e) => setCloseAct(e.target.value)} placeholder="Acción tomada para cerrar el issue…" />
            <EvidencePick value={evid} onChange={setEvid} setErr={setErr} />
            <button type="button" className="btn sm block" style={{ marginTop: 10 }} disabled={!closeAct.trim() || (!evid && !(f.closure || []).length)} onClick={() => patch({ force_status: 'closed', action: closeAct, evidence: evid || undefined })}>Cerrar issue</button>
          </div>}

          {(lead && closed || isAdmin(user)) && <div className="oi-actions">
            {lead && closed && <button type="button" className="btn-ghost" onClick={() => patch({ force_status: 'open' })}>Reabrir</button>}
            {isAdmin(user) && <button type="button" className="btn-ghost" style={{ color: '#d11d2a' }} onClick={async () => {
              const r = (prompt('Razón por la que se elimina este hallazgo (obligatoria):\nSe borra el issue y su bitácora. No se puede deshacer.') || '').trim();
              if (!r) return;
              try { await api(`/api/findings/${f.id}`, { method: 'DELETE', body: { reason: r } }); reload(); } catch (e) { setErr(e.message); }
            }}>🗑 Eliminar</button>}
          </div>}

          <div className="sect" style={{ marginTop: 14 }}>Bitácora</div>
          {!tl ? <div className="sub">Cargando…</div> : tl.map((u) => (
            <div key={u.id} className="tl"><span className="tl-i">{KIND[u.kind] || '•'}</span>
              <div><div style={{ fontSize: 13 }}>{u.text}</div><div className="sub" style={{ margin: 0, fontSize: 11 }}>{u.name || 'Sistema'} · {when(u.created_at)}</div></div></div>))}
          <div className="row" style={{ marginTop: 8 }}>
            <input className="inp" placeholder="Agregar comentario…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <button className="btn sm" disabled={!comment.trim()} onClick={() => patch({ comment })}>Enviar</button>
          </div>
          {err && <div className="err">{err}</div>}
        </div>
      )}
    </div>
  );
}

function Inner() {
  const user = useUser();
  const lead = isAdmin(user);
  const [status, setStatus] = useUrlState('v', null), [data, setData] = useState(null), [err, setErr] = useState('');
  const focus = typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('oi')) || null : null;
  // Vista inicial: "Mis issues" si tienes alguno a cargo; si no, abiertos
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('v')) return; // la pestaña viene en la URL
    const c0 = peek('/api/findings/count'); if (c0) setStatus(c0.n > 0 ? 'mine' : 'open', { replace: true });
    api('/api/findings/count').then((c) => setStatus(c.n > 0 ? 'mine' : 'open', { replace: true })).catch(() => setStatus('open', { replace: true }));
    // eslint-disable-next-line
  }, []);
  const load = () => status && api(`/api/findings?status=${status}`).then(setData).catch((e) => setErr(e.message));
  useEffect(() => { setData(status ? peek(`/api/findings?status=${status}`) : null); load(); /* eslint-disable-next-line */ }, [status]);
  const tabs = [['mine', 'A mi cargo'], ['open', 'Abiertos'], ...(lead ? [['unassigned', 'Sin responsable']] : []), ['closed', 'Cerrados']];
  return (
    <>
      <h1 className="title">Open issues</h1>
      <div className="sub">Cada hallazgo abre un issue; todos sus responsables deben darle seguimiento hasta cerrarlo.</div>
      <div className="seg" style={{ margin: '12px 0' }}>
        {tabs.map(([k, l]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>)}
      </div>
      {err && <div className="err">{err}</div>}
      {!data ? <div className="empty">Cargando…</div> : data.findings.length === 0 ? <div className="card empty">Sin issues en esta vista.</div>
        : data.findings.map((f) => <Item key={f.id} f={f} today={data.today} lead={lead} user={user} reload={load} startOpen={f.id === focus} />)}
    </>
  );
}
export default function Findings() { return <Shell><Inner /></Shell>; }
