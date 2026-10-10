import { q } from '@/lib/db';
import { route, json } from '@/lib/api';

// Estado de arranque de cada planta (checklist de onboarding)
export const GET = route(async () => {
  const { rows } = await q(
    `SELECT s.id,s.code,s.name,s.active,s.go_live,
            COUNT(u.id) FILTER (WHERE u.active)::int AS users,
            COUNT(u.id) FILTER (WHERE u.active AND u.layer=1)::int AS layer1,
            COUNT(u.id) FILTER (WHERE u.active AND u.layer>=2)::int AS managers,
            COUNT(u.id) FILTER (WHERE u.active AND u.template_id IS NULL)::int AS no_template,
            COUNT(u.id) FILTER (WHERE u.active AND u.must_change)::int AS pending_password,
            COUNT(u.id) FILTER (WHERE u.active AND NOT u.must_change)::int AS entered
       FROM sites s LEFT JOIN users u ON u.site_id=s.id AND u.access <> 'admin'
      GROUP BY s.id ORDER BY s.id`);
  return json(rows);
}, { need: 'admin' });
