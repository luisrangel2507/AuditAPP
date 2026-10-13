import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { MULTI_SITE, HOME_SITE } from '@/lib/config';
import { mxToday, mondayOf, addDays } from '@/lib/dates';

export const GET = route(async (req, ctx, user) => {
  const scope = await siteScope(user);
  const today = mxToday();
  const weeks = Math.min(12, Math.max(1, Number(new URL(req.url).searchParams.get('weeks')) || 4));
  const gl = (await q(`SELECT value FROM settings WHERE key='go_live'`)).rows[0]?.value || '1970-01-01';
  // Ventana pedida, pero nunca antes de la fecha de arranque de la app
  const from = [addDays(mondayOf(today), -(weeks - 1) * 7), gl].sort().pop();
  // Cuentan para cumplimiento: completadas, o cuya ventana (el día programado) ya cerró
  const due = `(a.due_date < $2::date OR a.status='completed')`;
  const P = [from, today, scope];
  const SC = `AND ($3::int IS NULL OR u.site_id=$3)`;

  const [kpi, layer, dept, week, area, fail, missing, open, results, issues, ppl] = await Promise.all([
    q(`SELECT COUNT(*)::int scheduled, COUNT(*) FILTER (WHERE a.status='completed')::int completed,
              ROUND(AVG(a.score_pct) FILTER (WHERE a.status='completed'),1) avg_score,
              COUNT(*) FILTER (WHERE a.status='completed' AND a.late)::int late
         FROM audits a JOIN users u ON u.id=a.user_id WHERE a.date >= $1 AND ${due} ${SC}`, P),
    q(`SELECT u.layer, COUNT(*)::int scheduled, COUNT(*) FILTER (WHERE a.status='completed')::int completed,
              ROUND(AVG(a.score_pct) FILTER (WHERE a.status='completed'),1) avg_score
         FROM audits a JOIN users u ON u.id=a.user_id WHERE a.date >= $1 AND ${due} ${SC} GROUP BY 1 ORDER BY 1`, P),
    q(`SELECT u.dept, COUNT(*)::int scheduled, COUNT(*) FILTER (WHERE a.status='completed')::int completed,
              ROUND(AVG(a.score_pct) FILTER (WHERE a.status='completed'),1) avg_score
         FROM audits a JOIN users u ON u.id=a.user_id WHERE a.date >= $1 AND ${due} ${SC} GROUP BY 1 ORDER BY 1`, P),
    q(`SELECT (a.date - (EXTRACT(ISODOW FROM a.date)::int - 1))::text AS week,
              COUNT(*)::int scheduled, COUNT(*) FILTER (WHERE a.status='completed')::int completed,
              ROUND(AVG(a.score_pct) FILTER (WHERE a.status='completed'),1) avg_score
         FROM audits a JOIN users u ON u.id=a.user_id WHERE a.date >= $1 AND ${due} ${SC} GROUP BY 1 ORDER BY 1`, P),
    q(`SELECT a.area, COUNT(*) FILTER (WHERE a.status='completed')::int audits,
              COALESCE(SUM(a.nok_count + a.partial_count),0)::int findings,
              ROUND(AVG(a.score_pct) FILTER (WHERE a.status='completed'),1) avg_score
         FROM audits a JOIN users u ON u.id=a.user_id WHERE a.date >= $1 AND a.status='completed' AND a.area <> 'All Areas' AND ($2::int IS NULL OR u.site_id=$2)
         GROUP BY 1 HAVING COUNT(*) > 0 ORDER BY avg_score NULLS LAST, findings DESC LIMIT 10`, [from, scope]),
    q(`SELECT r.question, COUNT(*)::int fails FROM responses r JOIN audits a ON a.id=r.audit_id JOIN users u ON u.id=a.user_id
        WHERE a.date >= $1 AND r.result IN ('nok','partial') AND ($2::int IS NULL OR u.site_id=$2) GROUP BY 1 ORDER BY 2 DESC LIMIT 8`, [from, scope]),
    q(`SELECT a.id,a.date,a.area,u.name,u.dept,u.layer FROM audits a JOIN users u ON u.id=a.user_id
        WHERE a.status='pending' AND a.due_date < $1::date AND a.date >= $2 AND ($3::int IS NULL OR u.site_id=$3) ORDER BY a.date DESC, u.name LIMIT 60`, [today, from, scope]),
    q(`SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE f.due_date < $1)::int overdue FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id WHERE f.status <> 'closed' AND ($2::int IS NULL OR u.site_id=$2)`, [today, scope]),
    // Distribución de resultados (todas las respuestas de auditorías completadas en el periodo)
    q(`SELECT r.result, COUNT(*)::int n FROM responses r JOIN audits a ON a.id=r.audit_id JOIN users u ON u.id=a.user_id
        WHERE a.status='completed' AND a.date >= $1 AND ($2::int IS NULL OR u.site_id=$2) GROUP BY 1`, [from, scope]),
    // Open issues (lista tipo PDCA): todos los abiertos de la planta, los vencidos primero
    q(`SELECT f.id,f.area,a.part_number,f.question,f.notes,f.result,f.status,f.due_date,f.created_at,a.date AS audit_date,u.name AS auditor,
              COALESCE((SELECT json_agg(json_build_object('name',ou.name,'status',o.status,'action',o.action) ORDER BY o.added_at)
                          FROM finding_owners o JOIN users ou ON ou.id=o.user_id WHERE o.finding_id=f.id),'[]') AS owners
         FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id
        WHERE f.status <> 'closed' AND ($1::int IS NULL OR u.site_id=$1)
        ORDER BY f.due_date NULLS LAST, f.id LIMIT 100`, [scope]),
    // Usuarios al corriente: de todos los usuarios activos con auditorías asignadas, los que ya completaron
    // al menos una en el periodo y no tienen ninguna vencida sin hacer
    q(`SELECT COUNT(*)::int total,
              COUNT(*) FILTER (WHERE done > 0 AND missed = 0)::int completed,
              COUNT(*) FILTER (WHERE missed > 0)::int with_missed
         FROM (SELECT u.id,
                      COUNT(a.id) FILTER (WHERE a.status='completed' AND a.date >= $1)::int AS done,
                      COUNT(a.id) FILTER (WHERE a.status='pending' AND a.due_date < $2::date AND a.date >= $1)::int AS missed
                 FROM users u LEFT JOIN audits a ON a.user_id=u.id
                WHERE u.active AND u.access NOT IN ('admin','master') AND u.template_id IS NOT NULL AND ($3::int IS NULL OR u.site_id=$3)
                GROUP BY u.id) t`, [from, today, scope]),
  ]);
  const siteName = scope != null ? (await q('SELECT name FROM sites WHERE id=$1', [scope])).rows[0]?.name || ''
    : MULTI_SITE ? 'Todas las plantas' : ((await q('SELECT name FROM sites WHERE code=$1', [HOME_SITE])).rows[0]?.name || HOME_SITE);
  return json({ today, from, weeks, siteName, kpi: kpi.rows[0], layer: layer.rows, dept: dept.rows, week: week.rows,
    area: area.rows, topFailing: fail.rows, missing: missing.rows, openFindings: open.rows[0],
    users: ppl.rows[0],
    results: Object.fromEntries(['ok', 'na', 'partial', 'nok'].map((k) => [k, results.rows.find((r) => r.result === k)?.n || 0])), issues: issues.rows });
}, { need: 'lead' });
