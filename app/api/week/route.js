import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { isAdmin } from '@/lib/roles';
import { ensureWeek } from '@/lib/schedule';
import { siteScope } from '@/lib/site';
import { mxToday, mondayOf, addDays, windowState } from '@/lib/dates';

export const GET = route(async (req, ctx, user) => {
  const scope = await siteScope(user);
  const today = mxToday();
  let date = new URL(req.url).searchParams.get('date') || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = today;
  const monday = mondayOf(date);
  // No generamos más allá de ±8 semanas de hoy
  const lim = (n) => addDays(mondayOf(today), n * 7);
  if (monday < lim(-8) || monday > lim(8)) return json({ monday, days: [], audits: [], today });
  await ensureWeek(monday);
  const gl = (await q(`SELECT value FROM settings WHERE key='go_live'`)).rows[0]?.value || '1970-01-01';
  const { rows } = await q(
    `SELECT a.id,a.kind,a.slot,a.user_id,u.name,u.dept,u.layer,a.date,a.due_date,a.area,a.part_number,(a.part_edited_at IS NOT NULL) AS part_edited,a.status,a.score_pct,a.late,
            a.nok_count,a.partial_count,t.name AS template
       FROM audits a JOIN users u ON u.id=a.user_id LEFT JOIN templates t ON t.id=a.template_id
      WHERE (a.kind='lpa' OR (NOT $4::boolean AND a.user_id=$5)) AND a.date >= $6 AND a.date BETWEEN $1 AND $2 AND ($3::int IS NULL OR u.site_id=$3) AND ($4::boolean OR a.user_id=$5) ORDER BY u.layer DESC,u.dept,u.name,a.date,a.slot`,
    [monday, addDays(monday, 4), scope, isAdmin(user), user.id, gl]
  );
  return json({ monday, days: [0, 1, 2, 3, 4].map((i) => addDays(monday, i)), audits: rows.map((a) => ({ ...a, window: windowState(a, today) })), today });
});
