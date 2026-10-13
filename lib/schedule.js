import { q, pool } from './db';
import { addDays, mondayOf, weeksBetween, isoWeekday } from './dates';

// Preguntas del día: ventana deslizante sobre las preguntas activas de la plantilla.
// La ventana avanza por semana/día y por auditor, así a lo largo del tiempo se cubren todas.
function pickQuestions(ids, perAudit, seed) {
  if (ids.length <= perAudit) return ids;
  const start = ((seed % ids.length) + ids.length) % ids.length;
  return Array.from({ length: perAudit }, (_, i) => ids[(start + i) % ids.length]);
}

// Crea (idempotente) las auditorías de la semana que inicia en `monday`.
//  - Layer 1: una por cada día fijo del auditor; el ÁREA rota semana a semana por su pool.
//  - Layer 2/3/4: una por semana ("All Areas"), con fecha lunes y vencimiento el viernes.
export async function ensureWeek(monday) {
  const [{ rows: users }, { rows: tq }, { rows: ref }] = await Promise.all([
    q(`SELECT u.id,u.layer,u.template_id,u.days,u.pool,u.start_idx,u.rotate_daily,s.go_live AS site_live
          FROM users u JOIN sites s ON s.id=u.site_id
         WHERE u.active AND s.active AND u.template_id IS NOT NULL AND u.access NOT IN ('admin','master')`),
    q(`SELECT template_id, array_agg(id ORDER BY sort_order,id) ids FROM questions WHERE active GROUP BY template_id`),
    q(`SELECT value FROM settings WHERE key='ref_monday'`),
  ]);
  const refMonday = ref[0]?.value || monday;
  const w = weeksBetween(refMonday, monday);
  const perAudit = Object.fromEntries((await q('SELECT id,per_audit FROM templates')).rows.map((r) => [r.id, r.per_audit]));
  const qids = Object.fromEntries(tq.map((r) => [r.template_id, r.ids]));

  const rows = [];
  for (const u of users) {
    const ids = qids[u.template_id] || [];
    const per = perAudit[u.template_id] || 10;
    if (u.layer >= 2) {
      if (u.site_live && addDays(monday, 4) < u.site_live) continue;
      rows.push([u.id, monday, addDays(monday, 4), (u.layer >= 3 ? 'All Areas' : (u.pool[0] || 'All Areas')), u.template_id,
        pickQuestions(ids, per, w * 7 + u.id)]);
      continue;
    }
    for (const d of u.days) {
      const date = addDays(monday, d - 1);
      if (u.site_live && date < u.site_live) continue;
      const n = u.pool.length || 1;
      const idx = (((u.start_idx + w + (u.rotate_daily ? d - 1 : 0)) % n) + n) % n;
      rows.push([u.id, date, date, u.pool[idx] || '', u.template_id,
        pickQuestions(ids, per, w * 31 + (d - 1) * 7 + u.id)]);
    }
  }
  if (!rows.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      await client.query(
        `INSERT INTO audits(user_id,date,due_date,area,template_id,question_ids)
         VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id,date) DO NOTHING`, r);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export { mondayOf, isoWeekday };
