import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { passwordError } from '@/lib/password';

export const POST = route(async (req, ctx, user) => {
  const { password, new_password } = await req.json();
  const bad = passwordError(new_password);
  if (bad) return err(bad);
  const { rows } = await q('SELECT pin_hash FROM users WHERE id=$1', [user.id]);
  if (!(await bcrypt.compare(String(password || ''), rows[0].pin_hash))) return err('Contraseña actual incorrecta', 401);
  await q('UPDATE users SET pin_hash=$1, must_change=FALSE WHERE id=$2', [await bcrypt.hash(String(new_password), 10), user.id]);
  return json({ ok: true });
});
