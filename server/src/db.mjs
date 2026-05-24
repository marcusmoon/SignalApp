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
  queryPublicCalendarDateSummariesInDb,
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
let defaultDbSeedChecked = false;
const PUBLIC_READ_CACHE_TTL_MS = 5000;
const PUBLIC_READ_CACHE_MAX_ENTRIES = 300;
const publicReadCache = new Map();

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

function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function clearPublicReadCache() {
  publicReadCache.clear();
}

async function withDbRead(fn) {
  const db = await ensureSqliteStore();
  return fn(db);
}

async function cachedPublicRead(namespace, options, fn, ttlMs = PUBLIC_READ_CACHE_TTL_MS) {
  const key = `${namespace}:${stableStringify(options || {})}`;
  const now = Date.now();
  const cached = publicReadCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) publicReadCache.delete(key);
  const value = await withDbRead(fn);
  if (ttlMs > 0) {
    if (publicReadCache.size >= PUBLIC_READ_CACHE_MAX_ENTRIES) {
      for (const [cacheKey, entry] of publicReadCache) {
        if (entry.expiresAt <= now || publicReadCache.size >= PUBLIC_READ_CACHE_MAX_ENTRIES) {
          publicReadCache.delete(cacheKey);
        }
        if (publicReadCache.size < PUBLIC_READ_CACHE_MAX_ENTRIES) break;
      }
    }
    publicReadCache.set(key, { value, expiresAt: now + ttlMs });
  }
  return value;
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
  if (!defaultDbSeedChecked) {
    if (!hasStructuredData(db)) await writeSqliteDbBody(defaultDb(), { db });
    defaultDbSeedChecked = true;
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
  return withDbExclusive(async () => {
    const result = await writeDbBody(db);
    clearPublicReadCache();
    return result;
  });
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
      clearPublicReadCache();
      return result;
    } catch (error) {
      conn.exec('ROLLBACK');
      throw error;
    }
  });
}

export async function queryInsightItems(options = {}) {
  return cachedPublicRead('insights', options, (conn) => queryInsightItemsInDb(conn, options));
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
  return withDbRead((db) => listLegalTermsInDb(db, options));
}

export async function listAppUserTermAcceptances(userId) {
  return withDbRead((db) => listAppUserTermAcceptancesInDb(db, userId));
}

export async function updateLegalTerm(type, locale, patch = {}) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    const result = updateLegalTermInDb(db, type, locale, patch);
    clearPublicReadCache();
    return result;
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
  return withDbRead((db) => getAppUserInDb(db, userId));
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
  return withDbRead((db) => listAppUserIdentitiesInDb(db, userId));
}

export async function listAppUserAccountEvents(userId, options = {}) {
  return withDbRead((db) => listAppUserAccountEventsInDb(db, userId, options));
}

export async function listAppUserDevicesForUser(userId, options = {}) {
  return withDbRead((db) => listAppUserDevicesForUserInDb(db, userId, options));
}

export async function listAppUserAuthSessions(userId, options = {}) {
  return withDbRead((db) => listAppUserAuthSessionsInDb(db, userId, options));
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
  return withDbRead((db) => queryPublicNotificationsForUserInDb(db, userId, options));
}

export async function queryPublicNews(options = {}) {
  return cachedPublicRead('publicNews', options, (db) => queryPublicNewsInDb(db, options));
}

export async function queryPublicNewsSources(options = {}) {
  return cachedPublicRead('publicNewsSources', options, (db) => queryPublicNewsSourcesInDb(db, options), 30000);
}

export async function queryPublicYoutube(options = {}) {
  return cachedPublicRead('publicYoutube', options, (db) => queryPublicYoutubeInDb(db, options));
}

export async function queryPublicYoutubeChannels() {
  return cachedPublicRead('publicYoutubeChannels', {}, (db) => queryPublicYoutubeChannelsInDb(db), 30000);
}

export async function readDbHealthSummary() {
  return withDbRead((db) => {
    const jobs = db.prepare('SELECT COUNT(*) AS count FROM polling_jobs').get();
    return {
      ok: true,
      jobs: Number(jobs?.count) || 0,
    };
  });
}

export async function queryPublicMarketQuotes(options = {}) {
  return cachedPublicRead('publicMarketQuotes', options, (db) => queryPublicMarketQuotesInDb(db, options), 3000);
}

export async function queryPublicCalendar(options = {}) {
  return cachedPublicRead('publicCalendar', options, (db) => queryPublicCalendarInDb(db, options), 30000);
}

export async function queryPublicCalendarDateSummaries(options = {}) {
  return cachedPublicRead(
    'publicCalendarDateSummaries',
    options,
    (db) => queryPublicCalendarDateSummariesInDb(db, options),
    30000,
  );
}

export async function queryPublicConcalls(options = {}) {
  return cachedPublicRead('publicConcalls', options, (db) => queryPublicConcallsInDb(db, options), 10000);
}

export async function queryPublicCoinMarkets(options = {}) {
  return cachedPublicRead('publicCoinMarkets', options, (db) => queryPublicCoinMarketsInDb(db, options), 10000);
}

export async function readPublicMarketLists() {
  return cachedPublicRead('publicMarketLists', {}, (db) => readPublicMarketListsInDb(db), 30000);
}

export async function readPublicMarketList(key) {
  return cachedPublicRead('publicMarketList', { key }, (db) => readPublicMarketListInDb(db, key), 30000);
}

export async function readAppSettings() {
  return cachedPublicRead('appSettings', {}, (db) => readAppSettingsInDb(db), 5000);
}

export async function upsertMarketQuotes(rows = []) {
  return withDbExclusive(async () => {
    const db = await ensureSqliteStore();
    db.exec('BEGIN IMMEDIATE');
    try {
      upsertMarketQuoteRowsInDb(db, rows);
      db.exec('COMMIT');
      clearPublicReadCache();
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
