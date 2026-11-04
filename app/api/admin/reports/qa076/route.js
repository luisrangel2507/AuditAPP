export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { mxToday, mondayOf, addDays } from '@/lib/dates';

// Formato QA-076-C "Dock Audit Findings": por día, el shipper # y el N/P inspeccionado, y el resultado de cada pregunta del Dock Audit.
export const GET = route(async (req, ctx, user) => {
  const d = new URL(req.url).searchParams.get('date');
  const monday = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : mxToday()), scope = await siteScope(user);
  const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const { rows: qs } = await q(
    `SELECT DISTINCT ON (x.id) x.id, x.text, x.sort_order FROM questions x WHERE x.category='Dock Audit' AND x.active ORDER BY x.id`);
  const questions = qs.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id).map((x) => { const t = String(x.text).split('\n'); return { id: x.id, text: t[1] || t[0] }; });
  const { rows: au } = await q(
    `SELECT a.id, a.shipper, a.extra, (COALESCE((a.completed_at AT TIME ZONE 'America/Mexico_City')::date, a.date))::text AS day, a.shift, u.name
       FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.status='completed' AND a.shipper IS NOT NULL AND a.shipper <> '' AND COALESCE((a.completed_at AT TIME ZONE 'America/Mexico_City')::date, a.date) BETWEEN $1 AND $2
        AND ($3::int IS NULL OR u.site_id=$3) ORDER BY a.id`, [monday, days[4], scope]);
  const ids = au.map((a) => a.id);
  const { rows: rs } = ids.length ? await q(`SELECT audit_id, question_id, result FROM responses WHERE audit_id = ANY($1::int[]) AND category='Dock Audit'`, [ids]) : { rows: [] };
  const cols = days.map((day) => {
    const a = au.find((x) => x.day === day); if (!a) return null;
    let e = a.extra; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = null; } }
    return { shipper: a.shipper, part: e?.dock_part || '', shift: a.shift, answers: Object.fromEntries(rs.filter((r) => r.audit_id === a.id).map((r) => [r.question_id, r.result])) };
  });
  return json({ monday, days, questions, cols });
}, { need: 'admin' });
