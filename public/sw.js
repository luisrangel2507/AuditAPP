/* LPApp – service worker: avisos push + uso sin señal (guarda lo ya visitado) */
const STATIC = 'lpa-static-v1', PAGES = 'lpa-pages-v1', API = 'lpa-api-v1';
const API_OK = [/^\/api\/audits\/\d+$/, /^\/api\/my$/, /^\/api\/week/, /^\/api\/auth\/me$/];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  const keep = new Set([STATIC, PAGES, API]);
  for (const k of await caches.keys()) if (k.startsWith('lpa-') && !keep.has(k)) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('message', (e) => {
  if (e.data === 'clear') e.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(API)]));
});

async function networkFirst(req, name) {
  const cache = await caches.open(name);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.host)) e.respondWith(cacheFirst(req));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || /\.(webp|png|jpg|ico|svg|woff2?)$/.test(url.pathname)) { e.respondWith(cacheFirst(req)); return; }
  if (url.pathname.startsWith('/api/')) { if (API_OK.some((r) => r.test(url.pathname))) e.respondWith(networkFirst(req, API)); return; }
  if (req.mode === 'navigate' && !/^\/(login|tv)/.test(url.pathname)) e.respondWith(networkFirst(req, PAGES));
});

self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'LPApp', {
    body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/' }, tag: d.tag,
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await c.focus(); if ('navigate' in c) c.navigate(url).catch(() => {}); return; } }
    await self.clients.openWindow(url);
  })());
});
