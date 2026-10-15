export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { isAdmin } from '@/lib/roles';
import { siteScope } from '@/lib/site';

// Avisos del usuario (issues, recordatorios, resúmenes). El administrador también ve los avisos generales de su planta.
async function where(user) {
  const scope = isAdmin(user) ? await siteScope(user) : null;
  return { sql: `(user_id=$1 OR ($2::boolean AND user_id IS NULL AND ($3::int IS NULL OR site_id=$3)))`, vals: [user.id, isAdmin(user), scope] };
}
export const GET = route(async (req, ctx, user) => {
  const w = await where(user);
  const { rows } = await q(
    `SELECT id,type,audit_id,link,message,created_at,(read_at IS NOT NULL) AS read FROM notifications WHERE ${w.sql} ORDER BY created_at DESC LIMIT 40`, w.vals);
  return json({ unread: rows.filter((r) => !r.read).length, items: rows });
});
export const POST = route(async (req, ctx, user) => {
  const w = await where(user);
  await q(`UPDATE notifications SET read_at=NOW() WHERE read_at IS NULL AND ${w.sql}`, w.vals);
  return json({ ok: true });
});
