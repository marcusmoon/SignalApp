import crypto from 'node:crypto';

import {
  findNewsItemsByIds,
  queryPublicNews,
  queryPublicNewsDigests,
  queryPublicNewsSources,
  queryPendingNewsTranslations,
  upsertCollectionRows,
  upsertNotificationItem,
} from '../../../db.mjs';
import { NOTIFICATION_TYPES } from '../../../notifications/notificationItem.mjs';
import { resolveDigestItemNotifyInbox, resolveIngestNotifyInbox, resolveIngestSendPush } from '../../../notifications/ingestFlags.mjs';
import { buildPublishedNotification } from '../../../notifications/publish.mjs';
import { config } from '../../../config.mjs';
import { hashtagRecordsFromLabels, normalizeNewsHashtagLabels } from '../../../newsHashtags.mjs';
import { utcDateKeyFromInstant } from '../../../time/utc.mjs';
import { normalizeSourceRefs } from '../../../sources/normalizeSourceRefs.mjs';
import { json, readBody } from '../../shared.mjs';

function cleanText(value) {
  return String(value || '').trim();
}

function cleanArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasIngestAccess(req) {
  const configured = cleanText(config.automationIngestToken);
  if (!configured) return false;
  const header = cleanText(req.headers['x-signal-automation-token']);
  const bearer = cleanText(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  return header === configured || bearer === configured;
}

function stableNewsItemId(item) {
  const category = cleanText(item?.category).toLowerCase() || 'global';
  const basis = [
    cleanText(item?.sourceUrl).toLowerCase(),
    cleanText(item?.sourceName).toLowerCase(),
    cleanText(item?.titleOriginal || item?.title).toLowerCase(),
    cleanText(item?.publishedAt).slice(0, 10),
  ].join('|');
  const hash = crypto.createHash('sha1').update(basis).digest('hex').slice(0, 16);
  return `codex-news:${category}:${hash}`;
}

function defaultPendingFrom() {
  return new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
}

function normalizeTranslationIngestItem(raw, now) {
  const newsItemId = cleanText(raw?.newsItemId || raw?.id);
  const locale = cleanText(raw?.locale || 'ko').toLowerCase() || 'ko';
  const title = cleanText(raw?.title);
  const summary = cleanText(raw?.summary);
  const content = cleanText(raw?.content);
  if (!newsItemId || !locale || (!title && !summary && !content)) return null;
  return {
    id: `${newsItemId}:${locale}`,
    newsItemId,
    locale,
    provider: cleanText(raw?.provider) || 'codex',
    model: cleanText(raw?.model) || 'codex-scheduled-news-translation',
    status: cleanText(raw?.status) || 'completed',
    title,
    summary,
    content,
    errorMessage: null,
    translatedAt: cleanText(raw?.translatedAt) || now,
    editedByAdminId: null,
    editedAt: null,
    updatedAt: now,
  };
}

function normalizeNewsIngestItem(raw, index, now) {
  const category = cleanText(raw?.category).toLowerCase() || 'global';
  if (!['global', 'crypto', 'korea'].includes(category)) return null;
  const titleOriginal = cleanText(raw?.titleOriginal || raw?.originalTitle || raw?.title);
  const summaryOriginal = cleanText(raw?.summaryOriginal || raw?.originalSummary || raw?.summary);
  const contentOriginal = cleanText(raw?.contentOriginal || raw?.originalContent || raw?.content || summaryOriginal);
  const sourceName = cleanText(raw?.sourceName || raw?.source);
  const sourceUrl = cleanText(raw?.sourceUrl || raw?.url);
  if (!titleOriginal || !sourceName || !sourceUrl) return null;
  const labels = normalizeNewsHashtagLabels([
    ...cleanArray(raw?.hashtags).map((tag) => (typeof tag === 'string' ? tag : tag?.label)),
    ...cleanArray(raw?.hashtagLabels),
    ...cleanArray(raw?.symbols),
  ]);
  return {
    id: cleanText(raw?.id) || stableNewsItemId({ ...raw, category, titleOriginal, sourceName, sourceUrl }),
    category,
    provider: cleanText(raw?.provider) || 'codex',
    sourceName,
    sourceUrl,
    imageUrl: cleanText(raw?.imageUrl) || null,
    titleOriginal,
    summaryOriginal,
    contentOriginal,
    symbols: cleanArray(raw?.symbols).map((s) => cleanText(s).toUpperCase()).filter(Boolean).slice(0, 12),
    hashtags: hashtagRecordsFromLabels(labels, 'auto'),
    hashtagSource: 'auto',
    hashtagsUpdatedAt: labels.length ? now : null,
    publishedAt: cleanText(raw?.publishedAt) || now,
    fetchedAt: cleanText(raw?.fetchedAt) || now,
    createdAt: cleanText(raw?.createdAt) || now,
    updatedAt: now,
    codexIngest: true,
    position: index,
  };
}

async function publishDigestNotification(item, queuePush) {
  const category = cleanText(item?.category) || 'global';
  const date =
    cleanText(item?.generatedDate).slice(0, 10) ||
    utcDateKeyFromInstant(item?.generatedAt) ||
    utcDateKeyFromInstant(item?.publishedAt);
  const digestId = cleanText(item?.id);
  const params = new URLSearchParams({ category });
  if (date) params.set('date', date);
  if (digestId) params.set('digestId', digestId);
  const notification = buildPublishedNotification(
    {
      id: `notification:push:news_digest:${item.id}`,
      type: NOTIFICATION_TYPES.newsDigest,
      title: item.pushTitle || item.title,
      body: item.pushBody || item.summary,
      channel: 'push',
      priority: 'normal',
      targetType: 'all',
      sourceType: 'news_digest',
      sourceId: item.id,
      deepLink: `/news-issues?${params.toString()}`,
      reason: `news digest updated: ${category}`,
      scheduledAt: item.generatedAt,
      sourceRefs: normalizeSourceRefs(item.sourceRefs, { limit: 4 }),
      payload: {
        digestId: item.id,
        category,
        sources: Array.isArray(item.sources) ? item.sources.slice(0, 4) : [],
        ...(date ? { generatedDate: date } : {}),
      },
    },
    { queuePush },
  );
  if (!notification) return null;
  return upsertNotificationItem(notification);
}

export async function handlePublicNewsRoutes({ req, res, url, pathname }) {
  if (req.method === 'POST' && pathname === '/v1/news/ingest') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'AUTOMATION_INGEST_AUTH_REQUIRED' });
      return true;
    }
    const body = await readBody(req);
    const rawItems = Array.isArray(body?.items) ? body.items : [];
    if (rawItems.length === 0) {
      json(res, 400, { error: 'ITEMS_REQUIRED' });
      return true;
    }
    const now = new Date().toISOString();
    const normalized = rawItems
      .slice(0, 50)
      .map((item, index) => normalizeNewsIngestItem(item, index, now))
      .filter(Boolean);
    if (normalized.length === 0) {
      json(res, 400, { error: 'VALID_ITEMS_REQUIRED' });
      return true;
    }
    const items = normalized;
    await upsertCollectionRows('newsItems', items);
    json(res, 201, {
      data: {
        count: items.length,
        ids: items.map((item) => item.id),
      },
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/news/translations/ingest') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'AUTOMATION_INGEST_AUTH_REQUIRED' });
      return true;
    }
    const body = await readBody(req);
    const rawItems = Array.isArray(body?.items) ? body.items : [];
    if (rawItems.length === 0) {
      json(res, 400, { error: 'ITEMS_REQUIRED' });
      return true;
    }
    const now = new Date().toISOString();
    const normalized = rawItems
      .slice(0, 50)
      .map((item) => normalizeTranslationIngestItem(item, now))
      .filter(Boolean);
    if (normalized.length === 0) {
      json(res, 400, { error: 'VALID_ITEMS_REQUIRED' });
      return true;
    }
    const existingIds = await findNewsItemsByIds(normalized.map((item) => item.newsItemId));
    const translations = normalized.filter((item) => existingIds.has(item.newsItemId));
    if (translations.length === 0) {
      json(res, 400, { error: 'NEWS_ITEMS_NOT_FOUND' });
      return true;
    }
    await upsertCollectionRows('newsTranslations', translations);
    json(res, 201, {
      data: {
        count: translations.length,
        skipped: normalized.length - translations.length,
        ids: translations.map((item) => item.newsItemId),
      },
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/news-digests/ingest') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'AUTOMATION_INGEST_AUTH_REQUIRED' });
      return true;
    }
    const body = await readBody(req);
    const rawItems = Array.isArray(body?.items) ? body.items : [];
    if (rawItems.length === 0) {
      json(res, 400, { error: 'ITEMS_REQUIRED' });
      return true;
    }
    const sendPush = resolveIngestSendPush(body);
    const notifyInbox = resolveIngestNotifyInbox(body);
    const now = new Date().toISOString();
    const items = rawItems.map((item, index) => ({
      ...item,
      sourceRefs: normalizeSourceRefs(item.sourceRefs, { limit: 12 }),
      sources: [],
      score: 100 - index * 10,
      updatedAt: now,
    }));
    await upsertCollectionRows('newsDigestItems', items);
    let inboxPublished = 0;
    let pushQueued = 0;
    for (const item of items) {
      if (!resolveDigestItemNotifyInbox(body, item)) continue;
      const saved = await publishDigestNotification(item, sendPush);
      if (saved) {
        inboxPublished += 1;
        if (sendPush) pushQueued += 1;
      }
    }
    const meta = {
      ok: true,
      count: items.length,
      notifyInbox,
      sendPush,
      inboxPublished,
      pushQueued,
    };
    json(res, 200, meta);
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/news-digests') {
    const page = await queryPublicNewsDigests({
      category: url.searchParams.get('category') || '',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      limit: url.searchParams.get('limit') || '4',
      offset: url.searchParams.get('offset') || '0',
      batches: url.searchParams.get('batches') || '1',
      locale: url.searchParams.get('locale') || 'ko',
    });
    json(res, 200, {
      data: page.rows,
      meta: {
        limit: page.limit,
        offset: page.offset,
        total: page.total,
        hasMore: page.hasMore,
        nextOffset: page.nextOffset,
      },
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/news') {
    const page = await queryPublicNews({
      locale: url.searchParams.get('locale') || 'ko',
      category: url.searchParams.get('category') || '',
      symbol: url.searchParams.get('symbol') || '',
      symbols: url.searchParams.get('symbols') || '',
      source: url.searchParams.get('source') || '',
      sources: url.searchParams.get('sources') || '',
      flash: url.searchParams.get('flash') || '',
      q: url.searchParams.get('q') || '',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      tag: url.searchParams.get('tag') || '',
      limit: url.searchParams.get('limit') || '20',
      offset: url.searchParams.get('offset') || '0',
    });
    json(res, 200, {
      data: page.rows,
      meta: {
        limit: page.limit,
        offset: page.offset,
        total: page.total,
        hasMore: page.hasMore,
        nextOffset: page.nextOffset,
      },
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/news/pending-translations') {
    if (!hasIngestAccess(req)) {
      json(res, 401, { error: 'AUTOMATION_INGEST_AUTH_REQUIRED' });
      return true;
    }
    const page = await queryPendingNewsTranslations({
      targetLocale: url.searchParams.get('target_locale') || 'ko',
      category: url.searchParams.get('category') || '',
      from: url.searchParams.get('from') || defaultPendingFrom(),
      limit: url.searchParams.get('limit') || '50',
      offset: url.searchParams.get('offset') || '0',
    });
    json(res, 200, {
      data: page.rows,
      meta: {
        targetLocale: page.targetLocale,
        limit: page.limit,
        offset: page.offset,
        total: page.total,
        hasMore: page.hasMore,
        nextOffset: page.nextOffset,
      },
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/news-sources') {
    const category = url.searchParams.get('category');
    const sources = await queryPublicNewsSources({ category });
    json(res, 200, { data: sources });
    return true;
  }

  return false;
}
