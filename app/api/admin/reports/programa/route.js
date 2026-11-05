export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { ensureWeek } from '@/lib/schedule';
import { mxToday, mondayOf, addDays } from '@/lib/dates';

// "Programa Auditoría LPA" semanal: por persona, el área/máquina de cada día (como el cartel de planta).
export const GET = route(async (req, ctx, user) => {
  const d = new URL(req.url).searchParams.get('date');
  const monday = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : mxToday()), scope = await siteScope(user);
  await ensureWeek(monday);
  const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const { rows } = await q(
    `SELECT a.user_id, a.date::text AS date, a.due_date::text AS due, a.area, a.status, u.name, u.dept, u.layer, t.name AS template
       FROM audits a JOIN users u ON u.id=a.user_id JOIN templates t ON t.id=a.template_id
      WHERE a.kind='lpa' AND a.date BETWEEN $1 AND $2 AND ($3::int IS NULL OR u.site_id=$3) AND u.active
      ORDER BY u.layer DESC, u.dept, t.name, u.name`, [monday, days[4], scope]);
  const people = new Map();
  for (const r of rows) {
    const p = people.get(r.user_id) || { name: r.name, dept: r.dept, layer: r.layer, template: r.template, cells: [null, null, null, null, null], wide: false };
    const i = days.indexOf(r.date);
    if (r.layer >= 2) p.wide = r.area || 'All Areas'; else if (i >= 0) p.cells[i] = r.area || '—';
    people.set(r.user_id, p);
  }
  return json({ monday, days, rows: [...people.values()] });
}, { need: 'admin' });
