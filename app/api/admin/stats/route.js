export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { mxToday, addDays } from '@/lib/dates';

const TZ = `'America/Mexico_City'`;
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const hhmm = (mins) => mins == null ? null : `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.round(mins % 60)).padStart(2, '0')}`;
const FAST_SEC_PER_Q = 5; // menos de 5 s por pregunta se marca como "muy rápida"

// Estadísticas de tiempo: a qué hora y cuánto tardó cada auditor (solo admin)
export const GET = route(async (req, ctx, user) => {
  const scope = await siteScope(user);
  const days = Math.min(180, Math.max(1, Number(new URL(req.url).searchParams.get('days')) || 28));
  const from = addDays(mxToday(), -days);
  const { rows } = await q(
    `SELECT a.id,a.date,a.area,a.score_pct,a.late,a.started_at,a.completed_at,a.active_sec,
            (a.ok_count+a.nok_count+a.partial_count+a.na_count) AS qn,
            u.id AS user_id,u.name,u.dept,u.layer,
            EXTRACT(HOUR FROM a.completed_at AT TIME ZONE ${TZ})::int*60 + EXTRACT(MINUTE FROM a.completed_at AT TIME ZONE ${TZ})::int AS done_min,
            to_char(a.completed_at AT TIME ZONE ${TZ},'HH24:MI') AS done_time,
            to_char(a.started_at AT TIME ZONE ${TZ},'HH24:MI') AS start_time,
            CASE WHEN a.started_at IS NOT NULL THEN GREATEST(0, EXTRACT(EPOCH FROM (a.completed_at - a.started_at))::int) END AS elapsed_sec
       FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.status='completed' AND a.completed_at IS NOT NULL AND a.date >= $1 AND ($2::int IS NULL OR u.site_id=$2)
      ORDER BY a.completed_at DESC`, [from, scope]);

  const list = rows.map((r) => ({
    ...r,
    fast: r.active_sec != null && r.qn > 0 && r.active_sec / r.qn < FAST_SEC_PER_Q,
  }));
  const hours = Array(24).fill(0);
  list.forEach((r) => { hours[Math.floor(r.done_min / 60)]++; });

  const by = new Map();
  for (const r of list) {
    if (!by.has(r.user_id)) by.set(r.user_id, { user_id: r.user_id, name: r.name, dept: r.dept, layer: r.layer, n: 0, secs: [], mins: [], fast: 0, late: 0 });
    const g = by.get(r.user_id);
    g.n++; g.mins.push(r.done_min); if (r.fast) g.fast++; if (r.late) g.late++;
    if (r.active_sec != null) g.secs.push(r.active_sec);
  }
  const users = [...by.values()].map((g) => ({
    user_id: g.user_id, name: g.name, dept: g.dept, layer: g.layer, n: g.n, fast: g.fast, late: g.late,
    avg_sec: g.secs.length ? Math.round(g.secs.reduce((x, y) => x + y, 0) / g.secs.length) : null,
    usual_time: hhmm(median(g.mins)), earliest: hhmm(Math.min(...g.mins)), latest: hhmm(Math.max(...g.mins)),
  })).sort((a, b) => (b.fast - a.fast) || a.name.localeCompare(b.name));

  const allSecs = list.map((r) => r.active_sec).filter((x) => x != null);
  return json({
    days, from, total: list.length,
    kpi: {
      median_sec: median(allSecs),
      avg_sec: allSecs.length ? Math.round(allSecs.reduce((x, y) => x + y, 0) / allSecs.length) : null,
      usual_time: hhmm(median(list.map((r) => r.done_min))),
      fast: list.filter((r) => r.fast).length, late: list.filter((r) => r.late).length,
    },
    hours, users, audits: list.slice(0, 200).map(({ done_min, ...r }) => r),
  });
}, { need: 'admin' });
