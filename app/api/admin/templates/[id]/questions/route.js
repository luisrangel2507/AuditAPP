import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { joinBi, splitBi } from '@/lib/bi';

export const GET = route(async (req, { params }) => {
  const { rows } = await q(
    'SELECT id,text,category,active FROM questions WHERE template_id=$1 ORDER BY sort_order,id', [params.id]);
  return json(rows.map((r) => ({ ...r, text_es: splitBi(r.text).es, text_en: splitBi(r.text).en })));
}, { need: 'master' });

export const POST = route(async (req, { params }) => {
  const b = await req.json();
  const text = b.text_es !== undefined || b.text_en !== undefined ? joinBi(b.text_es, b.text_en) : String(b.text || '').trim();
  if (!text) return err('Escribe la pregunta en español (y en inglés)');
  const { rows } = await q(
    `INSERT INTO questions(template_id,text,category,sort_order)
     VALUES($1,$2,$3,(SELECT COALESCE(MAX(sort_order),0)+1 FROM questions WHERE template_id=$1)) RETURNING id`,
    [params.id, text, (b.category || '').trim()]);
  return json({ id: rows[0].id }, 201);
}, { need: 'master' });
