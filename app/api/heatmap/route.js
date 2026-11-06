export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { SEED_MACHINES, ZONES, isActiveMachine } from '@/lib/zones';
import { mxToday, addDays } from '@/lib/dates';

// Mapa de calor: hallazgos y auditorías por zona y máquina en los últimos N días
export const GET = route(async (req, ctx, user) => {
  const days = Math.min(365, Math.max(7, Number(new URL(req.url).searchParams.get('days')) || 30));
  const scope = await siteScope(user), today = mxToday(), from = addDays(today, -days), from90 = addDays(today, -90);
  const zoneSql = `COALESCE(NULLIF(a.zone,''), split_part(a.area,' · ',1))`, machSql = `COALESCE(NULLIF(a.machine,''), NULLIF(split_part(a.area,' · ',2),''))`;
  const { rows: au } = await q(
    `SELECT ${zoneSql} AS zone, ${machSql} AS machine, COUNT(*)::int AS audits, MAX(a.date)::text AS last
       FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.kind='lpa' AND a.status='completed' AND a.date >= $1 AND ($2::int IS NULL OR u.site_id=$2) GROUP BY 1,2`, [from90, scope]);
  const { rows: fi } = await q(
    `SELECT ${zoneSql} AS zone, ${machSql} AS machine, COUNT(*)::int AS findings, COUNT(*) FILTER (WHERE f.status <> 'closed')::int AS open
       FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id
      WHERE a.date >= $1 AND ($2::int IS NULL OR u.site_id=$2) GROUP BY 1,2`, [from, scope]);
  const { rows: au30 } = await q(
    `SELECT ${zoneSql} AS zone, ${machSql} AS machine, COUNT(*)::int AS audits
       FROM audits a JOIN users u ON u.id=a.user_id WHERE a.kind='lpa' AND a.status='completed' AND a.date >= $1 AND ($2::int IS NULL OR u.site_id=$2) GROUP BY 1,2`, [from, scope]);
  const zones = {};
  const Z = (z) => (zones[z] ||= { audits: 0, findings: 0, open: 0, last: null, machines: {} });
  for (const z of ZONES) { const m = Z(z); for (const n of SEED_MACHINES[z] || []) m.machines[n] = { audits: 0, findings: 0, open: 0, last: null }; }
  const M = (z, m) => (Z(z).machines[m] ||= { audits: 0, findings: 0, open: 0, last: null });
  for (const r of au) { if (!r.zone) continue; const z = Z(r.zone); if (r.machine && isActiveMachine(r.machine)) { const m = M(r.zone, r.machine); if (!m.last || m.last < r.last) m.last = r.last; } if (!z.last || z.last < r.last) z.last = r.last; }
  for (const r of au30) { if (!r.zone) continue; Z(r.zone).audits += r.audits; if (r.machine && isActiveMachine(r.machine)) M(r.zone, r.machine).audits += r.audits; }
  for (const r of fi) { if (!r.zone) continue; const z = Z(r.zone); z.findings += r.findings; z.open += r.open; if (r.machine && isActiveMachine(r.machine)) { const m = M(r.zone, r.machine); m.findings += r.findings; m.open += r.open; } }
  const out = {};
  for (const [z, v] of Object.entries(zones)) {
    const ms = Object.entries(v.machines).map(([name, x]) => ({ name, ...x })).sort((a, b) => b.findings - a.findings || (a.last || '').localeCompare(b.last || ''));
    out[z] = { audits: v.audits, findings: v.findings, open: v.open, last: v.last, machines: ms, unaudited: ms.filter((x) => !x.last || x.last < from90).length };
  }
  return json({ days, from, zones: out });
}, { need: 'panel' });
