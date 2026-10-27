import bcrypt from 'bcryptjs';
import { resetEnsured } from '@/lib/schedule';
import { q } from '@/lib/db';
import { passwordError } from '@/lib/password';
import { route, json, err } from '@/lib/api';
import { isMaster, isAdmin } from '@/lib/roles';
import { mxToday } from '@/lib/dates';

const FIELDS = ['name', 'dept', 'layer', 'access', 'template_id', 'days', 'pool', 'start_idx', 'rotate_daily', 'active', 'site_id', 'process_per_day', 'process_template_id'];

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
  if (typeof b.lpa_enabled === 'boolean') {
    add('lpa_override', b.lpa_enabled);
    if (b.lpa_enabled) add('lpa_from', mxToday()); // al encenderla no se crean LPA de días que ya pasaron
  }
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
  // LPA apagada en su perfil (o por rol): se quitan las pendientes de hoy en adelante
  await q(
    `DELETE FROM audits a USING users u
      WHERE a.user_id=u.id AND u.id=$1 AND a.kind='lpa' AND a.status='pending' AND a.date>=$2
        AND NOT COALESCE(u.lpa_override, u.access NOT IN ('admin','master') AND (NOT (u.dept='quality' AND u.layer=1) OR COALESCE((SELECT value FROM settings WHERE key='qe_lpa_on'),'0')='1'))`, [params.id, mxToday()]);
  // Plantilla propia de la auditoría de proceso (p. ej. la especial de Proveedores): las pendientes sin iniciar se actualizan
  await q(
    `UPDATE audits a SET template_id=COALESCE(u.process_template_id,(SELECT id FROM templates WHERE name='QE Process Audit')),
            question_ids=COALESCE((SELECT array_agg(x.id ORDER BY x.sort_order,x.id) FROM questions x WHERE x.active AND x.template_id=COALESCE(u.process_template_id,(SELECT id FROM templates WHERE name='QE Process Audit'))), a.question_ids)
       FROM users u WHERE a.user_id=u.id AND u.id=$1 AND a.kind='process' AND a.status='pending' AND a.started_at IS NULL AND a.date>=$2
        AND a.template_id IS DISTINCT FROM COALESCE(u.process_template_id,(SELECT id FROM templates WHERE name='QE Process Audit'))`, [params.id, mxToday()]);
  resetEnsured();
  return json({ ok: true });
}, { need: 'admin' });
