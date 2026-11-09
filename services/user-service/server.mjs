import crypto from 'node:crypto';
import express from 'express';
import { hashPassword, openDatabase, transaction, verifyPassword } from './db.mjs';
import { createMailer } from './mailer.mjs';

const PORT = process.env.PORT || 4001;
const HOST = process.env.HOST || '127.0.0.1';
const PORTAL_URL = (process.env.PORTAL_URL || 'http://localhost:3000').replace(/\/$/, '');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

const db = openDatabase();
const sendEmail = createMailer(db);
const app = express();
app.use(express.json());

// ---------- helpers ----------

const now = () => new Date().toISOString();
const newToken = () => crypto.randomBytes(32).toString('base64url');
const hashToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');
const isEmail = value => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || '').trim());

function passwordProblem(password) {
  const value = String(password || '');
  if (value.length < 10) return 'Use at least 10 characters.';
  if (value.length > 200) return 'Use 200 characters or fewer.';
  if (!/[a-z]/i.test(value) || !/\d/.test(value)) return 'Include at least one letter and one number.';
  return null;
}

const USER_COLUMNS = `
  u.id, u.email, u.role, u.full_name AS fullName, u.phone, u.status, u.password_hash AS passwordHash,
  u.created_at AS createdAt, p.id AS investorProfileId, p.entity_name AS entityName, p.accredited
`;

const findUserByEmail = db.prepare(`SELECT ${USER_COLUMNS} FROM users u LEFT JOIN investor_profiles p ON p.user_id = u.id WHERE u.email = ?`);
const findUserById = db.prepare(`SELECT ${USER_COLUMNS} FROM users u LEFT JOIN investor_profiles p ON p.user_id = u.id WHERE u.id = ?`);
const findUserByProfile = db.prepare(`SELECT ${USER_COLUMNS} FROM users u JOIN investor_profiles p ON p.user_id = u.id WHERE p.id = ?`);
const listInvestors = db.prepare(`SELECT ${USER_COLUMNS} FROM users u JOIN investor_profiles p ON p.user_id = u.id ORDER BY u.created_at`);

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    fullName: row.fullName,
    phone: row.phone,
    status: row.status,
    investorProfileId: row.investorProfileId ?? undefined,
    createdAt: row.createdAt
  };
}

function profileOf(row) {
  if (!row?.investorProfileId) return null;
  return {
    id: row.investorProfileId,
    userId: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    entityName: row.entityName || '',
    accreditedStatus: Boolean(row.accredited),
    status: row.status,
    inviteAccepted: row.status === 'active',
    createdAt: row.createdAt
  };
}

// ---------- sessions ----------

function createSession(userId) {
  const token = newToken();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    hashToken(token),
    userId,
    now(),
    Date.now() + SESSION_TTL_MS
  );
  return token;
}

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function currentUser(req) {
  const token = bearer(req);
  if (!token) return null;
  const session = db.prepare('SELECT user_id AS userId, expires_at AS expiresAt FROM sessions WHERE token_hash = ?').get(hashToken(token));
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    return null;
  }
  const user = findUserById.get(session.userId);
  return user?.status === 'active' ? user : null;
}

const sessionPayload = (token, user) => ({ token, user: publicUser(user), profile: profileOf(user) });

// ---------- one-time links (invites and password resets) ----------

function issueLink(userId, purpose) {
  const token = newToken();
  const ttl = purpose === 'invite' ? INVITE_TTL_MS : RESET_TTL_MS;
  transaction(db, () => {
    // A new link replaces any earlier unused link of the same kind.
    db.prepare('DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL').run(userId, purpose);
    db.prepare('INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run(
      hashToken(token),
      userId,
      purpose,
      Date.now() + ttl,
      now()
    );
  });
  const path = purpose === 'invite' ? 'onboard' : 'reset-password';
  return `${PORTAL_URL}/${path}/${token}`;
}

function readLink(token, purpose) {
  const row = db
    .prepare('SELECT user_id AS userId, expires_at AS expiresAt, used_at AS usedAt FROM auth_tokens WHERE token_hash = ? AND purpose = ?')
    .get(hashToken(token), purpose);
  if (!row || row.usedAt || row.expiresAt < Date.now()) return null;
  return findUserById.get(row.userId) ?? null;
}

const LINK_EXPIRED = {
  invite: 'This invite link has expired or was already used. Ask Down to Earth for a new one.',
  reset: 'This reset link has expired or was already used. Request a new one.'
};

async function sendInvite(user) {
  const link = issueLink(user.id, 'invite');
  const { delivered } = await sendEmail({
    to: user.email,
    subject: 'Your Down to Earth investor account',
    text: `Hi ${user.fullName},\n\nAdam and Alicia have set up your investor account. Choose a password to see your notes and payments:\n\n${link}\n\nThis link works for 7 days.\n\nDown to Earth Investments`
  });
  return { inviteLink: link, emailSent: delivered };
}

// ---------- routes ----------

app.get('/health', (req, res) => {
  res.json({ service: 'user-service', status: 'healthy', timestamp: now() });
});

app.post('/login', (req, res) => {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });

  const user = findUserByEmail.get(email);
  if (!verifyPassword(password, user?.passwordHash) || user.status !== 'active') {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  res.json(sessionPayload(createSession(user.id), user));
});

app.get('/session', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
  res.json({ user: publicUser(user), profile: profileOf(user) });
});

app.post('/logout', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(bearer(req)));
  res.status(204).end();
});

app.post('/password/change', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Your session has ended. Please sign in again.' });

  const { currentPassword, newPassword } = req.body || {};
  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(400).json({ error: 'Your current password is incorrect.', field: 'currentPassword' });
  }
  const problem = passwordProblem(newPassword);
  if (problem) return res.status(400).json({ error: problem, field: 'newPassword' });

  transaction(db, () => {
    db.prepare('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?').run(hashPassword(newPassword), now(), user.id);
    // Sign out every other device.
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(user.id, hashToken(bearer(req)));
  });
  res.json({ ok: true });
});

app.post('/password/forgot', async (req, res) => {
  const email = String(req.body?.email || '').trim();
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

  const reply = { message: 'If that email has an account, we sent a link to reset the password.' };
  const user = findUserByEmail.get(email);
  if (user?.status === 'active') {
    const link = issueLink(user.id, 'reset');
    const { delivered } = await sendEmail({
      to: user.email,
      subject: 'Reset your Down to Earth password',
      text: `Hi ${user.fullName},\n\nUse this link to choose a new password. It works for 1 hour:\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`
    });
    // Without a mail provider there is no other way to reach the link while developing.
    if (!delivered && !IS_PRODUCTION) reply.previewLink = link;
  }
  res.json(reply);
});

app.get('/links/:purpose/:token', (req, res) => {
  const { purpose, token } = req.params;
  if (!['invite', 'reset'].includes(purpose)) return res.status(404).json({ error: 'Not found.' });
  const user = readLink(token, purpose);
  if (!user) return res.status(410).json({ error: LINK_EXPIRED[purpose] });
  res.json({ email: user.email, fullName: user.fullName, entityName: user.entityName || '' });
});

function completeLink(purpose) {
  return (req, res) => {
    const user = readLink(req.params.token, purpose);
    if (!user) return res.status(410).json({ error: LINK_EXPIRED[purpose] });

    const problem = passwordProblem(req.body?.password);
    if (problem) return res.status(400).json({ error: problem, field: 'password' });

    transaction(db, () => {
      db.prepare("UPDATE users SET password_hash = ?, password_changed_at = ?, status = 'active' WHERE id = ?").run(
        hashPassword(req.body.password),
        now(),
        user.id
      );
      db.prepare('UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?').run(now(), hashToken(req.params.token));
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    });

    const fresh = findUserById.get(user.id);
    res.json(sessionPayload(createSession(fresh.id), fresh));
  };
}

app.post('/links/invite/:token', completeLink('invite'));
app.post('/links/reset/:token', completeLink('reset'));

// ---------- investors (the gateway only lets admins reach these) ----------

app.get('/investors', (req, res) => {
  res.json(listInvestors.all().map(profileOf));
});

app.get('/investors/:id', (req, res) => {
  const user = findUserByProfile.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Investor not found.' });
  res.json(profileOf(user));
});

app.post('/investors', async (req, res) => {
  const fullName = String(req.body?.fullName || '').trim();
  const email = String(req.body?.email || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const entityName = String(req.body?.entityName || '').trim();

  if (!fullName) return res.status(400).json({ error: 'Enter the investor name.', field: 'fullName' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.', field: 'email' });
  if (findUserByEmail.get(email)) {
    return res.status(409).json({ error: 'An account with this email already exists.', field: 'email' });
  }

  const stamp = `${Date.now()}${crypto.randomBytes(3).toString('hex')}`;
  const userId = `usr_inv_${stamp}`;
  transaction(db, () => {
    db.prepare("INSERT INTO users (id, email, role, full_name, phone, status, created_at) VALUES (?, ?, 'investor', ?, ?, 'invited', ?)").run(
      userId,
      email,
      fullName,
      phone,
      now()
    );
    db.prepare('INSERT INTO investor_profiles (id, user_id, entity_name, accredited, created_at) VALUES (?, ?, ?, ?, ?)').run(
      `inv_prof_${stamp}`,
      userId,
      entityName,
      req.body?.accreditedStatus ? 1 : 0,
      now()
    );
  });

  const user = findUserById.get(userId);
  res.status(201).json({ profile: profileOf(user), ...(await sendInvite(user)) });
});

app.post('/investors/:id/invite', async (req, res) => {
  const user = findUserByProfile.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Investor not found.' });
  if (user.status !== 'invited') return res.status(409).json({ error: 'This investor has already set up their account.' });
  res.json({ profile: profileOf(user), ...(await sendInvite(user)) });
});

app.post('/investors/:id/notify', async (req, res) => {
  const user = findUserByProfile.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Investor not found.' });
  const subject = String(req.body?.subject || '').trim();
  const text = String(req.body?.text || '').trim();
  if (!subject || !text) return res.status(400).json({ error: 'A subject and message are required.' });
  const { delivered } = await sendEmail({ to: user.email, subject, text: `Hi ${user.fullName},\n\n${text}\n\nDown to Earth Investments` });
  res.json({ emailSent: delivered });
});

app.listen(PORT, HOST, () => {
  console.log(`[User-Service] Running on http://${HOST}:${PORT}`);
});

