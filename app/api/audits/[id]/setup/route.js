import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { ZONES, NO_MACHINE, areaLabel } from '@/lib/zones';

// Datos que el auditor captura al iniciar (Layer 1 y QEs): zona, máquina y número(s) de parte
export const POST = route(async (req, { params }, user) => {
  const b = await req.json();
  const { rows: [a] } = await q(
    `SELECT a.user_id,a.status,a.kind,u.layer,t.name AS tname FROM audits a JOIN users u ON u.id=a.user_id LEFT JOIN templates t ON t.id=a.template_id WHERE a.id=$1`, [params.id]);
  if (!a) return err('No encontrada', 404);
  if (a.user_id !== user.id) return err('Esta auditoría no es tuya', 403);
  if (a.status === 'completed') return err('Ya fue completada');
  const zone = String(b.zone || '').trim();
  if (!ZONES.includes(zone)) return err('Escoge una zona');
  const full = a.layer === 1 || a.kind === 'process'; // Layer 1 y QEs: máquina y N/P; Layer 2-4: solo el área
  const noPart = a.tname === 'QE Proveedores (LPA)'; // auditoría especial: sin máquina ni número de parte
  const machine = !full || noPart || NO_MACHINE.includes(zone) ? '' : String(b.machine || '').trim().slice(0, 40);
  if (full && !noPart && !NO_MACHINE.includes(zone) && !machine) return err('Escoge o escribe la máquina');
  const list = (Array.isArray(b.part_numbers) ? b.part_numbers : [b.part_number, b.part_number2]).map((x) => String(x || '').trim().slice(0, 40)).filter(Boolean);
  const p1 = [...new Set(list)].slice(0, 8).join(' / '), p2 = '';
  if (full && !noPart && !p1) return err('Captura el número de parte');
  const part = !full ? '' : p2 ? `${p1} / ${p2}` : p1;
  await q('UPDATE audits SET zone=$2, machine=$3, area=$4, part_number=$5, started_at=COALESCE(started_at,NOW()) WHERE id=$1',
    [params.id, zone, machine, areaLabel(zone, machine), part]);
  return json({ ok: true, zone, machine, area: areaLabel(zone, machine), part_number: part });
});
