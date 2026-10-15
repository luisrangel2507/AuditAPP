export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route } from '@/lib/api';
import { siteScope } from '@/lib/site';

// Respaldo completo en JSON (sin contraseñas ni llaves). Con ?fotos=1 incluye las imágenes de evidencia.
const TABLES = ['sites', 'templates', 'questions', 'question_versions', 'users', 'audits', 'responses', 'findings', 'finding_owners', 'finding_updates', 'finding_evidence', 'notifications', 'admin_log', 'audit_deletions', 'finding_deletions', 'settings'];
export const GET = route(async (req, ctx, user) => {
  const photos = new URL(req.url).searchParams.get('fotos') === '1';
  const scope = await siteScope(user);
  const out = { app: 'LPApp', generated_at: new Date().toISOString(), site_scope: scope, photos };
  for (const t of TABLES) {
    let sql = `SELECT * FROM ${t}`;
    if (scope != null) {
      if (t === 'users') sql += ` WHERE site_id=${Number(scope)}`;
      else if (t === 'audits') sql += ` WHERE user_id IN (SELECT id FROM users WHERE site_id=${Number(scope)})`;
      else if (t === 'responses') sql += ` WHERE audit_id IN (SELECT a.id FROM audits a JOIN users u ON u.id=a.user_id WHERE u.site_id=${Number(scope)})`;
      else if (t === 'findings') sql += ` WHERE audit_id IN (SELECT a.id FROM audits a JOIN users u ON u.id=a.user_id WHERE u.site_id=${Number(scope)})`;
      else if (['finding_owners', 'finding_updates', 'finding_evidence'].includes(t)) sql += ` WHERE finding_id IN (SELECT f.id FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id WHERE u.site_id=${Number(scope)})`;
      else if (t === 'sites') sql += ` WHERE id=${Number(scope)}`;
    }
    const { rows } = await q(sql);
    out[t] = rows.map((r) => {
      const c = { ...r };
      delete c.pin_hash; delete c.password_hash;
      if (t === 'settings' && /vapid_private|secret|key/i.test(c.key)) return null;
      if (!photos) { if (t === 'responses' && c.evidence) c.evidence = '[foto omitida]'; if (t === 'finding_evidence') c.data = '[foto omitida]'; }
      return c;
    }).filter(Boolean);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="lpapp_respaldo_${stamp}${photos ? '_con_fotos' : ''}.json"` } });
}, { need: 'master' });
