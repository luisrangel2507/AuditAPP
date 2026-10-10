import bcrypt from 'bcryptjs';
import { pool, q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { passwordError } from '@/lib/password';
import { parseRoster, usernameFor, randomPassword } from '@/lib/import';

// Importa usuarios a una planta. dry_run=true solo valida y muestra lo que se crearía.
// Sin "password", cada usuario recibe una contraseña aleatoria (se devuelve UNA sola vez).
export const POST = route(async (req, { params }) => {
  const b = await req.json();
  const { rows: [site] } = await q('SELECT id,code FROM sites WHERE id=$1', [params.id]);
  if (!site) return err('Planta no encontrada', 404);
  const { rows: templates } = await q('SELECT id,name FROM templates');
  const rows = parseRoster(b.text, templates);
  if (!rows.length) return err('No hay filas para importar');
  const failed = rows.filter((r) => !r.ok);
  if (b.dry_run || failed.length) {
    return json({ ok: !failed.length, ...(failed.length && !b.dry_run ? { error: 'Hay filas con errores; corrígelas y vuelve a revisar' } : {}), count: rows.length, rows: rows.map(({ user, ...r }) => ({ ...r, template: user?.template })) }, failed.length && !b.dry_run ? 400 : 200);
  }
  let shared = null;
  if (b.password) {
    const bad = passwordError(b.password);
    if (bad) return err(bad);
    shared = String(b.password);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const taken = new Set((await client.query('SELECT username FROM users')).rows.map((r) => r.username));
    const created = [];
    for (const r of rows) {
      const u = r.user;
      const base = usernameFor(u.name);
      let un = base, n = 2;
      while (taken.has(un)) un = base + n++;
      taken.add(un);
      const password = shared || randomPassword();
      await client.query(
        `INSERT INTO users(name,username,pin_hash,must_change,dept,layer,access,template_id,days,pool,start_idx,rotate_daily,site_id)
         VALUES($1,$2,$3,TRUE,$4,$5,$6,$7,$8,$9,0,FALSE,$10)`,
        [u.name, un, await bcrypt.hash(password, 10), u.dept, u.layer, u.access, u.template_id, u.days, u.pool, site.id]);
      created.push({ name: u.name, username: un, password });
    }
    await client.query('COMMIT');
    return json({ ok: true, site: site.code, created }, 201);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('import', e);
    return err('No se pudo importar', 500);
  } finally { client.release(); }
}, { need: 'admin' });
