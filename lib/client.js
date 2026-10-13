'use client';
export async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 401 && !path.startsWith('/api/auth/login')) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Sesión expirada');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de servidor');
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
