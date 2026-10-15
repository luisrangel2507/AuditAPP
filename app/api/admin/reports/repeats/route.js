export const dynamic = 'force-dynamic';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { range, repeats } from '@/lib/reports';
export const GET = route(async (req, ctx, user) => {
  const r = await range(new URL(req.url).searchParams.get('days'));
  return json({ items: await repeats({ ...r, scope: await siteScope(user) }) });
}, { need: 'admin' });
