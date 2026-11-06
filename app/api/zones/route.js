export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json } from '@/lib/api';
import { SEED_MACHINES, ZONES, isActiveMachine } from '@/lib/zones';

// Zonas y máquinas activas (lista oficial + las ya capturadas) para elegir áreas
export const GET = route(async () => {
  const machines = {};
  for (const [z, list] of Object.entries(SEED_MACHINES)) machines[z] = [...list];
  const { rows } = await q(`SELECT DISTINCT zone, machine FROM audits WHERE zone <> '' AND machine <> ''`);
  for (const r of rows) { const l = (machines[r.zone] ||= []); if (isActiveMachine(r.machine) && !l.includes(r.machine)) l.push(r.machine); }
  return json({ zones: ZONES, machines });
});
