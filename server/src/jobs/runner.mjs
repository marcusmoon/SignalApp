import {
  acquirePollingJobLock,
  ensureNewsSourcesFromItems,
  getPollingJob,
  nowIso,
  readDb,
  releasePollingJobLock,
  updateDb,
  upsertById,
} from '../db.mjs';
import { config } from '../config.mjs';
import { mergeAutoHashtagsIntoNewsItem } from '../newsHashtags.mjs';
import { fetchNinjasConcallTranscript } from '../providers/concalls/ninjas.mjs';
import { fetchFinnhubEconomicCalendar, fetchFinnhubEarningsCalendar } from '../providers/calendar/finnhub.mjs';
import { fetchCoinGeckoMarkets } from '../providers/market/coingecko.mjs';
import { fetchMarketQuotes, fetchMcapQuotes } from '../providers/market/index.mjs';
import { generateMarketInsights } from '../insights/rules.mjs';
import { notificationsFromInsights, upsertNotificationItem } from '../notifications/outbox.mjs';
import { fetchFinancialJuiceRssNews } from '../providers/news/financialJuiceRss.mjs';
import { fetchFinnhubMarketNews } from '../providers/news/finnhub.mjs';
import { fetchNewswireRssNews } from '../providers/news/rssNews.mjs';
import { fetchSecEdgarFilings } from '../providers/news/secEdgar.mjs';
import { translateNews } from '../providers/translation/index.mjs';
import { fetchYoutubeEconomy, fetchYoutubeVideosByIds } from '../providers/youtube/youtube.mjs';
import { normalizeYoutubeCurationHandles } from '../youtubeCuration.mjs';

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

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
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

function selectConcallTargets(db, params = {}) {
  const from = ymd(addDays(new Date(), -Math.max(0, Number(params.daysBack) || 45)));
  const to = ymd(addDays(new Date(), Number(params.daysAhead) || 2));
  const today = ymd(new Date());
  const limit = Math.max(1, Math.min(200, Number(params.limit) || 25));
  const refreshExisting = params.refreshExisting === true;
  const fallbackLatest = params.fallbackLatest !== false;
  const listKey = params.listKey ? String(params.listKey) : '';
  const sourceSymbols = [
    ...(Array.isArray(params.symbols) ? params.symbols : []),
    ...(listKey ? marketListSymbols(db, listKey) : []),
  ]
    .map(normalizeSymbol)
    .filter(Boolean);
  const allowed = new Set(sourceSymbols);
  const existing = new Set(
    (db.concallTranscripts || [])
      .filter((row) => row?.transcript)
      .map((row) => `${normalizeSymbol(row.symbol)}|${row.fiscalYear ?? ''}|${row.fiscalQuarter ?? ''}`),
  );

  const targets = [];
  for (const ev of db.calendarEvents || []) {
    if (ev?.type !== 'earnings') continue;
    const symbol = normalizeSymbol(ev.symbol);
    if (!symbol) continue;
    if (allowed.size > 0 && !allowed.has(symbol)) continue;
    const date = String(ev.date || '').slice(0, 10);
    if (date && (date < from || date > to)) continue;
    if (date && date > today) continue;
    const fiscalYear = Number(ev.fiscalYear);
    const fiscalQuarter = Number(ev.fiscalQuarter);
    if (!Number.isFinite(fiscalYear) || !Number.isFinite(fiscalQuarter)) continue;
    const key = `${symbol}|${fiscalYear}|${fiscalQuarter}`;
    if (!refreshExisting && existing.has(key)) continue;
    targets.push({
      symbol,
      fiscalYear,
      fiscalQuarter,
      earningsDate: date || null,
      earningsHour: ev.earningsHour || ev.timeLabel || null,
    });
  }

  targets.sort((a, b) => String(b.earningsDate || '').localeCompare(String(a.earningsDate || '')) || a.symbol.localeCompare(b.symbol));
  if (targets.length === 0 && fallbackLatest && allowed.size > 0) {
    const existingLatest = new Set(
      (db.concallTranscripts || [])
        .filter((row) => row?.transcript && row.fiscalYear == null && row.fiscalQuarter == null)
        .map((row) => normalizeSymbol(row.symbol)),
    );
    return [...allowed]
      .filter((symbol) => refreshExisting || !existingLatest.has(symbol))
      .slice(0, limit)
      .map((symbol) => ({
        symbol,
        fiscalYear: null,
        fiscalQuarter: null,
        earningsDate: null,
        earningsHour: null,
      }));
  }
  return targets.slice(0, limit);
}

async function fetchConcallTranscriptsFromCalendar(db, params = {}, { onProgress } = {}) {
  const targets = selectConcallTargets(db, params);
  const rows = [];
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    try {
      const row = await fetchNinjasConcallTranscript(target);
      if (row) rows.push(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message === 'NINJAS_KEY_MISSING' ||
        message === 'NINJAS_PROVIDER_DISABLED' ||
        message.startsWith('NINJAS_TRANSCRIPT_400') ||
        message.startsWith('NINJAS_TRANSCRIPT_401') ||
        message.startsWith('NINJAS_TRANSCRIPT_403')
      ) {
        throw error;
      }
      /* keep the batch resilient */
    }
    if (typeof onProgress === 'function') {
      await onProgress({ phase: 'transcripts', done: i + 1, total: targets.length, symbol: target.symbol });
    }
  }
  return rows;
}

async function autoTranslateNews(db, newsItems) {
  const settings = (db.translationSettings || []).filter((s) => s.enabled && s.autoTranslateNews);
  for (const item of newsItems) {
    for (const setting of settings) {
      const id = translationId(item.id, setting.locale);
      const existing = db.newsTranslations.find((t) => t.id === id);
      if (existing?.status === 'completed' || existing?.status === 'manual') continue;
      try {
        const translated = await translateNews({
          newsItem: item,
          locale: setting.locale,
          provider: setting.provider,
        });
        const { hashtagLabels = [], ...trRest } = translated;
        upsertById(db.newsTranslations, {
          id,
          newsItemId: item.id,
          ...trRest,
          editedByAdminId: null,
          editedAt: null,
        });
        if (trRest.status === 'completed') {
          const row = db.newsItems.find((n) => n.id === item.id);
          mergeAutoHashtagsIntoNewsItem(row, hashtagLabels);
        }
      } catch (error) {
        upsertById(db.newsTranslations, {
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
}

async function executeHandler(job, dbBefore, { onProgress } = {}) {
  if (job.provider === 'finnhub' && job.handler === 'market_news') {
    return { kind: 'news', rows: await fetchFinnhubMarketNews(job.params || {}) };
  }
  if (job.provider === 'rss' && job.handler === 'financial_juice') {
    return { kind: 'news', rows: await fetchFinancialJuiceRssNews(job.params || {}) };
  }
  if (job.provider === 'rss' && job.handler === 'newswire_rss') {
    return { kind: 'news', rows: await fetchNewswireRssNews(job.params || {}) };
  }
  if (job.provider === 'sec' && job.handler === 'company_filings') {
    const listKey = job.params?.listKey || 'default_watchlist';
    const symbols = Array.isArray(job.params?.symbols) && job.params.symbols.length > 0 ? job.params.symbols : marketListSymbols(dbBefore, listKey);
    return { kind: 'news', rows: await fetchSecEdgarFilings({ ...(job.params || {}), symbols }) };
  }
  if (job.provider === 'finnhub' && job.handler === 'economic_calendar') {
    return { kind: 'calendar', rows: await fetchFinnhubEconomicCalendar(job.params || {}) };
  }
  if (job.provider === 'finnhub' && job.handler === 'earnings_calendar') {
    return { kind: 'calendar', rows: await fetchFinnhubEarningsCalendar(job.params || {}) };
  }
  if (job.provider === 'ninjas' && job.handler === 'earning_transcripts') {
    return { kind: 'concallTranscripts', rows: await fetchConcallTranscriptsFromCalendar(dbBefore, job.params || {}, { onProgress }) };
  }
  if (job.provider === 'youtube' && job.handler === 'youtube_economy') {
    const handles = normalizeYoutubeCurationHandles(dbBefore.appSettings?.youtubeCurationHandles);
    return { kind: 'youtube', rows: await fetchYoutubeEconomy({ ...(job.params || {}), handles }) };
  }
  if (job.provider === 'youtube' && job.handler === 'youtube_economy_reconcile') {
    const limit = Math.max(1, Math.min(200, Number(job.params?.limit || 80)));
    const ids = [...(dbBefore.youtubeVideos || [])]
      .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
      .slice(0, limit)
      .map((item) => item.videoId || item.providerItemId)
      .filter(Boolean);
    return { kind: 'youtube', rows: await fetchYoutubeVideosByIds(ids, { order: 'preserve' }) };
  }
  if (job.provider === 'finnhub' && job.handler === 'market_quotes') {
    const listKey = job.params?.listKey || (job.params?.segment === 'popular' ? 'popular_symbols' : null);
    const symbols = listKey
      ? marketListSymbols(dbBefore, listKey)
      : Array.isArray(job.params?.symbols) && job.params.symbols.length > 0
        ? job.params.symbols
        : [];
    return { kind: 'marketQuotes', rows: await fetchMarketQuotes({ ...(job.params || {}), symbols }) };
  }
  if (job.provider === 'finnhub' && job.handler === 'market_quotes_mcap') {
    return {
      kind: 'marketQuotes',
      rows: await fetchMcapQuotes({
        ...(job.params || {}),
        symbols: marketListSymbols(dbBefore, job.params?.listKey || 'mcap_universe'),
        onProgress,
      }),
    };
  }
  if (job.provider === 'coingecko' && job.handler === 'coin_markets') {
    return { kind: 'coinMarkets', rows: await fetchCoinGeckoMarkets(job.params || {}) };
  }
  if (job.provider === 'signal' && job.handler === 'market_insights') {
    return { kind: 'insights', rows: generateMarketInsights(dbBefore, job.params || {}) };
  }
  throw new Error(`UNKNOWN_JOB_HANDLER:${job.provider}:${job.handler}`);
}

export async function runPollingJob(jobKey, { force = false, trigger = 'schedule' } = {}) {
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
    await updateDb((db) => {
      const job = db.pollingJobs.find((j) => j.jobKey === jobKey);
      if (job) {
        skippedRun.displayName = job.displayName || job.jobKey;
        skippedRun.domain = job.domain || null;
        skippedRun.operation = job.operation || null;
        skippedRun.provider = job.provider || null;
        skippedRun.handler = job.handler || null;
        skippedRun.resultKind = job.domain || null;
        job.updatedAt = skippedAt;
      }
      db.pollingJobRuns.unshift(skippedRun);
    });
    return {
      ...skippedRun,
    };
  }

  let startedTime = Date.now();
  let run = null;
  try {
    const dbBefore = await readDb();
    const job = dbBefore.pollingJobs.find((j) => j.jobKey === jobKey);
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

    await updateDb((db) => {
      db.pollingJobRuns.unshift(run);
      const savedJob = db.pollingJobs.find((j) => j.jobKey === jobKey);
      if (savedJob) {
        savedJob.lastRunAt = run.startedAt;
        savedJob.nextRunAt = addSecondsIso(savedJob.intervalSeconds);
        savedJob.updatedAt = run.startedAt;
      }
    });

    let lastProgressAt = 0;
    let lastProgressPercent = -1;
    const onProgress =
      jobKey === 'market_quotes_mcap' || jobKey === 'concall_transcripts_recent'
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
              await updateDb((db) => {
                const savedRun = db.pollingJobRuns.find((r) => r.id === run.id);
                if (!savedRun) return;
                savedRun.progressPhase = phase || null;
                savedRun.progressDone = safeDone;
                savedRun.progressTotal = safeTotal;
                savedRun.progressPercent = percent;
                savedRun.progressUpdatedAt = nowIso();
              });
            }
          }
        : null;

    const result = await executeHandler(job, dbBefore, { onProgress });
    await updateDb(async (db) => {
      const rows = result.rows || [];
      if (result.kind === 'news') {
        for (const row of rows) upsertById(db.newsItems, row);
        ensureNewsSourcesFromItems(db);
        await autoTranslateNews(db, rows);
      } else if (result.kind === 'calendar') {
        for (const row of rows) upsertById(db.calendarEvents, row);
      } else if (result.kind === 'concallTranscripts') {
        for (const row of rows) upsertById(db.concallTranscripts, row);
      } else if (result.kind === 'youtube') {
        for (const row of rows) upsertYoutubeVideo(db.youtubeVideos, row);
      } else if (result.kind === 'marketQuotes') {
        for (const row of rows) upsertById(db.marketQuotes, row);
      } else if (result.kind === 'coinMarkets') {
        for (const row of rows) upsertById(db.coinMarkets, row);
      } else if (result.kind === 'insights') {
        for (const row of rows) upsertById(db.insightItems, row);
        const notificationRows = notificationsFromInsights(rows);
        for (const row of notificationRows) upsertNotificationItem(db.notificationItems, row);
      }

      const savedJob = db.pollingJobs.find((j) => j.jobKey === jobKey);
      if (savedJob) {
        savedJob.lastRunAt = nowIso();
        savedJob.nextRunAt = addSecondsIso(savedJob.intervalSeconds);
        savedJob.updatedAt = nowIso();
      }
      const savedRun = db.pollingJobRuns.find((r) => r.id === run.id);
      if (savedRun) {
        const finishedAt = nowIso();
        savedRun.status = 'completed';
        savedRun.finishedAt = finishedAt;
        savedRun.durationMs = Date.now() - startedTime;
        savedRun.resultKind = result.kind;
        savedRun.itemCount = rows.length;
        if (savedRun.progressPercent != null) savedRun.progressPercent = 100;
        savedRun.progressUpdatedAt = finishedAt;
      }
    });
    return {
      ...run,
      status: 'completed',
      finishedAt: nowIso(),
      durationMs: Date.now() - startedTime,
      resultKind: result.kind,
      itemCount: result.rows.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateDb((db) => {
      const savedJob = db.pollingJobs.find((j) => j.jobKey === jobKey);
      if (savedJob) {
        savedJob.lastRunAt = nowIso();
        savedJob.nextRunAt = addSecondsIso(savedJob.intervalSeconds);
        savedJob.updatedAt = nowIso();
      }
      const savedRun = run ? db.pollingJobRuns.find((r) => r.id === run.id) : null;
      if (savedRun) {
        const finishedAt = nowIso();
        savedRun.status = 'failed';
        savedRun.finishedAt = finishedAt;
        savedRun.durationMs = Date.now() - startedTime;
        savedRun.errorMessage = message;
        savedRun.progressUpdatedAt = finishedAt;
      }
    });
    throw error;
  } finally {
    await releasePollingJobLock(jobKey, lock.token).catch((error) => {
      console.warn(`[job:${jobKey}] failed to release lock`, error?.message || error);
    });
  }
}

export async function retranslateNewsItems({ ids, locale, provider, model, adminId }) {
  return updateDb(async (db) => {
    const items = db.newsItems.filter((item) => ids.includes(item.id));
    for (const item of items) {
      const translated = await translateNews({ newsItem: item, locale, provider, model });
      const { hashtagLabels = [], ...trRest } = translated;
      upsertById(db.newsTranslations, {
        id: translationId(item.id, locale),
        newsItemId: item.id,
        ...trRest,
        editedByAdminId: adminId || null,
        editedAt: nowIso(),
      });
      if (trRest.status === 'completed') {
        mergeAutoHashtagsIntoNewsItem(item, hashtagLabels);
      }
    }
    return { count: items.length };
  });
}
