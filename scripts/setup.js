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
ALTER TABLE audits ADD COLUMN IF NOT EXISTS shipper TEXT NOT NULL DEFAULT '';             -- shipper # revisado en el Dock Audit
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
