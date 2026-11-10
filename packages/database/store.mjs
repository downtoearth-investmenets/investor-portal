import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';

// Both services use positional parameters. PostgreSQL uses $1 rather than ?.
function postgresQuery(text) {
  let index = 0;
  return text.replace(/\?/g, () => '$' + ++index);
}

function statements(query, dialect) {
  return {
    dialect,
    exec: sql => query(sql, [], 'exec'),
    prepare: sql => ({
      get: (...args) => query(sql, args, 'get'),
      all: (...args) => query(sql, args, 'all'),
      run: (...args) => query(sql, args, 'run')
    })
  };
}

function sqliteStore(file, schema) {
  mkdirSync(dirname(file), { recursive: true });
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  sqlite.exec(schema);
  const execute = (sql, args, method) =>
    method === 'exec' ? sqlite.exec(sql) : sqlite.prepare(sql)[method](...args);

  // Reserve the single SQLite connection across awaits in a transaction.
  let pending = Promise.resolve();
  const queue = work => {
    const next = pending.then(work);
    pending = next.catch(() => {});
    return next;
  };
  const scoped = statements(execute, 'sqlite');
  return {
    ...statements((...args) => queue(() => execute(...args)), 'sqlite'),
    transaction: work => queue(async () => {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const result = await work(scoped);
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }),
    close: () => queue(() => sqlite.close())
  };
}

function postgresStore(connectionString, schemaName) {
  if (!['portal_users', 'portal_loans'].includes(schemaName)) throw new Error('Invalid portal schema');
  const initialized = new WeakSet();
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    types: {
      getTypeParser(oid, format) {
        if (oid === 1082) return value => value; // PostgreSQL DATE -> calendar date (YYYY-MM-DD)
        if (oid === 20 || oid === 1700) return Number; // bounded bigint/decimal values at the API boundary
        return pg.types.getTypeParser(oid, format);
      }
    }
  });
  pool.on('error', error => console.error('Idle PostgreSQL connection failed:', error.code || 'connection error'));

  async function usingClient(work) {
    const client = await pool.connect();
    try {
      if (!initialized.has(client)) {
        await client.query('SET search_path TO ' + schemaName + '; SET statement_timeout TO 8000');
        initialized.add(client);
      }
      return await work(client);
    } finally {
      client.release();
    }
  }

  async function execute(client, sql, args, method) {
    const result = await client.query(postgresQuery(sql), args);
    if (method === 'get') return result.rows[0];
    if (method === 'all') return result.rows;
    if (method === 'run') return { changes: result.rowCount };
  }

  return {
    ...statements((...args) => usingClient(client => execute(client, ...args)), 'postgres'),
    transaction: work => usingClient(async client => {
      await client.query('BEGIN');
      try {
        const result = await work(statements((...args) => execute(client, ...args), 'postgres'));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
    close: () => pool.end()
  };
}

export function openStore({ file, sqliteSchema, postgresSchema, url = process.env.DATABASE_URL }) {
  return url ? postgresStore(url, postgresSchema) : sqliteStore(file, sqliteSchema);
}

export function shouldSeed(db) {
  return process.env.NODE_ENV !== 'production' &&
    (db.dialect === 'sqlite' || process.env.ENABLE_DEMO_DATA === 'true');
}
