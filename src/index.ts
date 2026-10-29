import fs from 'fs';
import { config } from './config';
import { createApp } from './app';
import { pool, runMigrations, waitForDb } from './db';
import { seed } from './db/seed';

async function main() {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  await waitForDb();
  await runMigrations();
  await seed();
  const server = createApp().listen(config.port, () => {
    console.log(`Novix Science Academy API running on http://localhost:${config.port}`);
  });
  const shutdown = () => { server.close(() => pool.end().then(() => process.exit(0))); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => { console.error('Failed to start:', e); process.exit(1); });
