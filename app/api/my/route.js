import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { ensureWeek } from '@/lib/schedule';
import { mxToday, mondayOf, addDays, windowState, closesOn } from '@/lib/dates';

export const GET = route(async (req, ctx, user) => {
  const today = mxToday();
  const monday = mondayOf(today);
  await ensureWeek(monday);
  const gl = (await q(`SELECT value FROM settings WHERE key='go_live'`)).rows[0]?.value || '1970-01-01';
  const { rows } = await q(
    `SELECT a.id,a.kind,a.slot,(a.started_at IS NOT NULL) AS started,to_char(a.completed_at AT TIME ZONE 'America/Mexico_City','YYYY-MM-DD') AS done_day,a.date,a.due_date,a.area,a.part_number,a.status,a.score_pct,a.late,a.nok_count,a.partial_count,
            t.name AS template, COALESCE(array_length(a.question_ids,1),0) AS total_questions
       FROM audits a LEFT JOIN templates t ON t.id=a.template_id
      WHERE a.user_id=$1 AND a.date >= $2 AND a.date <= $3 AND a.date >= $5
        AND (a.date >= $4 OR a.status='pending')
        AND (a.kind='lpa' OR (a.date >= $4 AND a.date <= $6::date))
      ORDER BY a.date, (a.kind='process') DESC, a.slot`,
    [user.id, addDays(monday, -14), addDays(monday, 4), monday, gl, today]
  );
  return json({ today, monday, audits: rows.map((a) => ({ ...a, window: windowState(a, today), closes_on: closesOn(a) })) });
});
