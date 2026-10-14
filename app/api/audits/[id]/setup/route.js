import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { ZONES, NO_MACHINE, areaLabel } from '@/lib/zones';

// Datos que el auditor captura al iniciar (Layer 1 y QEs): zona, máquina y número(s) de parte
export const POST = route(async (req, { params }, user) => {
  const b = await req.json();
  const { rows: [a] } = await q(
    `SELECT a.user_id,a.status,a.kind,u.layer FROM audits a JOIN users u ON u.id=a.user_id WHERE a.id=$1`, [params.id]);
  if (!a) return err('No encontrada', 404);
  if (a.user_id !== user.id) return err('Esta auditoría no es tuya', 403);
  if (a.status === 'completed') return err('Ya fue completada');
  const zone = String(b.zone || '').trim();
  if (!ZONES.includes(zone)) return err('Escoge una zona');
  const full = a.layer === 1 || a.kind === 'process'; // Layer 1 y QEs: máquina y N/P; Layer 2-4: solo el área
  const machine = !full || NO_MACHINE.includes(zone) ? '' : String(b.machine || '').trim().slice(0, 40);
  if (full && !NO_MACHINE.includes(zone) && !machine) return err('Escoge o escribe la máquina');
  const p1 = String(b.part_number || '').trim().slice(0, 40), p2 = String(b.part_number2 || '').trim().slice(0, 40);
  if (full && !p1) return err('Captura el número de parte');
  const part = !full ? '' : p2 ? `${p1} / ${p2}` : p1;
  await q('UPDATE audits SET zone=$2, machine=$3, area=$4, part_number=$5, started_at=COALESCE(started_at,NOW()) WHERE id=$1',
    [params.id, zone, machine, areaLabel(zone, machine), part]);
  return json({ ok: true, zone, machine, area: areaLabel(zone, machine), part_number: part });
});
