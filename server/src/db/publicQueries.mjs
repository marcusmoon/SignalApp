import {
  displayNews,
  filterCalendar,
  filterCoinMarkets,
  filterConcalls,
  filterMarketQuotes,
  filterNews,
  filterYoutube,
} from '../http/shared.mjs';
import { listActiveYoutubeChannelHandles } from './youtubeChannels.mjs';
import { itemMatchesYoutubeChannelHandles } from '../youtubeCuration.mjs';

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

function pageOptions({ limit = 30, offset = 0, maxLimit = 100 } = {}) {
  const safeLimit = Math.min(maxLimit, Math.max(1, Math.floor(Number(limit)) || 30));
  const safeOffset = Math.max(0, Math.floor(Number(offset)) || 0);
  return { limit: safeLimit, offset: safeOffset };
}

/** limit/offset (+ page/pageSize 하위호환) — 인메모리 스캔 리스트 공통 */
function listOffsetLimit(options, defaultLimit = 30) {
  const { limit } = pageOptions({ limit: options.limit ?? options.pageSize ?? defaultLimit, offset: 0, maxLimit: 100 });
  const pageNum = Math.max(1, Math.floor(Number(options.page)) || 1);
  const hasExplicitOffset = options.offset != null && String(options.offset).trim() !== '';
  const rawOffset = hasExplicitOffset
    ? pageOptions({ limit, offset: options.offset ?? 0, maxLimit: 100 }).offset
    : (pageNum - 1) * limit;
  return pageOptions({ limit, offset: rawOffset, maxLimit: 100 });
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
  };
}

function compactScanLimit({ limit, offset, wide = false, minWide = 300, extraWide = 120 } = {}) {
  if (!wide) return Math.min(2000, Math.max(Number(limit) + Number(offset) + 1, 1));
  return Math.min(2000, Math.max(Number(limit) + Number(offset) + extraWide, minWide));
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
    providerItemId: item.providerItemId,
    symbol: item.symbol,
    title: item.title,
    fiscalYear: item.fiscalYear ?? null,
    fiscalQuarter: item.fiscalQuarter ?? null,
    earningsDate: item.earningsDate || null,
    earningsHour: item.earningsHour || null,
    transcriptSnippet: item.transcriptSnippet || '',
    transcript: item.transcript,
    summaryStatus: item.summaryStatus,
    summaryProvider: item.summaryProvider || null,
    summaryBullets: Array.isArray(item.summaryBullets) ? item.summaryBullets : [],
    guidance: item.guidance || '',
    risk: item.risk || '',
    fetchedAt: item.fetchedAt,
  };
}

function symbolsFromOptions(options) {
  const symbol = String(options.symbol || '').trim().toUpperCase();
  const symbols = String(options.symbols || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set([symbol, ...symbols].filter(Boolean))];
}

function newsPrefilterSql(options) {
  const where = [];
  const params = {};
  const category = String(options.category || '').trim();
  if (category === 'global') {
    where.push("(category = 'global' OR provider = 'financialjuice')");
  } else if (category) {
    where.push('category = @category');
    params.category = category;
  }
  if (options.from) {
    where.push("(published_at IS NULL OR published_at = '' OR published_at >= @fromBroad)");
    params.fromBroad = `${String(options.from).slice(0, 10)}T00:00:00.000Z`;
  }
  if (options.to) {
    where.push("(published_at IS NULL OR published_at = '' OR published_at <= @toBroad)");
    params.toBroad = `${String(options.to).slice(0, 10)}T23:59:59.999Z`;
  }
  const q = String(options.q || '').trim().toLowerCase();
  if (q) {
    where.push(
      '(LOWER(COALESCE(source_name, "")) LIKE @q OR LOWER(COALESCE(provider, "")) LIKE @q OR LOWER(payload) LIKE @q)',
    );
    params.q = `%${q}%`;
  }
  const symbols = symbolsFromOptions(options);
  if (symbols.length > 0) {
    where.push(`(${symbols.map((_, index) => `LOWER(payload) LIKE @symbol${index}`).join(' OR ')})`);
    symbols.forEach((symbol, index) => {
      params[`symbol${index}`] = `%${symbol.toLowerCase()}%`;
    });
  }
  const sources = String(options.sources || options.source || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (sources.length > 0) {
    where.push(`source_name IN (${sources.map((_, index) => `@source${index}`).join(', ')})`);
    sources.forEach((source, index) => {
      params[`source${index}`] = source;
    });
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export function queryPublicNewsInDb(db, options = {}) {
  const locale = String(options.locale || 'ko');
  const { limit, offset } = pageOptions({ limit: options.limit || 20, offset: options.offset || 0 });
  const { whereSql, params } = newsPrefilterSql(options);
  const flash = ['1', 'true', 'yes'].includes(String(options.flash || '').trim().toLowerCase());
  const wideScan = Boolean(options.q || options.tag || options.symbol || options.symbols || options.from || options.to || flash);
  const scanLimit = compactScanLimit({
    limit,
    offset,
    wide: wideScan,
    minWide: flash ? 1200 : 300,
    extraWide: flash ? 600 : 120,
  });
  const newsItems = db
    .prepare(
      `
        SELECT payload
        FROM news_items
        ${whereSql}
        ORDER BY published_at DESC
        LIMIT @scanLimit
      `,
    )
    .all({ ...params, scanLimit })
    .map((row) => parsePayload('news_items.payload', row.payload, null))
    .filter(Boolean);
  const filtered = filterNews(newsItems, {
    searchParams: {
      get: (key) => {
        if (key === 'category') return options.category || null;
        if (key === 'symbol') return options.symbol || null;
        if (key === 'symbols') return options.symbols || null;
        if (key === 'sources' || key === 'source') return options.sources || options.source || null;
        if (key === 'flash') return flash ? '1' : null;
        if (key === 'q') return options.q || null;
        if (key === 'from') return options.from || null;
        if (key === 'to') return options.to || null;
        if (key === 'tag') return options.tag || null;
        if (key === 'timeZone') return options.timeZone || null;
        return null;
      },
    },
  });
  const paged = pagination(filtered, { limit, offset });
  const hasMore = paged.hasMore || newsItems.length >= scanLimit;
  const ids = paged.rows.map((item) => item.id).filter(Boolean);
  const translations = ids.length
    ? db
        .prepare(
          `
            SELECT payload
            FROM news_translations
            WHERE locale = @locale
              AND news_item_id IN (${ids.map((_, index) => `@id${index}`).join(', ')})
          `,
        )
        .all(Object.fromEntries([['locale', locale], ...ids.map((id, index) => [`id${index}`, id])]))
        .map((row) => parsePayload('news_translations.payload', row.payload, null))
        .filter(Boolean)
    : [];
  return {
    rows: paged.rows.map((item) => publicNews(displayNews(item, translations, locale))),
    total: paged.total,
    limit,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + paged.rows.length : null,
  };
}

export function queryPublicYoutubeInDb(db, options = {}) {
  const { limit: safeLimit, offset: safeOffset } = listOffsetLimit(options, 30);
  const where = [];
  const params = {};
  const channel = String(options.channel || '').trim().toLowerCase();
  if (channel) {
    where.push('LOWER(COALESCE(channel, "")) LIKE @channel');
    params.channel = `%${channel}%`;
  }
  const channelHandles = String(options.channelHandles || '')
    .split(',')
    .map((handle) => handle.trim().toLowerCase())
    .filter(Boolean);
  const channelFilterActive = channelHandles.length > 0;
  const q = String(options.q || '').trim().toLowerCase();
  if (q) {
    where.push('(LOWER(COALESCE(channel, "")) LIKE @q OR LOWER(payload) LIKE @q)');
    params.q = `%${q}%`;
  }
  const sort = options.sort === 'popular' ? 'popular' : 'latest';
  const bucket = sort === 'popular' ? 'popular' : 'latest';
  const baseWhere = [...where];
  const bucketWhere = [...where, '(LOWER(payload) LIKE @bucket OR LOWER(payload) LIKE @bucketList)'];
  params.bucket = `%"sortBucket":"${bucket}"%`;
  params.bucketList = `%"${bucket}"%`;
  const whereSql = bucketWhere.length ? `WHERE ${bucketWhere.join(' AND ')}` : '';
  /** 뉴스 피드와 동일: offset 이 커질수록 스캔 상한을 키워 필터 후 페이지가 비지 않게 함 */
  const scanLimit = compactScanLimit({
    limit: safeLimit,
    offset: safeOffset,
    wide: channelFilterActive || Boolean(channel) || Boolean(q) || sort === 'popular',
    minWide: channelFilterActive ? 800 : 300,
    extraWide: channelFilterActive ? 400 : 120,
  });
  let rows = db
    .prepare(
      `
        SELECT payload
        FROM youtube_videos
        ${whereSql}
        ORDER BY published_at DESC
        LIMIT @scanLimit
      `,
    )
    .all({ ...params, scanLimit })
    .map((row) => parsePayload('youtube_videos.payload', row.payload, null))
    .filter(Boolean);
  if (channelFilterActive) {
    rows = rows.filter((item) => itemMatchesYoutubeChannelHandles(item, channelHandles));
  }
  if (rows.length === 0) {
    const fallbackWhereSql = baseWhere.length ? `WHERE ${baseWhere.join(' AND ')}` : '';
    const { bucket: _bucket, bucketList: _bucketList, ...fallbackParams } = params;
    rows = db
      .prepare(
        `
          SELECT payload
          FROM youtube_videos
          ${fallbackWhereSql}
          ORDER BY published_at DESC
          LIMIT @scanLimit
        `,
      )
      .all({ ...fallbackParams, scanLimit })
      .map((row) => parsePayload('youtube_videos.payload', row.payload, null))
      .filter(Boolean);
    if (channelFilterActive) {
      rows = rows.filter((item) => itemMatchesYoutubeChannelHandles(item, channelHandles));
    }
  }
  const filtered = filterYoutube(rows, {
    searchParams: {
      get: (key) => {
        if (key === 'q') return options.q || null;
        if (key === 'channel') return options.channel || null;
        if (key === 'sort') return sort;
        if (key === 'channelHandles') return channelHandles.length ? channelHandles.join(',') : null;
        return null;
      },
    },
  });
  const paged = pagination(filtered, { limit: safeLimit, offset: safeOffset });
  const hasMore = paged.hasMore || rows.length >= scanLimit;
  return {
    rows: paged.rows.map(publicYoutube),
    total: paged.total,
    limit: safeLimit,
    offset: safeOffset,
    hasMore,
    nextOffset: hasMore ? safeOffset + paged.rows.length : null,
  };
}

export function queryPublicYoutubeChannelsInDb(db) {
  const settingsRow = db.prepare("SELECT payload FROM app_settings WHERE id = 'app'").get();
  const settings = settingsRow ? parsePayload('app_settings.app', settingsRow.payload, {}) : {};
  const configuredHandles = listActiveYoutubeChannelHandles(settings);
  const byHandle = new Map();

  for (const handle of configuredHandles) {
    byHandle.set(handle.toLowerCase(), {
      handle,
      title: `@${handle}`,
      count: 0,
      latestAt: null,
      order: byHandle.size,
      configured: true,
    });
  }

  const rows = db
    .prepare(
      `
        SELECT payload
        FROM youtube_videos
        ORDER BY published_at DESC, fetched_at DESC
        LIMIT 1000
      `,
    )
    .all()
    .map((row) => parsePayload('youtube_videos.payload', row.payload, null))
    .filter(Boolean);

  for (const item of rows) {
    const handle = String(item.channelHandle || '').trim();
    if (!handle) continue;
    const key = handle.toLowerCase();
    const prev = byHandle.get(key);
    const latestAt = item.publishedAt || item.fetchedAt || item.updatedAt || null;
    if (prev) {
      prev.count += 1;
      if (latestAt && (!prev.latestAt || String(latestAt) > String(prev.latestAt))) prev.latestAt = latestAt;
      if (item.channel && prev.title === `@${prev.handle}`) prev.title = String(item.channel);
      continue;
    }
    byHandle.set(key, {
      handle,
      title: item.channel ? String(item.channel) : `@${handle}`,
      count: 1,
      latestAt,
      order: byHandle.size,
      configured: false,
    });
  }

  return [...byHandle.values()].sort((a, b) => {
    if (a.configured !== b.configured) return a.configured ? -1 : 1;
    return a.order - b.order || String(a.title).localeCompare(String(b.title));
  });
}

export function queryPublicNewsSourcesInDb(db, { category = '' } = {}) {
  const cat = String(category || '').trim().toLowerCase();
  let allowedNames = null;
  if (cat) {
    const rows = db
      .prepare(
        `
          SELECT DISTINCT source_name, provider
          FROM news_items
          WHERE category = @category OR (@category = 'global' AND provider = 'financialjuice')
        `,
      )
      .all({ category: cat });
    allowedNames = new Set(rows.map((row) => String(row.source_name || '').trim()).filter(Boolean));
    if (cat === 'global') allowedNames.add('Financial Juice');
  }
  const rows = db
    .prepare(
      `
        SELECT payload, category, name, enabled, hidden
        FROM news_sources
        ${cat ? 'WHERE category = @category' : ''}
        ORDER BY position ASC, name ASC
      `,
    )
    .all(cat ? { category: cat } : {});
  return rows
    .map((row) => parsePayload('news_sources.payload', row.payload, null))
    .filter(Boolean)
    .map((s) => ({
      id: String(s.id || '').trim(),
      name: String(s.name || '').trim(),
      category: String(s.category || 'global'),
      hidden: s.hidden === true,
      enabled: s.enabled !== false,
      order: Number(s.order) || 0,
    }))
    .filter((s) => s.id && s.name)
    .filter((s) => (!allowedNames ? true : allowedNames.has(s.name)))
    .filter((s) => !s.hidden && s.enabled)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function urlLike(getter) {
  return {
    searchParams: {
      get: (key) => getter(key) || null,
    },
  };
}

function marketQuotePrefilterSql(options) {
  const where = [];
  const params = {};
  const segment = String(options.segment || '').trim();
  if (segment) {
    where.push('segment = @segment');
    params.segment = segment;
  }
  const symbols = String(options.symbols || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (symbols.length > 0) {
    where.push(`UPPER(symbol) IN (${symbols.map((_, index) => `@symbol${index}`).join(', ')})`);
    symbols.forEach((symbol, index) => {
      params[`symbol${index}`] = symbol;
    });
  }
  const q = String(options.q || '').trim().toLowerCase();
  if (q) {
    where.push('(LOWER(COALESCE(symbol, "")) LIKE @q OR LOWER(COALESCE(segment, "")) LIKE @q OR LOWER(payload) LIKE @q)');
    params.q = `%${q}%`;
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export function queryPublicMarketQuotesInDb(db, options = {}) {
  const { limit: safeLimit, offset: safeOffset } = listOffsetLimit(options, 30);
  const { whereSql, params } = marketQuotePrefilterSql(options);
  const wideScan = Boolean(options.q || options.symbols);
  const scanLimit = compactScanLimit({ limit: safeLimit, offset: safeOffset, wide: wideScan });
  const rows = db
    .prepare(
      `
        SELECT payload
        FROM market_quotes
        ${whereSql}
        ORDER BY segment ASC, symbol ASC, fetched_at DESC
        LIMIT @scanLimit
      `,
    )
    .all({ ...params, scanLimit })
    .map((row) => parsePayload('market_quotes.payload', row.payload, null))
    .filter(Boolean);
  const filtered = filterMarketQuotes(
    rows,
    urlLike((key) => {
      if (key === 'segment') return options.segment || null;
      if (key === 'symbols') return options.symbols || null;
      if (key === 'q') return options.q || null;
      return null;
    }),
  );
  const paged = pagination(filtered, { limit: safeLimit, offset: safeOffset });
  const hasMore = paged.hasMore || rows.length >= scanLimit;
  return {
    rows: paged.rows.map(publicMarketQuote),
    total: paged.total,
    limit: safeLimit,
    offset: safeOffset,
    hasMore,
    nextOffset: hasMore ? safeOffset + paged.rows.length : null,
  };
}

export function queryPublicCoinMarketsInDb(db, options = {}) {
  const { limit: safeLimit, offset: safeOffset } = listOffsetLimit(options, 30);
  const q = String(options.q || '').trim().toLowerCase();
  const whereSql = q
    ? 'WHERE LOWER(COALESCE(symbol, "")) LIKE @q OR LOWER(payload) LIKE @q'
    : '';
  const params = q ? { q: `%${q}%` } : {};
  const scanLimit = compactScanLimit({
    limit: safeLimit,
    offset: safeOffset,
    wide: true,
    minWide: q ? 300 : 1000,
    extraWide: q ? 120 : 300,
  });
  const rows = db
    .prepare(
      `
        SELECT payload
        FROM coin_markets
        ${whereSql}
        ORDER BY fetched_at DESC
        LIMIT @scanLimit
      `,
    )
    .all({ ...params, scanLimit })
    .map((row) => parsePayload('coin_markets.payload', row.payload, null))
    .filter(Boolean);
  const filtered = filterCoinMarkets(rows, urlLike((key) => (key === 'q' ? options.q || null : null)));
  const paged = pagination(filtered, { limit: safeLimit, offset: safeOffset });
  const hasMore = paged.hasMore || rows.length >= scanLimit;
  return {
    rows: paged.rows.map(publicCoinMarket),
    total: paged.total,
    limit: safeLimit,
    offset: safeOffset,
    hasMore,
    nextOffset: hasMore ? safeOffset + paged.rows.length : null,
  };
}

export function readPublicMarketListsInDb(db) {
  return db
    .prepare('SELECT payload FROM market_lists ORDER BY position ASC')
    .all()
    .map((row) => parsePayload('market_lists.payload', row.payload, null))
    .filter(Boolean);
}

export function readPublicMarketListInDb(db, key) {
  const row = db.prepare('SELECT payload FROM market_lists WHERE list_key = ?').get(String(key || ''));
  return row ? parsePayload('market_lists.payload', row.payload, null) : null;
}

export function readAppSettingsInDb(db) {
  const row = db.prepare("SELECT payload FROM app_settings WHERE id = 'app'").get();
  return row ? parsePayload('app_settings.payload', row.payload, {}) : {};
}

function textOrNull(value) {
  if (value == null) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

export function upsertMarketQuoteRowsInDb(db, rows = []) {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `
      INSERT INTO market_quotes (id, position, symbol, segment, quote_time, fetched_at, payload, updated_at)
      VALUES (@id, 0, @symbol, @segment, @quoteTime, @fetchedAt, @payload, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        symbol = excluded.symbol,
        segment = excluded.segment,
        quote_time = excluded.quote_time,
        fetched_at = excluded.fetched_at,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `,
  );
  for (const row of rows) {
    if (!row?.id) continue;
    stmt.run({
      id: String(row.id),
      symbol: textOrNull(row.symbol),
      segment: textOrNull(row.segment),
      quoteTime: textOrNull(row.quoteTime),
      fetchedAt: textOrNull(row.fetchedAt),
      payload: JSON.stringify(row),
      updatedAt: textOrNull(row.updatedAt) || now,
    });
  }
}

export function queryPublicCalendarInDb(db, options = {}) {
  const where = [];
  const params = {};
  if (options.from) {
    where.push('event_date >= @from');
    params.from = String(options.from);
  }
  if (options.to) {
    where.push('event_date <= @to');
    params.to = String(options.to);
  }
  if (options.type) {
    where.push('event_type = @type');
    params.type = String(options.type);
  }
  const symbol = String(options.symbol || '').trim().toUpperCase();
  if (symbol) {
    where.push('(UPPER(COALESCE(symbol, "")) = @symbol OR UPPER(payload) LIKE @symbolLike)');
    params.symbol = symbol;
    params.symbolLike = `%${symbol}%`;
  }
  const q = String(options.q || '').trim().toLowerCase();
  if (q) {
    where.push('(LOWER(COALESCE(symbol, "")) LIKE @q OR LOWER(COALESCE(event_type, "")) LIKE @q OR LOWER(payload) LIKE @q)');
    params.q = `%${q}%`;
  }
  const hasDateRange = Boolean(options.from || options.to);
  const defaultLimit = hasDateRange ? 10000 : 500;
  const limit = Math.min(10000, Math.max(1, Math.floor(Number(options.limit)) || defaultLimit));
  params.limit = limit;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `
        SELECT payload
        FROM calendar_events
        ${whereSql}
        ORDER BY event_date ASC, event_at ASC
        LIMIT @limit
      `,
    )
    .all(params)
    .map((row) => parsePayload('calendar_events.payload', row.payload, null))
    .filter(Boolean);
  return filterCalendar(
    rows,
    urlLike((key) => {
      if (key === 'from') return options.from || null;
      if (key === 'to') return options.to || null;
      if (key === 'type') return options.type || null;
      if (key === 'symbol') return options.symbol || null;
      if (key === 'q') return options.q || null;
      return null;
    }),
  ).map(publicCalendarEvent);
}

export function queryPublicCalendarDateSummariesInDb(db, options = {}) {
  const where = ['event_date IS NOT NULL', 'event_date != ""'];
  const params = {};
  if (options.from) {
    where.push('event_date >= @from');
    params.from = String(options.from);
  }
  if (options.to) {
    where.push('event_date <= @to');
    params.to = String(options.to);
  }
  if (options.type) {
    where.push('event_type = @type');
    params.type = String(options.type);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `
        SELECT event_date AS date,
               event_type AS type,
               COUNT(*) AS count
        FROM calendar_events
        ${whereSql}
        GROUP BY event_date, event_type
        ORDER BY event_date ASC
      `,
    )
    .all(params);
  const byDate = new Map();
  for (const row of rows) {
    const date = String(row.date || '').slice(0, 10);
    if (!date) continue;
    const type = String(row.type || '').trim();
    const count = Number(row.count) || 0;
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        total: 0,
        counts: {
          earnings: 0,
          macro: 0,
          fed: 0,
          fomc: 0,
        },
      });
    }
    const item = byDate.get(date);
    item.total += count;
    if (Object.prototype.hasOwnProperty.call(item.counts, type)) {
      item.counts[type] += count;
    }
  }
  return Array.from(byDate.values());
}

export function queryPublicConcallsInDb(db, options = {}) {
  const { limit: safeLimit, offset: safeOffset } = listOffsetLimit(options, 30);
  const where = [];
  const params = {};
  const symbol = String(options.symbol || '').trim().toUpperCase();
  if (symbol) {
    where.push('UPPER(symbol) = @symbol');
    params.symbol = symbol;
  }
  if (options.year) {
    where.push('fiscal_year = @year');
    params.year = Number(options.year);
  }
  if (options.quarter) {
    where.push('fiscal_quarter = @quarter');
    params.quarter = Number(options.quarter);
  }
  if (options.from) {
    where.push("(earnings_date IS NULL OR earnings_date = '' OR earnings_date >= @from)");
    params.from = String(options.from);
  }
  if (options.to) {
    where.push("(earnings_date IS NULL OR earnings_date = '' OR earnings_date <= @to)");
    params.to = String(options.to);
  }
  const q = String(options.q || '').trim().toLowerCase();
  if (q) {
    where.push('(LOWER(COALESCE(symbol, "")) LIKE @q OR LOWER(payload) LIKE @q)');
    params.q = `%${q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const scanLimit = Math.min(2000, Math.max(safeLimit + safeOffset + 120, 300));
  const rows = db
    .prepare(
      `
        SELECT payload
        FROM concall_transcripts
        ${whereSql}
        ORDER BY earnings_date DESC, symbol ASC
        LIMIT @scanLimit
      `,
    )
    .all({ ...params, scanLimit })
    .map((row) => parsePayload('concall_transcripts.payload', row.payload, null))
    .filter(Boolean);
  const filtered = filterConcalls(
    rows,
    urlLike((key) => {
      if (key === 'symbol') return options.symbol || null;
      if (key === 'year' || key === 'fiscalYear') return options.year || null;
      if (key === 'quarter' || key === 'fiscalQuarter') return options.quarter || null;
      if (key === 'from') return options.from || null;
      if (key === 'to') return options.to || null;
      if (key === 'q') return options.q || null;
      if (key === 'includeTranscript') return options.includeTranscript ? '1' : null;
      return null;
    }),
  );
  const paged = pagination(filtered, { limit: safeLimit, offset: safeOffset });
  const hasMore = paged.hasMore || rows.length >= scanLimit;
  return {
    rows: paged.rows.map(publicConcall),
    total: paged.total,
    limit: safeLimit,
    offset: safeOffset,
    hasMore,
    nextOffset: hasMore ? safeOffset + paged.rows.length : null,
  };
}
