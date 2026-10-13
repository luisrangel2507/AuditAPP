'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Bi from '@/components/Bi';
import { api, DEPT, LAYER, DAYS_SHORT, fmtDate, getSiteCookie, setSiteCookie, todayStr } from '@/lib/client';

function UserSheet({ u, templates, onClose, onSaved }) {
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
      else await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { ...body, ...(pin ? { reset_password: pin } : {}) } });
      onSaved();
    } catch (e) { setErr(e.message); }
  }
  return (
    <div className="sheet-bg" onClick={onClose}><div className="sheet" onClick={(e) => e.stopPropagation()}>
      <h2>{isNew ? 'Nuevo usuario' : f.name}</h2>
      <label className="lbl">Nombre</label><input className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} />
      {isNew && <><label className="lbl">Usuario</label><input className="inp" autoCapitalize="none" value={f.username} onChange={(e) => set('username', e.target.value)} /></>}
      <label className="lbl">Planta</label>
      <select className="inp" value={f.site_id || ''} onChange={(e) => set('site_id', e.target.value ? Number(e.target.value) : null)}>
        <option value="">—</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select>
      <div className="row wrap">
        <div className="grow"><label className="lbl">Departamento</label>
          <select className="inp" value={f.dept} onChange={(e) => set('dept', e.target.value)}>{Object.entries(DEPT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="grow"><label className="lbl">Capa</label>
          <select className="inp" value={f.layer} onChange={(e) => set('layer', e.target.value)}>{[1, 2, 3].map((n) => <option key={n} value={n}>{LAYER[n]}</option>)}</select></div>
      </div>
      <div className="row wrap">
        <div className="grow"><label className="lbl">Acceso</label>
          <select className="inp" value={f.access} onChange={(e) => set('access', e.target.value)}>
            <option value="auditor">Auditor</option><option value="lead">Líder (igual que auditor)</option><option value="admin">Admin</option></select></div>
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
      <label className="lbl">{isNew ? 'Contraseña inicial (mín. 8 caracteres)' : 'Nueva contraseña (opcional, mín. 8 caracteres)'}</label>
      <input className="inp" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />
      {!isNew && <label className="row" style={{ marginTop: 14 }}><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> Activo</label>}
      {err && <div className="err">{err}</div>}
      <div className="row" style={{ marginTop: 16 }}><button className="btn alt grow" onClick={onClose}>Cancelar</button><button className="btn grow" onClick={save}>Guardar</button></div>
    </div></div>
  );
}

function Users({ templates }) {
  const [rows, setRows] = useState(null), [edit, setEdit] = useState(null), [qs, setQs] = useState('');
  const load = () => api('/api/admin/users').then(setRows);
  useEffect(() => { load(); }, []);
  const list = (rows || []).filter((r) => (r.name + r.username).toLowerCase().includes(qs.toLowerCase()));
  return (
    <>
      <div className="row" style={{ margin: '12px 0' }}>
        <input className="inp" placeholder="Buscar…" value={qs} onChange={(e) => setQs(e.target.value)} />
        <button className="btn sm" onClick={() => setEdit({})}>+ Usuario</button>
      </div>
      {!rows ? <div className="empty">Cargando…</div> : list.map((u) => (
        <div key={u.id} className="card" style={{ marginBottom: 8, opacity: u.active ? 1 : .5 }} onClick={() => setEdit(u)}>
          <div className="row"><b className="grow">{u.name}</b>{u.site && <span className="pill ok">{u.site}</span>}<span className="pill gold">{LAYER[u.layer]}</span><span className="pill">{DEPT[u.dept]}</span></div>
          <div className="sub">{u.username} · {u.template || 'sin plantilla'} · {u.layer >= 2 ? 'All Areas (semanal)' : `${u.days.map((d) => DAYS_SHORT[d - 1]).join('/')} · ${u.pool.length} área(s)${u.rotate_daily ? ' · rota diario' : ''}`}</div>
        </div>))}
      {edit && <UserSheet u={edit} templates={templates} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </>
  );
}

function Questions({ templates, reloadTemplates }) {
  const [tid, setTid] = useState(templates[0]?.id), [qs, setQs] = useState([]), [es, setEs] = useState(''), [en, setEn] = useState(''), [edit, setEdit] = useState(null), [err, setErr] = useState('');
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
      {qs.map((q) => (
        <div key={q.id} className="card" style={{ marginBottom: 8, opacity: q.active ? 1 : .5 }}>
          <div style={{ fontSize: 14 }}><Bi text={q.text} /></div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn-ghost" onClick={() => run(() => api(`/api/admin/questions/${q.id}`, { method: 'PATCH', body: { active: !q.active } }))}>{q.active ? 'Desactivar' : 'Activar'}</button>
            <button className="btn-ghost" onClick={() => setEdit({ id: q.id, es: q.text_es, en: q.text_en })}>Editar</button>
            <button className="btn-ghost" style={{ color: 'var(--nok)' }} onClick={() => { if (confirm('¿Eliminar pregunta? Es mejor desactivarla.')) run(() => api(`/api/admin/questions/${q.id}`, { method: 'DELETE' })); }}>Eliminar</button>
          </div>
        </div>))}
    </>
  );
}

const dur = (s) => s == null ? '—' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${String(s % 60).padStart(2, '0')} s` : ''}`;

function Stats() {
  const [days, setDays] = useState(28), [d, setD] = useState(null), [err, setErr] = useState(''), [all, setAll] = useState(false);
  useEffect(() => { setD(null); api(`/api/admin/stats?days=${days}`).then(setD).catch((e) => setErr(e.message)); }, [days]);
  const max = d ? Math.max(1, ...d.hours) : 1;
  return (
    <>
      <div className="seg" style={{ margin: '12px 0' }}>
        {[[7, '7 días'], [28, '4 semanas'], [90, '3 meses']].map(([n, l]) => <button key={n} className={days === n ? 'on' : ''} onClick={() => setDays(n)}>{l}</button>)}
      </div>
      {err && <div className="err">{err}</div>}
      {!d ? <div className="empty">Cargando…</div> : d.total === 0 ? <div className="card empty">Aún no hay auditorías completadas en este periodo.</div> : (
        <>
          <div className="kpis">
            <div className="kpi"><div className="v">{dur(d.kpi.median_sec)}</div><div className="l">Duración típica (mediana)</div></div>
            <div className="kpi"><div className="v">{d.kpi.usual_time || '—'}</div><div className="l">Hora típica de registro</div></div>
            <div className="kpi"><div className="v" style={{ color: d.kpi.fast ? 'var(--nok)' : undefined }}>{d.kpi.fast}</div><div className="l">Muy rápidas (&lt; 5 s por pregunta)</div></div>
            <div className="kpi"><div className="v">{d.total}</div><div className="l">Auditorías completadas</div></div>
          </div>
          <div className="sect">¿A qué hora se hacen?</div>
          <div className="card">
            <div className="st-bars">{d.hours.map((n, h) => <i key={h} title={`${h}:00 · ${n}`} style={{ height: `${(n / max) * 100}%`, opacity: n ? 1 : .15 }} />)}</div>
            <div className="st-axis"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
          </div>
          <div className="sect">Por auditor</div>
          {d.users.map((u) => (
            <div key={u.user_id} className="card" style={{ marginBottom: 8 }}>
              <div className="st-row">
                <b>{u.name}</b><span className="sub" style={{ margin: 0 }}>{u.n} audit.</span>
                {u.fast > 0 ? <span className="pill nok">{u.fast} muy rápida(s)</span> : <span />}
              </div>
              <div className="sub">Promedio {dur(u.avg_sec)} · hora típica {u.usual_time} (de {u.earliest} a {u.latest}){u.late ? ` · ${u.late} tarde` : ''}</div>
            </div>))}
          <div className="sect">Detalle reciente</div>
          {(all ? d.audits : d.audits.slice(0, 15)).map((a) => (
            <div key={a.id} className="card" style={{ marginBottom: 8 }}>
              <div className="st-row">
                <b>{a.name}</b>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{a.done_time}</span>
                <span className={`pill ${a.fast ? 'nok' : ''}`}>{dur(a.active_sec)}</span>
              </div>
              <div className="sub">{a.area} · {String(a.date).slice(5)} · {a.qn} preg.{a.start_time ? ` · inició ${a.start_time}` : ''}{a.fast ? ' · muy rápida' : ''}</div>
            </div>))}
          {d.audits.length > 15 && !all && <button className="btn alt block" onClick={() => setAll(true)}>Ver todas ({d.audits.length})</button>}
          <div className="sub" style={{ marginTop: 10 }}>Duración = tiempo activo con la pantalla abierta (se descuentan pausas de más de 60 s). Las auditorías anteriores a esta función no tienen duración.</div>
        </>
      )}
    </>
  );
}

const EXAMPLE = `Nombre\tDepto\tCapa\tPlantilla\tDías\tÁreas\tAcceso
Ana López\tCalidad\t1\tQuality Engineer\tLun, Mié\tLínea 1|Línea 2\t
Beto Ruiz\tProducción\t2\tProduction Manager\t\t\tlíder`;

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
          <label className="lbl">Nombre de la planta</label>
          <input className="inp" defaultValue={s.name} key={s.name} onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && patch(s, { name: e.target.value })} />
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
          <div className="row wrap" style={{ marginTop: 12 }}>
            {s.active
              ? <button className="btn alt sm" onClick={() => confirm(`¿Pausar ${s.code}? Dejará de generar auditorías nuevas.`) && patch(s, { active: false })}>Pausar planta</button>
              : <><span className="sub">Arranca el</span>
                  <input className="inp" type="date" style={{ width: 170 }} value={date[s.id] || todayStr()} onChange={(e) => setDate({ ...date, [s.id]: e.target.value })} />
                  <button className="btn sm" onClick={() => patch(s, { active: true, go_live: date[s.id] || todayStr() })}>Poner en marcha</button></>}
          </div>
        </div>))}
      {imp && <ImportSheet site={imp} onClose={() => setImp(null)} onDone={load} />}
    </>
  );
}

const shiftDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const DAY_IDX = { lun: 0, lunes: 0, mar: 1, martes: 1, mie: 2, miercoles: 2, jue: 3, jueves: 3, vie: 4, viernes: 4 };

// Convierte las filas pegadas (Nombre | Día | Zona | No. de parte) en cambios sobre las auditorías de la semana.
function parseAssignments(text, audits, days) {
  const byName = {};
  audits.forEach((a) => { (byName[norm(a.name)] ||= []).push(a); });
  const names = Object.keys(byName);
  const changes = {}, problems = [];
  let rows = 0;
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    const c = raw.split(raw.includes('\t') ? '\t' : ';').map((x) => x.trim());
    if (i === 0 && /^nombre/.test(norm(c[0]))) return;
    const [name, day, zone, part] = c;
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
    const pend = list.filter((a) => a.status === 'pending');
    if (!pend.length) return problems.push(`Línea ${i + 1}: ${name} no tiene auditorías pendientes ahí`);
    pend.forEach((a) => { changes[a.id] = { ...(changes[a.id] || {}), ...(zone ? { area: zone } : {}), ...(part !== undefined && part !== '' ? { part_number: part } : {}) }; });
    rows++;
  });
  return { changes, problems, rows };
}

function PasteSheet({ data, onApply, onClose }) {
  const [text, setText] = useState(''), [res, setRes] = useState(null);
  const run = () => setRes(parseAssignments(text, data.audits, data.days));
  return (
    <div className="sheet-bg" onClick={onClose}><div className="sheet" onClick={(e) => e.stopPropagation()}>
      <h2>Pegar desde Excel</h2>
      <p className="sub">Una fila por persona y día, con columnas: <b>Nombre, Día, Zona, No. de parte</b>. Si dejas el Día vacío (o pones "Todos") aplica a todos sus días de esta semana. Los cambios se cargan en la tabla y no se guardan hasta que pulses Guardar.</p>
      <details style={{ margin: '8px 0' }}><summary className="sub" style={{ cursor: 'pointer' }}>Ver ejemplo</summary>
        <pre className="imp-ta" style={{ whiteSpace: 'pre-wrap', background: '#f1f4fa', borderRadius: 12, padding: 10 }}>{'Ana López\tLun\tLínea 1\t4521-AB\nAna López\tMié\tLínea 2\t7788-C\nBeto Ruiz\t\tAll Areas\t9001'}</pre></details>
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

// Asignaciones: por persona y por día, la zona y el número de parte a inspeccionar.
// El auditor no elige nada: lo que aquí se carga es lo que ve en "Hoy".
function Assign() {
  const [date, setDate] = useState(null), [data, setData] = useState(null), [edits, setEdits] = useState({});
  const [qs, setQs] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [paste, setPaste] = useState(false);
  const dirty = Object.keys(edits).length;

  const load = (d) => { setData(null); return api(`/api/admin/assignments${d ? `?date=${d}` : ''}`).then((r) => { setData(r); setDate(r.monday); }).catch((e) => setMsg(e.message)); };
  useEffect(() => { load(); }, []);
  const go = (n) => {
    if (dirty && !confirm('Tienes cambios sin guardar. ¿Cambiar de semana y descartarlos?')) return;
    setEdits({}); setMsg(''); load(shiftDay(data.monday, n * 7));
  };

  const val = (a) => ({ area: a.area, part_number: a.part_number, ...(edits[a.id] || {}) });
  const set = (a, k, v) => setEdits((e) => {
    const next = { ...(e[a.id] || {}), [k]: v };
    const same = (next.area ?? a.area) === a.area && (next.part_number ?? a.part_number) === a.part_number;
    const { [a.id]: _drop, ...rest } = e;
    return same ? rest : { ...rest, [a.id]: next };
  });
  // Copia lo capturado en el primer día pendiente de la persona a todos sus demás días pendientes
  const fillWeek = (list) => {
    const pend = list.filter((a) => a.status === 'pending');
    if (pend.length < 2) return;
    const { area, part_number } = val(pend[0]);
    pend.slice(1).forEach((a) => { set(a, 'area', area); set(a, 'part_number', part_number); });
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

  const people = [];
  (data?.audits || []).forEach((a) => {
    if (qs && !a.name.toLowerCase().includes(qs.toLowerCase())) return;
    let p = people[people.length - 1];
    if (!p || p.id !== a.user_id) { p = { id: a.user_id, a, list: [] }; people.push(p); }
    p.list.push(a);
  });

  return (
    <>
      <p className="sub" style={{ margin: '4px 0 12px' }}>Carga a cada persona la <b>zona</b> y el <b>número de parte</b> que inspecciona cada día. Ellos solo lo ven; no pueden cambiarlo. La zona ya viene sugerida por la rotación y puedes cambiarla.</p>
      <div className="row wrap" style={{ margin: '10px 0' }}>
        <button className="btn alt sm" onClick={() => go(-1)} disabled={!data}>‹</button>
        <div className="grow" style={{ textAlign: 'center' }}>{data ? `${fmtDate(data.days[0], { day: 'numeric', month: 'short' })} – ${fmtDate(data.days[4], { day: 'numeric', month: 'short', year: 'numeric' })}` : '…'}</div>
        <button className="btn alt sm" onClick={() => go(1)} disabled={!data}>›</button>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="inp" placeholder="Buscar persona…" value={qs} onChange={(e) => setQs(e.target.value)} />
        <button className="btn alt sm" disabled={!data} onClick={() => setPaste(true)}>Pegar desde Excel</button>
      </div>
      {msg && <div className={msg.startsWith('Guardado') ? 'card' : 'err'} style={{ marginBottom: 12 }}>{msg}</div>}
      {!data ? <div className="empty">Cargando…</div> : !people.length ? <div className="empty">Sin auditorías esta semana{qs ? ' con ese filtro' : ''}. Revisa que la planta esté en marcha.</div> : (
        <>
          <datalist id="zones">{data.zones.map((z) => <option key={z} value={z} />)}</datalist>
          {people.map(({ id, a, list }) => (
            <div key={id} className="card asg-user">
              <div className="asg-head"><b>{a.name}</b><span className="sub">{LAYER[a.layer]} · {DEPT[a.dept]}{a.site ? ` · ${a.site}` : ''}</span>
                {list.filter((x) => x.status === 'pending').length > 1 && <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => fillWeek(list)}>Igual toda la semana</button>}</div>
              {list.map((x) => {
                const v = val(x), done = x.status === 'completed', wide = x.date !== x.due_date;
                const dayLbl = wide ? 'Semana' : `${DAYS_SHORT[data.days.indexOf(x.date)]} ${Number(x.date.slice(8))}`;
                return (
                  <div key={x.id} className="asg-row">
                    <span className={`day ${x.date === data.today ? 'today' : ''}`}>{dayLbl}</span>
                    {done ? <span className="done">✓ Completada · {x.area}{x.part_number ? ` · N/P ${x.part_number}` : ''}</span> : <>
                      <input className="inp" list="zones" placeholder="Zona" value={v.area} onChange={(e) => set(x, 'area', e.target.value)} />
                      <input className="inp" placeholder="No. de parte" maxLength={40} autoCapitalize="characters" value={v.part_number} onChange={(e) => set(x, 'part_number', e.target.value)} />
                    </>}
                  </div>);
              })}
            </div>))}
          {paste && <PasteSheet data={data} onClose={() => setPaste(false)} onApply={(ch) => {
            setEdits((e) => { const n = { ...e }; Object.entries(ch).forEach(([id, v]) => { const a = data.audits.find((x) => x.id === Number(id)); const m = { ...(n[id] || {}), ...v };
              const same = (m.area ?? a.area) === a.area && (m.part_number ?? a.part_number) === a.part_number; if (same) delete n[id]; else n[id] = m; }); return n; });
            setPaste(false); setMsg('');
          }} />}
          <div className="asg-bar">
            <span className="sub grow">{dirty ? `${dirty} cambio(s) sin guardar` : 'Todo guardado'}</span>
            {dirty > 0 && <button className="btn alt sm" onClick={() => { setEdits({}); setMsg(''); }}>Descartar</button>}
            <button className="btn sm" disabled={!dirty || busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </>)}
    </>
  );
}

function Inner() {
  const [tab, setTab] = useState('assign'), [templates, setTemplates] = useState(null);
  const loadT = () => api('/api/admin/templates').then(setTemplates);
  useEffect(() => { loadT(); }, []);
  return (
    <>
      <h1 className="title">Administración</h1>
      <div className="seg" style={{ margin: '12px 0' }}>
        <button className={tab === 'assign' ? 'on' : ''} onClick={() => setTab('assign')}>Asignaciones</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Usuarios y rotación</button>
        <button className={tab === 'q' ? 'on' : ''} onClick={() => setTab('q')}>Preguntas</button>
        <button className={tab === 'stats' ? 'on' : ''} onClick={() => setTab('stats')}>Tiempos</button>
        <button className={tab === 'sites' ? 'on' : ''} onClick={() => setTab('sites')}>Plantas</button>
      </div>
      {!templates ? <div className="empty">Cargando…</div> : tab === 'stats' ? <Stats /> : tab === 'sites' ? <Sites /> : tab === 'assign' ? <Assign /> : tab === 'users' ? <Users templates={templates} /> : <Questions templates={templates} reloadTemplates={loadT} />}
    </>
  );
}
export default function Admin() { return <Shell need="admin"><Inner /></Shell>; }
