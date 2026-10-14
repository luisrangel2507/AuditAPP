export const dynamic = 'force-dynamic';
import { getUser } from '@/lib/session';
import { json, err } from '@/lib/api';

// Latido del navegador: mientras la persona esté usando la app, mantiene viva la sesión
export async function POST() {
  const u = await getUser();
  if (!u) return err('Sesión expirada', 401);
  return json({ ok: true });
}
