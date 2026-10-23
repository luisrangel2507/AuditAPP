export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { mxToday, mondayOf, addDays } from '@/lib/dates';

// Formato impreso de la semana (MGMT-015-C): sin `tpl` = auditoría de proceso de los QEs; con `tpl` = LPA normal de esa plantilla.
// Todas las auditorías de la semana se juntan en el mismo formato, una columna por día.
export const GET = route(async (req, ctx, user) => {
  const sp = new URL(req.url).searchParams, d = sp.get('date');
  // Solo auditorías normales (LPA); las de proceso no llenan formato. Por defecto, la plantilla de los QEs.
  const { rows: tpls } = await q(
    `SELECT DISTINCT t.id,t.name FROM templates t WHERE EXISTS (SELECT 1 FROM audits a JOIN users u ON u.id=a.user_id WHERE a.template_id=t.id AND a.kind='lpa' AND ($1::int IS NULL OR u.site_id=$1)) OR t.name='Quality Engineer' ORDER BY t.name`, [await siteScope(user)]);
  const tpl = Number(sp.get('tpl')) || tpls.find((t) => t.name === 'Quality Engineer')?.id || tpls[0]?.id || null;
  const monday = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : mxToday());
  const sunday = addDays(monday, 6), scope = await siteScope(user);
  const day = `COALESCE((a.completed_at AT TIME ZONE 'America/Mexico_City')::date, a.date)`;
  const { rows: au } = await q(
    `SELECT a.id,${day}::text AS day,a.date,a.slot,a.status,a.late,a.zone,a.machine,a.area,a.part_number,a.score_pct,a.question_ids,u.name,u.layer
       FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.kind='lpa' AND a.template_id=$4
        AND ${day} BETWEEN $1 AND $2 AND ($3::int IS NULL OR u.site_id=$3)
      ORDER BY ${day},a.slot,u.name`, [monday, sunday, scope, tpl]);
  const ids = au.map((r) => r.id);
  const { rows: rs } = ids.length ? await q('SELECT audit_id,question_id,question,item_no,result FROM responses WHERE audit_id = ANY($1::int[])', [ids]) : { rows: [] };
  let rows;
  {
    const { rows: tq } = await q(
      `SELECT x.id,CASE WHEN x.item_no IS NOT NULL THEN NULLIF(x.item_no,-1) ELSE x.sort_order + 1 END AS item,x.text,x.sort_order
         FROM questions x WHERE x.id = ANY($1::int[]) ORDER BY x.sort_order,x.id`, [[...new Set([...rs.map((r) => r.question_id), ...au.flatMap((a) => a.question_ids || [])])]]);
    rows = tq.map((x) => ({ id: x.id, item: x.item, text: String(x.text).split('\n')[0] }));
  }
  const { rows: fi } = ids.length ? await q(
    `SELECT f.id,f.audit_id,f.area,f.result,f.notes,f.created_at,f.status,f.closed_at,f.action,r.item_no,r.question,r.corrective
       FROM findings f LEFT JOIN responses r ON r.id=f.response_id WHERE f.audit_id = ANY($1::int[]) ORDER BY f.created_at`, [ids]) : { rows: [] };
  const by = {}; for (const r of rs) (by[r.audit_id] ||= {})[r.question_id] = r.result;
  const ini = (n) => String(n).split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 3).join('.');
  const tplName = tpls.find((t) => t.id === tpl)?.name || 'LPA', layer = au[0]?.layer || 1;
  return json({
    monday, sunday, tpl, tplName, layer, templates: tpls, rows,
    columns: au.map((a) => ({ id: a.id, date: a.day, slot: a.slot, name: a.name, initials: ini(a.name), status: a.status, late: a.late, zone: a.zone, machine: a.machine, area: a.area, part: a.part_number, score: a.score_pct, answers: by[a.id] || {} })),
    findings: fi.map((f) => ({ id: f.id, audit_id: f.audit_id, item: f.item_no, area: f.area, result: f.result, notes: f.notes, date: f.created_at, status: f.status, closed_at: f.closed_at, action: f.action || f.corrective, question: String(f.question || '').split('\n')[0] })),
  });
}, { need: 'admin' });
