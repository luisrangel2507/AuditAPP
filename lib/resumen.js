import { q } from './db';
import { isAdmin } from './roles';
import { mxToday, addDays, mondayOf } from './dates';

// Quiénes entran en el resumen de cada persona: administrador → todos (o un departamento); Layer 2 → su departamento;
// Layer 3 y 4 → toda la planta; supervisor → su gente a cargo
export async function scopeUsers(user, deptQ) {
  const site = user.site_id ?? null;
  if (isAdmin(user)) {
    const { rows } = await q(`SELECT id FROM users WHERE active AND access NOT IN ('admin','master') AND ($1::int IS NULL OR site_id=$1) AND ($2::text IS NULL OR dept=$2)`, [user.access === 'master' ? null : site, deptQ || null]);
    return { ids: rows.map((r) => r.id), label: deptQ || 'Toda la planta' };
  }
  const L = Number(user.layer) || 1;
  if (user.access === 'lead' && L >= 3) {
    const { rows } = await q(`SELECT id FROM users WHERE active AND access NOT IN ('admin','master') AND site_id IS NOT DISTINCT FROM $1 AND ($2::text IS NULL OR dept=$2)`, [site, deptQ || null]);
    return { ids: rows.map((r) => r.id), label: deptQ || 'Toda la planta' };
  }
  const { rows: mine } = await q(`SELECT id FROM users WHERE active AND manager_id=$1`, [user.id]);
  if (user.access === 'lead' && L === 2 && user.dept && user.dept !== 'supervision') {
    const { rows } = await q(`SELECT id FROM users WHERE active AND dept=$1 AND layer<=2 AND site_id IS NOT DISTINCT FROM $2 AND access NOT IN ('admin','master')`, [user.dept, site]);
    return { ids: [...new Set([...rows.map((r) => r.id), ...mine.map((r) => r.id)])], label: user.dept };
  }
  return { ids: mine.map((r) => r.id), label: 'Mi equipo' };
}

export function periodOf(period, date) {
  const today = mxToday();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : today;
  if (period === 'month') {
    const from = d.slice(0, 8) + '01', last = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0, 12)).toISOString().slice(0, 10);
    return { from, to: last, today };
  }
  const monday = mondayOf(d);
  return { from: monday, to: addDays(monday, 6), today };
}

export async function resumen(ids, { from, to, today }) {
  if (!ids.length) return { summary: { total: 0, done: 0, late: 0, missed: 0, excused: 0, pct: 100, score: null }, people: [], findings: { opened: 0, closed: 0, open_now: 0, overdue: 0, review: 0 }, zones: [], repeats: [], overdue: [] };
  const { rows: [s] } = await q(
    `SELECT COUNT(*) FILTER (WHERE a.status<>'excused' AND (a.status='completed' OR a.due_date < $3))::int AS total,
            COUNT(*) FILTER (WHERE a.status='completed')::int AS done, COUNT(*) FILTER (WHERE a.status='completed' AND a.late)::int AS late,
            COUNT(*) FILTER (WHERE a.status IN ('pending','missed') AND a.due_date < $3)::int AS missed, COUNT(*) FILTER (WHERE a.status='excused')::int AS excused,
            ROUND(AVG(a.score_pct) FILTER (WHERE a.status='completed')::numeric,1) AS score
       FROM audits a WHERE a.user_id = ANY($4::int[]) AND a.date BETWEEN $1 AND $2`, [from, to, today, ids]);
  const { rows: people } = await q(
    `SELECT u.id,u.name,u.dept,u.layer,
            COUNT(*) FILTER (WHERE a.status<>'excused' AND (a.status='completed' OR a.due_date < $3))::int AS total,
            COUNT(*) FILTER (WHERE a.status='completed')::int AS done, COUNT(*) FILTER (WHERE a.status='completed' AND a.late)::int AS late,
            COUNT(*) FILTER (WHERE a.status IN ('pending','missed') AND a.due_date < $3)::int AS missed,
            COALESCE(SUM(a.nok_count+a.partial_count) FILTER (WHERE a.status='completed'),0)::int AS findings
       FROM audits a JOIN users u ON u.id=a.user_id WHERE a.user_id = ANY($4::int[]) AND a.date BETWEEN $1 AND $2 GROUP BY u.id HAVING COUNT(*) > 0 ORDER BY u.name`, [from, to, today, ids]);
  const { rows: [f] } = await q(
    `SELECT COUNT(*) FILTER (WHERE f.created_at::date BETWEEN $1 AND $2)::int AS opened,
            COUNT(*) FILTER (WHERE f.closed_at::date BETWEEN $1 AND $2)::int AS closed,
            COUNT(*) FILTER (WHERE f.status<>'closed')::int AS open_now, COUNT(*) FILTER (WHERE f.status='review')::int AS review,
            COUNT(*) FILTER (WHERE f.status<>'closed' AND f.due_date < $3)::int AS overdue
       FROM findings f JOIN audits a ON a.id=f.audit_id WHERE a.user_id = ANY($4::int[])`, [from, to, today, ids]);
  const { rows: zones } = await q(
    `SELECT COALESCE(NULLIF(a.zone,''), NULLIF(split_part(a.area,' · ',1),''), '(sin zona)') AS zone, COALESCE(NULLIF(a.machine,''), NULLIF(split_part(a.area,' · ',2),'')) AS machine, COUNT(*)::int AS n
       FROM findings f JOIN audits a ON a.id=f.audit_id WHERE a.user_id = ANY($3::int[]) AND a.date BETWEEN $1 AND $2 GROUP BY 1,2 ORDER BY n DESC LIMIT 6`, [from, to, ids]);
  const { rows: rep } = await q(
    `SELECT split_part(f.question, E'\\n', 1) AS question, a.area, COUNT(*)::int AS n
       FROM findings f JOIN audits a ON a.id=f.audit_id WHERE a.user_id = ANY($3::int[]) AND a.date BETWEEN $1 AND $2
      GROUP BY split_part(f.question, E'\\n', 1), a.area HAVING COUNT(*) >= 2 ORDER BY n DESC LIMIT 6`, [from, to, ids]);
  const { rows: over } = await q(
    `SELECT f.id, split_part(f.question, E'\\n', 1) AS question, f.due_date::text AS due, a.area,
            COALESCE((SELECT string_agg(ou.name, ', ') FROM finding_owners o JOIN users ou ON ou.id=o.user_id WHERE o.finding_id=f.id AND o.status<>'done'),'Sin responsable') AS owners
       FROM findings f JOIN audits a ON a.id=f.audit_id WHERE a.user_id = ANY($2::int[]) AND f.status IN ('open','in_progress') AND f.due_date < $1 ORDER BY f.due_date LIMIT 10`, [today, ids]);
  return { summary: { ...s, pct: s.total ? Math.round((s.done / s.total) * 1000) / 10 : 100 }, people: people.map((p) => ({ ...p, pct: p.total ? Math.round((p.done / p.total) * 1000) / 10 : 100 })), findings: f, zones, repeats: rep, overdue: over };
}
