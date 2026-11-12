/**
 * Cloud Functions wrapper around the BankExamsPro Express app.
 *
 * DEMO-GRADE PERSISTENCE, READ THIS:
 * Cloud Functions has no durable disk. On cold start we copy the bundled
 * seed database into /tmp and write there. Reads work; writes (new accounts,
 * attempts, OTPs) survive only as long as this instance does. When the
 * instance recycles, they are gone. Fine for showing the product around.
 * Not fine for real candidates — migrate the store to Firestore first.
 */
import fs from 'fs';
import path from 'path';
import { onRequest } from 'firebase-functions/v2/https';

const DATA_DIR = '/tmp/bankexamspro';
process.env.DATA_DIR = DATA_DIR;

const here = path.dirname(new URL(import.meta.url).pathname);
const dbPath = path.join(DATA_DIR, 'db.json');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.copyFileSync(path.join(here, 'seed-db.json'), dbPath);
}

// Dynamic import so DATA_DIR is set before the store module computes its path.
const { default: app } = await import('./src/app.js');

export const api = onRequest(
  {
    region: 'asia-south1',        // Mumbai — closest to your candidates
    memory: '512MiB',
    maxInstances: 2,              // keeps the free quota comfortable
    concurrency: 40,
  },
  app
);
