import { resetEnsured } from '@/lib/schedule';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
export const PATCH = route(async (req, { params }) => {
  resetEnsured();
  const b = await req.json();
  const per = Number(b.per_audit);
  if (!(per >= 1 && per <= 50)) return err('Preguntas por auditoría: entre 1 y 50');
  await q('UPDATE templates SET per_audit=$1 WHERE id=$2', [per, params.id]);
  return json({ ok: true });
}, { need: 'master' });
