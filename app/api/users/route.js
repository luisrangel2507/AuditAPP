import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
export const GET = route(async (req, ctx, user) => {
  const scope = await siteScope(user);
  const { rows } = await q(
    `SELECT u.id,u.name,u.dept,u.layer,s.code AS site FROM users u LEFT JOIN sites s ON s.id=u.site_id
      WHERE u.active AND ($1::int IS NULL OR u.site_id=$1) ORDER BY u.name`, [scope]);
  return json(rows);
});
