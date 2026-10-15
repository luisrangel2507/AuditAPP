import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { joinBi } from '@/lib/bi';

// Guarda la versión vigente antes de cambiarla o borrarla
async function snapshot(id, change, user) {
  const { rows: [o] } = await q('SELECT id,text,category,item_no,active,version FROM questions WHERE id=$1', [id]);
  if (!o) return null;
  await q(`INSERT INTO question_versions(question_id,version,text,category,item_no,active,change,changed_by,changed_by_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [o.id, o.version, o.text, o.category, o.item_no, o.active, change, user.id, user.name]);
  return o;
}

export const PATCH = route(async (req, { params }, user) => {
  const b = await req.json();
  const sets = [], vals = [];
  const add = (c, v) => { vals.push(v); sets.push(`${c}=$${vals.length}`); };
  if (b.text_es !== undefined || b.text_en !== undefined) {
    const t = joinBi(b.text_es, b.text_en);
    if (!t) return err('La pregunta no puede quedar vacía');
    add('text', t);
  } else if (typeof b.text === 'string' && b.text.trim()) add('text', b.text.trim());
  if (typeof b.category === 'string') add('category', b.category.trim());
  if (typeof b.active === 'boolean') add('active', b.active);
  if (!sets.length) return err('Nada que cambiar');
  vals.push(params.id);
  if (!(await snapshot(params.id, 'edit', user))) return err('No encontrada', 404);
  sets.push('version=version+1');
  await q(`UPDATE questions SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
  return json({ ok: true });
}, { need: 'master' });

// Las respuestas históricas guardan el texto, así que borrar es seguro; se prefiere desactivar.
export const DELETE = route(async (req, { params }, user) => {
  await snapshot(params.id, 'delete', user);
  await q('DELETE FROM questions WHERE id=$1', [params.id]);
  return json({ ok: true });
}, { need: 'master' });
