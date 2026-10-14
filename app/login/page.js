'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import ThemeToggle from '@/components/ThemeToggle';

const T = {
  es: { sub1: 'Auditorías por capas', sub2: 'Mitchell Plastics', title: 'Iniciar sesión', lead: 'Ingresa tus credenciales para continuar',
    user: 'USUARIO', userPh: 'nombre.apellido', pin: 'CONTRASEÑA', go: 'Entrar', busy: 'Validando…', noteT: 'Uso interno',
    note: 'Las auditorías solo pueden registrarse el mismo día programado.', remember: 'Recordar mi sesión', forgot: '¿Olvidaste tu contraseña?',
    forgotMsg: 'Pide a tu administrador que restablezca tu contraseña (Admin → Usuarios). Al entrar con la nueva, la cambias por una tuya.',
    feats: [['Capas', 'L1 - L4'], ['Calidad', 'en tiempo real'], ['Visibilidad', 'por planta'], ['Equipos', 'más fuertes']] },
  en: { sub1: 'Layered Process Audits', sub2: 'Mitchell Plastics', title: 'Sign in', lead: 'Enter your credentials to continue',
    user: 'USERNAME', userPh: 'name.lastname', pin: 'PASSWORD', go: 'Sign in', busy: 'Checking…', noteT: 'Internal use only',
    note: 'Audits can only be recorded on the scheduled day.', remember: 'Remember me', forgot: 'Forgot your password?',
    forgotMsg: 'Ask your administrator to reset your password (Admin → Users). Then change it to a personal one when you sign in.',
    feats: [['Layers', 'L1 - L4'], ['Quality', 'in real time'], ['Visibility', 'by plant'], ['Stronger', 'teams']] },
};
const Icon = {
  user: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>,
  lock: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="3" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><circle cx="12" cy="15.5" r="1" fill="currentColor" /></svg>,
  eye: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  eyeOff: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>,
  arrow: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  layers: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 17 9 5 9-5" /></svg>,
  shieldOk: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6l7-3z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>,
  bars: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>,
  team: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2.2.7 3.5 2.6 3.5 5.6" /></svg>,  shield: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6l7-3z" /><path d="M9 12l2.2 2.2L15.5 10" stroke="#f26a0a" strokeWidth="2" /></svg>,
  shield: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6l7-3z" /><path d="M9 12l2.2 2.2L15.5 10" stroke="#f26a0a" strokeWidth="2" /></svg>,
};

export default function Login() {
  const [lang, setLang] = useState('es');
  const [expired, setExpired] = useState(false);
  useEffect(() => { try { setExpired(new URLSearchParams(window.location.search).get('expired') === '1'); } catch {} }, []);
  const [username, setU] = useState(''), [pin, setP] = useState(''), [show, setShow] = useState(false);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [remember, setRemember] = useState(true), [forgot, setForgot] = useState(false);
  const router = useRouter();
  const t = T[lang];

  useEffect(() => { try { const l = localStorage.getItem('audit-lang'); if (l === 'en' || l === 'es') setLang(l); } catch {} }, []);
  const pick = (l) => { setLang(l); try { localStorage.setItem('audit-lang', l); } catch {} };

  async function go(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api('/api/auth/login', { method: 'POST', body: { username, password: pin, remember } }); try { sessionStorage.clear(); } catch {} router.replace('/'); }
    catch (e2) { setErr(e2.message); setBusy(false); }
  }
  return (
    <div className="login2"><div className="login2-card">
      <div className="hero">
        <img className="hero-photo" src="/login-bg.webp" alt="" />
        <span className="hero-wedge" aria-hidden="true" />
        <div className="lang"><ThemeToggle className="lang-theme" /><button className={lang === 'es' ? 'on' : ''} onClick={() => pick('es')} type="button">ES</button><button className={lang === 'en' ? 'on' : ''} onClick={() => pick('en')} type="button">EN</button></div>
        <div className="hero-in">
          <img className="logo" src="/mitchell-logo-light.png" alt="Mitchell Plastics" />
          <h1>LP<span className="app-accent">App</span></h1>
          <span className="bar" />
          <p className="sub1">{t.sub1}</p><p className="dim">{t.sub2}</p>
        </div>
        <ul className="hero-feats">{[Icon.layers, Icon.shieldOk, Icon.bars, Icon.team].map((ic, i) => <li key={i}>{ic}<b>{t.feats[i][0]}</b><span>{t.feats[i][1]}</span></li>)}</ul>
      </div>
      <form onSubmit={go}>
        <div className="ttl">{t.title}</div>
        <div className="ttl-sub">{t.lead}</div>
        <div className="field">{Icon.user}<div className="f-in"><label htmlFor="u">{t.user}</label>
          <input id="u" autoCapitalize="none" autoCorrect="off" autoComplete="username" placeholder={t.userPh} value={username} onChange={(e) => setU(e.target.value)} /></div></div>
        <div className="field">{Icon.lock}<div className="f-in"><label htmlFor="p">{t.pin}</label>
          <input id="p" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••" value={pin} onChange={(e) => setP(e.target.value)} /></div>
          <button type="button" className="eye" onClick={() => setShow(!show)} aria-label="mostrar / ocultar contraseña">{show ? Icon.eyeOff : Icon.eye}</button></div>
        {expired && !err && <div className="err">{lang === 'en' ? 'Your session was closed after a period of inactivity. Please sign in again.' : 'Tu sesión se cerró por inactividad. Vuelve a entrar.'}</div>}
        {err && <div className="err">{err}</div>}
        <button className="btn go" disabled={busy || !username || !pin}>{busy ? t.busy : <>{t.go}{Icon.arrow}</>}</button>
        <div className="remrow">
          <label><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t.remember}</label>
          <button type="button" className="linkbtn" onClick={() => setForgot(!forgot)}>{t.forgot}</button>
        </div>
        {forgot && <div className="forgot-msg">{t.forgotMsg}</div>}
        <div className="note">{Icon.shield}<i className="vsep" /><div><b>{t.noteT}</b>{t.note}</div></div>
        <img className="form-pellets" src="/login-pellets.webp" alt="" />
      </form>
    </div></div>
  );
}
