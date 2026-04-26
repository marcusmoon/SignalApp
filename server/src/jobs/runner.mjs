import { nowIso, readDb, updateDb, upsertById } from '../db.mjs';
import { fetchFinnhubEconomicCalendar, fetchFinnhubEarningsCalendar } from '../providers/calendar/finnhub.mjs';
import { fetchCoinGeckoMarkets } from '../providers/market/coingecko.mjs';
import { fetchFinnhubMarketQuotes, fetchFinnhubMcapQuotes } from '../providers/market/finnhub.mjs';
import { fetchFinnhubMarketNews } from '../providers/news/finnhub.mjs';
import { translateNews } from '../providers/translation/index.mjs';
import { fetchYoutubeEconomy, fetchYoutubeVideosByIds } from '../providers/youtube/youtube.mjs';

function addSecondsIso(seconds) {
  return new Date(Date.now() + Number(seconds || 300) * 1000).toISOString();
}

function translationId(newsItemId, locale) {
  return `${newsItemId}:${locale}`;
}

function marketListSymbols(db, key) {
  return (db.marketLists || []).find((list) => list.key === key)?.symbols || [];
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
          model: setting.model,
        });
        upsertById(db.newsTranslations, {
          id,
          newsItemId: item.id,
          ...translated,
          editedByAdminId: null,
          editedAt: null,
        });
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
  if (job.provider === 'finnhub' && job.handler === 'economic_calendar') {
    return { kind: 'calendar', rows: await fetchFinnhubEconomicCalendar(job.params || {}) };
  }
  if (job.provider === 'finnhub' && job.handler === 'earnings_calendar') {
    return { kind: 'calendar', rows: await fetchFinnhubEarningsCalendar(job.params || {}) };
  }
  if (job.provider === 'youtube' && job.handler === 'youtube_economy') {
    return { kind: 'youtube', rows: await fetchYoutubeEconomy(job.params || {}) };
  }
  if (job.provider === 'youtube' && job.handler === 'youtube_economy_reconcile') {
    const limit = Math.max(1, Math.min(200, Number(job.params?.limit || 80)));
    const ids = [...(dbBefore.youtubeVideos || [])]
      .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
      .slice(0, limit)
      .map((item) => item.videoId || item.providerItemId)
      .filter(Boolean);
    return { kind: 'youtube', rows: await fetchYoutubeVideosByIds(ids, { order: 'date' }) };
  }
  if (job.provider === 'finnhub' && job.handler === 'market_quotes') {
    const listKey = job.params?.listKey || (job.params?.segment === 'popular' ? 'popular_symbols' : null);
    const symbols = listKey
      ? marketListSymbols(dbBefore, listKey)
      : Array.isArray(job.params?.symbols) && job.params.symbols.length > 0
        ? job.params.symbols
        : [];
    return { kind: 'marketQuotes', rows: await fetchFinnhubMarketQuotes({ ...(job.params || {}), symbols }) };
  }
  if (job.provider === 'finnhub' && job.handler === 'market_quotes_mcap') {
    return {
      kind: 'marketQuotes',
      rows: await fetchFinnhubMcapQuotes({
        ...(job.params || {}),
        symbols: marketListSymbols(dbBefore, job.params?.listKey || 'mcap_universe'),
        onProgress,
      }),
    };
  }
  if (job.provider === 'coingecko' && job.handler === 'coin_markets') {
    return { kind: 'coinMarkets', rows: await fetchCoinGeckoMarkets(job.params || {}) };
  }
  throw new Error(`UNKNOWN_JOB_HANDLER:${job.provider}:${job.handler}`);
}

export async function runPollingJob(jobKey, { force = false, trigger = 'schedule' } = {}) {
  const dbBefore = await readDb();
  const job = dbBefore.pollingJobs.find((j) => j.jobKey === jobKey);
  if (!job) throw new Error(`JOB_NOT_FOUND:${jobKey}`);
  if (!force && !job.enabled) throw new Error(`JOB_DISABLED:${jobKey}`);

  const startedTime = Date.now();
  const run = {
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
  };

  await updateDb((db) => {
    db.pollingJobRuns.unshift(run);
  });

  try {
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

            const shouldPersist =
              percent !== lastProgressPercent &&
              (now - lastProgressAt > 750 || percent === 0 || percent === 100 || safeDone === safeTotal);

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
              });
            }
          }
        : null;

    const result = await executeHandler(job, dbBefore, { onProgress });
    await updateDb(async (db) => {
      const rows = result.rows || [];
      if (result.kind === 'news') {
        for (const row of rows) upsertById(db.newsItems, row);
        await autoTranslateNews(db, rows);
      } else if (result.kind === 'calendar') {
        for (const row of rows) upsertById(db.calendarEvents, row);
      } else if (result.kind === 'youtube') {
        for (const row of rows) upsertById(db.youtubeVideos, row);
      } else if (result.kind === 'marketQuotes') {
        for (const row of rows) upsertById(db.marketQuotes, row);
      } else if (result.kind === 'coinMarkets') {
        for (const row of rows) upsertById(db.coinMarkets, row);
      }

      const savedJob = db.pollingJobs.find((j) => j.jobKey === jobKey);
      if (savedJob) {
        savedJob.lastRunAt = nowIso();
        savedJob.nextRunAt = addSecondsIso(savedJob.intervalSeconds);
        savedJob.updatedAt = nowIso();
      }
      const savedRun = db.pollingJobRuns.find((r) => r.id === run.id);
      if (savedRun) {
        savedRun.status = 'completed';
        savedRun.finishedAt = nowIso();
        savedRun.durationMs = Date.now() - startedTime;
        savedRun.resultKind = result.kind;
        savedRun.itemCount = rows.length;
        if (savedRun.progressPercent != null) savedRun.progressPercent = 100;
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
      const savedRun = db.pollingJobRuns.find((r) => r.id === run.id);
      if (savedRun) {
        savedRun.status = 'failed';
        savedRun.finishedAt = nowIso();
        savedRun.durationMs = Date.now() - startedTime;
        savedRun.errorMessage = message;
      }
    });
    throw error;
  }
}

export async function retranslateNewsItems({ ids, locale, provider, model, adminId }) {
  return updateDb(async (db) => {
    const items = db.newsItems.filter((item) => ids.includes(item.id));
    for (const item of items) {
      const translated = await translateNews({ newsItem: item, locale, provider, model });
      upsertById(db.newsTranslations, {
        id: translationId(item.id, locale),
        newsItemId: item.id,
        ...translated,
        editedByAdminId: adminId || null,
        editedAt: nowIso(),
      });
    }
    return { count: items.length };
  });
}
