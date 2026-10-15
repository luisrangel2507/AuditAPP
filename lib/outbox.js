'use client';
import { api } from './client';

// Auditorías contestadas sin señal: se guardan en el teléfono y se envían solas al volver la conexión.
const KEY = 'lpa-outbox';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch {} window.dispatchEvent(new Event('lpa-outbox')); };

export const outboxList = () => read();
export function queueAudit(auditId, body, label) {
  const l = read().filter((x) => x.id !== auditId);
  l.push({ id: auditId, body, label: label || `Auditoría #${auditId}`, at: Date.now(), error: '' });
  write(l);
}
let flushing = false;
export async function flushOutbox() {
  if (flushing || typeof navigator === 'undefined' || navigator.onLine === false) return { sent: 0 };
  flushing = true; let sent = 0;
  try {
    for (const it of read()) {
      try {
        await api(`/api/audits/${it.id}/submit`, { method: 'POST', body: it.body });
        write(read().filter((x) => x.id !== it.id)); sent++;
      } catch (e) {
        if (e.network) break; // sigue sin señal
        // El servidor la rechazó (ya enviada, fuera de fecha…): se deja marcada para que la persona la vea
        write(read().map((x) => (x.id === it.id ? { ...x, error: e.message } : x)));
      }
    }
  } finally { flushing = false; }
  return { sent };
}
export const discardQueued = (id) => write(read().filter((x) => x.id !== id));
