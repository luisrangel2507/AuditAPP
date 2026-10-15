import { q } from './db';
import { mxToday, addDays } from './dates';

// Archivo de datos históricos: las fotos (lo que más pesa) de auditorías e issues con más de N días se eliminan.
// Se conservan todas las respuestas, hallazgos, scores y la bitácora. Un respaldo con fotos se descarga antes desde Reportes.
export async function archiveDays() {
  const v = (await q(`SELECT value FROM settings WHERE key='archive_photos_days'`)).rows[0]?.value;
  const n = v === undefined ? 365 : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 365;
}
const cutoff = (days) => addDays(mxToday(), -days);

export async function archiveStats() {
  const days = await archiveDays(), cut = cutoff(days || 36500);
  const { rows: [a] } = await q(`SELECT COUNT(*)::int n, COALESCE(SUM(length(evidence)),0)::bigint b FROM responses WHERE evidence<>''`);
  const { rows: [b] } = await q(`SELECT COUNT(*)::int n, COALESCE(SUM(length(data)),0)::bigint b FROM finding_evidence WHERE data NOT LIKE '[archivada%'`);
  const { rows: [ea] } = await q(`SELECT COUNT(*)::int n, COALESCE(SUM(length(r.evidence)),0)::bigint b FROM responses r JOIN audits au ON au.id=r.audit_id WHERE r.evidence<>'' AND au.date < $1`, [cut]);
  const { rows: [eb] } = await q(`SELECT COUNT(*)::int n, COALESCE(SUM(length(e.data)),0)::bigint b FROM finding_evidence e JOIN findings f ON f.id=e.finding_id JOIN audits au ON au.id=f.audit_id WHERE e.data NOT LIKE '[archivada%' AND au.date < $1`, [cut]);
  const { rows: [db] } = await q(`SELECT pg_database_size(current_database())::bigint AS b`);
  const { rows: [last] } = await q(`SELECT value FROM settings WHERE key='archive_last'`);
  const mb = (x) => Math.round(Number(x) / 1048576 * 10) / 10;
  return { days, photos: a.n + b.n, photos_mb: mb(Number(a.b) + Number(b.b)), eligible: days ? ea.n + eb.n : 0, eligible_mb: days ? mb(Number(ea.b) + Number(eb.b)) : 0, db_mb: mb(db.b), last: last?.value || null };
}

export async function runArchive() {
  const days = await archiveDays();
  if (!days) return { removed: 0 };
  const cut = cutoff(days);
  const r1 = await q(`UPDATE responses r SET evidence='' FROM audits au WHERE au.id=r.audit_id AND r.evidence<>'' AND au.date < $1`, [cut]);
  const r2 = await q(`UPDATE finding_evidence e SET data='[archivada]' FROM findings f JOIN audits au ON au.id=f.audit_id WHERE f.id=e.finding_id AND e.data NOT LIKE '[archivada%' AND au.date < $1`, [cut]);
  const r3 = await q(`DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days'`);
  await q(`INSERT INTO settings(key,value) VALUES('archive_last',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [mxToday()]);
  return { removed: r1.rowCount + r2.rowCount, notifications: r3.rowCount };
}
