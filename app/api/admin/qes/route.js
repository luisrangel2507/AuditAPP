export const dynamic = 'force-dynamic';
import { resetEnsured } from '@/lib/schedule';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
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
  const gl = (await q(`SELECT value FROM settings WHERE key='go_live'`)).rows[0]?.value || '1970-01-01';
  const { rows } = await q(
    `SELECT u.id, u.name,
            COUNT(a.id)::int AS total,
            COUNT(a.id) FILTER (WHERE a.status='completed')::int AS done,
            COUNT(a.id) FILTER (WHERE a.status='pending' AND a.due_date < $4::date)::int AS missed,
            ROUND(AVG(a.score_pct) FILTER (WHERE a.status='completed'),1) AS avg_score,
            COALESCE(SUM(a.nok_count + a.partial_count) FILTER (WHERE a.status='completed'),0)::int AS findings,
            ROUND(AVG(a.active_sec) FILTER (WHERE a.status='completed' AND a.active_sec IS NOT NULL))::int AS avg_sec,
            COALESCE(json_agg(json_build_object('id',a.id,'date',a.date,'slot',a.slot,'status',a.status,'score',a.score_pct,'area',a.area,'due',a.due_date,'late',a.late) ORDER BY a.date,a.slot) FILTER (WHERE a.id IS NOT NULL),'[]') AS items
       FROM users u LEFT JOIN audits a ON a.user_id=u.id AND a.kind='process' AND a.date BETWEEN $1 AND $2 AND a.date >= $5::date
      WHERE u.active AND u.dept='quality' AND u.layer=1 AND u.access NOT IN ('admin','master') AND ($3::int IS NULL OR u.site_id=$3)
      GROUP BY u.id ORDER BY u.name`, [monday, addDays(monday, 6), scope, today, gl]);
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const perDay = Number((await q(`SELECT value FROM settings WHERE key='qe_process_per_day'`)).rows[0]?.value ?? 2);
  const lpaOn = (await q(`SELECT value FROM settings WHERE key='qe_lpa_on'`)).rows[0]?.value === '1';
  return json({ today, monday, per_day: perDay, lpa_on: lpaOn, days: [0, 1, 2, 3, 4].map((i) => addDays(monday, i)), rows,
    totals: { total: sum('total'), done: sum('done'), missed: sum('missed'), findings: sum('findings') } });
}, { need: 'admin' });

// El admin define cuántas auditorías de proceso al día hace cada QE (0 a 5)
export const PUT = route(async (req, ctx, user) => {
  const body = await req.json();
  // Encender / apagar la LPA de los QEs (por ahora solo auditorías de proceso)
  if (typeof body.lpa_on === 'boolean') {
    await q(`INSERT INTO settings(key,value) VALUES('qe_lpa_on',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [body.lpa_on ? '1' : '0']);
    if (!body.lpa_on) await q(`DELETE FROM audits a USING users u WHERE a.user_id=u.id AND a.kind='lpa' AND a.status='pending' AND u.dept='quality' AND u.layer=1 AND u.lpa_override IS NOT TRUE`);
    resetEnsured();
    return json({ ok: true, lpa_on: body.lpa_on });
  }
  const n = Number(body.per_day);
  if (!Number.isInteger(n) || n < 0 || n > 5) return err('Indica un número de 0 a 5');
  await q(`INSERT INTO settings(key,value) VALUES('qe_process_per_day',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [String(n)]);
  // Si se reduce: se quitan las pendientes de hoy en adelante que sobran
  await q(`DELETE FROM audits WHERE kind='process' AND status='pending' AND date >= $1 AND slot > $2`, [mxToday(), n]);
  resetEnsured();
  return json({ ok: true, per_day: n });
}, { need: 'admin' });
