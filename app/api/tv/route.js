export const dynamic = 'force-dynamic';
import { timingSafeEqual } from 'crypto';
import { q } from '@/lib/db';
import { getUser } from '@/lib/session';
import { isAdmin, isMaster } from '@/lib/roles';
import { MULTI_SITE, HOME_SITE } from '@/lib/config';
import { siteScope } from '@/lib/site';
import { json, err } from '@/lib/api';
import { mxToday, mondayOf, addDays, windowState } from '@/lib/dates';

// LPA TV: acceso con sesión de líder/admin, o con ?key=TV_KEY para la pantalla de planta (sin login).
function keyOk(k) {
  const expected = process.env.TV_KEY || '';
  if (!expected || !k) return false;
  const a = Buffer.from(String(k)), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const mxDay = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(ts));

export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams;
    const code = sp.get('site');
    const byCode = async () => (await q('SELECT id FROM sites WHERE code=$1', [code])).rows[0]?.id ?? 0;
    let scope = null; // null = todas las plantas
    if (keyOk(sp.get('key'))) {
      if (code) scope = await byCode();
    } else {
      const u = await getUser();
      if (!u) return err('No autorizado', 401);
      if (!isAdmin(u)) return err('Sin permiso', 403);
      scope = isMaster(u) && code ? await byCode() : await siteScope(u);
    }
    const site = scope == null ? null : (await q('SELECT code,name FROM sites WHERE id=$1', [scope])).rows[0] || null;
    const today = mxToday();
    const monday = mondayOf(today);
    const gl = (await q(`SELECT value FROM settings WHERE key='go_live'`)).rows[0]?.value || '1970-01-01';

    // La ventana más larga (viernes + 1 = sábado) nunca cruza a la semana siguiente,
    // así que basta con la semana en curso.
    const { rows } = await q(
      `SELECT a.id,a.date,a.due_date,a.area,a.part_number,a.status,a.score_pct,a.late,a.completed_at,
              a.nok_count,a.partial_count,u.name,u.dept,u.layer
         FROM audits a JOIN users u ON u.id=a.user_id
        WHERE a.kind='lpa' AND a.date BETWEEN $1 AND $2 AND a.date >= $3 AND ($4::int IS NULL OR u.site_id=$4)
        ORDER BY u.layer DESC,u.name`,
      [monday, addDays(monday, 4), gl, scope]);
    const wk = rows.map((a) => ({ ...a, window: windowState(a, today) }));

    const scheduled = wk.filter((a) => a.layer === 1 && a.date === today);
    const mgmt = wk.filter((a) => a.layer >= 2);
    const missed = wk.filter((a) => a.window === 'missed');
    const doneTodayList = wk.filter((a) => a.status === 'completed' && a.completed_at && mxDay(a.completed_at) === today)
      .sort((x, y) => new Date(y.completed_at) - new Date(x.completed_at));

    // Cumplimiento semanal: solo cuenta lo completado o lo que ya no se puede hacer
    const counted = wk.filter((a) => a.status === 'completed' || a.window === 'missed');
    const done = counted.filter((a) => a.status === 'completed');
    const byLayer = [1, 2, 3, 4].map((l) => {
      const c = counted.filter((a) => a.layer === l);
      return { layer: l, counted: c.length, done: c.filter((a) => a.status === 'completed').length };
    });
    const scores = done.map((a) => Number(a.score_pct)).filter((n) => !isNaN(n));
    const { rows: f } = await q(
      `SELECT COUNT(*)::int open, COUNT(*) FILTER (WHERE f.due_date < $1)::int overdue
         FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id
        WHERE f.status <> 'closed' AND ($2::int IS NULL OR u.site_id=$2)`,
      [today, scope]);

    // Semana anterior (para el cambio vs. semana pasada): todo lo que ya cerró su ventana
    const pm = addDays(monday, -7);
    const { rows: pr } = await q(
      `SELECT a.status, a.score_pct FROM audits a JOIN users u ON u.id=a.user_id
        WHERE a.kind='lpa' AND a.date BETWEEN $1 AND $2 AND a.date >= $3 AND ($4::int IS NULL OR u.site_id=$4)
          AND (a.status='completed' OR a.due_date < $5::date)`,
      [pm, addDays(pm, 4), gl, scope, today]);
    const pDone = pr.filter((a) => a.status === 'completed');
    const pScores = pDone.map((a) => Number(a.score_pct)).filter((n) => !isNaN(n));
    const prev = {
      week_pct: pr.length ? Math.round((pDone.length / pr.length) * 100) : null,
      avg_score: pScores.length ? Math.round((pScores.reduce((x, y) => x + y, 0) / pScores.length) * 10) / 10 : null,
    };
    // Personas por capa esta semana (para las pestañas)
    const people = {};
    for (const a of wk) (people[a.layer] ||= new Set()).add(a.name);
    const layerCounts = Object.fromEntries([1, 2, 3, 4].map((l) => [l, people[l]?.size || 0]));

    const slim = (a) => ({
      id: a.id, name: a.name, dept: a.dept, layer: a.layer, area: a.area, part: a.part_number, date: a.date, due_date: a.due_date,
      status: a.status, window: a.window, score: a.score_pct, late: a.late, findings: a.nok_count + a.partial_count,
    });
    return json({
      today, monday, site, multi: MULTI_SITE, home: HOME_SITE,
      kpi: {
        week_pct: counted.length ? Math.round((done.length / counted.length) * 100) : null,
        week_done: done.length, week_counted: counted.length,
        today_total: scheduled.length, today_done: scheduled.filter((a) => a.status === 'completed').length,
        done_today: doneTodayList.length,
        avg_score: scores.length ? Math.round((scores.reduce((x, y) => x + y, 0) / scores.length) * 10) / 10 : null,
        findings_open: f[0].open, findings_overdue: f[0].overdue,
      },
      byLayer, prev, layerCounts,
      scheduled: scheduled.map(slim), doneToday: doneTodayList.map(slim), mgmt: mgmt.map(slim), missed: missed.map(slim),
    });
  } catch (e) {
    console.error('tv', e);
    return err('Error interno', 500);
  }
}
