import { q } from './db';

// Bitácora de cambios del administrador: se registra sola desde route() en cada cambio (POST/PUT/PATCH/DELETE) exitoso
const SECRET = /pass|pin|pw|secret|evidence|data/i;
const ACTIONS = [
  [/^\/api\/admin\/users$/, 'POST', 'Alta de usuario'],
  [/^\/api\/admin\/users\/(\d+)$/, '*', 'Cambio de usuario'],
  [/^\/api\/admin\/sites\/(\d+)\/import$/, 'POST', 'Importación de usuarios'],
  [/^\/api\/admin\/sites\/(\d+)$/, '*', 'Cambio de planta'],
  [/^\/api\/admin\/templates\/(\d+)\/questions$/, 'POST', 'Nueva pregunta'],
  [/^\/api\/admin\/templates\/(\d+)$/, '*', 'Preguntas por auditoría'],
  [/^\/api\/admin\/questions\/(\d+)$/, 'DELETE', 'Pregunta eliminada'],
  [/^\/api\/admin\/questions\/(\d+)$/, '*', 'Pregunta editada'],
  [/^\/api\/admin\/qes$/, '*', 'Configuración de QEs'],
  [/^\/api\/admin\/archive$/, '*', 'Archivo de fotos antiguas'],
  [/^\/api\/admin\/assignments$/, '*', 'Asignación semanal'],
  [/^\/api\/audits\/(\d+)$/, 'PATCH', 'Cambio en una auditoría (día / zona / N-P)'],
  [/^\/api\/admin\/audits\/(\d+)\/reset$/, 'POST', 'Auditoría eliminada'],
  [/^\/api\/findings\/(\d+)$/, 'DELETE', 'Hallazgo eliminado'],
];
const clip = (v) => (typeof v === 'string' ? v.slice(0, 120) : Array.isArray(v) ? (v.length > 8 ? `[${v.length} elementos]` : v.map(clip)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !SECRET.test(k)).map(([k, x]) => [k, clip(x)])) : v);

export async function logAdminAction(user, method, pathname, body) {
  try {
    if (pathname === '/api/admin/notifications') return;
    const hit = ACTIONS.find(([re, m]) => re.test(pathname) && (m === '*' || m === method));
    if (!hit) return;
    const id = hit[0].exec(pathname)?.[1];
    let detail = '';
    if (body && typeof body === 'object') {
      if (Array.isArray(body.items)) detail = `${body.items.length} cambio(s)`;
      else { const c = clip(body); delete c.password; detail = JSON.stringify(c).slice(0, 400); }
    }
    let who = '';
    if (id && /users/.test(pathname)) who = (await q('SELECT name FROM users WHERE id=$1', [id])).rows[0]?.name || '';
    await q('INSERT INTO admin_log(site_id,user_id,user_name,action,detail) VALUES($1,$2,$3,$4,$5)',
      [user.site_id ?? null, user.id, user.name, hit[2] + (who ? `: ${who}` : id ? ` #${id}` : ''), detail === '{}' ? '' : detail]);
  } catch (e) { console.error('adminlog', e); }
}
