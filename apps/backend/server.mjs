import express from 'express';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createGatewayApp } from '../gateway/server.mjs';
import { createUsersApp } from '../../services/user-service/server.mjs';
import { createLoansApp } from '../../services/loan-service/server.mjs';
import { createPortfolioApp } from '../../services/portfolio-service/server.mjs';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');

const userUrl = process.env.USER_DATABASE_URL?.trim() || '';
const loanUrl = process.env.LOAN_DATABASE_URL?.trim() || '';
if (Boolean(userUrl) !== Boolean(loanUrl) || (process.env.DATABASE_URL && !userUrl)) {
  throw new Error('Set both USER_DATABASE_URL and LOAN_DATABASE_URL for PostgreSQL, or leave both unset for SQLite.');
}

const resources = [];
async function listen(app, port, host) {
  const server = app.listen(port, host);
  resources.push(() => new Promise((resolve, reject) => {
    server.close(error => {
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
      else resolve();
    });
  }));
  await once(server, 'listening');
  return server;
}

async function stop() {
  for (const close of resources.reverse()) {
    try { await close(); }
    catch (error) { console.error('[Portal API] Shutdown error:', error.code || error.name); }
  }
}

try {
  // Users must initialize first: PostgreSQL demo loans reference their investor profiles.
  const users = await createUsersApp({ url: userUrl, file: process.env.USER_DB_PATH || '' });
  resources.push(users.close);
  const loans = await createLoansApp({ url: loanUrl, file: process.env.LOAN_DB_PATH || '' });
  resources.push(loans.close);

  // Keep the existing internal HTTP contracts without opening their routes on the public port.
  const internalKey = randomBytes(32).toString('base64url');
  const internalHeaders = { 'x-portal-internal': internalKey };
  const internal = express();
  internal.use((req, res, next) => {
    if (req.headers['x-portal-internal'] !== internalKey) return res.status(404).json({ error: 'Not found.' });
    next();
  });
  internal.use('/users', users.app);
  internal.use('/loans', loans.app);
  const listener = await listen(internal, 0, '127.0.0.1');
  const base = 'http://127.0.0.1:' + listener.address().port;
  const services = { users: base + '/users', loans: base + '/loans', portfolio: base + '/portfolio' };
  internal.use('/portfolio', createPortfolioApp({ services, internalHeaders }));

  await listen(createGatewayApp({ services, internalHeaders }), port, host);
  console.log('[Portal API] Listening on http://' + host + ':' + port);
} catch (error) {
  await stop();
  throw error;
}

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 20000);
  deadline.unref();
  await stop();
  clearTimeout(deadline);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
