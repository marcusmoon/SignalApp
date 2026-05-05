import { ensureDbShape, shapeDbFromStores } from './shape.mjs';
import { insightGeneratedDate, normalizeInsightDisplayKey } from './insights.mjs';
import { collectionTables, ensureStructuredSchema, tableCount, tableExists } from './sqlite/schema.mjs';
import { nowIso } from './time.mjs';

function parsePayload(label, payload, fallback = null) {
  if (payload == null || payload === '') return fallback;
  try {
    return JSON.parse(payload);
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    wrapped.message = `${wrapped.message} (${label})`;
    throw wrapped;
  }
}

function payloadOf(value) {
  return JSON.stringify(value ?? null);
}

function boolInt(value) {
  return value === false ? 0 : value === true ? 1 : value ? 1 : 0;
}

function enabledInt(value, defaultValue = true) {
  if (value === false || value === 0 || value === '0' || value === 'false') return 0;
  if (value == null) return defaultValue ? 1 : 0;
  return value ? 1 : 0;
}

function textOrNull(value) {
  if (value == null) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

export function hasStructuredData(db) {
  if (tableCount(db, 'app_settings') > 0) return true;
  if (tableCount(db, 'signal_meta') > 0) return true;
  return collectionTables.some((table) => tableCount(db, table) > 0);
}

function readSingleton(db, table, id, fallback) {
  const row = db.prepare(`SELECT payload FROM ${table} WHERE id = ?`).get(id);
  return row ? parsePayload(`${table}.${id}`, row.payload, fallback) : fallback;
}

function readCollection(db, table) {
  return db
    .prepare(`SELECT payload FROM ${table} ORDER BY position ASC`)
    .all()
    .map((row) => parsePayload(table, row.payload, null))
    .filter(Boolean);
}

export function readStructuredDb(db) {
  if (!hasStructuredData(db)) return null;
  const meta = db.prepare("SELECT payload FROM signal_meta WHERE name = 'db'").get();
  const shaped = ensureDbShape({
    meta: meta ? parsePayload('signal_meta.db', meta.payload, null) : null,
    appSettings: readSingleton(db, 'app_settings', 'app', null),
    providerSettings: readCollection(db, 'provider_settings'),
    translationSettings: readCollection(db, 'translation_settings'),
    uiModelPresets: readSingleton(db, 'ui_model_presets', 'default', null),
    newsSources: readCollection(db, 'news_sources'),
    newsSourceSettings: readSingleton(db, 'news_source_settings', 'default', null),
    pollingJobs: readCollection(db, 'polling_jobs'),
    pollingJobRuns: readCollection(db, 'polling_job_runs'),
    newsItems: readCollection(db, 'news_items'),
    newsTranslations: readCollection(db, 'news_translations'),
    calendarEvents: readCollection(db, 'calendar_events'),
    concallTranscripts: readCollection(db, 'concall_transcripts'),
    youtubeVideos: readCollection(db, 'youtube_videos'),
    marketQuotes: readCollection(db, 'market_quotes'),
    coinMarkets: readCollection(db, 'coin_markets'),
    marketLists: readCollection(db, 'market_lists'),
    insightItems: readCollection(db, 'insight_items'),
  });
  return shapeDbFromStores({
    settings: {
      meta: shaped.meta,
      appSettings: shaped.appSettings,
      providerSettings: shaped.providerSettings,
      translationSettings: shaped.translationSettings,
      uiModelPresets: shaped.uiModelPresets,
      newsSources: shaped.newsSources,
      newsSourceSettings: shaped.newsSourceSettings,
    },
    jobs: {
      pollingJobs: shaped.pollingJobs,
      pollingJobRuns: shaped.pollingJobRuns,
    },
    news: {
      newsItems: shaped.newsItems,
      newsTranslations: shaped.newsTranslations,
    },
    calendar: { calendarEvents: shaped.calendarEvents },
    concalls: { concallTranscripts: shaped.concallTranscripts },
    youtube: { youtubeVideos: shaped.youtubeVideos },
    market: {
      marketQuotes: shaped.marketQuotes,
      coinMarkets: shaped.coinMarkets,
      marketLists: shaped.marketLists,
    },
    insights: { insightItems: shaped.insightItems },
  });
}

function syncSingleton(db, table, id, payload, updatedAt) {
  const nextPayload = payloadOf(payload);
  const existing = db.prepare(`SELECT payload FROM ${table} WHERE id = ?`).get(id);
  if (existing?.payload === nextPayload) return;
  db.prepare(`
    INSERT INTO ${table} (id, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run(id, nextPayload, updatedAt);
}

function syncMeta(db, meta, updatedAt) {
  const nextPayload = payloadOf(meta);
  const existing = db.prepare("SELECT payload FROM signal_meta WHERE name = 'db'").get();
  if (existing?.payload === nextPayload) return;
  db.prepare(`
    INSERT INTO signal_meta (name, payload, updated_at)
    VALUES ('db', ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run(nextPayload, updatedAt);
}

function syncCollection(db, spec, rows, updatedAt) {
  const list = Array.isArray(rows) ? rows : [];
  const extraColumns = spec.extraColumns || [];
  const selectColumns = [spec.keyColumn, 'position', 'payload', ...extraColumns].join(', ');
  const existingRows = db.prepare(`SELECT ${selectColumns} FROM ${spec.table}`).all();
  const existing = new Map(existingRows.map((row) => [String(row[spec.keyColumn]), row]));
  const seen = new Set();
  const columns = [spec.keyColumn, 'position', ...extraColumns, 'payload', 'updated_at'];
  const placeholders = columns.map(() => '?').join(', ');
  const updates = columns
    .filter((column) => column !== spec.keyColumn)
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');
  const upsert = db.prepare(`
    INSERT INTO ${spec.table} (${columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT(${spec.keyColumn}) DO UPDATE SET ${updates}
  `);

  for (let index = 0; index < list.length; index += 1) {
    const row = list[index];
    const key = String(spec.keyOf(row) || '').trim();
    if (!key) continue;
    seen.add(key);
    const nextPayload = payloadOf(row);
    const extras = spec.extra(row);
    const prev = existing.get(key);
    const extraChanged = extraColumns.some((column) => String(prev?.[column] ?? '') !== String(extras[column] ?? ''));
    if (prev && prev.payload === nextPayload && Number(prev.position) === index && !extraChanged) continue;
    upsert.run(
      key,
      index,
      ...extraColumns.map((column) => extras[column] ?? null),
      nextPayload,
      textOrNull(row?.updatedAt) || updatedAt,
    );
  }

  const remove = db.prepare(`DELETE FROM ${spec.table} WHERE ${spec.keyColumn} = ?`);
  for (const key of existing.keys()) {
    if (!seen.has(key)) remove.run(key);
  }
}

const collectionSpecs = [
  {
    table: 'provider_settings',
    keyColumn: 'provider',
    keyOf: (row) => row.provider,
    extraColumns: ['enabled'],
    extra: (row) => ({ enabled: enabledInt(row.enabled) }),
  },
  {
    table: 'translation_settings',
    keyColumn: 'locale',
    keyOf: (row) => row.locale,
    extraColumns: ['provider', 'enabled'],
    extra: (row) => ({ provider: textOrNull(row.provider), enabled: enabledInt(row.enabled) }),
  },
  {
    table: 'news_sources',
    keyColumn: 'source_key',
    keyOf: (row) => `${row.id}|${row.category || 'global'}`,
    extraColumns: ['source_id', 'category', 'name', 'enabled', 'hidden'],
    extra: (row) => ({
      source_id: textOrNull(row.id),
      category: textOrNull(row.category || 'global'),
      name: textOrNull(row.name),
      enabled: enabledInt(row.enabled),
      hidden: boolInt(row.hidden === true),
    }),
  },
  {
    table: 'polling_jobs',
    keyColumn: 'job_key',
    keyOf: (row) => row.jobKey,
    extraColumns: ['enabled', 'domain', 'operation', 'provider', 'handler', 'next_run_at', 'last_run_at'],
    extra: (row) => ({
      enabled: boolInt(row.enabled === true),
      domain: textOrNull(row.domain),
      operation: textOrNull(row.operation),
      provider: textOrNull(row.provider),
      handler: textOrNull(row.handler),
      next_run_at: textOrNull(row.nextRunAt),
      last_run_at: textOrNull(row.lastRunAt),
    }),
  },
  {
    table: 'polling_job_runs',
    keyColumn: 'id',
    keyOf: (row) => row.id,
    extraColumns: ['job_key', 'status', 'trigger_type', 'started_at', 'finished_at'],
    extra: (row) => ({
      job_key: textOrNull(row.jobKey),
      status: textOrNull(row.status),
      trigger_type: textOrNull(row.trigger),
      started_at: textOrNull(row.startedAt),
      finished_at: textOrNull(row.finishedAt),
    }),
  },
  {
    table: 'news_items',
    keyColumn: 'id',
    keyOf: (row) => row.id,
    extraColumns: ['category', 'provider', 'source_name', 'published_at', 'fetched_at'],
    extra: (row) => ({
      category: textOrNull(row.category),
      provider: textOrNull(row.provider),
      source_name: textOrNull(row.sourceName),
      published_at: textOrNull(row.publishedAt),
      fetched_at: textOrNull(row.fetchedAt),
    }),
  },
  {
    table: 'news_translations',
    keyColumn: 'id',
    keyOf: (row) => row.id,
    extraColumns: ['news_item_id', 'locale', 'status'],
    extra: (row) => ({
      news_item_id: textOrNull(row.newsItemId),
      locale: textOrNull(row.locale),
      status: textOrNull(row.status),
    }),
  },
  {
    table: 'calendar_events',
    keyColumn: 'id',
    keyOf: (row) => row.id,
    extraColumns: ['event_date', 'event_at', 'event_type', 'symbol'],
    extra: (row) => ({
      event_date: textOrNull(row.date),
      event_at: textOrNull(row.eventAt),
      event_type: textOrNull(row.type),
      symbol: textOrNull(row.symbol),
    }),
  },
  {
    table: 'concall_transcripts',
    keyColumn: 'id',
    keyOf: (row) => row.id,
    extraColumns: ['symbol', 'earnings_date', 'fiscal_year', 'fiscal_quarter', 'fetched_at'],
    extra: (row) => ({
      symbol: textOrNull(row.symbol),
      earnings_date: textOrNull(row.earningsDate),
      fiscal_year: Number.isFinite(Number(row.fiscalYear)) ? Number(row.fiscalYear) : null,
      fiscal_quarter: Number.isFinite(Number(row.fiscalQuarter)) ? Number(row.fiscalQuarter) : null,
      fetched_at: textOrNull(row.fetchedAt),
    }),
  },
  {
    table: 'youtube_videos',
    keyColumn: 'id',
    keyOf: (row) => row.id,
    extraColumns: ['channel', 'published_at', 'fetched_at'],
    extra: (row) => ({
      channel: textOrNull(row.channel),
      published_at: textOrNull(row.publishedAt),
      fetched_at: textOrNull(row.fetchedAt),
    }),
  },
  {
    table: 'market_quotes',
    keyColumn: 'id',
    keyOf: (row) => row.id,
    extraColumns: ['symbol', 'segment', 'quote_time', 'fetched_at'],
    extra: (row) => ({
      symbol: textOrNull(row.symbol),
      segment: textOrNull(row.segment),
      quote_time: textOrNull(row.quoteTime),
      fetched_at: textOrNull(row.fetchedAt),
    }),
  },
  {
    table: 'coin_markets',
    keyColumn: 'id',
    keyOf: (row) => row.id,
    extraColumns: ['symbol', 'fetched_at'],
    extra: (row) => ({
      symbol: textOrNull(row.symbol),
      fetched_at: textOrNull(row.fetchedAt),
    }),
  },
  {
    table: 'market_lists',
    keyColumn: 'list_key',
    keyOf: (row) => row.key,
    extraColumns: [],
    extra: () => ({}),
  },
  {
    table: 'insight_items',
    keyColumn: 'id',
    keyOf: (row) => row.id,
    extraColumns: [
      'kind',
      'display_key',
      'level',
      'score',
      'generated_date',
      'generated_at',
      'expires_at',
      'push_candidate',
    ],
    extra: (row) => ({
      kind: textOrNull(row.kind),
      display_key: textOrNull(normalizeInsightDisplayKey(row)),
      level: textOrNull(row.level),
      score: Number.isFinite(Number(row.score)) ? Math.round(Number(row.score)) : null,
      generated_date: textOrNull(insightGeneratedDate(row)),
      generated_at: textOrNull(row.generatedAt),
      expires_at: textOrNull(row.expiresAt),
      push_candidate: boolInt(row.pushCandidate === true),
    }),
  },
];

function writeStructuredDbInner(db, dbObject) {
  const shaped = ensureDbShape(dbObject);
  const updatedAt = nowIso();
  shaped.meta = { ...(shaped.meta || {}), updatedAt, schemaVersion: 2 };
  syncMeta(db, shaped.meta, updatedAt);
  syncSingleton(db, 'app_settings', 'app', shaped.appSettings, updatedAt);
  syncSingleton(db, 'ui_model_presets', 'default', shaped.uiModelPresets, updatedAt);
  syncSingleton(db, 'news_source_settings', 'default', shaped.newsSourceSettings, updatedAt);
  syncCollection(db, collectionSpecs[0], shaped.providerSettings, updatedAt);
  syncCollection(db, collectionSpecs[1], shaped.translationSettings, updatedAt);
  syncCollection(db, collectionSpecs[2], shaped.newsSources, updatedAt);
  syncCollection(db, collectionSpecs[3], shaped.pollingJobs, updatedAt);
  syncCollection(db, collectionSpecs[4], shaped.pollingJobRuns, updatedAt);
  syncCollection(db, collectionSpecs[5], shaped.newsItems, updatedAt);
  syncCollection(db, collectionSpecs[6], shaped.newsTranslations, updatedAt);
  syncCollection(db, collectionSpecs[7], shaped.calendarEvents, updatedAt);
  syncCollection(db, collectionSpecs[8], shaped.concallTranscripts, updatedAt);
  syncCollection(db, collectionSpecs[9], shaped.youtubeVideos, updatedAt);
  syncCollection(db, collectionSpecs[10], shaped.marketQuotes, updatedAt);
  syncCollection(db, collectionSpecs[11], shaped.coinMarkets, updatedAt);
  syncCollection(db, collectionSpecs[12], shaped.marketLists, updatedAt);
  syncCollection(db, collectionSpecs[13], shaped.insightItems, updatedAt);
}

export function writeStructuredDb(db, dbObject, { transaction = true } = {}) {
  if (!transaction) {
    writeStructuredDbInner(db, dbObject);
    return;
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    writeStructuredDbInner(db, dbObject);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function readLegacyStores(db) {
  if (!tableExists(db, 'signal_stores')) return null;
  const rows = db.prepare('SELECT name, payload FROM signal_stores').all();
  if (rows.length === 0) return null;
  const stores = {};
  for (const row of rows) stores[row.name] = parsePayload(`signal_stores.${row.name}`, row.payload, null);
  return Object.keys(stores).length > 0 ? shapeDbFromStores(stores) : null;
}

export function migrateLegacySignalStoresIfNeeded(db) {
  if (hasStructuredData(db)) return false;
  const legacy = readLegacyStores(db);
  if (!legacy) return false;
  writeStructuredDb(db, legacy);
  db.exec('DROP TABLE IF EXISTS signal_stores');
  console.log('[db] migrated legacy signal_stores payloads into structured SQLite tables');
  return true;
}
