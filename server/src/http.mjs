import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.mjs';
import { readDb, updateDb, upsertById, nowIso } from './db.mjs';
import { retranslateNewsItems, runPollingJob } from './jobs/runner.mjs';
import { translateNews } from './providers/translation/index.mjs';
import { fetchYoutubeVideosByIds } from './providers/youtube/youtube.mjs';
import { listProviderSettingsPublic, updateProviderSetting } from './providerSettings.mjs';
import { MARKET_LIST_KEYS, normalizeMarketSymbols, publicMarketList } from './marketLists.mjs';
import { getOpenApiSpec } from './openapi.mjs';

function json(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function text(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' });
  res.end(body);
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function signSession(value) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('hex');
}

function sessionToken(adminId) {
  return `${adminId}.${signSession(adminId)}`;
}

function getAdminId(req) {
  const token = parseCookies(req).signal_admin_session;
  if (!token) return null;
  const [adminId, sig] = token.split('.');
  if (!adminId || !sig) return null;
  return signSession(adminId) === sig ? adminId : null;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function requireAdmin(req, res) {
  const adminId = getAdminId(req);
  if (!adminId) {
    json(res, 401, { error: 'UNAUTHORIZED' });
    return null;
  }
  return adminId;
}

function displayNews(item, translations, locale) {
  const tr = translations.find((t) => t.newsItemId === item.id && t.locale === locale);
  const completed = tr && (tr.status === 'completed' || tr.status === 'manual');
  return {
    id: item.id,
    category: item.category,
    title: completed ? tr.title : item.titleOriginal,
    summary: completed ? tr.summary : item.summaryOriginal,
    displayLocale: completed ? locale : 'en',
    translationStatus: tr?.status || 'missing',
    originalTitle: item.titleOriginal,
    originalSummary: item.summaryOriginal,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    imageUrl: item.imageUrl,
    symbols: item.symbols,
    provider: item.provider,
    publishedAt: item.publishedAt,
    fetchedAt: item.fetchedAt,
  };
}

function filterNews(items, url) {
  const category = url.searchParams.get('category');
  const symbol = url.searchParams.get('symbol')?.trim().toUpperCase();
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  let rows = [...items];
  if (category) {
    if (category === 'global') {
      rows = rows.filter(
        (item) => item.category === 'global' || String(item.provider || '') === 'financialjuice',
      );
    } else {
      rows = rows.filter((item) => item.category === category);
    }
  }
  if (symbol) rows = rows.filter((item) => item.symbols?.includes(symbol));
  if (from) rows = rows.filter((item) => !item.publishedAt || item.publishedAt.slice(0, 10) >= from);
  if (to) rows = rows.filter((item) => !item.publishedAt || item.publishedAt.slice(0, 10) <= to);
  if (q) {
    rows = rows.filter((item) =>
      [item.titleOriginal, item.summaryOriginal, item.sourceName].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  return rows.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
}

function paginate(rows, url, defaultPageSize = 30, maxPageSize = 100) {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number.parseInt(url.searchParams.get('pageSize') || String(defaultPageSize), 10) || defaultPageSize),
  );
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    rows: rows.slice(start, start + pageSize),
  };
}

function filterCalendar(items, url) {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const type = url.searchParams.get('type');
  const symbol = url.searchParams.get('symbol')?.trim().toUpperCase();
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  let rows = [...items];
  if (from) rows = rows.filter((item) => !item.date || item.date >= from);
  if (to) rows = rows.filter((item) => !item.date || item.date <= to);
  if (type) rows = rows.filter((item) => item.type === type);
  if (symbol) {
    rows = rows.filter((item) => {
      const sym = String(item.symbol || '').toUpperCase();
      const hay = `${item.title || ''} ${item.country || ''}`.toUpperCase();
      return sym === symbol || hay.includes(symbol);
    });
  }
  if (q) {
    rows = rows.filter((item) =>
      [item.title, item.country, item.symbol, item.type].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  return rows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || a.title.localeCompare(b.title));
}

function filterYoutube(items, url) {
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  const channel = url.searchParams.get('channel')?.trim().toLowerCase();
  let rows = [...items];
  if (channel) rows = rows.filter((item) => String(item.channel || '').toLowerCase().includes(channel));
  if (q) {
    rows = rows.filter((item) =>
      [item.title, item.description, item.channel].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  return rows.sort(
    (a, b) =>
      new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime() ||
      (b.viewCount || 0) - (a.viewCount || 0),
  );
}

function filterMarketQuotes(items, url) {
  const segment = url.searchParams.get('segment');
  const symbols = url.searchParams.get('symbols');
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  let rows = [...items];
  if (segment) rows = rows.filter((item) => item.segment === segment);
  if (symbols) {
    const set = new Set(
      symbols
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    );
    rows = rows.filter((item) => set.has(String(item.symbol || '').toUpperCase()));
  }
  if (q) {
    rows = rows.filter((item) =>
      [item.symbol, item.name, item.segment].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  return rows.sort(
    (a, b) =>
      String(a.segment || '').localeCompare(String(b.segment || '')) ||
      String(a.symbol || '').localeCompare(String(b.symbol || '')),
  );
}

function filterCoinMarkets(items, url) {
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  let rows = [...items];
  if (q) {
    rows = rows.filter((item) =>
      [item.symbol, item.name, item.providerItemId].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  return rows.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
}

function getMarketList(db, key) {
  return (db.marketLists || []).find((item) => item.key === key);
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
      [item.displayName, item.jobKey, item.domain, item.provider, item.handler, item.resultKind, item.errorMessage].some((value) =>
        String(value || '').toLowerCase().includes(q),
      ),
    );
  }
  return rows.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
}

function dashboardSummary(db) {
  const recentRuns = db.pollingJobRuns.slice(0, 200);
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
      marketQuotes: db.marketQuotes.length,
      coinMarkets: db.coinMarkets.length,
      jobs: db.pollingJobs.length,
      enabledJobs: db.pollingJobs.filter((job) => job.enabled).length,
      recentFailedRuns: recentRuns.filter((run) => run.status === 'failed').length,
    },
    recentRuns: latestRunByJob,
  };
}

const RESET_TARGETS = {
  newsItems: 'newsItems',
  newsTranslations: 'newsTranslations',
  calendarEvents: 'calendarEvents',
  youtubeVideos: 'youtubeVideos',
  marketQuotes: 'marketQuotes',
  coinMarkets: 'coinMarkets',
  pollingJobRuns: 'pollingJobRuns',
};

async function serveAdmin(res) {
  const file = path.join(config.rootDir, 'src', 'public', 'admin.html');
  const body = await fs.readFile(file, 'utf8');
  text(res, 200, body, 'text/html; charset=utf-8');
}

async function serveAdminStatic(res, pathname) {
  const safeName = path.basename(pathname);
  const file = path.join(config.rootDir, 'src', 'public', 'admin', safeName);
  const ext = path.extname(file);
  const body = await fs.readFile(file);
  const contentType = ext === '.css' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
  res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
  res.end(body);
}

function serveSwaggerUi(res) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Signal Server API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true
      });
    </script>
  </body>
</html>`;
  text(res, 200, html, 'text/html; charset=utf-8');
}

async function serveAsset(res, relativePath, contentType) {
  const file = path.join(config.rootDir, '..', relativePath);
  const body = await fs.readFile(file);
  res.writeHead(200, { 'content-type': contentType, 'cache-control': 'public, max-age=3600' });
  res.end(body);
}

export async function handleRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/health') {
      json(res, 200, { ok: true, service: 'signal-server', now: nowIso() });
      return;
    }

    if (req.method === 'GET' && pathname === '/openapi.json') {
      json(res, 200, getOpenApiSpec());
      return;
    }

    if (req.method === 'GET' && (pathname === '/docs' || pathname === '/docs/')) {
      serveSwaggerUi(res);
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/config') {
      json(res, 200, { service: 'signal-server', version: '0.1.0' });
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/news') {
      const db = await readDb();
      const locale = url.searchParams.get('locale') || 'ko';
      const limit = Math.min(Number(url.searchParams.get('limit') || 30), 100);
      const rows = filterNews(db.newsItems, url)
        .slice(0, limit)
        .map((item) => displayNews(item, db.newsTranslations, locale));
      json(res, 200, { data: rows });
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/calendar') {
      const db = await readDb();
      json(res, 200, { data: filterCalendar(db.calendarEvents, url) });
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/youtube') {
      const db = await readDb();
      const page = paginate(filterYoutube(db.youtubeVideos, url), url, 30, 100);
      json(res, 200, { data: page.rows, page: page.page, pageSize: page.pageSize, total: page.total, totalPages: page.totalPages });
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/market-quotes') {
      const db = await readDb();
      const page = paginate(filterMarketQuotes(db.marketQuotes, url), url, 30, 100);
      json(res, 200, { data: page.rows, page: page.page, pageSize: page.pageSize, total: page.total, totalPages: page.totalPages });
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/coins') {
      const db = await readDb();
      const page = paginate(filterCoinMarkets(db.coinMarkets, url), url, 30, 100);
      json(res, 200, { data: page.rows, page: page.page, pageSize: page.pageSize, total: page.total, totalPages: page.totalPages });
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/market-lists') {
      const db = await readDb();
      json(res, 200, { data: (db.marketLists || []).map(publicMarketList) });
      return;
    }

    const publicMarketListMatch = pathname.match(/^\/v1\/market-lists\/([^/]+)$/);
    if (req.method === 'GET' && publicMarketListMatch) {
      const db = await readDb();
      const key = decodeURIComponent(publicMarketListMatch[1]);
      const list = getMarketList(db, key);
      if (!list) {
        json(res, 404, { error: 'MARKET_LIST_NOT_FOUND' });
        return;
      }
      json(res, 200, { data: publicMarketList(list) });
      return;
    }

    if (req.method === 'GET' && pathname === '/admin') {
      await serveAdmin(res);
      return;
    }

    if (req.method === 'GET' && /^\/admin\/[a-zA-Z0-9_-]+\.(?:js|css)$/.test(pathname)) {
      await serveAdminStatic(res, pathname);
      return;
    }

    if (req.method === 'GET' && pathname === '/assets/images/developer-avatar.png') {
      await serveAsset(res, 'assets/images/developer-avatar.png', 'image/png');
      return;
    }

    if (req.method === 'GET' && pathname === '/admin/api/session') {
      json(res, 200, { adminId: getAdminId(req) });
      return;
    }

    if (req.method === 'POST' && pathname === '/admin/api/login') {
      const body = await readBody(req);
      if (body.loginId === config.adminId && body.password === config.adminPassword) {
        res.setHeader('set-cookie', `signal_admin_session=${encodeURIComponent(sessionToken(config.adminId))}; HttpOnly; SameSite=Lax; Path=/`);
        json(res, 200, { ok: true, adminId: config.adminId });
      } else {
        json(res, 401, { error: 'INVALID_LOGIN' });
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/admin/api/logout') {
      res.setHeader('set-cookie', 'signal_admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
      json(res, 200, { ok: true });
      return;
    }

    if (pathname.startsWith('/admin/api/')) {
      const adminId = requireAdmin(req, res);
      if (!adminId) return;

      if (req.method === 'GET' && pathname === '/admin/api/jobs') {
        const db = await readDb();
        json(res, 200, { data: db.pollingJobs, runs: db.pollingJobRuns.slice(0, 50) });
        return;
      }

      if (req.method === 'GET' && pathname === '/admin/api/summary') {
        const db = await readDb();
        json(res, 200, { data: dashboardSummary(db) });
        return;
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
        return;
      }

      const jobRunMatch = pathname.match(/^\/admin\/api\/jobs\/([^/]+)\/run$/);
      if (req.method === 'POST' && jobRunMatch) {
        const result = await runPollingJob(decodeURIComponent(jobRunMatch[1]), { force: true, trigger: 'manual' });
        json(res, 200, { data: result });
        return;
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
        return;
      }

      if (req.method === 'GET' && pathname === '/admin/api/news') {
        const db = await readDb();
        const locale = url.searchParams.get('locale') || 'ko';
        const translationStatus = url.searchParams.get('translationStatus');
        let filtered = filterNews(db.newsItems, url).map((item) => ({
          ...displayNews(item, db.newsTranslations, locale),
          translations: db.newsTranslations.filter((t) => t.newsItemId === item.id),
        }));
        if (translationStatus) {
          filtered = filtered.filter((item) => item.translationStatus === translationStatus);
        }
        const page = paginate(filtered, url, 30, 100);
        json(res, 200, {
          data: page.rows,
          page: page.page,
          pageSize: page.pageSize,
          total: page.total,
          totalPages: page.totalPages,
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/admin/api/youtube') {
        const db = await readDb();
        const page = paginate(filterYoutube(db.youtubeVideos, url), url, 30, 100);
        const channels = [...new Set(db.youtubeVideos.map((item) => item.channel).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        json(res, 200, { data: page.rows, channels, page: page.page, pageSize: page.pageSize, total: page.total, totalPages: page.totalPages });
        return;
      }

      if (req.method === 'GET' && pathname === '/admin/api/calendar') {
        const db = await readDb();
        const page = paginate(filterCalendar(db.calendarEvents, url), url, 30, 500);
        json(res, 200, { data: page.rows, page: page.page, pageSize: page.pageSize, total: page.total, totalPages: page.totalPages });
        return;
      }

      if (req.method === 'POST' && pathname === '/admin/api/news/retranslate') {
        const body = await readBody(req);
        const ids = Array.isArray(body.ids) ? body.ids : [];
        const locale = body.locale || 'ko';
        const result = await retranslateNewsItems({
          ids,
          locale,
          provider: body.provider,
          model: body.model,
          adminId,
        });
        json(res, 200, { data: result });
        return;
      }

      if (req.method === 'POST' && pathname === '/admin/api/news/delete') {
        const body = await readBody(req);
        const ids = Array.isArray(body.ids) ? body.ids : [];
        const result = await updateDb((db) => {
          const idSet = new Set(ids);
          const beforeNews = db.newsItems.length;
          const beforeTranslations = db.newsTranslations.length;
          db.newsItems = db.newsItems.filter((item) => !idSet.has(item.id));
          db.newsTranslations = db.newsTranslations.filter((item) => !idSet.has(item.newsItemId));
          return {
            newsDeleted: beforeNews - db.newsItems.length,
            translationsDeleted: beforeTranslations - db.newsTranslations.length,
          };
        });
        json(res, 200, { data: result });
        return;
      }

      if (req.method === 'POST' && pathname === '/admin/api/youtube/refresh-selected') {
        const body = await readBody(req);
        const ids = Array.isArray(body.ids) ? body.ids : [];
        if (ids.length === 0) {
          const result = await runPollingJob('youtube_economy_reconcile', { force: true, trigger: 'manual' });
          json(res, 200, { data: { requested: 0, run: result } });
          return;
        }
        const result = await updateDb(async (db) => {
          const idSet = new Set(ids);
          const videoIds = db.youtubeVideos
            .filter((item) => idSet.has(item.id))
            .map((item) => item.videoId || item.providerItemId)
            .filter(Boolean);
          const rows = await fetchYoutubeVideosByIds(videoIds, { order: 'date' });
          for (const row of rows) upsertById(db.youtubeVideos, row);
          return { requested: ids.length, updated: rows.length };
        });
        json(res, 200, { data: result });
        return;
      }

      const translationMatch = pathname.match(/^\/admin\/api\/news\/([^/]+)\/translation\/([^/]+)$/);
      if (req.method === 'PATCH' && translationMatch) {
        const newsItemId = decodeURIComponent(translationMatch[1]);
        const locale = decodeURIComponent(translationMatch[2]);
        const body = await readBody(req);
        const updated = await updateDb((db) =>
          upsertById(db.newsTranslations, {
            id: `${newsItemId}:${locale}`,
            newsItemId,
            locale,
            title: String(body.title || ''),
            summary: String(body.summary || ''),
            content: String(body.content || ''),
            provider: 'manual',
            model: 'admin-edit',
            status: 'manual',
            errorMessage: null,
            translatedAt: nowIso(),
            editedByAdminId: adminId,
            editedAt: nowIso(),
          }),
        );
        json(res, 200, { data: updated });
        return;
      }

      if (req.method === 'GET' && pathname === '/admin/api/translation-settings') {
        const db = await readDb();
        json(res, 200, { data: db.translationSettings });
        return;
      }

      if (req.method === 'GET' && pathname === '/admin/api/provider-settings') {
        json(res, 200, { data: await listProviderSettingsPublic() });
        return;
      }

      if (req.method === 'GET' && pathname === '/admin/api/ui-model-presets') {
        const db = await readDb();
        json(res, 200, { data: db.uiModelPresets || null });
        return;
      }

      if (req.method === 'PATCH' && pathname === '/admin/api/ui-model-presets') {
        const patch = await readBody(req);
        const updated = await updateDb((db) => {
          const cur = db.uiModelPresets && typeof db.uiModelPresets === 'object' ? db.uiModelPresets : {};
          const next = {
            ...cur,
            openai: Array.isArray(patch.openai) ? patch.openai : cur.openai,
            claude: Array.isArray(patch.claude) ? patch.claude : cur.claude,
            mock: Array.isArray(patch.mock) ? patch.mock : cur.mock,
            updatedAt: nowIso(),
          };
          db.uiModelPresets = next;
          return next;
        });
        json(res, 200, { data: updated });
        return;
      }

      if (req.method === 'GET' && pathname === '/admin/api/market-lists') {
        const db = await readDb();
        json(res, 200, { data: (db.marketLists || []).map(publicMarketList) });
        return;
      }

      const marketListMatch = pathname.match(/^\/admin\/api\/market-lists\/([^/]+)$/);
      if (req.method === 'PATCH' && marketListMatch) {
        const key = decodeURIComponent(marketListMatch[1]);
        if (!MARKET_LIST_KEYS.includes(key)) {
          json(res, 400, { error: 'UNKNOWN_MARKET_LIST' });
          return;
        }
        const patch = await readBody(req);
        const updated = await updateDb((db) => {
          const list = getMarketList(db, key);
          if (!list) throw new Error(`MARKET_LIST_NOT_FOUND:${key}`);
          if (typeof patch.displayName === 'string') list.displayName = patch.displayName.trim() || key;
          if (typeof patch.description === 'string') list.description = patch.description.trim();
          if (patch.symbols != null) list.symbols = normalizeMarketSymbols(patch.symbols);
          list.updatedAt = nowIso();
          return publicMarketList(list);
        });
        json(res, 200, { data: updated });
        return;
      }

      const providerSettingMatch = pathname.match(/^\/admin\/api\/provider-settings\/([^/]+)$/);
      if (req.method === 'PATCH' && providerSettingMatch) {
        const provider = decodeURIComponent(providerSettingMatch[1]);
        if (!['finnhub', 'openai', 'claude', 'youtube', 'coingecko'].includes(provider)) {
          json(res, 400, { error: 'UNKNOWN_PROVIDER' });
          return;
        }
        const patch = await readBody(req);
        const updated = await updateProviderSetting(provider, patch);
        json(res, 200, { data: updated });
        return;
      }

      if (req.method === 'POST' && pathname === '/admin/api/translation-test') {
        const body = await readBody(req);
        const locale = body.locale || 'ko';
        const textValue = String(body.text || 'Signal 앱을 이용해 주셔서 감사합니다. 앞으로도 좋은 기능들을 업데이트하겠습니다.');
        const translated = await translateNews({
          locale,
          provider: body.provider,
          model: body.model,
          newsItem: {
            titleOriginal: textValue,
            summaryOriginal: textValue,
            contentOriginal: '',
            sourceName: 'Signal Admin',
          },
        });
        json(res, 200, { data: translated });
        return;
      }

      const settingMatch = pathname.match(/^\/admin\/api\/translation-settings\/([^/]+)$/);
      if (req.method === 'PATCH' && settingMatch) {
        const locale = decodeURIComponent(settingMatch[1]);
        const patch = await readBody(req);
        const updated = await updateDb((db) => {
          let setting = db.translationSettings.find((s) => s.locale === locale);
          if (!setting) {
            setting = { locale, provider: 'mock', model: 'mock-news-v1', enabled: false, autoTranslateNews: false };
            db.translationSettings.push(setting);
          }
          for (const key of ['provider', 'model']) {
            if (typeof patch[key] === 'string') setting[key] = patch[key];
          }
          for (const key of ['enabled', 'autoTranslateNews']) {
            if (typeof patch[key] === 'boolean') setting[key] = patch[key];
          }
          setting.updatedAt = nowIso();
          return setting;
        });
        json(res, 200, { data: updated });
        return;
      }

      if (req.method === 'POST' && pathname === '/admin/api/data-reset') {
        const body = await readBody(req);
        const targets = Array.isArray(body.targets) ? body.targets : [];
        if (body.confirmText !== 'RESET') {
          json(res, 400, { error: 'CONFIRM_TEXT_REQUIRED' });
          return;
        }
        const normalizedTargets = targets
          .map((target) => RESET_TARGETS[target])
          .filter((target, index, arr) => target && arr.indexOf(target) === index);
        if (normalizedTargets.length === 0) {
          json(res, 400, { error: 'NO_RESET_TARGETS' });
          return;
        }
        const result = await updateDb((db) => {
          const counts = {};
          for (const target of normalizedTargets) {
            counts[target] = Array.isArray(db[target]) ? db[target].length : 0;
            db[target] = [];
          }
          return { targets: normalizedTargets, counts };
        });
        json(res, 200, { data: result });
        return;
      }
    }

    json(res, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}
