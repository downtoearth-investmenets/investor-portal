import { randomUUID } from 'node:crypto';
import { openStore } from '../packages/database/store.mjs';
import { DEMO_PASSWORD, hashPassword } from '../services/user-service/db.mjs';

const { DATABASE_URL, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_PASSWORD } = process.env;
const email = BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const name = BOOTSTRAP_ADMIN_NAME?.trim();
const password = BOOTSTRAP_ADMIN_PASSWORD || '';

if (!DATABASE_URL || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name ||
    password === DEMO_PASSWORD || password.length < 16 || password.length > 200 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
  console.error('Set DATABASE_URL, a valid BOOTSTRAP_ADMIN_EMAIL and NAME, and a unique BOOTSTRAP_ADMIN_PASSWORD (16–200 characters with a letter and a number).');
  process.exit(1);
}

const db = openStore({ postgresSchema: 'portal_users', url: DATABASE_URL });
try {
  const created = await db.transaction(async tx => {
    await tx.exec('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    if (await tx.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get()) return false;
    await tx.prepare("INSERT INTO users (id, email, role, full_name, status, password_hash, created_at) VALUES (?, ?, 'admin', ?, 'active', ?, ?)")
      .run('usr_admin_' + randomUUID(), email, name, hashPassword(password), new Date().toISOString());
    return true;
  });
  if (created) console.log('First portal administrator created.');
  else console.log('An administrator already exists. No account was created.');
} catch (error) {
  console.error('Administrator provisioning failed:', error.code || error.name);
  process.exitCode = 1;
} finally {
  await db.close();
}
