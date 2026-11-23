// Copies the web build (www/) into the backend's public/ folder so one Node server serves app + API.
// Backend folder: BACK_DIR env var, else ../backend, else ../back.
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const candidates = [process.env.BACK_DIR, '../backend', '../back'].filter(Boolean).map((p) => resolve(p));
const back = candidates.find((p) => existsSync(resolve(p, 'index.js')));
if (!back) {
  console.error(
    'Backend folder not found. Put it next to this project as "backend" or "back", or set BACK_DIR=<path>.',
  );
  process.exit(1);
}
cpSync('www', resolve(back, 'public'), { recursive: true });
console.log(`Copied www -> ${resolve(back, 'public')}`);
