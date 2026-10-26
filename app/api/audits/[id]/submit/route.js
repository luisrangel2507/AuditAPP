import { pool } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { addOwner, logUpdate } from '@/lib/issues';
import { notifyAdmins } from '@/lib/notify';
import { mxToday, addDays, closesOn } from '@/lib/dates';

const MIN_SEC = 600; // duración mínima esperada de una auditoría
const RESULTS = new Set(['ok', 'nok', 'partial', 'na']);
const STICKERS = ['White', 'Green', 'Yellow', 'Orange', 'Pink'];
const STICKER_ES = { White: 'Blanco', Green: 'Verde', Yellow: 'Amarillo', Orange: 'Naranja', Pink: 'Rosa' };

export const POST = route(async (req, { params }, user) => {
  const { responses, active_sec, area, part_number, shipper, parts, extra_ids } = await req.json();
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
    if (au.layer >= 2 && !a.zone) {
      // Layer 2/3/4: el área se escoge al iniciar
      await client.query('ROLLBACK'); return err('Indica el área que auditas (se escoge al iniciar)');
    }
    const { rows: [tn] } = await client.query('SELECT name FROM templates WHERE id=$1', [a.template_id]);
    const noPart = tn?.name === 'QE Proveedores (LPA)';
    if ((au.layer === 1 || proc) && (!a.zone || (!a.part_number && !noPart))) {
      // Layer 1 y QEs: zona, máquina y N/P se capturan al iniciar
      await client.query('ROLLBACK'); return err('Faltan la zona, la máquina y el número de parte (se capturan al iniciar)');
    }
    const today = mxToday();
    if (today < a.date) { await client.query('ROLLBACK'); return err(`Esta auditoría se habilita el ${a.date}`); }
    if (today > closesOn(a) && !proc) { // las auditorías de proceso se pueden hacer tarde (quedan marcadas como tardías)
      await client.query('ROLLBACK');
      return err(`La auditoría ya no se puede registrar: solo se permite el mismo día programado (${closesOn(a)}).`, 403);
    }

    // Ítems extra que el QE decidió agregar al final (solo hallazgos): del banco de los QEs y que no estaban en la auditoría
    let allIds = a.question_ids, extraSet = new Set();
    if (au.layer === 1 && Array.isArray(extra_ids) && extra_ids.length) {
      const { rows: ex } = await client.query(
        `SELECT x.id FROM questions x JOIN templates t ON t.id=x.template_id JOIN users u ON u.id=$3
          WHERE x.id = ANY($1::int[]) AND x.active AND NOT x.required AND u.dept='quality' AND t.name IN ('QE Process Audit','Quality Engineer')
            AND x.category NOT IN ('Dock Audit','Auditoría gerencial') AND NOT (x.id = ANY($2::int[]))`,
        [extra_ids.map(Number).filter(Number.isInteger).slice(0, 10), a.question_ids, a.user_id]);
      extraSet = new Set(ex.map((r) => r.id));
      allIds = [...a.question_ids, ...extraSet];
    }
    const { rows: qs } = await client.query('SELECT id,text,category,CASE WHEN item_no IS NOT NULL THEN NULLIF(item_no,-1) ELSE sort_order + 1 END AS item FROM questions WHERE id = ANY($1::int[])', [allIds]);
    const qById = Object.fromEntries(qs.map((r) => [r.id, r]));
    const byQ = new Map(responses.map((r) => [Number(r.question_id), r]));
    const hasDock = qs.some((x) => x.category === 'Dock Audit');
    const ship = String(shipper || '').trim().slice(0, 40);
    const hasGer = qs.some((x) => x.category === 'Auditoría gerencial');
    const cleanParts = hasGer && Array.isArray(parts)
      ? parts.map((x) => ({ name: String(x?.name || '').trim().slice(0, 80), number: String(x?.number || '').trim().slice(0, 40), color: String(x?.color || '').trim().slice(0, 30), freq: String(x?.freq || '').trim().slice(0, 40) })).filter((x) => x.name && x.number).slice(0, 10)
      : [];
    if (hasGer && !cleanParts.length) { await client.query('ROLLBACK'); return err('Captura al menos una parte (nombre y número) en la etapa de auditoría gerencial'); }
    if (hasDock && !ship) { await client.query('ROLLBACK'); return err('Indica el Shipper # que revisaste en el Dock Audit'); }

    // Validación: todas contestadas; X y Δ exigen comentario
    for (const qid of allIds) {
      const r = byQ.get(qid);
      if (!qById[qid]) continue; // pregunta eliminada del banco tras generar la auditoría
      if (!r || !RESULTS.has(r.result)) { await client.query('ROLLBACK'); return err('Faltan preguntas por contestar'); }
      if (extraSet.has(qid) && r.result !== 'nok' && r.result !== 'partial') { await client.query('ROLLBACK'); return err('Los ítems agregados al final solo se usan para reportar hallazgos (X o Δ)'); }
      if ((r.result === 'nok' || r.result === 'partial') && String(r.notes || '').trim().length < 3) {
        await client.query('ROLLBACK'); return err('Los hallazgos (X / Δ) requieren un comentario');
      }
      if ((r.result === 'nok' || r.result === 'partial') && qById[qid].category === 'Auditoría gerencial') {
        const x = r.extra || {};
        const partOk = cleanParts.length === 1 || cleanParts.some((pp) => pp.number === x.part);
        if (!STICKERS.includes(x.sticker) || !String(x.operator || '').trim() || !String(x.shift || '').trim() || !partOk) {
          await client.query('ROLLBACK'); return err('Los hallazgos de la auditoría gerencial requieren parte, sticker, número de operador y turno');
        }
      }
      if ((r.result === 'nok' || r.result === 'partial') && !r.evidence) {
        await client.query('ROLLBACK'); return err('Todo hallazgo (X / Δ) requiere una foto de evidencia');
      }
      if ((r.result === 'nok' || r.result === 'partial') && r.closed_now) {
        const okImg = typeof r.close_evidence === 'string' && r.close_evidence.startsWith('data:image/') && r.close_evidence.length <= 2_500_000;
        if (!okImg || String(r.corrective || '').trim().length < 3) { await client.query('ROLLBACK'); return err('Si se corrigió en el momento, indica la acción y sube la foto del cierre'); }
      }
      if (r.evidence && (typeof r.evidence !== 'string' || !r.evidence.startsWith('data:image/') || r.evidence.length > 2_500_000)) {
        await client.query('ROLLBACK'); return err('Foto inválida o muy pesada');
      }
    }

    const c = { ok: 0, nok: 0, partial: 0, na: 0 };
    for (const qid of allIds) {
      const qq = qById[qid]; if (!qq) continue;
      const r = byQ.get(qid);
      c[r.result]++;
      // Hallazgos gerenciales (QA-075-C): sticker, operador y turno quedan también dentro de la descripción
      const ex = (r.result === 'nok' || r.result === 'partial') && qq.category === 'Auditoría gerencial'
        ? { sticker: r.extra.sticker, operator: String(r.extra.operator).trim().slice(0, 30), shift: String(r.extra.shift).trim().slice(0, 10), part: cleanParts.length === 1 ? cleanParts[0].number : r.extra.part } : null;
      const exPart = ex && cleanParts.find((pp) => pp.number === ex.part);
      const noteTxt = String(r.notes || '').trim() + (ex ? ` · Parte: ${exPart ? `${exPart.name} (${exPart.number})` : ex.part} · Sticker: ${STICKER_ES[ex.sticker]} · Operador: ${ex.operator} · Turno: ${ex.shift}` : '');
      const ins = await client.query(
        `INSERT INTO responses(audit_id,question_id,question,category,result,notes,corrective,evidence,item_no,extra)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [a.id, qid, qq.text, qq.category || '', r.result, noteTxt,
         String(r.corrective || '').trim(), r.evidence || '', qq.item ?? null, ex ? JSON.stringify(ex) : null]);
      if (r.result === 'nok' || r.result === 'partial') {
        // Se abre el open issue de inmediato; los responsables elegidos deben darle seguimiento
        const fin = await client.query(
          `INSERT INTO findings(audit_id,response_id,area,question,result,notes,due_date)
           VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [a.id, ins.rows[0].id, a.area, qq.text, r.result, noteTxt, addDays(today, 7)]);
        await logUpdate(client, fin.rows[0].id, user.id, 'opened', 'Open issue abierto en auditoría');
        if (r.closed_now) {
          // Corregido en el momento: el mismo auditor sube la evidencia y el issue queda cerrado
          const act = String(r.corrective || '').trim();
          await client.query('INSERT INTO finding_evidence(finding_id,user_id,data) VALUES($1,$2,$3)', [fin.rows[0].id, user.id, r.close_evidence]);
          await client.query(`UPDATE findings SET status='closed',closed_at=NOW(),closed_by=$2,action=$3 WHERE id=$1`, [fin.rows[0].id, user.id, act]);
          await logUpdate(client, fin.rows[0].id, user.id, 'closed', `Corregido en el momento por el auditor: ${act}`);
        }
        // Hallazgo repetido: el mismo ítem ya falló 2 o más veces en la misma zona en los últimos 30 días
        const { rows: [rep] } = await client.query(
          `SELECT COUNT(*)::int n FROM findings f2 JOIN responses r2 ON r2.id=f2.response_id
            WHERE r2.question_id=$1 AND f2.area=$2 AND f2.id<>$3 AND f2.created_at > NOW() - INTERVAL '30 days'`, [qid, a.area, fin.rows[0].id]);
        if (rep.n >= 2) {
          const { rows: [su] } = await client.query('SELECT site_id FROM users WHERE id=$1', [a.user_id]);
          await notifyAdmins({ db: client, siteId: su.site_id, type: 'repeat_finding', link: '/reports',
            message: `Hallazgo repetido (${rep.n + 1} veces en 30 días) en ${a.area}: ${String(qq.text).split('\n')[0].slice(0, 80)}`, dedupe: `rep:${qid}:${a.area}:${today}` });
        }
        let ids = [...new Set((Array.isArray(r.owners) ? r.owners : []).map(Number).filter(Boolean))].slice(0, 10);
        if (qq.category === 'Dock Audit') {
          // Plan de reacción (QA-076-C): el hallazgo se turna a los Gerentes de Logística de la planta
          const { rows: lg } = await client.query(`SELECT id FROM users WHERE active AND dept='logistics' AND layer>=2 AND site_id=(SELECT site_id FROM users WHERE id=$1)`, [a.user_id]);
          ids = [...new Set([...ids, ...lg.map((x) => x.id)])].slice(0, 12);
        }
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
      `UPDATE audits SET shipper=$9,extra=$10,status='completed',completed_at=NOW(),started_at=COALESCE(started_at,NOW()),active_sec=$8,late=$1,ok_count=$2,nok_count=$3,partial_count=$4,na_count=$5,score_pct=$6 WHERE id=$7`,
      [today > a.due_date, c.ok, c.nok, c.partial, c.na, score, a.id, act, ship, cleanParts.length ? JSON.stringify({ parts: cleanParts }) : null]);
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
