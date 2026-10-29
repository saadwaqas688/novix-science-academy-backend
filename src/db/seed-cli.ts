import { pool, runMigrations, waitForDb } from './index';
import { seed } from './seed';

(async () => {
  await waitForDb();
  await runMigrations();
  await seed();
  await pool.end();
  console.log('Seed complete');
})().catch((e) => { console.error(e); process.exit(1); });
