export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { ensureWeek } from '@/lib/schedule';
import { mxToday, mondayOf, addDays } from '@/lib/dates';

// Seguimiento de las auditorías de proceso de los QEs (etapa de pruebas): avance por persona y semana
export const GET = route(async (req, ctx, user) => {
  const scope = await siteScope(user);
  const today = mxToday();
  let date = new URL(req.url).searchParams.get('date') || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = today;
  const monday = mondayOf(date);
  if (monday < addDays(mondayOf(today), -28) || monday > addDays(mondayOf(today), 7)) return json({ today, monday, days: [], rows: [], totals: {} });
  await ensureWeek(monday);
  const { rows } = await q(
    `SELECT u.id, u.name,
            COUNT(a.id)::int AS total,
            COUNT(a.id) FILTER (WHERE a.status='completed')::int AS done,
            COUNT(a.id) FILTER (WHERE a.status='pending' AND a.due_date < $4::date)::int AS missed,
            ROUND(AVG(a.score_pct) FILTER (WHERE a.status='completed'),1) AS avg_score,
            COALESCE(SUM(a.nok_count + a.partial_count) FILTER (WHERE a.status='completed'),0)::int AS findings,
            ROUND(AVG(a.active_sec) FILTER (WHERE a.status='completed' AND a.active_sec IS NOT NULL))::int AS avg_sec,
            COALESCE(json_agg(json_build_object('date',a.date,'slot',a.slot,'status',a.status,'score',a.score_pct,'area',a.area,'due',a.due_date) ORDER BY a.date,a.slot) FILTER (WHERE a.id IS NOT NULL),'[]') AS items
       FROM users u LEFT JOIN audits a ON a.user_id=u.id AND a.kind='process' AND a.date BETWEEN $1 AND $2
      WHERE u.active AND u.dept='quality' AND u.layer=1 AND u.access NOT IN ('admin','master') AND ($3::int IS NULL OR u.site_id=$3)
      GROUP BY u.id ORDER BY u.name`, [monday, addDays(monday, 4), scope, today]);
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  return json({ today, monday, days: [0, 1, 2, 3, 4].map((i) => addDays(monday, i)), rows,
    totals: { total: sum('total'), done: sum('done'), missed: sum('missed'), findings: sum('findings') } });
}, { need: 'admin' });
