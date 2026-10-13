'use client';
import { useEffect, useState } from 'react';

const Sun = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3 7 7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7" /></svg>;
const Moon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" /></svg>;

// Interruptor claro / oscuro. Se guarda en este dispositivo.
// defaultTheme: tema inicial si la persona nunca eligió uno (p. ej. la TV arranca oscura)
export default function ThemeToggle({ className = 'themebtn', defaultTheme }) {
  const [theme, setTheme] = useState(null);
  useEffect(() => {
    try { if (defaultTheme && !localStorage.getItem('lpa-theme')) document.documentElement.dataset.theme = defaultTheme; } catch {}
    setTheme(document.documentElement.dataset.theme || 'light');
  }, [defaultTheme]);
  function flip() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; setTheme(next);
    try { localStorage.setItem('lpa-theme', next); } catch {}
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = next === 'dark' ? '#0a1226' : '#22407f';
  }
  const label = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return <button type="button" className={className} onClick={flip} aria-label={label} title={label}>{theme === 'dark' ? Sun : Moon}</button>;
}
