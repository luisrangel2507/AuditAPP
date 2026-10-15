export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';

export const POST = route(async (req, ctx, user) => {
  const { endpoint, keys } = await req.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) return err('Suscripción inválida');
  await q(`INSERT INTO push_subs(user_id,endpoint,p256dh,auth) VALUES($1,$2,$3,$4)
           ON CONFLICT (endpoint) DO UPDATE SET user_id=$1,p256dh=$3,auth=$4`, [user.id, String(endpoint), keys.p256dh, keys.auth]);
  return json({ ok: true });
});
export const DELETE = route(async (req, ctx, user) => {
  const { endpoint } = await req.json().catch(() => ({}));
  if (endpoint) await q('DELETE FROM push_subs WHERE endpoint=$1 AND user_id=$2', [endpoint, user.id]);
  else await q('DELETE FROM push_subs WHERE user_id=$1', [user.id]);
  return json({ ok: true });
});
