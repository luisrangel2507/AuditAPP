export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { mxToday } from '@/lib/dates';

// Formato QA-075-C "Management Audit Findings": una hoja por auditoría gerencial realizada ese día.
// Cada parte (la misma de la LPA) lleva "Sin hallazgos" o el hallazgo con sticker, fecha, operador y turno.
export const GET = route(async (req, ctx, user) => {
  const d = new URL(req.url).searchParams.get('date');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : mxToday(), scope = await siteScope(user);
  const { rows: au } = await q(
    `SELECT a.id,a.date::text AS date,a.shift,a.extra,u.name FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.extra IS NOT NULL AND a.status='completed' AND (COALESCE((a.completed_at AT TIME ZONE 'America/Mexico_City')::date, a.date))=$1 AND ($2::int IS NULL OR u.site_id=$2) ORDER BY a.id`, [date, scope]);
  const sheets = [];
  for (const a of au) {
    let e = a.extra; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = null; } }
    const parts = e?.parts || []; if (!parts.length) continue;
    const { rows: rs } = await q(`SELECT r.notes,r.extra FROM responses r WHERE r.audit_id=$1 AND r.category='Auditoría gerencial' AND r.result IN ('nok','partial') ORDER BY r.id`, [a.id]);
    const blocks = [];
    for (const p of parts) {
      const mine = rs.filter((r) => { const x = typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra; return x && (x.part === p.number || parts.length === 1); });
      if (!mine.length) blocks.push({ issue: 'Sin hallazgos', number: p.number, name: p.name });
      for (const r of mine) { const x = typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra; blocks.push({ issue: String(r.notes || '').split(' · Parte:')[0], number: p.number, name: p.name, sticker: x.sticker, operator: x.operator, shift: x.shift, date: a.date }); }
    }
    sheets.push({ id: a.id, auditor: 'QE', who: a.name, date: a.date, shift: a.shift, blocks });
  }
  return json({ date, sheets });
}, { need: 'admin' });
