export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { archiveStats, runArchive } from '@/lib/archive';

export const GET = route(async () => json(await archiveStats()), { need: 'master' });
// body: { days } cambia el plazo (0 = nunca); { run: true } archiva ahora
export const PUT = route(async (req) => {
  const b = await req.json();
  if (b.days !== undefined) {
    const n = Math.round(Number(b.days));
    if (!Number.isFinite(n) || n < 0 || (n > 0 && n < 90)) return err('El plazo debe ser 0 (nunca) o de al menos 90 días');
    await q(`INSERT INTO settings(key,value) VALUES('archive_photos_days',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [String(n)]);
  }
  const result = b.run ? await runArchive() : null;
  return json({ ok: true, result, ...(await archiveStats()) });
}, { need: 'master' });
