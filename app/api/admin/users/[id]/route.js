import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { passwordError } from '@/lib/password';
import { route, json, err } from '@/lib/api';

const FIELDS = ['name', 'dept', 'layer', 'access', 'template_id', 'days', 'pool', 'start_idx', 'rotate_daily', 'active', 'site_id'];

export const PATCH = route(async (req, { params }, user) => {
  const b = await req.json();
  const sets = [], vals = [];
  const add = (c, v) => { vals.push(v); sets.push(`${c}=$${vals.length}`); };
  for (const f of FIELDS) if (b[f] !== undefined) add(f, b[f] === '' ? null : b[f]);
  if (b.reset_password) {
    const bad = passwordError(b.reset_password);
    if (bad) return err(bad);
    add('pin_hash', await bcrypt.hash(String(b.reset_password), 10)); add('must_change', true);
  }
  if (!sets.length) return err('Nada que cambiar');
  if (Number(params.id) === user.id && (b.active === false || (b.access && b.access !== 'admin')))
    return err('No puedes quitarte tu propio acceso de admin');
  vals.push(params.id);
  await q(`UPDATE users SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
  return json({ ok: true });
}, { need: 'admin' });
