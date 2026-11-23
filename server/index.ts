import { loadConfig } from './config.ts';
import { createDb } from './db.ts';
import { createApp } from './app.ts';
import { createMailer } from './mail.ts';
import { seedDemo } from './seed.ts';

const cfg = loadConfig();
const db = await createDb(cfg);
if (cfg.seed && (await seedDemo(db, cfg.now()))) {
  console.log('Seeded demo data (set SEED_DEMO=0 to disable)');
}
const count = async (table: string) =>
  (await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n;
const [users, students] = [await count('app_user'), await count('student')];
console.log(`Database: ${users} users, ${students} students`);
if (users === 0) {
  console.warn(
    'WARNING: the database is empty, so nobody can sign in. Load the demo data with SEED_DEMO=1 (or `npm run seed`), or add real users.',
  );
}
if (cfg.production && !cfg.smtp) {
  console.warn(
    'WARNING: no SMTP settings, so sign-in codes cannot be delivered. Set SMTP_HOST / SMTP_USER / SMTP_PASS.',
  );
}
const app = createApp(cfg, db, createMailer(cfg));
app.listen(cfg.port, () => {
  console.log(
    `VanDesk on http://localhost:${cfg.port}  (${cfg.databaseUrl ? 'PostgreSQL' : 'PGlite ' + cfg.dataDir}, static: ${cfg.staticDir})`,
  );
});
