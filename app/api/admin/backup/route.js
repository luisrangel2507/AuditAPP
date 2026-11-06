export const dynamic = 'force-dynamic';
import { route } from '@/lib/api';
import { buildBackup } from '@/lib/backup';

// Respaldo completo en JSON (sin contraseñas ni llaves). Con ?fotos=1 incluye las imágenes de evidencia.
export const GET = route(async (req, ctx, user) => {
  const photos = new URL(req.url).searchParams.get('fotos') === '1';
  const out = await buildBackup(user, photos);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="lpapp_respaldo_${stamp}${photos ? '_con_fotos' : ''}.json"` } });
}, { need: 'master' });
