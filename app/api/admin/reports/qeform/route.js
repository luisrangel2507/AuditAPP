export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { mxToday, mondayOf, addDays } from '@/lib/dates';

// Formato "QE Layer 1 Audit" (MGMT-015-C) de la semana: una columna por auditoría de proceso de cada QE
export const GET = route(async (req, ctx, user) => {
  const d = new URL(req.url).searchParams.get('date');
  const monday = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : mxToday());
  const sunday = addDays(monday, 6), scope = await siteScope(user);
  const { rows: au } = await q(
    `SELECT a.id,a.date,a.slot,a.status,a.late,a.zone,a.machine,a.area,a.part_number,a.score_pct,u.name
       FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.kind='process' AND a.date BETWEEN $1 AND $2 AND ($3::int IS NULL OR u.site_id=$3)
      ORDER BY a.date,a.slot,u.name`, [monday, sunday, scope]);
  const ids = au.map((r) => r.id);
  const { rows: tq } = await q(
    `SELECT x.id,CASE WHEN x.item_no IS NOT NULL THEN NULLIF(x.item_no,-1) ELSE x.sort_order + 1 END AS item,x.text
       FROM questions x JOIN templates t ON t.id=x.template_id WHERE t.name='QE Process Audit' ORDER BY x.sort_order`);
  const { rows: rs } = ids.length ? await q('SELECT audit_id,question_id,result FROM responses WHERE audit_id = ANY($1::int[])', [ids]) : { rows: [] };
  const { rows: fi } = ids.length ? await q(
    `SELECT f.id,f.audit_id,f.area,f.result,f.notes,f.created_at,f.status,f.closed_at,f.action,r.item_no,r.question
       FROM findings f LEFT JOIN responses r ON r.id=f.response_id WHERE f.audit_id = ANY($1::int[]) ORDER BY f.created_at`, [ids]) : { rows: [] };
  const by = {}; for (const r of rs) (by[r.audit_id] ||= {})[r.question_id] = r.result;
  const ini = (n) => String(n).split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 3).join('.');
  return json({
    monday, sunday,
    rows: tq.map((x) => ({ id: x.id, item: x.item, text: String(x.text).split('\n')[0] })),
    columns: au.map((a) => ({ id: a.id, date: a.date, slot: a.slot, name: a.name, initials: ini(a.name), status: a.status, late: a.late, zone: a.zone, machine: a.machine, area: a.area, part: a.part_number, score: a.score_pct, answers: by[a.id] || {} })),
    findings: fi.map((f) => ({ id: f.id, audit_id: f.audit_id, item: f.item_no, area: f.area, result: f.result, notes: f.notes, date: f.created_at, status: f.status, closed_at: f.closed_at, action: f.action, question: String(f.question || '').split('\n')[0] })),
  });
}, { need: 'admin' });
