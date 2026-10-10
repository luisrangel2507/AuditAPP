'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, DEPT, LAYER } from '@/lib/client';
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
  const path = usePathname();
  const router = useRouter();

  useEffect(() => { api('/api/auth/me').then(setUser).catch(() => {}); }, []);
  useEffect(() => { if (user) api('/api/findings/count').then((c) => setIssues(c.n)).catch(() => {}); }, [user, path]);
  useEffect(() => {
    if (user && need === 'lead' && !['lead', 'admin'].includes(user.access)) router.replace('/');
    if (user && need === 'admin' && user.access !== 'admin') router.replace('/');
  }, [user, need, router]);

  async function logout() { await api('/api/auth/logout', { method: 'POST' }); router.replace('/login'); }
  if (!user) return <div className="empty" style={{ paddingTop: 120 }}>Cargando…</div>;

  const lead = ['lead', 'admin'].includes(user.access);
  const items = [
    ['/', 'Hoy', I.home], ['/week', 'Semana', I.calendar], ['/findings', 'Issues', I.chart],
    ...(lead ? [['/dashboard', 'Panel', I.grid]] : []),
    ...(user.access === 'admin' ? [['/admin', 'Admin', I.settings]] : []),
  ];
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <UserCtx.Provider value={user}>
      <header className="apphero">
        <HeroArt />
        <div className="apphero-in">
          <div className="apphero-row">
            <img className="brand2-logo" src="/mitchell-logo-light.png" alt="Mitchell Plastics" />
            <div className="who"><b>{user.name}</b><span>{ROLE[user.dept] || ''} · {LAYER[user.layer]}</span></div>
            <span className="avatar">{initials}</span>
            <button className="logout" onClick={logout}>{I.logout(18)}<span>Salir</span></button>
          </div>
          <div className="appname">LPAPP</div>
        </div>
      </header>
      <main className="page sheetpage">{children}</main>
      <nav className="nav">
        {items.map(([href, label, icon]) => (
          <Link key={href} href={href} className={path === href ? 'on' : ''}><span className="ni">{icon(22)}{href === '/findings' && issues > 0 && <b className="badge">{issues > 9 ? '9+' : issues}</b>}</span><span>{label}</span></Link>
        ))}
      </nav>
      {user.must_change && <PasswordGate onDone={() => setUser({ ...user, must_change: false })} />}
    </UserCtx.Provider>
  );
}
