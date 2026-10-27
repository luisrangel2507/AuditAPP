export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, err } from '@/lib/api';
import { siteScope } from '@/lib/site';
import { range, compliance, toCSV } from '@/lib/reports';
import { mondayOf, addDays } from '@/lib/dates';

const csv = (name, body) => new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` } });

// Descargas para Excel (CSV): cumplimiento, issues, auditorías y la asignación semanal
export const GET = route(async (req, ctx, user) => {
  const sp = new URL(req.url).searchParams, type = sp.get('type');
  const scope = await siteScope(user), r = await range(sp.get('days'), sp.get('from'), sp.get('to'));
  if (type === 'compliance') {
    const rows = await compliance({ ...r, scope });
    return csv(`cumplimiento_${r.from}_${r.to}.csv`, toCSV(['Persona', 'Departamento', 'Layer', 'Programadas', 'Realizadas', 'Fuera de fecha', 'Pendientes', 'Cumplimiento %', 'Score promedio %', 'Hallazgos'],
      rows.map((p) => [p.name, p.dept, p.layer, p.total, p.done, p.late, p.missed, p.pct, p.score, p.findings])));
  }
  if (type === 'issues') {
    const { rows } = await q(
      `SELECT f.id,f.status,f.result,a.date,a.area,a.part_number,au.name AS auditor,split_part(f.question,E'\\n',1) AS question,f.notes,f.due_date,f.closed_at,f.action,
              COALESCE((SELECT string_agg(ou.name||' ('||o.status||')', '; ') FROM finding_owners o JOIN users ou ON ou.id=o.user_id WHERE o.finding_id=f.id),'') AS owners
         FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users au ON au.id=a.user_id
        WHERE a.date BETWEEN $1 AND $2 AND ($3::int IS NULL OR au.site_id=$3) ORDER BY f.id`, [r.from, r.to, scope]);
    return csv(`issues_${r.from}_${r.to}.csv`, toCSV(['OI', 'Estatus', 'Tipo', 'Fecha auditoría', 'Zona/Máquina', 'N/P', 'Auditor', 'Pregunta', 'Hallazgo', 'Compromiso', 'Cierre', 'Acción', 'Responsables'],
      rows.map((x) => ['OI-' + String(x.id).padStart(4, '0'), x.status, x.result === 'nok' ? 'X' : 'Δ', x.date, x.area, x.part_number, x.auditor, x.question, x.notes, x.due_date, x.closed_at ? new Date(x.closed_at).toISOString().slice(0, 10) : '', x.action, x.owners])));
  }
  if (type === 'audits') {
    const { rows } = await q(
      `SELECT a.id,a.date,a.kind,a.slot,u.name,u.dept,u.layer,a.status,a.area,a.zone,a.machine,a.part_number,a.ok_count,a.nok_count,a.partial_count,a.na_count,a.score_pct,a.completed_at,a.active_sec
         FROM audits a JOIN users u ON u.id=a.user_id WHERE a.date BETWEEN $1 AND $2 AND ($3::int IS NULL OR u.site_id=$3) AND u.access NOT IN ('admin','master') ORDER BY a.date,u.name,a.slot`, [r.from, r.to, scope]);
    return csv(`auditorias_${r.from}_${r.to}.csv`, toCSV(['ID', 'Fecha', 'Tipo', 'Turno', 'Persona', 'Departamento', 'Layer', 'Estatus', 'Área', 'Zona', 'Máquina', 'N/P', 'OK', 'X', 'Δ', 'N/A', 'Score %', 'Registrada', 'Seg. activos'],
      rows.map((x) => [x.id, x.date, x.kind === 'process' ? 'Proceso' : 'LPA', x.slot, x.name, x.dept, x.layer, x.status === 'completed' ? 'Realizada' : 'Pendiente', x.area, x.zone, x.machine, x.part_number, x.ok_count, x.nok_count, x.partial_count, x.na_count, x.score_pct, x.completed_at ? new Date(x.completed_at).toISOString() : '', x.active_sec])));
  }
  if (type === 'assignments') {
    const monday = mondayOf(sp.get('date') || r.today);
    const { rows } = await q(
      `SELECT u.name,u.dept,a.date,a.area FROM audits a JOIN users u ON u.id=a.user_id
        WHERE a.date BETWEEN $1 AND $2 AND a.kind='lpa' AND u.layer=1 AND ($3::int IS NULL OR u.site_id=$3) ORDER BY u.dept,u.name,a.date`, [monday, addDays(monday, 4), scope]);
    const people = [...new Set(rows.map((x) => x.name))];
    const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
    return csv(`asignacion_${monday}.csv`, toCSV(['Persona', ...days], people.map((n) => [n, ...days.map((d) => rows.find((x) => x.name === n && (typeof x.date === 'string' ? x.date : x.date.toISOString().slice(0, 10)) === d)?.area || '')])));
  }
  return err('Tipo de descarga inválido');
}, { need: 'admin' });
