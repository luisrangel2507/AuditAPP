export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { pending } from '@/lib/signoff';

// Sign-off (firma de revisión) del formato impreso: lo hace el encargado (gerente) de las personas que auditaron.
// Layer 1 → un sign-off por día; Layer 2 → por semana; Layer 3 → por mes.
export const GET = route(async (req, ctx, user) => json({ pending: await pending(user) }));

export const POST = route(async (req, ctx, user) => {
  const b = await req.json(), tid = Number(b.template_id), period = String(b.period || '');
  const ok = (await pending(user)).some((o) => o.template_id === tid && o.period === period);
  if (!ok) return err('Ese formato no está pendiente de tu firma', 403);
  await q('INSERT INTO signoffs(template_id,period,user_id,user_name) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [tid, period, user.id, user.name]);
  return json({ ok: true });
});
