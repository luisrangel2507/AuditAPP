import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { q } from './db';

export const COOKIE = 'lpa_session';

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('Falta SESSION_SECRET');
  return new TextEncoder().encode(s || 'dev-only-secret-change-me');
}

export async function createSession(userId) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  (await cookies()).set(COOKIE, '', { path: '/', maxAge: 0 });
}

// Devuelve el usuario vigente (se relee de la BD: permisos/baja aplican de inmediato)
export async function getUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const { rows } = await q(
      `SELECT u.id,u.name,u.username,u.dept,u.layer,u.access,u.must_change,u.template_id,u.onboarded,u.site_id,s.code AS site_code,s.name AS site_name
         FROM users u LEFT JOIN sites s ON s.id=u.site_id WHERE u.id=$1 AND u.active`,
      [payload.uid]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}
