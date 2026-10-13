export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';

// Avisos para el administrador (p. ej. auditorías que duraron menos de 10 min)
export const GET = route(async (req, ctx, user) => {
  const scope = await siteScope(user);
  const { rows } = await q(
    `SELECT id,type,audit_id,message,created_at,(read_at IS NOT NULL) AS read
       FROM notifications WHERE ($1::int IS NULL OR site_id=$1) ORDER BY created_at DESC LIMIT 40`, [scope]);
  return json({ unread: rows.filter((r) => !r.read).length, items: rows });
}, { need: 'admin' });

// Marca todos como leídos
export const POST = route(async (req, ctx, user) => {
  const scope = await siteScope(user);
  await q(`UPDATE notifications SET read_at=NOW() WHERE read_at IS NULL AND ($1::int IS NULL OR site_id=$1)`, [scope]);
  return json({ ok: true });
}, { need: 'admin' });
