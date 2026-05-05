import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.mjs';
import {
  createAdminUserInDb,
  deleteAdminUserInDb,
  hasAdminUsersInDb,
  listAdminUsersInDb,
  seedAdminUsersFromEnvIfEmpty,
  updateAdminUserInDb,
  verifyAdminLoginInDb,
} from './db/adminUsers.mjs';
import { defaultDb } from './db/defaults.mjs';
import { queryInsightItemsInDb } from './db/insights.mjs';
import {
  ensureNewsSourcesFromItems,
  normalizeNewsSourceName,
  normalizeNewsSourceNameWithAliases,
} from './db/newsSources.mjs';
import {
  migrateLegacySignalStoresIfNeeded,
  readStructuredDb,
  writeStructuredDb,
} from './db/sqliteStore.mjs';
import { ensureStructuredSchema } from './db/sqlite/schema.mjs';
import { nowIso } from './db/time.mjs';

/**
 * Single-process: concurrent HTTP + scheduler + jobs can otherwise interleave read/modify/write
 * and lose updates before a transaction is opened. SQLite protects the file across processes once
 * BEGIN IMMEDIATE is acquired; this queue keeps the local event loop orderly as well.
 */
let dbExclusiveChain = Promise.resolve();
let sqliteDb = null;
let structuredMigrationChecked = false;

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withDbExclusive(fn) {
  const prev = dbExclusiveChain;
  let release;
  dbExclusiveChain = new Promise((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function getSqliteDb() {
  if (sqliteDb) return sqliteDb;
  sqliteDb = new DatabaseSync(config.sqlitePath);
  ensureStructuredSchema(sqliteDb);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return sqliteDb;
}

async function ensureSqliteStore() {
  await fs.mkdir(path.dirname(config.sqlitePath), { recursive: true });
  const db = getSqliteDb();
  if (!structuredMigrationChecked) {
    migrateLegacySignalStoresIfNeeded(db);
    structuredMigrationChecked = true;
  }
  seedAdminUsersFromEnvIfEmpty(db);
  return db;
}

async function readSqliteDbBody(db = null) {
  const conn = db || (await ensureSqliteStore());
  return readStructuredDb(conn);
}

async function writeSqliteDbBody(dbObject, { db = null, transaction = true } = {}) {
  const conn = db || (await ensureSqliteStore());
  writeStructuredDb(conn, dbObject, { transaction });
}

async function readDbBody(db = null) {
  const sqliteDbObject = await readSqliteDbBody(db);
  if (sqliteDbObject) return sqliteDbObject;

  const dbObject = defaultDb();
  await writeSqliteDbBody(dbObject, { db, transaction: !db });
  return dbObject;
}

async function writeDbBody(dbObject) {
  await writeSqliteDbBody(dbObject);
}

export async function readDb() {
  return withDbExclusive(() => readDbBody());
}

export async function writeDb(db) {
  return withDbExclusive(() => writeDbBody(db));
}

export async function updateDb(mutator) {
  return withDbExclusive(async () => {
    const conn = await ensureSqliteStore();
    conn.exec('BEGIN IMMEDIATE');
    try {
      const db = await readDbBody(conn);
      const result = await mutator(db);
      await writeSqliteDbBody(db, { db: conn, transaction: false });
      conn.exec('COMMIT');
      return result;
    } catch (error) {
      conn.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function queryInsightItems(options = {}) {
  return withDbExclusive(async () => {
    const conn = await ensureSqliteStore();
    return queryInsightItemsInDb(conn, options);
  });
}

export async function verifyAdminLogin(loginId, password) {
  const db = await ensureSqliteStore();
  return verifyAdminLoginInDb(db, loginId, password);
}

export async function hasAdminUsers() {
  const db = await ensureSqliteStore();
  return hasAdminUsersInDb(db);
}

export async function listAdminUsers() {
  const db = await ensureSqliteStore();
  return listAdminUsersInDb(db);
}

export async function createAdminUser({ id, password, active = true }) {
  const db = await ensureSqliteStore();
  return createAdminUserInDb(db, { id, password, active });
}

export async function updateAdminUser(id, patch = {}) {
  const db = await ensureSqliteStore();
  return updateAdminUserInDb(db, id, patch);
}

export async function deleteAdminUser(id) {
  const db = await ensureSqliteStore();
  return deleteAdminUserInDb(db, id);
}

export function upsertById(list, item) {
  const index = list.findIndex((x) => x.id === item.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...item, updatedAt: nowIso() };
    return list[index];
  }
  const next = { ...item, createdAt: nowIso(), updatedAt: nowIso() };
  list.push(next);
  return next;
}

export {
  ensureNewsSourcesFromItems,
  normalizeNewsSourceName,
  normalizeNewsSourceNameWithAliases,
  nowIso,
};
