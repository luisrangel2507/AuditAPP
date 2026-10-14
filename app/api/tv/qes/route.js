export const dynamic = 'force-dynamic';
import { timingSafeEqual } from 'crypto';
import { q } from '@/lib/db';
import { getUser } from '@/lib/session';
import { isAdmin, isMaster } from '@/lib/roles';
import { siteScope } from '@/lib/site';
import { json, err } from '@/lib/api';
import { ensureWeek } from '@/lib/schedule';
import { mxToday, mondayOf, addDays, windowState } from '@/lib/dates';

// TV de auditorías de proceso de los QEs: sesión de admin o ?key=TV_KEY (pantalla de planta sin login)
function keyOk(k) {
  const expected = process.env.TV_KEY || '';
  if (!expected || !k) return false;
  const a = Buffer.from(String(k)), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams;
    const code = sp.get('site');
    const byCode = async () => (await q('SELECT id FROM sites WHERE code=$1', [code])).rows[0]?.id ?? 0;
    let scope = null;
    if (keyOk(sp.get('key'))) {
      if (code) scope = await byCode();
    } else {
      const u = await getUser();
      if (!u) return err('No autorizado', 401);
      if (!isAdmin(u)) return err('Sin permiso', 403);
      scope = isMaster(u) && code ? await byCode() : await siteScope(u);
    }
    const site = scope == null ? null : (await q('SELECT code,name FROM sites WHERE id=$1', [scope])).rows[0] || null;
    const today = mxToday(), monday = mondayOf(today);
    await ensureWeek(monday);
    const gl = (await q(`SELECT value FROM settings WHERE key='go_live'`)).rows[0]?.value || '1970-01-01';
    const { rows } = await q(
      `SELECT a.id,a.user_id,u.name,a.date,a.due_date,a.slot,a.area,a.status,a.score_pct,a.nok_count+a.partial_count AS findings,
              a.completed_at
         FROM audits a JOIN users u ON u.id=a.user_id
        WHERE a.kind='process' AND a.date BETWEEN $1 AND $2 AND a.date >= $3 AND u.active
          AND u.access NOT IN ('admin','master') AND ($4::int IS NULL OR u.site_id=$4)
        ORDER BY u.name,a.date,a.slot`, [monday, addDays(monday, 4), gl, scope]);
    const items = rows.map((a) => ({ ...a, score: a.score_pct == null ? null : Number(a.score_pct), window: windowState(a, today) }));
    const people = {};
    for (const a of items) {
      const p = (people[a.user_id] ||= { id: a.user_id, name: a.name, today: [], week_total: 0, week_done: 0, missed: 0, days: {} });
      p.week_total++;
      if (a.status === 'completed') p.week_done++;
      else if (a.due_date < today) p.missed++;
      if (a.date === today) p.today.push({ slot: a.slot, status: a.status, window: a.window, score: a.score, findings: a.findings });
      (p.days[a.date] ||= []).push(a.status === 'completed' ? 'ok' : a.due_date < today ? 'bad' : '');
    }
    const list = Object.values(people).sort((x, y) => x.name.localeCompare(y.name));
    const todayItems = items.filter((a) => a.date === today);
    const counted = items.filter((a) => a.status === 'completed' || a.due_date < today);
    const done = items.filter((a) => a.status === 'completed');
    const sc = done.filter((a) => a.score != null);
    return json({
      today, site, days: [0, 1, 2, 3, 4].map((i) => addDays(monday, i)),
      kpi: {
        today_total: todayItems.length, today_done: todayItems.filter((a) => a.status === 'completed').length,
        week_total: items.length, week_done: done.length,
        week_pct: counted.length ? Math.round((done.length / counted.length) * 1000) / 10 : null,
        avg_score: sc.length ? Math.round((sc.reduce((s, a) => s + a.score, 0) / sc.length) * 10) / 10 : null,
        findings: done.reduce((s, a) => s + Number(a.findings), 0),
        missed: items.filter((a) => a.status !== 'completed' && a.due_date < today).length,
      },
      people: list,
      doneToday: todayItems.filter((a) => a.status === 'completed').sort((x, y) => String(y.completed_at).localeCompare(String(x.completed_at)))
        .map((a) => ({ id: a.id, name: a.name, slot: a.slot, area: a.area, score: a.score, findings: Number(a.findings) })),
    });
  } catch (e) {
    console.error('tv/qes', e);
    return err('Error interno', 500);
  }
}
