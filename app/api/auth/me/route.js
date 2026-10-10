import { route, json } from '@/lib/api';
export const GET = route(async (req, ctx, user) => json(user));
