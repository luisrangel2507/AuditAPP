export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import fs from 'fs';
import path from 'path';
import { route } from '@/lib/api';
import { buildBackup } from '@/lib/backup';
import { makeZip } from '@/lib/zip';
import { migrationExtras } from '@/lib/migration';

// Paquete completo para migrar la app: datos con fotos (JSON), cada foto como archivo, imágenes de la app,
// capturas de todas las pantallas y el código fuente. Sin contraseñas.
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.vercel', 'export']);
function walk(dir, base, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.env')) continue;
    const full = path.join(dir, e.name), rel = path.join(base, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(full, rel, out); }
    else if (e.isFile() && fs.statSync(full).size < 20 * 1024 * 1024) out.push({ name: rel.split(path.sep).join('/'), data: fs.readFileSync(full) });
  }
}
const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/gif': 'gif' };
const img = (s) => { const m = /^data:(image\/[a-z+.-]+);base64,(.*)$/s.exec(String(s || '')); return m ? { ext: EXT[m[1]] || 'img', buf: Buffer.from(m[2], 'base64') } : null; };
const oi = (id) => 'OI-' + String(id).padStart(4, '0');
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const csv = (rows) => '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

export const GET = route(async (req, ctx, user) => {
  const data = await buildBackup(user, true);
  const files = [], index = [['Archivo', 'Tipo', 'Auditoría', 'Issue', 'Fecha', 'Área', 'Pregunta']];
  const audits = Object.fromEntries((data.audits || []).map((a) => [a.id, a]));
  const finds = Object.fromEntries((data.findings || []).map((f) => [f.id, f]));
  for (const r of data.responses || []) {
    const x = img(r.evidence); if (!x) continue;
    const a = audits[r.audit_id] || {}, name = `fotos/auditorias/A${r.audit_id}_R${r.id}_${day(a.date)}.${x.ext}`;
    files.push({ name, data: x.buf }); index.push([name, 'Foto de hallazgo en auditoría', r.audit_id, '', day(a.date), a.area, String(r.question || '').split('\n')[0]]);
  }
  for (const e of data.finding_evidence || []) {
    const x = img(e.data); if (!x) continue;
    const f = finds[e.finding_id] || {}, name = `fotos/cierres/${oi(e.finding_id)}_E${e.id}_${day(e.created_at)}.${x.ext}`;
    files.push({ name, data: x.buf }); index.push([name, 'Evidencia de cierre de issue', f.audit_id, oi(e.finding_id), day(e.created_at), f.area, String(f.question || '').split('\n')[0]]);
  }
  files.push({ name: 'fotos/indice.csv', data: csv(index) });
  files.push({ name: 'datos/lpapp_respaldo_con_fotos.json', data: JSON.stringify(data) });
  const ex = await migrationExtras(user, data);
  files.push(...ex.files);
  const root = process.cwd(), code = [];
  if (fs.existsSync(path.join(root, 'public'))) walk(path.join(root, 'public'), 'imagenes_app', files);
  walk(root, 'codigo', code);
  files.push(...code);
  const counts = Object.entries(data.counts || {}).map(([t, n]) => `  ${t}: ${n}`).join('\n');
  files.unshift({ name: 'LEEME.txt', data: `LPApp · Paquete completo para migración
Generado: ${data.generated_at}

Contenido:
- datos/lpapp_respaldo_con_fotos.json : toda la base de datos (todas las tablas) con las fotos incluidas. Sin contraseñas.
- fotos/auditorias/ : cada foto tomada en un hallazgo de auditoría, como archivo de imagen.
- fotos/cierres/    : cada foto de evidencia de cierre de issue.
- fotos/indice.csv  : a qué auditoría, issue, fecha, área y pregunta corresponde cada foto.
- formatos/         : TODOS los formatos impresos ya llenos con las respuestas (MGMT-015-C de cada Layer y plantilla por semana/mes,
                     QA-062-C, QA-075-C y QA-076-C). Abre formatos/index.html; cada uno se imprime o se guarda como PDF.
- tablas/           : Excel (CSV) legibles: usuarios, calendario de auditorías, respuestas, issues y su seguimiento, firmas de sign-off,
                     ausencias, días festivos, días movidos, notificaciones enviadas, tipos de notificaciones (quién y cuándo),
                     preguntas por formato, configuración e historial de cambios.
- imagenes_app/     : logos, fondos, iconos y el layout de planta que usa la app.
- codigo/           : el código fuente completo de la app (Next.js + PostgreSQL), incluidas las capturas de pantallas en codigo/docs/pantallas.

Registros por tabla:
${counts}

Fotos: ${index.length - 1} archivo(s). Formatos llenos: ${ex.formats}.

Para levantar la app en otro servidor: ver codigo/MIGRACION.md
` });
  const zip = makeZip(files);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(zip, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="lpapp_paquete_completo_${stamp}.zip"`, 'Content-Length': String(zip.length) } });
}, { need: 'master' });
