import crypto from 'node:crypto';
import { config } from './config.mjs';
import {
  ensureNewsSourcesFromItems,
  normalizeNewsSourceName,
  normalizeNewsSourceNameWithAliases,
} from './db/newsSources.mjs';
import { nowIso } from './db/time.mjs';
import { parseToUtcIsoOrNull, sqlUtcRangeFrom, sqlUtcRangeTo, utcDateOnlyOrNull } from './time/utc.mjs';
import { checkKyselyConnectivity, queryKysely, withKyselyTransaction } from './db/kysely/client.mjs';
import {
  findPollingJob,
  findPollingJobRuns,
  findPollingJobs,
} from './db/repositories/pollingJobsRepository.mjs';
import {
  acquirePollingJobLockRow,
  deleteExpiredPollingJobLocks,
  deletePollingJobLock,
  deletePollingJobLockByJobKey,
  findPollingJobLock,
  findPollingJobLocks,
  renewPollingJobLockRow,
} from './db/repositories/pollingJobLocksRepository.mjs';
import {
  listYoutubeVideoRows,
  queryPublicYoutubeChannelRows,
  queryPublicYoutubeRows,
} from './db/repositories/youtubeRepository.mjs';
import {
  pruneCommunityPostsForSource as pruneCommunityPostsForSourceRows,
  queryPublicCommunityPostByIdRow,
  queryPublicCommunityRows,
} from './db/repositories/communityRepository.mjs';
import {
  deleteCalendarRowById,
  deleteCalendarRowsByIds,
  findDuplicateCalendarIds,
  queryPublicCalendarDateSummaryRows,
  queryPublicCalendarRows,
} from './db/repositories/calendarRepository.mjs';
import {
  listCalendarEventCodeMappingPayloads,
} from './db/repositories/calendarEventCodeMappingsRepository.mjs';
import {
  normalizeCalendarEventForStorage,
} from './calendar/eventKey.mjs';
import {
  queryAdminNewsRows,
  queryPublicNewsRows,
  queryPublicNewsSourceRows,
} from './db/repositories/newsRepository.mjs';
import {
  queryPublicDisclosureRows,
  queryPublicDisclosureByIdRow,
} from './db/repositories/disclosuresRepository.mjs';
import {
  queryPublicNewsDigestRows,
} from './db/repositories/newsDigestRepository.mjs';
import {
  queryPublicDisclosureDigestRows,
} from './db/repositories/disclosureDigestRepository.mjs';
import {
  queryPublicCoinMarketRows,
  queryPublicMarketQuoteRows,
} from './db/repositories/marketRepository.mjs';
import {
  queryPublicPriceSeriesCandlesRow,
} from './db/repositories/priceSeriesRepository.mjs';
import {
  createAdminUserRow,
  deleteAdminUserRow,
  hasActiveAdminUsers,
  listAdminUserRows,
  updateAdminUserRow,
  verifyAdminLoginRow,
} from './db/repositories/adminUsersRepository.mjs';
import {
  getAppUserNotificationPrefs,
  updateAppUserNotificationPrefs,
} from './db/repositories/appUserNotificationPrefsRepository.mjs';
import {
  claimPushNotificationRows,
  queryNotificationRows,
  resolvePushDeviceRows,
  updateNotificationSendStateRow,
  upsertNotificationRow,
} from './db/repositories/notificationsRepository.mjs';
import {
  countUnreadUserNotificationInbox,
  deleteUserNotificationInboxItems,
  markUserNotificationInboxRead,
  queryUserNotificationInboxRows,
  queryUserNotificationInboxPage,
  upsertUserNotificationInboxRow,
  USER_NOTIFICATION_INBOX_MAX,
} from './db/repositories/notificationInboxRepository.mjs';
import {
  listAppUserTermAcceptanceRows,
  listLegalTermRows,
  updateLegalTermRow,
} from './db/repositories/legalTermsRepository.mjs';
import {
  listAppUserDeviceRows,
  listAppUserRows,
  updateAppUserAdminRow,
  updateAppUserDeviceAdminRow,
} from './db/repositories/appUsersAdminRepository.mjs';
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

function textOrNull(value) {
  const text = cleanText(value);
  return text ? text : null;
}

function isoOrNull(value) {
  return parseToUtcIsoOrNull(value);
}

function dateOrNull(value) {
  return utcDateOnlyOrNull(value);
}

function sqlDateOrTimestamp(value) {
  return sqlUtcRangeFrom(value);
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function textArrayOrEmpty(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
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
      area: textOrNull(row.area),
      stage: textOrNull(row.stage),
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
    key: 'disclosures',
    store: 'disclosures',
    table: 'disclosures',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      market: textOrNull(row.market),
      provider: textOrNull(row.provider),
      symbol: textOrNull(row.symbol),
      company_name: textOrNull(row.companyName),
      form_type: textOrNull(row.formType),
      type_category: textOrNull(row.typeCategory),
      filed_at: isoOrNull(row.filedAt),
      period_end_date: dateOrNull(row.periodEndDate),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'calendarEvents',
    store: 'calendar',
    table: 'calendar_events',
    pk: 'id',
    conflictTarget: 'country, event_type, event_key',
    keyOf: (row) => row.id,
    noPayload: true,
    columns: (row, index) => ({
      position: index,
      event_date: dateOrNull(row.date || row.eventAt),
      event_at: isoOrNull(row.eventAt),
      event_type: textOrNull(row.type),
      symbol: textOrNull(row.symbol),
      country: textOrNull(row.country) || 'GLOBAL',
      event_key: textOrNull(row.eventKey),
      title: textOrNull(row.title),
      provider: textOrNull(row.provider) || 'manual',
      provider_item_id: textOrNull(row.providerItemId),
      time_label: textOrNull(row.timeLabel),
      timezone: textOrNull(row.timezone),
      company_name: textOrNull(row.companyName),
      source: textOrNull(row.source || row.provider) || 'manual',
      source_event_id: textOrNull(row.sourceEventId || row.providerItemId),
      importance: textOrNull(row.importance),
      impact: textOrNull(row.impact),
      actual: numberOrNull(row.actual),
      estimate: numberOrNull(row.estimate),
      previous: numberOrNull(row.previous ?? row.prev),
      unit: textOrNull(row.unit),
      fiscal_year: Number.isFinite(Number(row.fiscalYear)) ? Math.floor(Number(row.fiscalYear)) : null,
      fiscal_quarter: Number.isFinite(Number(row.fiscalQuarter)) ? Math.floor(Number(row.fiscalQuarter)) : null,
      earnings_hour: textOrNull(row.earningsHour),
      url: textOrNull(row.url),
      created_at: isoOrNull(row.createdAt) || nowIso(),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'youtubeVideos',
    store: 'youtube',
    table: 'youtube_videos',
    pk: 'id',
    keyOf: (row) => row.id,
    noPayload: true,
    columns: (row, index) => ({
      position: index,
      provider: textOrNull(row.provider) || 'youtube',
      provider_item_id: textOrNull(row.providerItemId || row.videoId),
      video_id: textOrNull(row.videoId || row.providerItemId),
      topic: textOrNull(row.topic),
      title: textOrNull(row.title) || '',
      channel: textOrNull(row.channel),
      channel_id: textOrNull(row.channelId),
      channel_handle: textOrNull(row.channelHandle),
      description: textOrNull(row.description) || '',
      published_at: isoOrNull(row.publishedAt),
      duration: textOrNull(row.duration),
      view_count: Number.isFinite(Number(row.viewCount)) ? Math.floor(Number(row.viewCount)) : 0,
      thumbnail_url: textOrNull(row.thumbnailUrl),
      fetched_at: isoOrNull(row.fetchedAt),
      sort_bucket: textOrNull(row.sortBucket),
      sort_buckets: textArrayOrEmpty(
        Array.isArray(row.sortBuckets) && row.sortBuckets.length > 0
          ? row.sortBuckets
          : row.sortBucket
            ? [row.sortBucket]
            : [],
      ),
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
      display_symbol: textOrNull(row.displaySymbol),
      krx_symbol: textOrNull(row.krxSymbol),
      provider_item_id: textOrNull(row.providerItemId),
      regular_yahoo_symbol: textOrNull(row.regularSession?.yahooSymbol || row.yahooSymbol),
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
    key: 'newsDigestItems',
    store: 'insights',
    table: 'news_digest_items',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      category: textOrNull(row.category),
      digest_date: dateOrNull(row.generatedDate || row.digestDate || row.generatedAt),
      generated_at: isoOrNull(row.generatedAt),
      score: numberOrNull(row.score),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'disclosureDigestItems',
    store: 'insights',
    table: 'disclosure_digest_items',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      market: textOrNull(row.market),
      digest_date: dateOrNull(row.generatedDate || row.digestDate || row.generatedAt),
      generated_at: isoOrNull(row.generatedAt),
      score: numberOrNull(row.score),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'marketBriefings',
    store: 'insights',
    table: 'market_briefings',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      market: textOrNull(row.market),
      session: textOrNull(row.session),
      briefing_date: dateOrNull(row.briefingDate || row.generatedDate || row.publishedAt),
      published_at: isoOrNull(row.publishedAt || row.generatedAt),
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'todayBriefings',
    store: 'insights',
    table: 'today_briefings',
    pk: 'id',
    keyOf: (row) => row.id,
    columns: (row, index) => ({
      position: index,
      locale: textOrNull(row.locale) || 'ko',
      briefing_date: dateOrNull(row.briefingDate || row.generatedDate || row.publishedAt),
      published_at: isoOrNull(row.publishedAt || row.generatedAt),
      generated_at: isoOrNull(row.generatedAt || row.publishedAt),
      status: textOrNull(row.status) || 'published',
      updated_at: isoOrNull(row.updatedAt) || nowIso(),
    }),
  },
  {
    key: 'communityPosts',
    store: 'community',
    table: 'community_posts',
    pk: 'id',
    conflictTarget: 'source, provider_item_id',
    keyOf: (row) => row.id,
    noPayload: true,
    columns: (row, index) => ({
      position: index,
      source: textOrNull(row.source),
      provider: textOrNull(row.provider),
      provider_item_id: textOrNull(row.providerItemId),
      title: textOrNull(row.title) || '',
      body: textOrNull(row.body) || '',
      source_url: textOrNull(row.sourceUrl),
      published_at: isoOrNull(row.publishedAt),
      fetched_at: isoOrNull(row.fetchedAt),
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
const singletonSpecsByKey = new Map(singletonSpecs.map((spec) => [spec.key, spec]));

async function hasStructuredData(client) {
  const result = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM app_settings) +
      (SELECT COUNT(*) FROM signal_meta) +
      (SELECT COUNT(*) FROM polling_jobs) AS count
  `);
  return Number(result.rows[0]?.count) > 0;
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
  const columns = [spec.pk, ...Object.keys(typedColumns), ...(spec.noPayload ? [] : ['payload'])];
  const values = [
    key,
    ...Object.values(typedColumns),
    ...(spec.noPayload ? [] : [jsonPayload(spec.payload ? spec.payload(row) : row)]),
  ];
  const placeholders = values.map((_, idx) => (!spec.noPayload && idx === values.length - 1 ? `$${idx + 1}::jsonb` : `$${idx + 1}`));
  const updates = columns
    .filter((column) => column !== spec.pk)
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');
  await client.query(
    `
      INSERT INTO ${spec.table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT(${spec.conflictTarget || spec.pk}) DO UPDATE SET ${updates}
    `,
    values,
  );
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

async function seedLegalTermsIfEmpty(client) {
  const count = await client.query('SELECT COUNT(*)::int AS count FROM legal_terms');
  if (Number(count.rows[0]?.count) > 0) return;
  console.warn('[db] legal_terms is empty. Run Flyway seed migrations before enabling app signup.');
}

async function ensureSeeded() {
  if (seedChecked) return;
  await withKyselyTransaction(async (client) => {
    try {
      if (!(await hasStructuredData(client))) {
        console.warn('[db] default runtime data is missing. Run Flyway migrations before deploying.');
      }
      await seedAdminUsersIfEmpty(client);
      seedChecked = true;
    } catch (error) {
      throw error;
    }
  });
}

export async function upsertCollectionRows(collectionKey, rows = []) {
  const spec = collectionSpecsByKey.get(collectionKey);
  if (!spec) throw new Error(`UNKNOWN_COLLECTION:${collectionKey}`);
  let safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) return { count: 0 };
  return withDbExclusive(async () => {
    await ensureSeeded();
    if (collectionKey === 'calendarEvents') {
      const mappings = await listCalendarEventCodeMappingPayloads({ enabled: true }).catch(() => []);
      safeRows = safeRows
        .map((row) => normalizeCalendarEventForStorage(row, mappings))
        .filter((row) => cleanText(row.title) && cleanText(row.eventKey) && cleanText(row.date));
      if (safeRows.length === 0) return { count: 0 };
    }
    await withKyselyTransaction(async (client) => {
      try {
        for (let index = 0; index < safeRows.length; index += 1) {
          await insertCollectionRow(client, spec, safeRows[index], index);
        }
      } catch (error) {
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
  if (spec.noPayload) throw new Error(`COLLECTION_HAS_NO_PAYLOAD:${collectionKey}`);
  const id = cleanText(key);
  if (!id) throw new Error('COLLECTION_KEY_REQUIRED');
  return withDbExclusive(async () => {
    await ensureSeeded();
    return withKyselyTransaction(async (client) => {
      try {
        const current = await client.query(`SELECT payload, position FROM ${spec.table} WHERE ${spec.pk} = $1 FOR UPDATE`, [id]);
        const next = { ...(payloadFromRow(current.rows[0]) || {}), ...patch };
        if (!cleanText(spec.keyOf(next))) {
          if (collectionKey === 'pollingJobs') next.jobKey = id;
          else if (collectionKey === 'pollingJobRuns') next.id = id;
          else next[spec.pk] = id;
        }
        await insertCollectionRow(client, spec, next, Number(current.rows[0]?.position) || 0);
        clearPublicReadCache();
        return next;
      } catch (error) {
        throw error;
      }
    });
  });
}

export async function listCollectionPayloads(collectionKey) {
  const spec = collectionSpecsByKey.get(collectionKey);
  if (!spec) throw new Error(`UNKNOWN_COLLECTION:${collectionKey}`);
  if (spec.noPayload) throw new Error(`COLLECTION_HAS_NO_PAYLOAD:${collectionKey}`);
  await ensureSeeded();
  const result = await queryKysely(`SELECT payload FROM ${spec.table} ORDER BY position ASC`);
  return result.rows.map(payloadFromRow).filter(Boolean);
}

export async function getCollectionPayload(collectionKey, key) {
  const spec = collectionSpecsByKey.get(collectionKey);
  if (!spec) throw new Error(`UNKNOWN_COLLECTION:${collectionKey}`);
  if (spec.noPayload) throw new Error(`COLLECTION_HAS_NO_PAYLOAD:${collectionKey}`);
  const id = cleanText(key);
  if (!id) return null;
  await ensureSeeded();
  const result = await queryKysely(`SELECT payload FROM ${spec.table} WHERE ${spec.pk} = $1`, [id]);
  return payloadFromRow(result.rows[0]);
}

export async function deleteCollectionPayloads(collectionKey, keys = []) {
  const spec = collectionSpecsByKey.get(collectionKey);
  if (!spec) throw new Error(`UNKNOWN_COLLECTION:${collectionKey}`);
  const ids = [...new Set((Array.isArray(keys) ? keys : []).map(cleanText).filter(Boolean))];
  if (ids.length === 0) return { deleted: 0 };
  return withDbExclusive(async () => {
    await ensureSeeded();
    const result = await queryKysely(`DELETE FROM ${spec.table} WHERE ${spec.pk} = ANY($1::text[])`, [ids]);
    clearPublicReadCache();
    return { deleted: Number(result.rowCount) || 0 };
  });
}

export async function clearCollections(collectionKeys = []) {
  const keys = [...new Set((Array.isArray(collectionKeys) ? collectionKeys : []).map(cleanText).filter(Boolean))];
  return withDbExclusive(async () => {
    await ensureSeeded();
    return withKyselyTransaction(async (client) => {
      try {
        const counts = {};
        for (const key of keys) {
          const spec = collectionSpecsByKey.get(key);
          if (!spec) continue;
          const count = await client.query(`SELECT COUNT(*)::int AS count FROM ${spec.table}`);
          await client.query(`DELETE FROM ${spec.table}`);
          counts[key] = Number(count.rows[0]?.count) || 0;
        }
        clearPublicReadCache();
        return { targets: keys.filter((key) => collectionSpecsByKey.has(key)), counts };
      } catch (error) {
        throw error;
      }
    });
  });
}

export async function replaceCollectionPayloads(collectionKey, rows = []) {
  const spec = collectionSpecsByKey.get(collectionKey);
  if (!spec) throw new Error(`UNKNOWN_COLLECTION:${collectionKey}`);
  const safeRows = Array.isArray(rows) ? rows : [];
  return withDbExclusive(async () => {
    await ensureSeeded();
    return withKyselyTransaction(async (client) => {
      try {
        const seen = new Set();
        for (let index = 0; index < safeRows.length; index += 1) {
          const key = cleanText(spec.keyOf(safeRows[index]));
          if (!key) continue;
          seen.add(key);
          await insertCollectionRow(client, spec, safeRows[index], index);
        }
        const existing = await client.query(`SELECT ${spec.pk} AS id FROM ${spec.table}`);
        for (const row of existing.rows) {
          const key = cleanText(row.id);
          if (key && !seen.has(key)) await client.query(`DELETE FROM ${spec.table} WHERE ${spec.pk} = $1`, [key]);
        }
        clearPublicReadCache();
        return safeRows;
      } catch (error) {
        throw error;
      }
    });
  });
}

export async function readSingletonPayload(settingKey) {
  const spec = singletonSpecsByKey.get(settingKey);
  if (!spec) throw new Error(`UNKNOWN_SINGLETON:${settingKey}`);
  await ensureSeeded();
  const result = await queryKysely(`SELECT payload FROM ${spec.table} WHERE ${spec.pk} = $1`, [spec.id]);
  return payloadFromRow(result.rows[0]);
}

export async function patchSingletonPayload(settingKey, patch = {}) {
  const spec = singletonSpecsByKey.get(settingKey);
  if (!spec) throw new Error(`UNKNOWN_SINGLETON:${settingKey}`);
  return withDbExclusive(async () => {
    await ensureSeeded();
    return withKyselyTransaction(async (client) => {
      try {
        const current = await client.query(`SELECT payload FROM ${spec.table} WHERE ${spec.pk} = $1 FOR UPDATE`, [spec.id]);
        const next = { ...(payloadFromRow(current.rows[0]) || {}), ...(patch && typeof patch === 'object' ? patch : {}) };
        await insertSingleton(client, spec, next);
        clearPublicReadCache();
        return next;
      } catch (error) {
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

export async function queryPublicNews(options = {}) {
  return cachedPublicRead('publicNews', options, () => queryPublicNewsRows(options));
}

export async function queryPublicNewsSources(options = {}) {
  return cachedPublicRead('publicNewsSources', options, () => queryPublicNewsSourceRows(options), 30000);
}

export async function queryPublicNewsDigests(options = {}) {
  return cachedPublicRead('publicNewsDigests', options, () => queryPublicNewsDigestRows(options), 15000);
}

export async function queryAdminNews(options = {}) {
  return queryAdminNewsRows(options);
}

export async function queryPublicDisclosures(options = {}) {
  return cachedPublicRead('publicDisclosures', options, () => queryPublicDisclosureRows(options), 15000);
}

export async function queryPublicDisclosureDigests(options = {}) {
  return cachedPublicRead('publicDisclosureDigests', options, () => queryPublicDisclosureDigestRows(options), 15000);
}

export async function queryPublicDisclosureById(id) {
  return cachedPublicRead('publicDisclosureById', { id }, () => queryPublicDisclosureByIdRow(id), 15000);
}

export async function queryPublicYoutube(options = {}) {
  return cachedPublicRead('publicYoutube', options, () => queryPublicYoutubeRows(options));
}

export async function queryPublicCommunity(options = {}) {
  return cachedPublicRead('publicCommunity', options, () => queryPublicCommunityRows(options), 15000);
}

export async function queryPublicCommunityPostById(id) {
  return cachedPublicRead('publicCommunityById', { id }, () => queryPublicCommunityPostByIdRow(id), 15000);
}

export async function pruneCommunityPostsForSource(source, providerItemIds = []) {
  return withDbExclusive(async () => {
    await ensureSeeded();
    const result = await pruneCommunityPostsForSourceRows(source, providerItemIds);
    clearPublicReadCache();
    return result;
  });
}

export async function queryPublicYoutubeChannels() {
  return cachedPublicRead('publicYoutubeChannels', {}, queryPublicYoutubeChannelRows, 30000);
}

export async function listYoutubeVideos() {
  await ensureSeeded();
  return listYoutubeVideoRows();
}

export async function queryPublicMarketQuotes(options = {}) {
  return cachedPublicRead('publicMarketQuotes', options, () => queryPublicMarketQuoteRows(options), 3000);
}

export async function queryPublicCoinMarkets(options = {}) {
  return cachedPublicRead('publicCoinMarkets', options, () => queryPublicCoinMarketRows(options), 10000);
}

export async function queryPublicCalendar(options = {}) {
  return cachedPublicRead('publicCalendar', options, () => queryPublicCalendarRows(options), 30000);
}

export async function queryPublicCalendarDateSummaries(options = {}) {
  return cachedPublicRead('publicCalendarDateSummaries', options, () => queryPublicCalendarDateSummaryRows(options), 30000);
}

export async function deleteCalendarEvent(id) {
  return deleteCalendarRowById(id);
}

export async function deduplicateCalendarEvents() {
  const idsToDelete = await findDuplicateCalendarIds();
  if (idsToDelete.length === 0) return 0;
  return deleteCalendarRowsByIds(idsToDelete);
}

export async function readPublicMarketLists() {
  return cachedPublicRead('publicMarketLists', {}, async () => {
    const result = await queryKysely('SELECT payload FROM market_lists ORDER BY position ASC');
    return result.rows.map(payloadFromRow).filter(Boolean);
  }, 30000);
}

export async function readPublicMarketList(key) {
  return cachedPublicRead('publicMarketList', { key }, async () => {
    const result = await queryKysely('SELECT payload FROM market_lists WHERE list_key = $1', [cleanText(key)]);
    return payloadFromRow(result.rows[0]);
  }, 30000);
}

export async function readAppSettings() {
  return cachedPublicRead('appSettings', {}, async () => {
    const result = await queryKysely(`SELECT payload FROM app_settings WHERE id = 'app'`);
    return payloadFromRow(result.rows[0]) || {};
  }, 5000);
}

export async function upsertMarketQuotes(rows = []) {
  await upsertCollectionRows('marketQuotes', rows);
  return rows;
}

export async function queryPublicPriceSeriesCandles(options = {}) {
  return cachedPublicRead('publicPriceSeriesCandles', options, () => queryPublicPriceSeriesCandlesRow(options), 30000);
}

export async function listDuePollingJobs(now = Date.now()) {
  await ensureSeeded();
  const result = await queryKysely(
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
  return findPollingJob(jobKey);
}

export async function listPollingJobs() {
  await ensureSeeded();
  return findPollingJobs();
}

export async function listPollingJobRuns({ limit = 200, jobKey = '' } = {}) {
  await ensureSeeded();
  return findPollingJobRuns({ limit, jobKey });
}

export async function listPollingJobLocks() {
  await ensureSeeded();
  return findPollingJobLocks();
}

export async function getPollingJobLock(jobKey) {
  await ensureSeeded();
  return findPollingJobLock(jobKey);
}

export async function acquirePollingJobLock(jobKey, { ttlMs = 2 * 60 * 60 * 1000 } = {}) {
  await ensureSeeded();
  return withDbExclusive(async () => {
    const key = cleanText(jobKey);
    const now = nowIso();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + Math.max(60_000, Number(ttlMs) || ttlMs)).toISOString();
    const result = await acquirePollingJobLockRow(key, { token, lockedAt: now, expiresAt });
    if (!result?.acquired) return null;
    return result.lock;
  });
}

export async function releasePollingJobLock(jobKey, token) {
  await ensureSeeded();
  return deletePollingJobLock(jobKey, token);
}

export async function renewPollingJobLock(jobKey, token, { ttlMs = 2 * 60 * 60 * 1000 } = {}) {
  await ensureSeeded();
  const key = cleanText(jobKey);
  const lockToken = cleanText(token);
  if (!key || !lockToken) return false;
  const expiresAt = new Date(Date.now() + Math.max(60_000, Number(ttlMs) || ttlMs)).toISOString();
  return renewPollingJobLockRow(key, lockToken, expiresAt);
}

export async function forceReleasePollingJobLock(jobKey) {
  await ensureSeeded();
  return deletePollingJobLockByJobKey(jobKey);
}

export async function purgeExpiredPollingJobLocks(now = Date.now()) {
  await ensureSeeded();
  return deleteExpiredPollingJobLocks(now);
}

export async function verifyAdminLogin(loginId, password) {
  await ensureSeeded();
  return verifyAdminLoginRow(loginId, password);
}

export async function hasAdminUsers() {
  await ensureSeeded();
  return hasActiveAdminUsers();
}

export async function listAdminUsers() {
  await ensureSeeded();
  return listAdminUserRows();
}

export async function createAdminUser({ id, password, active = true }) {
  await ensureSeeded();
  return createAdminUserRow({ id, password, active });
}

export async function updateAdminUser(id, patch = {}) {
  await ensureSeeded();
  return updateAdminUserRow(id, patch);
}

export async function deleteAdminUser(id) {
  await ensureSeeded();
  return deleteAdminUserRow(id);
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
    withKyselyTransaction(async (client) => {
      await seedLegalTermsIfEmpty(client);
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
        clearPublicReadCache();
        return { user: publicUser(row.rows[0]), session };
      } catch (error) {
        throw error;
      }
    }),
  );
}

export async function loginAppUser({ email, password, deviceId = '' }) {
  return withDbExclusive(() =>
    withKyselyTransaction(async (client) => {
      try {
        const result = await client.query('SELECT * FROM app_users WHERE email = $1', [normalizeEmail(email)]);
        const row = result.rows[0];
        if (!row || row.active !== true || !verifyPassword(password, row)) throw new Error('APP_USER_LOGIN_FAILED');
        const session = await createSession(client, row.id, deviceId);
        return { user: publicUser(row), session };
      } catch (error) {
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
    withKyselyTransaction(async (client) => {
      await seedLegalTermsIfEmpty(client);
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
        return { user: publicUser(user.rows[0]), session };
      } catch (error) {
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
    withKyselyTransaction(async (client) => {
      try {
        const user = await client.query('SELECT * FROM app_users WHERE id = $1 AND active = true', [cleanText(userId)]);
        if (!user.rows[0]) throw new Error('APP_USER_NOT_FOUND');
        const taken = await client.query(
          'SELECT id, user_id FROM app_user_identities WHERE provider = $1 AND provider_user_id = $2 AND disconnected_at IS NULL',
          [p, providerUserId],
        );
        if (taken.rows[0] && taken.rows[0].user_id !== user.rows[0].id) throw new Error('APP_USER_SOCIAL_IDENTITY_TAKEN');
        if (taken.rows[0]) {
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
        return { identity: publicIdentity(identity.rows[0]), user: publicUser(user.rows[0]) };
      } catch (error) {
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
    const result = await queryKysely(
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
  const result = await queryKysely(
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
      await queryKysely('UPDATE app_user_refresh_sessions SET revoked_at = $1 WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL', [
        now,
        claims.sid,
        claims.sub,
      ]);
    }
    return { revokedAt: now };
  }
  await queryKysely('UPDATE app_user_sessions SET revoked_at = $1 WHERE token_hash = $2 AND revoked_at IS NULL', [now, tokenHash(raw)]);
  return { revokedAt: now };
}

export async function refreshAppUserSession({ refreshToken, deviceId }) {
  if (!isAppUserJwtConfigured()) throw new Error('APP_USER_JWT_NOT_CONFIGURED');
  const device = validateDeviceId(deviceId);
  if (!device) throw new Error('APP_USER_DEVICE_ID_REQUIRED');
  return withDbExclusive(() =>
    withKyselyTransaction(async (client) => {
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
  const result = await queryKysely(
    `UPDATE app_users SET ${sets.join(', ')} WHERE id = $${params.length} AND active = true RETURNING *`,
    params,
  );
  if (!result.rows[0]) throw new Error('APP_USER_NOT_FOUND');
  return publicUser(result.rows[0]);
}

export async function setAppUserPassword(userId, { password }) {
  if (String(password || '').length < 8) throw new Error('APP_USER_PASSWORD_TOO_SHORT');
  const { hash, salt } = hashPassword(password);
  const result = await queryKysely(
    'UPDATE app_users SET password_hash = $1, password_salt = $2, updated_at = $3 WHERE id = $4 AND active = true RETURNING *',
    [hash, salt, nowIso(), cleanText(userId)],
  );
  if (!result.rows[0]) throw new Error('APP_USER_NOT_FOUND');
  return publicUser(result.rows[0]);
}

export async function withdrawAppUser(userId) {
  return withDbExclusive(() =>
    withKyselyTransaction(async (client) => {
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
        return { withdrawnAt: now };
      } catch (error) {
        throw error;
      }
    }),
  );
}

export async function requestAppUserEmailChange(userId, { email }) {
  const nextEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) throw new Error('APP_USER_EMAIL_INVALID');
  return withDbExclusive(() =>
    withKyselyTransaction(async (client) => {
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
        return { request: { id, email: nextEmail, maskedEmail: maskEmail(nextEmail), expiresAt }, code };
      } catch (error) {
        throw error;
      }
    }),
  );
}

export async function confirmAppUserEmailChange(userId, { requestId, code }) {
  return withDbExclusive(() =>
    withKyselyTransaction(async (client) => {
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
        return publicUser(user.rows[0]);
      } catch (error) {
        throw error;
      }
    }),
  );
}

export async function disconnectAppUserIdentity(userId, identityId) {
  return withDbExclusive(() =>
    withKyselyTransaction(async (client) => {
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
        return publicIdentity(result.rows[0]);
      } catch (error) {
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
  const result = await queryKysely(
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
  const result = await queryKysely('SELECT * FROM app_users WHERE id = $1', [cleanText(userId)]);
  return publicUser(result.rows[0]);
}

export async function listAppUserIdentities(userId) {
  const result = await queryKysely(
    'SELECT * FROM app_user_identities WHERE user_id = $1 AND disconnected_at IS NULL ORDER BY linked_at DESC, created_at DESC',
    [cleanText(userId)],
  );
  return result.rows.map(publicIdentity);
}

export async function listAppUserAccountEvents(userId, options = {}) {
  const { limit, offset } = pageOptions(options, 50);
  const result = await queryKysely(
    'SELECT * FROM app_user_account_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [cleanText(userId), limit, offset],
  );
  return result.rows.map(publicAccountEvent);
}

export async function listAppUserDevicesForUser(userId, options = {}) {
  const { limit } = pageOptions(options, 50);
  const result = await queryKysely(
    'SELECT * FROM app_user_devices WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT $2',
    [cleanText(userId), limit],
  );
  return result.rows.map(publicDevice);
}

export async function listAppUserAuthSessions(userId, options = {}) {
  const { limit } = pageOptions(options, 50);
  const result = await queryKysely(
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

export async function listAppUsers(options = {}) {
  return listAppUserRows(options);
}

export async function listAppUserDevices(options = {}) {
  return listAppUserDeviceRows(options);
}

export async function updateAppUserAdmin(userId, patch = {}) {
  return (await updateAppUserAdminRow(userId, patch)) || getAppUser(userId);
}

export async function updateAppUserDeviceAdmin(deviceId, patch = {}) {
  return updateAppUserDeviceAdminRow(deviceId, patch);
}

export async function listLegalTerms(options = {}) {
  await ensureSeeded();
  return listLegalTermRows(options);
}

export async function updateLegalTerm(type, locale, patch = {}) {
  await ensureSeeded();
  return updateLegalTermRow(type, locale, patch);
}

export async function listAppUserTermAcceptances(userId) {
  return listAppUserTermAcceptanceRows(userId);
}

export async function upsertNotification(next) {
  const row = await upsertNotificationRow(next);
  clearPublicReadCache();
  return row;
}

export const upsertNotificationItem = upsertNotification;

export async function queryNotifications(options = {}) {
  return queryNotificationRows(options);
}

export async function queryUserNotificationInbox(userId, options = {}) {
  return queryUserNotificationInboxRows(userId, options);
}

export async function queryUserNotificationInboxAdminPage(userId, options = {}) {
  return queryUserNotificationInboxPage(userId, options);
}

export async function countUserNotificationInboxUnread(userId) {
  return countUnreadUserNotificationInbox(userId);
}

export async function markUserNotificationInboxReadState(userId, options = {}) {
  return markUserNotificationInboxRead(userId, options);
}

export async function deleteUserNotificationInbox(userId, options = {}) {
  return deleteUserNotificationInboxItems(userId, options);
}

export async function deliverUserNotificationInbox(userId, notificationId, deliveredAt) {
  return upsertUserNotificationInboxRow(userId, notificationId, { deliveredAt });
}

export { getAppUserNotificationPrefs, updateAppUserNotificationPrefs };

export { USER_NOTIFICATION_INBOX_MAX };

export async function claimPushNotificationsForDelivery({ limit = 20, now = nowIso(), provider = 'mock' } = {}) {
  return withDbExclusive(() => claimPushNotificationRows({ limit, now, provider }));
}

export async function resolvePushDevicesForNotification(notification) {
  return resolvePushDeviceRows(notification);
}

export async function updateNotificationSendState(notificationId, patch = {}) {
  return updateNotificationSendStateRow(notificationId, patch);
}

export async function readDbHealthSummary() {
  const pg = await checkKyselyConnectivity();
  let jobs = 0;
  if (pg.ok) {
    try {
      const count = await queryKysely('SELECT COUNT(*)::int AS count FROM polling_jobs');
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
