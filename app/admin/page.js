'use client';
import { useEffect, useState } from 'react';
import Shell, { useUser } from '@/components/Shell';
import { isMaster } from '@/lib/roles';
import Bi from '@/components/Bi';
import { ZONES, NO_MACHINE } from '@/lib/zones';
import { api, peek, DEPT, LAYER, DAYS_SHORT, fmtDate, getSiteCookie, setSiteCookie, todayStr } from '@/lib/client';

function UserSheet({ u, templates, onClose, onSaved }) {
  const me = useUser(), master = isMaster(me);
  const isNew = !u.id;
  const [f, setF] = useState({ name: '', username: '', dept: 'production', layer: 1, access: 'auditor', template_id: '', days: [], pool: [], start_idx: 0, rotate_daily: false, active: true, ...u });
  const [pool, setPool] = useState((u.pool || []).join(', ')), [pin, setPin] = useState(''), [err, setErr] = useState('');
  const [sites, setSites] = useState([]);
  useEffect(() => { api('/api/sites').then((s) => { setSites(s); if (isNew) { const c = getSiteCookie(); const d = s.find((x) => x.code === c) || s[0]; if (d) setF((v) => ({ ...v, site_id: d.id })); } }); /* eslint-disable-next-line */ }, []);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  async function save() {
    setErr('');
    const body = { ...f, layer: Number(f.layer), template_id: f.template_id ? Number(f.template_id) : null, start_idx: Number(f.start_idx) || 0,
      pool: pool.split(',').map((s) => s.trim()).filter(Boolean), days: Number(f.layer) >= 2 ? [] : f.days };
    try {
      if (isNew) await api('/api/admin/users', { method: 'POST', body: { ...body, password: pin } });
      else await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { ...body, ...(pin ? { reset_password: pin } : {}), ...(f.lpa_on !== u.lpa_on ? { lpa_enabled: !!f.lpa_on } : {}) } });
      onSaved();
    } catch (e) { setErr(e.message); }
  }
  return (
    <div className="sheet-bg" onClick={onClose}><div className="sheet" onClick={(e) => e.stopPropagation()}>
      <h2>{isNew ? 'Nuevo usuario' : f.name}</h2>
      <label className="lbl">Nombre</label><input className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} />
      {isNew && <><label className="lbl">Usuario</label><input className="inp" autoCapitalize="none" value={f.username} onChange={(e) => set('username', e.target.value)} /></>}
      {me.multi_site && <><label className="lbl">Planta</label>
      <select className="inp" disabled={!master || f.access === 'master'} value={f.site_id || ''} onChange={(e) => set('site_id', e.target.value ? Number(e.target.value) : null)}>
        <option value="">{f.access === 'master' ? 'Todas las plantas' : '—'}</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select></>}
      <div className="row wrap">
        <div className="grow"><label className="lbl">Departamento</label>
          <select className="inp" value={f.dept} onChange={(e) => set('dept', e.target.value)}>{Object.entries(DEPT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="grow"><label className="lbl">Capa</label>
          <select className="inp" value={f.layer} onChange={(e) => set('layer', e.target.value)}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{LAYER[n]}</option>)}</select></div>
      </div>
      <div className="row wrap">
        <div className="grow"><label className="lbl">Acceso</label>
          <select className="inp" value={f.access} onChange={(e) => set('access', e.target.value)}>
            <option value="auditor">Auditor</option><option value="lead">Líder (igual que auditor)</option><option value="admin">{me.multi_site ? 'Administrador de planta' : 'Administrador'}</option>{master && me.multi_site && <option value="master">Máster (todas las plantas)</option>}</select></div>
        <div className="grow"><label className="lbl">Plantilla de preguntas</label>
          <select className="inp" value={f.template_id || ''} onChange={(e) => set('template_id', e.target.value)}>
            <option value="">—</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      </div>
      {Number(f.layer) === 1 && <>
        <label className="lbl">Días fijos de auditoría</label>
        <div className="days">{DAYS_SHORT.map((n, i) => (
          <label key={n}><input type="checkbox" checked={f.days.includes(i + 1)} onChange={(e) => set('days', e.target.checked ? [...f.days, i + 1].sort() : f.days.filter((x) => x !== i + 1))} />{n}</label>))}</div>
        <label className="lbl">Áreas por las que rota (separadas por coma)</label>
        <input className="inp" value={pool} onChange={(e) => setPool(e.target.value)} placeholder="ZONA A, ZONA B, ZONA C" />
        <div className="row wrap">
          <div className="grow"><label className="lbl">Área inicial (posición, 0 = primera)</label><input className="inp" type="number" min="0" value={f.start_idx} onChange={(e) => set('start_idx', e.target.value)} /></div>
          <label className="row" style={{ marginTop: 24 }}><input type="checkbox" checked={f.rotate_daily} onChange={(e) => set('rotate_daily', e.target.checked)} /> Cambia de área cada día</label>
        </div>
      </>}
      {!isNew && f.access !== 'admin' && f.access !== 'master' && <label className="lpa-sw">
        <input type="checkbox" checked={!!f.lpa_on} onChange={(e) => set('lpa_on', e.target.checked)} />
        <span><b>Hace LPA</b><small>{f.lpa_on ? 'Le aparece su auditoría LPA según su capa y días.' : 'No se le generan auditorías LPA.'}{u.dept === 'quality' && Number(u.layer) === 1 && u.lpa_override == null ? ' (los QEs hoy solo hacen auditorías de proceso; actívala aquí para este usuario)' : ''}</small></span>
      </label>}
      <label className="lbl">{isNew ? 'Contraseña inicial (mín. 8 caracteres)' : 'Nueva contraseña (opcional, mín. 8 caracteres)'}</label>
      <input className="inp" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />
      {!isNew && <label className="row" style={{ marginTop: 14 }}><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Activo</label>}
      {err && <div className="err">{err}</div>}
      <div className="row" style={{ marginTop: 16 }}><button className="btn alt grow" onClick={onClose}>Cancelar</button><button className="btn grow" onClick={save}>Guardar</button></div>
    </div></div>
  );
}

const DEPT_ORDER = ['quality', 'process', 'production', 'logistics', 'hr', 'maintenance', 'toolroom', 'program', 'management'];
function Users({ templates }) {
  const me = useUser();
  const [rows, setRows] = useState(null), [edit, setEdit] = useState(null), [qs, setQs] = useState(''), [imp, setImp] = useState(null), [openL, setOpenL] = useState({}), [openD, setOpenD] = useState({});
  // Importar usuarios (pegar desde Excel): con una sola planta se hace desde aquí
  const openImport = async () => { const s = await api('/api/sites'); setImp(s.find((x) => x.id === me.site_id) || s.find((x) => x.code === 'MPQ') || s[0]); };
  const load = () => api('/api/admin/users').then(setRows);
  useEffect(() => { load(); }, []);
  const list = (rows || []).filter((r) => (r.name + r.username).toLowerCase().includes(qs.toLowerCase()));
  return (
    <>
      <div className="row" style={{ margin: '12px 0' }}>
        <input className="inp" placeholder="Buscar…" value={qs} onChange={(e) => setQs(e.target.value)} />
        <button className="btn alt sm" onClick={openImport}>Importar</button>
        <button className="btn sm" onClick={() => setEdit({})}>+ Usuario</button>
      </div>
      {!rows ? <div className="empty">Cargando…</div> : [4, 3, 2, 1].map((L) => {
        const g = list.filter((u) => u.layer === L);
        if (!g.length) return null;
        const open = !!qs || openL[L];
        return (
          <div key={L} className="lgrp">
            <button className={`lgrp-h ${open ? 'on' : ''}`} onClick={() => setOpenL({ ...openL, [L]: !openL[L] })} aria-expanded={open}>
              <b>{LAYER[L]}{L === 3 ? ' · GM' : L === 2 ? ' · Gerentes' : ''}</b><span className="pill">{g.length}</span><i aria-hidden="true">›</i>
            </button>
            {open && DEPT_ORDER.filter((d) => g.some((u) => u.dept === d)).concat([...new Set(g.map((u) => u.dept))].filter((d) => !DEPT_ORDER.includes(d))).map((d) => {
              const gd = g.filter((u) => u.dept === d), key = `${L}-${d}`, dopen = !!qs || !!openD[key];
              return (
                <div key={d} className="ugd">
                  <button className={`ugd-h d-${d} ${dopen ? 'on' : ''}`} onClick={() => setOpenD({ ...openD, [key]: !dopen })} aria-expanded={dopen}>
                    <i className={`ugd-dot d-${d}`} /><b>{DEPT[d]}</b><span>{gd.length}</span><em aria-hidden="true">›</em>
                  </button>
                  {dopen && gd.map((u) => {
                    const ini = u.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                    return (
                      <div key={u.id} className={`card uc l${u.layer} d-${u.dept}`} style={{ opacity: u.active ? 1 : .5 }} onClick={() => setEdit(u)}>
                        <span className={`uc-av d-${u.dept}`}>{ini}</span>
                        <div className="uc-body">
                          <div className="row wrap" style={{ gap: 6 }}><b className="grow uc-name">{u.name}</b>
                            {u.access === 'master' ? <span className="pill warn">{me.multi_site ? 'Máster' : 'Admin'}</span> : u.access === 'admin' ? <span className="pill gold">Admin</span> : u.access === 'lead' ? <span className="pill">Líder</span> : null}
                            {me.multi_site && u.site && <span className="pill ok">{u.site}</span>}
                            <span className={`pill lp l${u.layer}`}>L{u.layer}</span></div>
                          <div className="sub"><span className={`dtag d-${u.dept}`}>{DEPT[u.dept]}</span> {u.template || 'sin plantilla'} · {u.username} · {u.layer >= 2 ? 'All Areas (semanal)' : `${u.days.map((x) => DAYS_SHORT[x - 1]).join('/')} · ${u.pool.length} área(s)${u.rotate_daily ? ' · rota diario' : ''}`}</div>
                        </div>
                      </div>);
                  })}
                </div>);
            })}
          </div>);
      })}
      {edit && <UserSheet u={edit} templates={templates} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      {imp && <ImportSheet site={imp} onClose={() => setImp(null)} onDone={load} />}
    </>
  );
}

function Questions({ templates, reloadTemplates }) {
  const [tid, setTid] = useState(templates[0]?.id), [qs, setQs] = useState([]), [es, setEs] = useState(''), [en, setEn] = useState(''), [edit, setEdit] = useState(null), [err, setErr] = useState(''), [hist, setHist] = useState(null);
  const t = templates.find((x) => x.id === Number(tid));
  const load = () => tid && api(`/api/admin/templates/${tid}/questions`).then(setQs);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tid]);
  const run = async (fn) => { setErr(''); try { await fn(); await load(); reloadTemplates(); } catch (e) { setErr(e.message); } };
  return (
    <>
      <label className="lbl">Plantilla</label>
      <select className="inp" value={tid} onChange={(e) => setTid(e.target.value)}>
        {templates.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.active_questions})</option>)}
      </select>
      {t && <div className="row" style={{ margin: '12px 0' }}>
        <span className="sub grow">Preguntas por auditoría (el sistema rota el banco para cubrirlo todo)</span>
        <input className="inp" style={{ width: 80 }} type="number" min="1" max="50" defaultValue={t.per_audit} key={t.id}
          onBlur={(e) => run(() => api(`/api/admin/templates/${t.id}`, { method: 'PATCH', body: { per_audit: e.target.value } }))} />
      </div>}
      <div className="bi-form">
        <input className="inp" placeholder="Nueva pregunta en español…" value={es} onChange={(e) => setEs(e.target.value)} />
        <input className="inp" placeholder="New question in English…" value={en} onChange={(e) => setEn(e.target.value)} />
        <button className="btn sm" disabled={!es.trim() || !en.trim()} onClick={() => run(async () => { await api(`/api/admin/templates/${tid}/questions`, { method: 'POST', body: { text_es: es, text_en: en } }); setEs(''); setEn(''); })}>Agregar (español + inglés)</button>
      </div>
      {err && <div className="err">{err}</div>}
      {edit && (
        <div className="sheet-bg" onClick={() => setEdit(null)}><div className="sheet" onClick={(e) => e.stopPropagation()}>
          <h2>Editar pregunta</h2>
          <label className="lbl">Español</label>
          <textarea className="inp" rows={3} value={edit.es} onChange={(e) => setEdit({ ...edit, es: e.target.value })} />
          <label className="lbl">English</label>
          <textarea className="inp" rows={3} value={edit.en} onChange={(e) => setEdit({ ...edit, en: e.target.value })} />
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn alt grow" onClick={() => setEdit(null)}>Cancelar</button>
            <button className="btn grow" disabled={!edit.es.trim()} onClick={() => run(async () => { await api(`/api/admin/questions/${edit.id}`, { method: 'PATCH', body: { text_es: edit.es, text_en: edit.en } }); setEdit(null); })}>Guardar</button>
          </div>
        </div></div>
      )}
      {hist && (
        <div className="sheet-bg" onClick={() => setHist(null)}><div className="sheet" onClick={(e) => e.stopPropagation()}>
          <h2>Historial de la pregunta</h2>
          <p className="sub">Las auditorías ya realizadas conservan el texto y el número de ítem con los que se contestaron.</p>
          {hist.loading ? <div className="empty">Cargando…</div> : <>
            <div className="card" style={{ marginBottom: 8 }}><b>Versión actual (v{hist.current?.version})</b><div style={{ fontSize: 14 }}><Bi text={hist.current?.text || ''} /></div></div>
            {!hist.versions.length && <div className="sub">Aún no se ha modificado.</div>}
            {hist.versions.map((v) => (
              <div key={v.version} className="card" style={{ marginBottom: 8 }}>
                <b>v{v.version}</b> <span className="sub" style={{ margin: 0 }}>· {v.change === 'delete' ? 'eliminada' : 'reemplazada'} por {v.changed_by_name || '—'} · {new Date(v.created_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                <div style={{ fontSize: 14 }}><Bi text={v.text} /></div>
              </div>))}
          </>}
          <button className="btn alt block" style={{ marginTop: 10 }} onClick={() => setHist(null)}>Cerrar</button>
        </div></div>
      )}
      {qs.map((q) => (
        <div key={q.id} className="card" style={{ marginBottom: 8, opacity: q.active ? 1 : .5 }}>
          {q.category && (q.required || q.category === 'Dock Audit' || q.category === 'Auditoría gerencial') && <span className="pill gold" style={{ marginBottom: 4 }}>{q.category}{q.required ? ' · fija' : ''}</span>}
          <div style={{ fontSize: 14 }}><Bi text={q.text} /></div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn-ghost" onClick={() => run(() => api(`/api/admin/questions/${q.id}`, { method: 'PATCH', body: { active: !q.active } }))}>{q.active ? 'Desactivar' : 'Activar'}</button>
            <button className="btn-ghost" title="Una pregunta fija va en todas las auditorías de esta plantilla, además de las que rotan" onClick={() => run(() => api(`/api/admin/questions/${q.id}`, { method: 'PATCH', body: { required: !q.required } }))}>{q.required ? '📌 Fija' : 'Hacer fija'}</button>
            <button className="btn-ghost" onClick={() => setEdit({ id: q.id, es: q.text_es, en: q.text_en })}>Editar</button>
            <button className="btn-ghost" onClick={async () => { setHist({ loading: true }); try { setHist(await api(`/api/admin/questions/${q.id}/history`)); } catch { setHist(null); } }}>Historial</button>
            <button className="btn-ghost" style={{ color: 'var(--nok)' }} onClick={() => { if (confirm('¿Eliminar pregunta? Es mejor desactivarla.')) run(() => api(`/api/admin/questions/${q.id}`, { method: 'DELETE' })); }}>Eliminar</button>
          </div>
        </div>))}
    </>
  );
}

const dur = (s) => s == null ? '—' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${String(s % 60).padStart(2, '0')} s` : ''}`;

const EXAMPLE = `Nombre\tDepto\tCapa\tPlantilla\tDías\tÁreas\tAcceso
Ana López\tCalidad\t1\tQuality Engineer\tLun, Mié\tLínea 1|Línea 2\t
Beto Ruiz\tProducción\t2\tProduction Manager\t\t\tlíder`;

// Archivo de datos históricos: quita las fotos de auditorías e issues con más de N días (se conservan resultados y bitácora)
function Archive() {
  const [d, setD] = useState(null), [days, setDays] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const load = () => api('/api/admin/archive').then((r) => { setD(r); setDays(String(r.days)); }).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return null;
  const call = async (body) => { setBusy(true); setMsg(''); try { const r = await api('/api/admin/archive', { method: 'PUT', body }); setD(r); setDays(String(r.days)); setMsg(body.run ? `Listo: ${r.result?.removed || 0} foto(s) archivada(s).` : 'Guardado.'); } catch (e) { setMsg(e.message); } setBusy(false); };
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <b>Archivo de fotos antiguas</b>
      <div className="sub" style={{ margin: '4px 0 8px' }}>Base de datos: {d.db_mb} MB · {d.photos} foto(s) guardadas (≈{d.photos_mb} MB). Se quitan solo las fotos; las respuestas, hallazgos, scores y la bitácora se conservan. Descarga antes un respaldo con fotos (Reportes) si las quieres guardar.</div>
      <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
        <label className="sub" style={{ margin: 0 }}>Quitar fotos con más de</label>
        <input className="inp" style={{ width: 90 }} type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} />
        <span className="sub" style={{ margin: 0 }}>días (0 = nunca)</span>
        <button className="btn alt sm" disabled={busy || String(d.days) === days} onClick={() => call({ days: Number(days) })}>Guardar</button>
      </div>
      {d.upcoming > 0 && <div className="err" style={{ margin: '8px 0' }}>⚠️ En los próximos 7 días se borrarán {d.upcoming} foto(s) más por antigüedad. Descarga antes el respaldo con fotos (Reportes → Respaldo).</div>}
      <div className="row wrap" style={{ gap: 8, marginTop: 8, alignItems: 'center' }}>
        <span className="sub" style={{ margin: 0 }}>Por archivar hoy: <b>{d.eligible}</b> foto(s) (≈{d.eligible_mb} MB){d.last ? ` · última vez ${d.last}` : ''}</span>
        <button className="btn sm" disabled={busy || !d.eligible} onClick={() => { if (confirm(`Se eliminarán ${d.eligible} foto(s) con más de ${d.days} días. No se puede deshacer. ¿Continuar?`)) call({ run: true }); }}>Archivar ahora</button>
      </div>
      {msg && <div className="sub" style={{ margin: '6px 0 0' }}>{msg}</div>}
      <div className="sub" style={{ margin: '6px 0 0' }}>Se corre solo cada madrugada. También se borran avisos con más de 90 días.</div>
    </div>
  );
}

// Registro: cambios del administrador y eliminaciones con su razón
function LogTab() {
  const [d, setD] = useState(null), [f, setF] = useState('all');
  useEffect(() => { api('/api/admin/log').then((r) => setD(r.items)).catch(() => setD([])); }, []);
  const when = (ts) => new Date(ts).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const rows = (d || []).filter((x) => f === 'all' || (f === 'del' ? x.kind !== 'cambio' : x.kind === 'cambio'));
  return (
    <>
      <Archive />
      <div className="seg" style={{ margin: '4px 0 10px' }}>{[['all', 'Todo'], ['cambio', 'Cambios'], ['del', 'Eliminaciones']].map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
      {!d ? <div className="empty">Cargando…</div> : !rows.length ? <div className="card empty">Sin registros.</div> : rows.map((x, i) => (
        <div className="card" key={i} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{x.kind === 'cambio' ? '✎' : '🗑'} {x.title}</div>
          {x.kind !== 'cambio' && x.reason && <div style={{ fontSize: 13, marginTop: 3 }}><b>Razón:</b> {x.reason}</div>}
          {x.kind === 'cambio' && x.detail && <div className="sub" style={{ margin: '3px 0 0', fontFamily: 'var(--mono, monospace)', fontSize: 11, overflowWrap: 'anywhere' }}>{x.detail}</div>}
          <div className="sub" style={{ margin: '4px 0 0' }}>{x.who || 'Sistema'} · {when(x.created_at)}</div>
        </div>))}
    </>
  );
}

function ImportSheet({ site, onClose, onDone }) {
  const [text, setText] = useState(''), [pw, setPw] = useState(''), [prev, setPrev] = useState(null);
  const [res, setRes] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  const call = async (dry) => {
    setErr(''); setBusy(true);
    try { return await api(`/api/admin/sites/${site.id}/import`, { method: 'POST', body: { text, password: pw || undefined, dry_run: dry } }); }
    catch (e) { setErr(e.message); return null; } finally { setBusy(false); }
  };
  const review = async () => { const r = await call(true); if (r) setPrev(r); };
  const run = async () => { const r = await call(false); if (r?.created) { setRes(r.created); onDone(); } };
  const copy = async () => {
    const t = ['Nombre\tUsuario\tContraseña', ...res.map((c) => `${c.name}\t${c.username}\t${c.password}`)].join('\n');
    try { await navigator.clipboard.writeText(t); setCopied(true); } catch { setErr('No se pudo copiar; selecciona la tabla manualmente.'); }
  };
  return (
    <div className="sheet-bg" onClick={res ? undefined : onClose}><div className="sheet" onClick={(e) => e.stopPropagation()}>
      <h2>Importar usuarios · {site.code}</h2>
      {res ? <>
        <p className="sub">Se crearon {res.length} usuario(s). <b>Guarda estas contraseñas ahora: no se vuelven a mostrar.</b> Cada quien debe cambiarla al entrar.</p>
        <table className="imp-table"><thead><tr><th>Nombre</th><th>Usuario</th><th>Contraseña</th></tr></thead>
          <tbody>{res.map((c) => <tr key={c.username}><td>{c.name}</td><td>{c.username}</td><td style={{ fontFamily: 'var(--mono)' }}>{c.password}</td></tr>)}</tbody></table>
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ marginTop: 16 }}><button className="btn alt grow" onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar (para Excel)'}</button><button className="btn grow" onClick={onClose}>Listo</button></div>
      </> : <>
        <p className="sub">Pega desde Excel una fila por persona, con estas columnas: <b>Nombre, Depto, Capa, Plantilla, Días, Áreas, Acceso</b>. Varias áreas se separan con <b>|</b>; Capa 2 y 3 no necesitan días ni áreas.</p>
        <details style={{ margin: '8px 0' }}><summary className="sub" style={{ cursor: 'pointer' }}>Ver ejemplo</summary>
          <pre className="imp-ta" style={{ whiteSpace: 'pre-wrap', background: '#f1f4fa', borderRadius: 12, padding: 10 }}>{EXAMPLE}</pre></details>
        <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
        <a className="btn alt sm" href={`/api/admin/export?type=assignments&date=${data.monday}`} download>⬇ Descargar plantilla de la semana (.csv)</a>
        <label className="btn alt sm" style={{ display: 'inline-block' }}>📂 Cargar archivo .csv<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={pickFile} /></label>
      </div>
      <textarea className="inp imp-ta" placeholder="Pega aquí…" value={text} onChange={(e) => { setText(e.target.value); setPrev(null); }} />
        <label className="lbl">Contraseña inicial (opcional)</label>
        <input className="inp" autoComplete="off" placeholder="Vacío = una contraseña aleatoria distinta por persona" value={pw} onChange={(e) => { setPw(e.target.value); setPrev(null); }} />
        {prev && <table className="imp-table"><tbody>{prev.rows.map((r) => (
          <tr key={r.line}><td>{r.ok ? '✓' : '✕'}</td><td>{r.name || '(sin nombre)'}</td><td className={r.ok ? '' : 'bad'}>{r.ok ? r.template : r.errors.join('; ')}</td></tr>))}</tbody></table>}
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn alt grow" onClick={onClose}>Cancelar</button>
          {prev?.ok
            ? <button className="btn grow" disabled={busy} onClick={run}>Importar {prev.count}</button>
            : <button className="btn grow" disabled={busy || !text.trim()} onClick={review}>Revisar</button>}
        </div>
      </>}
    </div></div>
  );
}

function Sites() {
  const me = useUser(), master = isMaster(me);
  const [rows, setRows] = useState(null), [imp, setImp] = useState(null), [err, setErr] = useState(''), [date, setDate] = useState({});
  const load = () => api('/api/admin/sites').then(setRows);
  useEffect(() => { load(); }, []);
  const run = async (fn) => { setErr(''); try { await fn(); await load(); } catch (e) { setErr(e.message); } };
  const patch = (s, body) => run(() => api(`/api/admin/sites/${s.id}`, { method: 'PATCH', body }));
  const verUsuarios = (s) => { setSiteCookie(s.code); window.location.reload(); };
  const Step = ({ ok, children }) => <li className={ok ? 'done' : 'pend'}><span className="dot">{ok ? '✓' : '•'}</span><span>{children}</span></li>;
  if (!rows) return <div className="empty">Cargando…</div>;
  return (
    <>
      <p className="sub" style={{ margin: '4px 0 12px' }}>Para arrancar una planta: importa sus usuarios, entrega las contraseñas y ponla en marcha. Hasta entonces no genera auditorías ni cuenta en el cumplimiento.</p>
      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
      {rows.map((s) => (
        <div key={s.id} className="card site-card">
          <div className="row"><b className="grow" style={{ fontSize: 18 }}>{s.code}</b>
            <span className={`pill ${s.active ? 'ok' : ''}`}>{s.active ? `En marcha${s.go_live ? ' desde ' + s.go_live : ''}` : 'Sin poner en marcha'}</span></div>
          {master && <><label className="lbl">Nombre de la planta</label>
          <input className="inp" defaultValue={s.name} key={s.name} onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && patch(s, { name: e.target.value })} /></>}
          <ul className="checks">
            <Step ok={s.users > 0}>{s.users > 0 ? `Usuarios cargados: ${s.users} (${s.layer1} Layer 1, ${s.managers} gerentes)` : 'Cargar los usuarios de la planta'}</Step>
            <Step ok={s.users > 0 && s.no_template === 0}>{s.no_template > 0 ? `${s.no_template} usuario(s) sin plantilla de preguntas` : 'Plantilla de preguntas asignada a todos'}</Step>
            <Step ok={s.users > 0 && s.pending_password === 0}>{s.users > 0 ? `${s.entered} de ${s.users} ya entraron y cambiaron su contraseña` : 'Entregar contraseñas'}</Step>
            <Step ok={s.active}>{s.active ? 'Planta en marcha' : 'Poner la planta en marcha'}</Step>
          </ul>
          <div className="row wrap">
            <button className="btn sm" onClick={() => setImp(s)}>Importar usuarios</button>
            <button className="btn alt sm" onClick={() => verUsuarios(s)}>Ver usuarios</button>
            <a className="btn alt sm" href={`/tv?site=${s.code}`} target="_blank" rel="noreferrer">Pantalla TV</a>
          </div>
          {master ? <div className="row wrap" style={{ marginTop: 12 }}>
            {s.active
              ? <button className="btn alt sm" onClick={() => confirm(`¿Pausar ${s.code}? Dejará de generar auditorías nuevas.`) && patch(s, { active: false })}>Pausar planta</button>
              : <><span className="sub">Arranca el</span>
                  <input className="inp" type="date" style={{ width: 170 }} value={date[s.id] || todayStr()} onChange={(e) => setDate({ ...date, [s.id]: e.target.value })} />
                  <button className="btn sm" onClick={() => patch(s, { active: true, go_live: date[s.id] || todayStr() })}>Poner en marcha</button></>}
          </div> : !s.active && <div className="sub" style={{ marginTop: 12 }}>La planta la pone en marcha el máster.</div>}
        </div>))}
      {imp && <ImportSheet site={imp} onClose={() => setImp(null)} onDone={load} />}
    </>
  );
}

const shiftDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const DAY_IDX = { lun: 0, lunes: 0, mar: 1, martes: 1, mie: 2, miercoles: 2, jue: 3, jueves: 3, vie: 4, viernes: 4 };

// Convierte las filas pegadas (Nombre | Día | Zona) en cambios sobre las auditorías de la semana.
function parseAssignments(text, audits, days) {
  const byName = {};
  audits.forEach((a) => { (byName[norm(a.name)] ||= []).push(a); });
  const names = Object.keys(byName);
  const changes = {}, problems = [];
  let rows = 0;
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    const c = raw.split(raw.includes('\t') ? '\t' : ';').map((x) => x.trim());
    if (i === 0 && /^(nombre|persona)/.test(norm(c[0]))) return;
    const [name, day, zone, part] = c;
    // Tabla completa de Excel: Nombre + Lun..Vie (una zona o máquina por día)
    const oldFmt = c.length <= 4 && (!norm(day) || ['todos', 'todo', 'semana'].includes(norm(day)) || DAY_IDX[norm(day)] !== undefined || /^[1-5]$/.test(norm(day)));
    if (!oldFmt && c.length >= 6) {
      let k0 = norm(name);
      if (!byName[k0]) { const hit = names.filter((n) => n.includes(k0) || k0.includes(n)); if (k0 && hit.length === 1) k0 = hit[0]; else return problems.push(`Línea ${i + 1}: ${hit.length > 1 ? 'nombre ambiguo' : 'no encontré a'} "${name || ''}"`); }
      const pairs = false; let any = false;
      for (let k = 0; k < 5; k++) {
        const z = pairs ? c[1 + 2 * k] : c[1 + k], pn = pairs ? c[2 + 2 * k] : '';
        if (!z && !pn) continue;
        const au = byName[k0].find((x) => x.date === days[k] && x.status === 'pending' && x.layer < 2);
        if (!au) continue;
        changes[au.id] = { ...(changes[au.id] || {}), ...(z ? { area: z } : {}) }; any = true;
      }
      if (!any) return problems.push(`Línea ${i + 1}: ${name} no tiene días pendientes que cargar`);
      rows++; return;
    }
    let key = norm(name);
    if (!byName[key]) {
      const hit = names.filter((n) => n.includes(key) || key.includes(n));
      if (key && hit.length === 1) key = hit[0];
      else return problems.push(`Línea ${i + 1}: ${hit.length > 1 ? 'nombre ambiguo' : 'no encontré a'} "${name || ''}"`);
    }
    const d = norm(day);
    let list = byName[key];
    if (d && d !== 'todos' && d !== 'todo' && d !== 'semana') {
      const k = DAY_IDX[d] ?? (/^[1-5]$/.test(d) ? Number(d) - 1 : -1);
      if (k < 0) return problems.push(`Línea ${i + 1}: día "${day}" no válido`);
      list = list.filter((a) => a.date === days[k] || a.date !== a.due_date);
      if (!list.length) return problems.push(`Línea ${i + 1}: ${name} no tiene auditoría ese día`);
    }
    const pend = list.filter((a) => a.status === 'pending' && a.layer < 3);
    if (!pend.length) return problems.push(`Línea ${i + 1}: ${name} no tiene auditorías pendientes ahí`);
    pend.forEach((a) => { changes[a.id] = { ...(changes[a.id] || {}), ...(zone ? { area: zone } : {}) }; });
    rows++;
  });
  return { changes, problems, rows };
}

function PasteSheet({ data, onApply, onClose }) {
  const [text, setText] = useState(''), [res, setRes] = useState(null);
  const run = () => setRes(parseAssignments(text, data.audits, data.days));
  // Archivo .csv (o .txt) guardado desde Excel: se convierte a columnas separadas por tabulador
  const csvToTabs = (raw) => raw.replace(/^\ufeff/, '').split(/\r?\n/).map((line) => {
    if (line.includes('\t')) return line;
    const sep = line.includes(';') && !line.includes(',') ? ';' : ',';
    const out = []; let cur = '', q = false;
    for (const ch of line) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); return out.join('\t');
  }).join('\n');
  const pickFile = async (e) => { const f = e.target.files?.[0]; if (!f) return; setText(csvToTabs(await f.text())); setRes(null); e.target.value = ''; };
  return (
    <div className="sheet-bg" onClick={onClose}><div className="sheet" onClick={(e) => e.stopPropagation()}>
      <h2>Pegar desde Excel</h2>
      <p className="sub">Puedes pegar <b>la tabla de la semana tal cual</b> desde Excel: <b>Nombre, Lun, Mar, Mié, Jue, Vie</b> (la zona o máquina de cada día). También sirve una fila por persona y día: <b>Nombre, Día, Zona</b>. Si dejas el Día vacío (o pones "Todos") aplica a todos sus días de esta semana. Los cambios se cargan en la tabla y no se guardan hasta que pulses Guardar.</p>
      <details style={{ margin: '8px 0' }}><summary className="sub" style={{ cursor: 'pointer' }}>Ver ejemplo</summary>
        <pre className="imp-ta" style={{ whiteSpace: 'pre-wrap', background: '#f1f4fa', borderRadius: 12, padding: 10 }}>{'Ana López\tLínea 1\tLínea 1\tLínea 2\tLínea 2\tLínea 3\nBeto Ruiz\t\tB1-4\t\t\t'}</pre></details>
      <textarea className="inp imp-ta" placeholder="Pega aquí…" value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} />
      {res && <div className={res.problems.length ? 'err' : 'card'} style={{ marginTop: 12 }}>
        <b>{res.rows} fila(s) listas para aplicar.</b>
        {res.problems.map((p) => <div key={p} className="sub" style={{ color: 'inherit' }}>{p}</div>)}</div>}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn alt grow" onClick={onClose}>Cancelar</button>
        {res && res.rows > 0
          ? <button className="btn grow" onClick={() => onApply(res.changes)}>Cargar en la tabla</button>
          : <button className="btn grow" disabled={!text.trim()} onClick={run}>Revisar</button>}
      </div>
    </div></div>
  );
}

// Asignaciones: por persona y por día, la zona o máquina a inspeccionar (el N/P lo captura el auditor).
// El auditor no elige nada: lo que aquí se carga es lo que ve en "Hoy".
// Zona (A1…PL4) a partir del texto asignado ("B2", "B2 · B2-1" o textos antiguos como "ZONA C")
const zoneOf = (area) => { const z = String(area || '').split(' · ')[0].trim().toUpperCase(); return ZONES.includes(z) ? z : ''; };
const toneOf = (area) => {
  const z = zoneOf(area); if (z) return z.startsWith('PL') ? 'pl' : z[0].toLowerCase();
  const m = /^ZONA ([A-E])\b/i.exec(String(area || '').trim()); // zona completa: "ZONA A" … "ZONA E"
  return m ? m[1].toLowerCase() : (area ? 'x' : '');
};
const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function Assign() {
  const me = useUser();
  const [date, setDate] = useState(null), [data, setData] = useState(null), [edits, setEdits] = useState({});
  const [qs, setQs] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [paste, setPaste] = useState(false), [mv, setMv] = useState(null), [pick, setPick] = useState(null), [otro, setOtro] = useState('');
  const dirty = Object.keys(edits).length;

  const load = (d) => { setData(null); return api(`/api/admin/assignments${d ? `?date=${d}` : ''}`).then((r) => { setData(r); setDate(r.monday); }).catch((e) => setMsg(e.message)); };
  useEffect(() => { load(); }, []);
  const go = (n) => {
    if (dirty && !confirm('Tienes cambios sin guardar. ¿Cambiar de semana y descartarlos?')) return;
    setEdits({}); setMsg(''); load(shiftDay(data.monday, n * 7));
  };

  const val = (a) => ({ area: a.area, ...(edits[a.id] || {}) });
  const set = (a, k, v) => setEdits((e) => {
    const next = { ...(e[a.id] || {}), [k]: v };
    const same = (next.area ?? a.area) === a.area;
    const { [a.id]: _drop, ...rest } = e;
    return same ? rest : { ...rest, [a.id]: next };
  });
  // Copia lo capturado en el primer día pendiente de la persona a todos sus demás días pendientes
  const fillWeek = (list) => {
    const pend = list.filter((a) => a.status === 'pending');
    if (pend.length < 2) return;
    const { area } = val(pend[0]);
    pend.slice(1).forEach((a) => { set(a, 'area', area); });
  };
  async function save() {
    setBusy(true); setMsg('');
    try {
      const items = Object.entries(edits).map(([id, v]) => ({ id: Number(id), ...val(data.audits.find((a) => a.id === Number(id))) , ...v }));
      const r = await api('/api/admin/assignments', { method: 'PUT', body: { items } });
      setEdits({}); await load(date);
      setMsg(`Guardado: ${r.saved} asignación(es)${r.skipped ? ` · ${r.skipped} ya no se pudieron cambiar` : ''}`);
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  const asg = { total: 0, done: 0 };
  (data?.audits || []).filter((a) => a.status === 'pending').forEach((a) => { const v = val(a); asg.total++; if (v.area) asg.done++; });
  const people = [];
  (data?.audits || []).forEach((a) => {
    if (qs && !a.name.toLowerCase().includes(qs.toLowerCase())) return;
    let p = people[people.length - 1];
    if (!p || p.id !== a.user_id) { p = { id: a.user_id, a, list: [] }; people.push(p); }
    p.list.push(a);
  });

  return (
    <>
      <p className="sub" style={{ margin: '4px 0 12px' }}>Asigna a cada auditor de Layer 1 la <b>zona</b> que auditará cada día. La máquina y el <b>número de parte</b> los captura el auditor al realizar su auditoría. El <b>número de parte</b> lo captura el auditor al realizar su auditoría. Layer 2, 3 y 4 auditan todas las áreas y eligen el área durante la auditoría. La zona se sugiere según la rotación y puedes cambiarla.</p>
      <div className="row wrap" style={{ margin: '10px 0' }}>
        <button className="btn alt sm" onClick={() => go(-1)} disabled={!data}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>{data ? `${fmtDate(data.days[0], { day: 'numeric', month: 'short' })} – ${fmtDate(data.days[4], { day: 'numeric', month: 'short', year: 'numeric' })}` : '…'}</div>
        <button className="btn alt sm" onClick={() => go(1)} disabled={!data}>›</button>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="inp" placeholder="Buscar persona…" value={qs} onChange={(e) => setQs(e.target.value)} />
        <button className="btn alt sm" disabled={!data} onClick={() => setPaste(true)}>⬇ Importar desde Excel</button>
      </div>
      {data && <div className={`asg-count ${asg.total - asg.done > 0 ? 'warn' : 'ok'}`}><b>{asg.total - asg.done > 0 ? '!' : '✓'}</b><span><b>{asg.done} de {asg.total} asignadas</b><small>(zona){asg.total - asg.done > 0 ? ` · faltan ${asg.total - asg.done}` : ''}</small></span></div>}
      {msg && <div className={msg.startsWith('Guardado') ? 'card' : 'err'} style={{ marginBottom: 12 }}>{msg}</div>}
      {!data ? <div className="empty">Cargando…</div> : !people.length ? <div className="empty">Sin auditorías esta semana{qs ? ' con ese filtro' : ''}. Revisa que la planta esté en marcha.</div> : (
        <>
          <div className="asg-mx-wrap"><table className="asg-mx asg2">
            <thead><tr><th>Persona</th><th className="dcol">Departamento</th>{data.days.map((d, k) => <th key={d} className={d === data.today ? 'today' : ''}>{DAYS_SHORT[k]} {Number(d.slice(8))}</th>)}</tr></thead>
            <tbody>{people.map(({ id, a, list }) => (
              <tr key={id}>
                <th className="asg-who"><div className="aw"><span className={`uc-av d-${a.dept}`}>{initials(a.name)}</span><div><b>{a.name}</b><span className="sub">{DEPT[a.dept]}</span></div></div></th>
                <td className="dcol dtxt">{DEPT[a.dept]}</td>
                {data.days.map((d) => {
                  const x = list.find((y) => y.date === d);
                  if (!x) return <td key={d} className="off" />;
                  const v = val(x);
                  if (x.status === 'completed') return <td key={d} className="doneC">✓ {x.area}{x.part_number ? <small>N/P {x.part_number}</small> : null}</td>;
                  return (
                    <td key={d}>
                      <button type="button" className={`acell t-${toneOf(v.area) || 'none'} ${edits[x.id] ? 'edited' : ''}`} onClick={() => { setOtro(''); setPick({ x, list, step: 'zone', zone: zoneOf(v.area) }); }}>
                        <span>{v.area || '—'}</span><i aria-hidden="true">▾</i>
                      </button>
                    </td>);
                })}
              </tr>))}</tbody>
          </table></div>
          <div className="asg-legend">
            {[['a', 'A1 · A2'], ['b', 'B1 · B2'], ['c', 'C1 · C2 · C3'], ['d', 'D1 · D2'], ['e', 'E2'], ['pl', 'PL1 · PL3 · PL4'], ['none', 'Sin asignación']].map(([t, l]) => <span key={t}><i className={`lg t-${t}`} />{l}</span>)}
          </div>
          {pick && (() => {
            const { x, list } = pick, cur = val(x).area || '';
            const apply = (area) => { set(x, 'area', area); setPick(null); };
            return (
              <div className="sheet-bg" onClick={() => setPick(null)}><div className="sheet" onClick={(e) => e.stopPropagation()}>
                <div className="apick-h">
                  <div className="grow"><h2>Zona</h2>
                    <div className="sub" style={{ margin: 0 }}>{x.name} · {fmtDate(x.date, { weekday: 'long', day: 'numeric', month: 'short' })}</div></div>
                </div>
                <>
                  <div className="apick-sub">Zona completa (cualquier área de la zona)</div>
                  <div className="apick-big">{['A', 'B', 'C', 'D', 'E'].map((L) => <button key={L} type="button" className={`apz t-${L.toLowerCase()} ${cur === `ZONA ${L}` ? 'on' : ''}`} onClick={() => apply(`ZONA ${L}`)}>{L}</button>)}</div>
                  <div className="apick-sub">O una zona específica</div>
                  <div className="apick-z">{ZONES.map((zz) => (
                    <button key={zz} type="button" className={`apz t-${zz.startsWith('PL') ? 'pl' : zz[0].toLowerCase()} ${zz === cur || cur.startsWith(`${zz} · `) ? 'on' : ''}`}
                      onClick={() => apply(zz)}>{zz}</button>))}</div>
                </>
                <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
                  <button type="button" className="btn alt sm" onClick={() => { setPick(null); setMv({ x, list }); }}>📅 Cambiar de día</button>
                  {cur && <button type="button" className="btn-ghost" onClick={() => apply('')}>Quitar asignación</button>}
                  <span className="grow" />
                  <button type="button" className="btn alt sm" onClick={() => setPick(null)}>Cerrar</button>
                </div>
              </div></div>);
          })()}
          {mv && <div className="sheet-bg" onClick={() => setMv(null)}><div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Cambiar día de auditoría</h2>
            <p className="sub">{mv.x.name} · hoy está en <b>{fmtDate(mv.x.date, { weekday: 'long', day: 'numeric', month: 'short' })}</b>. Elige el nuevo día de esta semana; el día original ya no se le vuelve a asignar.</p>
            <div className="zchips">{data.days.map((d, k) => {
              const taken = mv.list.some((y) => y.date === d), past = d < data.today, same = d === mv.x.date;
              return <button key={d} type="button" className={`zchip ${same ? 'on' : ''}`} disabled={taken && !same || past}
                onClick={async () => { if (same) return setMv(null); try { await api(`/api/audits/${mv.x.id}`, { method: 'PATCH', body: { date: d } }); setMv(null); setMsg('Guardado: día cambiado'); await load(date); } catch (e) { setMsg(e.message); setMv(null); } }}>{DAYS_SHORT[k]} {Number(d.slice(8))}</button>; })}</div>
            <div className="sub" style={{ marginTop: 8 }}>Los días ocupados o que ya pasaron no se pueden elegir.</div>
            <button className="btn alt block" style={{ marginTop: 12 }} onClick={() => setMv(null)}>Cancelar</button>
          </div></div>}
          {paste && <PasteSheet data={data} onClose={() => setPaste(false)} onApply={(ch) => {
            setEdits((e) => { const n = { ...e }; Object.entries(ch).forEach(([id, v]) => { const a = data.audits.find((x) => x.id === Number(id)); const m = { ...(n[id] || {}), ...v };
              const same = (m.area ?? a.area) === a.area; if (same) delete n[id]; else n[id] = m; }); return n; });
            setPaste(false); setMsg('');
          }} />}
          <div className="asg-bar">
            <span className="sub grow">{dirty ? `${dirty} cambio(s) sin guardar` : '✓ Todo guardado'}</span>
            {dirty > 0 && <button className="btn alt sm" onClick={() => { setEdits({}); setMsg(''); }}>Descartar</button>}
            <button className="btn sm" disabled={!dirty || busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        </>)}
    </>
  );
}

// Seguimiento de las auditorías de proceso de los QEs (etapa de pruebas)
function QEs() {
  const [data, setData] = useState(null), [err, setErr] = useState(''), [saving, setSaving] = useState(false), [filter, setFilter] = useState('all'), [openId, setOpenId] = useState(null);
  const setPer = async (n) => { setSaving(true); try { await api('/api/admin/qes', { method: 'PUT', body: { per_day: n } }); load(data.monday); } catch (e) { setErr(e.message); } finally { setSaving(false); } };
  const load = (d) => { const c = !d ? peek('/api/admin/qes') : null; if (c) setData(c); else setData(null); api(`/api/admin/qes${d ? `?date=${d}` : ''}`).then(setData).catch((e) => setErr(e.message)); };
  useEffect(() => { load(); }, []);
  if (err) return <div className="err">{err}</div>;
  const t = data?.totals || {};
  const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
  const ic = (d) => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
  const chev = <svg className="qx-ch" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;
  const rows = (data?.rows || []).filter((r) => filter === 'missed' ? r.missed > 0 : filter === 'done' ? r.done > 0 : true);
  // Estado de cada día de una persona: ok (todas hechas), part (algunas), bad (no realizada), off (pendiente)
  const dayState = (r, d) => {
    const its = r.items.filter((x) => x.date === d);
    if (!its.length) return null;
    const dn = its.filter((x) => x.status === 'completed').length;
    if (dn === its.length) return { k: 'ok', f: 100, dn, n: its.length };
    const late = its.some((x) => x.status !== 'completed' && x.due < data.today);
    return { k: late ? 'bad' : dn ? 'part' : 'off', f: Math.round((dn / its.length) * 100) || (late ? 40 : 0), dn, n: its.length };
  };
  const icon = (k) => k === 'ok' ? <path d="m7.5 12.5 3 3 6-6.5" /> : k === 'bad' ? <path d="m8 8 8 8M16 8l-8 8" /> : k === 'part' ? <path d="M8 12h8M12 8v8" /> : <path d="M8 12h8" />;
  return (
    <>
      <div className="qx-card qx-per">
        <i className="qx-bar" /><div className="grow"><span>Auditorías de proceso</span><b>por QE al día</b></div>
        <button className="qx-pm" disabled={saving || !data || data.per_day <= 0} onClick={() => setPer(data.per_day - 1)} aria-label="Menos">−</button>
        <b className="qx-n">{data ? data.per_day : '…'}</b>
        <button className="qx-pm plus" disabled={saving || !data || data.per_day >= 5} onClick={() => setPer(data.per_day + 1)} aria-label="Más">+</button>
      </div>
      {data && <div className="qx-card qx-per" style={{ marginBottom: 12 }}>
        <i className="qx-bar" style={{ background: data.lpa_on ? '#22b36a' : '#98a3bb' }} /><div className="grow"><span>LPA de los QEs</span><b>{data.lpa_on ? 'Encendida' : 'Apagada · solo proceso'}</b></div>
        <button className={`btn sm ${data.lpa_on ? 'alt' : ''}`} disabled={saving} onClick={async () => { setSaving(true); try { await api('/api/admin/qes', { method: 'PUT', body: { lpa_on: !data.lpa_on } }); load(data.monday); } catch (e) { setErr(e.message); } finally { setSaving(false); } }}>{data.lpa_on ? 'Apagar' : 'Encender'}</button>
      </div>}
      <div className="row wrap" style={{ margin: '4px 0 10px' }}>
        <button className="btn alt sm" onClick={() => load(shiftDay(data.monday, -7))} disabled={!data}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>{data?.days?.length ? `${fmtDate(data.days[0], { day: 'numeric', month: 'short' })} – ${fmtDate(data.days[4], { day: 'numeric', month: 'short', year: 'numeric' })}` : '…'}</div>
        <button className="btn alt sm" onClick={() => load(shiftDay(data.monday, 7))} disabled={!data}>›</button>
      </div>
      {!data ? <div className="empty">Cargando…</div> : <>
        <div className="qx-kpis">
          <button className={`qx-card qx-k ${filter === 'done' ? 'sel' : ''}`} onClick={() => setFilter(filter === 'done' ? 'all' : 'done')}><i className="b">{ic(<><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" /></>)}</i><div><b>{t.done}/{t.total}</b><span>Hechas / programadas</span></div>{chev}</button>
          <div className="qx-card qx-k"><i className="g">{ic(<path d="M6 20v-7M12 20V6M18 20v-11" />)}</i><div><b>{pct}%</b><span>Avance</span></div>
            <svg className="qx-ring" width="68" height="68" viewBox="0 0 68 68" aria-hidden="true"><circle cx="34" cy="34" r="28" fill="none" stroke="rgba(120,140,180,.2)" strokeWidth="6" /><circle cx="34" cy="34" r="28" fill="none" stroke="#22b36a" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 175.9} 175.9`} transform="rotate(-90 34 34)" /><text x="34" y="38" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">{pct}%</text></svg></div>
          <a href="/findings" className="qx-card qx-k"><i className="r">{ic(<><path d="M12 3.5 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.2v.1" /></>)}</i><div><b>{t.findings}</b><span>Hallazgos</span></div>{chev}</a>
          <button className={`qx-card qx-k ${filter === 'missed' ? 'sel' : ''}`} onClick={() => setFilter(filter === 'missed' ? 'all' : 'missed')}><i className="n">{ic(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>)}</i><div><b>{t.missed}</b><span>No realizadas</span></div>{chev}</button>
        </div>
        {filter !== 'all' && <div className="sub" style={{ margin: '0 0 8px' }}>Mostrando solo {filter === 'missed' ? 'quienes tienen no realizadas' : 'quienes ya hicieron alguna'} · <button className="linkbtn" onClick={() => setFilter('all')}>ver todos</button></div>}
        {!rows.length ? <div className="card empty">{data.rows.length ? 'Nadie con ese filtro.' : 'No hay QEs activos.'}</div> : rows.map((r) => (
          <div key={r.id} className="qx-card qx-p">
            <button className="qx-ph" onClick={() => setOpenId(openId === r.id ? null : r.id)} aria-expanded={openId === r.id}>
              <b className="grow">{r.name}</b><span className={`pill ${r.done === r.total && r.total ? 'ok' : r.missed ? 'nok' : 'gold'}`}>{r.done}/{r.total}</span>
              <svg className={`qx-ch ${openId === r.id ? 'on' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </button>
            <div className="sub">{r.avg_score != null ? `Promedio ${r.avg_score}%` : 'Sin completadas'} · {r.findings} hallazgo(s){r.avg_sec != null ? ` · ${dur(r.avg_sec)} promedio` : ''}{r.missed ? ` · ${r.missed} no realizada(s)` : ''}</div>
            <div className="qx-days">{data.days.map((d, i) => {
              const its = r.items.filter((x) => x.date === d).sort((x, y) => x.slot - y.slot);
              const lbl = (x) => (its.length === 2 ? (x.slot === 1 ? 'Mañana' : 'Tarde') : `P${x.slot}`);
              const st = (x) => (x.status === 'completed' ? 'ok' : x.due < data.today ? 'bad' : 'off');
              return (
                <div key={d} className="qx-dc"><small className={d === data.today ? 'today' : ''}>{DAYS_SHORT[i]}</small>
                  {its.length ? <div className="qx-split">{its.map((x) => (
                    <a key={x.slot} href={`/audit/${x.id}`} className={`qx-h ${st(x)}`} title={x.status === 'completed' ? `${x.area} · ${Math.round(x.score)}%` : st(x) === 'bad' ? 'no realizada' : 'pendiente'}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="currentColor" stroke="none" />{icon(st(x))}</svg>
                      <em>{lbl(x)}</em>
                    </a>))}</div> : <div className="qx-d none">—</div>}
                </div>); })}</div>
            {openId === r.id && <div className="qx-det">{r.items.filter((x) => x.status === 'completed').length ? r.items.filter((x) => x.status === 'completed').map((x) => (
              <div key={`${x.date}-${x.slot}`} className="qx-dr"><b>{fmtDate(x.date, { weekday: 'short', day: 'numeric' })} · P{x.slot}</b><span>{x.area}</span><em className={x.score >= 90 ? 'ok' : x.score >= 75 ? 'warn' : 'nok'}>{Math.round(x.score)}%</em></div>)) : <div className="sub" style={{ margin: 0 }}>Aún no hay auditorías completadas esta semana.</div>}</div>}
          </div>))}
      </>}
    </>
  );
}

function Inner() {
  const me = useUser(), master = isMaster(me);
  const [tab, setTab] = useState('assign'), [templates, setTemplates] = useState(null);
  const loadT = () => api('/api/admin/templates').then(setTemplates);
  useEffect(() => { loadT(); }, []);
  return (
    <>
      <h1 className="title">Administración</h1>
      <div className="seg" style={{ margin: '12px 0' }}>
        <button className={tab === 'assign' ? 'on' : ''} onClick={() => setTab('assign')}>Asignaciones</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Usuarios y rotación</button>
        {(master || !me.multi_site) && <button className={tab === 'q' ? 'on' : ''} onClick={() => setTab('q')}>Preguntas</button>}
        <button className={tab === 'qes' ? 'on' : ''} onClick={() => setTab('qes')}>QEs</button>
        <a className="seg-link" href="/reports">Reportes</a>
        <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>Registro</button>
        {me.multi_site && <button className={tab === 'sites' ? 'on' : ''} onClick={() => setTab('sites')}>{master ? 'Plantas' : 'Mi planta'}</button>}
      </div>
      {!templates ? <div className="empty">Cargando…</div> : tab === 'qes' ? <QEs /> : tab === 'log' ? <LogTab /> : tab === 'sites' ? <Sites /> : tab === 'assign' ? <Assign /> : tab === 'users' ? <Users templates={templates} /> : <Questions templates={templates} reloadTemplates={loadT} />}
    </>
  );
}
export default function Admin() { return <Shell need="admin"><Inner /></Shell>; }
