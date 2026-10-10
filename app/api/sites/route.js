import { q } from '@/lib/db';
import { route, json } from '@/lib/api';

// Plantas visibles: el admin ve todas (para el selector); los demás, la suya.
export const GET = route(async (req, ctx, user) => {
  const { rows } = await q(
    `SELECT id,code,name,active FROM sites WHERE ($1::boolean OR id=$2) ORDER BY id`,
    [user.access === 'admin', user.site_id ?? 0]);
  return json(rows);
});
