import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';

export const PATCH = route(async (req, { params }) => {
  const b = await req.json();
  const sets = [], vals = [];
  const add = (c, v) => { vals.push(v); sets.push(`${c}=$${vals.length}`); };
  if (typeof b.text === 'string' && b.text.trim()) add('text', b.text.trim());
  if (typeof b.category === 'string') add('category', b.category.trim());
  if (typeof b.active === 'boolean') add('active', b.active);
  if (!sets.length) return err('Nada que cambiar');
  vals.push(params.id);
  await q(`UPDATE questions SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
  return json({ ok: true });
}, { need: 'admin' });

// Las respuestas históricas guardan el texto, así que borrar es seguro; se prefiere desactivar.
export const DELETE = route(async (req, { params }) => {
  await q('DELETE FROM questions WHERE id=$1', [params.id]);
  return json({ ok: true });
}, { need: 'admin' });
