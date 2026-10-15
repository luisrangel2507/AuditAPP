export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';

// Versiones anteriores de una pregunta (las auditorías ya hechas conservan el texto con el que se contestaron)
export const GET = route(async (req, { params }) => {
  const { rows: [cur] } = await q('SELECT id,text,category,item_no,active,version FROM questions WHERE id=$1', [params.id]);
  const { rows } = await q('SELECT version,text,category,item_no,change,changed_by_name,created_at FROM question_versions WHERE question_id=$1 ORDER BY version DESC', [params.id]);
  return json({ current: cur || null, versions: rows });
}, { need: 'master' });
