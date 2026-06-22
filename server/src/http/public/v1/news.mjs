import {
  queryPublicNews,
  queryPublicNewsDigests,
  queryPublicNewsSources,
  upsertCollectionRows,
  upsertNotificationItem,
} from '../../../db.mjs';
import { createNotificationItem } from '../../../notifications/outbox.mjs';
import { config } from '../../../config.mjs';
import { json, readBody } from '../../shared.mjs';

function cleanText(value) {
  return String(value || '').trim();
}

function hasIngestAccess(req) {
  const configured = cleanText(config.automationIngestToken);
  if (!configured) return false;
  const header = cleanText(req.headers['x-signal-automation-token']);
  const bearer = cleanText(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  return header === configured || bearer === configured;
}

async function maybeQueueDigestPush(item) {
  if (!item?.pushCandidate) return null;
  const notification = createNotificationItem({
    id: `notification:push:news_digest:${item.id}`,
    type: 'news_digest',
    title: item.pushTitle || item.title,
    body: item.pushBody || item.summary,
    channel: 'push',
    status: 'queued',
    priority: 'normal',
    targetType: 'all',
    sourceType: 'news_digest',
    sourceId: item.id,
    deepLink: '/news',
    reason: `news digest updated: ${item.category}`,
    scheduledAt: item.generatedAt,
    payload: { digestId: item.id, category: item.category },
  });
  if (!notification) return null;
  return upsertNotificationItem(notification);
}

export async function handlePublicNewsRoutes({ req, res, url, pathname }) {
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
    const sendPush = body?.sendPush !== false;
    const now = new Date().toISOString();
    const items = rawItems.map((item, index) => ({
      ...item,
      score: 100 - index * 10,
      updatedAt: now,
    }));
    await upsertCollectionRows('newsDigestItems', items);
    let pushed = 0;
    if (sendPush) {
      const pushResults = await Promise.all(items.map(maybeQueueDigestPush));
      pushed = pushResults.filter(Boolean).length;
    }
    json(res, 200, { ok: true, count: items.length, pushed });
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

  if (req.method === 'GET' && pathname === '/v1/news-sources') {
    const category = url.searchParams.get('category');
    const sources = await queryPublicNewsSources({ category });
    json(res, 200, { data: sources });
    return true;
  }

  return false;
}
