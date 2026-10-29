import path from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { config } from '../config';
import * as schema from './schema';

export const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
export const db = drizzle(pool, { schema });
export type DB = typeof db;

export async function runMigrations() {
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
}

export async function waitForDb(retries = 20) {
  for (let i = 1; i <= retries; i++) {
    try { await pool.query('select 1'); return; } catch (e) {
      if (i === retries) throw e;
      console.log(`Waiting for database (${i}/${retries})…`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
