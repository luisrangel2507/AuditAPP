import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { passwordError } from '@/lib/password';
import { siteScope } from '@/lib/site';
import { isMaster } from '@/lib/roles';

export const GET = route(async (req, ctx, user) => {
  const scope = await siteScope(user);
  const { rows } = await q(
    `SELECT u.id,u.name,u.username,u.dept,u.layer,u.access,u.template_id,t.name AS template,
            u.days,u.pool,u.start_idx,u.rotate_daily,u.active,u.site_id,s.code AS site
       FROM users u LEFT JOIN templates t ON t.id=u.template_id LEFT JOIN sites s ON s.id=u.site_id
      WHERE ($1::int IS NULL OR u.site_id=$1) AND ($2::boolean OR u.access <> 'master') ORDER BY u.layer DESC,u.dept,u.name`, [scope, isMaster(user)]);
  return json(rows);
}, { need: 'admin' });

export const POST = route(async (req, ctx, user) => {
  const b = await req.json();
  if (!b.name || !b.username) return err('Nombre y usuario requeridos');
  const bad = passwordError(b.password);
  if (bad) return err(bad);
  const password = String(b.password);
  const access = b.access || 'auditor';
  if (!['auditor', 'lead', 'admin', 'master'].includes(access)) return err('Rol inválido');
  if (access === 'master' && !isMaster(user)) return err('Solo el máster puede crear otro máster', 403);
  const layer = Number(b.layer) || 1;
  if (![1, 2, 3, 4].includes(layer)) return err('Capa inválida (1 a 4)');
  // El máster elige la planta; el administrador solo crea usuarios de su planta
  const siteId = isMaster(user) ? (b.site_id ? Number(b.site_id) : await siteScope(user)) : user.site_id;
  if (!siteId && access !== 'master') return err('Elige la planta del usuario');
  try {
    const { rows } = await q(
      `INSERT INTO users(name,username,pin_hash,dept,layer,access,template_id,days,pool,start_idx,rotate_daily,must_change,site_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,$12) RETURNING id`,
      [b.name.trim(), b.username.trim().toLowerCase(), await bcrypt.hash(password, 10), b.dept || 'production',
       layer, access, b.template_id || null, b.days || [], b.pool || [],
       Number(b.start_idx) || 0, !!b.rotate_daily, access === 'master' ? null : siteId]);
    return json({ id: rows[0].id }, 201);
  } catch (e) {
    if (e.code === '23505') return err('Ese usuario ya existe');
    throw e;
  }
}, { need: 'admin' });
