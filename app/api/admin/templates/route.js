import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
export const GET = route(async () => {
  const { rows } = await q(
    `SELECT t.id,t.name,t.zone,t.per_audit,
            COUNT(qq.id) FILTER (WHERE qq.active)::int AS active_questions, COUNT(qq.id)::int AS total_questions
       FROM templates t LEFT JOIN questions qq ON qq.template_id=t.id GROUP BY t.id ORDER BY t.name`);
  return json(rows);
}, { need: 'admin' });
