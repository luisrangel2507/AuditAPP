import { q } from '@/lib/db';
import { getUser } from '@/lib/session';

export async function GET(req, { params }) {
  const user = await getUser();
  if (!user) return new Response('No autenticado', { status: 401 });
  const { rows } = await q(
    `SELECT r.evidence, a.user_id FROM responses r JOIN audits a ON a.id=r.audit_id WHERE r.id=$1`, [params.id]);
  const r = rows[0];
  if (!r || !r.evidence) return new Response('No encontrada', { status: 404 });
  if (r.user_id !== user.id && !['lead', 'admin'].includes(user.access)) return new Response('Sin permiso', { status: 403 });
  const m = /^data:(image\/[a-z+.-]+);base64,(.*)$/s.exec(r.evidence);
  if (!m) return new Response('Formato inválido', { status: 500 });
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=86400' },
  });
}
