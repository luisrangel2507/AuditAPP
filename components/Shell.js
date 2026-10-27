'use client';
import { pushStatus, pushEnable, pushDisable, registerSW, clearOfflineCache } from '@/lib/pushClient';
import { outboxList, flushOutbox, discardQueued } from '@/lib/outbox';
import { useEffect, useState, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, peek, DEPT, LAYER, getSiteCookie, setSiteCookie } from '@/lib/client';
import Guide from '@/components/Guide';
import ThemeToggle from '@/components/ThemeToggle';
import { isAdmin, isMaster, roleLabel } from '@/lib/roles';
import { I } from '@/components/Icons';

const ROLE = { quality: 'Calidad', process: 'Procesos', production: 'Producción', logistics: 'Logística', hr: 'RH', maintenance: 'Mantenimiento', toolroom: 'Tool Room', program: 'Programas', management: 'Gerencia' };

const UserCtx = createContext(null);
const NICON = { short_audit: '⚠️', issue_assigned: '📌', issue_soon: '⏳', issue_overdue: '🔴', issue_escalated: '🚨', audit_reminder: '⏰', daily_summary: '📋', weekly_report: '📊', repeat_finding: '🔁', archive_warning: '🗄️', archive_done: '🗄️' };

export const useUser = () => useContext(UserCtx);

function PasswordGate({ onDone }) {
  const [pw, setPw] = useState(''), [n1, setN1] = useState(''), [n2, setN2] = useState(''), [err, setErr] = useState('');
  async function save() {
    setErr('');
    if (n1 !== n2) return setErr('La contraseña nueva no coincide');
    try { await api('/api/auth/pin', { method: 'POST', body: { password: pw, new_password: n1 } }); onDone(); }
    catch (e) { setErr(e.message); }
  }
  return (
    <div className="sheet-bg"><div className="sheet">
      <h2>Cambia tu contraseña</h2>
      <p className="sub">Primer ingreso: por seguridad, define una contraseña personal de al menos 8 caracteres.</p>
      <label className="lbl">Contraseña actual</label>
      <input className="inp" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <label className="lbl">Contraseña nueva</label>
      <input className="inp" type="password" autoComplete="new-password" value={n1} onChange={(e) => setN1(e.target.value)} />
      <label className="lbl">Repite la contraseña nueva</label>
      <input className="inp" type="password" autoComplete="new-password" value={n2} onChange={(e) => setN2(e.target.value)} />
      {err && <div className="err">{err}</div>}
      <button className="btn block" style={{ marginTop: 16 }} onClick={save}>Guardar</button>
    </div></div>
  );
}

export default function Shell({ children, need }) {
  const [user, setUser] = useState(null), [issues, setIssues] = useState(0);
  const [notif, setNotif] = useState(null), [bell, setBell] = useState(false), [guide, setGuide] = useState(false), [sites, setSites] = useState([]), [siteSel, setSiteSel] = useState('ALL');
  const path = usePathname();
  const router = useRouter();

  useEffect(() => { const c = peek('/api/auth/me'); if (c) setUser(c); api('/api/auth/me').then(setUser).catch(() => {}); setSiteSel(getSiteCookie()); }, []);
  useEffect(() => { if (isMaster(user) && user.multi_site) api('/api/sites').then(setSites).catch(() => {}); }, [user?.access]);
  // Primer ingreso (ya con su contraseña propia): se muestra la guía una vez
  useEffect(() => { if (user && !user.must_change && !user.onboarded) setGuide(true); }, [user]);
  useEffect(() => { registerSW(); }, []);
  // Sin señal: aviso y envío automático de lo guardado en el teléfono
  const [outbox, setOutbox] = useState([]), [online, setOnline] = useState(true);
  useEffect(() => {
    const refresh = () => setOutbox(outboxList());
    const up = () => { setOnline(navigator.onLine); flushOutbox().then((r) => { refresh(); if (r.sent) loadNotif(); }); };
    refresh(); setOnline(navigator.onLine); up();
    window.addEventListener('lpa-outbox', refresh); window.addEventListener('online', up); window.addEventListener('offline', up);
    const iv = setInterval(() => { if (outboxList().length) up(); }, 30000);
    return () => { window.removeEventListener('lpa-outbox', refresh); window.removeEventListener('online', up); window.removeEventListener('offline', up); clearInterval(iv); };
    // eslint-disable-next-line
  }, []);
  const loadNotif = () => api('/api/notifications').then(setNotif).catch(() => {});
  useEffect(() => { if (user) loadNotif(); }, [user, path]);
  async function openBell() { setBell(true); if (notif?.unread) { await api('/api/notifications', { method: 'POST' }).catch(() => {}); } }
  const [pushState, setPushState] = useState('unknown');
  useEffect(() => { if (user) pushStatus().then(setPushState); }, [user?.id, bell]);
  // Cierre por inactividad (15 min; 45 min administradores) con latido para no perder la sesión mientras se usa la app
  useEffect(() => {
    if (!user) return;
    const limit = (user.access === 'admin' || user.access === 'master' ? 45 : 15) * 60000;
    let last = Date.now(), ping = Date.now();
    const touch = () => {
      last = Date.now();
      if (last - ping > 4 * 60000) { ping = last; api('/api/auth/ping', { method: 'POST' }).catch(() => {}); }
    };
    const evs = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'input'];
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));
    const check = async () => {
      if (Date.now() - last > limit) {
        try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
        try { sessionStorage.clear(); } catch {}
        clearOfflineCache();
        window.location.href = '/login?expired=1';
      }
    };
    const iv = setInterval(check, 20000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', check); evs.forEach((e) => window.removeEventListener(e, touch, { capture: true })); };
  }, [user?.id]);
  useEffect(() => { if (user) api('/api/findings/count').then((c) => setIssues(c.n)).catch(() => {}); }, [user, path]);
  useEffect(() => {
    if (user && (need === 'lead' || need === 'admin') && !isAdmin(user)) router.replace('/');
    if (user && need === 'master' && !isMaster(user)) router.replace('/');
  }, [user, need, router]);

  function closeGuide() {
    setGuide(false);
    if (user && !user.onboarded) { setUser({ ...user, onboarded: true }); api('/api/auth/onboarded', { method: 'POST' }).catch(() => {}); }
  }
  function pickSite(code) { setSiteCookie(code); setSiteSel(code); window.location.reload(); }
  async function logout() { await api('/api/auth/logout', { method: 'POST' }); try { sessionStorage.clear(); } catch {} clearOfflineCache(); router.replace('/login'); }
  if (!user) return <div className="empty" style={{ paddingTop: 120 }}>Cargando…</div>;

  const lead = isAdmin(user);
  const items = [
    ['/', 'Hoy', I.home], ['/week', 'Semana', I.calendar], ['/findings', 'Issues', I.chart],
    ...(lead ? [['/dashboard', 'Panel', I.grid]] : []),
    ...(isAdmin(user) ? [['/admin', 'Admin', I.settings]] : []),
  ];
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <UserCtx.Provider value={user}>
      <header className="apphero">
        <img className="apphero-img" src="/app-hero.webp" alt="" fetchPriority="high" decoding="async" />
        <div className="apphero-in">
          <div className="apphero-row">
            <img className="brand2-logo" src="/mitchell-logo-light.png" alt="Mitchell Plastics" />
            <div className="who"><b>{user.name}</b><span>{isAdmin(user) ? `${roleLabel(user)}${user.multi_site && user.site_code ? ' · ' + user.site_code : ''}` : `${user.site_code ? user.site_code + ' · ' : ''}${ROLE[user.dept] || ''} · ${LAYER[user.layer]}`}</span></div>
            <button className="helpbtn bellbtn" onClick={openBell} aria-label="Avisos" title="Avisos">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 17h12l-1.6-2.3V10a4.4 4.4 0 0 0-8.8 0v4.7zM10 20a2 2 0 0 0 4 0" /></svg>
              {notif?.unread > 0 && <b className="bell-dot">{notif.unread > 9 ? '9+' : notif.unread}</b>}</button>
            <ThemeToggle className="helpbtn" />
            <button className="helpbtn" onClick={() => setGuide(true)} aria-label="Guía de uso" title="Guía de uso">?</button>
            <span className="avatar">{initials}</span>
            <button className="logout" onClick={logout}>{I.logout(18)}<span>Salir</span></button>
          </div>
          <div className="apphero-bottom">
            <div className="appname">LP<span className="app-accent">App</span></div>
            <div className="who-m"><b>{user.name}</b><span>{isAdmin(user) ? roleLabel(user) : `${ROLE[user.dept] || ''} · ${LAYER[user.layer]}`}</span></div>
            {isMaster(user) && user.multi_site && sites.length > 0 && (
              <select className="sitesel" value={siteSel} onChange={(e) => pickSite(e.target.value)} aria-label="Planta">
                <option value="ALL">Todas las plantas</option>
                {sites.map((s) => <option key={s.id} value={s.code}>{s.code}{s.active ? '' : ' (sin activar)'}</option>)}
              </select>
            )}
          </div>
        </div>
      </header>
      <main className="page sheetpage">
        {!online && <div className="offbar">📵 Sin señal. Puedes seguir contestando; se guardará y se enviará al volver la conexión.</div>}
        {outbox.length > 0 && <div className="offbar pend">
          <b>{outbox.length} auditoría(s) pendiente(s) de enviar</b>
          {outbox.map((o) => <div key={o.id} className="sub" style={{ margin: '2px 0' }}>{o.label}{o.error ? ` · ${o.error}` : ''} {o.error && <button className="btn-ghost" onClick={() => discardQueued(o.id)}>Descartar</button>}</div>)}
          {online && <button className="btn alt sm" style={{ marginTop: 6 }} onClick={() => flushOutbox()}>Reintentar envío</button>}
        </div>}
        {children}
      </main>
      <nav className="nav">
        {items.map(([href, label, icon]) => (
          <Link key={href} href={href} className={path === href ? 'on' : ''}><span className="ni">{icon(22)}{href === '/findings' && issues > 0 && <b className="badge">{issues > 9 ? '9+' : issues}</b>}</span><span>{label}</span></Link>
        ))}
      </nav>
      {bell && <div className="sheet-bg" onClick={() => { setBell(false); loadNotif(); }}><div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Avisos</h2>
        {pushState === 'off' && <button className="btn alt block" style={{ marginBottom: 10 }} onClick={async () => { setPushState(await pushEnable()); }}>🔔 Recibir avisos en este teléfono</button>}
        {pushState === 'on' && <div className="sub" style={{ marginBottom: 8 }}>🔔 Avisos del teléfono activados. <button className="btn-ghost" onClick={async () => { await pushDisable(); setPushState('off'); }}>Desactivar</button></div>}
        {pushState === 'ios' && <div className="sub" style={{ marginBottom: 8 }}>Para recibir avisos en iPhone, agrega LPApp a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí.</div>}
        {pushState === 'denied' && <div className="sub" style={{ marginBottom: 8 }}>Los avisos del teléfono están bloqueados en los ajustes del navegador.</div>}
        {!notif?.items?.length ? <div className="empty">Sin avisos.</div> : notif.items.map((n) => (
          <Link key={n.id} href={n.link || (n.audit_id ? `/audit/${n.audit_id}` : '/')} className="card" style={{ display: 'block', marginBottom: 8 }} onClick={() => setBell(false)}>
            <div style={{ fontSize: 14 }}>{NICON[n.type] || '🔔'} {n.message}</div>
            <div className="sub">{new Date(n.created_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{n.read ? '' : ' · nuevo'}</div>
          </Link>))}
        <button className="btn alt block" style={{ marginTop: 12 }} onClick={() => { setBell(false); loadNotif(); }}>Cerrar</button>
      </div></div>}
      {guide && !user.must_change && <Guide user={user} onClose={closeGuide} />}
      {user.must_change && <PasswordGate onDone={() => setUser({ ...user, must_change: false })} />}
    </UserCtx.Provider>
  );
}
