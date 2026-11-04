export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { mxToday, mondayOf, addDays } from '@/lib/dates';

// Formato QA-062-C "Gestión de Programa de Auditorías": productos de la auditoría gerencial de la semana
// y equipo auditor por día (QEs que tienen su día esa fecha), todo automático.
export const GET = route(async (req, ctx, user) => {
  const d = new URL(req.url).searchParams.get('date');
  const monday = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : mxToday()), scope = await siteScope(user);
  const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const { rows: au } = await q(
    `SELECT a.extra, a.date::text AS date FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.extra IS NOT NULL AND a.date BETWEEN $1 AND $2 AND ($3::int IS NULL OR u.site_id=$3) ORDER BY a.date, a.id`, [monday, days[4], scope]);
  const seen = new Set(), products = [];
  for (const r of au) {
    let e = r.extra; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = null; } }
    for (const p of e?.parts || []) { const k = String(p.number || '').trim(); if (!k || seen.has(k)) continue; seen.add(k); products.push({ name: p.name, number: p.number, color: p.color, freq: p.freq, report: 'QA-075-C' }); }
  }
  const { rows: qes } = await q(
    `SELECT u.name, u.days FROM users u WHERE u.active AND u.dept='quality' AND u.layer=1 AND u.access NOT IN ('admin','master') AND ($1::int IS NULL OR u.site_id=$1) ORDER BY u.name`, [scope]);
  const team = days.map((day, i) => qes.filter((x) => (x.days || []).includes(i + 1)).map((x) => x.name));
  return json({ monday, days, products, team });
}, { need: 'admin' });
