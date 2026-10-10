'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, DEPT, LAYER, DAYS_SHORT, getSiteCookie, setSiteCookie, todayStr } from '@/lib/client';

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
            <option value="auditor">Auditor</option><option value="lead">Líder (panel + asignar)</option><option value="admin">Admin</option></select></div>
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
  const [tid, setTid] = useState(templates[0]?.id), [qs, setQs] = useState([]), [text, setText] = useState(''), [err, setErr] = useState('');
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
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="inp" placeholder="Nueva pregunta…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn sm" disabled={!text.trim()} onClick={() => run(async () => { await api(`/api/admin/templates/${tid}/questions`, { method: 'POST', body: { text } }); setText(''); })}>Agregar</button>
      </div>
      {err && <div className="err">{err}</div>}
      {qs.map((q) => (
        <div key={q.id} className="card" style={{ marginBottom: 8, opacity: q.active ? 1 : .5 }}>
          <div style={{ fontSize: 14 }}>{q.text}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn-ghost" onClick={() => run(() => api(`/api/admin/questions/${q.id}`, { method: 'PATCH', body: { active: !q.active } }))}>{q.active ? 'Desactivar' : 'Activar'}</button>
            <button className="btn-ghost" onClick={() => { const n = prompt('Editar pregunta', q.text); if (n) run(() => api(`/api/admin/questions/${q.id}`, { method: 'PATCH', body: { text: n } })); }}>Editar</button>
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

function Inner() {
  const [tab, setTab] = useState('users'), [templates, setTemplates] = useState(null);
  const loadT = () => api('/api/admin/templates').then(setTemplates);
  useEffect(() => { loadT(); }, []);
  return (
    <>
      <h1 className="title">Administración</h1>
      <div className="seg" style={{ margin: '12px 0' }}>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Usuarios y rotación</button>
        <button className={tab === 'q' ? 'on' : ''} onClick={() => setTab('q')}>Preguntas</button>
        <button className={tab === 'stats' ? 'on' : ''} onClick={() => setTab('stats')}>Tiempos</button>
        <button className={tab === 'sites' ? 'on' : ''} onClick={() => setTab('sites')}>Plantas</button>
      </div>
      {!templates ? <div className="empty">Cargando…</div> : tab === 'stats' ? <Stats /> : tab === 'sites' ? <Sites /> : tab === 'users' ? <Users templates={templates} /> : <Questions templates={templates} reloadTemplates={loadT} />}
    </>
  );
}
export default function Admin() { return <Shell need="admin"><Inner /></Shell>; }
