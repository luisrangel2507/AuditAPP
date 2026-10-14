import bcrypt from 'bcryptjs';
import { resetEnsured } from '@/lib/schedule';
import { q } from '@/lib/db';
import { passwordError } from '@/lib/password';
import { route, json, err } from '@/lib/api';
import { isMaster, isAdmin } from '@/lib/roles';
import { mxToday } from '@/lib/dates';

const FIELDS = ['name', 'dept', 'layer', 'access', 'template_id', 'days', 'pool', 'start_idx', 'rotate_daily', 'active', 'site_id'];

export const PATCH = route(async (req, { params }, user) => {
  const b = await req.json();
  const { rows: [target] } = await q('SELECT id,site_id,access FROM users WHERE id=$1', [params.id]);
  if (!target) return err('Usuario no encontrado', 404);
  if (!isMaster(user)) {
    // El administrador solo gestiona usuarios de su planta, no toca al máster ni cambia plantas ni otorga máster
    if (target.site_id !== user.site_id || target.access === 'master') return err('Sin permiso sobre ese usuario', 403);
    if (b.access === 'master') return err('Solo el máster puede otorgar ese rol', 403);
    if (b.site_id !== undefined && Number(b.site_id) !== user.site_id) return err('Solo el máster cambia de planta a un usuario', 403);
  }
  if (b.layer !== undefined && ![1, 2, 3, 4].includes(Number(b.layer))) return err('Capa inválida (1 a 4)');
  if (b.access !== undefined && !['auditor', 'lead', 'admin', 'master'].includes(b.access)) return err('Rol inválido');
  const sets = [], vals = [];
  const add = (c, v) => { vals.push(v); sets.push(`${c}=$${vals.length}`); };
  for (const f of FIELDS) if (b[f] !== undefined) add(f, b[f] === '' ? null : b[f]);
  if (b.reset_password) {
    const bad = passwordError(b.reset_password);
    if (bad) return err(bad);
    add('pin_hash', await bcrypt.hash(String(b.reset_password), 10)); add('must_change', true);
  }
  if (!sets.length) return err('Nada que cambiar');
  if (Number(params.id) === user.id && (b.active === false || (b.access && !isAdmin({ access: b.access }))))
    return err('No puedes quitarte tu propio acceso de administración');
  vals.push(params.id);
  await q(`UPDATE users SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
  // Quita las auditorías pendientes que ya no le corresponden (cambio de días, capa, rol o baja)
  await q(
    `DELETE FROM audits a USING users u
      WHERE a.user_id=u.id AND u.id=$1 AND a.kind='lpa' AND a.status='pending' AND a.date>=$2
        AND (NOT u.active OR u.access IN ('admin','master')
          OR (u.layer=1 AND (a.date<>a.due_date OR NOT (EXTRACT(ISODOW FROM a.date)::int = ANY(u.days))))
          OR (u.layer>=2 AND a.date=a.due_date))`, [params.id, mxToday()]);
  resetEnsured();
  return json({ ok: true });
}, { need: 'admin' });
