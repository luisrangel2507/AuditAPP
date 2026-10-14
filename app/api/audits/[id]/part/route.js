import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';

// Corregir el número de parte (el auditor, aun después de terminar). Queda marcado como corregido y se guarda el original.
export const POST = route(async (req, { params }, user) => {
  const b = await req.json();
  const { rows: [a] } = await q('SELECT user_id,part_number,part_original FROM audits WHERE id=$1', [params.id]);
  if (!a) return err('No encontrada', 404);
  if (a.user_id !== user.id) return err('Solo quien hizo la auditoría puede corregir el número de parte', 403);
  const p1 = String(b.part_number || '').trim().slice(0, 40), p2 = String(b.part_number2 || '').trim().slice(0, 40);
  if (!p1) return err('Captura el número de parte');
  const part = p2 ? `${p1} / ${p2}` : p1;
  if (part === a.part_number) return json({ ok: true, part_number: part, unchanged: true });
  await q('UPDATE audits SET part_number=$2, part_original=COALESCE(part_original,$3), part_edited_at=NOW() WHERE id=$1', [params.id, part, a.part_number]);
  return json({ ok: true, part_number: part });
});
