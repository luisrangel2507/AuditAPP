'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
// Última respuesta de cada consulta (GET): las pantallas la muestran al instante mientras llega la nueva
const cache = new Map();
export function peek(path) {
  if (cache.has(path)) return cache.get(path);
  try { const v = sessionStorage.getItem('lpa:' + path); return v ? JSON.parse(v) : null; } catch { return null; }
}

export async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    // Sin señal / servidor inalcanzable (distinto de un error que responde el servidor)
    const e = new Error('Sin conexión. Revisa tu señal e inténtalo de nuevo.'); e.network = true; throw e;
  }
  if (res.status === 401 && !path.startsWith('/api/auth/login')) {
    if (typeof window !== 'undefined') window.location.href = '/login?expired=1';
    throw new Error('Sesión expirada');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
  if (!opts.method || opts.method === 'GET') {
    cache.set(path, data);
    try { sessionStorage.setItem('lpa:' + path, JSON.stringify(data)); } catch {}
  }
  return data;
}

export const DEPT = {
  quality: 'Calidad', process: 'Procesos', production: 'Producción', logistics: 'Logística',
  hr: 'RH', maintenance: 'Mantenimiento', toolroom: 'Tool Room', program: 'Programas', management: 'Gerencia',
};
export const LAYER = { 1: 'Layer 1', 2: 'Layer 2', 3: 'Layer 3', 4: 'Layer 4' };
export const RESULT = { ok: 'OK', nok: 'X', partial: 'Δ', na: 'N/A' };
export const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

export function fmtDate(s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!s) return '';
  return new Date(s + 'T12:00:00').toLocaleDateString('es-MX', opts);
}

export function useLocal(key, initial) {
  // Borradores en localStorage (puede fallar en modo privado): siempre con try/catch
  const read = () => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initial; } catch { return initial; } };
  const write = (v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
  const clear = () => { try { localStorage.removeItem(key); } catch {} };
  return { read, write, clear };
}

// Reduce la foto a ≤1280px JPEG para no saturar la BD ni los datos móviles
export async function compressImage(file, max = 1280, quality = 0.72) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

export const scoreCls = (s) => (s >= 90 ? 'good' : s >= 75 ? 'mid' : 'bad');

// Planta que ve el admin (cookie leída por el servidor): 'ALL' o un código como 'MPQ'
export function getSiteCookie() {
  try { const m = document.cookie.match(/(?:^|; )lpa_site=([^;]*)/); return m ? decodeURIComponent(m[1]) : 'ALL'; } catch { return 'ALL'; }
}
export function setSiteCookie(code) {
  try { document.cookie = `lpa_site=${encodeURIComponent(code)}; path=/; max-age=31536000; samesite=lax`; } catch {}
}
export const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

// Estado guardado en la URL (?clave=valor): cada cambio de pestaña/filtro es una entrada del historial,
// así el botón "atrás" (o el gesto de regresar) vuelve a la pestaña anterior en lugar de salirse de la pantalla.
export function useUrlState(key, initial) {
  const [v, setV] = useState(initial);
  const parse = (x) => (typeof initial === 'number' ? (Number.isFinite(Number(x)) ? Number(x) : initial) : x);
  useEffect(() => {
    const read = () => { const x = new URLSearchParams(window.location.search).get(key); setV(x == null ? initial : parse(x)); };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
    // eslint-disable-next-line
  }, [key]);
  const set = useCallback((n, opts = {}) => {
    const sp = new URLSearchParams(window.location.search);
    if (n == null || String(n) === String(initial)) sp.delete(key); else sp.set(key, String(n));
    const qs = sp.toString(), url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    if (opts.replace) window.history.replaceState(window.history.state, '', url); else window.history.pushState(window.history.state, '', url);
    setV(n == null ? initial : n);
    // eslint-disable-next-line
  }, [key]);
  return [v, set];
}

// Navegación entre semanas con historial: devuelve setWk(fecha); cada cambio de semana es una entrada de "atrás"
export function useWeekUrl(load) {
  const [wk, setWk] = useUrlState('wk', null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; if (!wk) return; }
    load(wk || undefined);
    // eslint-disable-next-line
  }, [wk]);
  return setWk;
}
