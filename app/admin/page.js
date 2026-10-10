'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, DEPT, LAYER, DAYS_SHORT } from '@/lib/client';

function UserSheet({ u, templates, onClose, onSaved }) {
  const isNew = !u.id;
  const [f, setF] = useState({ name: '', username: '', dept: 'production', layer: 1, access: 'auditor', template_id: '', days: [], pool: [], start_idx: 0, rotate_daily: false, active: true, ...u });
  const [pool, setPool] = useState((u.pool || []).join(', ')), [pin, setPin] = useState(''), [err, setErr] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  async function save() {
    setErr('');
    const body = { ...f, layer: Number(f.layer), template_id: f.template_id ? Number(f.template_id) : null, start_idx: Number(f.start_idx) || 0,
      pool: pool.split(',').map((s) => s.trim()).filter(Boolean), days: Number(f.layer) >= 2 ? [] : f.days };
    try {
      if (isNew) await api('/api/admin/users', { method: 'POST', body: { ...body, pin } });
      else await api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { ...body, ...(pin ? { reset_pin: pin } : {}) } });
      onSaved();
    } catch (e) { setErr(e.message); }
  }
  return (
    <div className="sheet-bg" onClick={onClose}><div className="sheet" onClick={(e) => e.stopPropagation()}>
      <h2>{isNew ? 'Nuevo usuario' : f.name}</h2>
      <label className="lbl">Nombre</label><input className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} />
      {isNew && <><label className="lbl">Usuario</label><input className="inp" autoCapitalize="none" value={f.username} onChange={(e) => set('username', e.target.value)} /></>}
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
      <label className="lbl">{isNew ? 'PIN inicial' : 'Restablecer PIN (opcional)'}</label>
      <input className="inp" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
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
          <div className="row"><b className="grow">{u.name}</b><span className="pill gold">{LAYER[u.layer]}</span><span className="pill">{DEPT[u.dept]}</span></div>
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
      </div>
      {!templates ? <div className="empty">Cargando…</div> : tab === 'stats' ? <Stats /> : tab === 'users' ? <Users templates={templates} /> : <Questions templates={templates} reloadTemplates={loadT} />}
    </>
  );
}
export default function Admin() { return <Shell need="admin"><Inner /></Shell>; }
