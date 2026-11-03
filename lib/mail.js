import nodemailer from 'nodemailer';
import { q } from './db';

// Correo de alertas. Configura en Railway: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM y (opcional) ALERT_EMAILS="a@x.com,b@x.com".
// Sin SMTP configurado no se envía correo (el aviso dentro de la app sí se crea).
export async function sendAlertMail(siteId, subject, text) {
  const host = process.env.SMTP_HOST;
  const { rows } = await q(`SELECT email FROM users WHERE active AND email IS NOT NULL AND email <> '' AND access IN ('admin','master') AND ($1::int IS NULL OR site_id=$1 OR access='master')`, [siteId ?? null]);
  const to = [...new Set([...(process.env.ALERT_EMAILS || '').split(','), ...rows.map((r) => r.email)].map((x) => x.trim()).filter(Boolean))];
  if (!host || !to.length) return { sent: false, reason: !host ? 'SMTP no configurado' : 'sin destinatarios' };
  try {
    const tr = nodemailer.createTransport({ host, port: Number(process.env.SMTP_PORT) || 587, secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
    await tr.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: to.join(','), subject, text });
    return { sent: true, to };
  } catch (e) { console.error('mail', e.message); return { sent: false, reason: e.message }; }
}
