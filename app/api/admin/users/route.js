import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { passwordError } from '@/lib/password';
import { siteScope } from '@/lib/site';

export const GET = route(async (req, ctx, user) => {
  const scope = await siteScope(user);
  const { rows } = await q(
    `SELECT u.id,u.name,u.username,u.dept,u.layer,u.access,u.template_id,t.name AS template,
            u.days,u.pool,u.start_idx,u.rotate_daily,u.active,u.site_id,s.code AS site
       FROM users u LEFT JOIN templates t ON t.id=u.template_id LEFT JOIN sites s ON s.id=u.site_id
      WHERE ($1::int IS NULL OR u.site_id=$1) ORDER BY u.layer DESC,u.dept,u.name`, [scope]);
  return json(rows);
}, { need: 'admin' });

export const POST = route(async (req, ctx, user) => {
  const b = await req.json();
  if (!b.name || !b.username) return err('Nombre y usuario requeridos');
  const bad = passwordError(b.password);
  if (bad) return err(bad);
  const password = String(b.password);
  const siteId = b.site_id ? Number(b.site_id) : await siteScope(user);
  if (!siteId && (b.access || 'auditor') !== 'admin') return err('Elige la planta del usuario');
  try {
    const { rows } = await q(
      `INSERT INTO users(name,username,pin_hash,dept,layer,access,template_id,days,pool,start_idx,rotate_daily,must_change,site_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,$12) RETURNING id`,
      [b.name.trim(), b.username.trim().toLowerCase(), await bcrypt.hash(password, 10), b.dept || 'production',
       Number(b.layer) || 1, b.access || 'auditor', b.template_id || null, b.days || [], b.pool || [],
       Number(b.start_idx) || 0, !!b.rotate_daily, siteId || null]);
    return json({ id: rows[0].id }, 201);
  } catch (e) {
    if (e.code === '23505') return err('Ese usuario ya existe');
    throw e;
  }
}, { need: 'admin' });
