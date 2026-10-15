import { q } from './db';
import { mxToday, addDays } from './dates';
import { notifyAdmins } from './notify';

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
  const upcoming = (await archiveUpcoming()).reduce((t, r) => t + r.n, 0);
  return { days, upcoming, photos: a.n + b.n, photos_mb: mb(Number(a.b) + Number(b.b)), eligible: days ? ea.n + eb.n : 0, eligible_mb: days ? mb(Number(ea.b) + Number(eb.b)) : 0, db_mb: mb(db.b), last: last?.value || null };
}

export async function runArchive() {
  const days = await archiveDays();
  if (!days) return { removed: 0 };
  const cut = cutoff(days);
  const r1 = await q(`UPDATE responses r SET evidence='' FROM audits au WHERE au.id=r.audit_id AND r.evidence<>'' AND au.date < $1`, [cut]);
  const r2 = await q(`UPDATE finding_evidence e SET data='[archivada]' FROM findings f JOIN audits au ON au.id=f.audit_id WHERE f.id=e.finding_id AND e.data NOT LIKE '[archivada%' AND au.date < $1`, [cut]);
  const r3 = await q(`DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days'`);
  if (r1.rowCount + r2.rowCount) {
    const { rows: sites } = await q(`SELECT id FROM sites WHERE active`);
    for (const st of sites) await notifyAdmins({ siteId: st.id, type: 'archive_done', link: '/admin', dedupe: `archd:${st.id}:${mxToday()}`, message: `Archivo automático: se eliminaron ${r1.rowCount + r2.rowCount} foto(s) con más de ${days} días.` });
  }
  await q(`INSERT INTO settings(key,value) VALUES('archive_last',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [mxToday()]);
  return { removed: r1.rowCount + r2.rowCount, notifications: r3.rowCount };
}

const WARN_DAYS = 7;
// Fotos que se archivarán en los próximos WARN_DAYS días (por planta): auditorías cuya fecha cae entre el corte de hoy y el de dentro de una semana
export async function archiveUpcoming() {
  const days = await archiveDays();
  if (!days) return [];
  const from = cutoff(days), to = cutoff(days - WARN_DAYS);
  const { rows } = await q(
    `SELECT s.site_id, SUM(s.n)::int AS n, MIN(s.d) AS first FROM (
       SELECT u.site_id, COUNT(*) AS n, MIN(au.date) AS d FROM responses r JOIN audits au ON au.id=r.audit_id JOIN users u ON u.id=au.user_id
        WHERE r.evidence<>'' AND au.date >= $1 AND au.date < $2 GROUP BY u.site_id
       UNION ALL
       SELECT u.site_id, COUNT(*), MIN(au.date) FROM finding_evidence e JOIN findings f ON f.id=e.finding_id JOIN audits au ON au.id=f.audit_id JOIN users u ON u.id=au.user_id
        WHERE e.data NOT LIKE '[archivada%' AND au.date >= $1 AND au.date < $2 GROUP BY u.site_id) s GROUP BY s.site_id`, [from, to]);
  return rows.map((r) => ({ ...r, days, run_on: addDays(mxToday(), WARN_DAYS), until: to }));
}

// Aviso al administrador antes de borrar por antigüedad (una vez por semana mientras haya algo por archivarse)
export async function warnArchive() {
  const up = await archiveUpcoming();
  const wk = mxToday().slice(0, 7) + '-w' + Math.floor((Number(mxToday().slice(8, 10)) - 1) / 7);
  for (const u of up) {
    if (!u.n) continue;
    await notifyAdmins({ siteId: u.site_id, type: 'archive_warning', link: '/admin', dedupe: `archw:${u.site_id}:${wk}`,
      message: `Aviso: en los próximos ${WARN_DAYS} días se archivarán (se borrarán) ${u.n} foto(s) de auditorías con más de ${u.days} días. Descarga antes el respaldo con fotos en Reportes si las quieres conservar.` });
  }
}
