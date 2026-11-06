export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { mxToday, addDays } from '@/lib/dates';

// Tendencias por persona: puntualidad, constancia, hallazgos reportados y posibles auditorías superficiales
export const GET = route(async (req, ctx, user) => {
  const days = Math.min(365, Math.max(30, Number(new URL(req.url).searchParams.get('days')) || 90));
  const today = mxToday(), from = addDays(today, -days), mid = addDays(today, -Math.floor(days / 2)), scope = await siteScope(user);
  const { rows } = await q(
    `SELECT u.id,u.name,u.dept,u.layer,
            COUNT(*) FILTER (WHERE a.status='completed')::int AS done,
            COUNT(*) FILTER (WHERE a.status<>'excused' AND (a.status='completed' OR a.due_date < $2))::int AS total,
            COUNT(*) FILTER (WHERE a.status='completed' AND a.late)::int AS late,
            COUNT(*) FILTER (WHERE a.status IN ('pending','missed') AND a.due_date < $2)::int AS missed,
            COALESCE(SUM(a.nok_count+a.partial_count) FILTER (WHERE a.status='completed'),0)::int AS findings,
            COUNT(*) FILTER (WHERE a.status='completed' AND a.nok_count+a.partial_count=0)::int AS clean,
            COUNT(*) FILTER (WHERE a.status='completed' AND a.active_sec IS NOT NULL AND a.active_sec < 600)::int AS short,
            COUNT(*) FILTER (WHERE a.status='completed' AND a.active_sec IS NOT NULL)::int AS timed,
            ROUND(AVG(a.active_sec) FILTER (WHERE a.status='completed' AND a.active_sec IS NOT NULL)::numeric / 60, 1) AS avg_min,
            ROUND(AVG(a.score_pct) FILTER (WHERE a.status='completed')::numeric, 1) AS score,
            COUNT(*) FILTER (WHERE a.date >= $3 AND a.status<>'excused' AND (a.status='completed' OR a.due_date < $2))::int AS t_new,
            COUNT(*) FILTER (WHERE a.date >= $3 AND a.status='completed')::int AS d_new,
            COUNT(*) FILTER (WHERE a.date < $3 AND a.status<>'excused' AND (a.status='completed' OR a.due_date < $2))::int AS t_old,
            COUNT(*) FILTER (WHERE a.date < $3 AND a.status='completed')::int AS d_old
       FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.kind='lpa' AND a.date BETWEEN $1 AND $2 AND u.active AND u.access NOT IN ('admin','master') AND ($4::int IS NULL OR u.site_id=$4)
      GROUP BY u.id HAVING COUNT(*) FILTER (WHERE a.status<>'excused') > 0 ORDER BY u.name`, [from, today, mid, scope]);
  const tot = rows.reduce((s, r) => ({ done: s.done + r.done, findings: s.findings + r.findings }), { done: 0, findings: 0 });
  const avgF = tot.done ? tot.findings / tot.done : 0;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const people = rows.map((r) => {
    const f = [];
    const latePct = pct(r.late, r.done), perAudit = r.done ? Math.round((r.findings / r.done) * 10) / 10 : 0, missPct = pct(r.missed, r.total);
    if (r.done >= 3 && latePct >= 40) f.push('Entrega tarde');
    if (r.total >= 3 && missPct >= 30) f.push('Muchas no realizadas');
    if (r.done >= 8 && (r.findings === 0 || pct(r.clean, r.done) >= 95)) f.push('Casi nunca reporta hallazgos');
    if (r.timed >= 5 && pct(r.short, r.timed) >= 50) f.push('Auditorías muy cortas');
    if (r.done >= 8 && avgF > 0 && perAudit >= avgF * 2) f.push('Reporta muchos hallazgos');
    const recent = pct(r.d_new, r.t_new), prev = pct(r.d_old, r.t_old);
    return { ...r, late_pct: latePct, miss_pct: missPct, per_audit: perAudit, clean_pct: pct(r.clean, r.done), pct: pct(r.done, r.total), recent, prev, trend: recent == null || prev == null ? null : recent - prev, flags: f };
  }).sort((a, b) => b.flags.length - a.flags.length || (a.pct ?? 100) - (b.pct ?? 100));
  return json({ days, from, to: today, avg_findings: Math.round(avgF * 10) / 10, people });
}, { need: 'panel' });
