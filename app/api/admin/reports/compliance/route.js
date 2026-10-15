export const dynamic = 'force-dynamic';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { range, compliance } from '@/lib/reports';
export const GET = route(async (req, ctx, user) => {
  const r = await range(new URL(req.url).searchParams.get('days'));
  const rows = await compliance({ ...r, scope: await siteScope(user) });
  const t = rows.reduce((s, p) => ({ total: s.total + p.total, done: s.done + p.done }), { total: 0, done: 0 });
  return json({ ...r, rows, pct: t.total ? Math.round((t.done / t.total) * 1000) / 10 : 100, ...t });
}, { need: 'admin' });
