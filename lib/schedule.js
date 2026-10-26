import { q, pool } from './db';
import { HOME_SITE } from './config';
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
// Cada semana se genera una vez y se recuerda un rato: antes se recorrían todos los usuarios en cada pantalla que se abría
const memo = globalThis.__lpaEnsured || (globalThis.__lpaEnsured = new Map());
const TTL = 60 * 1000;
export function resetEnsured() { memo.clear(); }
export function ensureWeek(monday) {
  const hit = memo.get(monday);
  if (hit && Date.now() - hit.t < TTL) return hit.p;
  const p = ensureWeekNow(monday).catch((e) => { memo.delete(monday); throw e; });
  memo.set(monday, { t: Date.now(), p });
  return p;
}

async function ensureWeekNow(monday) {
  const [{ rows: users }, { rows: tq }, { rows: ref }] = await Promise.all([
    q(`SELECT u.id,u.dept,u.layer,u.lpa_override,u.lpa_from,u.process_per_day,s.code AS site_code,u.template_id,u.days,u.pool,u.start_idx,u.rotate_daily,s.go_live AS site_live
          FROM users u JOIN sites s ON s.id=u.site_id
         WHERE u.active AND s.active AND u.template_id IS NOT NULL AND (u.access NOT IN ('admin','master') OR u.lpa_override IS TRUE)`),
    q(`SELECT template_id, array_agg(id ORDER BY sort_order,id) FILTER (WHERE NOT required) ids, COALESCE(array_agg(id ORDER BY sort_order,id) FILTER (WHERE required), '{}') req FROM questions WHERE active GROUP BY template_id`),
    q(`SELECT value FROM settings WHERE key='ref_monday'`),
  ]);
  const refMonday = ref[0]?.value || monday;
  const w = weeksBetween(refMonday, monday);
  // Nunca se rotan preguntas: cada auditoría lleva todas las que el admin tiene activas
  const perAudit = Object.fromEntries((await q('SELECT id,name,per_audit FROM templates')).rows.map((r) => [r.id, 9999]));
  const qids = Object.fromEntries(tq.map((r) => [r.template_id, r.ids || []]));
  // Temas específicos: van siempre en la auditoría, además de las preguntas que rotan
  const reqIds = Object.fromEntries(tq.map((r) => [r.template_id, r.req || []]));

  const gl = (await q(`SELECT value FROM settings WHERE key='go_live'`)).rows[0]?.value || '1970-01-01';
  const rows = [];
  // Por ahora los QEs (Calidad, Layer 1) solo hacen auditorías de proceso; su LPA se enciende en Admin → QEs
  const qeLpa = (await q(`SELECT value FROM settings WHERE key='qe_lpa_on'`)).rows[0]?.value === '1';
  for (const u of users) {
    // LPA por usuario: el admin la enciende o apaga en su perfil; si no, los QEs dependen del interruptor general
    const lpaOn = u.lpa_override ?? (qeLpa || !(u.dept === 'quality' && u.layer === 1));
    if (!lpaOn) continue;
    const from = u.lpa_from ? (typeof u.lpa_from === 'string' ? u.lpa_from : new Date(u.lpa_from.getTime() - u.lpa_from.getTimezoneOffset() * 60000).toISOString().slice(0, 10)) : null;
    const ids = qids[u.template_id] || [];
    const per = perAudit[u.template_id] || 10;
    if (u.layer >= 2) {
      if ((u.site_live && addDays(monday, 4) < u.site_live) || addDays(monday, 4) < gl || (from && addDays(monday, 4) < from)) continue;
      rows.push([u.id, monday, addDays(monday, 4), 'All Areas', u.template_id,
        [...pickQuestions(ids, per, w * 7 + u.id), ...(reqIds[u.template_id] || [])]]);
      continue;
    }
    for (const d of u.days) {
      const date = addDays(monday, d - 1);
      if ((u.site_live && date < u.site_live) || date < gl || (from && date < from)) continue;
      const n = u.pool.length || 1;
      const idx = (((u.start_idx + w + (u.rotate_daily ? d - 1 : 0)) % n) + n) % n;
      rows.push([u.id, date, date, u.pool[idx] || '', u.template_id,
        [...pickQuestions(ids, per, w * 31 + (d - 1) * 7 + u.id), ...(reqIds[u.template_id] || [])]]);
    }
  }
  // Auditorías de proceso: los QEs (Calidad, Layer 1) hacen 2 al día, de lunes a viernes
  const procTpl = (await q(`SELECT id FROM templates WHERE name IN ('QE Process Audit','Process Audit') ORDER BY (name='QE Process Audit') DESC LIMIT 1`)).rows[0]?.id;
  const procRows = [];
  const perDay = Math.max(0, Math.min(5, Number((await q(`SELECT value FROM settings WHERE key='qe_process_per_day'`)).rows[0]?.value ?? 2)));
  if (procTpl) {
    const pids = qids[procTpl] || [];
    for (const u of users) {
      if (u.dept !== 'quality' || u.layer !== 1 || u.site_code !== HOME_SITE) continue; // solo MPQ
      for (let d = 1; d <= 5; d++) {
        const date = addDays(monday, d - 1);
        if ((u.site_live && date < u.site_live) || date < gl) continue;
        for (let slot = 1; slot <= Math.min(5, u.process_per_day ?? perDay); slot++) procRows.push([u.id, date, date, 'All Areas', procTpl, pickQuestions(pids, perAudit[procTpl] || 10, w * 53 + d * 5 + slot + u.id), slot]);
      }
    }
  }
  // Días que el admin movió: no se regeneran
  const { rows: sk } = await q(`SELECT user_id,date,kind,slot FROM audit_skips WHERE date BETWEEN $1 AND $2`, [monday, addDays(monday, 6)]);
  if (sk.length) {
    const skip = new Set(sk.map((x) => `${x.user_id}|${x.date}|${x.kind}|${x.slot}`));
    for (let i = rows.length - 1; i >= 0; i--) if (skip.has(`${rows[i][0]}|${rows[i][1]}|lpa|1`)) rows.splice(i, 1);
    for (let i = procRows.length - 1; i >= 0; i--) if (skip.has(`${procRows[i][0]}|${procRows[i][1]}|process|${procRows[i][6]}`)) procRows.splice(i, 1);
  }
  if (!rows.length && !procRows.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      await client.query(
        `INSERT INTO audits(user_id,date,due_date,area,template_id,question_ids)
         VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id,date,kind,slot) DO NOTHING`, r);
    }
    for (const r of procRows) {
      await client.query(
        `INSERT INTO audits(user_id,date,due_date,area,template_id,question_ids,kind,slot)
         VALUES($1,$2,$3,$4,$5,$6,'process',$7) ON CONFLICT (user_id,date,kind,slot) DO NOTHING`, r);
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
