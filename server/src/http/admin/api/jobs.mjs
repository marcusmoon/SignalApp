import { nowIso, readDb, updateDb } from '../../../db.mjs';
import { runPollingJob } from '../../../jobs/runner.mjs';
import { cleanNewsTitleForDisplay, json, paginate, readBody } from '../../shared.mjs';

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
  if (from) rows = rows.filter((item) => !item.startedAt || item.startedAt.slice(0, 10) >= from);
  if (to) rows = rows.filter((item) => !item.startedAt || item.startedAt.slice(0, 10) <= to);
  if (q) {
    rows = rows.filter((item) =>
      [item.displayName, item.jobKey, item.domain, item.provider, item.handler, item.resultKind, item.errorMessage].some(
        (value) => String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  return rows.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
}

function dashboardSummary(db) {
  const recentRuns = db.pollingJobRuns.slice(0, 200);
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
    const run = recentRuns.find((item) => item.jobKey === job.jobKey);
    const enriched = run ? enrichJobRun(run, db.pollingJobs) : {};
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
    };
  });
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
    },
    recentRuns: latestRunByJob,
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
    const result = await runPollingJob(decodeURIComponent(jobRunMatch[1]), { force: true, trigger: 'manual' });
    json(res, 200, { data: result });
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
