import { pool, q } from '@/lib/db';
import { route, json, err, isLead } from '@/lib/api';
import { sameSite } from '@/lib/site';
import { addOwner, logUpdate, syncFinding } from '@/lib/issues';

// Línea de tiempo del issue
export const GET = route(async (req, { params }, user) => {
  const { rows: [f] } = await q(
    `SELECT f.id, a.user_id AS auditor_id, au.site_id, EXISTS(SELECT 1 FROM finding_owners o WHERE o.finding_id=f.id AND o.user_id=$2) AS is_owner
       FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users au ON au.id=a.user_id WHERE f.id=$1`, [params.id, user.id]);
  if (!f) return err('No encontrado', 404);
  if (!(isLead(user) && sameSite(user, f.site_id)) && f.auditor_id !== user.id && !f.is_owner) return err('Sin permiso', 403);
  const { rows } = await q(
    `SELECT fu.id,fu.kind,fu.text,fu.created_at,u.name FROM finding_updates fu LEFT JOIN users u ON u.id=fu.user_id
      WHERE fu.finding_id=$1 ORDER BY fu.id`, [params.id]);
  return json({ updates: rows });
});

export const PATCH = route(async (req, { params }, user) => {
  const b = await req.json();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [f] } = await client.query(
      `SELECT f.*, a.user_id AS auditor_id, au.site_id FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users au ON au.id=a.user_id WHERE f.id=$1 FOR UPDATE OF f`, [params.id]);
    if (!f) { await client.query('ROLLBACK'); return err('No encontrado', 404); }
    const lead = isLead(user) && sameSite(user, f.site_id);
    const { rows: [mine] } = await client.query('SELECT * FROM finding_owners WHERE finding_id=$1 AND user_id=$2', [f.id, user.id]);
    const closer = lead || f.auditor_id === user.id; // el líder o quien levantó el hallazgo pueden cerrarlo al momento
    const addEvidence = async (img) => {
      if (typeof img !== 'string' || !/^data:image\/[a-z+.-]+;base64,/.test(img) || img.length > 3_000_000) return;
      await client.query('INSERT INTO finding_evidence(finding_id,user_id,data) VALUES($1,$2,$3)', [f.id, user.id, img]);
    };
    const participant = lead || f.auditor_id === user.id || !!mine;
    if (!participant) { await client.query('ROLLBACK'); return err('Sin permiso', 403); }

    // Agregar responsable: líder, quien levantó el issue o un responsable existente
    if (b.add_owner) {
      const oid = Number(b.add_owner);
      const ok = await client.query('SELECT 1 FROM users WHERE id=$1 AND active', [oid]);
      if (!ok.rowCount) { await client.query('ROLLBACK'); return err('Usuario inválido'); }
      await addOwner(client, f.id, oid, user.id);
      if (f.status === 'closed') await syncFinding(client, f.id, user.id);
    }
    if (b.remove_owner) {
      if (!lead) { await client.query('ROLLBACK'); return err('Solo un líder puede quitar responsables', 403); }
      const r = await client.query('DELETE FROM finding_owners WHERE finding_id=$1 AND user_id=$2 RETURNING user_id', [f.id, Number(b.remove_owner)]);
      if (r.rowCount) { await logUpdate(client, f.id, user.id, 'unassign', 'Responsable removido'); await syncFinding(client, f.id, user.id); }
    }
    if (b.due_date !== undefined) {
      if (!lead) { await client.query('ROLLBACK'); return err('Solo un líder cambia el compromiso', 403); }
      await client.query('UPDATE findings SET due_date=$2 WHERE id=$1', [f.id, b.due_date || null]);
      await logUpdate(client, f.id, user.id, 'comment', `Fecha compromiso: ${b.due_date || 'sin fecha'}`);
    }
    if (typeof b.comment === 'string' && b.comment.trim()) await logUpdate(client, f.id, user.id, 'comment', b.comment.trim());

    // Seguimiento propio del responsable
    if (b.my_status) {
      if (!mine) { await client.query('ROLLBACK'); return err('No eres responsable de este issue', 403); }
      if (!['in_progress', 'done', 'open'].includes(b.my_status)) { await client.query('ROLLBACK'); return err('Estatus inválido'); }
      const action = typeof b.action === 'string' ? b.action.trim() : mine.action;
      if (b.my_status === 'done' && !action) { await client.query('ROLLBACK'); return err('Para terminar describe la acción tomada'); }
      if (b.my_status === 'done' && b.evidence) await addEvidence(b.evidence);
      await client.query(
        `UPDATE finding_owners SET status=$3,action=$4,done_at=$5 WHERE finding_id=$1 AND user_id=$2`,
        [f.id, user.id, b.my_status, action, b.my_status === 'done' ? new Date() : null]);
      await logUpdate(client, f.id, user.id, b.my_status === 'done' ? 'done' : 'progress',
        (b.my_status === 'done' ? 'Terminó su parte: ' : b.my_status === 'in_progress' ? 'En proceso: ' : 'Reabrió su parte: ') + (action || ''));
      await syncFinding(client, f.id, user.id);
    }

    // Cierre / reapertura forzada por un líder (por ejemplo, issue sin responsables)
    if (b.force_status) {
      if (b.force_status === 'closed' ? !closer : !lead) { await client.query('ROLLBACK'); return err('Sin permiso', 403); }
      if (b.force_status === 'closed') {
        if (b.evidence) await addEvidence(b.evidence);
        const action = String(b.action || '').trim();
        if (!action) { await client.query('ROLLBACK'); return err('Para cerrar describe la acción tomada'); }
        await client.query(`UPDATE findings SET status='closed',closed_at=NOW(),closed_by=$2,action=$3 WHERE id=$1`, [f.id, user.id, action]);
        await client.query(`UPDATE finding_owners SET status='done',done_at=COALESCE(done_at,NOW()) WHERE finding_id=$1`, [f.id]);
        await logUpdate(client, f.id, user.id, 'closed', `${lead ? 'Cerrado por líder' : 'Cerrado por el auditor'}: ${action}`);
      } else if (b.force_status === 'open') {
        await client.query(`UPDATE findings SET status='open',closed_at=NULL,closed_by=NULL WHERE id=$1`, [f.id]);
        await client.query(`UPDATE finding_owners SET status='open',done_at=NULL WHERE finding_id=$1`, [f.id]);
        await logUpdate(client, f.id, user.id, 'reopened', 'Reabierto por líder');
      }
    }
    await client.query('COMMIT');
    return json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('finding patch', e);
    return err('Error interno', 500);
  } finally { client.release(); }
});

// El admin puede eliminar un hallazgo (open issue) indicando la razón; queda registrado.
export const DELETE = route(async (req, { params }, user) => {
  const b = await req.json().catch(() => ({}));
  const reason = String(b.reason || '').trim().slice(0, 500);
  if (reason.length < 5) return err('Escribe la razón por la que se elimina');
  const { rows: [f] } = await q(
    `SELECT f.id,f.audit_id,f.question,f.notes,au.site_id FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users au ON au.id=a.user_id WHERE f.id=$1`, [params.id]);
  if (!f) return err('No encontrado', 404);
  if (!sameSite(user, f.site_id)) return err('Sin permiso', 403);
  await q(`INSERT INTO finding_deletions(finding_id,audit_id,question,notes,reason,deleted_by,deleted_by_name) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [f.id, f.audit_id, f.question, f.notes, reason, user.id, user.name]);
  await q('DELETE FROM findings WHERE id=$1', [f.id]);
  return json({ ok: true });
}, { need: 'admin' });
