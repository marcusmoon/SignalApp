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
  upsertById,
  upsertPollingJobRun,
} from '../db.mjs';
import { config } from '../config.mjs';
import { mergeAutoHashtagsIntoNewsItem } from '../newsHashtags.mjs';
import { fetchFinnhubEarningsCalendar, fetchFinnhubEconomicCalendar, fetchFinnhubMarketHolidays } from '../providers/calendar/finnhub.mjs';
import { fetchCoinGeckoMarkets } from '../providers/market/coingecko.mjs';
import { fetchYahooDailyPriceSeries } from '../providers/market/yahooDailyBars.mjs';
import { fetchMarketQuotes, fetchMcapQuotes, fetchMcapUniverse } from '../providers/market/index.mjs';
import { generateNewsDigestItems } from '../digests/newsDigest.mjs';
import { fetchFinancialJuiceRssNews } from '../providers/news/financialJuiceRss.mjs';
import { fetchFinnhubMarketNews } from '../providers/news/finnhub.mjs';
import { fetchNewswireRssNews } from '../providers/news/rssNews.mjs';
import { fetchDartFilings } from '../providers/news/dartFilings.mjs';
import { fetchSecEdgarFilings } from '../providers/news/secEdgar.mjs';
import { translateNews } from '../providers/translation/index.mjs';
import { fetchYoutubeEconomy, fetchYoutubeVideosByIds } from '../providers/youtube/youtube.mjs';
import { normalizeYoutubeCurationHandles } from '../youtubeCuration.mjs';
import { phasesForJob, paramsForPhase, runModeForJob } from './jobPhases.mjs';
import { ensureRssSourcesCatalog, getRssSource, rssSourceParams } from '../db/rssSources.mjs';

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

function dailyBarInstruments(db, params = {}) {
  const listKeys = Array.isArray(params.listKeys) ? params.listKeys : [];
  const symbols = [
    ...(Array.isArray(params.symbols) ? params.symbols : []),
    ...listKeys.flatMap((key) => marketListSymbols(db, key)),
  ];
  const bySymbol = new Map();
  for (const symbol of symbols) {
    const normalized = String(symbol || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!normalized || bySymbol.has(normalized)) continue;
    bySymbol.set(normalized, {
      symbol: normalized,
      displaySymbol: normalized,
      name: normalized,
      currency: /^\d{6}$/.test(normalized) ? 'KRW' : 'USD',
    });
  }
  const explicit = Array.isArray(params.instruments) ? params.instruments : [];
  for (const item of explicit) {
    const symbol = String(item?.symbol || item?.krxSymbol || item?.code || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!symbol) continue;
    bySymbol.set(symbol, item);
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
  if (
    provider === 'sec' ||
    (provider === 'finnhub' &&
      (handler === 'market_quotes' || handler === 'market_quotes_mcap' || handler === 'market_quotes_mcap_universe')) ||
    (provider === 'yahoo' && handler === 'daily_bars')
  ) {
    context.marketLists = await listCollectionPayloads('marketLists');
  }
  if (provider === 'youtube') {
    const [appSettings, youtubeVideos] = await Promise.all([
      readSingletonPayload('appSettings'),
      listYoutubeVideos(),
    ]);
    context.appSettings = appSettings || {};
    context.youtubeVideos = youtubeVideos;
  }
  if (provider === 'signal' && handler === 'news_digest') {
    context.newsItems = await listCollectionPayloads('newsItems');
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

async function autoTranslateNewsDirect(newsItems) {
  const settings = (await listCollectionPayloads('translationSettings')).filter((s) => s.enabled && s.autoTranslateNews);
  if (settings.length === 0 || !Array.isArray(newsItems) || newsItems.length === 0) return;
  const existingTranslations = await listCollectionPayloads('newsTranslations');
  const byId = new Map(existingTranslations.map((row) => [row.id, row]));
  const translationRows = [];

  for (const item of newsItems) {
    for (const setting of settings) {
      const id = translationId(item.id, setting.locale);
      const existing = byId.get(id);
      if (existing?.status === 'completed' || existing?.status === 'manual') continue;
      try {
        const translated = await translateNews({
          newsItem: item,
          locale: setting.locale,
          provider: setting.provider,
        });
        const { hashtagLabels = [], ...trRest } = translated;
        translationRows.push({
          id,
          newsItemId: item.id,
          ...trRest,
          editedByAdminId: null,
          editedAt: null,
        });
        if (trRest.status === 'completed') {
          const nextItem = { ...item };
          mergeAutoHashtagsIntoNewsItem(nextItem, hashtagLabels);
          await patchCollectionPayload('newsItems', item.id, {
            hashtags: nextItem.hashtags,
            autoHashtags: nextItem.autoHashtags,
            hashtagLabels: nextItem.hashtagLabels,
            updatedAt: nowIso(),
          });
        }
      } catch (error) {
        translationRows.push({
          id,
          newsItemId: item.id,
          locale: setting.locale,
          provider: setting.provider,
          model: setting.model,
          status: 'failed',
          title: '',
          summary: '',
          content: '',
          errorMessage: error instanceof Error ? error.message : String(error),
          translatedAt: null,
          editedByAdminId: null,
          editedAt: null,
        });
      }
    }
  }

  if (translationRows.length > 0) await upsertCollectionRows('newsTranslations', translationRows);
}

async function saveNewsRows(rows) {
  const savedAt = nowIso();
  const safeRows = rows.map((row) => ({
    ...row,
    updatedAt: row.updatedAt || savedAt,
    createdAt: row.createdAt || savedAt,
  }));
  await upsertCollectionRows('newsItems', safeRows);
  await ensureNewsSourcesForRows(safeRows);
  await autoTranslateNewsDirect(safeRows);
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
    return { kind: 'news', rows: await fetchFinnhubMarketNews(params) };
  }
  if (effective.provider === 'rss' && effective.handler === 'financial_juice') {
    const sourceId = params?.rssSourceId || (Array.isArray(params?.rssSourceIds) ? params.rssSourceIds[0] : null);
    const source = getRssSource(dbBefore, sourceId);
    if (!source || source.enabled === false) throw new Error('RSS_SOURCE_NOT_CONFIGURED');
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
    const listKey = params?.listKey || (params?.segment === 'popular' ? 'popular_symbols' : null);
    const symbols = listKey
      ? marketListSymbols(dbBefore, listKey)
      : Array.isArray(params?.symbols) && params.symbols.length > 0
        ? params.symbols
        : [];
    return { kind: 'marketQuotes', rows: await fetchMarketQuotes({ ...(params || {}), symbols }) };
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
  if (effective.provider === 'coingecko' && effective.handler === 'coin_markets') {
    return { kind: 'coinMarkets', rows: await fetchCoinGeckoMarkets(params || {}) };
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
  if (effective.provider === 'signal' && effective.handler === 'news_digest') {
    return { kind: 'newsDigests', rows: generateNewsDigestItems(dbBefore, params || {}) };
  }
  throw new Error(`UNKNOWN_JOB_HANDLER:${job.provider}:${job.handler}`);
}

async function persistHandlerResult(result, rows) {
  const directCollectionByKind = {
    calendar: 'calendarEvents',
    marketQuotes: 'marketQuotes',
    marketList: 'marketLists',
    priceSeries: 'priceSeries',
    coinMarkets: 'coinMarkets',
    newsDigests: 'newsDigestItems',
  };
  const directCollection = directCollectionByKind[result.kind];
  if (directCollection) {
    const savedAt = nowIso();
    await upsertCollectionRows(
      directCollection,
      rows.map((row) => ({ ...row, updatedAt: row.updatedAt || savedAt, createdAt: row.createdAt || savedAt })),
    );
  } else if (result.kind === 'news') {
    await saveNewsRows(rows);
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

    let lastProgressAt = 0;
    let lastProgressPercent = -1;
    const onProgress =
      jobKey === 'market_quotes_mcap'
        ? async ({ phase, done, total, symbol } = {}) => {
            const safeDone = Math.max(0, Number(done) || 0);
            const safeTotal = Math.max(0, Number(total) || 0);
            const now = Date.now();

            let percent = 0;
            if (phase === 'profiles') percent = safeTotal > 0 ? Math.round((safeDone / safeTotal) * 50) : 0;
            else if (phase === 'quotes') percent = safeTotal > 0 ? 50 + Math.round((safeDone / safeTotal) * 50) : 50;
            else if (phase === 'transcripts') percent = safeTotal > 0 ? Math.round((safeDone / safeTotal) * 100) : 0;

            const percentDelta = Math.abs(percent - lastProgressPercent);
            const shouldPersist =
              percent !== lastProgressPercent &&
              (now - lastProgressAt > 5000 ||
                percent === 0 ||
                percent === 100 ||
                safeDone === safeTotal ||
                percentDelta >= 10);

            if (shouldPersist) {
              lastProgressAt = now;
              lastProgressPercent = percent;
              console.log(
                `[job:${jobKey}] progress ${percent}% (${phase || 'unknown'} ${safeDone}/${safeTotal})${symbol ? ` ${symbol}` : ''}`,
              );
              await patchPollingJobRun(run.id, {
                progressPhase: phase || null,
                progressDone: safeDone,
                progressTotal: safeTotal,
                progressPercent: percent,
                progressUpdatedAt: nowIso(),
              });
            }
          }
        : null;

    let dbBefore = await readJobContext(job);
    const phases = phasesForJob(job, runModeForJob(job, mode));
    if (phases.length === 0) throw new Error(`JOB_NO_PHASES:${jobKey}`);

    let totalItems = 0;
    let lastKind = null;
    for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex += 1) {
      const phase = phases[phaseIndex];
      if (phase === 'reconcile' && job.provider === 'youtube') {
        dbBefore = await readJobContext(job);
      }
      const result = await executeHandler(job, dbBefore, { onProgress, phase });
      const rows = result.rows || [];
      await persistHandlerResult(result, rows);
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
