export const dynamic = 'force-dynamic';
import { route, json } from '@/lib/api';
import { pushPublicKey } from '@/lib/push';
export const GET = route(async () => json({ key: await pushPublicKey() }));
