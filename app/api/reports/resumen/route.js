export const dynamic = 'force-dynamic';
import { route, json, err } from '@/lib/api';
import { scopeUsers, periodOf, resumen } from '@/lib/resumen';

// Resumen semanal (por departamento) o mensual (GM) para quien lidera gente
export const GET = route(async (req, ctx, user) => {
  const sp = new URL(req.url).searchParams, period = sp.get('period') === 'month' ? 'month' : 'week';
  const sc = await scopeUsers(user, sp.get('dept'));
  if (!sc.ids.length) return err('No tienes personal a cargo para este reporte', 403);
  const p = periodOf(period, sp.get('date'));
  return json({ period, ...p, scope: sc.label, ...(await resumen(sc.ids, p)) });
});
