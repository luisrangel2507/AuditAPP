import bcrypt from 'bcryptjs';
import { q } from '@/lib/db';
import { createSession } from '@/lib/session';
import { json, err } from '@/lib/api';

// Límite de intentos en memoria: 6 fallos por usuario cada 10 min
const tries = globalThis.__loginTries || (globalThis.__loginTries = new Map());

export async function POST(req) {
  try {
    const { username, password, remember } = await req.json();
    const un = String(username || '').trim().toLowerCase();
    if (!un || !password) return err('Usuario y contraseña requeridos');
    const t = tries.get(un);
    if (t && t.n >= 6 && Date.now() - t.at < 600000) return err('Demasiados intentos. Espera 10 minutos.', 429);

    const { rows } = await q('SELECT id,pin_hash,must_change FROM users WHERE username=$1 AND active', [un]);
    const ok = rows[0] && (await bcrypt.compare(String(password), rows[0].pin_hash));
    if (!ok) {
      tries.set(un, { n: (t && Date.now() - t.at < 600000 ? t.n : 0) + 1, at: Date.now() });
      return err('Usuario o contraseña incorrectos', 401);
    }
    tries.delete(un);
    await createSession(rows[0].id, remember !== false);
    return json({ ok: true, must_change: rows[0].must_change });
  } catch (e) {
    console.error(e);
    return err('Error interno', 500);
  }
}
