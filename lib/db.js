import pg from 'pg';

const url = process.env.DATABASE_URL || '';
const local = /localhost|127\.0\.0\.1/.test(url);

export const pool =
  globalThis.__lpaPool ||
  (globalThis.__lpaPool = new pg.Pool({
    connectionString: url,
    ssl: local || !url ? undefined : { rejectUnauthorized: false },
    max: 10,
  }));

// DATE → 'YYYY-MM-DD' (sin corrimiento de zona horaria)
pg.types.setTypeParser(1082, (v) => v);

export const q = (text, params) => pool.query(text, params);
