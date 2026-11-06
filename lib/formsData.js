import { q } from './db';
import { addDays, mondayOf, mxToday, shiftOf } from './dates';

// Datos de cada formato impreso (pantallas de Reportes y paquete de migración)
// Formato impreso de la semana (MGMT-015-C): sin `tpl` = auditoría de proceso de los QEs; con `tpl` = LPA normal de esa plantilla.
// Todas las auditorías de la semana se juntan en el mismo formato, una columna por día.
export async function qeformData(scope, sp) {
  const d = sp.get('date');
  // Solo auditorías normales (LPA); las de proceso no llenan formato. Por defecto, la plantilla de los QEs.
  const { rows: tpls } = await q(
    `SELECT DISTINCT t.id,t.name FROM templates t WHERE EXISTS (SELECT 1 FROM audits a JOIN users u ON u.id=a.user_id WHERE a.template_id=t.id AND a.kind='lpa' AND ($1::int IS NULL OR u.site_id=$1)) OR t.name IN ('Quality Engineer','QA Layer 2 Audit') OR EXISTS (SELECT 1 FROM users uu WHERE uu.template_id=t.id AND uu.active AND ($1::int IS NULL OR uu.site_id=$1)) ORDER BY t.name`, [scope]);
  const tpl = Number(sp.get('tpl')) || tpls.find((t) => t.name === 'Quality Engineer')?.id || tpls[0]?.id || null;
  let monday = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : mxToday());


  const isL2 = (await q(`SELECT 1 FROM users WHERE template_id=$1 AND layer>=2 LIMIT 1`, [tpl])).rowCount > 0;
  const isL3 = (await q(`SELECT 1 FROM users WHERE template_id=$1 AND layer=3 LIMIT 1`, [tpl])).rowCount > 0;
  // Layer 2: formato mensual con una columna por semana (Week 1 … Week 4/5); lunes dentro del mes
  let sunday = addDays(monday, 6), weeks = null;
  if (isL3) { // Layer 3: formato mensual, columnas por mes del semestre (Jul–Dic o Ene–Jun)
    const y = Number(monday.slice(0, 4)), h = Number(monday.slice(5, 7)) > 6 ? 7 : 1;
    weeks = [...Array(6)].map((_, i) => `${y}-${String(h + i).padStart(2, '0')}-01`);
    monday = weeks[0];
    if (h === 7) sunday = `${y}-12-31`; else sunday = `${y}-06-30`;
  } else if (isL2) {
    const first = monday.slice(0, 8) + '01';
    let m = mondayOf(first); if (m < first) m = addDays(m, 7);
    weeks = []; for (let x = m; x.slice(0, 7) === first.slice(0, 7); x = addDays(x, 7)) weeks.push(x);
    monday = weeks[0]; sunday = addDays(weeks[weeks.length - 1], 6);
  }
  const day = `COALESCE((a.completed_at AT TIME ZONE 'America/Mexico_City')::date, a.date)`;
  const { rows: au } = await q(
    `SELECT a.id,${day}::text AS day,a.date,a.slot,a.status,a.late,a.zone,a.machine,a.area,a.part_number,a.score_pct,a.question_ids,a.shift,a.completed_at,u.name,u.layer
       FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.kind='lpa' AND a.template_id=$4
        AND ${day} BETWEEN $1 AND $2 AND ($3::int IS NULL OR u.site_id=$3)
      ORDER BY ${day},a.slot,u.name`, [monday, sunday, scope, tpl]);
  const ids = au.map((r) => r.id);
  const { rows: rs } = ids.length ? await q('SELECT audit_id,question_id,question,item_no,result FROM responses WHERE audit_id = ANY($1::int[])', [ids]) : { rows: [] };
  // Filas = las preguntas activas de la plantilla (para los QEs, las 19 activas del formato QE Layer 1)
  const tname = tpls.find((t) => t.id === tpl)?.name;
  const { rows: tq } = await q(
    `SELECT x.id,CASE WHEN x.item_no IS NOT NULL THEN NULLIF(x.item_no,-1) ELSE x.sort_order + 1 END AS item,x.text
       FROM questions x JOIN templates t ON t.id=x.template_id
      WHERE x.active AND ($1::text = 'Quality Engineer' AND t.name='QE Process Audit' OR t.id=$2 AND $1::text <> 'Quality Engineer') ORDER BY x.sort_order,x.id`, [tname || '', tpl]);
  const rows = tq.map((x) => ({ id: x.id, item: x.item, text: String(x.text).split('\n')[0] }));
  const { rows: fi } = ids.length ? await q(
    `SELECT f.id,f.audit_id,f.area,f.result,f.notes,f.created_at,f.status,f.closed_at,f.action,r.item_no,r.question,r.corrective
       FROM findings f LEFT JOIN responses r ON r.id=f.response_id WHERE f.audit_id = ANY($1::int[]) ORDER BY f.created_at`, [ids]) : { rows: [] };
  const by = {}; for (const r of rs) (by[r.audit_id] ||= {})[r.question_id] = r.result;
  const ini = (n) => String(n).split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).slice(0, 3).join('.');
  const tplName = tpls.find((t) => t.id === tpl)?.name || 'LPA', layer = au[0]?.layer || 1;
  const { rows: sg } = await q(`SELECT period::text AS p, user_name, to_char(signed_at AT TIME ZONE 'America/Mexico_City','DD/MM HH24:MI') AS at FROM signoffs WHERE template_id=$1 AND period BETWEEN $2 AND $3`, [tpl, monday, sunday]);
  const signoffs = Object.fromEntries(sg.map((x) => [x.p, { name: x.user_name, at: x.at }]));
  return ({
    signoffs, monday, sunday, weeks, monthly: isL3, tpl, tplName, layer, templates: tpls, rows,
    columns: au.map((a) => ({ id: a.id, date: a.day, slot: a.slot, name: a.name, initials: ini(a.name), shift: a.layer >= 3 || !a.shift ? (a.completed_at ? shiftOf(new Date(a.completed_at)) : a.shift) : a.shift, status: a.status, late: a.late, zone: a.zone, machine: a.machine, area: a.area, part: a.part_number, score: a.score_pct, answers: by[a.id] || {} })),
    findings: fi.map((f) => ({ id: f.id, audit_id: f.audit_id, item: f.item_no, area: f.area, result: f.result, notes: f.notes, date: f.created_at, status: f.status, closed_at: f.closed_at, action: f.action || f.corrective, question: String(f.question || '').split('\n')[0] })),
  });
}

// Formato QA-062-C "Gestión de Programa de Auditorías": productos de la auditoría gerencial de la semana
// y equipo auditor por día (QEs que tienen su día esa fecha), todo automático.
export async function qa062Data(scope, sp) {
  const d = sp.get('date');
  const monday = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : mxToday());
  const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const { rows: au } = await q(
    `SELECT a.extra, a.date::text AS date FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.extra IS NOT NULL AND a.date BETWEEN $1 AND $2 AND ($3::int IS NULL OR u.site_id=$3) ORDER BY a.date, a.id`, [monday, days[4], scope]);
  const seen = new Set(), products = [];
  for (const r of au) {
    let e = r.extra; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = null; } }
    for (const p of e?.parts || []) { const k = String(p.number || '').trim(); if (!k || seen.has(k)) continue; seen.add(k); products.push({ name: p.name, number: p.number, color: p.color, freq: p.freq, report: 'QA-075-C' }); }
  }
  const { rows: qes } = await q(
    `SELECT u.name, u.days FROM users u WHERE u.active AND u.dept='quality' AND u.layer=1 AND u.access NOT IN ('admin','master') AND ($1::int IS NULL OR u.site_id=$1) ORDER BY u.name`, [scope]);
  const team = days.map((day, i) => qes.filter((x) => (x.days || []).includes(i + 1)).map((x) => x.name));
  return ({ monday, days, products, team });
}

// Formato QA-075-C "Management Audit Findings": una hoja por auditoría gerencial realizada ese día.
// Cada parte (la misma de la LPA) lleva "Sin hallazgos" o el hallazgo con sticker, fecha, operador y turno.
export async function qa075Data(scope, sp) {
  const d = sp.get('date');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : mxToday();
  const { rows: au } = await q(
    `SELECT a.id,a.date::text AS date,a.shift,a.extra,u.name FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.extra IS NOT NULL AND a.status='completed' AND (COALESCE((a.completed_at AT TIME ZONE 'America/Mexico_City')::date, a.date))=$1 AND ($2::int IS NULL OR u.site_id=$2) ORDER BY a.id`, [date, scope]);
  const sheets = [];
  for (const a of au) {
    let e = a.extra; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = null; } }
    const parts = e?.parts || []; if (!parts.length) continue;
    const { rows: rs } = await q(`SELECT r.notes,r.extra FROM responses r WHERE r.audit_id=$1 AND r.category='Auditoría gerencial' AND r.result IN ('nok','partial') ORDER BY r.id`, [a.id]);
    const blocks = [];
    for (const p of parts) {
      const mine = rs.filter((r) => { const x = typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra; return x && (x.part === p.number || parts.length === 1); });
      if (!mine.length) blocks.push({ issue: 'Sin hallazgos', number: p.number, name: p.name });
      for (const r of mine) { const x = typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra; blocks.push({ issue: String(r.notes || '').split(' · Parte:')[0], number: p.number, name: p.name, sticker: x.sticker, operator: x.operator, shift: x.shift, date: a.date }); }
    }
    sheets.push({ id: a.id, auditor: 'QE', who: a.name, date: a.date, shift: a.shift, blocks });
  }
  return ({ date, sheets });
}

// Formato QA-076-C "Dock Audit Findings": por día, el shipper # y el N/P inspeccionado, y el resultado de cada pregunta del Dock Audit.
export async function qa076Data(scope, sp) {
  const d = sp.get('date');
  const monday = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : mxToday());
  const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const { rows: qs } = await q(
    `SELECT DISTINCT ON (x.id) x.id, x.text, x.sort_order FROM questions x WHERE x.category='Dock Audit' AND x.active ORDER BY x.id`);
  const questions = qs.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id).map((x) => { const t = String(x.text).split('\n'); return { id: x.id, text: t[1] || t[0] }; });
  const { rows: au } = await q(
    `SELECT a.id, a.shipper, a.extra, (COALESCE((a.completed_at AT TIME ZONE 'America/Mexico_City')::date, a.date))::text AS day, a.shift, u.name
       FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.status='completed' AND a.shipper IS NOT NULL AND a.shipper <> '' AND COALESCE((a.completed_at AT TIME ZONE 'America/Mexico_City')::date, a.date) BETWEEN $1 AND $2
        AND ($3::int IS NULL OR u.site_id=$3) ORDER BY a.id`, [monday, days[4], scope]);
  const ids = au.map((a) => a.id);
  const { rows: rs } = ids.length ? await q(`SELECT audit_id, question_id, result FROM responses WHERE audit_id = ANY($1::int[]) AND category='Dock Audit'`, [ids]) : { rows: [] };
  const cols = days.map((day) => {
    const a = au.find((x) => x.day === day); if (!a) return null;
    let e = a.extra; if (typeof e === 'string') { try { e = JSON.parse(e); } catch { e = null; } }
    return { shipper: a.shipper, part: e?.dock_part || '', shift: a.shift, answers: Object.fromEntries(rs.filter((r) => r.audit_id === a.id).map((r) => [r.question_id, r.result])) };
  });
  return ({ monday, days, questions, cols });
}
