import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.mjs';
import {
  confirmAppUserEmailChangeInDb,
  createAppUserInDb,
  disconnectAppUserIdentityInDb,
  getAppUserInDb,
  linkAppUserSocialIdentityInDb,
  listAppUserAccountEventsInDb,
  listAppUserAuthSessionsInDb,
  listAppUserDevicesForUserInDb,
  listAppUserIdentitiesInDb,
  listAppUserDevicesInDb,
  listAppUsersInDb,
  loginAppUserInDb,
  loginOrRegisterSocialUserInDb,
  refreshAppUserSessionInDb,
  requestAppUserEmailChangeInDb,
  revokeAppUserTokenInDb,
  setAppUserPasswordInDb,
  updateAppUserAdminInDb,
  updateAppUserDeviceAdminInDb,
  updateAppUserProfileInDb,
  upsertAppUserDeviceInDb,
  verifyAppUserTokenInDb,
  withdrawAppUserInDb,
} from './db/appUsers.mjs';
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
import { listAppUserTermAcceptancesInDb, listLegalTermsInDb, updateLegalTermInDb } from './db/legalTerms.mjs';
import {
  acquirePollingJobLockInDb,
  getPollingJobLockInDb,
  getPollingJobInDb,
  listDuePollingJobsInDb,
  listPollingJobLocksInDb,
  releasePollingJobLockInDb,
} from './db/jobs.mjs';
import {
  ensureNewsSourcesFromItems,
  normalizeNewsSourceName,
  normalizeNewsSourceNameWithAliases,
} from './db/newsSources.mjs';
import {
  claimPushNotificationsForDeliveryInDb,
  queryNotificationsInDb,
  queryPublicNotificationsForUserInDb,
  resolvePushDevicesForNotificationInDb,
  updateNotificationSendStateInDb,
  upsertNotificationItemInDb,
} from './db/notifications.mjs';
import {
  queryPublicCalendarInDb,
  queryPublicCoinMarketsInDb,
  queryPublicConcallsInDb,
  queryPublicMarketQuotesInDb,
  queryPublicNewsInDb,
  queryPublicNewsSourcesInDb,
  queryPublicYoutubeInDb,
  queryPublicYoutubeChannelsInDb,
  readAppSettingsInDb,
  readPublicMarketListInDb,
  readPublicMarketListsInDb,
  upsertMarketQuoteRowsInDb,
} from './db/publicQueries.mjs';
import {
  hasStructuredData,
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
let defaultDbSeedChecked = false;
let operationalFixupsChecked = false;

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

function applyOperationalFixups(db) {
  if (operationalFixupsChecked) return;
  operationalFixupsChecked = true;

  const jobKey = 'insights_market_brief';
  const row = db
    .prepare('SELECT job_key, enabled, last_run_at, payload FROM polling_jobs WHERE job_key = ?')
    .get(jobKey);
  if (!row || Number(row.enabled) !== 0 || row.last_run_at) return;

  let payload = null;
  try {
    payload = JSON.parse(row.payload || 'null');
  } catch {
    return;
  }
  if (!payload || typeof payload !== 'object' || payload.enabled === true || payload.lastRunAt) return;

  const updatedAt = nowIso();
  payload.enabled = true;
  payload.nextRunAt = null;
  payload.updatedAt = updatedAt;
  db.prepare(
    `
      UPDATE polling_jobs
      SET enabled = 1,
          next_run_at = NULL,
          updated_at = ?,
          payload = ?
      WHERE job_key = ?
    `,
  ).run(updatedAt, JSON.stringify(payload), jobKey);
  console.log('[db] enabled never-run insights_market_brief job');
}

async function ensureSqliteStore() {
  await fs.mkdir(path.dirname(config.sqlitePath), { recursive: true });
  const db = getSqliteDb();
  if (!structuredMigrationChecked) {
    migrateLegacySignalStoresIfNeeded(db);
    structuredMigrationChecked = true;
  }
  if (!defaultDbSeedChecked) {
    if (!hasStructuredData(db)) await writeSqliteDbBody(defaultDb(), { db });
    defaultDbSeedChecked = true;
  }
  applyOperationalFixups(db);
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

export async function listDuePollingJobs(now = Date.now()) {
  return withDbExclusive(async () => {
    const conn = await ensureSqliteStore();
    return listDuePollingJobsInDb(conn, new Date(now));
  });
}

export async function getPollingJob(jobKey) {
  return withDbExclusive(async () => {
    const conn = await ensureSqliteStore();
    return getPollingJobInDb(conn, jobKey);
  });
}

export async function listPollingJobLocks() {
  return withDbExclusive(async () => {
    const conn = await ensureSqliteStore();
    return listPollingJobLocksInDb(conn);
  });
}

export async function getPollingJobLock(jobKey) {
  return withDbExclusive(async () => {
    const conn = await ensureSqliteStore();
    return getPollingJobLockInDb(conn, jobKey);
  });
}

export async function acquirePollingJobLock(jobKey, options = {}) {
  return withDbExclusive(async () => {
    const conn = await ensureSqliteStore();
    conn.exec('BEGIN IMMEDIATE');
    try {
      const lock = acquirePollingJobLockInDb(conn, jobKey, options);
      conn.exec('COMMIT');
      return lock;
    } catch (error) {
      conn.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function releasePollingJobLock(jobKey, token) {
  return withDbExclusive(async () => {
    const conn = await ensureSqliteStore();
    conn.exec('BEGIN IMMEDIATE');
    try {
      const released = releasePollingJobLockInDb(conn, jobKey, token);
      conn.exec('COMMIT');
      return released;
    } catch (error) {
      conn.exec('ROLLBACK');
      throw error;
    }
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

export async function createAppUser(payload) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = await createAppUserInDb(db, payload);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function listLegalTerms(options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return listLegalTermsInDb(db, options);
  });
}

export async function listAppUserTermAcceptances(userId) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return listAppUserTermAcceptancesInDb(db, userId);
  });
}

export async function updateLegalTerm(type, locale, patch = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return updateLegalTermInDb(db, type, locale, patch);
  });
}

export async function listAppUsers(options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return listAppUsersInDb(db, options);
  });
}

export async function listAppUserDevices(options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return listAppUserDevicesInDb(db, options);
  });
}

export async function getAppUser(userId) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return getAppUserInDb(db, userId);
  });
}

export async function updateAppUserAdmin(userId, patch) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return updateAppUserAdminInDb(db, userId, patch);
  });
}

export async function updateAppUserDeviceAdmin(deviceId, patch) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return updateAppUserDeviceAdminInDb(db, deviceId, patch);
  });
}

export async function loginAppUser(payload) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return await loginAppUserInDb(db, payload);
  });
}

export async function loginOrRegisterSocialUser(payload) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = await loginOrRegisterSocialUserInDb(db, payload);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function linkAppUserSocialIdentity(userId, provider, profile) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = linkAppUserSocialIdentityInDb(db, userId, provider, profile);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function listAppUserIdentities(userId) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return listAppUserIdentitiesInDb(db, userId);
  });
}

export async function listAppUserAccountEvents(userId, options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return listAppUserAccountEventsInDb(db, userId, options);
  });
}

export async function listAppUserDevicesForUser(userId, options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return listAppUserDevicesForUserInDb(db, userId, options);
  });
}

export async function listAppUserAuthSessions(userId, options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return listAppUserAuthSessionsInDb(db, userId, options);
  });
}

export async function setAppUserPassword(userId, payload) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return setAppUserPasswordInDb(db, userId, payload);
  });
}

export async function requestAppUserEmailChange(userId, payload) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = requestAppUserEmailChangeInDb(db, userId, payload);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function confirmAppUserEmailChange(userId, payload) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = confirmAppUserEmailChangeInDb(db, userId, payload);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function disconnectAppUserIdentity(userId, identityId) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return disconnectAppUserIdentityInDb(db, userId, identityId);
  });
}

export async function verifyAppUserToken(token) {
  const db = await ensureSqliteStore();
  return await verifyAppUserTokenInDb(db, token);
}

export async function revokeAppUserToken(token) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return await revokeAppUserTokenInDb(db, token);
  });
}

export async function refreshAppUserSession(payload) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = await refreshAppUserSessionInDb(db, payload);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function updateAppUserProfile(userId, patch) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return updateAppUserProfileInDb(db, userId, patch);
  });
}

export async function withdrawAppUser(userId) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = withdrawAppUserInDb(db, userId);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function upsertAppUserDevice(userId, payload) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return upsertAppUserDeviceInDb(db, userId, payload);
  });
}

export async function queryNotifications(options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return queryNotificationsInDb(db, options);
  });
}

export async function queryPublicNotificationsForUser(userId, options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return queryPublicNotificationsForUserInDb(db, userId, options);
  });
}

export async function queryPublicNews(options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return queryPublicNewsInDb(db, options);
  });
}

export async function queryPublicNewsSources(options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return queryPublicNewsSourcesInDb(db, options);
  });
}

export async function queryPublicYoutube(options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return queryPublicYoutubeInDb(db, options);
  });
}

export async function queryPublicYoutubeChannels() {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return queryPublicYoutubeChannelsInDb(db);
  });
}

export async function readDbHealthSummary() {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    const jobs = db.prepare('SELECT COUNT(*) AS count FROM polling_jobs').get();
    return {
      ok: true,
      jobs: Number(jobs?.count) || 0,
    };
  });
}

export async function queryPublicMarketQuotes(options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return queryPublicMarketQuotesInDb(db, options);
  });
}

export async function queryPublicCalendar(options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return queryPublicCalendarInDb(db, options);
  });
}

export async function queryPublicConcalls(options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return queryPublicConcallsInDb(db, options);
  });
}

export async function queryPublicCoinMarkets(options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return queryPublicCoinMarketsInDb(db, options);
  });
}

export async function readPublicMarketLists() {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return readPublicMarketListsInDb(db);
  });
}

export async function readPublicMarketList(key) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return readPublicMarketListInDb(db, key);
  });
}

export async function readAppSettings() {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return readAppSettingsInDb(db);
  });
}

export async function upsertMarketQuotes(rows = []) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      upsertMarketQuoteRowsInDb(db, rows);
      db.exec('COMMIT');
      return rows;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function upsertNotification(next) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      const saved = upsertNotificationItemInDb(db, next);
      db.exec('COMMIT');
      return saved;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}

export const upsertNotificationItem = upsertNotification;

export async function claimPushNotificationsForDelivery(options = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      const rows = claimPushNotificationsForDeliveryInDb(db, options);
      db.exec('COMMIT');
      return rows;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function resolvePushDevicesForNotification(notification) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    return resolvePushDevicesForNotificationInDb(db, notification);
  });
}

export async function updateNotificationSendState(notificationId, patch = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = updateNotificationSendStateInDb(db, notificationId, patch);
      db.exec('COMMIT');
      return row;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
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
