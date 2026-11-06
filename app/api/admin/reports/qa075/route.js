export const dynamic = 'force-dynamic';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { qa075Data } from '@/lib/formsData';

export const GET = route(async (req, ctx, user) => json(await qa075Data(await siteScope(user), new URL(req.url).searchParams)), { need: 'admin' });
