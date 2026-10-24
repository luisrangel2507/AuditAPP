import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { ZONES, NO_MACHINE, areaLabel } from '@/lib/zones';

// Corregir zona, máquina y número de parte (el auditor, aun después de terminar).
// Queda marcado como corregido y se guardan los originales.
export const POST = route(async (req, { params }, user) => {
  const b = await req.json();
  const { rows: [a] } = await q(
    `SELECT a.user_id,a.part_number,a.part_original,a.area,a.area_original,a.zone,a.machine,a.kind,u.layer
       FROM audits a JOIN users u ON u.id=a.user_id WHERE a.id=$1`, [params.id]);
  if (!a) return err('No encontrada', 404);
  if (a.user_id !== user.id) return err('Solo quien hizo la auditoría puede corregirla', 403);
  const full = a.layer === 1 || a.kind === 'process';
  const list = (Array.isArray(b.part_numbers) ? b.part_numbers : [b.part_number, b.part_number2]).map((x) => String(x || '').trim().slice(0, 40)).filter(Boolean);
  const p1 = [...new Set(list)].slice(0, 8).join(' / '), p2 = '';
  if (full && !p1) return err('Captura el número de parte');
  const part = !full ? '' : p2 ? `${p1} / ${p2}` : p1;
  let zone = a.zone, machine = a.machine, area = a.area;
  if (b.zone !== undefined && !full) { // Layer 2-4: solo la zona
    zone = String(b.zone || '').trim();
    if (!ZONES.includes(zone)) return err('Escoge una zona');
    machine = ''; area = zone;
  }
  if (b.zone !== undefined && full) {
    zone = String(b.zone || '').trim();
    if (!ZONES.includes(zone)) return err('Escoge una zona');
    machine = NO_MACHINE.includes(zone) ? '' : String(b.machine || '').trim().slice(0, 40);
    if (!NO_MACHINE.includes(zone) && !machine) return err('Escoge o escribe la máquina');
    area = areaLabel(zone, machine);
  }
  if (part === a.part_number && area === a.area) return json({ ok: true, part_number: part, area, zone, machine, unchanged: true });
  await q(
    `UPDATE audits SET part_number=$2, area=$3, zone=$4, machine=$5,
            part_original=CASE WHEN $2 <> part_number THEN COALESCE(part_original,part_number) ELSE part_original END,
            area_original=CASE WHEN $3 <> area THEN COALESCE(area_original,area) ELSE area_original END,
            part_edited_at=NOW()
      WHERE id=$1`, [params.id, part, area, zone, machine]);
  return json({ ok: true, part_number: part, area, zone, machine });
});
