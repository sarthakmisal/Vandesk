import { loadConfig } from './config.ts';
import { createDb } from './db.ts';
import { seedDemo } from './seed.ts';

/** `npm run seed`: load the demo people and data into an EMPTY database (local dev database or DATABASE_URL). */
const cfg = loadConfig();
const db = await createDb(cfg);
console.log(
  (await seedDemo(db, cfg.now()))
    ? 'Demo data loaded.'
    : 'The database already has users, nothing changed. (Local dev database: npm run reset:db first.)',
);
await db.close();
