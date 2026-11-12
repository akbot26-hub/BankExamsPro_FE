/**
 * Copies the server source and the seeded database into the functions folder,
 * because Firebase deploys only this directory. Runs automatically before
 * every deploy (see firebase.json predeploy), or by hand: npm run sync
 */
import fs from 'fs';
import path from 'path';

const here = path.dirname(new URL(import.meta.url).pathname);
const serverSrc = path.join(here, '..', 'server', 'src');
const seedDb = path.join(here, '..', 'server', 'data', 'db.json');

fs.rmSync(path.join(here, 'src'), { recursive: true, force: true });
fs.cpSync(serverSrc, path.join(here, 'src'), { recursive: true });

if (!fs.existsSync(seedDb)) {
  console.error('server/data/db.json not found — run `npm run seed` in server/ first.');
  process.exit(1);
}
fs.copyFileSync(seedDb, path.join(here, 'seed-db.json'));
console.log('functions/src and seed-db.json synced from server/');
