import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
export const GET = route(async () => {
  const { rows } = await q(`SELECT id,name,dept,layer FROM users WHERE active ORDER BY name`);
  return json(rows);
});
