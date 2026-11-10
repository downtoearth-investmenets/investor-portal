import crypto from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore, shouldSeed } from '../../packages/database/store.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'LocalDemoOnly2026!';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  // Hash against a throwaway value when there is no stored hash so lookups take similar time.
  const [salt, hash] = (stored || 'x:' + '0'.repeat(64)).split(':');
  const candidate = crypto.scryptSync(String(password), salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return Boolean(stored) && expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'investor')),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('active', 'invited', 'disabled')),
  password_hash TEXT,
  password_changed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS investor_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL DEFAULT '',
  accredited INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('invite', 'reset')),
  expires_at INTEGER NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  delivered_via TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

const SEED_USERS = [
  { id: 'usr_admin_1', email: 'admin.one@portal.example', role: 'admin', fullName: 'Demo Admin One', phone: '', createdAt: '2024-06-01T08:00:00Z' },
  { id: 'usr_admin_2', email: 'admin.two@portal.example', role: 'admin', fullName: 'Demo Admin Two', phone: '', createdAt: '2024-06-01T08:00:00Z' },
  { id: 'usr_inv_1', email: 'investor.one@portal.example', role: 'investor', fullName: 'Demo Investor One', phone: '', createdAt: '2025-01-15T10:00:00Z', profile: { id: 'inv_prof_1', entityName: 'Demo Trust One' } },
  { id: 'usr_inv_2', email: 'investor.two@portal.example', role: 'investor', fullName: 'Demo Investor Two', phone: '', createdAt: '2025-02-10T11:30:00Z', profile: { id: 'inv_prof_2', entityName: 'Demo Trust Two' } },
  { id: 'usr_inv_3', email: 'investor.three@portal.example', role: 'investor', fullName: 'Demo Investor Three', phone: '', createdAt: '2025-03-01T09:15:00Z', profile: { id: 'inv_prof_3', entityName: 'Demo Trust Three' } }
];

async function seed(db) {
  const { count } = await db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) return;

  const passwordHash = hashPassword(DEMO_PASSWORD);
  await db.transaction(async tx => {
    const insertUser = tx.prepare(
      'INSERT INTO users (id, email, role, full_name, phone, status, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertProfile = tx.prepare('INSERT INTO investor_profiles (id, user_id, entity_name, accredited, created_at) VALUES (?, ?, ?, 1, ?)');

    for (const user of SEED_USERS) {
      await insertUser.run(user.id, user.email, user.role, user.fullName, user.phone, 'active', passwordHash, user.createdAt);
      if (user.profile) await insertProfile.run(user.profile.id, user.id, user.profile.entityName, user.createdAt);
    }
  });
  console.log('[User-Service] Seeded demo accounts');
}

export async function openDatabase({ url, file = process.env.DB_PATH } = {}) {
  const db = openStore({ url, file: file || resolve(here, 'data', 'users.db'), sqliteSchema: SCHEMA, postgresSchema: 'portal_users' });
  try {
    await db.prepare('SELECT 1 FROM users LIMIT 1').get();
    if (shouldSeed(db)) await seed(db);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
