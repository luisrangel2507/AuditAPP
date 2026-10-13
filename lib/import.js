// Importación masiva de usuarios por planta (pegado desde Excel).
// Columnas (separadas por tabulador o ";"):  Nombre | Depto | Capa | Plantilla | Días | Áreas | Acceso
import { randomInt } from 'crypto';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const DEPTS = {
  quality: 'Calidad', process: 'Procesos', production: 'Producción', logistics: 'Logística', hr: 'RH',
  maintenance: 'Mantenimiento', toolroom: 'Tool Room', program: 'Programas', management: 'Gerencia',
};
const DEPT_LOOKUP = Object.fromEntries(Object.entries(DEPTS).flatMap(([k, v]) => [[k, k], [norm(v), k]]));
const DAY_LOOKUP = { lun: 1, lunes: 1, mar: 2, martes: 2, mie: 3, miercoles: 3, jue: 4, jueves: 4, vie: 5, viernes: 5 };

export function usernameFor(name) {
  const p = norm(name).replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  return p.length > 1 ? `${p[0]}.${p[p.length - 1]}` : p[0] || 'usuario';
}

export function randomPassword(len = 8) {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => abc[randomInt(abc.length)]).join('');
}

// templates: [{id,name}]. Devuelve [{line, name, ok, errors[], user?}]
export function parseRoster(text, templates) {
  const tpl = Object.fromEntries(templates.map((t) => [norm(t.name), t]));
  const out = [];
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    const cells = raw.split(raw.includes('\t') ? '\t' : ';').map((c) => c.trim());
    if (i === 0 && /^nombre/.test(norm(cells[0]))) return; // encabezado
    const [name, dept, capa, plantilla, dias, areas, acceso] = cells;
    const errors = [];
    if (!name) errors.push('falta el nombre');
    const d = DEPT_LOOKUP[norm(dept)];
    if (!d) errors.push(`depto "${dept || ''}" no válido (${Object.values(DEPTS).join(', ')})`);
    const layer = Number(String(capa || '').replace(/\D/g, ''));
    if (![1, 2, 3, 4].includes(layer)) errors.push('capa debe ser 1, 2, 3 o 4');
    const t = tpl[norm(plantilla)];
    if (!t) errors.push(`plantilla "${plantilla || ''}" no existe`);
    let days = [];
    if (layer === 1) {
      days = [...new Set(String(dias || '').split(/[,/|\s]+/).filter(Boolean)
        .map((x) => DAY_LOOKUP[norm(x)] || (/^[1-5]$/.test(x) ? Number(x) : 0)))].sort();
      if (!days.length || days.includes(0)) errors.push('días no válidos (ej. Lun, Mié o 1,3)');
    }
    let pool = String(areas || '').split('|').map((x) => x.trim()).filter(Boolean);
    if (layer >= 2 && !pool.length) pool = ['All Areas'];
    if (layer === 1 && !pool.length) errors.push('falta al menos un área (varias separadas con |)');
    const ac = norm(acceso);
    const access = !ac ? (layer >= 2 ? 'lead' : 'auditor') : ['lead', 'lider'].includes(ac) ? 'lead' : ac === 'auditor' ? 'auditor' : ['admin', 'administrador'].includes(ac) ? 'admin' : '';
    if (!access) errors.push('acceso debe ser auditor, líder o administrador');
    out.push({ line: i + 1, name: name || '', ok: !errors.length, errors,
      user: errors.length ? null : { name, dept: d, layer, template_id: t.id, template: t.name, days, pool, access } });
  });
  return out;
}
