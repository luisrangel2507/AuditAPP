import { q } from './db';

// Notificaciones push (Web Push). Las llaves VAPID se generan solas la primera vez y se guardan en la base.
let cfg = null;
async function vapid() {
  if (cfg) return cfg;
  const wp = (await import('web-push')).default;
  const { rows } = await q(`SELECT key,value FROM settings WHERE key IN ('vapid_public','vapid_private')`);
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!m.vapid_public || !m.vapid_private) {
    const k = wp.generateVAPIDKeys();
    for (const [key, value] of [['vapid_public', k.publicKey], ['vapid_private', k.privateKey]]) {
      await q(`INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT (key) DO NOTHING`, [key, value]);
    }
    const { rows: again } = await q(`SELECT key,value FROM settings WHERE key IN ('vapid_public','vapid_private')`);
    Object.assign(m, Object.fromEntries(again.map((r) => [r.key, r.value])));
  }
  wp.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@mitchellplastics.com', m.vapid_public, m.vapid_private);
  cfg = { wp, publicKey: m.vapid_public };
  return cfg;
}
export const pushPublicKey = async () => (await vapid()).publicKey;

export async function sendPush(userId, payload) {
  const { rows } = await q('SELECT id,endpoint,p256dh,auth FROM push_subs WHERE user_id=$1', [userId]);
  if (!rows.length) return;
  const { wp } = await vapid();
  const body = JSON.stringify(payload);
  await Promise.all(rows.map(async (s) => {
    try { await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3600 }); }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await q('DELETE FROM push_subs WHERE id=$1', [s.id]); }
  }));
}
