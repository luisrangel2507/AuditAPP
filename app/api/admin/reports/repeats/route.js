export const dynamic = 'force-dynamic';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { range, repeats } from '@/lib/reports';
export const GET = route(async (req, ctx, user) => {
  const sp = new URL(req.url).searchParams, r = await range(sp.get('days'), sp.get('from'), sp.get('to'));
  return json({ items: await repeats({ ...r, scope: await siteScope(user) }) });
}, { need: 'admin' });
