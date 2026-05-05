import { nowIso, readDb, updateDb } from '../../../db.mjs';
import { runPollingJob } from '../../../jobs/runner.mjs';
import { cleanNewsTitleForDisplay, dateKeyInTimeZone, json, paginate, readBody } from '../../shared.mjs';

function enrichJobRun(item, jobs) {
  const job = jobs.find((candidate) => candidate.jobKey === item.jobKey);
  return {
    ...item,
    displayName: item.displayName || job?.displayName || item.jobKey,
    description: job?.description || null,
    domain: item.domain || job?.domain || null,
    operation: item.operation || job?.operation || null,
    provider: item.provider || job?.provider || null,
    handler: item.handler || job?.handler || null,
    intervalSeconds: job?.intervalSeconds ?? item.intervalSeconds ?? null,
    trigger: item.trigger || 'manual',
    resultKind: item.resultKind || item.domain || job?.domain || null,
  };
}

function filterJobRuns(items, url, jobs = []) {
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');
  const jobKey = url.searchParams.get('jobKey');
  const trigger = url.searchParams.get('trigger');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const timeZone = url.searchParams.get('timeZone');
  let rows = items.map((item) => enrichJobRun(item, jobs));
  if (status) rows = rows.filter((item) => item.status === status);
  if (jobKey) rows = rows.filter((item) => item.jobKey === jobKey);
  if (trigger) rows = rows.filter((item) => item.trigger === trigger);
  if (type) {
    rows = rows.filter((item) =>
      [item.domain, item.provider, item.handler, item.resultKind].some((value) => value === type),
    );
  }
  if (from) rows = rows.filter((item) => !item.startedAt || dateKeyInTimeZone(item.startedAt, timeZone) >= from);
  if (to) rows = rows.filter((item) => !item.startedAt || dateKeyInTimeZone(item.startedAt, timeZone) <= to);
  if (q) {
    rows = rows.filter((item) =>
      [item.displayName, item.jobKey, item.domain, item.provider, item.handler, item.resultKind, item.errorMessage].some(
        (value) => String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  return rows
    .map((row) => ({ ...row, ...runTiming(row, row) }))
    .sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
}

function validTime(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function runTiming(run, job = null) {
  const now = Date.now();
  const startedMs = validTime(run?.startedAt);
  const finishedMs = validTime(run?.finishedAt);
  const lastSignalMs = validTime(run?.progressUpdatedAt) || finishedMs || startedMs;
  const elapsedMs =
    run?.status === 'running' && startedMs != null
      ? now - startedMs
      : Number.isFinite(Number(run?.durationMs))
        ? Number(run.durationMs)
        : finishedMs != null && startedMs != null
          ? finishedMs - startedMs
          : null;
  const quietMs = run?.status === 'running' && lastSignalMs != null ? now - lastSignalMs : null;
  const intervalMs = Math.max(0, Number(job?.intervalSeconds || run?.intervalSeconds || 0) * 1000);
  const stuckThresholdMs = Math.max(5 * 60 * 1000, intervalMs > 0 ? intervalMs * 1.5 : 0);
  const stuck =
    run?.status === 'running' &&
    ((elapsedMs != null && elapsedMs > stuckThresholdMs) || (quietMs != null && quietMs > 5 * 60 * 1000));
  return { elapsedMs, quietMs, stuck, lastSignalAt: lastSignalMs == null ? null : new Date(lastSignalMs).toISOString() };
}

function dateOnlyToIso(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00.000Z` : null;
}

function latestIso(rows, fields) {
  let best = null;
  for (const row of rows || []) {
    for (const field of fields) {
      const raw = row?.[field];
      const ms = validTime(raw);
      const fallbackMs = ms ?? validTime(dateOnlyToIso(raw));
      if (fallbackMs != null && (best == null || fallbackMs > best)) best = fallbackMs;
    }
  }
  return best == null ? null : new Date(best).toISOString();
}

function compactRun(run, job = null) {
  if (!run) return null;
  const timing = runTiming(run, job);
  return {
    id: run.id || null,
    jobKey: run.jobKey || null,
    displayName: run.displayName || run.jobKey || null,
    status: run.status || null,
    startedAt: run.startedAt || null,
    finishedAt: run.finishedAt || null,
    itemCount: Number.isFinite(Number(run.itemCount)) ? Number(run.itemCount) : 0,
    errorMessage: run.errorMessage || null,
    progressPercent: Number.isFinite(Number(run.progressPercent)) ? Number(run.progressPercent) : null,
    progressPhase: run.progressPhase || null,
    progressDone: Number.isFinite(Number(run.progressDone)) ? Number(run.progressDone) : null,
    progressTotal: Number.isFinite(Number(run.progressTotal)) ? Number(run.progressTotal) : null,
    progressUpdatedAt: run.progressUpdatedAt || null,
    elapsedMs: timing.elapsedMs,
    quietMs: timing.quietMs,
    lastSignalAt: timing.lastSignalAt,
    stuck: timing.stuck,
    trigger: run.trigger || null,
  };
}

function areaJobMatch(area, run) {
  if (area.id === 'marketQuotes') {
    return (
      run.domain === 'market' &&
      (run.resultKind === 'marketQuotes' || run.handler === 'market_quotes' || run.handler === 'market_quotes_mcap')
    );
  }
  if (area.id === 'coinMarkets') {
    return run.domain === 'market' && (run.resultKind === 'coinMarkets' || run.handler === 'coin_markets');
  }
  return run.domain === area.domain || run.resultKind === area.resultKind;
}

function areaJobDefinitionMatch(area, job) {
  if (area.id === 'marketQuotes') {
    return job.domain === 'market' && (job.handler === 'market_quotes' || job.handler === 'market_quotes_mcap');
  }
  if (area.id === 'coinMarkets') return job.domain === 'market' && job.handler === 'coin_markets';
  return job.domain === area.domain;
}

function dataAreaSummary(db, recentRuns, latestRunByJob) {
  const areas = [
    {
      id: 'news',
      domain: 'news',
      resultKind: 'news',
      count: db.newsItems.length,
      latestItemAt: latestIso(db.newsItems, ['publishedAt', 'fetchedAt', 'updatedAt', 'createdAt']),
      quality: {
        translations: db.newsTranslations.length,
        sources: new Set(db.newsItems.map((item) => item.sourceName || item.provider).filter(Boolean)).size,
      },
    },
    {
      id: 'calendar',
      domain: 'calendar',
      resultKind: 'calendar',
      count: db.calendarEvents.length,
      latestItemAt: latestIso(db.calendarEvents, ['fetchedAt', 'eventAt', 'date', 'updatedAt', 'createdAt']),
      quality: {
        futureEvents: db.calendarEvents.filter((item) => String(item.date || '') >= new Date().toISOString().slice(0, 10)).length,
      },
    },
    {
      id: 'concalls',
      domain: 'concalls',
      resultKind: 'concallTranscripts',
      count: db.concallTranscripts.length,
      latestItemAt: latestIso(db.concallTranscripts, ['fetchedAt', 'earningsDate', 'updatedAt', 'createdAt']),
      quality: {
        withTranscript: db.concallTranscripts.filter((item) => Number(item.transcriptCharCount || 0) > 0 || item.transcript).length,
        summarized: db.concallTranscripts.filter((item) => item.summaryStatus === 'completed').length,
        symbols: new Set(db.concallTranscripts.map((item) => item.symbol).filter(Boolean)).size,
      },
    },
    {
      id: 'youtube',
      domain: 'youtube',
      resultKind: 'youtube',
      count: db.youtubeVideos.length,
      latestItemAt: latestIso(db.youtubeVideos, ['publishedAt', 'fetchedAt', 'updatedAt', 'createdAt']),
      quality: {
        channels: new Set(db.youtubeVideos.map((item) => item.channel).filter(Boolean)).size,
      },
    },
    {
      id: 'marketQuotes',
      domain: 'market',
      resultKind: 'marketQuotes',
      count: db.marketQuotes.length,
      latestItemAt: latestIso(db.marketQuotes, ['quoteTime', 'fetchedAt', 'updatedAt', 'createdAt']),
      quality: {
        segments: new Set(db.marketQuotes.map((item) => item.segment).filter(Boolean)).size,
        symbols: new Set(db.marketQuotes.map((item) => item.symbol).filter(Boolean)).size,
      },
    },
    {
      id: 'coinMarkets',
      domain: 'market',
      resultKind: 'coinMarkets',
      count: db.coinMarkets.length,
      latestItemAt: latestIso(db.coinMarkets, ['fetchedAt', 'updatedAt', 'createdAt']),
      quality: {
        symbols: new Set(db.coinMarkets.map((item) => item.symbol).filter(Boolean)).size,
      },
    },
  ];

  return areas.map((area) => {
    const jobs = db.pollingJobs.filter((job) => areaJobDefinitionMatch(area, job));
    const runs = recentRuns.filter((run) => areaJobMatch(area, run));
    const latestRun = runs[0] || null;
    const latestSuccess = runs.find((run) => run.status === 'completed') || null;
    const latestFailure = runs.find((run) => run.status === 'failed') || null;
    const runningRun = runs.find((run) => run.status === 'running') || null;
    const jobStates = latestRunByJob.filter((run) => areaJobMatch(area, run));
    return {
      id: area.id,
      count: area.count,
      latestItemAt: area.latestItemAt,
      enabledJobs: jobs.filter((job) => job.enabled).length,
      totalJobs: jobs.length,
      staleJobs: jobStates.filter((run) => run.stale).length,
      latestRun: compactRun(latestRun),
      latestSuccess: compactRun(latestSuccess),
      latestFailure: compactRun(latestFailure),
      runningRun: compactRun(runningRun),
      recentZeroItemRuns: runs.filter((run) => run.status === 'completed' && Number(run.itemCount || 0) === 0).length,
      quality: area.quality,
    };
  });
}

function dashboardSummary(db) {
  const recentRuns = db.pollingJobRuns.slice(0, 200).map((run) => enrichJobRun(run, db.pollingJobs));
  const latestNews = [...db.newsItems]
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
    .slice(0, 20)
    .map((item) => ({
      id: item.id,
      title: cleanNewsTitleForDisplay(item, item.titleOriginal),
      summary: item.summaryOriginal || '',
      sourceName: item.sourceName || '',
      sourceUrl: item.sourceUrl || '',
      category: item.category || '',
      provider: item.provider || '',
      publishedAt: item.publishedAt || null,
    }));
  const latestYoutube = [...db.youtubeVideos]
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
    .slice(0, 20)
    .map((item) => ({
      id: item.id,
      title: item.title || '',
      channel: item.channel || '',
      videoId: item.videoId || '',
      thumbnailUrl: item.thumbnailUrl || '',
      viewCount: item.viewCount || 0,
      publishedAt: item.publishedAt || null,
    }));
  const latestRunByJob = db.pollingJobs.map((job) => {
    const enriched = recentRuns.find((item) => item.jobKey === job.jobKey) || {};
    const timing = runTiming(enriched, job);
    const lastMs = enriched.finishedAt || enriched.startedAt ? new Date(enriched.finishedAt || enriched.startedAt).getTime() : NaN;
    const stale =
      job.enabled &&
      Number.isFinite(lastMs) &&
      Number(job.intervalSeconds) > 0 &&
      Date.now() - lastMs > Number(job.intervalSeconds) * 1000 * 1.25;
    return {
      ...enriched,
      jobKey: job.jobKey,
      displayName: job.displayName || job.jobKey,
      description: job.description || null,
      domain: job.domain || null,
      operation: job.operation || null,
      intervalSeconds: job.intervalSeconds,
      enabled: job.enabled,
      stale,
      ...timing,
    };
  });
  const runningRuns = recentRuns.filter((run) => run.status === 'running').map((run) => ({ ...run, ...runTiming(run, run) }));
  return {
    counts: {
      news: db.newsItems.length,
      newsTranslations: db.newsTranslations.length,
      calendar: db.calendarEvents.length,
      youtube: db.youtubeVideos.length,
      concalls: db.concallTranscripts.length,
      marketQuotes: db.marketQuotes.length,
      coinMarkets: db.coinMarkets.length,
      jobs: db.pollingJobs.length,
      enabledJobs: db.pollingJobs.filter((job) => job.enabled).length,
      recentFailedRuns: recentRuns.filter((run) => run.status === 'failed').length,
      runningRuns: runningRuns.length,
      stuckRuns: runningRuns.filter((run) => run.stuck).length,
    },
    recentRuns: latestRunByJob,
    dataAreas: dataAreaSummary(db, recentRuns, latestRunByJob),
    latestNews,
    latestYoutube,
  };
}

export async function handleAdminJobsRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/jobs') {
    const db = await readDb();
    json(res, 200, { data: db.pollingJobs, runs: db.pollingJobRuns.slice(0, 50) });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/summary') {
    const db = await readDb();
    json(res, 200, { data: dashboardSummary(db) });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/job-runs') {
    const db = await readDb();
    const page = paginate(filterJobRuns(db.pollingJobRuns, url, db.pollingJobs), url, 30, 100);
    json(res, 200, {
      data: page.rows,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    });
    return true;
  }

  const jobRunMatch = pathname.match(/^\/admin\/api\/jobs\/([^/]+)\/run$/);
  if (req.method === 'POST' && jobRunMatch) {
    const jobKey = decodeURIComponent(jobRunMatch[1]);
    const db = await readDb();
    if (!db.pollingJobs.some((job) => job.jobKey === jobKey)) {
      json(res, 404, { error: `JOB_NOT_FOUND:${jobKey}` });
      return true;
    }
    runPollingJob(jobKey, { force: true, trigger: 'manual' }).catch((error) => {
      console.error(`[job:${jobKey}] manual run failed`, error);
    });
    json(res, 202, { data: { accepted: true, jobKey } });
    return true;
  }

  const jobMatch = pathname.match(/^\/admin\/api\/jobs\/([^/]+)$/);
  if (req.method === 'PATCH' && jobMatch) {
    const patch = await readBody(req);
    const jobKey = decodeURIComponent(jobMatch[1]);
    const updated = await updateDb((db) => {
      const job = db.pollingJobs.find((j) => j.jobKey === jobKey);
      if (!job) throw new Error(`JOB_NOT_FOUND:${jobKey}`);
      if (typeof patch.enabled === 'boolean') job.enabled = patch.enabled;
      if (typeof patch.displayName === 'string') job.displayName = patch.displayName.trim() || job.jobKey;
      if (typeof patch.description === 'string') job.description = patch.description.trim();
      if (Number.isFinite(Number(patch.intervalSeconds))) job.intervalSeconds = Number(patch.intervalSeconds);
      if (patch.params && typeof patch.params === 'object') job.params = patch.params;
      job.updatedAt = nowIso();
      return job;
    });
    json(res, 200, { data: updated });
    return true;
  }

  return false;
}
