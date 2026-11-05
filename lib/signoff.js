import { q } from './db';
import { isAdmin } from './roles';
import { siteScope } from './site';
import { mxToday, mondayOf, addDays } from './dates';

// Sign-offs pendientes de un encargado: formatos de su gente ya auditados y aún sin firma (Layer 1 por día, Layer 2 por semana, Layer 3 por mes)
export async function pending(user, job = false) {
  const isTL = user.access === 'lead' && Number(user.layer) >= 2, layer = Number(user.layer) || 1;
  if (!isAdmin(user) && !isTL && layer < 2) return [];
  const from = addDays(mxToday(), -35);
  const scope = isAdmin(user) ? (job ? (user.access === 'master' ? null : (user.site_id ?? 0)) : await siteScope(user)) : (user.site_id ?? 0);
  const teamSql = isAdmin(user) ? 'TRUE' : '(u.manager_id=$3 OR (u.layer < $4 AND ($4 >= 3 OR u.dept=$5)))';
  const { rows } = await q(
    `SELECT a.template_id, t.name AS template, a.date::text AS date, u.layer, u.name
       FROM audits a JOIN users u ON u.id=a.user_id JOIN templates t ON t.id=a.template_id
      WHERE a.kind='lpa' AND a.status='completed' AND a.date >= $1 AND ($2::int IS NULL OR u.site_id=$2) AND u.id <> $6 AND $3::int > 0 AND $4::int > 0 AND $5::text IS NOT NULL AND ${teamSql}`,
    [from, scope, user.id, layer, user.dept || '', user.id]);
  const per = (r) => (r.layer >= 3 ? `${r.date.slice(0, 8)}01` : r.layer === 2 ? mondayOf(r.date) : r.date);
  const map = new Map();
  for (const r of rows) {
    const k = `${r.template_id}|${per(r)}`;
    const o = map.get(k) || { template_id: r.template_id, template: r.template, period: per(r), layer: r.layer, people: new Set(), n: 0 };
    o.people.add(r.name); o.n++; map.set(k, o);
  }
  const { rows: done } = await q('SELECT template_id, period::text AS p FROM signoffs WHERE period >= $1', [from]);
  const signed = new Set(done.map((x) => `${x.template_id}|${x.p}`));
  return [...map.values()].filter((o) => !signed.has(`${o.template_id}|${o.period}`)).map((o) => ({ ...o, people: [...o.people] })).sort((a, b) => b.period.localeCompare(a.period));
}

