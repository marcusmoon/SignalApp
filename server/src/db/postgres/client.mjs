import pg from 'pg';
import { config } from '../../config.mjs';

let pool = null;

function requireDatabaseUrl() {
  if (!config.databaseUrl) {
    throw new Error('POSTGRES_DATABASE_URL_REQUIRED');
  }
  return config.databaseUrl;
}

export function postgresConfigured() {
  return Boolean(config.databaseUrl);
}

export function getPostgresPool() {
  if (pool) return pool;
  const connectionString = requireDatabaseUrl();
  pool = new pg.Pool({
    connectionString,
    max: Number(process.env.SIGNAL_POSTGRES_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.SIGNAL_POSTGRES_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.SIGNAL_POSTGRES_CONNECT_TIMEOUT_MS || 5000),
  });
  pool.on('error', (error) => {
    console.warn('[postgres] idle client error:', error?.message || error);
  });
  return pool;
}

export async function queryPostgres(text, params = []) {
  return getPostgresPool().query(text, params);
}

export async function withPostgresClient(fn) {
  const client = await getPostgresPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function checkPostgresConnectivity() {
  if (!postgresConfigured()) {
    return { configured: false, ok: false };
  }
  const startedAt = Date.now();
  try {
    const result = await queryPostgres('SELECT current_database() AS database, current_schema() AS schema');
    const row = result.rows[0] || {};
    return {
      configured: true,
      ok: true,
      database: row.database || null,
      schema: row.schema || null,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      error: error?.message || String(error),
      elapsedMs: Date.now() - startedAt,
    };
  }
}

export async function closePostgresPool() {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}
