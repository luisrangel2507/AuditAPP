import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';

export const GET = route(async () => {
  const { rows } = await q(
    `SELECT u.id,u.name,u.username,u.dept,u.layer,u.access,u.template_id,t.name AS template,
            u.days,u.pool,u.start_idx,u.rotate_daily,u.active
       FROM users u LEFT JOIN templates t ON t.id=u.template_id ORDER BY u.layer DESC,u.dept,u.name`);
  return json(rows);
}, { need: 'admin' });

export const POST = route(async (req) => {
  const b = await req.json();
  if (!b.name || !b.username) return err('Nombre y usuario requeridos');
  const pin = String(b.pin || process.env.SEED_PIN || '1234');
  try {
    const { rows } = await q(
      `INSERT INTO users(name,username,pin_hash,dept,layer,access,template_id,days,pool,start_idx,rotate_daily)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [b.name.trim(), b.username.trim().toLowerCase(), await bcrypt.hash(pin, 10), b.dept || 'production',
       Number(b.layer) || 1, b.access || 'auditor', b.template_id || null, b.days || [], b.pool || [],
       Number(b.start_idx) || 0, !!b.rotate_daily]);
    return json({ id: rows[0].id }, 201);
  } catch (e) {
    if (e.code === '23505') return err('Ese usuario ya existe');
    throw e;
  }
}, { need: 'admin' });
