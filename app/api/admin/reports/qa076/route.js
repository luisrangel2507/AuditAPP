export const dynamic = 'force-dynamic';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { qa076Data } from '@/lib/formsData';

export const GET = route(async (req, ctx, user) => json(await qa076Data(await siteScope(user), new URL(req.url).searchParams)), { need: 'admin' });
