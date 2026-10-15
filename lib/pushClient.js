'use client';
import { api } from './client';

const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;

export async function registerSW() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.register('/sw.js'); } catch { return null; }
}
// Al cerrar sesión se borran las pantallas y datos guardados para uso sin señal
export async function clearOfflineCache() {
  try { const reg = await navigator.serviceWorker?.getRegistration(); reg?.active?.postMessage('clear'); } catch {}
}
// 'on' | 'off' | 'ios' (falta instalar la app) | 'denied' | 'none' (no soportado)
export async function pushStatus() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIOS() && !standalone() ? 'ios' : 'none';
    if (Notification.permission === 'denied') return 'denied';
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch { return 'none'; }
}
export async function pushEnable() {
  try {
    const reg = (await registerSW()) && (await navigator.serviceWorker.ready);
    if (!reg) return 'none';
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
    const { key } = await api('/api/push/key');
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
    await api('/api/push/subscribe', { method: 'POST', body: sub.toJSON() });
    return 'on';
  } catch { return 'off'; }
}
export async function pushDisable() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await api('/api/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
  } catch {}
}
