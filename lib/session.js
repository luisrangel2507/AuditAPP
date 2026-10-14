import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { q } from './db';
import { MULTI_SITE } from './config';

export const COOKIE = 'lpa_session';

// Cierre por inactividad: 15 min para auditores y líderes, 45 min para administradores / máster
export const IDLE_MIN = 15, IDLE_MIN_ADMIN = 45;
export const idleMinutes = (access) => (access === 'admin' || access === 'master' ? IDLE_MIN_ADMIN : IDLE_MIN);

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('Falta SESSION_SECRET');
  return new TextEncoder().encode(s || 'dev-only-secret-change-me');
}

// remember=true: sesión de 14 días; false: cookie de sesión (se borra al cerrar el navegador) y vence a las 12 h
export async function createSession(userId, remember = true) {
  const token = await new SignJWT({ uid: userId, last: Date.now(), rem: remember ? 1 : 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(remember ? '14d' : '12h')
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(remember ? { maxAge: 60 * 60 * 24 * 14 } : {}),
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
    const now = Date.now();
    const { rows } = await q(
      `SELECT u.id,u.name,u.username,u.dept,u.layer,u.access,u.must_change,u.template_id,u.onboarded,u.site_id,s.code AS site_code,s.name AS site_name
         FROM users u LEFT JOIN sites s ON s.id=u.site_id WHERE u.id=$1 AND u.active`,
      [payload.uid]
    );
    const u = rows[0];
    if (!u) return null;
    // Inactividad: si pasó más del límite desde la última actividad, la sesión se considera cerrada
    if (payload.last && now - payload.last > idleMinutes(u.access) * 60000) return null;
    // Renueva la marca de actividad (cada minuto como máximo) conservando el vencimiento original
    if (!payload.last || now - payload.last > 60000) {
      try {
        const t = await new SignJWT({ uid: payload.uid, last: now, rem: payload.rem ?? 1 })
          .setProtectedHeader({ alg: 'HS256' }).setIssuedAt(payload.iat).setExpirationTime(payload.exp).sign(secret());
        (await cookies()).set(COOKIE, t, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', ...(payload.rem === 0 ? {} : { maxAge: Math.max(60, payload.exp - Math.floor(now / 1000)) }) });
      } catch { /* en componentes de servidor no se pueden escribir cookies: se renueva en la siguiente llamada a la API */ }
    }
    return { ...u, multi_site: MULTI_SITE };
  } catch {
    return null;
  }
}
