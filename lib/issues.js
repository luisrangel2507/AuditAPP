import { notify } from './notify';
// Open issues: cada responsable da seguimiento por su cuenta; el issue se cierra cuando todos terminan.
export const issueNo = (id) => 'OI-' + String(id).padStart(4, '0');

export async function logUpdate(db, findingId, userId, kind, text = '') {
  await db.query('INSERT INTO finding_updates(finding_id,user_id,kind,text) VALUES($1,$2,$3,$4)', [findingId, userId || null, kind, text]);
}

// Destinatarios de los hallazgos de una auditoría LPA: supervisores que cubren esa zona (Layer 1 con la zona en sus áreas) y sus gerentes
export async function areaRecipients(db, a) {
  const zone = String(a.zone || String(a.area || '').split(' · ')[0] || '');
  const { rows } = await db.query(`SELECT id,pool FROM users WHERE active AND layer=1 AND id<>$1 AND dept NOT IN ('quality','hr') AND site_id IS NOT DISTINCT FROM (SELECT site_id FROM users WHERE id=$1)`, [a.user_id]);
  const covers = (u) => {
    const p = u.pool || [];
    if (!p.length || p.length >= 4 || p.some((e) => /^all areas$/i.test(e))) return false; // generalistas (p. ej. Process Engineers) no cuentan
    return p.some((e) => { const g = /^ZONA ([A-E](?:-[A-E])?)$/i.exec(String(e).trim()); if (g) return /^[A-E]\d$/.test(zone) && g[1].toUpperCase().replace('-', '').includes(zone[0]); return e === zone || String(e).startsWith(zone + ' ·'); });
  };
  const supervisors = rows.filter(covers).map((u) => u.id);
  const managers = new Set();
  for (const s of supervisors) for (const m of await managersOf(db, s)) managers.add(m);
  return { supervisors, managers: [...managers] };
}

// Gerentes de una persona: su "Reporta a" y, si no tiene, los Layer 2 activos de su departamento
export async function managersOf(db, userId) {
  const { rows: [u] } = await db.query('SELECT id,dept,site_id,manager_id FROM users WHERE id=$1', [userId]);
  if (!u) return [];
  if (u.manager_id) return [u.manager_id];
  const { rows } = await db.query(`SELECT id FROM users WHERE active AND layer=2 AND dept=$1 AND site_id IS NOT DISTINCT FROM $2 AND id<>$3 AND access NOT IN ('admin','master')`, [u.dept, u.site_id, u.id]);
  return rows.map((r) => r.id);
}

export async function addOwner(db, findingId, ownerId, byId) {
  const r = await db.query(
    `INSERT INTO finding_owners(finding_id,user_id,added_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id`,
    [findingId, ownerId, byId || null]);
  if (r.rowCount) {
    const { rows } = await db.query('SELECT name FROM users WHERE id=$1', [ownerId]);
    await logUpdate(db, findingId, byId, 'assign', `Responsable agregado: ${rows[0]?.name || ownerId}`);
    if (ownerId !== byId) {
      const { rows: [f] } = await db.query('SELECT f.question,f.due_date,u.site_id FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id WHERE f.id=$1', [findingId]);
      await notify({ db, userId: ownerId, siteId: f?.site_id ?? null, type: 'issue_assigned', link: `/findings#oi-${findingId}`,
        message: `Se te asignó el issue ${issueNo(findingId)}: ${String(f?.question || '').split('\n')[0].slice(0, 90)}${f?.due_date ? ` (compromiso ${f.due_date})` : ''}. Escribe tu acción y tu fecha de cierre.`, dedupe: `asg:${findingId}:${ownerId}` });
      // Su gerente también se entera (solo responsable y gerentes reciben avisos del issue)
      for (const mid of await managersOf(db, ownerId)) {
        if (mid === ownerId || mid === byId) continue;
        await notify({ db, userId: mid, siteId: f?.site_id ?? null, type: 'issue_assigned_mgr', link: `/findings#oi-${findingId}`,
          message: `Se asignó a ${rows[0]?.name || 'tu equipo'} el issue ${issueNo(findingId)}: ${String(f?.question || '').split('\n')[0].slice(0, 80)}`, dedupe: `asgm:${findingId}:${ownerId}:${mid}` });
      }
    }
  }
  return r.rowCount > 0;
}

// Recalcula el estatus global a partir de los responsables.
export async function syncFinding(db, findingId, byId) {
  const { rows: [f] } = await db.query('SELECT status FROM findings WHERE id=$1', [findingId]);
  const { rows: ow } = await db.query('SELECT status,action FROM finding_owners WHERE finding_id=$1', [findingId]);
  if (!f || !ow.length) return;
  const allDone = ow.every((o) => o.status === 'done');
  const anyProg = ow.some((o) => o.status !== 'open');
  if (allDone && f.status !== 'closed') {
    // Cada responsable cierra sus acciones; quien abrió el issue aprueba que estén correctas para cerrarlo
    const action = ow.map((o) => o.action).filter(Boolean).join(' | ');
    if (f.status !== 'review') {
      await db.query(`UPDATE findings SET status='review',action=$2 WHERE id=$1`, [findingId, action]);
      await logUpdate(db, findingId, byId, 'review', 'Todos los responsables terminaron: pendiente de aprobación de quien abrió el issue');
      const { rows: [o] } = await db.query('SELECT a.user_id,au.site_id,f.question FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users au ON au.id=a.user_id WHERE f.id=$1', [findingId]);
      if (o) await notify({ db, userId: o.user_id, siteId: o.site_id, type: 'issue_review', link: `/findings#oi-${findingId}`,
        message: `Revisa y aprueba el cierre de ${issueNo(findingId)}: ${String(o.question || '').split('\n')[0].slice(0, 80)}`, dedupe: `rev:${findingId}:${Date.now()}` });
    }
  } else if (!allDone && f.status === 'closed') {
    await db.query(`UPDATE findings SET status=$2,closed_at=NULL,closed_by=NULL WHERE id=$1`, [findingId, anyProg ? 'in_progress' : 'open']);
    await logUpdate(db, findingId, byId, 'reopened', 'Issue reabierto');
  } else if (!allDone) {
    await db.query(`UPDATE findings SET status=$2 WHERE id=$1 AND status<>'closed'`, [findingId, anyProg ? 'in_progress' : 'open']);
  }
}
