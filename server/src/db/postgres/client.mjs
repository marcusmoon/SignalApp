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

export async function closePostgresPool() {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}
