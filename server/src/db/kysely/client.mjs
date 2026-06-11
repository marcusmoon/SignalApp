import { CompiledQuery, Kysely, PostgresDialect, sql } from 'kysely';
import { getPostgresPool, postgresConfigured } from '../postgres/client.mjs';

let db = null;

export function getKyselyDb() {
  if (db) return db;
  db = new Kysely({
    dialect: new PostgresDialect({
      pool: getPostgresPool(),
    }),
  });
  return db;
}

function pgLikeResult(result) {
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const affected = result?.numAffectedRows ?? result?.numUpdatedOrDeletedRows;
  const rowCount = affected == null ? rows.length : Number(affected);
  return {
    rows,
    rowCount: Number.isFinite(rowCount) ? rowCount : rows.length,
  };
}

export async function queryKysely(text, params = [], executor = getKyselyDb()) {
  const result = await executor.executeQuery(CompiledQuery.raw(String(text || ''), Array.isArray(params) ? params : []));
  return pgLikeResult(result);
}

export async function withKyselyTransaction(fn) {
  return getKyselyDb().transaction().execute((trx) =>
    fn({
      query: (text, params = []) => queryKysely(text, params, trx),
    }),
  );
}

export async function checkKyselyConnectivity() {
  if (!postgresConfigured()) {
    return { configured: false, ok: false };
  }
  const startedAt = Date.now();
  try {
    const result = await queryKysely('SELECT current_database() AS database, current_schema() AS schema');
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

export { sql };
