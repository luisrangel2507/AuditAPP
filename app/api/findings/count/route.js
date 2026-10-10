export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { mxToday } from '@/lib/dates';

// Issues abiertos a cargo del usuario (para la insignia del menú y el inicio)
export const GET = route(async (req, ctx, user) => {
  const { rows } = await q(
    `SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE f.due_date < $2)::int overdue
       FROM finding_owners o JOIN findings f ON f.id=o.finding_id
      WHERE o.user_id=$1 AND o.status<>'done' AND f.status<>'closed'`, [user.id, mxToday()]);
  return json(rows[0]);
});
