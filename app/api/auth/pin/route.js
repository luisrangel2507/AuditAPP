import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';

export const POST = route(async (req, ctx, user) => {
  const { pin, new_pin } = await req.json();
  if (!/^\d{4,8}$/.test(String(new_pin || ''))) return err('El PIN nuevo debe tener de 4 a 8 dígitos');
  const { rows } = await q('SELECT pin_hash FROM users WHERE id=$1', [user.id]);
  if (!(await bcrypt.compare(String(pin || ''), rows[0].pin_hash))) return err('PIN actual incorrecto', 401);
  await q('UPDATE users SET pin_hash=$1, must_change=FALSE WHERE id=$2', [await bcrypt.hash(String(new_pin), 10), user.id]);
  return json({ ok: true });
});
