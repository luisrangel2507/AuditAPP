import { q } from './db';
import { siteScope } from './site';

// Respaldo completo para migrar: todas las tablas de la base (menos las suscripciones push, que dependen de cada teléfono)
const FIRST = ['sites', 'templates', 'questions', 'question_versions', 'users', 'audits', 'responses', 'findings', 'finding_owners', 'finding_updates', 'finding_evidence', 'signoffs', 'absences', 'holidays', 'audit_skips', 'notifications', 'admin_log', 'audit_deletions', 'finding_deletions', 'settings'];
const SKIP = ['push_subs'];
export async function buildBackup(user, photos) {
  const scope = await siteScope(user);
  const out = { app: 'LPApp', version: 2, generated_at: new Date().toISOString(), site_scope: scope, photos, counts: {} };
  const { rows: tl } = await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
  const all = tl.map((r) => r.table_name).filter((t) => !SKIP.includes(t));
  const TABLES = [...FIRST.filter((t) => all.includes(t)), ...all.filter((t) => !FIRST.includes(t)).sort()];
  for (const t of TABLES) {
    let sql = `SELECT * FROM ${t}`;
    if (scope != null) {
      if (t === 'users') sql += ` WHERE site_id=${Number(scope)}`;
      else if (t === 'audits') sql += ` WHERE user_id IN (SELECT id FROM users WHERE site_id=${Number(scope)})`;
      else if (t === 'responses') sql += ` WHERE audit_id IN (SELECT a.id FROM audits a JOIN users u ON u.id=a.user_id WHERE u.site_id=${Number(scope)})`;
      else if (t === 'findings') sql += ` WHERE audit_id IN (SELECT a.id FROM audits a JOIN users u ON u.id=a.user_id WHERE u.site_id=${Number(scope)})`;
      else if (['finding_owners', 'finding_updates', 'finding_evidence'].includes(t)) sql += ` WHERE finding_id IN (SELECT f.id FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id WHERE u.site_id=${Number(scope)})`;
      else if (t === 'sites') sql += ` WHERE id=${Number(scope)}`;
      else if (['absences', 'audit_skips'].includes(t)) sql += ` WHERE user_id IN (SELECT id FROM users WHERE site_id=${Number(scope)})`;
    }
    const { rows } = await q(sql);
    out[t] = rows.map((r) => {
      const c = { ...r };
      delete c.pin_hash; delete c.password_hash;
      if (t === 'settings' && /vapid_private|secret|key/i.test(c.key)) return null;
      if (!photos) { if (t === 'responses' && c.evidence) c.evidence = '[foto omitida]'; if (t === 'finding_evidence') c.data = '[foto omitida]'; }
      return c;
    }).filter(Boolean);
    out.counts[t] = out[t].length;
  }
  return out;
}
