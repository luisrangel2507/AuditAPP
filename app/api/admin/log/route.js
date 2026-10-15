export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';

// Registro del administrador: cambios + eliminaciones (con su razón)
export const GET = route(async (req, ctx, user) => {
  const scope = await siteScope(user);
  const { rows } = await q(
    `SELECT * FROM (
       SELECT 'cambio' AS kind, created_at, user_name AS who, action AS title, detail AS reason, detail FROM admin_log WHERE ($1::int IS NULL OR site_id=$1 OR site_id IS NULL)
       UNION ALL
       SELECT 'auditoria', created_at, deleted_by_name, 'Auditoría eliminada: '||COALESCE(auditor,'')||' · '||COALESCE(to_char(audit_date,'DD Mon'),'')||CASE WHEN kind='process' THEN ' · proceso '||COALESCE(slot::text,'') ELSE '' END,
              reason, '' FROM audit_deletions WHERE ($1::int IS NULL OR site_id=$1)
       UNION ALL
       SELECT 'hallazgo', created_at, deleted_by_name, 'Hallazgo eliminado: OI-'||lpad(finding_id::text,4,'0')||' · '||left(split_part(COALESCE(question,''),E'\\n',1),70),
              reason, '' FROM finding_deletions
     ) t ORDER BY created_at DESC LIMIT 200`, [scope]);
  return json({ items: rows });
}, { need: 'admin' });
