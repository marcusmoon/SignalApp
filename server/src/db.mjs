import crypto from 'node:crypto';
import { config } from './config.mjs';
import {
  ensureDbShape,
  shapeDbFromStores,
  splitStoresFromDb,
} from './db/shape.mjs';
import {
  ensureNewsSourcesFromItems,
  normalizeNewsSourceName,
  normalizeNewsSourceNameWithAliases,
} from './db/newsSources.mjs';
import { nowIso } from './db/time.mjs';
import {
  checkPostgresConnectivity,
  queryPostgres,
  withPostgresClient,
} from './db/postgres/client.mjs';
import {
  cleanNewsTitleForDisplay,
  cleanTranslationText,
  displayNews,
  hasUsableTranslation,
} from './http/shared.mjs';
import { listActiveYoutubeChannelHandles } from './db/youtubeChannels.mjs';
import { buildQuantSignal } from './quant/signals.mjs';
import { aggregateBacktests, backtestInstrument } from './quant/backtest.mjs';
import {
  isAppUserJwtConfigured,
  isLikelyJwt,
  signAppUserAccessToken,
  verifyAppUserAccessToken,
} from './auth/jwtAccess.mjs';

const SESSION_DAYS = 90;
const PUBLIC_READ_CACHE_TTL_MS = 5000;
const PUBLIC_READ_CACHE_MAX_ENTRIES = 300;
const publicReadCache = new Map();
let dbExclusiveChain = Promise.resolve();
let seedChecked = false;

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, row) {
  if (!row?.password_hash || !row?.password_salt) return false;
  const { hash } = hashPassword(password, row.password_salt);
  const saved = Buffer.from(String(row.password_hash), 'hex');
  const candidate = Buffer.from(hash, 'hex');
  return saved.length === candidate.length && crypto.timingSafeEqual(saved, candidate);
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function otpHash(code, salt) {
  return crypto.createHash('sha256').update(`${cleanText(code)}:${cleanText(salt)}`).digest('hex');
}

function maskEmail(email) {
  const [local, domain] = normalizeEmail(email).split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}

function hashProviderUserId(provider, providerUserId) {
  const raw = `${cleanText(provider).toLowerCase()}:${cleanText(providerUserId)}`;
  if (!raw.endsWith(':')) return crypto.createHash('sha256').update(raw).digest('hex');
  return '';
}

function parseBool(value, fallback = false) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function textOrNull(value) {
  const text = cleanText(value);
  return text ? text : null;
}

function isoOrNull(value) {
  const text = cleanText(value);
  return text ? text : null;
}

function dateOrNull(value) {
  const text = cleanText(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeLimit(value, fallback = 30, max = 100) {
  return Math.min(max, Math.max(1, Math.floor(Number(value)) || fallback));
}

function safeOffset(value) {
  return Math.max(0, Math.floor(Number(value)) || 0);
}

function pageOptions(options = {}, defaultLimit = 30) {
  const limit = safeLimit(options.limit ?? options.pageSize, defaultLimit, 100);
  const page = Math.max(1, Math.floor(Number(options.page)) || 1);
  const offset = options.offset != null && cleanText(options.offset) !== '' ? safeOffset(options.offset) : (page - 1) * limit;
  return { limit, offset };
}

function pagination(rows, { limit, offset }) {
  const total = rows.length;
  const slice = rows.slice(offset, offset + limit);
  return {
    rows: slice,
    total,
    limit,
    offset,
    hasMore: offset + slice.length < total,
    nextOffset: offset + slice.length,
  };
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

async function cachedPublicRead(namespace, options, fn, ttlMs = PUBLIC_READ_CACHE_TTL_MS) {
  const key = `${namespace}:${stableStringify(options || {})}`;
  const now = Date.now();
  const cached = publicReadCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) publicReadCache.delete(key);
  const value = await fn();
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

function jsonPayload(value) {
  return JSON.stringify(value ?? null);
}

function payloadFromRow(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return payload && typeof payload === 'object' ? payload : null;
}

const collectionSpecs = [
  {
    key: 'providerSettings',
    store: 'settings',
    table: 'provider_settings',
    pk: 'provider',
    keyOf: (row) => row.provider,
    columns: (row, index) => ({
      position: index,
      enabled: row.enabled !== false,
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'translationSettings',
    store: 'settings',
    table: 'translation_settings',
    pk: 'locale',
    keyOf: (row) => row.locale,
    columns: (row, index) => ({
      position: index,
      provider: textOrNull(row.provider),
      enabled: row.enabled !== false,
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'newsSources',
    store: 'settings',
    table: 'news_sources',
    pk: 'source_key',
    keyOf: (row) => `${row.id}|${row.category || 'global'}`,
    columns: (row, index) => ({
      position: index,
      source_id: textOrNull(row.id),
      category: textOrNull(row.category || 'global'),
      name: textOrNull(row.name),
      enabled: row.enabled !== false,
      hidden: row.hidden === true,
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'rssSources',
    store: 'settings',
    table: 'rss_sources',
    pk: 'source_id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      provider_id: textOrNull(row.providerId),
      source_name: textOrNull(row.sourceName || row.name),
      category: textOrNull(row.category || 'global'),
      enabled: row.enabled !== false,
      hidden: row.hidden === true,
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'pollingJobs',
    store: 'jobs',
    table: 'polling_jobs',
    pk: 'job_key',
    keyOf: (row) => row.jobKey,
    columns: (row, index) => ({
      position: index,
      enabled: row.enabled === true,
      domain: textOrNull(row.domain),
      operation: textOrNull(row.operation),
      provider: textOrNull(row.provider),
      handler: textOrNull(row.handler),
      next_run_at: isoOrNull(row.nextRunAt),
      last_run_at: isoOrNull(row.lastRunAt),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'pollingJobRuns',
    store: 'jobs',
    table: 'polling_job_runs',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      job_key: textOrNull(row.jobKey),
      status: textOrNull(row.status),
      trigger_type: textOrNull(row.trigger),
      started_at: isoOrNull(row.startedAt),
      finished_at: isoOrNull(row.finishedAt),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'newsItems',
    store: 'news',
    table: 'news_items',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      category: textOrNull(row.category),
      provider: textOrNull(row.provider),
      source_name: textOrNull(row.sourceName),
      published_at: isoOrNull(row.publishedAt),
      fetched_at: isoOrNull(row.fetchedAt),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'newsTranslations',
    store: 'news',
    table: 'news_translations',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      news_item_id: textOrNull(row.newsItemId),
      locale: textOrNull(row.locale),
      status: textOrNull(row.status),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'calendarEvents',
    store: 'calendar',
    table: 'calendar_events',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      event_date: dateOrNull(row.date || row.eventAt),
      event_at: isoOrNull(row.eventAt),
      event_type: textOrNull(row.type),
      symbol: textOrNull(row.symbol),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'concallTranscripts',
    store: 'concalls',
    table: 'concall_transcripts',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      symbol: textOrNull(row.symbol),
      earnings_date: dateOrNull(row.earningsDate),
      fiscal_year: numberOrNull(row.fiscalYear),
      fiscal_quarter: numberOrNull(row.fiscalQuarter),
      fetched_at: isoOrNull(row.fetchedAt),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'youtubeVideos',
    store: 'youtube',
    table: 'youtube_videos',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      channel: textOrNull(row.channel),
      published_at: isoOrNull(row.publishedAt),
      fetched_at: isoOrNull(row.fetchedAt),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'marketQuotes',
    store: 'market',
    table: 'market_quotes',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      symbol: textOrNull(row.symbol),
      segment: textOrNull(row.segment),
      quote_time: isoOrNull(row.quoteTime),
      fetched_at: isoOrNull(row.fetchedAt),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'coinMarkets',
    store: 'market',
    table: 'coin_markets',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      symbol: textOrNull(row.symbol),
      fetched_at: isoOrNull(row.fetchedAt),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'marketLists',
    store: 'market',
    table: 'market_lists',
    pk: 'list_key',
    keyOf: (row) => row.key,
    columns: (row, index) => ({
      position: index,
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'priceSeries',
    store: 'market',
    table: 'price_series',
    pk: 'symbol',
    keyOf: (row) => row.symbol,
    columns: (row, index) => ({
      position: index,
      display_symbol: textOrNull(row.displaySymbol),
      yahoo_symbol: textOrNull(row.yahooSymbol),
      last_bar_date: dateOrNull(row.lastBarDate || row.bars?.[row.bars.length - 1]?.date),
      fetched_at: isoOrNull(row.fetchedAt),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'quantSignalItems',
    store: 'insights',
    table: 'quant_signal_items',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      symbol: textOrNull(row.symbol),
      action: textOrNull(row.action),
      level: textOrNull(row.level),
      score: numberOrNull(row.score),
      generated_date: dateOrNull(row.generatedDate || row.generatedAt),
      generated_at: isoOrNull(row.generatedAt),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'insightItems',
    store: 'insights',
    table: 'insight_items',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      kind: textOrNull(row.kind),
      display_key: textOrNull(row.displayKey || row.symbol),
      level: textOrNull(row.level),
      score: numberOrNull(row.score),
      generated_date: dateOrNull(row.generatedDate || row.generatedAt),
      generated_at: isoOrNull(row.generatedAt),
      expires_at: isoOrNull(row.expiresAt),
      push_candidate: row.pushCandidate === true,
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'notificationItems',
    store: 'insights',
    table: 'notification_items',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      type: textOrNull(row.type),
      channel: textOrNull(row.channel),
      status: textOrNull(row.status),
      priority: textOrNull(row.priority),
      title: textOrNull(row.title),
      app_user_id: textOrNull(row.appUserId),
      target_type: textOrNull(row.targetType),
      target_key: textOrNull(row.targetKey),
      scheduled_at: isoOrNull(row.scheduledAt),
      expires_at: isoOrNull(row.expiresAt),
      sent_at: isoOrNull(row.sentAt),
      source_type: textOrNull(row.sourceType),
      source_id: textOrNull(row.sourceId),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
];

const singletonSpecs = [
  { key: 'meta', store: 'settings', table: 'signal_meta', pk: 'name', id: 'db' },
  { key: 'appSettings', store: 'settings', table: 'app_settings', pk: 'id', id: 'app' },
  { key: 'uiModelPresets', store: 'settings', table: 'ui_model_presets', pk: 'id', id: 'default' },
  { key: 'newsSourceSettings', store: 'settings', table: 'news_source_settings', pk: 'id', id: 'default' },
];

const collectionSpecsByKey = new Map(collectionSpecs.map((spec) => [spec.key, spec]));

async function readCollection(client, spec) {
  const result = await client.query(`SELECT payload FROM ${spec.table} ORDER BY position ASC`);
  return result.rows.map(payloadFromRow).filter(Boolean);
}

async function readSingleton(client, spec) {
  const result = await client.query(`SELECT payload FROM ${spec.table} WHERE ${spec.pk} = $1`, [spec.id]);
  return payloadFromRow(result.rows[0]);
}

async function hasStructuredData(client) {
  const result = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM app_settings) +
      (SELECT COUNT(*) FROM signal_meta) +
      (SELECT COUNT(*) FROM polling_jobs) AS count
  `);
  return Number(result.rows[0]?.count) > 0;
}

async function readStructuredDb(client) {
  if (!(await hasStructuredData(client))) return null;
  const settings = {};
  const stores = {
    settings,
    jobs: {},
    news: {},
    calendar: {},
    concalls: {},
    youtube: {},
    market: {},
    insights: {},
  };
  for (const spec of singletonSpecs) {
    stores[spec.store][spec.key] = await readSingleton(client, spec);
  }
  for (const spec of collectionSpecs) {
    stores[spec.store][spec.key] = await readCollection(client, spec);
  }
  return shapeDbFromStores(stores);
}

async function insertSingleton(client, spec, payload) {
  const columns = [spec.pk, 'payload', 'updated_at'];
  const values = [spec.id, jsonPayload(payload), isoOrNull(payload?.updatedAt) || nowIso()];
  await client.query(
    `
      INSERT INTO ${spec.table} (${columns.join(', ')})
      VALUES ($1, $2::jsonb, $3)
      ON CONFLICT(${spec.pk}) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `,
    values,
  );
}

async function insertCollectionRow(client, spec, row, index) {
  const key = cleanText(spec.keyOf(row));
  if (!key) return;
  const typedColumns = spec.columns(row, index);
  const columns = [spec.pk, ...Object.keys(typedColumns), 'payload'];
  const values = [key, ...Object.values(typedColumns), jsonPayload(row)];
  const placeholders = values.map((_, idx) => (idx === values.length - 1 ? `$${idx + 1}::jsonb` : `$${idx + 1}`));
  const updates = columns
    .filter((column) => column !== spec.pk)
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');
  await client.query(
    `
      INSERT INTO ${spec.table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT(${spec.pk}) DO UPDATE SET ${updates}
    `,
    values,
  );
}

async function writeStructuredDb(client, dbObject) {
  const stores = splitStoresFromDb(dbObject);
  for (const spec of singletonSpecs) {
    await insertSingleton(client, spec, stores[spec.store][spec.key]);
  }
  const seenByTable = new Map();
  for (const spec of collectionSpecs) {
    const rows = stores[spec.store][spec.key] || [];
    const seen = new Set();
    for (let index = 0; index < rows.length; index += 1) {
      const key = cleanText(spec.keyOf(rows[index]));
      if (!key) continue;
      seen.add(key);
      await insertCollectionRow(client, spec, rows[index], index);
    }
    seenByTable.set(spec.table, { spec, seen });
  }
  for (const spec of [...collectionSpecs].reverse()) {
    const state = seenByTable.get(spec.table);
    if (!state) continue;
    const existing = await client.query(`SELECT ${spec.pk} AS id FROM ${spec.table}`);
    for (const row of existing.rows) {
      const key = cleanText(row.id);
      if (key && !state.seen.has(key)) {
        await client.query(`DELETE FROM ${spec.table} WHERE ${spec.pk} = $1`, [key]);
      }
    }
  }
}

async function seedAdminUsersIfEmpty(client) {
  const count = await client.query('SELECT COUNT(*)::int AS count FROM admin_users');
  if (Number(count.rows[0]?.count) > 0) return;
  const users = Array.isArray(config.adminUsers) ? config.adminUsers : [];
  if (users.length === 0) return;
  const now = nowIso();
  let inserted = 0;
  for (const user of users) {
    const id = cleanText(user?.id);
    const password = String(user?.password || '');
    if (!id || !password) continue;
    const { hash, salt } = hashPassword(password);
    await client.query(
      `
        INSERT INTO admin_users (id, password_hash, password_salt, active, created_at, updated_at)
        VALUES ($1, $2, $3, true, $4, $4)
        ON CONFLICT(id) DO NOTHING
      `,
      [id, hash, salt, now],
    );
    inserted += 1;
  }
  if (inserted > 0) console.log(`[db] seeded ${inserted} admin user(s) into Postgres`);
}

async function ensureSeeded() {
  if (seedChecked) return;
  await withPostgresClient(async (client) => {
    await client.query('BEGIN');
    try {
      if (!(await hasStructuredData(client))) {
        console.warn('[db] default runtime data is missing. Run Flyway migrations before deploying.');
      }
      await seedAdminUsersIfEmpty(client);
      await client.query('COMMIT');
      seedChecked = true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

function emptyStructuredDb() {
  return shapeDbFromStores({});
}

async function readDbBody(client = null) {
  if (client) {
    const db = await readStructuredDb(client);
    return db || emptyStructuredDb();
  }
  await ensureSeeded();
  return withPostgresClient(async (conn) => {
    const db = await readStructuredDb(conn);
    return db || emptyStructuredDb();
  });
}

export async function readDb() {
  return withDbExclusive(() => readDbBody());
}

export async function writeDb(db) {
  return withDbExclusive(async () => {
    await ensureSeeded();
    await withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        await writeStructuredDb(client, ensureDbShape(db));
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
    clearPublicReadCache();
  });
}

export async function updateDb(mutator) {
  return withDbExclusive(async () => {
    await ensureSeeded();
    return withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        const db = await readDbBody(client);
        const result = await mutator(db);
        await writeStructuredDb(client, ensureDbShape(db));
        await client.query('COMMIT');
        clearPublicReadCache();
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  });
}

export async function upsertCollectionRows(collectionKey, rows = []) {
  const spec = collectionSpecsByKey.get(collectionKey);
  if (!spec) throw new Error(`UNKNOWN_COLLECTION:${collectionKey}`);
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) return { count: 0 };
  return withDbExclusive(async () => {
    await ensureSeeded();
    await withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        for (let index = 0; index < safeRows.length; index += 1) {
          await insertCollectionRow(client, spec, safeRows[index], index);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
    clearPublicReadCache();
    return { count: safeRows.length };
  });
}

export async function patchCollectionPayload(collectionKey, key, patch = {}) {
  const spec = collectionSpecsByKey.get(collectionKey);
  if (!spec) throw new Error(`UNKNOWN_COLLECTION:${collectionKey}`);
  const id = cleanText(key);
  if (!id) throw new Error('COLLECTION_KEY_REQUIRED');
  return withDbExclusive(async () => {
    await ensureSeeded();
    return withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        const current = await client.query(`SELECT payload, position FROM ${spec.table} WHERE ${spec.pk} = $1 FOR UPDATE`, [id]);
        const next = { ...(payloadFromRow(current.rows[0]) || {}), ...patch };
        if (!cleanText(spec.keyOf(next))) {
          if (collectionKey === 'pollingJobs') next.jobKey = id;
          else if (collectionKey === 'pollingJobRuns') next.id = id;
          else next[spec.pk] = id;
        }
        await insertCollectionRow(client, spec, next, Number(current.rows[0]?.position) || 0);
        await client.query('COMMIT');
        clearPublicReadCache();
        return next;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  });
}

export async function upsertPollingJobRun(run) {
  return upsertCollectionRows('pollingJobRuns', [run]);
}

export async function patchPollingJobRun(runId, patch = {}) {
  return patchCollectionPayload('pollingJobRuns', runId, patch);
}

export async function patchPollingJob(jobKey, patch = {}) {
  return patchCollectionPayload('pollingJobs', jobKey, patch);
}

function paginatedSqlRows(rows, { limit, offset }) {
  const hasLookahead = rows.length > limit;
  const slice = rows.slice(0, limit).map((row) => row.item).filter(Boolean);
  const exactTotal = Number(rows[0]?.total_count);
  const total = Number.isFinite(exactTotal) && exactTotal > 0
    ? exactTotal
    : offset + slice.length + (hasLookahead ? 1 : 0);
  return {
    rows: slice,
    total,
    limit,
    offset,
    hasMore: hasLookahead || offset + slice.length < total,
    nextOffset: hasLookahead || offset + slice.length < total ? offset + slice.length : null,
  };
}

function numberSqlExpression(jsonExpression) {
  return `CASE WHEN NULLIF(${jsonExpression}, '') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN (${jsonExpression})::numeric ELSE 0 END`;
}

function sqlDateOrTimestamp(value) {
  const text = cleanText(value);
  if (!text) return null;
  return text.includes('T') ? text : `${text}T00:00:00.000Z`;
}

function sqlStringList(value) {
  return cleanText(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function publicNews(item) {
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    summary: item.summary,
    originalTitle: item.originalTitle,
    originalSummary: item.originalSummary,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    imageUrl: item.imageUrl || null,
    symbols: Array.isArray(item.symbols) ? item.symbols : [],
    hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
    provider: item.provider,
    publishedAt: item.publishedAt || null,
    fetchedAt: item.fetchedAt,
  };
}

function publicYoutube(item) {
  return {
    id: item.id,
    videoId: item.videoId,
    title: item.title,
    channel: item.channel,
    channelId: item.channelId,
    channelHandle: item.channelHandle || null,
    description: item.description || '',
    publishedAt: item.publishedAt || null,
    duration: item.duration || '',
    viewCount: Number(item.viewCount) || 0,
    thumbnailUrl: item.thumbnailUrl || null,
    sortBucket: item.sortBucket || undefined,
    sortBuckets: Array.isArray(item.sortBuckets) ? item.sortBuckets : undefined,
    fetchedAt: item.fetchedAt,
  };
}

function publicMarketQuote(item) {
  return {
    id: item.id,
    provider: item.provider,
    providerItemId: item.providerItemId,
    segment: item.segment,
    symbol: item.symbol,
    displaySymbol: item.displaySymbol || item.symbol || null,
    krxSymbol: item.krxSymbol || item.rawPayload?.krxSymbol || null,
    name: item.name || null,
    currentPrice: item.currentPrice ?? null,
    change: item.change ?? null,
    changePercent: item.changePercent ?? null,
    high: item.high ?? null,
    low: item.low ?? null,
    open: item.open ?? null,
    previousClose: item.previousClose ?? null,
    marketCapitalization: item.marketCapitalization ?? null,
    quoteTime: item.quoteTime || null,
    fetchedAt: item.fetchedAt,
    sourceLabel: item.sourceLabel || null,
    official: item.official === false ? false : item.official === true ? true : null,
    notice: item.notice || null,
    afterHoursAvailable: item.afterHoursAvailable === true ? true : item.afterHoursAvailable === false ? false : null,
    regularSession: item.regularSession || null,
  };
}

function publicCoinMarket(item) {
  return {
    id: item.id,
    provider: item.provider,
    providerItemId: item.providerItemId,
    symbol: item.symbol,
    name: item.name,
    currentPrice: item.currentPrice ?? null,
    marketCap: item.marketCap ?? null,
    change24h: item.change24h ?? null,
    changePercent24h: item.changePercent24h ?? null,
    fetchedAt: item.fetchedAt,
  };
}

function publicCalendarEvent(item) {
  return {
    id: item.id,
    provider: item.provider,
    providerItemId: item.providerItemId,
    type: item.type,
    title: item.title,
    country: item.country || null,
    symbol: item.symbol || null,
    eventAt: item.eventAt || null,
    date: item.date || null,
    timeLabel: item.timeLabel || '',
    impact: item.impact || null,
    actual: item.actual ?? null,
    estimate: item.estimate ?? null,
    previous: item.previous ?? null,
    unit: item.unit || null,
    fiscalYear: item.fiscalYear ?? null,
    fiscalQuarter: item.fiscalQuarter ?? null,
    earningsHour: item.earningsHour || null,
    fetchedAt: item.fetchedAt,
  };
}

function publicConcall(item) {
  return {
    id: item.id,
    provider: item.provider,
    symbol: item.symbol,
    title: item.title,
    fiscalYear: item.fiscalYear ?? null,
    fiscalQuarter: item.fiscalQuarter ?? null,
    earningsDate: item.earningsDate || null,
    earningsHour: item.earningsHour || null,
    transcript: item.transcript || '',
    summaryProvider: item.summaryProvider || '',
    fetchedAt: item.fetchedAt,
  };
}

export async function queryPublicNews(options = {}) {
  return cachedPublicRead('publicNews', options, async () => {
    const { limit, offset } = pageOptions(options, 20);
    const locale = cleanText(options.locale) || 'ko';
    const params = [locale];
    const where = [];
    const category = cleanText(options.category);
    if (category) {
      if (category === 'global') {
        where.push(`(n.category = 'global' OR n.provider = 'financialjuice')`);
      } else {
        params.push(category);
        where.push(`n.category = $${params.length}`);
      }
    }
    const symbols = new Set([
      ...sqlStringList(options.symbols).map((s) => s.toUpperCase()),
      ...(cleanText(options.symbol) ? [cleanText(options.symbol).toUpperCase()] : []),
    ]);
    if (symbols.size > 0) {
      params.push([...symbols]);
      where.push(`COALESCE(n.payload->'symbols', '[]'::jsonb) ?| $${params.length}::text[]`);
    }
    const sources = sqlStringList(options.sources || options.source);
    if (sources.length > 0) {
      params.push(sources);
      where.push(`n.source_name = ANY($${params.length}::text[])`);
    }
    const from = sqlDateOrTimestamp(options.from);
    if (from) {
      params.push(from);
      where.push(`(n.published_at IS NULL OR n.published_at >= $${params.length}::timestamptz)`);
    }
    const rawTo = cleanText(options.to);
    const to = sqlDateOrTimestamp(rawTo);
    if (to) {
      params.push(rawTo.includes('T') ? to : `${rawTo.slice(0, 10)}T23:59:59.999Z`);
      where.push(`(n.published_at IS NULL OR n.published_at <= $${params.length}::timestamptz)`);
    }
    const q = cleanText(options.q).toLowerCase();
    if (q) {
      params.push(`%${q}%`);
      where.push(`(
        lower(COALESCE(n.payload->>'titleOriginal', '')) LIKE $${params.length}
        OR lower(COALESCE(n.payload->>'summaryOriginal', '')) LIKE $${params.length}
        OR lower(COALESCE(n.source_name, '')) LIKE $${params.length}
      )`);
    }
    const tag = cleanText(options.tag).toLowerCase();
    if (tag) {
      params.push(tag);
      where.push(`EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(n.payload->'hashtags', '[]'::jsonb)) AS h(value)
        WHERE lower(COALESCE(h.value->>'label', '')) = $${params.length}
      )`);
    }
    const flash = ['1', 'true', 'yes'].includes(cleanText(options.flash).toLowerCase());
    if (flash) {
      where.push(`(
        n.published_at >= now() - interval '18 minutes'
        OR n.category IN ('breaking', 'flash', 'hot')
        OR COALESCE(n.payload->>'titleOriginal', n.payload->>'title', '') ~* 'breaking|flash|속보|긴급|urgent|live\\s*:|market\\s*alert|just\\s*in|developing|exclusive:'
      )`);
    }
    params.push(limit + 1, offset);
    const sql = `
      SELECT n.payload, t.payload AS translation_payload
      FROM news_items n
      LEFT JOIN news_translations t ON t.news_item_id = n.id AND t.locale = $1
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY n.published_at DESC NULLS LAST, n.position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const result = await queryPostgres(sql, params);
    const rows = result.rows.map((row) => {
      const item = payloadFromRow(row);
      const translation = payloadFromRow({ payload: row.translation_payload });
      if (!item) return null;
      return publicNews(displayNews(item, translation ? [translation] : [], locale));
    }).filter(Boolean);
    const pageRows = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    return {
      rows: pageRows,
      total: offset + pageRows.length + (hasMore ? 1 : 0),
      limit,
      offset,
      hasMore,
      nextOffset: hasMore ? offset + pageRows.length : null,
    };
  });
}

export async function queryPublicNewsSources(options = {}) {
  return cachedPublicRead('publicNewsSources', options, async () => {
    const category = cleanText(options.category);
    const params = [];
    const where = ['enabled = true', 'hidden = false'];
    if (category) {
      params.push(category);
      where.push(`category = $${params.length}`);
    }
    const result = await queryPostgres(
      `
        SELECT payload
        FROM news_sources
        WHERE ${where.join(' AND ')}
        ORDER BY COALESCE(name, source_key), position ASC
      `,
      params,
    );
    return result.rows
      .map(payloadFromRow)
      .filter(Boolean)
      .map((source) => ({
        id: source.id,
        name: source.name || source.id,
        category: source.category || 'global',
        enabled: source.enabled !== false,
      }));
  }, 30000);
}

export async function queryAdminNews(options = {}) {
  const { limit, offset } = pageOptions(options, 30);
  const locale = cleanText(options.locale) || 'ko';
  const params = [locale];
  const where = [];
  const category = cleanText(options.category);
  if (category) {
    if (category === 'global') {
      where.push(`(n.category = 'global' OR n.provider = 'financialjuice')`);
    } else {
      params.push(category);
      where.push(`n.category = $${params.length}`);
    }
  }
  const symbols = new Set([
    ...sqlStringList(options.symbols).map((s) => s.toUpperCase()),
    ...(cleanText(options.symbol) ? [cleanText(options.symbol).toUpperCase()] : []),
  ]);
  if (symbols.size > 0) {
    params.push([...symbols]);
    where.push(`COALESCE(n.payload->'symbols', '[]'::jsonb) ?| $${params.length}::text[]`);
  }
  const sources = sqlStringList(options.sources || options.source);
  if (sources.length > 0) {
    params.push(sources);
    where.push(`n.source_name = ANY($${params.length}::text[])`);
  }
  const from = sqlDateOrTimestamp(options.from);
  if (from) {
    params.push(from);
    where.push(`(n.published_at IS NULL OR n.published_at >= $${params.length}::timestamptz)`);
  }
  const rawTo = cleanText(options.to);
  const to = sqlDateOrTimestamp(rawTo);
  if (to) {
    params.push(rawTo.includes('T') ? to : `${rawTo.slice(0, 10)}T23:59:59.999Z`);
    where.push(`(n.published_at IS NULL OR n.published_at <= $${params.length}::timestamptz)`);
  }
  const q = cleanText(options.q).toLowerCase();
  if (q) {
    params.push(`%${q}%`);
    where.push(`(
      lower(COALESCE(n.payload->>'titleOriginal', '')) LIKE $${params.length}
      OR lower(COALESCE(n.payload->>'summaryOriginal', '')) LIKE $${params.length}
      OR lower(COALESCE(n.source_name, '')) LIKE $${params.length}
    )`);
  }
  const tag = cleanText(options.tag).toLowerCase();
  if (tag) {
    params.push(tag);
    where.push(`EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(n.payload->'hashtags', '[]'::jsonb)) AS h(value)
      WHERE lower(COALESCE(h.value->>'label', '')) = $${params.length}
    )`);
  }
  const flash = ['1', 'true', 'yes'].includes(cleanText(options.flash).toLowerCase());
  if (flash) {
    where.push(`(
      n.published_at >= now() - interval '18 minutes'
      OR n.category IN ('breaking', 'flash', 'hot')
      OR COALESCE(n.payload->>'titleOriginal', n.payload->>'title', '') ~* 'breaking|flash|속보|긴급|urgent|live\\s*:|market\\s*alert|just\\s*in|developing|exclusive:'
    )`);
  }
  const translationStatus = cleanText(options.translationStatus);
  if (translationStatus === 'missing') {
    where.push(`(t_locale.id IS NULL OR t_locale.status NOT IN ('completed', 'manual') OR t_locale.payload->>'provider' = 'mock')`);
  } else if (translationStatus) {
    params.push(translationStatus);
    where.push(`t_locale.status = $${params.length}`);
  }
  params.push(limit + 1, offset);
  const result = await queryPostgres(
    `
      SELECT
        n.payload,
        COALESCE(jsonb_agg(t_all.payload ORDER BY t_all.locale) FILTER (WHERE t_all.id IS NOT NULL), '[]'::jsonb) AS translations_payload
      FROM news_items n
      LEFT JOIN news_translations t_locale ON t_locale.news_item_id = n.id AND t_locale.locale = $1
      LEFT JOIN news_translations t_all ON t_all.news_item_id = n.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY n.id, n.payload, n.published_at, n.position
      ORDER BY n.published_at DESC NULLS LAST, n.position ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows
    .slice(0, limit)
    .map((row) => {
      const item = payloadFromRow(row);
      if (!item) return null;
      const translations = Array.isArray(row.translations_payload) ? row.translations_payload : [];
      return {
        ...displayNews(item, translations, locale),
        hashtagSource: String(item.hashtagSource || 'auto') === 'manual' ? 'manual' : 'auto',
        hashtagUpdatedAt: item.hashtagsUpdatedAt || null,
        translations: translations.map((t) => ({
          ...t,
          title: cleanNewsTitleForDisplay(item, t.title),
          summary: cleanTranslationText(t.summary),
          content: cleanTranslationText(t.content),
          status: hasUsableTranslation(t, item) ? t.status : 'missing',
        })),
      };
    })
    .filter(Boolean);
  const hasMore = result.rows.length > limit;
  return {
    rows,
    total: offset + rows.length + (hasMore ? 1 : 0),
    limit,
    offset,
    hasMore,
  };
}

export async function queryPublicYoutube(options = {}) {
  return cachedPublicRead('publicYoutube', options, async () => {
    const { limit, offset } = pageOptions(options, 30);
    const params = [];
    const where = [];
    const channel = cleanText(options.channel).toLowerCase();
    if (channel) {
      params.push(`%${channel}%`);
      where.push(`lower(COALESCE(channel, payload->>'channel', '')) LIKE $${params.length}`);
    }
    const handles = sqlStringList(options.channelHandles).map((handle) => handle.toLowerCase());
    if (handles.length > 0) {
      params.push(handles);
      where.push(`lower(COALESCE(payload->>'channelHandle', '')) = ANY($${params.length}::text[])`);
    }
    const q = cleanText(options.q).toLowerCase();
    if (q) {
      params.push(`%${q}%`);
      where.push(`(
        lower(COALESCE(payload->>'title', '')) LIKE $${params.length}
        OR lower(COALESCE(payload->>'description', '')) LIKE $${params.length}
        OR lower(COALESCE(channel, payload->>'channel', '')) LIKE $${params.length}
      )`);
    }
    const sort = cleanText(options.sort) === 'popular' ? 'popular' : 'latest';
    const bucketParams = [...params, sort];
    const bucketWhere = [
      ...where,
      `(payload->>'sortBucket' = $${bucketParams.length} OR COALESCE(payload->'sortBuckets', '[]'::jsonb) ? $${bucketParams.length})`,
    ];
    const bucketExists = await queryPostgres(
      `
        SELECT 1
        FROM youtube_videos
        ${bucketWhere.length ? `WHERE ${bucketWhere.join(' AND ')}` : ''}
        LIMIT 1
      `,
      bucketParams,
    );
    const finalWhere = bucketExists.rows.length > 0 ? bucketWhere : where;
    const finalParams = bucketExists.rows.length > 0 ? bucketParams : [...params];
    finalParams.push(limit + 1, offset);
    const order = sort === 'popular'
      ? `ORDER BY ${numberSqlExpression(`payload->>'viewCount'`)} DESC, published_at DESC NULLS LAST`
      : `ORDER BY published_at DESC NULLS LAST, ${numberSqlExpression(`payload->>'viewCount'`)} DESC`;
    const result = await queryPostgres(
      `
        SELECT payload
        FROM youtube_videos
        ${finalWhere.length ? `WHERE ${finalWhere.join(' AND ')}` : ''}
        ${order}
        LIMIT $${finalParams.length - 1} OFFSET $${finalParams.length}
      `,
      finalParams,
    );
    return paginatedSqlRows(
      result.rows.map((row) => {
        const payload = payloadFromRow(row);
        return { ...row, item: payload ? publicYoutube(payload) : null };
      }),
      { limit, offset },
    );
  });
}

export async function queryPublicYoutubeChannels() {
  return cachedPublicRead('publicYoutubeChannels', {}, async () => {
    const settingsResult = await queryPostgres(`SELECT payload FROM app_settings WHERE id = 'app'`);
    const appSettings = payloadFromRow(settingsResult.rows[0]) || {};
    const handles = new Set(listActiveYoutubeChannelHandles(appSettings).map((handle) => handle.toLowerCase()));
    const channels = new Map();
    const result = await queryPostgres(
      `
        SELECT payload
        FROM youtube_videos
        ORDER BY published_at DESC NULLS LAST
        LIMIT 500
      `,
    );
    for (const item of result.rows.map(payloadFromRow).filter(Boolean)) {
      const handle = cleanText(item.channelHandle).toLowerCase();
      if (handles.size > 0 && handle && !handles.has(handle)) continue;
      const key = handle || cleanText(item.channelId) || cleanText(item.channel);
      if (!key || channels.has(key)) continue;
      channels.set(key, {
        id: key,
        handle: item.channelHandle || '',
        channelId: item.channelId || '',
        title: item.channel || item.channelHandle || key,
      });
    }
    return [...channels.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, 30000);
}

export async function queryPublicMarketQuotes(options = {}) {
  return cachedPublicRead('publicMarketQuotes', options, async () => {
    const { limit, offset } = pageOptions(options, 30);
    const params = [];
    const where = [];
    const segment = cleanText(options.segment);
    if (segment) {
      params.push(segment);
      where.push(`segment = $${params.length}`);
    }
    const symbols = sqlStringList(options.symbols).map((s) => s.toUpperCase());
    if (symbols.length > 0) {
      params.push(symbols);
      where.push(`(
        upper(COALESCE(symbol, '')) = ANY($${params.length}::text[])
        OR upper(COALESCE(payload->>'displaySymbol', '')) = ANY($${params.length}::text[])
        OR upper(COALESCE(payload->>'krxSymbol', '')) = ANY($${params.length}::text[])
        OR upper(COALESCE(payload->>'providerItemId', '')) = ANY($${params.length}::text[])
        OR upper(COALESCE(payload->'regularSession'->>'yahooSymbol', '')) = ANY($${params.length}::text[])
      )`);
    }
    const q = cleanText(options.q).toLowerCase();
    if (q) {
      params.push(`%${q}%`);
      where.push(`(
        lower(COALESCE(symbol, '')) LIKE $${params.length}
        OR lower(COALESCE(payload->>'name', '')) LIKE $${params.length}
        OR lower(COALESCE(segment, '')) LIKE $${params.length}
      )`);
    }
    const sqlLimit = symbols.length > 0 && !segment ? Math.max(limit + 1, symbols.length * 3) : limit + 1;
    params.push(sqlLimit, offset);
    const result = await queryPostgres(
      `
        SELECT payload
        FROM market_quotes
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY fetched_at DESC NULLS LAST, COALESCE(segment, ''), COALESCE(symbol, '')
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params,
    );
    let rows = result.rows.map((row) => publicMarketQuote(payloadFromRow(row))).filter(Boolean);
    if (symbols.length > 0 && !segment) {
      const bestBySymbol = new Map();
      for (const row of rows) {
        const key = cleanText(row.krxSymbol || row.symbol).toUpperCase();
        if (!key) continue;
        const prev = bestBySymbol.get(key);
        const prevAt = prev?.fetchedAt ? Date.parse(prev.fetchedAt) : 0;
        const nextAt = row?.fetchedAt ? Date.parse(row.fetchedAt) : 0;
        if (!prev || nextAt >= prevAt) bestBySymbol.set(key, row);
      }
      rows = [...bestBySymbol.values()];
    }
    const pageRows = rows.slice(0, limit);
    const hasMore = symbols.length > 0 && !segment ? false : rows.length > limit;
    const total = offset + pageRows.length + (hasMore ? 1 : 0);
    return {
      rows: pageRows,
      total,
      limit,
      offset,
      hasMore,
      nextOffset: hasMore ? offset + pageRows.length : null,
    };
  }, 3000);
}

export async function queryPublicCoinMarkets(options = {}) {
  return cachedPublicRead('publicCoinMarkets', options, async () => {
    const { limit, offset } = pageOptions(options, 30);
    const params = [];
    const where = [];
    const q = cleanText(options.q).toLowerCase();
    if (q) {
      params.push(`%${q}%`);
      where.push(`(
        lower(COALESCE(symbol, '')) LIKE $${params.length}
        OR lower(COALESCE(payload->>'name', '')) LIKE $${params.length}
        OR lower(COALESCE(payload->>'providerItemId', '')) LIKE $${params.length}
      )`);
    }
    params.push(limit + 1, offset);
    const result = await queryPostgres(
      `
        SELECT payload
        FROM coin_markets
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ${numberSqlExpression(`payload->>'marketCap'`)} DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params,
    );
    return paginatedSqlRows(
      result.rows.map((row) => {
        const payload = payloadFromRow(row);
        return { ...row, item: payload ? publicCoinMarket(payload) : null };
      }),
      { limit, offset },
    );
  }, 10000);
}

export async function queryPublicCalendar(options = {}) {
  return cachedPublicRead('publicCalendar', options, async () => {
    const limit = cleanText(options.limit) ? safeLimit(options.limit, 200, 1000) : 200;
    const offset = safeOffset(options.offset);
    const params = [];
    const where = [];
    const from = cleanText(options.from);
    if (from) {
      params.push(from);
      where.push(`(event_date IS NULL OR event_date >= $${params.length}::date)`);
    }
    const to = cleanText(options.to);
    if (to) {
      params.push(to);
      where.push(`(event_date IS NULL OR event_date <= $${params.length}::date)`);
    }
    const type = cleanText(options.type);
    if (type) {
      params.push(type);
      where.push(`event_type = $${params.length}`);
    }
    const symbol = cleanText(options.symbol).toUpperCase();
    if (symbol) {
      params.push(symbol);
      where.push(`(upper(COALESCE(symbol, '')) = $${params.length} OR upper(COALESCE(payload->>'title', '')) LIKE '%' || $${params.length} || '%')`);
    }
    const q = cleanText(options.q).toLowerCase();
    if (q) {
      params.push(`%${q}%`);
      where.push(`(
        lower(COALESCE(payload->>'title', '')) LIKE $${params.length}
        OR lower(COALESCE(payload->>'country', '')) LIKE $${params.length}
        OR lower(COALESCE(symbol, '')) LIKE $${params.length}
        OR lower(COALESCE(event_type, '')) LIKE $${params.length}
      )`);
    }
    params.push(limit, offset);
    const result = await queryPostgres(
      `
        SELECT payload
        FROM calendar_events
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY event_date ASC NULLS LAST, COALESCE(payload->>'title', '')
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params,
    );
    return result.rows.map(payloadFromRow).filter(Boolean).map(publicCalendarEvent);
  }, 30000);
}

export async function queryPublicCalendarDateSummaries(options = {}) {
  return cachedPublicRead('publicCalendarDateSummaries', options, async () => {
    const params = [];
    const where = ['event_date IS NOT NULL'];
    const from = cleanText(options.from);
    if (from) {
      params.push(from);
      where.push(`event_date >= $${params.length}::date`);
    }
    const to = cleanText(options.to);
    if (to) {
      params.push(to);
      where.push(`event_date <= $${params.length}::date`);
    }
    const type = cleanText(options.type);
    if (type) {
      params.push(type);
      where.push(`event_type = $${params.length}`);
    }
    const result = await queryPostgres(
      `
        SELECT event_date::text AS date, COALESCE(event_type, 'unknown') AS type, COUNT(*)::int AS count
        FROM calendar_events
        WHERE ${where.join(' AND ')}
        GROUP BY event_date, COALESCE(event_type, 'unknown')
        ORDER BY event_date ASC
      `,
      params,
    );
    const byDate = new Map();
    for (const row of result.rows) {
      const date = cleanText(row.date).slice(0, 10);
      if (!date) continue;
      const prev = byDate.get(date) || { date, total: 0, counts: {} };
      const count = Number(row.count) || 0;
      prev.total += count;
      prev.counts[row.type || 'unknown'] = count;
      byDate.set(date, prev);
    }
    return [...byDate.values()];
  }, 30000);
}

export async function queryPublicConcalls(options = {}) {
  return cachedPublicRead('publicConcalls', options, async () => {
    const { limit, offset } = pageOptions(options, 30);
    const params = [];
    const where = [];
    const symbol = cleanText(options.symbol).toUpperCase();
    if (symbol) {
      params.push(symbol);
      where.push(`upper(symbol) = $${params.length}`);
    }
    const year = cleanText(options.year || options.fiscalYear);
    if (year) {
      params.push(Number(year));
      where.push(`fiscal_year = $${params.length}`);
    }
    const quarter = cleanText(options.quarter || options.fiscalQuarter);
    if (quarter) {
      params.push(Number(quarter));
      where.push(`fiscal_quarter = $${params.length}`);
    }
    const from = cleanText(options.from);
    if (from) {
      params.push(from);
      where.push(`(earnings_date IS NULL OR earnings_date >= $${params.length}::date)`);
    }
    const to = cleanText(options.to);
    if (to) {
      params.push(to);
      where.push(`(earnings_date IS NULL OR earnings_date <= $${params.length}::date)`);
    }
    const q = cleanText(options.q).toLowerCase();
    if (q) {
      params.push(`%${q}%`);
      where.push(`(
        lower(COALESCE(symbol, '')) LIKE $${params.length}
        OR lower(COALESCE(payload->>'title', '')) LIKE $${params.length}
        OR lower(COALESCE(payload->>'summaryProvider', '')) LIKE $${params.length}
        OR lower(COALESCE(payload->>'provider', '')) LIKE $${params.length}
      )`);
    }
    params.push(limit + 1, offset);
    const result = await queryPostgres(
      `
        SELECT payload
        FROM concall_transcripts
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY earnings_date DESC NULLS LAST, symbol ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params,
    );
    const includeTranscript = cleanText(options.includeTranscript) === '1';
    return paginatedSqlRows(
      result.rows.map((row) => {
        const item = payloadFromRow(row);
        if (!item) return { item: null };
        if (includeTranscript) return { item: publicConcall(item) };
        const { transcript, rawPayload, ...rest } = item;
        return { item: publicConcall(rest) };
      }),
      { limit, offset },
    );
  }, 10000);
}

export async function readPublicMarketLists() {
  return cachedPublicRead('publicMarketLists', {}, async () => {
    const result = await queryPostgres('SELECT payload FROM market_lists ORDER BY position ASC');
    return result.rows.map(payloadFromRow).filter(Boolean);
  }, 30000);
}

export async function readPublicMarketList(key) {
  return cachedPublicRead('publicMarketList', { key }, async () => {
    const result = await queryPostgres('SELECT payload FROM market_lists WHERE list_key = $1', [cleanText(key)]);
    return payloadFromRow(result.rows[0]);
  }, 30000);
}

export async function readAppSettings() {
  return cachedPublicRead('appSettings', {}, async () => {
    const result = await queryPostgres(`SELECT payload FROM app_settings WHERE id = 'app'`);
    return payloadFromRow(result.rows[0]) || {};
  }, 5000);
}

export async function upsertMarketQuotes(rows = []) {
  return updateDb((db) => {
    for (const row of rows || []) upsertById(db.marketQuotes, row);
    return rows;
  });
}

function barsForSeries(series) {
  return Array.isArray(series?.bars) ? series.bars : [];
}

export async function queryPublicPriceSeriesCandles(options = {}) {
  return cachedPublicRead('publicPriceSeriesCandles', options, async () => {
    const symbol = cleanText(options.symbol).toUpperCase();
    if (!symbol) return null;
    const result = await queryPostgres(
      `
        SELECT payload
        FROM price_series
        WHERE upper(COALESCE(symbol, '')) = $1
           OR upper(COALESCE(display_symbol, '')) = $1
           OR upper(COALESCE(yahoo_symbol, '')) = $1
           OR upper(COALESCE(payload->>'krxSymbol', '')) = $1
           OR upper(COALESCE(payload->>'displaySymbol', '')) = $1
           OR upper(COALESCE(payload->>'yahooSymbol', '')) = $1
        ORDER BY last_bar_date DESC NULLS LAST, fetched_at DESC NULLS LAST
        LIMIT 1
      `,
      [symbol],
    );
    const series = payloadFromRow(result.rows[0]);
    if (!series) return null;
    const from = Number(options.from) * 1000;
    const to = Number(options.to) * 1000;
    const bars = barsForSeries(series).filter((bar) => {
      const t = Date.parse(`${bar.date}T00:00:00.000Z`);
      if (!Number.isFinite(t)) return false;
      return (!Number.isFinite(from) || t >= from) && (!Number.isFinite(to) || t <= to);
    });
    if (bars.length === 0) return null;
    return {
      s: 'ok',
      t: bars.map((bar) => Math.floor(Date.parse(`${bar.date}T00:00:00.000Z`) / 1000)),
      o: bars.map((bar) => Number(bar.open ?? bar.close)),
      h: bars.map((bar) => Number(bar.high ?? bar.close)),
      l: bars.map((bar) => Number(bar.low ?? bar.close)),
      c: bars.map((bar) => Number(bar.close)),
      v: bars.map((bar) => Number(bar.volume) || 0),
    };
  }, 30000);
}

export async function queryPublicPriceSeriesSparklines(options = {}) {
  return cachedPublicRead('publicPriceSeriesSparklines', options, async () => {
    const symbols = cleanText(options.symbols)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const days = safeLimit(options.days, 30, 365);
    if (symbols.length === 0) return [];
    const result = await queryPostgres(
      `
        SELECT payload
        FROM price_series
        WHERE upper(COALESCE(symbol, '')) = ANY($1::text[])
           OR upper(COALESCE(display_symbol, '')) = ANY($1::text[])
           OR upper(COALESCE(yahoo_symbol, '')) = ANY($1::text[])
           OR upper(COALESCE(payload->>'krxSymbol', '')) = ANY($1::text[])
           OR upper(COALESCE(payload->>'displaySymbol', '')) = ANY($1::text[])
           OR upper(COALESCE(payload->>'yahooSymbol', '')) = ANY($1::text[])
        ORDER BY last_bar_date DESC NULLS LAST, fetched_at DESC NULLS LAST
      `,
      [symbols],
    );
    const bySymbol = new Map();
    for (const series of result.rows.map(payloadFromRow).filter(Boolean)) {
      const aliases = [
        series.symbol,
        series.displaySymbol,
        series.yahooSymbol,
        series.krxSymbol,
        series.rawPayload?.krxSymbol,
        series.rawPayload?.displaySymbol,
        series.rawPayload?.yahooSymbol,
      ];
      for (const alias of aliases) {
        const key = cleanText(alias).toUpperCase();
        if (key && !bySymbol.has(key)) bySymbol.set(key, series);
      }
    }
    return symbols
      .map((symbol) => {
        const series = bySymbol.get(symbol);
        const bars = barsForSeries(series).slice(-days);
        return {
          symbol,
          displaySymbol: series?.displaySymbol || symbol,
          points: bars.map((bar) => ({ date: bar.date, close: Number(bar.close) })),
          fetchedAt: series?.fetchedAt || null,
        };
      })
      .filter((row) => row.points.length > 0);
  }, 30000);
}

export async function queryPublicQuantSignals(options = {}) {
  return cachedPublicRead('publicQuantSignals', options, async () => {
    const requested = new Set(
      cleanText(options.symbols)
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    );
    const params = [];
    const where = [];
    if (requested.size > 0) {
      params.push([...requested]);
      where.push(`upper(symbol) = ANY($${params.length}::text[])`);
    }
    params.push(safeLimit(options.limit, 50, 100));
    const seriesResult = await queryPostgres(
      `
        SELECT payload
        FROM price_series
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY position ASC
        LIMIT $${params.length}
      `,
      params,
    );
    const seriesRows = seriesResult.rows.map(payloadFromRow).filter(Boolean);
    const quoteSymbols = seriesRows.map((series) => cleanText(series.symbol).toUpperCase()).filter(Boolean);
    const quoteResult = quoteSymbols.length > 0
      ? await queryPostgres(
          `SELECT payload FROM market_quotes WHERE upper(COALESCE(payload->>'krxSymbol', symbol, '')) = ANY($1::text[])`,
          [quoteSymbols],
        )
      : { rows: [] };
    const quotesBySymbol = new Map(
      quoteResult.rows
        .map(payloadFromRow)
        .filter(Boolean)
        .map((q) => [cleanText(q.krxSymbol || q.symbol).toUpperCase(), q]),
    );
    const rows = [];
    for (const series of seriesRows) {
      const symbol = cleanText(series.symbol).toUpperCase();
      if (requested.size > 0 && !requested.has(symbol)) continue;
      const signal = buildQuantSignal({
        instrument: series,
        bars: barsForSeries(series),
        liveQuote: quotesBySymbol.get(symbol) || null,
      });
      if (signal) rows.push(signal);
    }
    rows.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    const limit = cleanText(options.limit) ? safeLimit(options.limit, 10, 100) : rows.length;
    return rows.slice(0, limit);
  }, 15000);
}

export async function queryPublicQuantBacktest(options = {}) {
  return cachedPublicRead('publicQuantBacktest', options, async () => {
    const symbols = new Set(
      cleanText(options.symbols)
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    );
    const params = [];
    const where = [];
    if (symbols.size > 0) {
      params.push([...symbols]);
      where.push(`upper(symbol) = ANY($${params.length}::text[])`);
    }
    const result = await queryPostgres(
      `
        SELECT payload
        FROM price_series
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY position ASC
        LIMIT 50
      `,
      params,
    );
    const rows = result.rows
      .map(payloadFromRow)
      .filter(Boolean)
      .slice(0, 50)
      .map((series) =>
        backtestInstrument({
          instrument: series,
          bars: barsForSeries(series),
          horizon: Number(options.horizon) || 20,
          warmup: Number(options.warmup) || 80,
          step: Number(options.step) || 1,
        }),
      )
      .filter(Boolean);
    return { rows, summary: aggregateBacktests(rows) };
  }, 60000);
}

export async function queryPublicQuantSignalHistory(options = {}) {
  return cachedPublicRead('publicQuantSignalHistory', options, async () => {
    const { limit, offset } = pageOptions(options, 60);
    const params = [];
    const where = [];
    const symbol = cleanText(options.symbol).toUpperCase();
    if (symbol) {
      params.push(symbol);
      where.push(`upper(symbol) = $${params.length}`);
    }
    if (options.from) {
      params.push(cleanText(options.from));
      where.push(`generated_date >= $${params.length}::date`);
    }
    if (options.to) {
      params.push(cleanText(options.to));
      where.push(`generated_date <= $${params.length}::date`);
    }
    params.push(limit + 1, offset);
    const result = await queryPostgres(
      `
        SELECT payload
        FROM quant_signal_items
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY generated_at DESC NULLS LAST, generated_date DESC NULLS LAST
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
      params,
    );
    return paginatedSqlRows(
      result.rows.map((row) => ({ ...row, item: payloadFromRow(row) })),
      { limit, offset },
    );
  }, 15000);
}

export async function queryPublicWatchSignals(options = {}) {
  return cachedPublicRead('publicWatchSignals', options, async () => {
    const symbols = cleanText(options.symbols)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const [quotePage, newsPage, quantRows] = await Promise.all([
      queryPublicMarketQuotes({ symbols: symbols.join(','), limit: '100' }),
      queryPublicNews({
        symbols: symbols.join(','),
        limit: '100',
        date: cleanText(options.date),
        from: cleanText(options.from),
      }),
      queryPublicQuantSignals({ symbols: symbols.join(','), limit: '100' }),
    ]);
    return symbols.map((symbol) => {
      const quote = quotePage.rows.find((row) =>
        [row.symbol, row.displaySymbol, row.krxSymbol].some((value) => cleanText(value).toUpperCase() === symbol),
      );
      const news = newsPage.rows.filter((row) => (row.symbols || []).map((s) => cleanText(s).toUpperCase()).includes(symbol));
      const quant = quantRows.find((row) => cleanText(row.symbol).toUpperCase() === symbol);
      const score = Math.max(Math.abs(Number(quote?.changePercent) || 0) * 8, Number(quant?.score) || 0, news.length * 8);
      const reasonCodes = [];
      if (Math.abs(Number(quote?.changePercent) || 0) >= 3) reasonCodes.push('price_move');
      if (news.length > 0) reasonCodes.push('news_active');
      if (quant) reasonCodes.push('quant_signal');
      return {
        symbol,
        quote: quote || null,
        quant: quant || null,
        news: news.slice(0, 3),
        title: quote?.displaySymbol || quote?.symbol || symbol,
        summary: news[0]?.title || quant?.summary || '',
        reasonCodes,
        counts: {
          news: news.length,
          youtube: 0,
          insights: quant ? 1 : 0,
        },
        nextEvent: null,
        sourceRefs: news.slice(0, 3).map((item) => ({
          type: 'news',
          id: item.id,
          title: item.title,
          sourceName: item.sourceName,
          url: item.sourceUrl,
          publishedAt: item.publishedAt,
        })),
        score: Math.round(score),
        level: score >= 70 ? 'hot' : score >= 35 ? 'watch' : 'quiet',
      };
    });
  }, 5000);
}

export async function queryInsightItems(options = {}) {
  return cachedPublicRead('insights', options, async () => {
    const limit = safeLimit(options.limit, 20, 100);
    const params = [];
    const where = [];
    const kind = cleanText(options.kind);
    const displayKey = cleanText(options.displayKey);
    const level = cleanText(options.level);
    const from = cleanText(options.from);
    const to = cleanText(options.to);
    const date = cleanText(options.date);
    if (kind) {
      params.push(kind);
      where.push(`kind = $${params.length}`);
    }
    if (level) {
      params.push(level);
      where.push(`level = $${params.length}`);
    }
    if (displayKey) {
      params.push(displayKey);
      where.push(`display_key = $${params.length}`);
    }
    if (date) {
      params.push(date);
      where.push(`generated_date = $${params.length}::date`);
    }
    if (from) {
      params.push(from);
      where.push(`generated_date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      where.push(`generated_date <= $${params.length}::date`);
    }
    if (options.pushOnly) where.push(`push_candidate = true`);
    if (!options.includeExpired) {
      where.push(`(expires_at IS NULL OR expires_at >= now())`);
    }
    params.push(limit);
    const result = await queryPostgres(
      `
        SELECT payload
        FROM insight_items
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY generated_at DESC NULLS LAST, position ASC
        LIMIT $${params.length}
      `,
      params,
    );
    return result.rows.map(payloadFromRow).filter(Boolean);
  }, 10000);
}

export async function listDuePollingJobs(now = Date.now()) {
  await ensureSeeded();
  const result = await queryPostgres(
    `
      SELECT payload
      FROM polling_jobs
      WHERE enabled = true AND (next_run_at IS NULL OR next_run_at <= to_timestamp($1 / 1000.0))
      ORDER BY COALESCE(next_run_at, TIMESTAMPTZ '1970-01-01') ASC, position ASC
    `,
    [Number(now) || Date.now()],
  );
  return result.rows.map(payloadFromRow).filter(Boolean);
}

export async function getPollingJob(jobKey) {
  await ensureSeeded();
  const result = await queryPostgres('SELECT payload FROM polling_jobs WHERE job_key = $1', [cleanText(jobKey)]);
  return payloadFromRow(result.rows[0]);
}

function publicJobLock(row) {
  if (!row) return null;
  return {
    jobKey: row.job_key,
    token: row.lock_token,
    lockedAt: row.locked_at ? new Date(row.locked_at).toISOString() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  };
}

export async function listPollingJobLocks() {
  await ensureSeeded();
  const result = await queryPostgres('SELECT * FROM polling_job_locks ORDER BY locked_at DESC');
  return result.rows.map(publicJobLock);
}

export async function getPollingJobLock(jobKey) {
  await ensureSeeded();
  const result = await queryPostgres('SELECT * FROM polling_job_locks WHERE job_key = $1', [cleanText(jobKey)]);
  return publicJobLock(result.rows[0]);
}

export async function acquirePollingJobLock(jobKey, { ttlMs = 2 * 60 * 60 * 1000 } = {}) {
  await ensureSeeded();
  return withDbExclusive(async () =>
    withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        const key = cleanText(jobKey);
        const now = nowIso();
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + Math.max(60_000, Number(ttlMs) || ttlMs)).toISOString();
        const existing = await client.query('SELECT * FROM polling_job_locks WHERE job_key = $1 FOR UPDATE', [key]);
        const row = existing.rows[0];
        if (row && new Date(row.expires_at).getTime() > Date.now()) {
          await client.query('COMMIT');
          return { acquired: false, lock: publicJobLock(row) };
        }
        await client.query(
          `
            INSERT INTO polling_job_locks (job_key, lock_token, locked_at, expires_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT(job_key) DO UPDATE SET
              lock_token = excluded.lock_token,
              locked_at = excluded.locked_at,
              expires_at = excluded.expires_at
          `,
          [key, token, now, expiresAt],
        );
        await client.query('COMMIT');
        return { acquired: true, lock: { jobKey: key, token, lockedAt: now, expiresAt } };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
  );
}

export async function releasePollingJobLock(jobKey, token) {
  await ensureSeeded();
  const result = await queryPostgres('DELETE FROM polling_job_locks WHERE job_key = $1 AND lock_token = $2', [
    cleanText(jobKey),
    cleanText(token),
  ]);
  return Number(result.rowCount) > 0;
}

function publicAdminUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    active: parseBool(row.active),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export async function verifyAdminLogin(loginId, password) {
  await ensureSeeded();
  const id = cleanText(loginId);
  if (!id || !password) return null;
  const result = await queryPostgres('SELECT * FROM admin_users WHERE id = $1', [id]);
  const row = result.rows[0];
  if (!row || row.active !== true) return null;
  return verifyPassword(password, row) ? { id: row.id } : null;
}

export async function hasAdminUsers() {
  await ensureSeeded();
  const result = await queryPostgres('SELECT COUNT(*)::int AS count FROM admin_users WHERE active = true');
  return Number(result.rows[0]?.count) > 0;
}

export async function listAdminUsers() {
  await ensureSeeded();
  const result = await queryPostgres('SELECT * FROM admin_users ORDER BY lower(id)');
  return result.rows.map(publicAdminUser);
}

export async function createAdminUser({ id, password, active = true }) {
  const userId = cleanText(id);
  if (!userId) throw new Error('ADMIN_USER_ID_REQUIRED');
  if (!password) throw new Error('ADMIN_USER_PASSWORD_REQUIRED');
  const { hash, salt } = hashPassword(password);
  const now = nowIso();
  try {
    await queryPostgres(
      `
        INSERT INTO admin_users (id, password_hash, password_salt, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $5)
      `,
      [userId, hash, salt, active !== false, now],
    );
  } catch (error) {
    if (String(error?.code) === '23505') throw new Error('ADMIN_USER_EXISTS');
    throw error;
  }
  return { id: userId, active: active !== false, createdAt: now, updatedAt: now };
}

async function activeAdminCount(client = null) {
  const runner = client || { query: queryPostgres };
  const result = await runner.query('SELECT COUNT(*)::int AS count FROM admin_users WHERE active = true');
  return Number(result.rows[0]?.count) || 0;
}

export async function updateAdminUser(id, patch = {}) {
  const userId = cleanText(id);
  if (!userId) throw new Error('ADMIN_USER_ID_REQUIRED');
  return withPostgresClient(async (client) => {
    await client.query('BEGIN');
    try {
      const existing = await client.query('SELECT * FROM admin_users WHERE id = $1 FOR UPDATE', [userId]);
      if (!existing.rows[0]) throw new Error('ADMIN_USER_NOT_FOUND');
      if (typeof patch.active === 'boolean' && existing.rows[0].active === true && patch.active === false && (await activeAdminCount(client)) <= 1) {
        throw new Error('ADMIN_USER_LAST_ACTIVE');
      }
      const sets = [];
      const params = [];
      if (typeof patch.active === 'boolean') {
        params.push(patch.active);
        sets.push(`active = $${params.length}`);
      }
      if (typeof patch.password === 'string' && patch.password) {
        const { hash, salt } = hashPassword(patch.password);
        params.push(hash);
        sets.push(`password_hash = $${params.length}`);
        params.push(salt);
        sets.push(`password_salt = $${params.length}`);
      }
      if (sets.length > 0) {
        params.push(nowIso());
        sets.push(`updated_at = $${params.length}`);
        params.push(userId);
        await client.query(`UPDATE admin_users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
      }
      const next = await client.query('SELECT * FROM admin_users WHERE id = $1', [userId]);
      await client.query('COMMIT');
      return publicAdminUser(next.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function deleteAdminUser(id) {
  const userId = cleanText(id);
  if (!userId) throw new Error('ADMIN_USER_ID_REQUIRED');
  return withPostgresClient(async (client) => {
    await client.query('BEGIN');
    try {
      const existing = await client.query('SELECT * FROM admin_users WHERE id = $1 FOR UPDATE', [userId]);
      if (!existing.rows[0]) throw new Error('ADMIN_USER_NOT_FOUND');
      if (existing.rows[0].active === true && (await activeAdminCount(client)) <= 1) throw new Error('ADMIN_USER_LAST_ACTIVE');
      await client.query('DELETE FROM admin_users WHERE id = $1', [userId]);
      await client.query('COMMIT');
      return { id: userId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    profileImageUrl: row.profile_image_url || '',
    authProvider: row.auth_provider || 'password',
    hasPassword: Boolean(row.password_hash && row.password_salt),
    active: row.active === true,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function publicIdentity(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    email: row.email || '',
    displayName: row.display_name || '',
    profileImageUrl: row.profile_image_url || '',
    linkedAt: row.linked_at ? new Date(row.linked_at).toISOString() : row.created_at ? new Date(row.created_at).toISOString() : null,
    disconnectedAt: row.disconnected_at ? new Date(row.disconnected_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function publicDevice(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform || '',
    pushToken: row.push_token || '',
    deviceName: row.device_name || '',
    active: row.active === true,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function publicAccountEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    actorType: row.actor_type || 'user',
    actorId: row.actor_id || '',
    identityId: row.identity_id || '',
    provider: row.provider || '',
    providerUserIdHash: row.provider_user_id_hash || '',
    payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

async function insertAccountEvent(client, event) {
  const userId = cleanText(event.userId);
  const eventType = cleanText(event.eventType);
  if (!userId || !eventType) return null;
  const id = crypto.randomUUID();
  const createdAt = event.createdAt || nowIso();
  await client.query(
    `
      INSERT INTO app_user_account_events (
        id, user_id, event_type, actor_type, actor_id, identity_id, provider,
        provider_user_id_hash, payload, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
    `,
    [
      id,
      userId,
      eventType,
      cleanText(event.actorType) || 'user',
      textOrNull(event.actorId),
      textOrNull(event.identityId),
      textOrNull(event.provider)?.toLowerCase() || null,
      hashProviderUserId(event.provider, event.providerUserId) || null,
      jsonPayload(event.payload && typeof event.payload === 'object' ? event.payload : {}),
      createdAt,
    ],
  );
  const result = await client.query('SELECT * FROM app_user_account_events WHERE id = $1', [id]);
  return publicAccountEvent(result.rows[0]);
}

async function acceptTerms(client, userId, acceptedTerms = [], locale = 'ko') {
  const loc = cleanText(locale).toLowerCase() || 'ko';
  const required = await client.query(
    `
      SELECT DISTINCT ON (type, locale) type, locale, version
      FROM legal_terms
      WHERE active = true AND required = true AND locale = $1
      ORDER BY type, locale, updated_at DESC, version DESC
    `,
    [loc],
  );
  const acceptedSet = new Set(
    (acceptedTerms || []).map((term) => `${cleanText(term.type)}:${cleanText(term.locale || loc)}:${cleanText(term.version)}`),
  );
  for (const row of required.rows) {
    const key = `${row.type}:${row.locale}:${row.version}`;
    if (!acceptedSet.has(key)) throw new Error('APP_USER_TERMS_REQUIRED');
  }
  const now = nowIso();
  for (const row of required.rows) {
    await client.query(
      `
        INSERT INTO app_user_terms_acceptances (id, user_id, term_type, locale, version, accepted_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(user_id, term_type, locale, version) DO NOTHING
      `,
      [crypto.randomUUID(), userId, row.type, row.locale, row.version, now],
    );
  }
}

function validateDeviceId(deviceId) {
  const d = cleanText(deviceId);
  if (d.length < 8 || d.length > 200) return null;
  return d;
}

async function createSession(client, userId, deviceId) {
  if (isAppUserJwtConfigured()) {
    const device = validateDeviceId(deviceId);
    if (!device) throw new Error('APP_USER_DEVICE_ID_REQUIRED');
    const now = nowIso();
    await client.query(
      'UPDATE app_user_refresh_sessions SET revoked_at = $1 WHERE user_id = $2 AND device_id = $3 AND revoked_at IS NULL',
      [now, userId, device],
    );
    const sid = crypto.randomUUID();
    const refreshToken = crypto.randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + config.jwtRefreshTtlDays * 86400000).toISOString();
    await client.query(
      `
        INSERT INTO app_user_refresh_sessions (id, user_id, device_id, refresh_hash, created_at, expires_at, revoked_at)
        VALUES ($1, $2, $3, $4, $5, $6, NULL)
      `,
      [sid, userId, device, tokenHash(refreshToken), now, refreshExpiresAt],
    );
    return {
      accessToken: await signAppUserAccessToken(userId, sid),
      refreshToken,
      accessExpiresAt: new Date(Date.now() + config.jwtAccessTtlSeconds * 1000).toISOString(),
      refreshExpiresAt,
      deviceId: device,
    };
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const now = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await client.query(
    `
      INSERT INTO app_user_sessions (token_hash, user_id, created_at, expires_at, revoked_at)
      VALUES ($1, $2, $3, $4, NULL)
    `,
    [tokenHash(token), userId, now, expiresAt],
  );
  return { accessToken: token, refreshToken: '', accessExpiresAt: expiresAt, refreshExpiresAt: expiresAt, deviceId: validateDeviceId(deviceId) || '' };
}

export async function createAppUser(payload) {
  return withDbExclusive(() =>
    withPostgresClient(async (client) => {
      await seedLegalTermsIfEmpty(client);
      await client.query('BEGIN');
      try {
        const email = normalizeEmail(payload.email);
        const password = String(payload.password || '');
        const nickname = cleanText(payload.nickname);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('APP_USER_EMAIL_INVALID');
        if (password.length < 8) throw new Error('APP_USER_PASSWORD_TOO_SHORT');
        if (nickname.length < 2) throw new Error('APP_USER_NICKNAME_REQUIRED');
        const exists = await client.query('SELECT id, active FROM app_users WHERE email = $1', [email]);
        if (exists.rows[0]?.active === true) throw new Error('APP_USER_EMAIL_EXISTS');
        const { hash, salt } = hashPassword(password);
        const id = crypto.randomUUID();
        const now = nowIso();
        await client.query(
          `
            INSERT INTO app_users (
              id, email, nickname, profile_image_url, password_hash, password_salt,
              auth_provider, active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'password', true, $7, $7)
          `,
          [id, email, nickname, cleanText(payload.profileImageUrl), hash, salt, now],
        );
        await acceptTerms(client, id, payload.acceptedTerms || [], payload.locale || 'ko');
        const row = await client.query('SELECT * FROM app_users WHERE id = $1', [id]);
        const session = await createSession(client, id, payload.deviceId);
        await client.query('COMMIT');
        clearPublicReadCache();
        return { user: publicUser(row.rows[0]), session };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
  );
}

export async function loginAppUser({ email, password, deviceId = '' }) {
  return withDbExclusive(() =>
    withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        const result = await client.query('SELECT * FROM app_users WHERE email = $1', [normalizeEmail(email)]);
        const row = result.rows[0];
        if (!row || row.active !== true || !verifyPassword(password, row)) throw new Error('APP_USER_LOGIN_FAILED');
        const session = await createSession(client, row.id, deviceId);
        await client.query('COMMIT');
        return { user: publicUser(row), session };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
  );
}

function deriveSocialEmail(provider, email, sub) {
  const normalized = normalizeEmail(email);
  if (normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return normalized;
  const safeSub = cleanText(sub).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 96);
  return `${cleanText(provider).toLowerCase()}-${safeSub}@users.signal.local`;
}

function overrideSocialProfile(profile, signupProfile = null) {
  if (!signupProfile || typeof signupProfile !== 'object') return profile;
  const next = { ...profile };
  if (typeof signupProfile.email === 'string' && cleanText(signupProfile.email)) {
    const email = normalizeEmail(signupProfile.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('APP_USER_EMAIL_INVALID');
    next.email = email;
  }
  if (typeof signupProfile.nickname === 'string') {
    const nickname = cleanText(signupProfile.nickname);
    if (nickname.length < 2) throw new Error('APP_USER_NICKNAME_REQUIRED');
    next.displayName = nickname.slice(0, 60);
  }
  if (typeof signupProfile.profileImageUrl === 'string') next.profileImageUrl = cleanText(signupProfile.profileImageUrl);
  return next;
}

export async function loginOrRegisterSocialUser({ provider, profile, deviceId = '', locale = 'ko', acceptedTerms = [], signupProfile = null }) {
  const p = cleanText(provider).toLowerCase();
  const providerUserId = cleanText(profile?.providerUserId || profile?.sub || profile?.id);
  if (!['google', 'apple', 'kakao', 'naver'].includes(p)) throw new Error('APP_USER_SOCIAL_UNSUPPORTED');
  if (!providerUserId) throw new Error('APP_USER_SOCIAL_INVALID_PROFILE');
  const resolvedProfile = overrideSocialProfile(profile, signupProfile);
  return withDbExclusive(() =>
    withPostgresClient(async (client) => {
      await seedLegalTermsIfEmpty(client);
      await client.query('BEGIN');
      try {
        let identity = await client.query(
          'SELECT * FROM app_user_identities WHERE provider = $1 AND provider_user_id = $2 AND disconnected_at IS NULL',
          [p, providerUserId],
        );
        let userId = identity.rows[0]?.user_id || '';
        if (!userId) {
          const email = deriveSocialEmail(p, resolvedProfile.email, providerUserId);
          const existing = await client.query('SELECT * FROM app_users WHERE email = $1 AND active = true', [email]);
          userId = existing.rows[0]?.id || crypto.randomUUID();
          const now = nowIso();
          if (!existing.rows[0]) {
            await client.query(
              `
                INSERT INTO app_users (
                  id, email, nickname, profile_image_url, password_hash, password_salt,
                  auth_provider, active, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, NULL, NULL, $5, true, $6, $6)
              `,
              [
                userId,
                email,
                cleanText(resolvedProfile.displayName) || `${p} user`,
                cleanText(resolvedProfile.profileImageUrl),
                p,
                now,
              ],
            );
            await acceptTerms(client, userId, acceptedTerms, locale);
          }
          const identityId = crypto.randomUUID();
          await client.query(
            `
              INSERT INTO app_user_identities (
                id, user_id, provider, provider_user_id, email, display_name, profile_image_url,
                linked_at, disconnected_at, payload, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9::jsonb, $8, $8)
            `,
            [
              identityId,
              userId,
              p,
              providerUserId,
              textOrNull(resolvedProfile.email),
              textOrNull(resolvedProfile.displayName),
              textOrNull(resolvedProfile.profileImageUrl),
              now,
              jsonPayload(resolvedProfile),
            ],
          );
          await insertAccountEvent(client, {
            userId,
            eventType: 'social_identity_linked',
            provider: p,
            providerUserId,
            identityId,
            payload: { provider: p },
            createdAt: now,
          });
        }
        const user = await client.query('SELECT * FROM app_users WHERE id = $1 AND active = true', [userId]);
        if (!user.rows[0]) throw new Error('APP_USER_LOGIN_FAILED');
        const session = await createSession(client, userId, deviceId);
        await client.query('COMMIT');
        return { user: publicUser(user.rows[0]), session };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
  );
}

export async function linkAppUserSocialIdentity(userId, provider, profile) {
  const p = cleanText(provider).toLowerCase();
  const providerUserId = cleanText(profile?.providerUserId || profile?.sub || profile?.id);
  if (!p || !providerUserId) throw new Error('APP_USER_SOCIAL_INVALID_PROFILE');
  return withDbExclusive(() =>
    withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        const user = await client.query('SELECT * FROM app_users WHERE id = $1 AND active = true', [cleanText(userId)]);
        if (!user.rows[0]) throw new Error('APP_USER_NOT_FOUND');
        const taken = await client.query(
          'SELECT id, user_id FROM app_user_identities WHERE provider = $1 AND provider_user_id = $2 AND disconnected_at IS NULL',
          [p, providerUserId],
        );
        if (taken.rows[0] && taken.rows[0].user_id !== user.rows[0].id) throw new Error('APP_USER_SOCIAL_IDENTITY_TAKEN');
        if (taken.rows[0]) {
          await client.query('COMMIT');
          return { identity: publicIdentity(taken.rows[0]), user: publicUser(user.rows[0]) };
        }
        const now = nowIso();
        const id = crypto.randomUUID();
        await client.query(
          `
            INSERT INTO app_user_identities (
              id, user_id, provider, provider_user_id, email, display_name, profile_image_url,
              linked_at, disconnected_at, payload, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9::jsonb, $8, $8)
          `,
          [
            id,
            user.rows[0].id,
            p,
            providerUserId,
            textOrNull(profile.email),
            textOrNull(profile.displayName),
            textOrNull(profile.profileImageUrl),
            now,
            jsonPayload(profile),
          ],
        );
        await insertAccountEvent(client, {
          userId: user.rows[0].id,
          eventType: 'social_identity_linked',
          provider: p,
          providerUserId,
          identityId: id,
          payload: { provider: p },
          createdAt: now,
        });
        const identity = await client.query('SELECT * FROM app_user_identities WHERE id = $1', [id]);
        await client.query('COMMIT');
        return { identity: publicIdentity(identity.rows[0]), user: publicUser(user.rows[0]) };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
  );
}

export async function verifyAppUserToken(token) {
  const raw = cleanText(token);
  if (!raw) return null;
  if (isLikelyJwt(raw)) {
    const claims = await verifyAppUserAccessToken(raw);
    if (!claims) return null;
    const now = nowIso();
    const result = await queryPostgres(
      `
        SELECT u.*
        FROM app_user_refresh_sessions s
        JOIN app_users u ON u.id = s.user_id
        WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > $3 AND u.active = true
      `,
      [claims.sid, claims.sub, now],
    );
    return publicUser(result.rows[0]);
  }
  const hash = tokenHash(raw);
  const result = await queryPostgres(
    `
      SELECT u.*
      FROM app_user_sessions s
      JOIN app_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2 AND u.active = true
    `,
    [hash, nowIso()],
  );
  return publicUser(result.rows[0]);
}

export async function revokeAppUserToken(token) {
  const raw = cleanText(token);
  const now = nowIso();
  if (isLikelyJwt(raw)) {
    const claims = await verifyAppUserAccessToken(raw);
    if (claims) {
      await queryPostgres('UPDATE app_user_refresh_sessions SET revoked_at = $1 WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL', [
        now,
        claims.sid,
        claims.sub,
      ]);
    }
    return { revokedAt: now };
  }
  await queryPostgres('UPDATE app_user_sessions SET revoked_at = $1 WHERE token_hash = $2 AND revoked_at IS NULL', [now, tokenHash(raw)]);
  return { revokedAt: now };
}

export async function refreshAppUserSession({ refreshToken, deviceId }) {
  if (!isAppUserJwtConfigured()) throw new Error('APP_USER_JWT_NOT_CONFIGURED');
  const device = validateDeviceId(deviceId);
  if (!device) throw new Error('APP_USER_DEVICE_ID_REQUIRED');
  return withDbExclusive(() =>
    withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        const now = nowIso();
        const result = await client.query(
          `
            SELECT s.id AS session_id, s.user_id, s.device_id, s.expires_at AS refresh_expires_at, u.*
            FROM app_user_refresh_sessions s
            JOIN app_users u ON u.id = s.user_id
            WHERE s.refresh_hash = $1 AND s.device_id = $2 AND s.revoked_at IS NULL AND s.expires_at > $3 AND u.active = true
            FOR UPDATE
          `,
          [tokenHash(refreshToken), device, now],
        );
        const row = result.rows[0];
        if (!row) throw new Error('APP_USER_REFRESH_INVALID');
        const nextRefresh = crypto.randomBytes(32).toString('base64url');
        const refreshExpiresAt = new Date(Date.now() + config.jwtRefreshTtlDays * 86400000).toISOString();
        await client.query('UPDATE app_user_refresh_sessions SET refresh_hash = $1, expires_at = $2 WHERE id = $3', [
          tokenHash(nextRefresh),
          refreshExpiresAt,
          row.session_id,
        ]);
        await client.query('COMMIT');
        return {
          user: publicUser(row),
          session: {
            accessToken: await signAppUserAccessToken(row.user_id, row.session_id),
            refreshToken: nextRefresh,
            accessExpiresAt: new Date(Date.now() + config.jwtAccessTtlSeconds * 1000).toISOString(),
            refreshExpiresAt,
            deviceId: device,
          },
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
  );
}

export async function updateAppUserProfile(userId, patch = {}) {
  const sets = [];
  const params = [];
  if (typeof patch.nickname === 'string') {
    const nickname = cleanText(patch.nickname);
    if (nickname.length < 2) throw new Error('APP_USER_NICKNAME_REQUIRED');
    params.push(nickname);
    sets.push(`nickname = $${params.length}`);
  }
  if (typeof patch.profileImageUrl === 'string') {
    params.push(cleanText(patch.profileImageUrl));
    sets.push(`profile_image_url = $${params.length}`);
  }
  if (sets.length === 0) return getAppUser(userId);
  params.push(nowIso());
  sets.push(`updated_at = $${params.length}`);
  params.push(cleanText(userId));
  const result = await queryPostgres(
    `UPDATE app_users SET ${sets.join(', ')} WHERE id = $${params.length} AND active = true RETURNING *`,
    params,
  );
  if (!result.rows[0]) throw new Error('APP_USER_NOT_FOUND');
  return publicUser(result.rows[0]);
}

export async function setAppUserPassword(userId, { password }) {
  if (String(password || '').length < 8) throw new Error('APP_USER_PASSWORD_TOO_SHORT');
  const { hash, salt } = hashPassword(password);
  const result = await queryPostgres(
    'UPDATE app_users SET password_hash = $1, password_salt = $2, updated_at = $3 WHERE id = $4 AND active = true RETURNING *',
    [hash, salt, nowIso(), cleanText(userId)],
  );
  if (!result.rows[0]) throw new Error('APP_USER_NOT_FOUND');
  return publicUser(result.rows[0]);
}

export async function withdrawAppUser(userId) {
  return withDbExclusive(() =>
    withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        const id = cleanText(userId);
        const now = nowIso();
        const user = await client.query('SELECT * FROM app_users WHERE id = $1 AND active = true FOR UPDATE', [id]);
        if (!user.rows[0]) throw new Error('APP_USER_NOT_FOUND');
        await client.query(
          `
            UPDATE app_users
            SET email = $1, nickname = 'Withdrawn user', profile_image_url = '', password_hash = NULL,
                password_salt = NULL, auth_provider = 'withdrawn', active = false, updated_at = $2
            WHERE id = $3
          `,
          [`withdrawn+${id}@users.signal.local`, now, id],
        );
        await client.query('UPDATE app_user_refresh_sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL', [now, id]);
        await client.query('UPDATE app_user_sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL', [now, id]);
        await client.query(
          `
            UPDATE app_user_identities
            SET provider_user_id = 'withdrawn:' || id, email = NULL, display_name = NULL,
                profile_image_url = NULL, disconnected_at = COALESCE(disconnected_at, $1),
                payload = '{}'::jsonb, updated_at = $1
            WHERE user_id = $2
          `,
          [now, id],
        );
        await insertAccountEvent(client, { userId: id, eventType: 'user_withdrawn', createdAt: now });
        await client.query('COMMIT');
        return { withdrawnAt: now };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
  );
}

export async function requestAppUserEmailChange(userId, { email }) {
  const nextEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) throw new Error('APP_USER_EMAIL_INVALID');
  return withDbExclusive(() =>
    withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        const user = await client.query('SELECT * FROM app_users WHERE id = $1 AND active = true', [cleanText(userId)]);
        if (!user.rows[0]) throw new Error('APP_USER_NOT_FOUND');
        const existing = await client.query('SELECT id FROM app_users WHERE email = $1 AND id <> $2 AND active = true', [nextEmail, user.rows[0].id]);
        if (existing.rows[0]) throw new Error('APP_USER_EMAIL_EXISTS');
        const now = nowIso();
        await client.query('UPDATE app_user_email_change_requests SET consumed_at = $1 WHERE user_id = $2 AND consumed_at IS NULL', [now, user.rows[0].id]);
        const id = crypto.randomUUID();
        const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
        const salt = crypto.randomBytes(12).toString('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await client.query(
          `
            INSERT INTO app_user_email_change_requests (
              id, user_id, email, code_hash, code_salt, attempts, created_at, expires_at, consumed_at
            ) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, NULL)
          `,
          [id, user.rows[0].id, nextEmail, otpHash(code, salt), salt, now, expiresAt],
        );
        await client.query('COMMIT');
        return { request: { id, email: nextEmail, maskedEmail: maskEmail(nextEmail), expiresAt }, code };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
  );
}

export async function confirmAppUserEmailChange(userId, { requestId, code }) {
  return withDbExclusive(() =>
    withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        const request = await client.query(
          'SELECT * FROM app_user_email_change_requests WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [cleanText(requestId), cleanText(userId)],
        );
        const row = request.rows[0];
        if (!row || row.consumed_at) throw new Error('APP_USER_EMAIL_CHANGE_INVALID');
        if (new Date(row.expires_at).getTime() <= Date.now()) throw new Error('APP_USER_EMAIL_CHANGE_EXPIRED');
        if (Number(row.attempts) >= 5) throw new Error('APP_USER_EMAIL_CHANGE_TOO_MANY_ATTEMPTS');
        const candidate = Buffer.from(otpHash(code, row.code_salt), 'hex');
        const saved = Buffer.from(row.code_hash, 'hex');
        if (saved.length !== candidate.length || !crypto.timingSafeEqual(saved, candidate)) {
          await client.query('UPDATE app_user_email_change_requests SET attempts = attempts + 1 WHERE id = $1', [row.id]);
          throw new Error('APP_USER_EMAIL_CHANGE_CODE_INVALID');
        }
        const now = nowIso();
        const user = await client.query('UPDATE app_users SET email = $1, updated_at = $2 WHERE id = $3 AND active = true RETURNING *', [
          row.email,
          now,
          cleanText(userId),
        ]);
        if (!user.rows[0]) throw new Error('APP_USER_NOT_FOUND');
        await client.query('UPDATE app_user_email_change_requests SET consumed_at = $1 WHERE id = $2', [now, row.id]);
        await client.query('COMMIT');
        return publicUser(user.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
  );
}

export async function disconnectAppUserIdentity(userId, identityId) {
  return withDbExclusive(() =>
    withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        const user = await client.query('SELECT * FROM app_users WHERE id = $1 AND active = true', [cleanText(userId)]);
        if (!user.rows[0]) throw new Error('APP_USER_NOT_FOUND');
        const identity = await client.query('SELECT * FROM app_user_identities WHERE id = $1 AND user_id = $2 AND disconnected_at IS NULL', [
          cleanText(identityId),
          user.rows[0].id,
        ]);
        if (!identity.rows[0]) throw new Error('APP_USER_IDENTITY_NOT_FOUND');
        const rest = await client.query(
          'SELECT COUNT(*)::int AS count FROM app_user_identities WHERE user_id = $1 AND disconnected_at IS NULL AND id <> $2',
          [user.rows[0].id, identity.rows[0].id],
        );
        if (!user.rows[0].password_hash && Number(rest.rows[0]?.count) === 0) throw new Error('APP_USER_PASSWORD_REQUIRED_BEFORE_UNLINK');
        const now = nowIso();
        const result = await client.query(
          `
            UPDATE app_user_identities
            SET provider_user_id = $1, email = NULL, display_name = NULL, profile_image_url = NULL,
                disconnected_at = $2, payload = '{}'::jsonb, updated_at = $2
            WHERE id = $3
            RETURNING *
          `,
          [`disconnected:${identity.rows[0].id}`, now, identity.rows[0].id],
        );
        await insertAccountEvent(client, {
          userId: user.rows[0].id,
          eventType: 'social_identity_disconnected',
          provider: identity.rows[0].provider,
          identityId: identity.rows[0].id,
          createdAt: now,
        });
        await client.query('COMMIT');
        return publicIdentity(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
  );
}

export async function upsertAppUserDevice(userId, { platform, pushToken, deviceName }) {
  const uid = cleanText(userId);
  const token = cleanText(pushToken);
  if (!uid || !token) throw new Error('APP_USER_DEVICE_REQUIRED');
  const now = nowIso();
  const id = crypto.randomUUID();
  const result = await queryPostgres(
    `
      INSERT INTO app_user_devices (id, user_id, platform, push_token, device_name, active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, true, $6, $6)
      ON CONFLICT(user_id, push_token) DO UPDATE SET
        platform = excluded.platform,
        device_name = excluded.device_name,
        active = true,
        updated_at = excluded.updated_at
      RETURNING *
    `,
    [id, uid, textOrNull(platform), token, textOrNull(deviceName), now],
  );
  return publicDevice(result.rows[0]);
}

export async function getAppUser(userId) {
  const result = await queryPostgres('SELECT * FROM app_users WHERE id = $1', [cleanText(userId)]);
  return publicUser(result.rows[0]);
}

export async function listAppUserIdentities(userId) {
  const result = await queryPostgres(
    'SELECT * FROM app_user_identities WHERE user_id = $1 AND disconnected_at IS NULL ORDER BY linked_at DESC, created_at DESC',
    [cleanText(userId)],
  );
  return result.rows.map(publicIdentity);
}

export async function listAppUserAccountEvents(userId, options = {}) {
  const { limit, offset } = pageOptions(options, 50);
  const result = await queryPostgres(
    'SELECT * FROM app_user_account_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [cleanText(userId), limit, offset],
  );
  return result.rows.map(publicAccountEvent);
}

export async function listAppUserDevicesForUser(userId, options = {}) {
  const { limit } = pageOptions(options, 50);
  const result = await queryPostgres(
    'SELECT * FROM app_user_devices WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT $2',
    [cleanText(userId), limit],
  );
  return result.rows.map(publicDevice);
}

export async function listAppUserAuthSessions(userId, options = {}) {
  const { limit } = pageOptions(options, 50);
  const result = await queryPostgres(
    `
      SELECT 'signal_refresh' AS session_type, id AS session_key, user_id, device_id, created_at, expires_at, revoked_at
      FROM app_user_refresh_sessions
      WHERE user_id = $1
      UNION ALL
      SELECT 'signal_access' AS session_type, substr(token_hash, 1, 14) AS session_key, user_id, NULL AS device_id, created_at, expires_at, revoked_at
      FROM app_user_sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [cleanText(userId), limit],
  );
  const now = Date.now();
  return result.rows.map((row) => {
    const expired = new Date(row.expires_at).getTime() <= now;
    return {
      type: row.session_type,
      key: row.session_key || '',
      userId: row.user_id,
      deviceId: row.device_id || '',
      active: !row.revoked_at && !expired,
      expired,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    };
  });
}

function adminUserRow(row) {
  if (!row) return null;
  return {
    ...publicUser(row),
    activeSessionCount: Number(row.active_session_count) || 0,
    deviceCount: Number(row.device_count) || 0,
    latestSessionAt: row.latest_session_at ? new Date(row.latest_session_at).toISOString() : null,
    latestDeviceAt: row.latest_device_at ? new Date(row.latest_device_at).toISOString() : null,
    notificationCount: Number(row.notification_count) || 0,
    queuedNotificationCount: Number(row.queued_notification_count) || 0,
  };
}

export async function listAppUsers(options = {}) {
  const { limit, offset } = pageOptions(options, 50);
  const q = `%${cleanText(options.q).toLowerCase()}%`;
  const active = cleanText(options.active);
  const params = [limit + 1, offset];
  const where = [];
  if (cleanText(options.q)) {
    params.push(q);
    where.push(`(lower(u.email) LIKE $${params.length} OR lower(u.nickname) LIKE $${params.length})`);
  }
  if (active === 'true' || active === 'false') {
    params.push(active === 'true');
    where.push(`u.active = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await queryPostgres(
    `
      SELECT
        u.*,
        (SELECT COUNT(*) FROM app_user_refresh_sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > NOW()) AS active_session_count,
        (SELECT COUNT(*) FROM app_user_devices d WHERE d.user_id = u.id) AS device_count,
        (SELECT MAX(s.created_at) FROM app_user_refresh_sessions s WHERE s.user_id = u.id) AS latest_session_at,
        (SELECT MAX(d.updated_at) FROM app_user_devices d WHERE d.user_id = u.id) AS latest_device_at,
        (SELECT COUNT(*) FROM notification_items n WHERE n.app_user_id = u.id) AS notification_count,
        (SELECT COUNT(*) FROM notification_items n WHERE n.app_user_id = u.id AND n.status = 'queued') AS queued_notification_count
      FROM app_users u
      ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    params,
  );
  const rows = result.rows.slice(0, limit).map(adminUserRow);
  return { rows, total: offset + rows.length + (result.rows.length > limit ? 1 : 0), limit, offset };
}

export async function listAppUserDevices(options = {}) {
  const { limit, offset } = pageOptions(options, 50);
  const q = `%${cleanText(options.q).toLowerCase()}%`;
  const active = cleanText(options.active);
  const platform = cleanText(options.platform).toLowerCase();
  const params = [limit + 1, offset];
  const where = [];
  if (cleanText(options.q)) {
    params.push(q);
    where.push(`(lower(d.device_name) LIKE $${params.length} OR lower(d.push_token) LIKE $${params.length} OR lower(u.email) LIKE $${params.length})`);
  }
  if (active === 'true' || active === 'false') {
    params.push(active === 'true');
    where.push(`d.active = $${params.length}`);
  }
  if (platform) {
    params.push(platform);
    where.push(`lower(d.platform) = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await queryPostgres(
    `
      SELECT d.*, u.email, u.nickname
      FROM app_user_devices d
      JOIN app_users u ON u.id = d.user_id
      ${whereSql}
      ORDER BY d.updated_at DESC
      LIMIT $1 OFFSET $2
    `,
    params,
  );
  const rows = result.rows.slice(0, limit).map(publicDevice);
  return { rows, total: offset + rows.length + (result.rows.length > limit ? 1 : 0), limit, offset };
}

export async function updateAppUserAdmin(userId, patch = {}) {
  const sets = [];
  const params = [];
  if (typeof patch.active === 'boolean') {
    params.push(patch.active);
    sets.push(`active = $${params.length}`);
  }
  if (typeof patch.nickname === 'string') {
    params.push(cleanText(patch.nickname));
    sets.push(`nickname = $${params.length}`);
  }
  if (typeof patch.profileImageUrl === 'string') {
    params.push(cleanText(patch.profileImageUrl));
    sets.push(`profile_image_url = $${params.length}`);
  }
  if (sets.length === 0) return getAppUser(userId);
  params.push(nowIso());
  sets.push(`updated_at = $${params.length}`);
  params.push(cleanText(userId));
  const result = await queryPostgres(`UPDATE app_users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
  if (!result.rows[0]) throw new Error('APP_USER_NOT_FOUND');
  return publicUser(result.rows[0]);
}

export async function updateAppUserDeviceAdmin(deviceId, patch = {}) {
  const result = await queryPostgres(
    'UPDATE app_user_devices SET active = COALESCE($1, active), updated_at = $2 WHERE id = $3 RETURNING *',
    [typeof patch.active === 'boolean' ? patch.active : null, nowIso(), cleanText(deviceId)],
  );
  if (!result.rows[0]) throw new Error('APP_USER_DEVICE_NOT_FOUND');
  return publicDevice(result.rows[0]);
}

export async function listLegalTerms(options = {}) {
  await ensureSeeded();
  const locale = cleanText(options.locale);
  const type = cleanText(options.type);
  const params = [];
  const where = [];
  if (locale) {
    params.push(locale);
    where.push(`locale = $${params.length}`);
  }
  if (type) {
    params.push(type);
    where.push(`type = $${params.length}`);
  }
  if (options.activeOnly) where.push('active = true');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const latest = options.latestOnly
    ? `
        SELECT *
        FROM (
          SELECT t.*, ROW_NUMBER() OVER (PARTITION BY type, locale ORDER BY updated_at DESC, version DESC) AS rn
          FROM legal_terms t
          ${whereSql}
        ) x
        WHERE rn = 1
      `
    : `SELECT * FROM legal_terms ${whereSql}`;
  const result = await queryPostgres(
    `
      ${latest}
      ORDER BY locale ASC, CASE type WHEN 'service' THEN 1 WHEN 'privacy' THEN 2 ELSE 9 END ASC, updated_at DESC
    `,
    params,
  );
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    locale: row.locale,
    version: row.version,
    title: row.title,
    body: row.body,
    required: row.required === true,
    active: row.active === true,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }));
}

export async function updateLegalTerm(type, locale, patch = {}) {
  const nextType = cleanText(type).toLowerCase() || 'service';
  const nextLocale = cleanText(locale).toLowerCase() || 'ko';
  const version = cleanText(patch.version) || nowIso().slice(0, 10).replaceAll('-', '.');
  const now = nowIso();
  const title = cleanText(patch.title) || nextType;
  const body = cleanText(patch.body);
  if (!body) throw new Error('LEGAL_TERM_BODY_REQUIRED');
  return withPostgresClient(async (client) => {
    await client.query('BEGIN');
    try {
      if (patch.active !== false) {
        await client.query('UPDATE legal_terms SET active = false, updated_at = $1 WHERE type = $2 AND locale = $3 AND version <> $4', [
          now,
          nextType,
          nextLocale,
          version,
        ]);
      }
      await client.query(
        `
          INSERT INTO legal_terms (id, type, locale, version, title, body, required, active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
          ON CONFLICT(type, locale, version) DO UPDATE SET
            title = excluded.title,
            body = excluded.body,
            required = excluded.required,
            active = excluded.active,
            updated_at = excluded.updated_at
        `,
        [
          `${nextType}:${nextLocale}:${version}`,
          nextType,
          nextLocale,
          version,
          title,
          body,
          patch.required !== false,
          patch.active !== false,
          now,
        ],
      );
      await client.query('COMMIT');
      return (await listLegalTerms({ type: nextType, locale: nextLocale, latestOnly: false })).find((term) => term.version === version) || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function listAppUserTermAcceptances(userId) {
  const result = await queryPostgres(
    `
      SELECT *
      FROM app_user_terms_acceptances
      WHERE user_id = $1
      ORDER BY accepted_at DESC
    `,
    [cleanText(userId)],
  );
  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.term_type,
    locale: row.locale,
    version: row.version,
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
  }));
}

function publicNotification(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    ...payload,
    id: row.id,
    type: row.type || payload.type || '',
    channel: row.channel || payload.channel || 'push',
    status: row.status || payload.status || 'queued',
    priority: row.priority || payload.priority || 'normal',
    title: row.title || payload.title || '',
    appUserId: row.app_user_id || payload.appUserId || null,
    targetType: row.target_type || payload.targetType || 'all',
    targetKey: row.target_key || payload.targetKey || null,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : payload.scheduledAt || null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : payload.expiresAt || null,
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : payload.sentAt || null,
    sourceType: row.source_type || payload.sourceType || '',
    sourceId: row.source_id || payload.sourceId || '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : payload.updatedAt || null,
  };
}

export async function upsertNotification(next) {
  if (!next?.id) throw new Error('INVALID_NOTIFICATION');
  const now = nowIso();
  const row = {
    ...next,
    updatedAt: now,
  };
  const result = await queryPostgres(
    `
      INSERT INTO notification_items (
        id, position, type, channel, status, priority, title, app_user_id, target_type,
        target_key, scheduled_at, expires_at, sent_at, source_type, source_id, payload, updated_at
      ) VALUES (
        $1, 0, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16
      )
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        channel = excluded.channel,
        status = excluded.status,
        priority = excluded.priority,
        title = excluded.title,
        app_user_id = excluded.app_user_id,
        target_type = excluded.target_type,
        target_key = excluded.target_key,
        scheduled_at = excluded.scheduled_at,
        expires_at = excluded.expires_at,
        sent_at = excluded.sent_at,
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        payload = excluded.payload,
        updated_at = excluded.updated_at
      RETURNING *
    `,
    [
      row.id,
      textOrNull(row.type),
      textOrNull(row.channel || 'push'),
      textOrNull(row.status || 'queued'),
      textOrNull(row.priority || 'normal'),
      textOrNull(row.title),
      textOrNull(row.appUserId),
      textOrNull(row.targetType || 'all'),
      textOrNull(row.targetKey),
      isoOrNull(row.scheduledAt),
      isoOrNull(row.expiresAt),
      isoOrNull(row.sentAt),
      textOrNull(row.sourceType),
      textOrNull(row.sourceId),
      jsonPayload(row),
      now,
    ],
  );
  clearPublicReadCache();
  return publicNotification(result.rows[0]);
}

export const upsertNotificationItem = upsertNotification;

export async function queryNotifications(options = {}) {
  const page = Math.max(1, Number.parseInt(options.page || '1', 10) || 1);
  const pageSize = safeLimit(options.pageSize, 30, 100);
  const offset = (page - 1) * pageSize;
  const params = [];
  const where = [];
  if (options.appUserId) {
    params.push(cleanText(options.appUserId));
    where.push(`app_user_id = $${params.length}`);
  }
  if (options.status) {
    params.push(cleanText(options.status));
    where.push(`status = $${params.length}`);
  }
  params.push(pageSize + 1, offset);
  const result = await queryPostgres(
    `
      SELECT payload
      FROM notification_items
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY COALESCE(scheduled_at, NULLIF(payload->>'createdAt', '')::timestamptz, updated_at) DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows.map(payloadFromRow).filter(Boolean).slice(0, pageSize);
  const hasMore = result.rows.length > pageSize;
  return {
    rows,
    page,
    pageSize,
    total: offset + rows.length + (hasMore ? 1 : 0),
    totalPages: hasMore ? page + 1 : page,
  };
}

export async function queryPublicNotificationsForUser(userId, options = {}) {
  const { limit } = pageOptions(options, 50);
  const rows = await queryNotifications({ appUserId: userId, pageSize: limit });
  return rows.rows;
}

export async function claimPushNotificationsForDelivery({ limit = 20, now = nowIso(), provider = 'mock' } = {}) {
  return withDbExclusive(() =>
    withPostgresClient(async (client) => {
      await client.query('BEGIN');
      try {
        const result = await client.query(
          `
            SELECT *
            FROM notification_items
            WHERE status = 'queued' AND channel = 'push'
              AND (scheduled_at IS NULL OR scheduled_at <= $1)
              AND (expires_at IS NULL OR expires_at > $1)
            ORDER BY COALESCE(scheduled_at, updated_at) ASC
            LIMIT $2
            FOR UPDATE SKIP LOCKED
          `,
          [now, safeLimit(limit, 20, 100)],
        );
        const claimed = [];
        for (const row of result.rows) {
          const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
          const next = { ...payload, status: 'sending', provider, attempts: Number(payload.attempts) || 0, updatedAt: now };
          const update = await client.query(
            'UPDATE notification_items SET status = $1, payload = $2::jsonb, updated_at = $3 WHERE id = $4 RETURNING *',
            ['sending', jsonPayload(next), now, row.id],
          );
          claimed.push(publicNotification(update.rows[0]));
        }
        await client.query('COMMIT');
        return claimed;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
  );
}

export async function resolvePushDevicesForNotification(notification) {
  const targetType = cleanText(notification?.targetType || 'all');
  const params = [];
  let where = 'd.active = true AND d.push_token IS NOT NULL AND d.push_token <> \'\'';
  if (targetType === 'user' && notification?.appUserId) {
    params.push(notification.appUserId);
    where += ` AND d.user_id = $${params.length}`;
  }
  const result = await queryPostgres(`SELECT d.* FROM app_user_devices d JOIN app_users u ON u.id = d.user_id WHERE ${where} AND u.active = true`, params);
  return result.rows.map(publicDevice);
}

export async function updateNotificationSendState(notificationId, patch = {}) {
  const existing = await queryPostgres('SELECT * FROM notification_items WHERE id = $1', [cleanText(notificationId)]);
  const row = publicNotification(existing.rows[0]);
  if (!row) return null;
  const now = nowIso();
  const next = {
    ...row,
    ...patch,
    attempts: patch.attempts ?? row.attempts,
    updatedAt: now,
  };
  const result = await queryPostgres(
    `
      UPDATE notification_items
      SET status = $1, sent_at = $2, payload = $3::jsonb, updated_at = $4
      WHERE id = $5
      RETURNING *
    `,
    [textOrNull(next.status), isoOrNull(next.sentAt), jsonPayload(next), now, row.id],
  );
  return publicNotification(result.rows[0]);
}

export async function readDbHealthSummary() {
  const pg = await checkPostgresConnectivity();
  let jobs = 0;
  if (pg.ok) {
    try {
      const count = await queryPostgres('SELECT COUNT(*)::int AS count FROM polling_jobs');
      jobs = Number(count.rows[0]?.count) || 0;
    } catch {
      jobs = 0;
    }
  }
  return {
    ok: pg.ok,
    requestedDriver: 'postgres',
    activeStore: 'postgres',
    postgres: {
      ...pg,
      jobs,
    },
  };
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
