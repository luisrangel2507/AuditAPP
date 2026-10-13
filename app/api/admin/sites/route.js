import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { isMaster } from '@/lib/roles';

// Estado de arranque de cada planta (checklist de onboarding)
export const GET = route(async (req, ctx, user) => {
  const { rows } = await q(
    `SELECT s.id,s.code,s.name,s.active,s.go_live,
            COUNT(u.id) FILTER (WHERE u.active)::int AS users,
            COUNT(u.id) FILTER (WHERE u.active AND u.layer=1)::int AS layer1,
            COUNT(u.id) FILTER (WHERE u.active AND u.layer>=2)::int AS managers,
            COUNT(u.id) FILTER (WHERE u.active AND u.template_id IS NULL)::int AS no_template,
            COUNT(u.id) FILTER (WHERE u.active AND u.must_change)::int AS pending_password,
            COUNT(u.id) FILTER (WHERE u.active AND NOT u.must_change)::int AS entered
       FROM sites s LEFT JOIN users u ON u.site_id=s.id AND u.access NOT IN ('admin','master')
      WHERE ($1::boolean OR s.id=$2)
      GROUP BY s.id ORDER BY s.id`, [isMaster(user), user.site_id ?? 0]);
  return json(rows);
}, { need: 'admin' });
