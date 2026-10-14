import { q } from '@/lib/db';
import { route, json, err, isLead } from '@/lib/api';
import { isAdmin } from '@/lib/roles';
import { sameSite } from '@/lib/site';
import { SEED_MACHINES } from '@/lib/zones';
import { mxToday, windowState, closesOn } from '@/lib/dates';

async function load(id) {
  const { rows } = await q(
    `SELECT a.*, u.name AS auditor, u.dept, u.layer, u.site_id, t.name AS template
       FROM audits a JOIN users u ON u.id=a.user_id LEFT JOIN templates t ON t.id=a.template_id WHERE a.id=$1`, [id]);
  return rows[0];
}

export const GET = route(async (req, { params }, user) => {
  const a = await load(params.id);
  if (!a) return err('No encontrada', 404);
  if (a.user_id !== user.id && !(isLead(user) && sameSite(user, a.site_id))) return err('Sin permiso', 403);
  const today = mxToday();
  if (!isAdmin(user)) { delete a.started_at; delete a.active_sec; }
  const base = { ...a, today, editable: a.user_id === user.id, window: windowState(a, today), closes_on: closesOn(a) };
  let machines = {};
  if (a.layer === 1 || a.kind === 'process') {
    const { rows: m } = await q(`SELECT DISTINCT zone, machine FROM audits WHERE zone <> '' AND machine <> ''`);
    for (const [z, list] of Object.entries(SEED_MACHINES)) machines[z] = [...list];
    for (const r of m) { const l = (machines[r.zone] ||= []); if (!l.includes(r.machine)) l.push(r.machine); }
  }
  if (a.status === 'completed') {
    const { rows } = await q(
      `SELECT r.id,r.question_id,r.question,r.category,r.result,r.notes,r.corrective,(r.evidence <> '') AS has_evidence,
              (SELECT CASE WHEN x.item_no IS NOT NULL THEN NULLIF(x.item_no,-1) ELSE x.sort_order + 1 END FROM questions x WHERE x.id=r.question_id) AS item
         FROM responses r WHERE r.audit_id=$1 ORDER BY r.id`, [a.id]);
    return json({ ...base, machines, responses: rows });
  }
  const { rows: qs } = await q(
    `SELECT id,text,category,CASE WHEN item_no IS NOT NULL THEN NULLIF(item_no,-1) ELSE sort_order + 1 END AS item FROM questions WHERE id = ANY($1::int[])`, [a.question_ids]);
  const byId = Object.fromEntries(qs.map((r) => [r.id, r]));
  let zones = [];
  if (a.layer >= 2 || a.kind === 'process') {
    const { rows: z } = await q(
      `SELECT DISTINCT x AS z FROM users u, unnest(u.pool) x WHERE u.layer=1 AND u.active AND u.site_id IS NOT DISTINCT FROM $1 ORDER BY 1`, [a.site_id]);
    zones = z.map((r) => r.z).filter((v) => v && v !== 'All Areas');
  }
  return json({ ...base, zones, machines, questions: a.question_ids.map((i) => byId[i]).filter(Boolean) });
});

// Reasignar auditor / zona / número de parte / fecha de una auditoría pendiente (solo admin)
export const PATCH = route(async (req, { params }, user) => {
  const a = await load(params.id);
  if (!a) return err('No encontrada', 404);
  if (!sameSite(user, a.site_id)) return err('Sin permiso', 403);
  if (a.status === 'completed') return err('Ya fue completada');
  const b = await req.json();
  const sets = [], vals = [];
  const add = (c, v) => { vals.push(v); sets.push(`${c}=$${vals.length}`); };
  if (b.user_id) {
    const { rows: [nu] } = await q('SELECT site_id FROM users WHERE id=$1 AND active', [Number(b.user_id)]);
    if (!nu || nu.site_id !== a.site_id) return err('El auditor debe ser de la misma planta');
    add('user_id', Number(b.user_id));
  }
  if (typeof b.area === 'string') add('area', b.area.trim().slice(0, 80));
  if (typeof b.part_number === 'string') add('part_number', b.part_number.trim().slice(0, 40));
  if (b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) { add('date', b.date); if (a.date === a.due_date) add('due_date', b.date); }
  if (!sets.length) return err('Nada que cambiar');
  vals.push(a.id);
  try {
    await q(`UPDATE audits SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
  } catch (e) {
    if (e.code === '23505') return err('Ese auditor ya tiene una auditoría ese día');
    throw e;
  }
  return json({ ok: true });
}, { need: 'admin' });
