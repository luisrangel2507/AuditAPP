export const dynamic = 'force-dynamic';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { weekly } from '@/lib/reports';
export const GET = route(async (req, ctx, user) => json(await weekly({ date: new URL(req.url).searchParams.get('date'), scope: await siteScope(user) })), { need: 'admin' });
