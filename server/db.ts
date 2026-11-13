import { readFileSync } from 'node:fs';

import type { Config } from './config.ts';

export interface Rows<T> {
  rows: T[];
}
export interface Q {
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<Rows<T>>;
}
export interface Db extends Q {
  tx<T>(fn: (q: Q) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

/**
 * DATABASE_URL set  -> real PostgreSQL through `pg` (production).
 * otherwise         -> PGlite (real Postgres compiled to WASM): zero setup for dev and tests, persisted in DATA_DIR.
 */
export async function createDb(cfg: Pick<Config, 'databaseUrl' | 'dataDir' | 'memoryDb'>): Promise<Db> {
  if (cfg.databaseUrl) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: cfg.databaseUrl, max: 10 });
    await pool.query(schema);
    return {
      query: (sql, params) => pool.query(sql, params as unknown[]) as any,
      tx: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query('begin');
          const out = await fn({ query: (sql, params) => c.query(sql, params as unknown[]) as any });
          await c.query('commit');
          return out;
        } catch (e) {
          await c.query('rollback');
          throw e;
        } finally {
          c.release();
        }
      },
      close: () => pool.end(),
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const lite = new PGlite(cfg.memoryDb ? undefined : cfg.dataDir);
  await lite.exec(schema);
  return {
    query: (sql, params) => lite.query(sql, params as unknown[]) as any,
    tx: (fn) => lite.transaction((t) => fn({ query: (sql, params) => t.query(sql, params as unknown[]) as any })),
    close: () => lite.close(),
  };
}
