export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { ensureWeek } from '@/lib/schedule';
import { mxToday, mondayOf, addDays, windowState, closesOn } from '@/lib/dates';

// Auditorías de proceso de los QEs (2 diarias). Solo las ve su dueño.
export const GET = route(async (req, ctx, user) => {
  if (user.dept !== 'quality' || user.layer !== 1) return err('Solo para QEs', 403);
  const today = mxToday();
  let date = new URL(req.url).searchParams.get('date') || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = today;
  const monday = mondayOf(date);
  if (monday < addDays(mondayOf(today), -28) || monday > addDays(mondayOf(today), 7)) return json({ today, monday, days: [], audits: [] });
  await ensureWeek(monday);
  const gl = (await q(`SELECT value FROM settings WHERE key='go_live'`)).rows[0]?.value || '1970-01-01';
  const { rows } = await q(
    `SELECT a.id,a.date,a.due_date,a.slot,a.area,a.status,a.score_pct,a.late,a.nok_count,a.partial_count,
            COALESCE(array_length(a.question_ids,1),0) AS total_questions
       FROM audits a WHERE a.kind='process' AND a.user_id=$1 AND a.date BETWEEN $2 AND $3 AND a.date >= $4
      ORDER BY a.date, a.slot`, [user.id, monday, addDays(monday, 4), gl]);
  return json({ today, monday, days: [0, 1, 2, 3, 4].map((i) => addDays(monday, i)),
    audits: rows.map((a) => ({ ...a, window: windowState(a, today), closes_on: closesOn(a) })) });
});
