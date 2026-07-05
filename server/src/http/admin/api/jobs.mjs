import {
  getPollingJob,
  listCollectionPayloads,
  listYoutubeVideos,
  listPollingJobLocks,
  listPollingJobRuns,
  listPollingJobs,
  nowIso,
  patchPollingJob,
  queryPublicCalendar,
} from '../../../db.mjs';
import { httpMetricsSnapshot } from '../../../httpMetrics.mjs';
import { enrichJobWithCatalog } from '../../../jobs/catalog.mjs';
import { jobLockState, resolveActiveRunningRun, runTiming } from '../../../jobs/jobLock.mjs';
import { forceReleaseStaleJobLock } from '../../../jobs/jobLockMaintenance.mjs';
import { getJobPreset, listJobPresets, runJobPreset } from '../../../jobs/presets.mjs';
import { runPollingJob } from '../../../jobs/runner.mjs';
import { cleanNewsTitleForDisplay, json, paginate, readBody } from '../../shared.mjs';

function normalizeCommunityJobParams(job, params) {
  if (!params || typeof params !== 'object') return params;
  const domain = String(job?.domain || job?.area || '').trim().toLowerCase();
  if (domain !== 'community') return params;
  const next = { ...params };
  if (next.pageSize != null) {
    const pageSize = Number(next.pageSize);
    next.pageSize = Number.isFinite(pageSize) ? Math.min(50, Math.max(5, Math.round(pageSize))) : 30;
  }
  return next;
}

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
  let rows = items.map((item) => enrichJobRun(item, jobs));
  if (status) rows = rows.filter((item) => item.status === status);
  if (jobKey) rows = rows.filter((item) => item.jobKey === jobKey);
  if (trigger) rows = rows.filter((item) => item.trigger === trigger);
  if (type) {
    rows = rows.filter((item) =>
      [item.domain, item.provider, item.handler, item.resultKind].some((value) => value === type),
    );
  }
  if (from) {
    const fromMs = new Date(from).getTime();
    if (Number.isFinite(fromMs)) rows = rows.filter((item) => !item.startedAt || new Date(item.startedAt).getTime() >= fromMs);
  }
  if (to) {
    const toMs = new Date(to).getTime();
    if (Number.isFinite(toMs)) rows = rows.filter((item) => !item.startedAt || new Date(item.startedAt).getTime() <= toMs);
  }
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
  const jobArea = String(job?.area || job?.domain || '').trim();
  if (area.id === 'signal') return jobArea === 'signal' || job?.domain === 'insights';
  if (area.id === 'marketQuotes') {
    return jobArea === 'market' && (job.handler === 'market_quotes' || job.handler === 'market_quotes_mcap');
  }
  if (area.id === 'coinMarkets') return jobArea === 'market' && job.handler === 'coin_markets';
  if (area.id === 'news') return jobArea === 'news';
  if (area.id === 'disclosures') return jobArea === 'disclosures' || job.domain === 'disclosures';
  if (area.id === 'calendar') return jobArea === 'calendar';
  if (area.id === 'youtube') return jobArea === 'youtube';
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
      id: 'disclosures',
      domain: 'disclosures',
      resultKind: 'disclosures',
      count: db.disclosures.length,
      latestItemAt: latestIso(db.disclosures, ['filedAt', 'fetchedAt', 'updatedAt', 'createdAt']),
      quality: {
        providers: new Set(db.disclosures.map((item) => item.provider).filter(Boolean)).size,
        symbols: new Set(db.disclosures.map((item) => item.symbol).filter(Boolean)).size,
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
      disclosures: db.disclosures.length,
      calendar: db.calendarEvents.length,
      youtube: db.youtubeVideos.length,
      marketQuotes: db.marketQuotes.length,
      coinMarkets: db.coinMarkets.length,
      notifications: db.notificationItems.length,
      queuedNotifications: db.notificationItems.filter((item) => item.channel === 'push' && item.status === 'queued').length,
      jobs: db.pollingJobs.length,
      enabledJobs: db.pollingJobs.filter((job) => job.enabled).length,
      recentFailedRuns: recentRuns.filter((run) => run.status === 'failed').length,
      runningRuns: runningRuns.length,
      stuckRuns: runningRuns.filter((run) => run.stuck).length,
    },
    recentRuns: latestRunByJob,
    httpMetrics: httpMetricsSnapshot(),
    dataAreas: dataAreaSummary(db, recentRuns, latestRunByJob),
    latestNews,
    latestYoutube,
  };
}

async function readDashboardSummaryContext() {
  const [
    pollingJobs,
    pollingJobRuns,
    newsItems,
    newsTranslations,
    disclosures,
    calendarEvents,
    youtubeVideos,
    marketQuotes,
    coinMarkets,
    notificationItems,
  ] = await Promise.all([
    listPollingJobs(),
    listPollingJobRuns({ limit: 200 }),
    listCollectionPayloads('newsItems'),
    listCollectionPayloads('newsTranslations'),
    listCollectionPayloads('disclosures'),
    queryPublicCalendar({ limit: 10000 }),
    listYoutubeVideos(),
    listCollectionPayloads('marketQuotes'),
    listCollectionPayloads('coinMarkets'),
    listCollectionPayloads('notificationItems'),
  ]);
  return {
    pollingJobs,
    pollingJobRuns,
    newsItems,
    newsTranslations,
    disclosures,
    calendarEvents,
    youtubeVideos,
    marketQuotes,
    coinMarkets,
    notificationItems,
  };
}

export async function handleAdminJobsRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/jobs') {
    const jobs = await listPollingJobs();
    const runs = await listPollingJobRuns({ limit: 200 });
    const recentRuns = runs.map((run) => enrichJobRun(run, jobs));
    const runsByJob = new Map();
    for (const run of recentRuns) {
      if (!runsByJob.has(run.jobKey)) runsByJob.set(run.jobKey, []);
      runsByJob.get(run.jobKey).push(run);
    }
    const lockByJob = new Map((await listPollingJobLocks()).map((lock) => [lock.jobKey, lock]));
    const data = jobs.map((job) => {
      const enriched = enrichJobWithCatalog(job);
      const jobRuns = runsByJob.get(job.jobKey) || [];
      const latestRun = jobRuns[0] || null;
      const activeRunningRun = resolveActiveRunningRun(latestRun, jobRuns);
      return {
        ...enriched,
        latestRunAt: latestRun?.finishedAt || latestRun?.startedAt || job.lastRunAt || null,
        latestRunStatus: latestRun?.status || null,
        latestRunTrigger: latestRun?.trigger || null,
        latestRunErrorMessage: latestRun?.errorMessage || null,
        lock: jobLockState({
          job: enriched,
          lock: lockByJob.get(job.jobKey) || null,
          latestRun,
          activeRunningRun,
        }),
      };
    });
    json(res, 200, { data, runs: runs.slice(0, 50), presets: listJobPresets() });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/job-presets') {
    json(res, 200, { data: listJobPresets() });
    return true;
  }

  const presetRunMatch = pathname.match(/^\/admin\/api\/job-presets\/([^/]+)\/run$/);
  if (req.method === 'POST' && presetRunMatch) {
    const presetId = decodeURIComponent(presetRunMatch[1]);
    const preset = getJobPreset(presetId);
    if (!preset) {
      json(res, 404, { error: `JOB_PRESET_NOT_FOUND:${presetId}` });
      return true;
    }
    runJobPreset(presetId, { force: true, trigger: 'preset' }).catch((error) => {
      console.error(`[preset:${presetId}] run failed`, error);
    });
    json(res, 202, { data: { accepted: true, presetId, jobKeys: preset.jobKeys } });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/summary') {
    const db = await readDashboardSummaryContext();
    json(res, 200, { data: dashboardSummary(db) });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/job-runs') {
    const jobs = await listPollingJobs();
    const runs = await listPollingJobRuns({ limit: 500 });
    const page = paginate(filterJobRuns(runs, url, jobs), url, 30, 100);
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
    const job = await getPollingJob(jobKey);
    if (!job) {
      json(res, 404, { error: `JOB_NOT_FOUND:${jobKey}` });
      return true;
    }
    let mode = 'full';
    try {
      const body = await readBody(req);
      if (body?.mode) mode = String(body.mode);
    } catch {
      /* empty body ok */
    }
    runPollingJob(jobKey, { force: true, trigger: 'manual', mode }).catch((error) => {
      console.error(`[job:${jobKey}] manual run failed`, error);
    });
    json(res, 202, { data: { accepted: true, jobKey, mode } });
    return true;
  }

  const jobLockMatch = pathname.match(/^\/admin\/api\/jobs\/([^/]+)\/lock$/);
  if (req.method === 'DELETE' && jobLockMatch) {
    const jobKey = decodeURIComponent(jobLockMatch[1]);
    try {
      const result = await forceReleaseStaleJobLock(jobKey);
      json(res, 200, { data: { released: result.released, failedRuns: result.failedRuns, jobKey, lock: result.state } });
    } catch (error) {
      const message = String(error?.message || '');
      if (message.startsWith('JOB_NOT_FOUND:')) {
        json(res, 404, { error: message });
        return true;
      }
      if (message === 'JOB_LOCK_NOT_FOUND') {
        json(res, 404, { error: message });
        return true;
      }
      if (message === 'JOB_LOCK_NOT_STALE') {
        json(res, 409, { error: message, data: error.state || null });
        return true;
      }
      throw error;
    }
    return true;
  }

  const jobMatch = pathname.match(/^\/admin\/api\/jobs\/([^/]+)$/);
  if (req.method === 'PATCH' && jobMatch) {
    const patch = await readBody(req);
    const jobKey = decodeURIComponent(jobMatch[1]);
    const job = await getPollingJob(jobKey);
    if (!job) throw new Error(`JOB_NOT_FOUND:${jobKey}`);
    const next = { ...job };
    if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
    if (typeof patch.displayName === 'string') next.displayName = patch.displayName.trim() || next.jobKey;
    if (typeof patch.description === 'string') next.description = patch.description.trim();
    if (Number.isFinite(Number(patch.intervalSeconds))) next.intervalSeconds = Number(patch.intervalSeconds);
    if (Number.isFinite(Number(patch.lockTtlSeconds)) && Number(patch.lockTtlSeconds) > 0) {
      next.lockTtlSeconds = Number(patch.lockTtlSeconds);
    }
    if (Number.isFinite(Number(patch.staleLockSeconds)) && Number(patch.staleLockSeconds) > 0) {
      next.staleLockSeconds = Number(patch.staleLockSeconds);
    }
    if (patch.params && typeof patch.params === 'object') {
      next.params = normalizeCommunityJobParams(job, patch.params);
    }
    next.updatedAt = nowIso();
    const updated = await patchPollingJob(jobKey, next);
    json(res, 200, { data: updated });
    return true;
  }

  return false;
}
