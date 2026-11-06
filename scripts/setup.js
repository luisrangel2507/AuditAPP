// Migraciones idempotentes + seed inicial (solo si la base está vacía). Se corre en cada arranque.
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const bank = require(path.join(__dirname, '../data/question-bank.json'));
const i18n = require(path.join(__dirname, '../data/question-i18n.json'));
// Texto bilingüe "español\ninglés"; si falta traducción se deja el original
const biText = (orig) => { const t = i18n[orig]; return t && t.es && t.en && t.es !== t.en ? `${t.es}\n${t.en}` : orig; };
const { ROSTER, REF_MONDAY, USERNAME_OVERRIDES } = require('../data/roster.js');

const url = process.env.DATABASE_URL;
if (!url) { console.error('Falta DATABASE_URL'); process.exit(1); }
const local = /localhost|127\.0\.0\.1/.test(url);
const pool = new Pool({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false } });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS templates (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  zone      TEXT DEFAULT '',
  per_audit INT  NOT NULL DEFAULT 10
);
CREATE TABLE IF NOT EXISTS questions (
  id          SERIAL PRIMARY KEY,
  template_id INT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  category    TEXT DEFAULT '',
  sort_order  INT DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_questions_tpl ON questions(template_id);

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  username     TEXT NOT NULL UNIQUE,
  pin_hash     TEXT NOT NULL,
  must_change  BOOLEAN NOT NULL DEFAULT TRUE,
  dept         TEXT NOT NULL DEFAULT 'production',
  layer        INT  NOT NULL DEFAULT 1,
  access       TEXT NOT NULL DEFAULT 'auditor',   -- auditor | lead | admin
  template_id  INT REFERENCES templates(id) ON DELETE SET NULL,
  days         INT[] NOT NULL DEFAULT '{}',        -- 1=Lun..5=Vie (fijos)
  pool         TEXT[] NOT NULL DEFAULT '{}',       -- áreas por las que rota
  start_idx    INT NOT NULL DEFAULT 0,
  rotate_daily BOOLEAN NOT NULL DEFAULT FALSE,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audits (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  due_date      DATE NOT NULL,
  area          TEXT NOT NULL DEFAULT '',
  template_id   INT REFERENCES templates(id) ON DELETE SET NULL,
  question_ids  INT[] NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | completed
  completed_at  TIMESTAMPTZ,
  late          BOOLEAN NOT NULL DEFAULT FALSE,
  ok_count      INT DEFAULT 0,
  nok_count     INT DEFAULT 0,
  partial_count INT DEFAULT 0,
  na_count      INT DEFAULT 0,
  score_pct     NUMERIC(5,1),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_audits_date ON audits(date);

CREATE TABLE IF NOT EXISTS responses (
  id          SERIAL PRIMARY KEY,
  audit_id    INT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  question_id INT,
  question    TEXT NOT NULL,
  category    TEXT DEFAULT '',
  result      TEXT NOT NULL,                       -- ok | nok | partial | na
  notes       TEXT DEFAULT '',
  corrective  TEXT DEFAULT '',
  evidence    TEXT DEFAULT ''                      -- data URL jpeg (comprimida en el cliente)
);
CREATE INDEX IF NOT EXISTS idx_responses_audit ON responses(audit_id);

CREATE TABLE IF NOT EXISTS findings (
  id          SERIAL PRIMARY KEY,
  audit_id    INT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  response_id INT REFERENCES responses(id) ON DELETE CASCADE,
  area        TEXT DEFAULT '',
  question    TEXT NOT NULL,
  result      TEXT NOT NULL,
  notes       TEXT DEFAULT '',
  owner_id    INT REFERENCES users(id) ON DELETE SET NULL,
  due_date    DATE,
  status      TEXT NOT NULL DEFAULT 'open',        -- open | in_progress | closed
  action      TEXT DEFAULT '',
  closed_at   TIMESTAMPTZ,
  closed_by   INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);

-- Tiempos de auditoría (estadísticas admin)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS active_sec INT;
-- Auditorías de proceso de los QEs (2 diarias): mismo esquema, con tipo y número de turno
ALTER TABLE audits ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'lpa';
ALTER TABLE audits ADD COLUMN IF NOT EXISTS slot INT NOT NULL DEFAULT 1;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS zone TEXT NOT NULL DEFAULT '';
ALTER TABLE audits ADD COLUMN IF NOT EXISTS part_original TEXT;   -- N/P capturado al inicio, si luego se corrigió
ALTER TABLE audits ADD COLUMN IF NOT EXISTS part_edited_at TIMESTAMPTZ;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS area_original TEXT;   -- zona/máquina original, si luego se corrigió
ALTER TABLE questions ADD COLUMN IF NOT EXISTS item_no INT; -- número de ítem del formato (-1 = sin número)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS machine TEXT NOT NULL DEFAULT '';
ALTER TABLE audits DROP CONSTRAINT IF EXISTS audits_user_id_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_audits_slot ON audits(user_id,date,kind,slot);
-- Avisos para cualquier usuario (issues, recordatorios, resúmenes) y su envío push
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_dedupe ON notifications(dedupe) WHERE dedupe IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS push_subs (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Bitácora de cambios del administrador
CREATE TABLE IF NOT EXISTS admin_log (
  id         SERIAL PRIMARY KEY,
  site_id    INT,
  user_id    INT,
  user_name  TEXT,
  action     TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_log_at ON admin_log(created_at DESC);
-- Versiones de preguntas: cada cambio guarda la versión anterior y las respuestas conservan texto e ítem del momento
ALTER TABLE questions ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS item_no INT;
CREATE TABLE IF NOT EXISTS question_versions (
  id          SERIAL PRIMARY KEY,
  question_id INT NOT NULL,
  version     INT NOT NULL,
  text        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT '',
  item_no     INT,
  active      BOOLEAN,
  change      TEXT NOT NULL DEFAULT 'edit',
  changed_by  INT,
  changed_by_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qversions_q ON question_versions(question_id,version DESC);
-- Auditorías que el admin cambió de día: el día original no se vuelve a generar
CREATE TABLE IF NOT EXISTS audit_skips (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    DATE NOT NULL,
  kind    TEXT NOT NULL DEFAULT 'lpa',
  slot    INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, date, kind, slot)
);
-- LPA por usuario: NULL = según su rol (los QEs dependen del interruptor general), TRUE/FALSE = decisión del admin en su perfil
ALTER TABLE users ADD COLUMN IF NOT EXISTS lpa_override BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lpa_from DATE;   -- desde cuándo se le generan LPA (no se crean días pasados al activarla)
-- Temas específicos de la LPA de los QEs (Dock Audit QA-076-C y auditoría gerencial QA-062-C / QA-075-C)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT FALSE;   -- se incluye en todas las auditorías de la plantilla
ALTER TABLE audits ADD COLUMN IF NOT EXISTS shipper TEXT NOT NULL DEFAULT '';
ALTER TABLE audits ADD COLUMN IF NOT EXISTS extra JSONB;                                  -- partes revisadas en la etapa gerencial (QA-062-C)             -- shipper # revisado en el Dock Audit
ALTER TABLE responses ADD COLUMN IF NOT EXISTS extra JSONB;                               -- sticker / operador / turno de los hallazgos gerenciales
CREATE TABLE IF NOT EXISTS finding_evidence (
  id         SERIAL PRIMARY KEY,
  finding_id INT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  data       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fevidence_finding ON finding_evidence(finding_id);
CREATE TABLE IF NOT EXISTS finding_deletions (
  id         SERIAL PRIMARY KEY,
  finding_id INT,
  audit_id   INT,
  question   TEXT,
  notes      TEXT,
  reason     TEXT NOT NULL,
  deleted_by INT,
  deleted_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audit_deletions (
  id         SERIAL PRIMARY KEY,
  site_id    INT,
  auditor_id INT,
  auditor    TEXT,
  audit_date DATE,
  kind       TEXT,
  slot       INT,
  zone       TEXT,
  part_number TEXT,
  reason     TEXT NOT NULL,
  deleted_by INT,
  deleted_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  site_id    INT,
  type       TEXT NOT NULL,
  audit_id   INT REFERENCES audits(id) ON DELETE CASCADE,
  user_id    INT,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notif_site ON notifications(site_id, created_at DESC);
-- Número de parte a inspeccionar (lo asigna el admin junto con la zona/área)
ALTER TABLE audits ADD COLUMN IF NOT EXISTS part_number TEXT NOT NULL DEFAULT '';

-- Open issues: cada responsable da seguimiento por su cuenta
CREATE TABLE IF NOT EXISTS finding_owners (
  finding_id INT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'open',          -- open | in_progress | done
  action     TEXT DEFAULT '',
  added_by   INT REFERENCES users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ DEFAULT NOW(),
  done_at    TIMESTAMPTZ,
  PRIMARY KEY (finding_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_fowners_user ON finding_owners(user_id);
CREATE TABLE IF NOT EXISTS finding_updates (
  id         SERIAL PRIMARY KEY,
  finding_id INT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  kind       TEXT NOT NULL DEFAULT 'comment',       -- opened | assign | unassign | progress | done | comment | closed | reopened
  text       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fupdates_finding ON finding_updates(finding_id);
-- Plantas (multi-planta). Cada usuario pertenece a una; el admin (site_id NULL) ve todas.
CREATE TABLE IF NOT EXISTS sites (
  id         SERIAL PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT FALSE,     -- en marcha: genera auditorías
  go_live    DATE,                               -- primer día en que cuenta la planta
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_id INT REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_site ON users(site_id);
INSERT INTO sites(code,name,active) VALUES ('MPQ','MPQ',TRUE),('MPS','MPS',FALSE),('MPC','MPC',FALSE),('UMW','UMW',FALSE),('MPD','MPD',FALSE)
  ON CONFLICT (code) DO NOTHING;
-- Todo lo que existía antes de multi-planta es de MPQ
UPDATE users SET site_id=(SELECT id FROM sites WHERE code='MPQ') WHERE site_id IS NULL AND access NOT IN ('admin','master');
-- El administrador global anterior (sin planta) pasa a ser máster; los admins de planta se crean después
UPDATE users SET access='master' WHERE access='admin' AND site_id IS NULL;
-- Layer 2, 3 y 4: All Areas sin N/P (el auditor escoge el área al auditar)
UPDATE audits SET area='All Areas', part_number='' WHERE status='pending' AND user_id IN (SELECT id FROM users WHERE layer>=2);
-- Migra el responsable único anterior
INSERT INTO finding_owners(finding_id,user_id,status,action)
  SELECT id, owner_id, CASE WHEN status='closed' THEN 'done' WHEN status='in_progress' THEN 'in_progress' ELSE 'open' END, COALESCE(action,'')
    FROM findings WHERE owner_id IS NOT NULL
  ON CONFLICT DO NOTHING;
`;

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 .]/g, '').trim();
}
function usernameFor(name) {
  if (USERNAME_OVERRIDES[name]) return USERNAME_OVERRIDES[name];
  const p = slug(name).replace(/\./g, '').split(/\s+/);
  return p.length > 1 ? `${p[0]}.${p[p.length - 1]}` : p[0];
}

async function main() {
  await pool.query(SCHEMA);
  await pool.query(`INSERT INTO settings(key,value) VALUES('ref_monday',$1) ON CONFLICT DO NOTHING`, [REF_MONDAY]);
  // Fecha de arranque: antes de ella no se reportan faltantes (evita "deudas" fantasma el primer día)
  const mxToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  await pool.query(`INSERT INTO settings(key,value) VALUES('go_live',$1) ON CONFLICT DO NOTHING`,
    [process.env.LPA_GO_LIVE || mxToday]);

  // Banco de preguntas (derivado de QualityShield) – solo si no hay plantillas
  const { rows: t } = await pool.query('SELECT COUNT(*)::int n FROM templates');
  if (t[0].n === 0) {
    for (const tpl of bank) {
      const { rows } = await pool.query(
        'INSERT INTO templates(name,zone,per_audit) VALUES($1,$2,$3) RETURNING id',
        [tpl.name, tpl.zone, 10]
      );
      for (let i = 0; i < tpl.questions.length; i++) {
        await pool.query('INSERT INTO questions(template_id,text,category,sort_order) VALUES($1,$2,$3,$4)',
          [rows[0].id, biText(tpl.questions[i]), tpl.zone, i]);
      }
    }
    console.log(`[setup] ${bank.length} plantillas cargadas`);
  }

  // Auditoría de proceso de los QEs: preguntas e ítems del formato "QE Layer 1 Audit" (español primero, luego inglés)
  const qeTpl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'qe-process.json'), 'utf8'));
  let { rows: [qt] } = await pool.query('SELECT id FROM templates WHERE name=$1', [qeTpl.name]);
  if (!qt) {
    ({ rows: [qt] } = await pool.query('INSERT INTO templates(name,zone,per_audit) VALUES($1,$2,$3) RETURNING id', [qeTpl.name, qeTpl.zone, qeTpl.per_audit]));
    for (let i = 0; i < qeTpl.questions.length; i++) {
      const x = qeTpl.questions[i];
      await pool.query('INSERT INTO questions(template_id,text,category,sort_order,item_no) VALUES($1,$2,$3,$4,$5)',
        [qt.id, `${x.es}\n${x.en}`, qeTpl.zone, i, x.item ?? -1]);
    }
    // Las auditorías de proceso pendientes (hoy en adelante) se regeneran con las preguntas nuevas
    await pool.query(`DELETE FROM audits WHERE kind='process' AND status='pending' AND date >= $1`, [mxToday]);
    console.log('[setup] plantilla QE Process Audit cargada');
  }

  // Ajuste único: las auditorías de proceso de los QEs llevan las 19 preguntas (si ya se había creado con 10)
  const flag = await pool.query(`INSERT INTO settings(key,value) VALUES('qe_process_all_19','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flag.rowCount) {
    await pool.query(`UPDATE templates SET per_audit=19 WHERE name=$1`, [qeTpl.name]);
    await pool.query(`DELETE FROM audits WHERE kind='process' AND status='pending' AND date >= $1`, [mxToday]);
    console.log('[setup] QE Process Audit: 19 preguntas por auditoría');
  }

  // LPA Layer 2 del Gerente de Calidad (formato MGMT-015-C): 11 preguntas fijas, semanal
  const l2 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'qa-layer2.json'), 'utf8'));
  const { rows: [l2t] } = await pool.query('SELECT id FROM templates WHERE name=$1', [l2.name]);
  if (!l2t) {
    const { rows: [nt] } = await pool.query('INSERT INTO templates(name,zone,per_audit) VALUES($1,$2,$3) RETURNING id', [l2.name, l2.zone, l2.questions.length]);
    for (let i = 0; i < l2.questions.length; i++) {
      const x = l2.questions[i];
      await pool.query('INSERT INTO questions(template_id,text,category,sort_order,item_no,required) VALUES($1,$2,$3,$4,$5,TRUE)',
        [nt.id, `${x.es}\n${x.en}`, l2.zone, i, x.item ?? -1]);
    }
    console.log('[setup] plantilla QA Layer 2 Audit cargada');
  }

  // Ajuste único: los formatos de calidad ya no rotan preguntas; las auditorías pendientes se regeneran con todas las activas
  const flagNR = await pool.query(`INSERT INTO settings(key,value) VALUES('no_rotate_quality_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flagNR.rowCount) {
    await pool.query(
      `DELETE FROM audits a USING templates t WHERE a.template_id=t.id AND t.name IN ('QE Process Audit','Quality Engineer','QA Layer 2 Audit') AND a.status='pending' AND a.date >= $1`, [mxToday]);
    console.log('[setup] formatos de calidad sin rotación de preguntas');
  }

  // Ajuste único: ninguna plantilla rota preguntas; las auditorías pendientes (hoy en adelante) llevan todas las activas.
  // Se actualizan en su lugar para conservar zona, día y demás asignaciones del admin.
  const flagAll = await pool.query(`INSERT INTO settings(key,value) VALUES('no_rotate_all_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flagAll.rowCount) {
    const r = await pool.query(
      `UPDATE audits a SET question_ids = COALESCE((SELECT array_agg(x.id ORDER BY x.required, x.sort_order, x.id) FROM questions x WHERE x.template_id=a.template_id AND x.active), a.question_ids)
        WHERE a.status='pending' AND a.date >= $1 AND a.template_id IS NOT NULL AND a.started_at IS NULL`, [mxToday]);
    console.log(`[setup] sin rotación de preguntas: ${r.rowCount} auditorías pendientes actualizadas`);
  }

  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS process_per_day INT');
  await pool.query('ALTER TABLE audits ADD COLUMN IF NOT EXISTS operators TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id INT REFERENCES users(id) ON DELETE SET NULL');
  // Juventino Morales (GM): Auditor y encargado para ver el Panel de todos
  const jv = await pool.query(`UPDATE users SET access='lead' WHERE translate(lower(name),'áéíóú','aeiou') LIKE 'juventino%' AND layer >= 3 AND access='auditor'`);
  if (jv.rowCount) console.log('[setup] Juventino → Auditor y encargado (Panel)');
  // Hugo Beltrán es Layer 2 (gerente)
  const hb = await pool.query(`SELECT id FROM users WHERE translate(lower(name),'áéíóú','aeiou') LIKE 'hugo beltran%' AND layer <> 2`);
  if (hb.rowCount) { await pool.query(`UPDATE users SET layer=2 WHERE id = ANY($1::int[])`, [hb.rows.map((r) => r.id)]); await pool.query(`DELETE FROM audits WHERE user_id = ANY($1::int[]) AND status='pending' AND kind='lpa' AND date >= CURRENT_DATE`, [hb.rows.map((r) => r.id)]); console.log('[setup] Hugo Beltrán → Layer 2'); }
  await pool.query('ALTER TABLE audits ADD COLUMN IF NOT EXISTS excuse_reason TEXT');
  await pool.query('ALTER TABLE audits ADD COLUMN IF NOT EXISTS excused_at TIMESTAMPTZ');
  await pool.query('ALTER TABLE audits ADD COLUMN IF NOT EXISTS excused_by INT');
  await pool.query(`CREATE TABLE IF NOT EXISTS holidays (date DATE PRIMARY KEY, name TEXT NOT NULL DEFAULT 'Día festivo', created_by INT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS absences (
    id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_from DATE NOT NULL, date_to DATE NOT NULL, kind TEXT NOT NULL, note TEXT DEFAULT '', reason TEXT NOT NULL,
    created_by INT, created_by_name TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await pool.query("ALTER TABLE finding_owners ADD COLUMN IF NOT EXISTS plan_action TEXT DEFAULT ''");
  await pool.query('ALTER TABLE finding_owners ADD COLUMN IF NOT EXISTS plan_date DATE');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS process_template_id INT REFERENCES templates(id) ON DELETE SET NULL');
  await pool.query('ALTER TABLE audits ADD COLUMN IF NOT EXISTS unscheduled BOOLEAN NOT NULL DEFAULT FALSE');

  // LPA de los QEs en Proveedores / contención (formato QE Layer 1 Audit): 17 preguntas fijas
  const prov = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'qe-proveedores.json'), 'utf8'));
  const { rows: [pt] } = await pool.query('SELECT id FROM templates WHERE name=$1', [prov.name]);
  if (!pt) {
    const { rows: [nt] } = await pool.query('INSERT INTO templates(name,zone,per_audit) VALUES($1,$2,$3) RETURNING id', [prov.name, prov.zone, prov.questions.length]);
    for (let i = 0; i < prov.questions.length; i++) {
      const x = prov.questions[i];
      await pool.query('INSERT INTO questions(template_id,text,category,sort_order,item_no,required) VALUES($1,$2,$3,$4,$5,TRUE)', [nt.id, `${x.es}\n${x.en}`, prov.zone, i, x.item ?? -1]);
    }
    console.log('[setup] plantilla QE Proveedores (LPA) cargada');
  }
  // María Olguín: QE adicional, solo auditorías de proceso (su LPA queda apagada; si se enciende usa las preguntas de Proveedores)
  const { rows: [mo] } = await pool.query(`SELECT 1 FROM users WHERE name='María Olguín' AND dept='quality'`);
  if (!mo) {
    const { rows: [tp] } = await pool.query('SELECT id FROM templates WHERE name=$1', [prov.name]);
    let un = usernameFor('María Olguín'), n = 2;
    while ((await pool.query('SELECT 1 FROM users WHERE username=$1', [un])).rowCount) un = usernameFor('María Olguín') + n++;
    const hash = process.env.SEED_PASSWORD ? await bcrypt.hash(process.env.SEED_PASSWORD, 10) : await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 10);
    await pool.query(
      `INSERT INTO users(name,username,pin_hash,dept,layer,access,template_id,days,pool,start_idx,rotate_daily,lpa_override,process_per_day,site_id)
       VALUES('María Olguín',$1,$2,'quality',1,'auditor',$3,'{1,2,3,4,5}','{}',0,FALSE,FALSE,1,(SELECT id FROM sites WHERE code='MPQ'))`, [un, hash, tp.id]);
    console.log(`[setup] usuario María Olguín creado (${un}); asigna su contraseña en Admin → Usuarios`);
  }

  // María Olguín: una sola auditoría de proceso al día (la de la mañana)
  const flagMo = await pool.query(`INSERT INTO settings(key,value) VALUES('maria_one_per_day','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flagMo.rowCount) {
    await pool.query(`UPDATE users SET process_per_day=1 WHERE name='María Olguín' AND dept='quality'`);
    await pool.query(`DELETE FROM audits a USING users u WHERE a.user_id=u.id AND u.name='María Olguín' AND a.kind='process' AND a.status='pending' AND a.slot > 1 AND a.date >= $1`, [mxToday]);
  }

  // María Olguín (iniciales GOG): su auditoría diaria es la especial de Proveedores (17 preguntas propias), no la de proceso de los QEs
  const flagSp = await pool.query(`INSERT INTO settings(key,value) VALUES('maria_special_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flagSp.rowCount) {
    const { rows: [sp] } = await pool.query(`SELECT id FROM templates WHERE name='QE Proveedores (LPA)'`);
    const { rows: [mu] } = await pool.query(`SELECT id FROM users WHERE name='María Olguín' AND dept='quality'`);
    if (sp && mu) {
      await pool.query('UPDATE users SET process_template_id=$1 WHERE id=$2', [sp.id, mu.id]);
      await pool.query(
        `UPDATE audits SET template_id=$1, question_ids=(SELECT array_agg(id ORDER BY sort_order,id) FROM questions WHERE template_id=$1 AND active)
          WHERE user_id=$2 AND kind='process' AND status='pending' AND started_at IS NULL AND date >= $3`, [sp.id, mu.id, mxToday]);
      console.log('[setup] María Olguín: auditoría diaria especial de Proveedores');
    }
  }

  // Reparación: auditorías pendientes que quedaron sin preguntas (plantillas con todas las preguntas fijas)
  await pool.query(
    `UPDATE audits a SET question_ids=(SELECT array_agg(x.id ORDER BY x.sort_order,x.id) FROM questions x WHERE x.template_id=a.template_id AND x.active)
      WHERE a.status='pending' AND a.template_id IS NOT NULL AND COALESCE(cardinality(a.question_ids),0)=0
        AND EXISTS (SELECT 1 FROM questions x WHERE x.template_id=a.template_id AND x.active)`);

  // Refuerzo: María Olguín (Gladys) siempre con su auditoría especial en las pendientes que aún no empieza
  const { rows: [spv] } = await pool.query(`SELECT id FROM templates WHERE name='QE Proveedores (LPA)'`);
  const { rows: [mu2] } = await pool.query(`SELECT id,process_template_id FROM users WHERE name='María Olguín' AND dept='quality'`);
  if (spv && mu2) {
    const flag2 = await pool.query(`INSERT INTO settings(key,value) VALUES('maria_special_v2','1') ON CONFLICT DO NOTHING RETURNING key`);
    if (flag2.rowCount && !mu2.process_template_id) await pool.query('UPDATE users SET process_template_id=$1 WHERE id=$2', [spv.id, mu2.id]);
    const { rows: [cur] } = await pool.query('SELECT process_template_id AS t FROM users WHERE id=$1', [mu2.id]);
    if (cur.t) {
      const r = await pool.query(
        `UPDATE audits SET template_id=$1, question_ids=(SELECT array_agg(id ORDER BY sort_order,id) FROM questions WHERE template_id=$1 AND active)
          WHERE user_id=$2 AND kind='process' AND status='pending' AND started_at IS NULL AND date >= $3 AND template_id IS DISTINCT FROM $1`, [cur.t, mu2.id, mxToday]);
      if (r.rowCount) console.log(`[setup] María Olguín: ${r.rowCount} auditorías pendientes con sus preguntas especiales`);
    }
  }

  // Layer 3: una auditoría al mes; se quitan las semanales pendientes que ya no corresponden (fuera de la primera semana del mes)
  await pool.query(
    `DELETE FROM audits a USING users u WHERE a.user_id=u.id AND u.layer=3 AND a.kind='lpa' AND a.status='pending' AND a.date >= $1 AND EXTRACT(DAY FROM a.date) > 7`, [mxToday]);

  // Production Layer 2 Audit (formato Ultra): 15 preguntas fijas para los gerentes de Producción (Layer 2)
  const pl2 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'prod-layer2.json'), 'utf8'));
  let { rows: [pt2] } = await pool.query('SELECT id FROM templates WHERE name=$1', [pl2.name]);
  if (!pt2) {
    ({ rows: [pt2] } = await pool.query('INSERT INTO templates(name,zone,per_audit) VALUES($1,$2,$3) RETURNING id', [pl2.name, pl2.zone, pl2.questions.length]));
    for (let i = 0; i < pl2.questions.length; i++) {
      const x = pl2.questions[i];
      await pool.query('INSERT INTO questions(template_id,text,category,sort_order,item_no,required) VALUES($1,$2,$3,$4,$5,TRUE)', [pt2.id, `${x.es}\n${x.en}`, pl2.zone, i, x.item]);
    }
    console.log('[setup] plantilla Production Layer 2 Audit cargada');
  }
  const flagPl2 = await pool.query(`INSERT INTO settings(key,value) VALUES('prod_layer2_assign_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flagPl2.rowCount) {
    const u2 = await pool.query(`UPDATE users SET template_id=$1 WHERE dept='production' AND layer=2 AND access NOT IN ('admin','master')`, [pt2.id]);
    await pool.query(
      `UPDATE audits a SET template_id=$1, question_ids=(SELECT array_agg(x.id ORDER BY x.sort_order,x.id) FROM questions x WHERE x.template_id=$1 AND x.active)
        FROM users u WHERE a.user_id=u.id AND u.dept='production' AND u.layer=2 AND a.kind='lpa' AND a.status='pending' AND a.started_at IS NULL AND a.date >= $2`, [pt2.id, mxToday]);
    console.log(`[setup] Production Layer 2 Audit asignada a ${u2.rowCount} usuario(s) de Producción Layer 2`);
  }

  await pool.query('ALTER TABLE audits ADD COLUMN IF NOT EXISTS shift INT');
  // PE Layer 1 LPA (formato Ultra): 17 preguntas fijas para los Process Engineers de Layer 1
  const pe1 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'pe-layer1.json'), 'utf8'));
  let { rows: [pet] } = await pool.query('SELECT id FROM templates WHERE name=$1', [pe1.name]);
  if (!pet) {
    ({ rows: [pet] } = await pool.query('INSERT INTO templates(name,zone,per_audit) VALUES($1,$2,$3) RETURNING id', [pe1.name, pe1.zone, pe1.questions.length]));
    for (let i = 0; i < pe1.questions.length; i++) {
      const x = pe1.questions[i];
      await pool.query('INSERT INTO questions(template_id,text,category,sort_order,item_no,required) VALUES($1,$2,$3,$4,$5,TRUE)', [pet.id, `${x.es}\n${x.en}`, pe1.zone, i, x.item]);
    }
    console.log('[setup] plantilla PE Layer 1 LPA cargada');
  }
  const flagPe = await pool.query(`INSERT INTO settings(key,value) VALUES('pe_layer1_assign_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flagPe.rowCount) {
    const u1 = await pool.query(`UPDATE users SET template_id=$1 WHERE dept='process' AND layer=1 AND template_id=(SELECT id FROM templates WHERE name='Process Engineer') AND access NOT IN ('admin','master')`, [pet.id]);
    await pool.query(
      `UPDATE audits a SET template_id=$1, question_ids=(SELECT array_agg(x.id ORDER BY x.sort_order,x.id) FROM questions x WHERE x.template_id=$1 AND x.active)
        FROM users u WHERE a.user_id=u.id AND u.template_id=$1 AND a.kind='lpa' AND a.status='pending' AND a.started_at IS NULL AND a.date >= $2`, [pet.id, mxToday]);
    console.log(`[setup] PE Layer 1 LPA asignada a ${u1.rowCount} Process Engineer(s) de Layer 1`);
  }

  // Paint Layer 2 Audit (formato Ultra): 7 preguntas fijas; la hace Armando Martínez (gerente de pintura)
  const pn = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'paint-layer2.json'), 'utf8'));
  let { rows: [pnt] } = await pool.query('SELECT id FROM templates WHERE name=$1', [pn.name]);
  if (!pnt) {
    ({ rows: [pnt] } = await pool.query('INSERT INTO templates(name,zone,per_audit) VALUES($1,$2,$3) RETURNING id', [pn.name, pn.zone, pn.questions.length]));
    for (let i = 0; i < pn.questions.length; i++) {
      const x = pn.questions[i];
      await pool.query('INSERT INTO questions(template_id,text,category,sort_order,item_no,required) VALUES($1,$2,$3,$4,$5,TRUE)', [pnt.id, `${x.es}\n${x.en}`, pn.zone, i, x.item]);
    }
    console.log('[setup] plantilla Paint Layer 2 Audit cargada');
  }
  const flagPn = await pool.query(`INSERT INTO settings(key,value) VALUES('paint_layer2_assign_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flagPn.rowCount) {
    const un = await pool.query(`UPDATE users SET template_id=$1 WHERE layer=2 AND dept='production' AND translate(lower(name),'áéíóú','aeiou') LIKE 'armando mart%'`, [pnt.id]);
    await pool.query(
      `UPDATE audits a SET template_id=$1, question_ids=(SELECT array_agg(x.id ORDER BY x.sort_order,x.id) FROM questions x WHERE x.template_id=$1 AND x.active)
        FROM users u WHERE a.user_id=u.id AND u.template_id=$1 AND a.kind='lpa' AND a.status='pending' AND a.started_at IS NULL AND a.date >= $2`, [pnt.id, mxToday]);
    console.log(`[setup] Paint Layer 2 Audit asignada a ${un.rowCount} usuario(s) (Armando Martínez)`);
  }

  // Paint Line Layer 1 Audit (formato Ultra): 13 preguntas fijas para los líderes de celda de pintura (Layer 1)
  const pl1 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'paint-layer1.json'), 'utf8'));
  let { rows: [plt] } = await pool.query('SELECT id FROM templates WHERE name=$1', [pl1.name]);
  if (!plt) {
    ({ rows: [plt] } = await pool.query('INSERT INTO templates(name,zone,per_audit) VALUES($1,$2,$3) RETURNING id', [pl1.name, pl1.zone, pl1.questions.length]));
    for (let i = 0; i < pl1.questions.length; i++) {
      const x = pl1.questions[i];
      await pool.query('INSERT INTO questions(template_id,text,category,sort_order,item_no,required) VALUES($1,$2,$3,$4,$5,TRUE)', [plt.id, `${x.es}\n${x.en}`, pl1.zone, i, x.item]);
    }
    console.log('[setup] plantilla Paint Line Layer 1 Audit cargada');
  }
  const flagPl1 = await pool.query(`INSERT INTO settings(key,value) VALUES('paint_layer1_assign_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flagPl1.rowCount) {
    const up = await pool.query(`UPDATE users SET template_id=$1 WHERE layer=1 AND template_id=(SELECT id FROM templates WHERE name LIKE 'Cell Leader%Paint') AND access NOT IN ('admin','master')`, [plt.id]);
    await pool.query(
      `UPDATE audits a SET template_id=$1, question_ids=(SELECT array_agg(x.id ORDER BY x.sort_order,x.id) FROM questions x WHERE x.template_id=$1 AND x.active)
        FROM users u WHERE a.user_id=u.id AND u.template_id=$1 AND a.kind='lpa' AND a.status='pending' AND a.started_at IS NULL AND a.date >= $2`, [plt.id, mxToday]);
    console.log(`[setup] Paint Line Layer 1 Audit asignada a ${up.rowCount} usuario(s) (Cell Leader – Paint)`);
  }

  // Nombre correcto de la línea: "Línea de ensamble - 920B Instrument Panel" (había quedado "Linea de ensamble - 920B Instrument Pane")
  const flagMn = await pool.query(`INSERT INTO settings(key,value) VALUES('machine_rename_920b','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flagMn.rowCount) {
    const NEW = 'Línea de ensamble - 920B Instrument Panel';
    const r = await pool.query(
      `UPDATE audits SET machine=$1, area=REPLACE(area, machine, $1) WHERE machine ~* '^l[ií]nea de ensamble\\s*[-–]\\s*920b instrument pane?l?$' AND machine <> $1`, [NEW]);
    console.log(`[setup] máquina 920B renombrada en ${r.rowCount} auditoría(s)`);
  }

  await pool.query(`UPDATE templates SET name='Customer Service Layer 1 Audit' WHERE name='Shipping Layer 1 Audit (Customer Service)'`);
  await pool.query(`UPDATE users SET template_id=template_id WHERE FALSE`);
  await pool.query(`CREATE TABLE IF NOT EXISTS signoffs (
    template_id INT NOT NULL REFERENCES templates(id) ON DELETE CASCADE, period DATE NOT NULL,
    user_id INT REFERENCES users(id) ON DELETE SET NULL, user_name TEXT NOT NULL, signed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (template_id, period))`);
  // Las notas fijas van en el formato impreso, no como parte de la pregunta
  await pool.query(`UPDATE questions SET text=REPLACE(REPLACE(text, ' Notificar inmediatamente si no fue realizada por correo al Supervisor e Ingeniero de calidad.', ''), ' Notify the Supervisor and Quality Engineer by email immediately if it was not done.', '') WHERE item_no=2106 AND text LIKE '%Notificar inmediatamente%'`);
  // Formatos corporativos (MGMT-015-C): plantillas con preguntas fijas y asignación por nombre
  const corp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'corp-forms.json'), 'utf8'));
  const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  for (const f of corp) {
    let { rows: [ct] } = await pool.query('SELECT id FROM templates WHERE name=$1', [f.name]);
    if (!ct) {
      ({ rows: [ct] } = await pool.query('INSERT INTO templates(name,zone,per_audit) VALUES($1,$2,$3) RETURNING id', [f.name, f.zone, f.questions.length]));
      for (let i = 0; i < f.questions.length; i++) {
        const [item, es, en] = f.questions[i];
        await pool.query('INSERT INTO questions(template_id,text,category,sort_order,item_no,required) VALUES($1,$2,$3,$4,$5,TRUE)', [ct.id, `${es}\n${en}`, f.zone, i, item]);
      }
      console.log(`[setup] plantilla ${f.name} cargada (${f.questions.length})`);
    }
    if (!f.users.length) continue;
    const key = `corp_assign_${f.name}`;
    const first = await pool.query(`INSERT INTO settings(key,value) VALUES($1,'1') ON CONFLICT DO NOTHING RETURNING key`, [key]);
    if (!first.rowCount) continue;
    const { rows: us } = await pool.query(`SELECT id,name FROM users WHERE active AND access NOT IN ('admin','master')`);
    const ids = us.filter((u) => f.users.some((n) => norm(u.name) === norm(n))).map((u) => u.id);
    if (ids.length) {
      await pool.query('UPDATE users SET template_id=$1 WHERE id = ANY($2::int[])', [ct.id, ids]);
      await pool.query(
        `UPDATE audits a SET template_id=$1, question_ids=(SELECT array_agg(x.id ORDER BY x.sort_order,x.id) FROM questions x WHERE x.template_id=$1 AND x.active)
          WHERE a.user_id = ANY($2::int[]) AND a.kind='lpa' AND a.status='pending' AND a.started_at IS NULL AND a.date >= $3`, [ct.id, ids, mxToday]);
    }
    console.log(`[setup] ${f.name} asignada a ${ids.length} de ${f.users.length} usuario(s)`);
  }

  // Días fijos y áreas por persona según el cartel "Programa Auditoría LPA" (semana 2-nov-2026); se corrige luego en Admin → Usuarios
  const flagDays = await pool.query(`INSERT INTO settings(key,value) VALUES('program_days_nov26','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flagDays.rowCount) {
    const P = [
      ['Celina Zamora José', [3, 5], ['B2-2', '780B Armrest']], ['Ma. Engracia Hernández', [2, 4], ['B2-3', '780B Cluster']], ['Carmen Hernández', [2, 4], ['B2-5', 'DJ MCA, TFP']],
      ['José Cruz Elias', [3, 5], ['B1-15', 'B2-7']], ['Oscar Álvaro Pérez', [2, 4], ['B1-14', 'B1-16']], ['Jesus Sánchez', [3, 5], ['B1-6', 'B1-5']], ['Saúl Granados', [2, 4], ['B1-7', 'B1-8']], ['Eder Hernández', [3, 5], ['B1-9', 'B1-10']],
      ['Pablo García', [2, 4], ['PL', 'Mix Room']], ['Vania Rosas', [3, 5], ['PL', 'Mix Room']], ['Luis Hernández', [3, 5], ['Mix Room', 'PL']],
      ['Fernanda Gutierrez', [3, 5], ['Shipping']], ['Marco Polo López M', [5], ['Shipping + Docks']], ['Andres Cerecedo', [2], ['Shipping + Docks']], ['Edgar Galván', [3], ['Shipping + Docks']], ['Francisco Javier Padilla', [4], ['Shipping + Docks']],
      ['Dulce Sánchez', [2, 3], ['PL3', 'Racks']], ['Arturo González', [2, 3], ['Racks', 'PL1']], ['Dulce Nieves', [3, 4], ['Racks', 'PL3']], ['Patricia Carrillo', [4, 5], ['Racks', 'PL4']]];
    const nrm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const { rows: us } = await pool.query(`SELECT id,name FROM users WHERE active AND layer=1 AND access NOT IN ('admin','master')`);
    let n = 0; const ids = [];
    for (const [nm, days, areas] of P) {
      const u = us.find((x) => nrm(x.name) === nrm(nm) || nrm(x.name) === nrm(nm.replace(/ M$/, '')));
      if (!u) { console.log(`[setup] programa: no encontré a ${nm}`); continue; }
      await pool.query('UPDATE users SET days=$2, pool=$3, start_idx=0, rotate_daily=$4 WHERE id=$1', [u.id, days, areas, areas.length > 1]);
      ids.push(u.id); n++;
    }
    if (ids.length) await pool.query(`DELETE FROM audits WHERE user_id = ANY($1::int[]) AND kind='lpa' AND status='pending' AND started_at IS NULL AND date >= $2`, [ids, mxToday]);
    console.log(`[setup] días fijos del programa aplicados a ${n} de ${P.length} personas`);
  }

  // Supervisores que no auditan: ven a su gente (auditorías, open issues, avisos) y firman sus sign-offs. Andrés Cerecedo reporta a Fabiola Marina y ya no hace LPA
  {
    const nrm3 = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const { rows: all } = await pool.query(`SELECT id,name,username FROM users`);
    for (const [nm, un0] of [['Ana Serrat', 'ana.serrat'], ['Carlos Robles', 'carlos.robles'], ['Rogelio Sánchez', 'rogelio.sanchez']]) {
      if (all.some((x) => nrm3(x.name) === nrm3(nm))) continue;
      let un = un0, n = 2;
      while ((await pool.query('SELECT 1 FROM users WHERE username=$1', [un])).rowCount) un = un0 + n++;
      const hash = await bcrypt.hash(process.env.SEED_PASSWORD || require('crypto').randomBytes(24).toString('hex'), 10);
      await pool.query(`INSERT INTO users(name,username,pin_hash,dept,layer,access,days,pool,lpa_override,site_id) VALUES($1,$2,$3,'supervision',2,'lead','{}','{}',FALSE,(SELECT id FROM sites WHERE code='MPQ'))`, [nm, un, hash]);
      console.log(`[setup] supervisor ${nm} creado (${un}); asigna su contraseña en Admin → Usuarios`);
    }
    const fAnd = await pool.query(`INSERT INTO settings(key,value) VALUES('andres_supervisor_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
    if (fAnd.rowCount) {
      const { rows: [an] } = await pool.query(`SELECT id FROM users WHERE translate(lower(name),'áéíóú','aeiou') LIKE 'andres cerecedo%' LIMIT 1`);
      if (an) {
        await pool.query(`UPDATE users SET dept='supervision', layer=2, access='lead', days='{}', lpa_override=FALSE, manager_id=(SELECT id FROM users WHERE translate(lower(name),'áéíóú','aeiou') LIKE 'fabiola marina%' LIMIT 1) WHERE id=$1`, [an.id]);
        await pool.query(`DELETE FROM audits WHERE user_id=$1 AND kind='lpa' AND status='pending' AND started_at IS NULL AND date >= $2`, [an.id, mxToday]);
        console.log('[setup] Andrés Cerecedo: supervisor de shippers, reporta a Fabiola, sin LPA');
      }
    }
  }

  // Quién firma a OJT y a los shippers (no reportan a un Layer 2)
  {
    const nrm2 = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const { rows: us } = await pool.query(`SELECT id,name FROM users WHERE active AND access NOT IN ('admin','master')`);
    const find = (n) => us.find((x) => nrm2(x.name) === nrm2(n));
    for (const [boss, team] of [['Ana Serrat', ['Celina Zamora José', 'Ma. Engracia Hernández', 'Carmen Hernández']], ['Andres Cerecedo', ['Marco Polo López M', 'Marco Polo López', 'Edgar Galván', 'Francisco Javier Padilla']],
      ['Hugo Arriaga', ['Julia Olguin', 'Hugo Martinez', 'Ricardo Suarez', 'Conrado Garcia', 'Perla González']],
      ['Mario Cupich', ['Martin Sanchez', 'Luis Medina Lopez', 'Carlos Puga']],
      ['Emmanuel Delgado', ['Sonia Romero', 'Adolfo Francisco', 'Roberto Rodriguez']],
      ['Carlos Robles', ['Jesus Sánchez', 'Eder Hernández']],
      ['Rogelio Sánchez', ['Oscar Álvaro Pérez', 'Saúl Granados', 'José Cruz Elias']]]) {
      const b = find(boss);
      if (!b) { console.log(`[setup] gerente ${boss} no existe en Usuarios: créalo y asígnalo en Admin → Usuarios (Reporta a)`); continue; }
      const ids = team.map(find).filter(Boolean).map((x) => x.id);
      const r = ids.length ? await pool.query('UPDATE users SET manager_id=$1 WHERE manager_id IS NULL AND id = ANY($2::int[])', [b.id, ids]) : null;
      if (r) console.log(`[setup] ${boss} firma a ${r.rowCount} persona(s)`);
    }
  }

  // Asignación aleatoria de áreas: las auditorías Layer 1 futuras sin empezar se regeneran con el sorteo; María Olguín alterna QIA y Proveedores
  const fRnd = await pool.query(`INSERT INTO settings(key,value) VALUES('areas_random_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (fRnd.rowCount) {
    await pool.query(`UPDATE users SET pool='{"QIA","Proveedores"}', start_idx=0, rotate_daily=FALSE WHERE translate(lower(name),'áéíóú','aeiou') LIKE 'maria%olguin%' AND layer=1 AND (pool IS NULL OR cardinality(pool)=0)`);
    const r = await pool.query(`DELETE FROM audits a USING users u WHERE a.user_id=u.id AND u.layer=1 AND a.kind='lpa' AND a.status='pending' AND a.started_at IS NULL AND a.date > $1`, [mxToday]);
    console.log(`[setup] áreas aleatorias: ${r.rowCount} auditoría(s) futuras se regeneran`);
  }

  // Supervisores de Producción: solo las zonas de su Layer 2 (A y B / C / D y E)
  const fZ = await pool.query(`INSERT INTO settings(key,value) VALUES('prod_zones_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (fZ.rowCount) {
    const nz = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const Z = [[['ZONA A', 'ZONA B'], ['Julia Olguin', 'Hugo Martinez', 'Ricardo Suarez', 'Conrado Garcia', 'Perla González']], [['ZONA C'], ['Martin Sanchez', 'Luis Medina Lopez', 'Carlos Puga']], [['ZONA D-E'], ['Sonia Romero', 'Adolfo Francisco', 'Roberto Rodriguez']]];
    const { rows: us } = await pool.query(`SELECT id,name FROM users WHERE active AND layer=1 AND dept='production'`);
    const ids = [];
    for (const [zs, names] of Z) for (const n of names) {
      const u = us.find((x) => nz(x.name).startsWith(nz(n)));
      if (!u) { console.log(`[setup] zonas: no encontré a ${n}`); continue; }
      await pool.query(`UPDATE users SET pool=$2, start_idx=0, rotate_daily=FALSE WHERE id=$1`, [u.id, zs]); ids.push(u.id);
    }
    if (ids.length) await pool.query(`DELETE FROM audits WHERE user_id = ANY($1::int[]) AND kind='lpa' AND status='pending' AND started_at IS NULL AND date > $2`, [ids, mxToday]);
    console.log(`[setup] zonas de supervisores de Producción asignadas a ${ids.length}`);
  }

  // Layer 4: una auditoría cada 4 meses; las semanales pendientes que había se regeneran con la nueva frecuencia
  const fL4 = await pool.query(`INSERT INTO settings(key,value) VALUES('layer4_4months_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (fL4.rowCount) {
    const r = await pool.query(`DELETE FROM audits a USING users u WHERE a.user_id=u.id AND u.layer=4 AND a.kind='lpa' AND a.status='pending' AND a.started_at IS NULL AND a.date > $1`, [mxToday]);
    console.log(`[setup] Layer 4 cada 4 meses: ${r.rowCount} auditoría(s) pendientes regeneradas`);
  }

  // La zona E1 pasa a llamarse E3
  const fE3 = await pool.query(`INSERT INTO settings(key,value) VALUES('zone_e1_to_e3','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (fE3.rowCount) {
    const r = await pool.query(`UPDATE audits SET zone='E3', area=REGEXP_REPLACE(area,'^E1','E3') WHERE zone='E1' OR area ~ '^E1( |$)'`);
    await pool.query(`UPDATE users SET pool=array_replace(pool,'E1','E3')`);
    console.log(`[setup] zona E1 → E3 en ${r.rowCount} auditoría(s)`);
  }

  // Roberto Rodriguez audita zona D-E fija
  const fRz = await pool.query(`INSERT INTO settings(key,value) VALUES('roberto_zona_de','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (fRz.rowCount) {
    const r = await pool.query(`UPDATE users SET pool='{"ZONA D-E"}', start_idx=0, rotate_daily=FALSE WHERE translate(lower(name),'áéíóú','aeiou') LIKE 'roberto rodriguez%' AND layer=1 RETURNING id`);
    if (r.rowCount) await pool.query(`DELETE FROM audits WHERE user_id = ANY($1::int[]) AND kind='lpa' AND status='pending' AND started_at IS NULL AND date >= $2`, [r.rows.map((x) => x.id), mxToday]);
    console.log(`[setup] Roberto Rodriguez → ZONA D-E (${r.rowCount})`);
  }
  // Corrección: Roberto Rodriguez es de D-E (Emmanuel Delgado)
  const fRob = await pool.query(`INSERT INTO settings(key,value) VALUES('mgr_roberto_de','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (fRob.rowCount) await pool.query(`UPDATE users SET manager_id=(SELECT id FROM users WHERE translate(lower(name),'áéíóú','aeiou') LIKE 'emmanuel delgado%' AND active LIMIT 1) WHERE translate(lower(name),'áéíóú','aeiou') LIKE 'roberto rodriguez%' AND layer=1`);

  // QEs: sus LPA pendientes (sin empezar) pasan a llevar las preguntas activas de la auditoría de proceso + sus temas fijos
  const flagQe = await pool.query(`INSERT INTO settings(key,value) VALUES('qe_lpa_uses_process_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flagQe.rowCount) {
    const r = await pool.query(
      `UPDATE audits a SET question_ids = (
          SELECT array_agg(x.id ORDER BY x.sort_order,x.id) FROM questions x
           WHERE x.active AND (x.template_id=(SELECT id FROM templates WHERE name='QE Process Audit') OR (x.template_id=a.template_id AND x.required)))
        FROM users u, templates t
        WHERE a.user_id=u.id AND t.id=a.template_id AND t.name='Quality Engineer' AND u.dept='quality' AND u.layer=1
          AND a.kind='lpa' AND a.status='pending' AND a.started_at IS NULL AND a.date >= $1`, [mxToday]);
    console.log(`[setup] LPA de QEs con las preguntas de la auditoría de proceso: ${r.rowCount}`);
  }

  // Temas específicos de la LPA de los QEs: se agregan a la plantilla "Quality Engineer" y van en cada auditoría
  const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'qe-specific.json'), 'utf8'));
  const flagSpec = await pool.query(`INSERT INTO settings(key,value) VALUES('qe_specific_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flagSpec.rowCount) {
    const { rows: [st] } = await pool.query('SELECT id FROM templates WHERE name=$1', [spec.template]);
    if (st) {
      let order = Number((await pool.query('SELECT COALESCE(MAX(sort_order),0) m FROM questions WHERE template_id=$1', [st.id])).rows[0].m);
      for (const g of spec.groups) for (const x of g.questions) {
        await pool.query('INSERT INTO questions(template_id,text,category,sort_order,item_no,required) VALUES($1,$2,$3,$4,-1,TRUE)',
          [st.id, `${x.es}\n${x.en}`, g.category, ++order]);
      }
      await pool.query(`DELETE FROM audits a USING users u WHERE a.user_id=u.id AND a.kind='lpa' AND a.status='pending' AND a.date >= $1 AND u.dept='quality' AND u.layer=1`, [mxToday]);
      console.log('[setup] QE LPA: temas específicos (Dock Audit y auditoría gerencial) agregados');
    }
  }

  // Ajuste único: por ahora los QEs solo hacen auditorías de proceso (se quitan sus LPA pendientes)
  const flag2 = await pool.query(`INSERT INTO settings(key,value) VALUES('qe_lpa_off_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flag2.rowCount) {
    await pool.query(`INSERT INTO settings(key,value) VALUES('qe_lpa_on','0') ON CONFLICT DO NOTHING`);
    await pool.query(`DELETE FROM audits a USING users u WHERE a.user_id=u.id AND a.kind='lpa' AND a.status='pending' AND u.dept='quality' AND u.layer=1`);
    console.log('[setup] QEs: solo auditorías de proceso (LPA apagada)');
  }

  // Programa piloto: arranca el 14-Oct-2026. Los días anteriores no cuentan para nadie (sin rojos ni "no realizadas")
  const flag3 = await pool.query(`INSERT INTO settings(key,value) VALUES('pilot_start_v1','1') ON CONFLICT DO NOTHING RETURNING key`);
  if (flag3.rowCount) {
    const PILOT = '2026-10-14';
    await pool.query(`INSERT INTO settings(key,value) VALUES('go_live',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [PILOT]);
    await pool.query(`UPDATE sites SET go_live=$1 WHERE active`, [PILOT]);
    const r = await pool.query(`DELETE FROM audits WHERE status='pending' AND date < $1`, [PILOT]);
    console.log(`[setup] Piloto desde ${PILOT}: ${r.rowCount} auditorías pendientes anteriores quitadas`);
  }

  // Preguntas existentes de una versión anterior (un solo idioma) -> bilingües. Idempotente: solo toca las que aún son el texto original.
  let bi = 0;
  for (const [orig] of Object.entries(i18n)) {
    const nt = biText(orig);
    if (nt === orig) continue;
    const r = await pool.query('UPDATE questions SET text=$1 WHERE text=$2', [nt, orig]);
    bi += r.rowCount;
  }
  if (bi) console.log(`[setup] ${bi} preguntas actualizadas a español + inglés`);

  // Usuarios
  const { rows: u } = await pool.query('SELECT COUNT(*)::int n FROM users');
  if (u[0].n === 0) {
    // Si no hay SEED_PASSWORD, cada usuario nace con una contraseña aleatoria desconocida:
    // el admin asigna la de cada quien en Admin → Usuarios.
    const seedPw = process.env.SEED_PASSWORD || '';
    const sharedHash = seedPw ? await bcrypt.hash(seedPw, 10) : null;
    const { rows: tpls } = await pool.query('SELECT id,name FROM templates');
    const tid = Object.fromEntries(tpls.map(r => [r.name, r.id]));
    const used = new Set();
    for (const [name, dept, layer, tpl, days, pool_, start, rotateDaily, access] of ROSTER) {
      let un = usernameFor(name), n = 2;
      while (used.has(un)) un = usernameFor(name) + n++;
      used.add(un);
      const hash = sharedHash || (await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 10));
      if (!tid[tpl]) throw new Error('Plantilla inexistente: ' + tpl);
      await pool.query(
        `INSERT INTO users(name,username,pin_hash,dept,layer,access,template_id,days,pool,start_idx,rotate_daily,site_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,(SELECT id FROM sites WHERE code='MPQ'))`,
        [name, un, hash, dept, layer, access, tid[tpl], days, pool_, start, rotateDaily]
      );
    }
    console.log(`[setup] ${ROSTER.length} usuarios sembrados (contraseña inicial = SEED_PASSWORD, o aleatoria si no se define)`);
  }

  // Usuario admin: se crea si ADMIN_PIN está definido y aún no existe
  const adminPin = process.env.ADMIN_PASSWORD || '';
  const { rows: a } = await pool.query(`SELECT 1 FROM users WHERE username='admin'`);
  if (adminPin && !a.length) {
    await pool.query(
      `INSERT INTO users(name,username,pin_hash,must_change,dept,layer,access,days,pool)
       VALUES('Máster','admin',$1,FALSE,'quality',2,'master','{}','{}')`,
      [await bcrypt.hash(adminPin, 10)]
    );
    console.log('[setup] usuario admin creado');
  } else if (!adminPin && !a.length) {
    console.warn('[setup] ADMIN_PASSWORD no definido: no hay usuario admin.');
  }
}

main().then(() => pool.end()).catch(e => { console.error(e); process.exit(1); });
