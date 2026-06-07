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
  displayNews,
  filterCalendar,
  filterCoinMarkets,
  filterConcalls,
  filterMarketQuotes,
  filterNews,
  filterYoutube,
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

function urlFromOptions(options = {}) {
  const url = new URL('http://signal.local/');
  for (const [key, value] of Object.entries(options || {})) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
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
    const db = await readDb();
    const url = urlFromOptions(options);
    const locale = cleanText(options.locale) || 'ko';
    const rows = filterNews(db.newsItems || [], url).map((item) => publicNews(displayNews(item, db.newsTranslations || [], locale)));
    return pagination(rows, pageOptions(options, 20));
  });
}

export async function queryPublicNewsSources(options = {}) {
  return cachedPublicRead('publicNewsSources', options, async () => {
    const db = await readDb();
    const category = cleanText(options.category);
    return (db.newsSources || [])
      .filter((source) => source && source.enabled !== false && source.hidden !== true)
      .filter((source) => !category || source.category === category)
      .map((source) => ({
        id: source.id,
        name: source.name || source.id,
        category: source.category || 'global',
        enabled: source.enabled !== false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, 30000);
}

export async function queryPublicYoutube(options = {}) {
  return cachedPublicRead('publicYoutube', options, async () => {
    const db = await readDb();
    const rows = filterYoutube(db.youtubeVideos || [], urlFromOptions(options)).map(publicYoutube);
    return pagination(rows, pageOptions(options, 30));
  });
}

export async function queryPublicYoutubeChannels() {
  return cachedPublicRead('publicYoutubeChannels', {}, async () => {
    const db = await readDb();
    const handles = new Set(listActiveYoutubeChannelHandles(db.appSettings || {}).map((handle) => handle.toLowerCase()));
    const channels = new Map();
    for (const item of db.youtubeVideos || []) {
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
    const db = await readDb();
    const rows = filterMarketQuotes(db.marketQuotes || [], urlFromOptions(options)).map(publicMarketQuote);
    return pagination(rows, pageOptions(options, 30));
  }, 3000);
}

export async function queryPublicCoinMarkets(options = {}) {
  return cachedPublicRead('publicCoinMarkets', options, async () => {
    const db = await readDb();
    const rows = filterCoinMarkets(db.coinMarkets || [], urlFromOptions(options)).map(publicCoinMarket);
    return pagination(rows, pageOptions(options, 30));
  }, 10000);
}

export async function queryPublicCalendar(options = {}) {
  return cachedPublicRead('publicCalendar', options, async () => {
    const db = await readDb();
    let rows = filterCalendar(db.calendarEvents || [], urlFromOptions(options)).map(publicCalendarEvent);
    const limit = cleanText(options.limit);
    if (limit) rows = rows.slice(0, safeLimit(limit, 200, 1000));
    return rows;
  }, 30000);
}

export async function queryPublicCalendarDateSummaries(options = {}) {
  return cachedPublicRead('publicCalendarDateSummaries', options, async () => {
    const rows = await queryPublicCalendar({ ...options, limit: '1000' });
    const byDate = new Map();
    for (const item of rows) {
      const date = cleanText(item.date || item.eventAt).slice(0, 10);
      if (!date) continue;
      const prev = byDate.get(date) || { date, count: 0, byType: {} };
      prev.count += 1;
      const type = item.type || 'unknown';
      prev.byType[type] = (prev.byType[type] || 0) + 1;
      byDate.set(date, prev);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, 30000);
}

export async function queryPublicConcalls(options = {}) {
  return cachedPublicRead('publicConcalls', options, async () => {
    const db = await readDb();
    const rows = filterConcalls(db.concallTranscripts || [], urlFromOptions(options)).map(publicConcall);
    return pagination(rows, pageOptions(options, 30));
  }, 10000);
}

export async function readPublicMarketLists() {
  return cachedPublicRead('publicMarketLists', {}, async () => {
    const db = await readDb();
    return db.marketLists || [];
  }, 30000);
}

export async function readPublicMarketList(key) {
  return cachedPublicRead('publicMarketList', { key }, async () => {
    const db = await readDb();
    return (db.marketLists || []).find((list) => list.key === key) || null;
  }, 30000);
}

export async function readAppSettings() {
  return cachedPublicRead('appSettings', {}, async () => {
    const db = await readDb();
    return db.appSettings || {};
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
    const db = await readDb();
    const series = (db.priceSeries || []).find((row) => cleanText(row.symbol).toUpperCase() === symbol);
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
    const db = await readDb();
    return symbols
      .map((symbol) => {
        const series = (db.priceSeries || []).find((row) => cleanText(row.symbol).toUpperCase() === symbol);
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
    const db = await readDb();
    const requested = new Set(
      cleanText(options.symbols)
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    );
    const quotesBySymbol = new Map((db.marketQuotes || []).map((q) => [cleanText(q.krxSymbol || q.symbol).toUpperCase(), q]));
    const rows = [];
    for (const series of db.priceSeries || []) {
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
    const db = await readDb();
    const symbols = new Set(
      cleanText(options.symbols)
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    );
    const rows = (db.priceSeries || [])
      .filter((series) => symbols.size === 0 || symbols.has(cleanText(series.symbol).toUpperCase()))
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
    const db = await readDb();
    const symbol = cleanText(options.symbol).toUpperCase();
    let rows = [...(db.quantSignalItems || [])];
    if (symbol) rows = rows.filter((row) => cleanText(row.symbol).toUpperCase() === symbol);
    if (options.from) rows = rows.filter((row) => cleanText(row.generatedDate || row.generatedAt).slice(0, 10) >= options.from);
    if (options.to) rows = rows.filter((row) => cleanText(row.generatedDate || row.generatedAt).slice(0, 10) <= options.to);
    rows.sort((a, b) => cleanText(b.generatedAt || b.generatedDate).localeCompare(cleanText(a.generatedAt || a.generatedDate)));
    return pagination(rows, pageOptions(options, 60));
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
      queryPublicNews({ symbols: symbols.join(','), limit: '100' }),
      queryPublicQuantSignals({ symbols: symbols.join(','), limit: '100' }),
    ]);
    return symbols.map((symbol) => {
      const quote = quotePage.rows.find((row) =>
        [row.symbol, row.displaySymbol, row.krxSymbol].some((value) => cleanText(value).toUpperCase() === symbol),
      );
      const news = newsPage.rows.filter((row) => (row.symbols || []).map((s) => cleanText(s).toUpperCase()).includes(symbol));
      const quant = quantRows.find((row) => cleanText(row.symbol).toUpperCase() === symbol);
      const score = Math.max(Math.abs(Number(quote?.changePercent) || 0) * 8, Number(quant?.score) || 0, news.length * 8);
      return {
        symbol,
        quote: quote || null,
        quant: quant || null,
        news: news.slice(0, 3),
        score: Math.round(score),
        level: score >= 70 ? 'hot' : score >= 35 ? 'watch' : 'quiet',
      };
    });
  }, 5000);
}

export async function queryInsightItems(options = {}) {
  return cachedPublicRead('insights', options, async () => {
    const db = await readDb();
    let rows = [...(db.insightItems || [])];
    const kind = cleanText(options.kind);
    const displayKey = cleanText(options.displayKey);
    const level = cleanText(options.level);
    const from = cleanText(options.from);
    const to = cleanText(options.to);
    const date = cleanText(options.date);
    if (kind) rows = rows.filter((row) => row.kind === kind);
    if (level) rows = rows.filter((row) => row.level === level);
    if (displayKey) rows = rows.filter((row) => cleanText(row.displayKey || row.symbol) === displayKey);
    if (date) rows = rows.filter((row) => cleanText(row.generatedDate || row.generatedAt).slice(0, 10) === date);
    if (from) rows = rows.filter((row) => cleanText(row.generatedDate || row.generatedAt).slice(0, 10) >= from);
    if (to) rows = rows.filter((row) => cleanText(row.generatedDate || row.generatedAt).slice(0, 10) <= to);
    if (options.pushOnly) rows = rows.filter((row) => row.pushCandidate === true);
    if (!options.includeExpired) {
      const now = Date.now();
      rows = rows.filter((row) => {
        const expiresMs = row.expiresAt ? Date.parse(row.expiresAt) : NaN;
        return !Number.isFinite(expiresMs) || expiresMs >= now;
      });
    }
    rows.sort((a, b) => cleanText(b.generatedAt || b.createdAt).localeCompare(cleanText(a.generatedAt || a.createdAt)));
    return rows.slice(0, safeLimit(options.limit, 20, 100));
  });
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
  const params = [limit, offset];
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
        (SELECT COUNT(*) FROM notification_items n WHERE n.app_user_id = u.id AND n.status = 'queued') AS queued_notification_count,
        COUNT(*) OVER()::int AS total
      FROM app_users u
      ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    params,
  );
  return { rows: result.rows.map(adminUserRow), total: Number(result.rows[0]?.total) || 0, limit, offset };
}

export async function listAppUserDevices(options = {}) {
  const { limit, offset } = pageOptions(options, 50);
  const q = `%${cleanText(options.q).toLowerCase()}%`;
  const active = cleanText(options.active);
  const platform = cleanText(options.platform).toLowerCase();
  const params = [limit, offset];
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
      SELECT d.*, u.email, u.nickname, COUNT(*) OVER()::int AS total
      FROM app_user_devices d
      JOIN app_users u ON u.id = d.user_id
      ${whereSql}
      ORDER BY d.updated_at DESC
      LIMIT $1 OFFSET $2
    `,
    params,
  );
  return { rows: result.rows.map(publicDevice), total: Number(result.rows[0]?.total) || 0, limit, offset };
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
  const db = await readDb();
  let rows = [...(db.notificationItems || [])];
  if (options.appUserId) rows = rows.filter((row) => row.appUserId === options.appUserId);
  if (options.status) rows = rows.filter((row) => row.status === options.status);
  rows.sort((a, b) => cleanText(b.scheduledAt || b.createdAt).localeCompare(cleanText(a.scheduledAt || a.createdAt)));
  const page = Math.max(1, Number.parseInt(options.page || '1', 10) || 1);
  const pageSize = safeLimit(options.pageSize, 30, 100);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), page: safePage, pageSize, total: rows.length, totalPages };
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
