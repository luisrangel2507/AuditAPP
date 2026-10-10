import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { mxToday } from '@/lib/dates';

// Renombrar, poner en marcha o pausar una planta
export const PATCH = route(async (req, { params }) => {
  const b = await req.json();
  const { rows: [s] } = await q('SELECT * FROM sites WHERE id=$1', [params.id]);
  if (!s) return err('Planta no encontrada', 404);
  const sets = [], vals = [];
  const add = (c, v) => { vals.push(v); sets.push(`${c}=$${vals.length}`); };
  if (typeof b.name === 'string') {
    if (!b.name.trim()) return err('El nombre no puede quedar vacío');
    add('name', b.name.trim());
  }
  if (b.go_live !== undefined) {
    if (b.go_live && !/^\d{4}-\d{2}-\d{2}$/.test(b.go_live)) return err('Fecha de arranque inválida');
    add('go_live', b.go_live || null);
  }
  if (typeof b.active === 'boolean') {
    if (b.active) {
      const { rows: [c] } = await q(
        `SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE template_id IS NULL)::int nt FROM users WHERE site_id=$1 AND active AND access <> 'admin'`, [s.id]);
      if (!c.n) return err('Carga primero los usuarios de la planta');
      if (c.nt) return err(`Hay ${c.nt} usuario(s) sin plantilla de preguntas`);
      if (!s.go_live && b.go_live === undefined) add('go_live', mxToday());
    }
    add('active', b.active);
  }
  if (!sets.length) return err('Nada que cambiar');
  vals.push(s.id);
  await q(`UPDATE sites SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
  return json({ ok: true });
}, { need: 'admin' });
