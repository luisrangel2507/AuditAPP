export const dynamic = 'force-dynamic';
import { q } from '@/lib/db';
import { route, json, err } from '@/lib/api';
import { siteScope, sameSite } from '@/lib/site';
import { resetEnsured } from '@/lib/schedule';
import { mxToday, addDays } from '@/lib/dates';

const GRACE = 3; // días después de la ausencia en que aún se puede justificar

const KINDS = ['Vacaciones', 'Permiso', 'Incapacidad', 'Capacitación', 'Comisión', 'Otro'];

// Lista de ausencias justificadas (con su justificación y las auditorías que cubren)
export const GET = route(async (req, ctx, user) => {
  const scope = await siteScope(user);
  const { rows } = await q(
    `SELECT x.id,x.user_id,u.name,u.dept,u.layer,x.date_from::text AS date_from,x.date_to::text AS date_to,x.kind,x.note,x.created_by_name,x.created_at,
            (SELECT COUNT(*)::int FROM audits a WHERE a.user_id=x.user_id AND a.status='excused' AND a.date BETWEEN x.date_from AND x.date_to) AS audits
       FROM absences x JOIN users u ON u.id=x.user_id WHERE ($1::int IS NULL OR u.site_id=$1) ORDER BY x.date_from DESC, u.name LIMIT 500`, [scope]);
  return json({ rows, kinds: KINDS });
}, { need: 'admin' });

// Justifica ausencia de una persona (rango de fechas): sus auditorías pendientes en el rango dejan de penalizar
export const POST = route(async (req, ctx, user) => {
  const b = await req.json();
  const uid = Number(b.user_id), from = String(b.date_from || ''), to = String(b.date_to || b.date_from || '');
  const kind = KINDS.includes(b.kind) ? b.kind : 'Otro', note = String(b.note || '').trim().slice(0, 300);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return err('Elige un rango de fechas válido');
  if (addDays(to, GRACE) < mxToday()) return err(`Ya pasó el plazo: solo se puede justificar hasta ${GRACE} días después de que termina la ausencia`);
  if (kind === 'Otro' && note.length < 3) return err('Escribe la justificación');
  const { rows: [t] } = await q('SELECT id,site_id FROM users WHERE id=$1', [uid]);
  if (!t || !sameSite(user, t.site_id)) return err('Usuario inválido', 404);
  const reason = note ? `${kind}: ${note}` : kind;
  await q('INSERT INTO absences(user_id,date_from,date_to,kind,note,reason,created_by,created_by_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [uid, from, to, kind, note, reason, user.id, user.name]);
  const r = await q(
    `UPDATE audits SET status='excused', excuse_reason=$4, excused_at=NOW(), excused_by=$5 WHERE user_id=$1 AND status='pending' AND date BETWEEN $2 AND $3`, [uid, from, to, reason, user.id]);
  resetEnsured();
  return json({ ok: true, audits: r.rowCount });
}, { need: 'admin' });

// Quita una justificación: las auditorías vuelven a pendientes
export const DELETE = route(async (req, ctx, user) => {
  const id = Number(new URL(req.url).searchParams.get('id'));
  const { rows: [x] } = await q('SELECT x.*,u.site_id FROM absences x JOIN users u ON u.id=x.user_id WHERE x.id=$1', [id]);
  if (!x || !sameSite(user, x.site_id)) return err('No encontrada', 404);
  await q(`UPDATE audits SET status='pending', excuse_reason=NULL, excused_at=NULL, excused_by=NULL WHERE user_id=$1 AND status='excused' AND date BETWEEN $2 AND $3 AND excuse_reason=$4`, [x.user_id, x.date_from, x.date_to, x.reason]);
  await q('DELETE FROM absences WHERE id=$1', [id]);
  resetEnsured();
  return json({ ok: true });
}, { need: 'admin' });
