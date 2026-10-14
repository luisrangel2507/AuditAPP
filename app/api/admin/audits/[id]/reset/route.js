import { pool } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { sameSite } from '@/lib/site';
import { resetEnsured } from '@/lib/schedule';

// El admin elimina una auditoría realizada (p. ej. una de prueba) para que se vuelva a hacer.
// Se borran sus respuestas, hallazgos (issues) y avisos; la auditoría se genera de nuevo, pendiente.
export const POST = route(async (req, { params }, user) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [a] } = await client.query(
      `SELECT a.id,a.date,a.status,a.kind,a.slot,u.site_id,u.name FROM audits a JOIN users u ON u.id=a.user_id WHERE a.id=$1 FOR UPDATE OF a`, [params.id]);
    if (!a) { await client.query('ROLLBACK'); return err('No encontrada', 404); }
    if (!sameSite(user, a.site_id)) { await client.query('ROLLBACK'); return err('Sin permiso', 403); }
    if (a.status !== 'completed') { await client.query('ROLLBACK'); return err('Solo se pueden eliminar auditorías ya realizadas'); }
    const { rows: [f] } = await client.query(`SELECT COUNT(*)::int n FROM findings WHERE audit_id=$1`, [a.id]);
    await client.query('DELETE FROM findings WHERE audit_id=$1', [a.id]);
    await client.query('DELETE FROM audits WHERE id=$1', [a.id]);
    await client.query('COMMIT');
    resetEnsured();
    return json({ ok: true, name: a.name, date: a.date, kind: a.kind, slot: a.slot, findings_deleted: f.n });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('reset audit', e);
    return err('No se pudo eliminar', 500);
  } finally { client.release(); }
}, { need: 'admin' });
