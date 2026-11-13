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
const app = createApp(cfg, db, createMailer(cfg));
app.listen(cfg.port, () => {
  console.log(
    `VanDesk on http://localhost:${cfg.port}  (${cfg.databaseUrl ? 'PostgreSQL' : 'PGlite ' + cfg.dataDir}, static: ${cfg.staticDir})`,
  );
});
