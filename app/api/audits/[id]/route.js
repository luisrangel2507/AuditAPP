import { q } from '@/lib/db';
import { route, json, err, isLead } from '@/lib/api';
import { mxToday, windowState, closesOn } from '@/lib/dates';

async function load(id) {
  const { rows } = await q(
    `SELECT a.*, u.name AS auditor, u.dept, u.layer, t.name AS template
       FROM audits a JOIN users u ON u.id=a.user_id LEFT JOIN templates t ON t.id=a.template_id WHERE a.id=$1`, [id]);
  return rows[0];
}

export const GET = route(async (req, { params }, user) => {
  const a = await load(params.id);
  if (!a) return err('No encontrada', 404);
  if (a.user_id !== user.id && !isLead(user)) return err('Sin permiso', 403);
  const today = mxToday();
  if (user.access !== 'admin') { delete a.started_at; delete a.active_sec; }
  const base = { ...a, today, editable: a.user_id === user.id, window: windowState(a, today), closes_on: closesOn(a) };
  if (a.status === 'completed') {
    const { rows } = await q(
      `SELECT id,question_id,question,category,result,notes,corrective,(evidence <> '') AS has_evidence
         FROM responses WHERE audit_id=$1 ORDER BY id`, [a.id]);
    return json({ ...base, responses: rows });
  }
  const { rows: qs } = await q(
    `SELECT id,text,category FROM questions WHERE id = ANY($1::int[])`, [a.question_ids]);
  const byId = Object.fromEntries(qs.map((r) => [r.id, r]));
  return json({ ...base, questions: a.question_ids.map((i) => byId[i]).filter(Boolean) });
});

// Reasignar auditor / área / fecha de una auditoría pendiente (líderes)
export const PATCH = route(async (req, { params }) => {
  const a = await load(params.id);
  if (!a) return err('No encontrada', 404);
  if (a.status === 'completed') return err('Ya fue completada');
  const b = await req.json();
  const sets = [], vals = [];
  const add = (c, v) => { vals.push(v); sets.push(`${c}=$${vals.length}`); };
  if (b.user_id) add('user_id', Number(b.user_id));
  if (typeof b.area === 'string') add('area', b.area.trim());
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
}, { need: 'lead' });
