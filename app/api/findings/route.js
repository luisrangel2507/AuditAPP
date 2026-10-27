export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json, isLead } from '@/lib/api';
import { isTeamLead } from '@/lib/team';
import { siteScope } from '@/lib/site';
import { mxToday } from '@/lib/dates';

export const GET = route(async (req, ctx, user) => {
  const sp = new URL(req.url).searchParams;
  const status = sp.get('status') || 'open';
  const cond = [], vals = [];
  const scope = await siteScope(user);
  if (scope != null) { vals.push(scope); cond.push(`u.site_id=$${vals.length}`); }
  if (status === 'open') cond.push(`f.status <> 'closed'`);
  else if (status === 'closed') cond.push(`f.status = 'closed'`);
  else if (status === 'mine') {
    vals.push(user.id);
    cond.push(`f.status <> 'closed' AND EXISTS (SELECT 1 FROM finding_owners o WHERE o.finding_id=f.id AND o.user_id=$${vals.length} AND o.status<>'done')`);
  } else if (status === 'unassigned') cond.push(`f.status <> 'closed' AND NOT EXISTS (SELECT 1 FROM finding_owners o WHERE o.finding_id=f.id)`);
  // Auditores sin rol de líder ven solo los issues que levantaron o en los que son responsables
  if (!isLead(user)) {
    vals.push(user.id);
    const me = vals.length;
    let team = '';
    if (isTeamLead(user) && user.site_id != null) {
      vals.push(Number(user.layer), user.dept || '', user.site_id);
      const L = `$${vals.length - 2}::int`, D = `$${vals.length - 1}`, S = `$${vals.length}::int`;
      team = ` OR (u.layer < ${L} AND (${L} >= 3 OR u.dept = ${D}) AND u.site_id = ${S}) OR EXISTS (SELECT 1 FROM finding_owners o3 JOIN users ou3 ON ou3.id=o3.user_id WHERE o3.finding_id=f.id AND ou3.layer < ${L} AND (${L} >= 3 OR ou3.dept = ${D}) AND ou3.site_id = ${S})`;
    }
    cond.push(`(a.user_id=$${me} OR EXISTS (SELECT 1 FROM finding_owners o2 WHERE o2.finding_id=f.id AND o2.user_id=$${me})${team})`);
  }
  const { rows } = await q(
    `SELECT f.id,f.area,a.part_number,f.question,f.result,f.notes,f.status,f.action,f.due_date,f.created_at,f.closed_at,
            (SELECT COUNT(*)::int FROM finding_updates fu WHERE fu.finding_id=f.id AND fu.kind IN ('comment','progress','done')) AS n_updates,
            a.id AS audit_id, a.date AS audit_date, a.user_id AS auditor_id, u.name AS auditor, u.dept,
            (SELECT r.id FROM responses r WHERE r.id=f.response_id AND r.evidence <> '') AS evidence_id,
            (SELECT COALESCE(r2.item_no, CASE WHEN qq.item_no IS NOT NULL THEN NULLIF(qq.item_no,-1) ELSE qq.sort_order + 1 END)
               FROM responses r2 JOIN questions qq ON qq.id=r2.question_id WHERE r2.id=f.response_id) AS item,
            COALESCE((SELECT json_agg(json_build_object('id',e.id,'user_id',e.user_id,'name',eu.name,'at',e.created_at) ORDER BY e.id)
                        FROM finding_evidence e LEFT JOIN users eu ON eu.id=e.user_id WHERE e.finding_id=f.id),'[]') AS closure,
            COALESCE((SELECT json_agg(json_build_object('user_id',o.user_id,'name',ou.name,'status',o.status,'action',o.action,'plan_action',o.plan_action,'plan_date',o.plan_date,'done_at',o.done_at) ORDER BY o.added_at)
                        FROM finding_owners o JOIN users ou ON ou.id=o.user_id WHERE o.finding_id=f.id),'[]') AS owners
       FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id
      ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
      ORDER BY (f.status='closed'), f.due_date NULLS LAST, f.id DESC LIMIT 300`, vals);
  return json({ today: mxToday(), findings: rows });
});
