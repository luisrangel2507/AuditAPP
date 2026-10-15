export const dynamic = 'force-dynamic';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { range, pareto } from '@/lib/reports';
export const GET = route(async (req, ctx, user) => {
  const sp = new URL(req.url).searchParams;
  const r = await range(sp.get('days'));
  return json({ ...r, ...(await pareto({ ...r, scope: await siteScope(user), by: sp.get('by') || 'item' })) });
}, { need: 'admin' });
