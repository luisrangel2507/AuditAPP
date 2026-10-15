import { q } from './db';
import { mxToday, addDays, mondayOf } from './dates';

const ITEM = `COALESCE(r.item_no, CASE WHEN qq.item_no IS NOT NULL THEN NULLIF(qq.item_no,-1) ELSE qq.sort_order + 1 END)`;

export async function range(days) {
  const today = mxToday();
  const gl = (await q(`SELECT value FROM settings WHERE key='go_live'`)).rows[0]?.value || '1970-01-01';
  const d = Math.max(1, Math.min(366, Number(days) || 28));
  const from = addDays(today, -(d - 1));
  return { today, from: from < gl ? gl : from, to: today, gl };
}

// Cumplimiento por persona: auditorías programadas (ya vencidas o hechas) vs realizadas
export async function compliance({ from, to, today, scope }) {
  const { rows } = await q(
    `SELECT u.id,u.name,u.dept,u.layer,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE a.status='completed')::int AS done,
            COUNT(*) FILTER (WHERE a.status='completed' AND a.late)::int AS late,
            COUNT(*) FILTER (WHERE a.status<>'completed')::int AS missed,
            ROUND(AVG(a.score_pct) FILTER (WHERE a.status='completed')::numeric,1) AS score,
            COALESCE(SUM(a.nok_count+a.partial_count) FILTER (WHERE a.status='completed'),0)::int AS findings
       FROM audits a JOIN users u ON u.id=a.user_id
      WHERE a.date BETWEEN $1 AND $2 AND (a.status='completed' OR a.due_date < $3) AND ($4::int IS NULL OR u.site_id=$4) AND u.access NOT IN ('admin','master')
      GROUP BY u.id ORDER BY (COUNT(*) FILTER (WHERE a.status='completed'))::float/NULLIF(COUNT(*),0), u.name`, [from, to, today, scope]);
  return rows.map((r) => ({ ...r, pct: r.total ? Math.round((r.done / r.total) * 1000) / 10 : 100 }));
}

// Pareto de hallazgos (X y Δ) agrupados por ítem, zona, máquina o número de parte
export async function pareto({ from, to, scope, by }) {
  const col = { item: `COALESCE(${ITEM}::text || ' · ', '') || split_part(f.question, E'\\n', 1)`, zone: `NULLIF(a.zone,'')`, machine: `NULLIF(a.machine,'')`, part: `NULLIF(a.part_number,'')` }[by] || 'a.area';
  const { rows } = await q(
    `SELECT COALESCE(${col},'(sin dato)') AS label, COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE f.result='nok')::int AS nok, COUNT(*) FILTER (WHERE f.result='partial')::int AS partial
       FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id
       LEFT JOIN responses r ON r.id=f.response_id LEFT JOIN questions qq ON qq.id=r.question_id
      WHERE a.date BETWEEN $1 AND $2 AND ($3::int IS NULL OR u.site_id=$3)
      GROUP BY 1 ORDER BY n DESC, 1 LIMIT 25`, [from, to, scope]);
  const total = rows.reduce((s, r) => s + r.n, 0);
  let acc = 0;
  return { total, rows: rows.map((r) => { acc += r.n; return { ...r, cum: total ? Math.round((acc / total) * 100) : 0 }; }) };
}

// Hallazgos repetidos: mismo ítem y misma zona con 2 o más hallazgos en el periodo
export async function repeats({ from, to, scope }) {
  const { rows } = await q(
    `SELECT r.question_id, split_part(f.question, E'\\n', 1) AS question, ${ITEM} AS item, a.area, COUNT(*)::int AS n, MAX(a.date) AS last
       FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id
       JOIN responses r ON r.id=f.response_id LEFT JOIN questions qq ON qq.id=r.question_id
      WHERE a.date BETWEEN $1 AND $2 AND ($3::int IS NULL OR u.site_id=$3)
      GROUP BY r.question_id, 2, 3, a.area HAVING COUNT(*) >= 2 ORDER BY n DESC, last DESC LIMIT 30`, [from, to, scope]);
  return rows;
}

// Datos del reporte semanal (lunes a viernes de la semana de `date`)
export async function weekly({ date, scope }) {
  const today = mxToday();
  const monday = mondayOf(date || today), friday = addDays(monday, 4);
  const gl = (await q(`SELECT value FROM settings WHERE key='go_live'`)).rows[0]?.value || '1970-01-01';
  const from = monday < gl ? gl : monday, to = friday;
  const people = await compliance({ from, to, today: addDays(today, 1) > friday ? addDays(friday, 1) : today, scope });
  const tot = people.reduce((s, p) => ({ total: s.total + p.total, done: s.done + p.done, findings: s.findings + p.findings }), { total: 0, done: 0, findings: 0 });
  const { rows: [fi] } = await q(
    `SELECT COUNT(*) FILTER (WHERE a.date BETWEEN $1 AND $2)::int AS opened,
            COUNT(*) FILTER (WHERE f.closed_at::date BETWEEN $1::date AND $2::date)::int AS closed,
            COUNT(*) FILTER (WHERE f.status<>'closed')::int AS open_now,
            COUNT(*) FILTER (WHERE f.status<>'closed' AND f.due_date < $3::date)::int AS overdue
       FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id WHERE ($4::int IS NULL OR u.site_id=$4)`, [monday, friday, today, scope]);
  const { rows: overdue } = await q(
    `SELECT f.id, split_part(f.question, E'\\n', 1) AS question, f.due_date, a.area,
            COALESCE((SELECT string_agg(ou.name, ', ') FROM finding_owners o JOIN users ou ON ou.id=o.user_id WHERE o.finding_id=f.id AND o.status<>'done'),'Sin responsable') AS owners
       FROM findings f JOIN audits a ON a.id=f.audit_id JOIN users u ON u.id=a.user_id
      WHERE f.status<>'closed' AND f.due_date < $1::date AND ($2::int IS NULL OR u.site_id=$2) ORDER BY f.due_date LIMIT 15`, [today, scope]);
  const top = await pareto({ from, to, scope, by: 'item' });
  return { monday, friday, today, summary: { ...tot, pct: tot.total ? Math.round((tot.done / tot.total) * 1000) / 10 : 100 }, findings: fi, people, overdue, top: top.rows.slice(0, 5) };
}

// CSV con BOM para que Excel respete los acentos
export const toCSV = (header, rows) => '﻿' + [header, ...rows].map((r) => r.map((v) => {
  const s = v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}).join(',')).join('\r\n');
