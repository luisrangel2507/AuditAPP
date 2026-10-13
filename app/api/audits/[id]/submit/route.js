import { pool } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { addOwner, logUpdate } from '@/lib/issues';
import { mxToday, addDays, closesOn } from '@/lib/dates';

const MIN_SEC = 600; // duración mínima esperada de una auditoría
const RESULTS = new Set(['ok', 'nok', 'partial', 'na']);

export const POST = route(async (req, { params }, user) => {
  const { responses, active_sec, area, part_number } = await req.json();
  if (!Array.isArray(responses)) return err('responses requerido');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM audits WHERE id=$1 FOR UPDATE', [params.id]);
    const a = rows[0];
    if (!a) { await client.query('ROLLBACK'); return err('No encontrada', 404); }
    if (a.user_id !== user.id) { await client.query('ROLLBACK'); return err('Esta auditoría no es tuya', 403); }
    if (a.status === 'completed') { await client.query('ROLLBACK'); return err('Ya fue completada'); }
    const { rows: [au] } = await client.query('SELECT layer FROM users WHERE id=$1', [a.user_id]);
    const proc = a.kind === 'process';
    if (au.layer >= 2 || proc) {
      // Layer 2/3/4: el auditor escoge el área que auditó
      const ar = String(area || '').trim().slice(0, 80);
      if (!ar || ar === 'All Areas') { await client.query('ROLLBACK'); return err('Indica el área que auditaste'); }
      await client.query('UPDATE audits SET area=$2 WHERE id=$1', [a.id, ar]);
      a.area = ar;
    }
    if (au.layer === 1 && !proc) {
      // Layer 1: la zona/máquina viene asignada; el auditor captura el N/P que revisó
      const pn = String(part_number || '').trim().slice(0, 40);
      if (!pn) { await client.query('ROLLBACK'); return err('Captura el número de parte que revisaste'); }
      await client.query('UPDATE audits SET part_number=$2 WHERE id=$1', [a.id, pn]);
    }
    const today = mxToday();
    if (today < a.date) { await client.query('ROLLBACK'); return err(`Esta auditoría se habilita el ${a.date}`); }
    if (today > closesOn(a)) {
      await client.query('ROLLBACK');
      return err(`La auditoría ya no se puede registrar: solo se permite el mismo día programado (${closesOn(a)}).`, 403);
    }

    const { rows: qs } = await client.query('SELECT id,text,category FROM questions WHERE id = ANY($1::int[])', [a.question_ids]);
    const qById = Object.fromEntries(qs.map((r) => [r.id, r]));
    const byQ = new Map(responses.map((r) => [Number(r.question_id), r]));

    // Validación: todas contestadas; X y Δ exigen comentario
    for (const qid of a.question_ids) {
      const r = byQ.get(qid);
      if (!qById[qid]) continue; // pregunta eliminada del banco tras generar la auditoría
      if (!r || !RESULTS.has(r.result)) { await client.query('ROLLBACK'); return err('Faltan preguntas por contestar'); }
      if ((r.result === 'nok' || r.result === 'partial') && String(r.notes || '').trim().length < 3) {
        await client.query('ROLLBACK'); return err('Los hallazgos (X / Δ) requieren un comentario');
      }
      if (r.evidence && (typeof r.evidence !== 'string' || !r.evidence.startsWith('data:image/') || r.evidence.length > 2_500_000)) {
        await client.query('ROLLBACK'); return err('Foto inválida o muy pesada');
      }
    }

    const c = { ok: 0, nok: 0, partial: 0, na: 0 };
    for (const qid of a.question_ids) {
      const qq = qById[qid]; if (!qq) continue;
      const r = byQ.get(qid);
      c[r.result]++;
      const ins = await client.query(
        `INSERT INTO responses(audit_id,question_id,question,category,result,notes,corrective,evidence)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [a.id, qid, qq.text, qq.category || '', r.result, String(r.notes || '').trim(),
         String(r.corrective || '').trim(), r.evidence || '']);
      if (r.result === 'nok' || r.result === 'partial') {
        // Se abre el open issue de inmediato; los responsables elegidos deben darle seguimiento
        const fin = await client.query(
          `INSERT INTO findings(audit_id,response_id,area,question,result,notes,due_date)
           VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [a.id, ins.rows[0].id, a.area, qq.text, r.result, String(r.notes || '').trim(), addDays(today, 7)]);
        await logUpdate(client, fin.rows[0].id, user.id, 'opened', 'Open issue abierto en auditoría');
        const ids = [...new Set((Array.isArray(r.owners) ? r.owners : []).map(Number).filter(Boolean))].slice(0, 10);
        for (const oid of ids) {
          const ok = await client.query('SELECT 1 FROM users WHERE id=$1 AND active', [oid]);
          if (ok.rowCount) await addOwner(client, fin.rows[0].id, oid, user.id);
        }
      }
    }
    const scored = c.ok + c.nok + c.partial;
    const score = scored ? Math.round((c.ok / scored) * 1000) / 10 : 100;
    // Tiempo activo reportado por el cliente, acotado al tiempo real transcurrido desde que se inició
    let act = Number.isFinite(Number(active_sec)) ? Math.max(0, Math.round(Number(active_sec))) : null;
    const startedAt = a.started_at ? new Date(a.started_at).getTime() : null;
    if (act !== null && startedAt) act = Math.min(act, Math.round((Date.now() - startedAt) / 1000) + 5);
    await client.query(
      `UPDATE audits SET status='completed',completed_at=NOW(),started_at=COALESCE(started_at,NOW()),active_sec=$8,late=$1,ok_count=$2,nok_count=$3,partial_count=$4,na_count=$5,score_pct=$6 WHERE id=$7`,
      [today > a.due_date, c.ok, c.nok, c.partial, c.na, score, a.id, act]);
    // Auditoría muy corta (menos de 10 min de tiempo activo): se avisa al administrador
    if (act !== null && act < MIN_SEC && !proc) {
      const { rows: [au2] } = await client.query('SELECT name,site_id FROM users WHERE id=$1', [a.user_id]);
      const mm = Math.floor(act / 60), ss = String(act % 60).padStart(2, '0');
      await client.query(
        `INSERT INTO notifications(site_id,type,audit_id,user_id,message) VALUES($1,'short_audit',$2,$3,$4)`,
        [au2.site_id, a.id, a.user_id, `${au2.name} terminó "${a.area}" en ${mm} min ${ss} s (menos de ${MIN_SEC / 60} min)`]);
    }
    await client.query('COMMIT');
    return json({ ok: true, score, ...c, findings: c.nok + c.partial });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('submit', e);
    return err('Error interno', 500);
  } finally {
    client.release();
  }
});
