import { q } from './db';
import { siteScope } from './site';
import { mxToday, mondayOf, addDays } from './dates';
import { qeformData, qa062Data, qa075Data, qa076Data } from './formsData';
import { TITLES } from './notify';

// Contenido extra del paquete de migración: formatos impresos ya llenos (HTML listo para imprimir) y tablas legibles (CSV)
const csv = (rows) => '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
const day = (d) => (!d ? '' : typeof d === 'string' ? d.slice(0, 10) : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
const ts = (d) => (!d ? '' : new Date(d).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', hour12: false }));
const first = (t) => String(t || '').split('\n')[0];
const safe = (t) => String(t || 'formato').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 60);
const oi = (id) => 'OI-' + String(id).padStart(4, '0');

// Cuándo y a quién llega cada tipo de aviso
const NOTICE_INFO = {
  audit_reminder: ['Auditoría pendiente del día', 'Al auditor', '12:30 y 16:00 (QEs: 9:00, 12:30 y 16:00) si no ha hecho su auditoría'],
  team_pending: ['Pendientes del equipo', 'Gerentes y supervisores', '14:00 y 17:00: quién de su gente no ha auditado hoy'],
  audit_findings: ['Auditoría LPA con hallazgos', 'Quien auditó, supervisores del área y sus gerentes', 'Al enviar una auditoría LPA con hallazgos (al 100 % no se avisa)'],
  issue_assigned: ['Issue asignado', 'Responsable', 'Al asignarlo como responsable'],
  issue_assigned_mgr: ['Issue asignado a tu equipo', 'Gerente del responsable', 'Al asignar a alguien de su equipo'],
  issue_soon: ['Issue por vencer', 'Responsables', 'Dos días antes del compromiso'],
  issue_overdue: ['Issue vencido', 'Responsables', 'Cada día que pasa vencido'],
  issue_escalated: ['Escalamiento de issue vencido', 'Gerentes (3 días), GM Layer 3 (7 días), Layer 4 (14 días)', 'Según los días de retraso'],
  issue_review: ['Aprobar cierre de issue', 'Quien abrió el issue', 'Cuando todos los responsables terminaron'],
  issue_rejected: ['Cierre rechazado', 'Responsables', 'Cuando quien abrió rechaza el cierre'],
  repeat_finding: ['Hallazgo repetido', 'Responsables y sus gerentes', 'Mismo ítem y zona 3 veces en 30 días'],
  signoff_pending: ['Sign-off pendiente', 'Encargado que firma (L2 → L1, L3 → L2, L4 → L3 o supervisor asignado)', 'Días hábiles a partir de las 16:00'],
  weekly_report: ['Reporte semanal', 'Gerentes Layer 2 y supervisores con gente a cargo (y administradores)', 'Viernes a partir de las 16:00'],
  monthly_report: ['Reporte mensual', 'GM (Layer 3) y Layer 4', 'Último día hábil del mes a partir de las 16:00'],
  daily_summary: ['Resumen del día', 'Administradores', 'Al final del día'],
  short_audit: ['Auditoría muy corta', 'Administradores', 'Si una auditoría se termina en menos de 10 minutos'],
  user_baja: ['Baja de personal', 'Administradores', 'Al dar de baja a una persona'],
  archive_warning: ['Aviso de archivo de fotos', 'Administradores', 'Antes de borrar fotos antiguas'],
  archive_done: ['Archivo de fotos realizado', 'Administradores', 'Después del archivo automático'],
};

const page = (title, css, body, depth) => {
  const up = '../'.repeat(depth);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#e9ecf1;font-family:Arial,Helvetica,sans-serif}.qf{padding:12px}.qf-wrap{margin:0 auto 14px;width:fit-content;max-width:100%;overflow:auto;box-shadow:0 2px 10px rgba(0,0,0,.15)}.mig-h{max-width:1100px;margin:0 auto 10px;font-size:13px;color:#333}.mig-h a{color:#1f4fbf}.ultra-img{height:40px;width:auto;justify-self:start;display:block}
${css}
@media print{.mig-h{display:none}.qf-wrap{box-shadow:none;margin:0}}</style></head><body><div class="qf"><div class="mig-h"><a href="${up}formatos/index.html">← Todos los formatos</a> · <b>${title}</b> · Para PDF: Imprimir → Guardar como PDF</div>${body.replace(/src="\//g, `src="${up}imagenes_app/`)}</div></body></html>`;
};

export async function migrationExtras(user, data) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createElement: h } = await import('react');
  const { QeForm, QF_CSS } = await import('../components/forms/QeSheets');
  const { Q62, Q62_CSS, Q75, Q75_CSS, Q76, Q76_CSS } = await import('../components/forms/QaSheets');
  const scope = await siteScope(user), files = [], index = [];
  const sp = (o) => new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])));
  const siteSql = `($1::int IS NULL OR u.site_id=$1)`;
  const add = (folder, name, title, css, body) => { const depth = folder.split('/').length + 1; const path = `formatos/${folder}/${name}.html`; files.push({ name: path, data: page(title, css, body, depth) }); index.push([folder, title, path.slice('formatos/'.length)]); };

  // MGMT-015-C: cada plantilla con auditorías LPA realizadas, por semana (Layer 1) o por mes / semestre (Layer 2 y 3)
  const { rows: tw } = await q(
    `SELECT a.template_id, t.name, array_agg(DISTINCT date_trunc('week', a.date)::date::text) AS weeks
       FROM audits a JOIN users u ON u.id=a.user_id JOIN templates t ON t.id=a.template_id
      WHERE a.kind='lpa' AND a.status='completed' AND ${siteSql} GROUP BY 1,2 ORDER BY 2`, [scope]);
  for (const t of tw) {
    const done = new Set();
    for (const wk of t.weeks.sort()) {
      const d = await qeformData(scope, sp({ tpl: t.template_id, date: wk }));
      const key = d.weeks ? d.weeks[0] : d.monday;
      if (done.has(key) || !d.columns.some((c) => c.status === 'completed')) continue;
      done.add(key);
      const label = d.weeks ? (d.monthly ? `semestre_${d.weeks[0].slice(0, 7)}` : `mes_${d.weeks[0].slice(0, 7)}`) : `semana_${d.monday}`;
      add(`MGMT-015-C/${safe(t.name)}`, label, `${t.name} · ${label.replace('_', ' ')}`, QF_CSS, renderToStaticMarkup(h(QeForm, { d })));
    }
  }
  // QA-062-C (semanal) y QA-076-C (semanal): semanas con auditoría gerencial / Dock Audit
  const { rows: w62 } = await q(`SELECT DISTINCT date_trunc('week', a.date)::date::text AS w FROM audits a JOIN users u ON u.id=a.user_id WHERE a.extra IS NOT NULL AND a.extra::text LIKE '%parts%' AND ${siteSql} ORDER BY 1`, [scope]);
  for (const { w } of w62) { const d = await qa062Data(scope, sp({ date: w })); if (d.products.length) add('QA-062-C', `semana_${d.monday}`, `QA-062-C · semana ${d.monday}`, Q62_CSS, renderToStaticMarkup(h(Q62, { d }))); }
  const { rows: w76 } = await q(`SELECT DISTINCT date_trunc('week', COALESCE((a.completed_at AT TIME ZONE 'America/Mexico_City')::date, a.date))::date::text AS w FROM audits a JOIN users u ON u.id=a.user_id WHERE a.status='completed' AND a.shipper IS NOT NULL AND a.shipper <> '' AND ${siteSql} ORDER BY 1`, [scope]);
  for (const { w } of w76) { const d = await qa076Data(scope, sp({ date: w })); if (d.cols.some(Boolean)) add('QA-076-C', `semana_${d.monday}`, `QA-076-C · semana ${d.monday}`, Q76_CSS, renderToStaticMarkup(h(Q76, { d }))); }
  // QA-075-C (diario): días con auditoría gerencial realizada
  const { rows: d75 } = await q(`SELECT DISTINCT COALESCE((a.completed_at AT TIME ZONE 'America/Mexico_City')::date, a.date)::text AS d FROM audits a JOIN users u ON u.id=a.user_id WHERE a.extra IS NOT NULL AND a.status='completed' AND a.extra::text LIKE '%parts%' AND ${siteSql} ORDER BY 1`, [scope]);
  for (const r of d75) { const d = await qa075Data(scope, sp({ date: r.d })); if (d.sheets.length) add('QA-075-C', `dia_${d.date}`, `QA-075-C · ${d.date}`, Q75_CSS, renderToStaticMarkup(h(Q75, { d }))); }

  const groups = [...new Set(index.map((x) => x[0]))];
  files.push({ name: 'formatos/index.html', data: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Formatos llenos · LPApp</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:20px auto;padding:0 14px;color:#15202f}h1{font-size:22px}h2{font-size:16px;margin:18px 0 6px;color:#0b3a8c}a{color:#1f4fbf;display:block;margin:3px 0}</style></head><body><h1>Formatos impresos llenos con las respuestas</h1><p>${index.length} formato(s). Abre cualquiera e imprime → Guardar como PDF.</p>${groups.map((g) => `<h2>${g}</h2>${index.filter((x) => x[0] === g).map((x) => `<a href="${x[2]}">${x[1]}</a>`).join('')}`).join('')}</body></html>` });

  // Tablas legibles
  const U = Object.fromEntries((data.users || []).map((u) => [u.id, u])), T = Object.fromEntries((data.templates || []).map((t) => [t.id, t]));
  const DAYN = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const nm = (id) => U[id]?.name || '';
  files.push({ name: 'tablas/usuarios.csv', data: csv([['Id', 'Nombre', 'Usuario', 'Departamento', 'Layer', 'Acceso', 'Formato', 'Días fijos', 'Áreas', 'Reporta a', 'Correo', 'Activo', 'LPA activa'],
    ...(data.users || []).map((u) => [u.id, u.name, u.username, u.dept, u.layer, u.access, T[u.template_id]?.name, (u.days || []).map((x) => DAYN[x]).join(' '), (u.pool || []).join(' | '), nm(u.manager_id), u.email, u.active ? 'Sí' : 'No', u.lpa_override == null ? 'según capa' : u.lpa_override ? 'Sí' : 'No'])]) });
  files.push({ name: 'tablas/calendario_auditorias.csv', data: csv([['Id', 'Fecha', 'Vence', 'Persona', 'Layer', 'Departamento', 'Tipo', 'Formato', 'Área asignada', 'Zona', 'Máquina', 'No. de parte', 'Turno', 'Estatus', 'Tarde', 'Calificación %', 'X', 'Δ', 'No programada', 'Justificación', 'Terminada'],
    ...(data.audits || []).map((a) => [a.id, day(a.date), day(a.due_date), nm(a.user_id), U[a.user_id]?.layer, U[a.user_id]?.dept, a.kind === 'process' ? `Proceso ${a.slot}` : 'LPA', T[a.template_id]?.name, a.area, a.zone, a.machine, a.part_number, a.shift, a.status, a.late ? 'Sí' : '', a.score_pct, a.nok_count, a.partial_count, a.unscheduled ? 'Sí' : '', a.excuse_reason, ts(a.completed_at)])]) });
  const AU = Object.fromEntries((data.audits || []).map((a) => [a.id, a]));
  files.push({ name: 'tablas/respuestas.csv', data: csv([['Auditoría', 'Fecha', 'Persona', 'Ítem', 'Pregunta', 'Categoría', 'Resultado', 'Notas', 'Acción correctiva', 'Foto'],
    ...(data.responses || []).map((r) => { const a = AU[r.audit_id]; return [r.audit_id, day(a?.date), nm(a?.user_id), r.item_no, first(r.question), r.category, ({ ok: 'O', nok: 'X', partial: 'Δ', na: 'N/A' })[r.result] || r.result, r.notes, r.corrective, /^data:image/.test(r.evidence || '') ? `fotos/auditorias/A${r.audit_id}_R${r.id}_${day(a?.date)}` : '']; })]) });
  const own = (fid) => (data.finding_owners || []).filter((o) => o.finding_id === fid);
  files.push({ name: 'tablas/issues.csv', data: csv([['Issue', 'Auditoría', 'Área', 'Pregunta', 'Resultado', 'Hallazgo', 'Estatus', 'Compromiso', 'Abierto', 'Cerrado', 'Acción', 'Responsables (estatus · plan · fecha)'],
    ...(data.findings || []).map((f) => [oi(f.id), f.audit_id, f.area, first(f.question), f.result === 'nok' ? 'X' : 'Δ', f.notes, f.status, day(f.due_date), ts(f.created_at), ts(f.closed_at), f.action, own(f.id).map((o) => `${nm(o.user_id)} (${o.status} · ${o.plan_action || ''} · ${day(o.plan_date)})`).join(' | ')])]) });
  files.push({ name: 'tablas/seguimiento_issues.csv', data: csv([['Issue', 'Fecha', 'Persona', 'Tipo', 'Texto'], ...(data.finding_updates || []).map((x) => [oi(x.finding_id), ts(x.created_at), nm(x.user_id), x.kind, x.text])]) });
  files.push({ name: 'tablas/firmas_signoff.csv', data: csv([['Formato', 'Periodo', 'Firmó', 'Fecha'], ...(data.signoffs || []).map((s) => [T[s.template_id]?.name, day(s.period), s.user_name, ts(s.signed_at)])]) });
  files.push({ name: 'tablas/ausencias.csv', data: csv([['Persona', 'Desde', 'Hasta', 'Motivo', 'Nota', 'Justificación', 'Registró', 'Fecha de registro'], ...(data.absences || []).map((x) => [nm(x.user_id), day(x.date_from), day(x.date_to), x.kind, x.note, x.reason, x.created_by_name, ts(x.created_at)])]) });
  files.push({ name: 'tablas/dias_festivos.csv', data: csv([['Fecha', 'Descripción'], ...(data.holidays || []).map((x) => [day(x.date), x.name])]) });
  files.push({ name: 'tablas/dias_movidos.csv', data: csv([['Persona', 'Fecha', 'Tipo', 'Turno'], ...(data.audit_skips || []).map((x) => [nm(x.user_id), day(x.date), x.kind, x.slot])]) });
  files.push({ name: 'tablas/notificaciones_enviadas.csv', data: csv([['Fecha', 'Tipo', 'Título', 'Para', 'Mensaje', 'Enlace', 'Leída'], ...(data.notifications || []).map((n) => [ts(n.created_at), n.type, TITLES[n.type] || NOTICE_INFO[n.type]?.[0] || n.type, nm(n.user_id) || 'Administradores', n.message, n.link, n.read_at ? ts(n.read_at) : ''])]) });
  files.push({ name: 'tablas/tipos_de_notificaciones.csv', data: csv([['Tipo', 'Título', 'Quién lo recibe', 'Cuándo'], ...Object.entries(NOTICE_INFO).map(([k, v]) => [k, TITLES[k] || v[0], v[1], v[2]])]) });
  files.push({ name: 'tablas/preguntas_por_formato.csv', data: csv([['Formato', 'Zona / categoría', 'Ítem', 'Pregunta (español)', 'Pregunta (inglés)', 'Activa', 'Obligatoria', 'Orden'],
    ...(data.questions || []).map((x) => { const [es, en] = String(x.text || '').split('\n'); return [T[x.template_id]?.name, x.category, x.item_no, es, en, x.active ? 'Sí' : 'No', x.required ? 'Sí' : 'No', x.sort_order]; })]) });
  files.push({ name: 'tablas/configuracion.csv', data: csv([['Clave', 'Valor'], ...(data.settings || []).map((s) => [s.key, s.value])]) });
  files.push({ name: 'tablas/historial_cambios.csv', data: csv([['Fecha', 'Quién', 'Acción', 'Detalle'], ...(data.admin_log || []).map((x) => [ts(x.created_at), x.user_name, x.action, x.detail])]) });
  return { files, formats: index.length };
}
