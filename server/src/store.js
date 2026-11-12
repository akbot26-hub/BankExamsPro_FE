import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR override lets serverless hosts point writes at their writable dir
// (e.g. /tmp on Cloud Functions). Default: server/data next to the source.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');

const EMPTY = {
  users: [],
  exams: [],
  mockTests: [],
  questions: [],
  stimuli: [],
  attempts: [],
};

let cache = null;
let writeTimer = null;

function ensureDir() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

export function db() {
  if (cache) return cache;
  ensureDir();
  if (fs.existsSync(DB_PATH)) {
    cache = { ...EMPTY, ...JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) };
  } else {
    cache = structuredClone(EMPTY);
    fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
  }
  return cache;
}

/** Debounced write — the exam engine autosaves every few seconds. */
export function persist() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    ensureDir();
    fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
  }, 120);
}

export function persistNow() {
  clearTimeout(writeTimer);
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
}

export function reset(data) {
  cache = { ...structuredClone(EMPTY), ...data };
  persistNow();
  return cache;
}

export const id = (prefix) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}
