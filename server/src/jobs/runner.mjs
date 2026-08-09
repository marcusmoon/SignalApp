import {
  acquirePollingJobLock,
  ensureNewsSourcesFromItems,
  getPollingJob,
  listCollectionPayloads,
  listYoutubeVideos,
  nowIso,
  patchCollectionPayload,
  patchPollingJob,
  patchPollingJobRun,
  readSingletonPayload,
  releasePollingJobLock,
  upsertCollectionRows,
  pruneCommunityPostsForSource,
  pruneCoinMarketsKeepingSymbols,
  upsertById,
  upsertPollingJobRun,
} from '../db.mjs';
import { config } from '../config.mjs';
import { mergeAutoHashtagsIntoNewsItem } from '../newsHashtags.mjs';
import { fetchFinnhubEarningsCalendar, fetchFinnhubEconomicCalendar, fetchFinnhubMarketHolidays } from '../providers/calendar/finnhub.mjs';
import { fetchYahooDailyPriceSeries } from '../providers/market/yahooDailyBars.mjs';
import { fetchYahooKrxMarketQuotes } from '../providers/market/yahooKrxQuotes.mjs';
import { fetchYahooIndexMarketQuotes } from '../providers/market/yahooIndexQuotes.mjs';
import { fetchYahooFxMarketQuotes } from '../providers/market/yahooFxQuotes.mjs';
import { baseCryptoSymbol, fetchYahooCoinMarkets } from '../providers/market/yahooCoinQuotes.mjs';
import { fetchMarketQuotes, fetchMcapQuotes, fetchMcapUniverse } from '../providers/market/index.mjs';
import { fetchFinancialJuiceRssNews, reconcileFinancialJuiceNewsItems } from '../providers/news/financialJuiceRss.mjs';
import { fetchFinnhubMarketNews, reconcileFinnhubNewsItems } from '../providers/news/finnhub.mjs';
import { fetchNewswireRssNews, reconcileRssNewsItems } from '../providers/news/rssNews.mjs';
import { fetchDartFilings } from '../providers/news/dartFilings.mjs';
import { fetchSecEdgarFilings } from '../providers/news/secEdgar.mjs';
import { translateNews } from '../providers/translation/index.mjs';
import { fetchNaverCafeLikeusstockFree } from '../providers/community/naverCafeLikeusstock.mjs';
import { fetchSaveUserNews } from '../providers/community/saveUserNews.mjs';
import { fetchYoutubeEconomy, fetchYoutubeVideosByIds } from '../providers/youtube/youtube.mjs';
import { normalizeYoutubeCurationHandles } from '../youtubeCuration.mjs';
import { phasesForJob, paramsForPhase, runModeForJob } from './jobPhases.mjs';
import {
  createJobRunProgress,
  createMcapProgressHandler,
  jobHasStoredNewsReconcile,
  jobNeedsFreshContext,
  jobUsesMcapProgress,
} from './jobRunProgress.mjs';
import { ensureRssSourcesCatalog, getRssSource, rssSourceParams } from '../db/rssSources.mjs';
import { buildScreenerPoolSnapshot } from '../screener/buildScreenerPoolSnapshot.mjs';

function addSecondsIso(seconds) {
  return new Date(Date.now() + Number(seconds || 300) * 1000).toISOString();
}

function jobLockTtlMs(job) {
  const seconds = Number(job?.lockTtlSeconds);
  if (Number.isFinite(seconds) && seconds > 0) return Math.max(60_000, seconds * 1000);
  return config.jobLockTtlMs;
}

function translationId(newsItemId, locale) {
  return `${newsItemId}:${locale}`;
}

function marketListSymbols(db, key) {
  return (db.marketLists || []).find((list) => list.key === key)?.symbols || [];
}

function preferredYahooByKrxSymbols(db, symbols) {
  const wanted = new Set(
    (Array.isArray(symbols) ? symbols : [])
      .map((value) => String(value || '').trim().toUpperCase())
      .filter((value) => /^\d{6}$/.test(value)),
  );
  const map = {};
  for (const row of db.marketQuotes || []) {
    const krx = String(row.krxSymbol || (/^\d{6}$/.test(String(row.symbol || '')) ? row.symbol : ''))
      .trim()
      .toUpperCase();
    const yahoo = String(row.regularSession?.yahooSymbol || row.yahooSymbol || '').trim().toUpperCase();
    if (!krx || !wanted.has(krx) || !yahoo) continue;
    if (!map[krx]) map[krx] = yahoo;
  }
  return map;
}

function dailyBarInstruments(db, params = {}) {
  const listKeys = Array.isArray(params.listKeys) ? params.listKeys : [];
  const symbols = [
    ...(Array.isArray(params.symbols) ? params.symbols : []),
    ...listKeys.flatMap((key) => marketListSymbols(db, key)),
  ];
  const preferredYahoo = preferredYahooByKrxSymbols(db, symbols);
  const bySymbol = new Map();
  for (const symbol of symbols) {
    const normalized = String(symbol || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!normalized || bySymbol.has(normalized)) continue;
    const isKr = /^\d{6}$/.test(normalized);
    bySymbol.set(normalized, {
      symbol: normalized,
      displaySymbol: normalized,
      name: normalized,
      currency: isKr ? 'KRW' : 'USD',
      ...(isKr && preferredYahoo[normalized] ? { yahooSymbol: preferredYahoo[normalized] } : {}),
    });
  }
  const explicit = Array.isArray(params.instruments) ? params.instruments : [];
  for (const item of explicit) {
    const symbol = String(item?.symbol || item?.krxSymbol || item?.code || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!symbol) continue;
    const previous = bySymbol.get(symbol) || {};
    bySymbol.set(symbol, {
      ...previous,
      ...item,
      symbol,
      yahooSymbol:
        String(item?.yahooSymbol || item?.yahooTicker || previous.yahooSymbol || preferredYahoo[symbol] || '')
          .trim()
          .toUpperCase() || undefined,
    });
  }
  return [...bySymbol.values()];
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d;
}

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

function bucketList(item) {
  const buckets = Array.isArray(item?.sortBuckets) ? item.sortBuckets : [];
  if (item?.sortBucket) buckets.push(item.sortBucket);
  return [...new Set(buckets.map((bucket) => String(bucket || '').trim()).filter(Boolean))];
}

function upsertYoutubeVideo(list, row) {
  const previous = list.find((item) => item.id === row.id);
  const mergedBuckets = [...new Set([...bucketList(previous), ...bucketList(row)])];
  const next = { ...row };
  if (mergedBuckets.length > 0) {
    next.sortBuckets = mergedBuckets;
    next.sortBucket = row.sortBucket || previous?.sortBucket || mergedBuckets[0];
  }
  return upsertById(list, next);
}

async function readJobContext(job) {
  const provider = String(job?.provider || '');
  const handler = String(job?.handler || '');
  const context = {};

  if (provider === 'rss') {
    context.rssSources = await listCollectionPayloads('rssSources');
  }
  if (jobHasStoredNewsReconcile(job)) {
    context.newsItems = await listCollectionPayloads('newsItems');
  }
  if (
    provider === 'sec' ||
    provider === 'dart' ||
    (provider === 'finnhub' &&
      (handler === 'market_quotes' || handler === 'market_quotes_mcap' || handler === 'market_quotes_mcap_universe')) ||
    (provider === 'yahoo' &&
      (handler === 'daily_bars' ||
        handler === 'market_quotes_kr' ||
        handler === 'market_quotes_indices' ||
        handler === 'market_quotes_fx' ||
        handler === 'coin_markets'))
  ) {
    context.marketLists = await listCollectionPayloads('marketLists');
  }
  if (provider === 'yahoo' && (handler === 'market_quotes_kr' || handler === 'daily_bars')) {
    context.marketQuotes = await listCollectionPayloads('marketQuotes');
  }
  if (provider === 'youtube') {
    const [appSettings, youtubeVideos] = await Promise.all([
      readSingletonPayload('appSettings'),
      listYoutubeVideos(),
    ]);
    context.appSettings = appSettings || {};
    context.youtubeVideos = youtubeVideos;
  }

  return context;
}

async function ensureNewsSourcesForRows(newsItems) {
  if (!Array.isArray(newsItems) || newsItems.length === 0) return;
  const [newsSources, newsSourceSettings] = await Promise.all([
    listCollectionPayloads('newsSources'),
    readSingletonPayload('newsSourceSettings'),
  ]);
  const db = {
    newsItems,
    newsSources,
    newsSourceSettings: newsSourceSettings || {},
  };
  const changed = ensureNewsSourcesFromItems(db);
  if (changed) await upsertCollectionRows('newsSources', db.newsSources);
}

async function saveNewsRows(rows, { onHeartbeat } = {}) {
  const savedAt = nowIso();
  const safeRows = rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt || savedAt,
    createdAt: row.createdAt || savedAt,
  }));
  await upsertCollectionRows('newsItems', safeRows);
  await ensureNewsSourcesForRows(safeRows);
}

async function saveDisclosureRows(rows) {
  const savedAt = nowIso();
  const safeRows = rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt || savedAt,
    createdAt: row.createdAt || savedAt,
  }));
  await upsertCollectionRows('disclosures', safeRows);
}

async function saveYoutubeRows(rows) {
  const current = await listYoutubeVideos();
  const changed = [];
  for (const row of rows) changed.push(upsertYoutubeVideo(current, row));
  if (changed.length > 0) await upsertCollectionRows('youtubeVideos', changed);
}

async function executeHandler(job, dbBefore, { onProgress, phase = 'latest' } = {}) {
  const params = paramsForPhase(job, phase);
  const effective = { ...job, params };

  if (effective.provider === 'finnhub' && effective.handler === 'market_news') {
    if (phase === 'reconcile') {
      const newsItems = dbBefore.newsItems || (await listCollectionPayloads('newsItems'));
      const category = params?.category || 'general';
      const limit = Math.max(1, Math.min(200, Number(params?.limit || 100) || 100));
      return { kind: 'news', rows: reconcileFinnhubNewsItems(newsItems, { category, limit }) };
    }
    return { kind: 'news', rows: await fetchFinnhubMarketNews(params) };
  }
  if (effective.provider === 'rss' && effective.handler === 'financial_juice') {
    const sourceId = params?.rssSourceId || (Array.isArray(params?.rssSourceIds) ? params.rssSourceIds[0] : null);
    const source = getRssSource(dbBefore, sourceId);
    if (!source || source.enabled === false) throw new Error('RSS_SOURCE_NOT_CONFIGURED');
    if (phase === 'reconcile') {
      const newsItems = dbBefore.newsItems || (await listCollectionPayloads('newsItems'));
      const limit = Math.max(1, Math.min(200, Number(params?.limit || 60) || 60));
      return { kind: 'news', rows: reconcileFinancialJuiceNewsItems(newsItems, limit) };
    }
    return { kind: 'news', rows: await fetchFinancialJuiceRssNews(rssSourceParams(source, params || {})) };
  }
  if (effective.provider === 'rss' && effective.handler === 'newswire_rss') {
    const ids = Array.isArray(params.rssSourceIds)
      ? params.rssSourceIds
      : params.rssSourceId
        ? [params.rssSourceId]
        : [];
    const sources = ids.map((id) => getRssSource(dbBefore, id)).filter((source) => source && source.enabled !== false);
    if (sources.length === 0) throw new Error('RSS_SOURCE_NOT_CONFIGURED');
    if (phase === 'reconcile') {
      const newsItems = dbBefore.newsItems || (await listCollectionPayloads('newsItems'));
      const limit = Math.max(1, Math.min(200, Number(params?.limit || 60) || 60));
      const providerIds = sources.map((source) => source.providerId || source.id).filter(Boolean);
      return { kind: 'news', rows: reconcileRssNewsItems(newsItems, { providerIds, limit }) };
    }
    const rows = [];
    ensureRssSourcesCatalog(dbBefore);
    for (const source of sources) {
      rows.push(...(await fetchNewswireRssNews(rssSourceParams(source, params))));
    }
    return { kind: 'news', rows };
  }
  if (effective.provider === 'sec' && effective.handler === 'company_filings') {
    const listKey = params?.listKey || 'default_watchlist';
    const symbols = Array.isArray(params?.symbols) && params.symbols.length > 0 ? params.symbols : marketListSymbols(dbBefore, listKey);
    return { kind: 'disclosures', rows: await fetchSecEdgarFilings({ ...(params || {}), symbols }) };
  }
  if (effective.provider === 'dart' && effective.handler === 'company_filings') {
    const listKey = params?.listKey || 'korea_watchlist';
    const symbols = Array.isArray(params?.symbols) && params.symbols.length > 0 ? params.symbols : marketListSymbols(dbBefore, listKey);
    return { kind: 'disclosures', rows: await fetchDartFilings({ ...(params || {}), symbols }) };
  }
  if (effective.provider === 'finnhub' && effective.handler === 'economic_calendar') {
    const rows = await fetchFinnhubEconomicCalendar(params || {});
    if (rows.length === 0) {
      console.warn(
        `[job:${job.jobKey}] economic calendar returned 0 rows — check Finnhub Economic Data subscription or Admin provider key`,
      );
    }
    return { kind: 'calendar', rows };
  }
  if (effective.provider === 'finnhub' && effective.handler === 'earnings_calendar') {
    return { kind: 'calendar', rows: await fetchFinnhubEarningsCalendar(params || {}) };
  }
  if (effective.provider === 'finnhub' && effective.handler === 'market_holidays') {
    return { kind: 'calendar', rows: await fetchFinnhubMarketHolidays(params || {}) };
  }
  if (effective.provider === 'youtube' && effective.handler === 'youtube_economy') {
    if (phase === 'reconcile') {
      const limit = Math.max(1, Math.min(200, Number(params?.limit || 80)));
      const ids = [...(dbBefore.youtubeVideos || [])]
        .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
        .slice(0, limit)
        .map((item) => item.videoId || item.providerItemId)
        .filter(Boolean);
      return { kind: 'youtube', rows: await fetchYoutubeVideosByIds(ids, { order: 'preserve' }) };
    }
    const handles = normalizeYoutubeCurationHandles(dbBefore.appSettings?.youtubeCurationHandles);
    return { kind: 'youtube', rows: await fetchYoutubeEconomy({ ...(params || {}), handles }) };
  }
  if (effective.provider === 'youtube' && effective.handler === 'youtube_economy_reconcile') {
    const limit = Math.max(1, Math.min(200, Number(params?.limit || 80)));
    const ids = [...(dbBefore.youtubeVideos || [])]
      .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
      .slice(0, limit)
      .map((item) => item.videoId || item.providerItemId)
      .filter(Boolean);
    return { kind: 'youtube', rows: await fetchYoutubeVideosByIds(ids, { order: 'preserve' }) };
  }
  if (effective.provider === 'finnhub' && effective.handler === 'market_quotes') {
    const listKey =
      params?.listKey ||
      (params?.segment === 'etf'
        ? 'etf_symbols'
        : params?.segment === 'popular'
          ? 'popular_symbols'
          : null);
    const symbols = listKey
      ? marketListSymbols(dbBefore, listKey)
      : Array.isArray(params?.symbols) && params.symbols.length > 0
        ? params.symbols
        : [];
    return { kind: 'marketQuotes', rows: await fetchMarketQuotes({ ...(params || {}), symbols }) };
  }
  if (effective.provider === 'yahoo' && effective.handler === 'market_quotes_kr') {
    // App quotes only (korea_watchlist). Screener has its own Yahoo fetch in screener_pool_kr.
    const listKey = params?.listKey || 'korea_watchlist';
    const symbols = Array.isArray(params?.symbols) && params.symbols.length > 0
      ? params.symbols
      : marketListSymbols(dbBefore, listKey);
    const segment = String(params?.segment || 'korea').trim() || 'korea';
    return {
      kind: 'marketQuotes',
      rows: await fetchYahooKrxMarketQuotes({
        symbols,
        segment,
        preferredYahooBySymbol: preferredYahooByKrxSymbols(dbBefore, symbols),
      }),
    };
  }
  if (effective.provider === 'yahoo' && effective.handler === 'market_quotes_indices') {
    const listKey = params?.listKey || 'home_indices';
    const symbols = Array.isArray(params?.symbols) && params.symbols.length > 0
      ? params.symbols
      : marketListSymbols(dbBefore, listKey);
    const segment = String(params?.segment || 'indices').trim() || 'indices';
    return {
      kind: 'marketQuotes',
      rows: await fetchYahooIndexMarketQuotes({ symbols, segment }),
    };
  }
  if (effective.provider === 'yahoo' && effective.handler === 'market_quotes_fx') {
    const listKey = params?.listKey || 'home_fx';
    const symbols = Array.isArray(params?.symbols) && params.symbols.length > 0
      ? params.symbols
      : marketListSymbols(dbBefore, listKey);
    const segment = String(params?.segment || 'fx').trim() || 'fx';
    return {
      kind: 'marketQuotes',
      rows: await fetchYahooFxMarketQuotes({ symbols, segment }),
    };
  }
  if (effective.provider === 'finnhub' && effective.handler === 'market_quotes_mcap') {
    const configuredSymbols = marketListSymbols(dbBefore, params?.listKey || 'mcap_top_symbols');
    return {
      kind: 'marketQuotes',
      rows: await fetchMcapQuotes({
        ...(params || {}),
        symbols: configuredSymbols.length > 0 ? configuredSymbols : marketListSymbols(dbBefore, 'mcap_universe'),
        onProgress,
      }),
    };
  }
  if (effective.provider === 'finnhub' && effective.handler === 'market_quotes_mcap_universe') {
    return {
      kind: 'marketList',
      rows: [
        await fetchMcapUniverse({
          ...(params || {}),
          symbols: marketListSymbols(dbBefore, params?.sourceListKey || 'mcap_universe'),
          targetListKey: params?.targetListKey || 'mcap_top_symbols',
          onProgress,
        }),
      ],
    };
  }
  if (effective.provider === 'yahoo' && effective.handler === 'coin_markets') {
    const listKey = params?.listKey || 'crypto_symbols';
    const symbols =
      Array.isArray(params?.symbols) && params.symbols.length > 0
        ? params.symbols
        : marketListSymbols(dbBefore, listKey);
    const limit = Math.max(1, Math.min(50, Number(params?.limit) || symbols.length || 10));
    const selected = symbols.slice(0, limit);
    return {
      kind: 'coinMarkets',
      keepSymbols: selected.map((value) => baseCryptoSymbol(value)).filter(Boolean),
      rows: await fetchYahooCoinMarkets({ symbols: selected }),
    };
  }
  if (effective.provider === 'yahoo' && effective.handler === 'daily_bars') {
    return {
      kind: 'priceSeries',
      rows: await fetchYahooDailyPriceSeries({
        ...(params || {}),
        instruments: dailyBarInstruments(dbBefore, params || {}),
      }),
    };
  }
  if (effective.provider === 'naver_cafe' && effective.handler === 'likeusstock_free') {
    return { kind: 'community', rows: await fetchNaverCafeLikeusstockFree(params || {}) };
  }
  if (effective.provider === 'save' && effective.handler === 'user_news') {
    return { kind: 'community', rows: await fetchSaveUserNews(params || {}) };
  }
  if (effective.provider === 'signal' && effective.handler === 'screener_pool_snapshot') {
    const market = String(params?.market || 'kr').trim().toLowerCase() || 'kr';
    const dailyBarRange = String(params?.dailyBarRange || params?.range || '')
      .trim()
      .toLowerCase();
    const snapshot = await buildScreenerPoolSnapshot({
      market,
      ...(dailyBarRange ? { dailyBarRange } : {}),
    });
    return { kind: 'screenerSnapshot', rows: [snapshot] };
  }
  throw new Error(`UNKNOWN_JOB_HANDLER:${job.provider}:${job.handler}`);
}

async function persistHandlerResult(result, rows, { onHeartbeat } = {}) {
  const directCollectionByKind = {
    calendar: 'calendarEvents',
    marketQuotes: 'marketQuotes',
    marketList: 'marketLists',
    priceSeries: 'priceSeries',
    coinMarkets: 'coinMarkets',
    community: 'communityPosts',
    screenerSnapshot: 'screenerSnapshots',
  };
  const directCollection = directCollectionByKind[result.kind];
  if (directCollection) {
    const savedAt = nowIso();
    const safeRows = rows.map((row) => ({ ...row, updatedAt: row.updatedAt || savedAt, createdAt: row.createdAt || savedAt }));
    await upsertCollectionRows(directCollection, safeRows);
    if (result.kind === 'coinMarkets' && Array.isArray(result.keepSymbols)) {
      await pruneCoinMarketsKeepingSymbols(result.keepSymbols);
    }
    if (result.kind === 'community') {
      const idsBySource = new Map();
      for (const row of safeRows) {
        const source = row.source;
        const providerItemId = row.providerItemId;
        if (!source || !providerItemId) continue;
        if (!idsBySource.has(source)) idsBySource.set(source, []);
        idsBySource.get(source).push(providerItemId);
      }
      for (const [source, providerItemIds] of idsBySource) {
        await pruneCommunityPostsForSource(source, providerItemIds);
      }
    }
  } else if (result.kind === 'news') {
    await saveNewsRows(rows, { onHeartbeat });
  } else if (result.kind === 'disclosures') {
    await saveDisclosureRows(rows);
  } else if (result.kind === 'youtube') {
    await saveYoutubeRows(rows);
  }
}

export async function runPollingJob(jobKey, { force = false, trigger = 'schedule', mode = 'full' } = {}) {
  const jobForLock = await getPollingJob(jobKey);
  if (!jobForLock) throw new Error(`JOB_NOT_FOUND:${jobKey}`);
  if (!force && !jobForLock.enabled) throw new Error(`JOB_DISABLED:${jobKey}`);

  const lock = await acquirePollingJobLock(jobKey, { ttlMs: jobLockTtlMs(jobForLock) });
  if (!lock) {
    console.warn(`[job:${jobKey}] skipped because another worker holds the lock`);
    const skippedAt = nowIso();
    const skippedRun = {
      id: `${jobKey}:${Date.now()}:skipped`,
      jobKey,
      displayName: jobKey,
      domain: null,
      operation: null,
      provider: null,
      handler: null,
      trigger,
      status: 'skipped',
      startedAt: skippedAt,
      finishedAt: skippedAt,
      durationMs: 0,
      resultKind: null,
      itemCount: 0,
      errorMessage: 'JOB_ALREADY_RUNNING',
      progressPhase: null,
      progressDone: 0,
      progressTotal: 0,
      progressPercent: 0,
      progressUpdatedAt: skippedAt,
    };
    skippedRun.displayName = jobForLock.displayName || jobForLock.jobKey;
    skippedRun.domain = jobForLock.domain || null;
    skippedRun.operation = jobForLock.operation || null;
    skippedRun.provider = jobForLock.provider || null;
    skippedRun.handler = jobForLock.handler || null;
    skippedRun.resultKind = jobForLock.domain || null;
    await upsertPollingJobRun(skippedRun);
    await patchPollingJob(jobKey, { ...jobForLock, updatedAt: skippedAt });
    return {
      ...skippedRun,
    };
  }

  let startedTime = Date.now();
  let run = null;
  try {
    const job = await getPollingJob(jobKey);
    if (!job) throw new Error(`JOB_NOT_FOUND:${jobKey}`);
    if (!force && !job.enabled) throw new Error(`JOB_DISABLED:${jobKey}`);

    startedTime = Date.now();
    run = {
      id: `${jobKey}:${Date.now()}`,
      jobKey,
      displayName: job.displayName || job.jobKey,
      domain: job.domain || null,
      operation: job.operation || null,
      provider: job.provider || null,
      handler: job.handler || null,
      trigger,
      status: 'running',
      startedAt: new Date(startedTime).toISOString(),
      finishedAt: null,
      durationMs: null,
      resultKind: null,
      itemCount: 0,
      errorMessage: null,
      progressPhase: null,
      progressDone: 0,
      progressTotal: 0,
      progressPercent: 0,
      progressUpdatedAt: new Date(startedTime).toISOString(),
    };

    await upsertPollingJobRun(run);
    await patchPollingJob(jobKey, {
      ...job,
      lastRunAt: run.startedAt,
      nextRunAt: addSecondsIso(job.intervalSeconds),
      updatedAt: run.startedAt,
    });

    const { touch: touchRunProgress } = createJobRunProgress({
      jobKey,
      job,
      lock,
      runId: run.id,
      jobLockTtlMs,
    });
    const onProgress = jobUsesMcapProgress(job.handler)
      ? createMcapProgressHandler({ jobKey, touch: touchRunProgress })
      : null;

    let dbBefore = await readJobContext(job);
    const phases = phasesForJob(job, runModeForJob(job, mode));
    if (phases.length === 0) throw new Error(`JOB_NO_PHASES:${jobKey}`);

    let totalItems = 0;
    let lastKind = null;
    for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex += 1) {
      const phase = phases[phaseIndex];
      if (jobNeedsFreshContext(job, phase)) {
        dbBefore = await readJobContext(job);
      }
      await touchRunProgress({ progressPhase: phase });
      const result = await executeHandler(job, dbBefore, { onProgress, phase });
      const rows = result.rows || [];
      await persistHandlerResult(result, rows, {
        onHeartbeat: () => touchRunProgress({ progressPhase: phase }),
      });
      totalItems += rows.length;
      lastKind = result.kind;
      if (onProgress && phases.length > 1) {
        const percent = Math.round(((phaseIndex + 1) / phases.length) * 100);
        await patchPollingJobRun(run.id, {
          progressPhase: phase,
          progressPercent: percent,
          progressUpdatedAt: nowIso(),
        });
      }
    }

    const finishedAt = nowIso();
    await patchPollingJob(jobKey, {
      ...job,
      lastRunAt: finishedAt,
      nextRunAt: addSecondsIso(job.intervalSeconds),
      updatedAt: finishedAt,
    });
    await patchPollingJobRun(run.id, {
      status: 'completed',
      finishedAt,
      durationMs: Date.now() - startedTime,
      resultKind: lastKind,
      itemCount: totalItems,
      progressPercent: 100,
      progressUpdatedAt: finishedAt,
    });
    return {
      ...run,
      status: 'completed',
      finishedAt,
      durationMs: Date.now() - startedTime,
      resultKind: lastKind,
      itemCount: totalItems,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedAt = nowIso();
    await patchPollingJob(jobKey, {
      ...jobForLock,
      lastRunAt: failedAt,
      nextRunAt: addSecondsIso(jobForLock.intervalSeconds),
      updatedAt: failedAt,
    });
    if (run) {
      await patchPollingJobRun(run.id, {
        status: 'failed',
        finishedAt: failedAt,
        durationMs: Date.now() - startedTime,
        errorMessage: message,
        progressUpdatedAt: failedAt,
      });
    }
    throw error;
  } finally {
    await releasePollingJobLock(jobKey, lock.token).catch((error) => {
      console.warn(`[job:${jobKey}] failed to release lock`, error?.message || error);
    });
  }
}

export async function retranslateNewsItems({ ids, locale, provider, model, adminId }) {
  const idSet = new Set(Array.isArray(ids) ? ids : []);
  const items = (await listCollectionPayloads('newsItems')).filter((item) => idSet.has(item.id));
  const translations = [];
  for (const item of items) {
    const translated = await translateNews({ newsItem: item, locale, provider, model });
    const { hashtagLabels = [], ...trRest } = translated;
    translations.push({
      id: translationId(item.id, locale),
      newsItemId: item.id,
      ...trRest,
      editedByAdminId: adminId || null,
      editedAt: nowIso(),
      updatedAt: nowIso(),
    });
    if (trRest.status === 'completed') {
      const nextItem = { ...item };
      mergeAutoHashtagsIntoNewsItem(nextItem, hashtagLabels);
      await patchCollectionPayload('newsItems', item.id, nextItem);
    }
  }
  await upsertCollectionRows('newsTranslations', translations);
  return { count: items.length };
}
