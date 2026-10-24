import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { mxToday } from '@/lib/dates';

// Un QE puede hacer una auditoría de proceso extra aunque no la tenga programada: se crea al momento, con todas las preguntas activas
export const POST = route(async (req, ctx, user) => {
  const { rows: [u] } = await q('SELECT id,dept,layer,site_id FROM users WHERE id=$1', [user.id]);
  if (!u || u.dept !== 'quality' || u.layer !== 1) return err('Solo los QEs pueden crear auditorías de proceso', 403);
  const today = mxToday();
  // Extras que quedaron sin iniciar de días anteriores se limpian para no contar como "no realizadas"
  await q(`DELETE FROM audits WHERE user_id=$1 AND kind='process' AND unscheduled AND status='pending' AND started_at IS NULL AND date < $2`, [u.id, today]);
  const { rows: [ex] } = await q(`SELECT id FROM audits WHERE user_id=$1 AND kind='process' AND unscheduled AND status='pending' AND started_at IS NULL AND date=$2 LIMIT 1`, [u.id, today]);
  if (ex) return json({ id: ex.id });
  const { rows: [t] } = await q(`SELECT id FROM templates WHERE name='QE Process Audit'`);
  if (!t) return err('No existe la plantilla de auditoría de proceso');
  const { rows: qs } = await q(`SELECT id FROM questions WHERE template_id=$1 AND active ORDER BY required, sort_order, id`, [t.id]);
  if (!qs.length) return err('No hay preguntas activas en la auditoría de proceso');
  const { rows: [m] } = await q(`SELECT COALESCE(MAX(slot),0)+1 AS s FROM audits WHERE user_id=$1 AND date=$2 AND kind='process'`, [u.id, today]);
  const { rows: [a] } = await q(
    `INSERT INTO audits(user_id,date,due_date,area,template_id,question_ids,kind,slot,unscheduled) VALUES($1,$2,$2,'All Areas',$3,$4,'process',$5,TRUE) RETURNING id`,
    [u.id, today, t.id, qs.map((x) => x.id), m.s]);
  return json({ id: a.id });
});
