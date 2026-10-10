// Open issues: cada responsable da seguimiento por su cuenta; el issue se cierra cuando todos terminan.
export const issueNo = (id) => 'OI-' + String(id).padStart(4, '0');

export async function logUpdate(db, findingId, userId, kind, text = '') {
  await db.query('INSERT INTO finding_updates(finding_id,user_id,kind,text) VALUES($1,$2,$3,$4)', [findingId, userId || null, kind, text]);
}

export async function addOwner(db, findingId, ownerId, byId) {
  const r = await db.query(
    `INSERT INTO finding_owners(finding_id,user_id,added_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id`,
    [findingId, ownerId, byId || null]);
  if (r.rowCount) {
    const { rows } = await db.query('SELECT name FROM users WHERE id=$1', [ownerId]);
    await logUpdate(db, findingId, byId, 'assign', `Responsable agregado: ${rows[0]?.name || ownerId}`);
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
    const action = ow.map((o) => o.action).filter(Boolean).join(' | ');
    await db.query(`UPDATE findings SET status='closed',closed_at=NOW(),closed_by=$2,action=$3 WHERE id=$1`, [findingId, byId || null, action]);
    await logUpdate(db, findingId, byId, 'closed', 'Todos los responsables terminaron: issue cerrado');
  } else if (!allDone && f.status === 'closed') {
    await db.query(`UPDATE findings SET status=$2,closed_at=NULL,closed_by=NULL WHERE id=$1`, [findingId, anyProg ? 'in_progress' : 'open']);
    await logUpdate(db, findingId, byId, 'reopened', 'Issue reabierto');
  } else if (!allDone) {
    await db.query(`UPDATE findings SET status=$2 WHERE id=$1 AND status<>'closed'`, [findingId, anyProg ? 'in_progress' : 'open']);
  }
}
