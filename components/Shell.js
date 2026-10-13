'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, DEPT, LAYER, getSiteCookie, setSiteCookie } from '@/lib/client';
import Guide from '@/components/Guide';
import ThemeToggle from '@/components/ThemeToggle';
import { isAdmin, isMaster, roleLabel } from '@/lib/roles';
import { HeroArt } from '@/components/Art';
import { I } from '@/components/Icons';

const ROLE = { quality: 'Calidad', process: 'Procesos', production: 'Producción', logistics: 'Logística', hr: 'RH', maintenance: 'Mantenimiento', toolroom: 'Tool Room', program: 'Programas', management: 'Gerencia' };

const UserCtx = createContext(null);
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
  const [guide, setGuide] = useState(false), [sites, setSites] = useState([]), [siteSel, setSiteSel] = useState('ALL');
  const path = usePathname();
  const router = useRouter();

  useEffect(() => { api('/api/auth/me').then(setUser).catch(() => {}); setSiteSel(getSiteCookie()); }, []);
  useEffect(() => { if (isMaster(user) && user.multi_site) api('/api/sites').then(setSites).catch(() => {}); }, [user?.access]);
  // Primer ingreso (ya con su contraseña propia): se muestra la guía una vez
  useEffect(() => { if (user && !user.must_change && !user.onboarded) setGuide(true); }, [user]);
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
  async function logout() { await api('/api/auth/logout', { method: 'POST' }); router.replace('/login'); }
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
        <HeroArt />
        <div className="apphero-in">
          <div className="apphero-row">
            <img className="brand2-logo" src="/mitchell-logo-light.png" alt="Mitchell Plastics" />
            <div className="who"><b>{user.name}</b><span>{isAdmin(user) ? `${roleLabel(user)}${user.multi_site && user.site_code ? ' · ' + user.site_code : ''}` : `${user.site_code ? user.site_code + ' · ' : ''}${ROLE[user.dept] || ''} · ${LAYER[user.layer]}`}</span></div>
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
      <main className="page sheetpage">{children}</main>
      <nav className="nav">
        {items.map(([href, label, icon]) => (
          <Link key={href} href={href} className={path === href ? 'on' : ''}><span className="ni">{icon(22)}{href === '/findings' && issues > 0 && <b className="badge">{issues > 9 ? '9+' : issues}</b>}</span><span>{label}</span></Link>
        ))}
      </nav>
      {guide && !user.must_change && <Guide user={user} onClose={closeGuide} />}
      {user.must_change && <PasswordGate onDone={() => setUser({ ...user, must_change: false })} />}
    </UserCtx.Provider>
  );
}
