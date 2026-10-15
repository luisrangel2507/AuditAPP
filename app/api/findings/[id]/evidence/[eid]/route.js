import { q } from '@/lib/db';
import { getUser } from '@/lib/session';
import { sameSite } from '@/lib/site';
import { isLead } from '@/lib/api';

export async function GET(req, { params }) {
  const user = await getUser();
  if (!user) return new Response('No autenticado', { status: 401 });
  const { rows: [r] } = await q(
    `SELECT e.data, a.user_id AS auditor_id, au.site_id,
            EXISTS(SELECT 1 FROM finding_owners o WHERE o.finding_id=f.id AND o.user_id=$3) AS is_owner
       FROM finding_evidence e JOIN findings f ON f.id=e.finding_id JOIN audits a ON a.id=f.audit_id JOIN users au ON au.id=a.user_id
      WHERE e.id=$1 AND e.finding_id=$2`, [params.eid, params.id, user.id]);
  if (!r) return new Response('No encontrada', { status: 404 });
  if (r.auditor_id !== user.id && !r.is_owner && !(isLead(user) && sameSite(user, r.site_id))) return new Response('Sin permiso', { status: 403 });
  if (r.data.startsWith('[archivada')) return new Response('Foto archivada', { status: 404 });
  const m = /^data:(image\/[a-z+.-]+);base64,(.*)$/s.exec(r.data);
  if (!m) return new Response('Formato inválido', { status: 500 });
  return new Response(Buffer.from(m[2], 'base64'), { headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=86400' } });
}
