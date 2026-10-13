import { cookies } from 'next/headers';
import { q } from './db';
import { isMaster } from './roles';

// Planta a la que se limita una consulta. null = todas (solo el admin, con el selector en "Todas").
// Un usuario sin planta asignada no ve nada (id 0 no existe).
export async function siteScope(user) {
  if (!isMaster(user)) return user.site_id ?? 0; // admin y demás: solo su planta
  const c = (await cookies()).get('lpa_site')?.value;
  if (!c || c === 'ALL') return null;
  const { rows } = await q('SELECT id FROM sites WHERE code=$1', [c]);
  return rows[0]?.id ?? null;
}

// ¿Puede este usuario operar sobre datos de la planta `siteId`?
export const sameSite = (user, siteId) => isMaster(user) || (user.site_id != null && user.site_id === siteId);
