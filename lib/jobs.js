import { pool, q } from './db';
import { notify, notifyAdmins } from './notify';
import { ensureWeek } from './schedule';
import { mxToday, addDays, mondayOf, isoWeekday } from './dates';
import { issueNo } from './issues';

// Tareas programadas (cada 5 min dentro del servidor). Todo es idempotente: los avisos llevan una llave "dedupe".
const mxNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
};
const short = (t) => String(t || '').split('\n')[0].slice(0, 80);

async function issueNotices(today) {
  // Issues abiertos con compromiso: por vencer (≤ 2 días) y vencidos. Se avisa a cada responsable que no ha terminado.
  const { rows } = await q(
    `SELECT f.id,f.question,f.due_date,u.site_id,u.dept AS auditor_dept,
            COALESCE((SELECT json_agg(json_build_object('id',o.user_id,'dept',ou.dept)) FROM finding_owners o JOIN users ou ON ou.id=o.user_id
                       WHERE o.finding_id=f.id AND o.status<>'done' AND ou.active),'[]') AS owners
       FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id
      WHERE f.status<>'closed' AND f.due_date IS NOT NULL AND f.due_date <= $1::date + 2`, [today]);
  for (const f of rows) {
    const due = typeof f.due_date === 'string' ? f.due_date : new Date(f.due_date).toISOString().slice(0, 10);
    const late = due < today;
    const days = Math.round((new Date(today + 'T12:00:00Z') - new Date(due + 'T12:00:00Z')) / 86400000);
    for (const o of f.owners) {
      await notify({ userId: o.id, siteId: f.site_id, type: late ? 'issue_overdue' : 'issue_soon', link: `/findings#oi-${f.id}`,
        message: late ? `Vencido: ${issueNo(f.id)} (${days} día${days === 1 ? '' : 's'} de retraso) · ${short(f.question)}` : `Por vencer: ${issueNo(f.id)} vence ${due === today ? 'hoy' : 'el ' + due} · ${short(f.question)}`,
        dedupe: `${late ? 'ov' : 'soon'}:${f.id}:${o.id}:${today}` });
    }
    // Escalamiento: 3 y 7 días de retraso → administradores y gerentes (Layer 2+) del departamento
    for (const lvl of [3, 7]) {
      if (days < lvl) continue;
      const msg = `Escalamiento: ${issueNo(f.id)} lleva ${days} días vencido · ${short(f.question)}`;
      await notifyAdmins({ siteId: f.site_id, type: 'issue_escalated', message: msg, link: `/findings#oi-${f.id}`, dedupe: `esc${lvl}:${f.id}` });
      const depts = [...new Set([f.auditor_dept, ...f.owners.map((o) => o.dept)].filter(Boolean))];
      const { rows: mgrs } = await q(`SELECT id FROM users WHERE active AND layer>=2 AND access NOT IN ('admin','master') AND site_id=$1 AND dept = ANY($2::text[])`, [f.site_id, depts]);
      for (const m of mgrs) await notify({ userId: m.id, siteId: f.site_id, type: 'issue_escalated', message: msg, link: `/findings#oi-${f.id}`, dedupe: `esc${lvl}:${f.id}:m${m.id}` });
    }
  }
}

async function auditReminders(today, minutes) {
  if (isoWeekday(today) > 5) return;
  await ensureWeek(mondayOf(today));
  const wave = minutes >= 16 * 60 ? 2 : minutes >= 12 * 60 + 30 ? 1 : 0;
  const { rows: gl } = await q(`SELECT value FROM settings WHERE key='go_live'`);
  if (gl[0]?.value && today < gl[0].value) return;
  const { rows } = await q(
    `SELECT a.id,a.kind,a.slot,a.area,u.id AS uid,u.name,u.site_id FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.date=$1 AND a.status='pending' AND u.active AND u.access NOT IN ('admin','master')`, [today]);
  if (wave) {
    for (const a of rows) {
      await notify({ userId: a.uid, siteId: a.site_id, type: 'audit_reminder', auditId: a.id, link: `/audit/${a.id}`,
        message: a.kind === 'process' ? `Te falta la auditoría de proceso ${a.slot} de hoy` : `Te falta tu auditoría LPA de hoy`, dedupe: `rem${wave}:${a.id}` });
    }
  }
  // Resumen para el administrador al final del día (17:30)
  if (minutes >= 17 * 60 + 30) {
    const bySite = new Map();
    for (const a of rows) { const k = a.site_id ?? 0; if (!bySite.has(k)) bySite.set(k, new Set()); bySite.get(k).add(a.name); }
    for (const [site, names] of bySite) {
      const list = [...names];
      await notifyAdmins({ siteId: site || null, type: 'daily_summary', link: '/dashboard', dedupe: `sum:${site}:${today}`,
        message: `Cierre del día: ${rows.filter((a) => (a.site_id ?? 0) === site).length} auditoría(s) sin realizar · ${list.slice(0, 6).join(', ')}${list.length > 6 ? ` y ${list.length - 6} más` : ''}` });
    }
  }
}

async function weeklyReport(today, minutes) {
  if (isoWeekday(today) !== 5 || minutes < 16 * 60) return;
  const monday = mondayOf(today);
  const { rows } = await q(`SELECT id FROM sites WHERE active`);
  for (const s of rows) await notifyAdmins({ siteId: s.id, type: 'weekly_report', link: `/reports/weekly?date=${today}`, dedupe: `wk:${s.id}:${monday}`, message: 'Reporte semanal listo: cumplimiento, hallazgos e issues de la semana' });
}

let running = false;
export async function runJobs() {
  if (running) return; running = true;
  const c = await pool.connect();
  try {
    // Con varias instancias, solo una corre las tareas a la vez
    const { rows: [l] } = await c.query('SELECT pg_try_advisory_lock(8472001) AS ok');
    if (!l.ok) return;
    try {
      const today = mxToday(), minutes = mxNow();
      await issueNotices(today);
      await auditReminders(today, minutes);
      await weeklyReport(today, minutes);
    } finally { await c.query('SELECT pg_advisory_unlock(8472001)'); }
  } catch (e) { console.error('jobs', e); } finally { c.release(); running = false; }
}
