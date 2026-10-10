import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';

export const GET = route(async (req, { params }) => {
  const { rows } = await q(
    'SELECT id,text,category,active FROM questions WHERE template_id=$1 ORDER BY sort_order,id', [params.id]);
  return json(rows);
}, { need: 'admin' });

export const POST = route(async (req, { params }) => {
  const b = await req.json();
  if (!String(b.text || '').trim()) return err('Texto requerido');
  const { rows } = await q(
    `INSERT INTO questions(template_id,text,category,sort_order)
     VALUES($1,$2,$3,(SELECT COALESCE(MAX(sort_order),0)+1 FROM questions WHERE template_id=$1)) RETURNING id`,
    [params.id, b.text.trim(), (b.category || '').trim()]);
  return json({ id: rows[0].id }, 201);
}, { need: 'admin' });
