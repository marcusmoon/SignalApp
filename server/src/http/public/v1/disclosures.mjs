import {
  queryPublicDisclosureById,
  queryPublicDisclosures,
  queryPublicDisclosureDigests,
  upsertCollectionRows,
  upsertNotificationItem,
} from '../../../db.mjs';
import { NOTIFICATION_TYPES } from '../../../notifications/notificationItem.mjs';
import { resolveDigestItemNotifyInbox, resolveIngestNotifyInbox, resolveIngestSendPush } from '../../../notifications/ingestFlags.mjs';
import { buildPublishedNotification } from '../../../notifications/publish.mjs';
import { config } from '../../../config.mjs';
import { utcDateKeyFromInstant } from '../../../time/utc.mjs';
import { normalizeSourceRefs } from '../../../sources/normalizeSourceRefs.mjs';
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

async function publishDigestNotification(item, queuePush) {
  const market = cleanText(item?.market) || 'us';
  const date =
    cleanText(item?.generatedDate).slice(0, 10) ||
    utcDateKeyFromInstant(item?.generatedAt);
  const digestId = cleanText(item?.id);
  const params = new URLSearchParams({ market });
  if (date) params.set('date', date);
  if (digestId) params.set('digestId', digestId);
  const notification = buildPublishedNotification(
    {
      id: `notification:push:disclosure_digest:${item.id}`,
      type: NOTIFICATION_TYPES.disclosureDigest,
      title: item.pushTitle || item.title,
      body: item.pushBody || item.summary,
      channel: 'push',
      priority: 'normal',
      targetType: 'all',
      sourceType: 'disclosure_digest',
      sourceId: item.id,
      deepLink: `/disclosure-flow?${params.toString()}`,
      reason: `disclosure digest updated: ${market}`,
      scheduledAt: item.generatedAt,
      payload: { digestId: item.id, market, ...(date ? { generatedDate: date } : {}) },
    },
    { queuePush },
  );
  if (!notification) return null;
  return upsertNotificationItem(notification);
}

export async function handlePublicDisclosureRoutes({ req, res, url, pathname }) {
  if (req.method === 'POST' && pathname === '/v1/disclosure-digests/ingest') {
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
      score: item.score ?? (100 - index * 10),
      updatedAt: now,
    }));
    await upsertCollectionRows('disclosureDigestItems', items);
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
    json(res, 200, {
      ok: true,
      count: items.length,
      notifyInbox,
      sendPush,
      inboxPublished,
      pushQueued,
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/disclosure-digests') {
    const page = await queryPublicDisclosureDigests({
      market: url.searchParams.get('market') || '',
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

  if (req.method === 'GET' && pathname === '/v1/disclosures') {
    const page = await queryPublicDisclosures({
      market: url.searchParams.get('market') || '',
      provider: url.searchParams.get('provider') || '',
      formType: url.searchParams.get('formType') || '',
      typeCategory: url.searchParams.get('typeCategory') || '',
      symbol: url.searchParams.get('symbol') || '',
      symbols: url.searchParams.get('symbols') || '',
      q: url.searchParams.get('q') || '',
      from: url.searchParams.get('from') || '',
      to: url.searchParams.get('to') || '',
      limit: url.searchParams.get('limit') || '30',
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

  const detailMatch = /^\/v1\/disclosures\/([^/]+)$/.exec(pathname);
  if (req.method === 'GET' && detailMatch) {
    const item = await queryPublicDisclosureById(decodeURIComponent(detailMatch[1]));
    if (!item) {
      json(res, 404, { error: 'DISCLOSURE_NOT_FOUND' });
      return true;
    }
    json(res, 200, { data: item });
    return true;
  }

  return false;
}
