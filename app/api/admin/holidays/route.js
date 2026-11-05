export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { resetEnsured } from '@/lib/schedule';
import { mxToday, addDays } from '@/lib/dates';

// Días festivos: ese día no se programan ni se exigen auditorías
export const GET = route(async () => {
  const { rows } = await q(`SELECT date::text AS date, name FROM holidays WHERE date >= $1 ORDER BY date`, [addDays(mxToday(), -60)]);
  return json({ rows });
}, { need: 'admin' });

export const POST = route(async (req, ctx, user) => {
  const b = await req.json(), date = String(b.date || ''), name = String(b.name || '').trim().slice(0, 80) || 'Día festivo';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('Elige una fecha válida');
  await q(`INSERT INTO holidays(date,name,created_by) VALUES($1,$2,$3) ON CONFLICT (date) DO UPDATE SET name=EXCLUDED.name`, [date, name, user.id]);
  // Quita las auditorías diarias que aún no se empiezan ese día (las semanales/mensuales se conservan)
  const r = await q(`DELETE FROM audits WHERE date=$1 AND due_date=date AND status='pending' AND started_at IS NULL`, [date]);
  resetEnsured();
  return json({ ok: true, removed: r.rowCount });
}, { need: 'admin' });

export const DELETE = route(async (req) => {
  const date = new URL(req.url).searchParams.get('date') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('Fecha inválida');
  await q('DELETE FROM holidays WHERE date=$1', [date]);
  resetEnsured();
  return json({ ok: true });
}, { need: 'admin' });
