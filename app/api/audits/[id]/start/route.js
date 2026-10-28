import { q } from '@/lib/db';
import { shiftOf } from '@/lib/dates';
import { route, json, err } from '@/lib/api';

// Marca la hora en que el auditor abrió la auditoría (solo la primera vez).
export const POST = route(async (req, { params }, user) => {
  const { rows } = await q('SELECT user_id,status FROM audits WHERE id=$1', [params.id]);
  const a = rows[0];
  if (!a) return err('No encontrada', 404);
  if (a.user_id !== user.id) return err('Esta auditoría no es tuya', 403);
  if (a.status === 'completed') return json({ ok: true });
  await q('UPDATE audits SET started_at=COALESCE(started_at,NOW()), shift=COALESCE(shift,$2) WHERE id=$1', [params.id, shiftOf()]);
  return json({ ok: true });
});
