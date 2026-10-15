import { q } from './db';
import { sendPush } from './push';

// Crea un aviso (campana) y, si el usuario activó los avisos del teléfono, lo envía también como push.
// `dedupe` evita avisos repetidos: el mismo valor solo se registra una vez.
export async function notify({ db, userId = null, siteId = null, type, message, link = null, auditId = null, dedupe = null, push = true }) {
  const run = db ? db.query.bind(db) : q;
  const r = await run(
    `INSERT INTO notifications(site_id,type,audit_id,user_id,message,link,dedupe) VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (dedupe) WHERE dedupe IS NOT NULL DO NOTHING RETURNING id`,
    [siteId, type, auditId, userId, message, link, dedupe]);
  if (r.rowCount && userId && push) sendPush(userId, { title: 'LPApp', body: message, url: link || '/' }).catch(() => {});
  return r.rowCount > 0;
}

// Un aviso por cada administrador de la planta (y los máster)
export async function notifyAdmins({ db, siteId, type, message, link, dedupe, push = true }) {
  const run = db ? db.query.bind(db) : q;
  const { rows } = await run(
    `SELECT id FROM users WHERE active AND (access='master' OR (access='admin' AND ($1::int IS NULL OR site_id=$1)))`, [siteId ?? null]);
  for (const u of rows) await notify({ db, userId: u.id, siteId, type, message, link, dedupe: dedupe ? `${dedupe}:${u.id}` : null, push });
}
