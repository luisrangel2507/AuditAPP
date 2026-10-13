export const dynamic = 'force-dynamic';
import { pool, q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { siteScope, sameSite } from '@/lib/site';
import { ensureWeek } from '@/lib/schedule';
import { mxToday, mondayOf, addDays } from '@/lib/dates';

// Semana de asignaciones: por auditor y día, la zona y el número de parte a inspeccionar.
export const GET = route(async (req, ctx, user) => {
  const scope = await siteScope(user);
  const today = mxToday();
  let date = new URL(req.url).searchParams.get('date') || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = today;
  const monday = mondayOf(date);
  const lim = (n) => addDays(mondayOf(today), n * 7);
  if (monday < lim(-8) || monday > lim(8)) return json({ monday, days: [], audits: [], zones: [], today });
  await ensureWeek(monday);
  const { rows } = await q(
    `SELECT a.id,a.user_id,a.date,a.due_date,a.area,a.part_number,a.status,
            u.name,u.dept,u.layer,u.pool,u.site_id, s.code AS site
       FROM audits a JOIN users u ON u.id=a.user_id LEFT JOIN sites s ON s.id=u.site_id
      WHERE a.date BETWEEN $1 AND $2 AND ($3::int IS NULL OR u.site_id=$3)
      ORDER BY u.layer DESC,u.dept,u.name,a.date`, [monday, addDays(monday, 4), scope]);
  const zones = [...new Set(rows.flatMap((r) => r.pool || []).concat(rows.map((r) => r.area)).filter(Boolean))].sort();
  return json({ monday, today, days: [0, 1, 2, 3, 4].map((i) => addDays(monday, i)), audits: rows, zones });
}, { need: 'admin' });

// Guarda varias asignaciones de una vez: [{ id, area, part_number }]. Solo auditorías pendientes.
export const PUT = route(async (req, ctx, user) => {
  const { items } = await req.json();
  if (!Array.isArray(items) || !items.length) return err('Nada que guardar');
  if (items.length > 500) return err('Demasiados cambios a la vez');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let saved = 0, skipped = 0;
    for (const it of items) {
      const { rows: [a] } = await client.query(
        `SELECT a.id,a.status,u.site_id,u.layer FROM audits a JOIN users u ON u.id=a.user_id WHERE a.id=$1 FOR UPDATE OF a`, [Number(it.id)]);
      if (!a || a.status !== 'pending' || !sameSite(user, a.site_id)) { skipped++; continue; }
      // Layer 3 y 4 siempre auditan todas las áreas y no llevan número de parte
      const fixed = a.layer >= 3;
      await client.query('UPDATE audits SET area=$2, part_number=$3 WHERE id=$1',
        [a.id, fixed ? 'All Areas' : String(it.area ?? '').trim().slice(0, 80), fixed ? '' : String(it.part_number ?? '').trim().slice(0, 40)]);
      saved++;
    }
    await client.query('COMMIT');
    return json({ ok: true, saved, skipped });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('assignments', e);
    return err('No se pudo guardar', 500);
  } finally { client.release(); }
}, { need: 'admin' });
