export const dynamic = 'force-dynamic';
import { pool, q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { siteScope, sameSite } from '@/lib/site';
import { ensureWeek } from '@/lib/schedule';
import { mxToday, mondayOf, addDays } from '@/lib/dates';
import { SEED_MACHINES, ZONES } from '@/lib/zones';

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
  const gl = (await q(`SELECT value FROM settings WHERE key='go_live'`)).rows[0]?.value || '1970-01-01';
  const { rows } = await q(
    `SELECT a.id,a.user_id,a.date,a.due_date,a.area,a.part_number,a.status,
            u.name,u.dept,u.layer,u.pool,u.site_id, s.code AS site
       FROM audits a JOIN users u ON u.id=a.user_id LEFT JOIN sites s ON s.id=u.site_id
      WHERE a.date BETWEEN $1 AND $2 AND a.date >= $4 AND a.kind='lpa' AND ($3::int IS NULL OR u.site_id=$3)
      ORDER BY u.layer DESC,u.dept,u.name,a.date`, [monday, addDays(monday, 4), scope, gl]);
  const zones = [...new Set(rows.flatMap((r) => r.pool || []).concat(rows.map((r) => r.area)).filter(Boolean))].sort();
  const machines = {};
  for (const [z, list] of Object.entries(SEED_MACHINES)) machines[z] = [...list];
  const { rows: m } = await q(`SELECT DISTINCT zone, machine FROM audits WHERE zone <> '' AND machine <> ''`);
  for (const r of m) { const l = (machines[r.zone] ||= []); if (!l.includes(r.machine)) l.push(r.machine); }
  return json({ monday, today, days: [0, 1, 2, 3, 4].map((i) => addDays(monday, i)), audits: rows, zones, machines });
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
      // Layer 1: zona (y máquina opcional). Layer 2-4: "All Areas" o una zona; el N/P lo captura el auditor al auditar
      const area = String(it.area ?? '').trim().slice(0, 80) || (a.layer >= 2 ? 'All Areas' : '');
      const z = area.split(' · ')[0];
      await client.query('UPDATE audits SET area=$2' + (a.layer >= 2 ? ', zone=$3' : '') + ' WHERE id=$1',
        a.layer >= 2 ? [a.id, area, ZONES.includes(z) ? z : ''] : [a.id, area]);
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
