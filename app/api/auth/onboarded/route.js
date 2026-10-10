import { q } from '@/lib/db';
import { route, json } from '@/lib/api';

// Marca la guía de primer ingreso como vista
export const POST = route(async (req, ctx, user) => {
  await q('UPDATE users SET onboarded=TRUE WHERE id=$1', [user.id]);
  return json({ ok: true });
});
